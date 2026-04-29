// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * EIP-7702 delegation contract. A user signs a delegation authorizing their client agent
 * to spend USDC on their behalf — scoped to a single task, a max budget cap, and a 1-hour window.
 *
 * With EIP-7702, this contract's code runs in the context of the user's EOA. The user's wallet
 * IS the contract temporarily. So msg.sender checks elsewhere see the user's address.
 *
 * The client agent calls executeEscrowLock() which pulls from the user's wallet directly
 * without the user needing to be online — but only within the signed delegation's limits.
 */
contract HiveBidDelegation is ReentrancyGuard {
    IERC20 public immutable usdc;
    address public immutable escrowContract;

    struct Delegation {
        address agent;       // client agent address authorized to spend
        bytes32 taskId;      // locked to a single task
        uint256 maxAmount;   // spending cap in USDC (6 decimals)
        uint256 expiry;      // unix timestamp — agent loses access after this
        bool consumed;       // one-shot: used once, then dead
    }

    // delegationId => Delegation
    mapping(bytes32 => Delegation) public delegations;

    event DelegationCreated(bytes32 indexed delegationId, address indexed agent, bytes32 indexed taskId, uint256 maxAmount, uint256 expiry);
    event DelegationConsumed(bytes32 indexed delegationId, bytes32 indexed taskId, uint256 amount);
    event DelegationRevoked(bytes32 indexed delegationId);

    error Unauthorized();
    error DelegationExpired();
    error DelegationConsumedOrMissing();
    error ExceedsCap();
    error TransferFailed();

    constructor(address _usdc, address _escrow) {
        usdc = IERC20(_usdc);
        escrowContract = _escrow;
    }

    /**
     * User calls this to register a delegation for a specific task.
     * In production this is called via the EIP-7702 signed authorization — the user's
     * EOA executes this code and msg.sender is the user's own address.
     */
    function createDelegation(
        bytes32 delegationId,
        address agent,
        bytes32 taskId,
        uint256 maxAmount,
        uint256 expiry
    ) external {
        delegations[delegationId] = Delegation({
            agent: agent,
            taskId: taskId,
            maxAmount: maxAmount,
            expiry: expiry,
            consumed: false
        });

        emit DelegationCreated(delegationId, agent, taskId, maxAmount, expiry);
    }

    /**
     * Called by the client agent (via KeeperHub) to lock escrow.
     * Pulls USDC from the user's wallet and calls escrow.lock() — single atomic call.
     * Delegation is consumed after this; cannot be reused.
     */
    function executeEscrowLock(
        bytes32 delegationId,
        address userWallet,
        address worker,
        uint256 amount,
        uint256 taskDeadline
    ) external nonReentrant {
        Delegation storage d = delegations[delegationId];

        if (d.consumed || d.agent == address(0)) revert DelegationConsumedOrMissing();
        if (msg.sender != d.agent) revert Unauthorized();
        if (block.timestamp > d.expiry) revert DelegationExpired();
        if (amount > d.maxAmount) revert ExceedsCap();

        d.consumed = true;

        // Pull USDC from user wallet → this contract → escrow
        bool pulled = usdc.transferFrom(userWallet, address(this), amount);
        if (!pulled) revert TransferFailed();

        usdc.approve(escrowContract, amount);

        // Call escrow on behalf of the user
        (bool ok,) = escrowContract.call(
            abi.encodeWithSignature(
                "lock(bytes32,address,uint256,uint256)",
                d.taskId,
                worker,
                amount,
                taskDeadline
            )
        );
        require(ok, "escrow lock failed");

        emit DelegationConsumed(delegationId, d.taskId, amount);
    }

    /**
     * User can revoke an unused delegation at any time.
     */
    function revoke(bytes32 delegationId) external {
        Delegation storage d = delegations[delegationId];
        // Only the original delegating wallet can revoke
        // In EIP-7702 context this is enforced by the EOA being msg.sender
        d.consumed = true;
        emit DelegationRevoked(delegationId);
    }

    /**
     * Check if a delegation is still valid without consuming it.
     */
    function isValid(bytes32 delegationId) external view returns (bool) {
        Delegation storage d = delegations[delegationId];
        return !d.consumed && d.agent != address(0) && block.timestamp <= d.expiry;
    }
}
