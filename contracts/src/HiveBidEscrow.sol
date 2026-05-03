// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * Holds USDC per task. Releases to worker on verified delivery, refunds user on failure.
 * Only the evaluator's signed verdict can unlock funds.
 */
contract HiveBidEscrow is ReentrancyGuard {
    IERC20 public immutable usdc;
    address public immutable evaluator;

    enum Status { Empty, Locked, Released, Refunded }

    struct Task {
        address client;
        address worker;
        uint256 amount;
        Status status;
        uint256 deadline;
    }

    mapping(bytes32 => Task) public tasks;

    event Locked(bytes32 indexed taskId, address indexed client, address indexed worker, uint256 amount);
    event Released(bytes32 indexed taskId, address indexed worker, uint256 amount);
    event Refunded(bytes32 indexed taskId, address indexed client, uint256 amount);

    error TaskExists();
    error TaskNotLocked();
    error DeadlineNotPassed();
    error InvalidSignature();
    error TransferFailed();

    constructor(address _usdc, address _evaluator) {
        usdc = IERC20(_usdc);
        evaluator = _evaluator;
    }

    /**
     * Lock USDC into escrow. msg.sender is treated as client.
     * Caller must have approved this contract for `amount` USDC.
     */
    function lock(
        bytes32 taskId,
        address worker,
        uint256 amount,
        uint256 deadline
    ) external nonReentrant {
        _lock(taskId, msg.sender, worker, amount, deadline);
    }

    /**
     * Lock on behalf of a client. Called by KeeperHub's managed wallet.
     * The `client` address must have pre-approved this contract to spend `amount` USDC.
     * USDC is pulled directly from `client`, not from the KeeperHub caller.
     */
    function lockFor(
        bytes32 taskId,
        address client,
        address worker,
        uint256 amount,
        uint256 deadline
    ) external nonReentrant {
        if (tasks[taskId].status != Status.Empty) revert TaskExists();

        tasks[taskId] = Task({
            client: client,
            worker: worker,
            amount: amount,
            status: Status.Locked,
            deadline: deadline
        });

        // Pull USDC from the client wallet (client must have approved this contract)
        bool ok = usdc.transferFrom(client, address(this), amount);
        if (!ok) revert TransferFailed();

        emit Locked(taskId, client, worker, amount);
    }

    function _lock(
        bytes32 taskId,
        address client,
        address worker,
        uint256 amount,
        uint256 deadline
    ) internal {
        if (tasks[taskId].status != Status.Empty) revert TaskExists();

        tasks[taskId] = Task({
            client: client,
            worker: worker,
            amount: amount,
            status: Status.Locked,
            deadline: deadline
        });

        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        emit Locked(taskId, msg.sender, worker, amount);
    }

    /**
     * Release funds to worker. Requires evaluator's signed verdict (pass).
     * Signature covers: taskId + true (pass) + this contract address (replay protection).
     */
    function release(bytes32 taskId, bytes calldata evaluatorSig) external nonReentrant {
        Task storage t = tasks[taskId];
        if (t.status != Status.Locked) revert TaskNotLocked();
        _verifyVerdict(taskId, true, evaluatorSig);

        t.status = Status.Released;
        bool ok = usdc.transfer(t.worker, t.amount);
        if (!ok) revert TransferFailed();

        emit Released(taskId, t.worker, t.amount);
    }

    /**
     * Refund USDC to client. Requires evaluator's signed verdict (fail).
     */
    function refund(bytes32 taskId, bytes calldata evaluatorSig) external nonReentrant {
        Task storage t = tasks[taskId];
        if (t.status != Status.Locked) revert TaskNotLocked();
        _verifyVerdict(taskId, false, evaluatorSig);

        t.status = Status.Refunded;
        bool ok = usdc.transfer(t.client, t.amount);
        if (!ok) revert TransferFailed();

        emit Refunded(taskId, t.client, t.amount);
    }

    /**
     * Emergency refund after deadline passes with no verdict. No signature needed.
     * Protects client if worker disappears and evaluator never responds.
     */
    function refundExpired(bytes32 taskId) external nonReentrant {
        Task storage t = tasks[taskId];
        if (t.status != Status.Locked) revert TaskNotLocked();
        if (block.timestamp <= t.deadline) revert DeadlineNotPassed();

        t.status = Status.Refunded;
        bool ok = usdc.transfer(t.client, t.amount);
        if (!ok) revert TransferFailed();

        emit Refunded(taskId, t.client, t.amount);
    }

    function getTask(bytes32 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    // --- Internal ---

    function _verifyVerdict(bytes32 taskId, bool pass, bytes calldata sig) internal view {
        bytes32 hash = keccak256(abi.encodePacked(taskId, pass, address(this)));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));

        (bytes32 r, bytes32 s, uint8 v) = _splitSig(sig);
        address signer = ecrecover(ethHash, v, r, s);
        if (signer != evaluator) revert InvalidSignature();
    }

    function _splitSig(bytes calldata sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "bad sig length");
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
    }
}
