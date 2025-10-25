# Technical Documentation - Fractional Smart Contracts

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Contract Specifications](#contract-specifications)
3. [Hedera Integration](#hedera-integration)
4. [Reward Distribution Model](#reward-distribution-model)
5. [Security Considerations](#security-considerations)
6. [Gas Optimization](#gas-optimization)
7. [Testing Strategy](#testing-strategy)
8. [Deployment Guide](#deployment-guide)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                     │
│              HashConnect + HashPack Wallet               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Backend API (Node.js/Express)               │
│         Hedera SDK + JSON-RPC Relay + Mirror Node       │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│           Hedera Smart Contract Service (HSCS)          │
│                                                          │
│  ┌──────────────────┐      ┌─────────────────────────┐ │
│  │ FractionalFactory│──┬───│ DividendDistributor #1  │ │
│  └──────────────────┘  │   └─────────────────────────┘ │
│                        │                                │
│                        ├───┌─────────────────────────┐ │
│                        │   │ DividendDistributor #2  │ │
│                        │   └─────────────────────────┘ │
│                        │                                │
│                        └───┌─────────────────────────┐ │
│                            │ DividendDistributor #N  │ │
│                            └─────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│          Hedera Token Service (HTS) - 0x167             │
│                                                          │
│  - Asset NFTs (NON_FUNGIBLE_UNIQUE)                    │
│  - Fraction Tokens (FUNGIBLE_COMMON)                   │
│  - Payout Tokens (FUNGIBLE_COMMON)                     │
└─────────────────────────────────────────────────────────┘
```

### Data Flow: Asset Creation

```
1. User → Frontend: Create Asset
2. Frontend → Backend: POST /api/assets
3. Backend → HTS: Mint Asset NFT
4. Backend → HTS: Create Fraction Token
5. Backend → Factory: createDistributor()
6. Factory → Contract: new DividendDistributor()
7. Contract → Storage: Initialize state
8. Backend → Database: Save asset metadata
9. Backend → Frontend: Return asset + distributor info
10. Frontend → User: Display success + HashScan links
```

### Data Flow: Reward Distribution

```
1. Issuer → Frontend: Distribute Rewards
2. Frontend → Backend: POST /api/rewards/deposit
3. Backend → Distributor: depositHbar() or depositToken()
4. Distributor → State: Update accumulatedPerShare
5. Event → Mirror Node: Index HbarDeposited event
6. Backend → Database: Update reward pool stats
7. Backend → Frontend: Confirm deposit
8. Frontend → User: Display updated pool balance
```

### Data Flow: Claim Rewards

```
1. Holder → Frontend: Claim Rewards
2. Frontend → Distributor: pendingHbar() [view]
3. Distributor → HTS: balanceOf(user) [precompile]
4. Distributor → Calculation: pending = (balance * accPerShare / PRECISION) - rewardDebt
5. Frontend → User: Display pending amount
6. User → Frontend: Confirm claim
7. Frontend → Distributor: claimHbar()
8. Distributor → State: Update rewardDebt
9. Distributor → User: Transfer HBAR
10. Event → Mirror Node: Index RewardsClaimed event
```

---

## Contract Specifications

### DividendDistributor.sol

**Solidity Version:** 0.8.24
**License:** MIT
**Inheritance:** ReentrancyGuard, Ownable

#### State Variables

```solidity
// Immutable
address public immutable assetNftToken;      // HTS NFT representing the asset
address public immutable fractionToken;       // HTS fungible token for fractions

// Configuration
uint256 public totalFractionSupply;           // Cached total supply
mapping(address => bool) public payoutTokenEnabled;  // Enabled payout tokens
bool public paused;                           // Emergency pause flag

// Accounting
uint256 public accumulatedPerShare;           // Accumulated rewards per share (scaled by 1e12)
uint256 public totalHbarDistributed;          // Total HBAR deposited
mapping(address => uint256) public totalTokenDistributed;  // Total tokens per address

// User Data
mapping(address => uint256) public rewardDebt;  // User's reward debt
mapping(address => mapping(address => uint256)) public pendingTokenRewards;  // Pending token rewards
```

#### Key Functions

##### depositHbar()
```solidity
function depositHbar() external payable whenNotPaused nonReentrant
```

**Description:** Deposits HBAR for proportional distribution to all fraction holders.

**Logic:**
1. Validate amount > 0 and totalSupply > 0
2. Calculate `rewardPerShare = (msg.value * PRECISION) / totalSupply`
3. Update `accumulatedPerShare += rewardPerShare`
4. Update `totalHbarDistributed += msg.value`
5. Emit `HbarDeposited` event

**Gas Cost:** ~50,000 gas (constant, independent of holder count)

##### pendingHbar(address user)
```solidity
function pendingHbar(address user) public view returns (uint256)
```

**Description:** Calculates pending HBAR rewards for a user.

**Logic:**
1. Get user's fraction balance from HTS via precompile
2. Calculate `accumulatedRewards = (balance * accumulatedPerShare) / PRECISION`
3. Return `max(0, accumulatedRewards - rewardDebt[user])`

**Precision:** Uses 1e12 scaling to prevent rounding errors

##### claimHbar()
```solidity
function claimHbar() external whenNotPaused nonReentrant
```

**Description:** Claims pending HBAR rewards for the caller.

**Logic:**
1. Calculate pending rewards via `pendingHbar(msg.sender)`
2. Revert if pending == 0
3. Update `rewardDebt[msg.sender]` to current accumulated value
4. Transfer HBAR to user
5. Emit `RewardsClaimed` event

**Security:** Reentrancy guard prevents multiple claims in single transaction

#### Access Control

**Owner-Only Functions:**
- `updateTotalSupply(uint256 newSupply)`
- `setPayoutToken(address token, bool enabled)`
- `setPaused(bool _paused)`
- `emergencyWithdraw(...)`
- `creditTokenReward(...)`

**Public Functions:**
- `depositHbar()` - Anyone can deposit
- `depositToken(address token, uint256 amount)` - Anyone can deposit (requires approval)
- `claimHbar()` - Anyone can claim their rewards
- `claimTokens(address[] tokens)` - Anyone can claim
- `claimAll(address[] tokens)` - Anyone can claim all

**View Functions:**
- `pendingHbar(address user)`
- `getUserFractionBalance(address user)`
- `getContractHbarBalance()`
- `getContractTokenBalance(address token)`

---

### FractionalFactory.sol

**Solidity Version:** 0.8.24
**License:** MIT

#### State Variables

```solidity
address[] public allDistributors;                          // Array of all deployed distributors
mapping(address => address) public assetToDistributor;     // Asset NFT → Distributor
mapping(address => address) public fractionToDistributor;  // Fraction Token → Distributor
mapping(address => bool) public isDistributor;             // Validity check
address public owner;                                      // Factory owner
```

#### Key Functions

##### createDistributor()
```solidity
function createDistributor(
    address assetNft,
    address fractionToken,
    uint256 totalSupply,
    address distributorOwner
) external returns (address distributor)
```

**Description:** Deploys a new DividendDistributor contract.

**Validations:**
1. Non-zero addresses
2. No existing distributor for asset or fraction token
3. Valid total supply

**Side Effects:**
1. Deploys new contract
2. Adds to `allDistributors` array
3. Updates lookup mappings
4. Emits `DistributorCreated` event

**Returns:** Address of newly created distributor

---

## Hedera Integration

### HTS Precompile Interface

The Hedera Token Service is accessed via a precompile at address `0x167`.

#### balanceOf()
```solidity
interface IHederaTokenService {
    function balanceOf(address token, address account)
        external view returns (int32 responseCode, int64 balance);
}
```

**Usage in Contracts:**
```solidity
IHederaTokenService hts = IHederaTokenService(0x167);
(int32 response, int64 balance) = hts.balanceOf(fractionToken, user);
require(response == 22, "HTS call failed"); // 22 = SUCCESS
return uint256(uint64(balance));
```

#### transferToken()
```solidity
function transferToken(
    address token,
    address from,
    address to,
    int64 amount
) external returns (int32 responseCode);
```

**Response Codes:**
- `22` - SUCCESS
- `26` - INVALID_ACCOUNT_ID
- `31` - INVALID_TOKEN_ID
- `190` - INSUFFICIENT_TOKEN_BALANCE

### Token Association

Before transferring HTS tokens, accounts must be **associated** with the token.

**Frontend Flow:**
1. User connects wallet via HashConnect
2. Frontend checks if user is associated with fraction token
3. If not, prompts for token association transaction
4. User approves association in HashPack
5. Transaction signed and submitted via JSON-RPC relay

**Backend Flow:**
```javascript
// Check association via Mirror Node
const isAssociated = await mirrorNode.checkAssociation(accountId, tokenId);

if (!isAssociated) {
    // Create association transaction via Hedera SDK
    const tx = new TokenAssociateTransaction()
        .setAccountId(accountId)
        .setTokenIds([tokenId]);

    // Return unsigned transaction for user to sign
    return tx.toBytes();
}
```

### Gas Considerations

Hedera uses a different gas model than Ethereum:

- **Gas Price:** Fixed at ~0.000001 HBAR per gas
- **Gas Limit:** Auto-calculated or explicitly set
- **Transaction Fees:** ~0.001 HBAR for most operations

**Typical Costs:**
- Deploy Factory: ~0.05 HBAR
- Create Distributor: ~0.03 HBAR
- Deposit HBAR: ~0.001 HBAR
- Claim Rewards: ~0.002 HBAR

---

## Reward Distribution Model

### Accumulated-Per-Share Algorithm

The contract uses a **dividend-per-share** model for O(1) reward distribution and claiming.

#### Core Formula

```
accumulatedPerShare = Σ(depositAmount * PRECISION / totalSupply)
```

Where `PRECISION = 1e12` to handle fractional amounts.

#### User Reward Calculation

```
pendingReward = (userBalance * accumulatedPerShare / PRECISION) - rewardDebt
```

**rewardDebt** tracks what the user has already claimed or what was owed at their last balance change.

#### Example Scenario

**Setup:**
- Total Supply: 100,000 tokens
- User A: 10,000 tokens (10%)
- User B: 30,000 tokens (30%)
- User C: 60,000 tokens (60%)

**Deposit 1: 100 HBAR**
```
accumulatedPerShare = (100 * 1e12) / 100,000 = 1,000,000,000

User A pending: (10,000 * 1,000,000,000 / 1e12) - 0 = 10 HBAR
User B pending: (30,000 * 1,000,000,000 / 1e12) - 0 = 30 HBAR
User C pending: (60,000 * 1,000,000,000 / 1e12) - 0 = 60 HBAR
```

**User A Claims:**
```
Transfer 10 HBAR to User A
rewardDebt[A] = 10,000 * 1,000,000,000 / 1e12 = 10
```

**Deposit 2: 50 HBAR**
```
accumulatedPerShare += (50 * 1e12) / 100,000 = 1,500,000,000

User A pending: (10,000 * 1,500,000,000 / 1e12) - 10 = 5 HBAR
User B pending: (30,000 * 1,500,000,000 / 1e12) - 0 = 45 HBAR
User C pending: (60,000 * 1,500,000,000 / 1e12) - 0 = 90 HBAR
```

**Advantages:**
- ✅ O(1) deposit complexity (independent of holder count)
- ✅ O(1) claim complexity per user
- ✅ No loops over all holders
- ✅ Supports transfers without updating all users
- ✅ High precision with minimal rounding errors

**Limitations:**
- ⚠️ Requires total supply to be known and updated
- ⚠️ Small rounding errors accumulate (dust remains in contract)
- ⚠️ Reward debt must be updated on balance changes (or recalculated on-demand)

### Handling Balance Changes

**Simplified Approach (MVP):**
The contract reads balances on-demand from HTS and calculates rewards based on **current balance** and **last known rewardDebt**.

**Limitation:** If a user receives fraction tokens after deposits, they benefit from past deposits. This is acceptable for MVP but could be refined in production.

**Production Approach:**
Implement a transfer hook or require users to "sync" their balance before transfers to update rewardDebt accurately.

---

## Security Considerations

### Reentrancy Protection

**Pattern:** Checks-Effects-Interactions

```solidity
function claimHbar() external nonReentrant {
    uint256 pending = pendingHbar(msg.sender);  // Check
    if (pending == 0) revert NoRewardsToClaim();

    rewardDebt[msg.sender] = ...;               // Effect

    (bool success, ) = payable(msg.sender).call{value: pending}("");  // Interaction
    if (!success) revert TransferFailed();
}
```

The `nonReentrant` modifier ensures the function cannot be re-entered before completion.

### Access Control

**Owner Privileges:**
- Can pause/unpause contract
- Can update total supply
- Can enable/disable payout tokens
- Can perform emergency withdrawals
- Can credit manual token rewards

**Mitigation:** Use multi-sig wallet for owner in production.

### Integer Overflow/Underflow

**Solidity 0.8+** has built-in overflow/underflow checks.

**Example:**
```solidity
accumulatedPerShare += rewardPerShare;  // Automatically reverts on overflow
```

### Precision Loss

**Issue:** Division can lose precision, especially with small amounts.

**Solution:** Scale by `PRECISION = 1e12` before division.

```solidity
uint256 rewardPerShare = (amount * PRECISION) / totalSupply;
```

### Front-Running

**Scenario:** User sees pending deposit transaction and quickly claims before it's mined.

**Impact:** Minimal - user claims existing rewards, not the pending deposit.

**Not a concern** for this design since rewards are calculated based on `accumulatedPerShare` at time of claim.

### HTS Response Code Validation

**Always check HTS operation results:**

```solidity
int32 response = hts.transferToken(token, from, to, amount);
if (response != SUCCESS) {
    revert HtsOperationFailed(response);
}
```

**Common Errors:**
- `31` - Invalid token (not associated)
- `190` - Insufficient balance
- `26` - Invalid account

---

## Gas Optimization

### Techniques Used

1. **Immutable Variables**
   ```solidity
   address public immutable assetNftToken;  // Stored in bytecode, not storage
   ```

2. **Cached Values**
   ```solidity
   uint256 public totalFractionSupply;  // Avoid repeated HTS calls
   ```

3. **Short-Circuit Logic**
   ```solidity
   if (amount == 0) revert InvalidAmount();  // Check before expensive operations
   ```

4. **Minimal Storage Writes**
   - Only update state when necessary
   - Batch operations where possible

5. **Events Instead of Storage**
   - Use events for historical data (readable from Mirror Node)
   - Don't store redundant data on-chain

6. **Constant-Time Operations**
   - No loops over dynamic arrays
   - O(1) claim and deposit functions

### Gas Comparison

| Operation | Gas Cost (Estimated) | HBAR Cost (@~100k gas/HBAR) |
|-----------|----------------------|------------------------------|
| Deploy Factory | 2,500,000 | ~0.025 HBAR |
| Create Distributor | 1,500,000 | ~0.015 HBAR |
| Deposit HBAR | 50,000 | ~0.0005 HBAR |
| Claim HBAR | 70,000 | ~0.0007 HBAR |
| Enable Payout Token | 45,000 | ~0.00045 HBAR |

**Note:** Hedera's gas costs are significantly lower than Ethereum mainnet.

---

## Testing Strategy

### Unit Tests (test/*.test.js)

**Coverage Areas:**
1. Contract deployment validation
2. State initialization
3. Function access control
4. Mathematical accuracy (reward calculations)
5. Error conditions
6. Event emissions
7. Edge cases (zero values, maximum values)

**Tools:**
- Hardhat
- Chai assertions
- Ethers.js
- Hardhat Network Helpers

**Example Test:**
```javascript
it("Should calculate pending rewards correctly", async function () {
  const depositAmount = ethers.parseEther("100");
  const userBalance = ethers.parseUnits("10000", 18);
  const totalSupply = ethers.parseUnits("100000", 18);

  // Deposit rewards
  await distributor.depositHbar({ value: depositAmount });

  // Mock user balance (in real test, would use HTS mock)
  const expectedPending = (depositAmount * userBalance) / totalSupply;

  // Calculate pending
  const pending = await distributor.pendingHbar(user.address);

  expect(pending).to.equal(expectedPending);
});
```

### Integration Tests (test/integration/*.test.js)

**Requirements:**
- Hedera testnet access
- Real HTS tokens
- Funded test accounts

**Coverage:**
- Full lifecycle: deploy → deposit → claim → withdraw
- HTS precompile interactions
- Token associations
- Multi-user scenarios
- Gas cost measurements

**Running:**
```bash
npx hardhat test test/integration/*.test.js --network testnet
```

### Mock Contracts (contracts/mocks/*.sol)

**MockHederaTokenService.sol** - Simulates HTS for unit testing without network access.

**Usage:**
```javascript
const MockHTS = await ethers.getContractFactory("MockHederaTokenService");
const mockHts = await MockHTS.deploy();

// Mint test tokens
await mockHts.mintTo(fractionToken, user.address, 10000);

// Test distributor with mock
const pending = await distributor.pendingHbar(user.address);
```

---

## Deployment Guide

### Prerequisites

1. **Hedera Testnet Account**
   - Create at https://portal.hedera.com
   - Fund with testnet HBAR via faucet

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Dependencies**
   ```bash
   npm install
   ```

### Step 1: Deploy Factory

```bash
npm run deploy:testnet
```

**Output:**
```
✅ FractionalFactory deployed to: 0xabcd1234...
🔗 HashScan: https://hashscan.io/testnet/contract/0xabcd1234...
```

**Save Factory Address** for frontend integration.

### Step 2: Create HTS Tokens

Use Hedera SDK to create:
1. **Asset NFT** (NON_FUNGIBLE_UNIQUE)
2. **Fraction Token** (FUNGIBLE_COMMON, e.g., 100,000 supply)

```javascript
// Example: Create Fraction Token
const tokenCreateTx = await new TokenCreateTransaction()
  .setTokenName("Fractional Asset XYZ")
  .setTokenSymbol("FRAC-XYZ")
  .setTokenType(TokenType.FungibleCommon)
  .setDecimals(18)
  .setInitialSupply(100000)
  .setTreasuryAccountId(treasuryAccountId)
  .setSupplyKey(supplyKey)
  .execute(client);

const tokenId = (await tokenCreateTx.getReceipt(client)).tokenId;
```

### Step 3: Create Distributor

```bash
export ASSET_NFT_TOKEN=0.0.12345
export FRACTION_TOKEN=0.0.12346
export TOTAL_SUPPLY=100000000000000000000000

npx hardhat run scripts/create-distributor.js --network testnet
```

**Output:**
```
✅ Distributor created: 0xef567890...
🔗 HashScan: https://hashscan.io/testnet/contract/0xef567890...
```

### Step 4: Configure Backend

Update backend API to use deployed addresses:

```javascript
// config.js
module.exports = {
  FACTORY_ADDRESS: "0xabcd1234...",
  HTS_PRECOMPILE: "0x167",
  NETWORK: "testnet"
};
```

### Step 5: Verify Deployment

```bash
# Check factory
npx hardhat run scripts/verify-deployment.js --network testnet

# Interact with distributor
export DISTRIBUTOR_ADDRESS=0xef567890...
export ACTION=3  # Check pending rewards
npx hardhat run scripts/interact.js --network testnet
```

---

## Appendix

### Error Codes Reference

| Error | Code | Description |
|-------|------|-------------|
| InvalidAddress | - | Zero address provided |
| InvalidAmount | - | Zero or invalid amount |
| NoRewardsToClaim | - | No pending rewards available |
| TransferFailed | - | HBAR transfer failed |
| ContractPaused | - | Contract is paused |
| HtsOperationFailed | int32 | HTS operation returned error code |
| TokenNotEnabled | - | Payout token not enabled |
| InsufficientBalance | - | Insufficient contract balance |

### Events Reference

```solidity
event HbarDeposited(address indexed depositor, uint256 amount, uint256 newAccumulatedPerShare);
event TokenDeposited(address indexed depositor, address indexed token, uint256 amount, uint256 timestamp);
event RewardsClaimed(address indexed user, uint256 hbarAmount, address[] tokens, uint256[] tokenAmounts);
event TotalSupplyUpdated(uint256 oldSupply, uint256 newSupply);
event PayoutTokenUpdated(address indexed token, bool enabled);
event PauseStateChanged(bool isPaused);
event EmergencyWithdraw(address indexed to, uint256 hbarAmount, address token, uint256 tokenAmount);
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
event DistributorCreated(address indexed distributor, address indexed assetNft, address indexed fractionToken, uint256 totalSupply, address owner);
```

---

**Last Updated:** October 2024
**Version:** 1.0.0
**Author:** Fractional Team
