# Person B — Progress Log

## Contracts (Base Sepolia)

### HiveBidEscrow
- **Address:** `0x2725111582b68539DF62d57F579EAfCEbFb870b0`
- **File:** `contracts/src/HiveBidEscrow.sol`
- Holds USDC per task ID
- `lock()` / `lockFor()` — locks funds after bid accepted
- `release(taskId, evaluatorSig)` — pays worker on pass verdict
- `refund(taskId, evaluatorSig)` — returns funds to client on fail verdict
- `refundExpired(taskId)` — safety refund after deadline with no verdict
- Evaluator address: `0xe01Add0c3640a8314132bAF491d101A38ffEF4f0`

### HiveBidDelegation (EIP-7702)
- **Address:** `0xa952E8aC92BCE001b5Ef4Ddb1A4027a7b9D2868E`
- **File:** `contracts/src/HiveBidDelegation.sol`
- Scoped wallet delegation — client agent can spend only up to budget cap, only for one task, only for 1 hour
- `createDelegation()` — user registers a delegation
- `executeEscrowLock()` — agent calls this to pull USDC and lock escrow atomically
- `revoke()` — user can cancel anytime
- `isValid()` — check if delegation still active

### Deploy Info
- **Deployer wallet:** `0xCD8F91DC7929E973DDc071838904434297aB4673`
- **USDC (Base Sepolia):** `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **Network:** Base Sepolia (chain ID 84532)
- Deploy script: `contracts/scripts/deploy.js`

---

## KeeperHub Integration

- **File:** `keeperhub/escrow.js` — 4 functions Person A imports
- **File:** `keeperhub/client.js` — raw Direct Execution API wrapper
- **ABI:** `keeperhub/abi/HiveBidEscrow.json`

### KeeperHub Wallet
- **Address:** `0xC38Ebc759394D285d70B6bf08295Ba77B0621867`
- Funded with **20 USDC** (Base Sepolia) + **0.01 ETH** for gas
- USDC approved to escrow contract (unlimited, tx completed)
- Network slug: `base-sepolia`

### How Person A uses it
```js
import { lockEscrow, releaseEscrow, refundEscrow } from "../keeperhub/escrow.js";

// After bid accepted:
const { txHash } = await lockEscrow({
  taskId,       // bytes32 hex
  clientAddr,   // user wallet address
  workerAddr,   // winning worker address
  amountUsdc,   // e.g. "25000000" for $25 (6 decimals)
  deadline,     // unix timestamp
});

// After evaluator passes:
const { txHash } = await releaseEscrow({ taskId, evaluatorSig });

// After evaluator fails:
const { txHash } = await refundEscrow({ taskId, evaluatorSig });
```

---

## Environment Variables (contracts/.env)

```
DEPLOYER_PRIVATE_KEY=...
BASE_SEPOLIA_RPC=https://sepolia.base.org
USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
EVALUATOR_ADDRESS=0xe01Add0c3640a8314132bAF491d101A38ffEF4f0
ESCROW_ADDRESS=0x2725111582b68539DF62d57F579EAfCEbFb870b0
DELEGATION_ADDRESS=0xa952E8aC92BCE001b5Ef4Ddb1A4027a7b9D2868E
KH_API_KEY=kh_...
KH_NETWORK=base-sepolia
KH_WALLET_ADDRESS=0xC38Ebc759394D285d70B6bf08295Ba77B0621867
```

---

## What to Share with Person A

| Item | Value |
|---|---|
| Escrow contract | `0x2725111582b68539DF62d57F579EAfCEbFb870b0` |
| Delegation contract | `0xa952E8aC92BCE001b5Ef4Ddb1A4027a7b9D2868E` |
| Escrow ABI | `keeperhub/abi/HiveBidEscrow.json` |
| KeeperHub integration | `keeperhub/escrow.js` |
| Evaluator address | `0xe01Add0c3640a8314132bAF491d101A38ffEF4f0` (derived from Person A's public key) |

---

## Remaining

- [ ] Frontend — being built in separate chat
- [ ] Redeploy contracts with Person A's real evaluator wallet address before demo day
- [ ] Refill KeeperHub wallet USDC if it runs out during testing (20 USDC budget)
