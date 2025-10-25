# Deployment Checklist

Use this checklist to ensure proper deployment and configuration of the Fractional smart contracts.

---

## Pre-Deployment

### Environment Setup

- [ ] Node.js >= 16.0.0 installed
- [ ] npm or yarn installed
- [ ] Git repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created from `.env.example`

### Hedera Account Setup

- [ ] Hedera testnet account created at https://portal.hedera.com
- [ ] Account funded with testnet HBAR (minimum 10 HBAR recommended)
- [ ] Account ID noted (format: 0.0.xxxxx)
- [ ] Private key securely stored
- [ ] Environment variables configured:
  - [ ] `HEDERA_NETWORK=testnet`
  - [ ] `PRIVATE_KEY=your_private_key`
  - [ ] `OPERATOR_ID=0.0.xxxxx`
  - [ ] `OPERATOR_KEY=your_hedera_private_key`

### Code Verification

- [ ] All contracts compile successfully (`npm run compile`)
- [ ] All tests pass (`npm test`)
- [ ] No security warnings in test output
- [ ] Hardhat config verified for testnet

---

## Deployment Steps

### Step 1: Deploy Factory

```bash
npm run deploy:testnet
```

**Verification:**
- [ ] Transaction succeeded
- [ ] Factory address received
- [ ] HashScan link opens successfully
- [ ] Factory owner is correct account
- [ ] Deployment info saved to `deployments/testnet-latest.json`

**Record:**
```
Factory Address: ___________________________________
Deploy Tx Hash:  ___________________________________
HashScan Link:   ___________________________________
Gas Used:        ___________________________________
```

### Step 2: Create HTS Tokens

Use Hedera SDK or Portal to create:

**Asset NFT (NON_FUNGIBLE_UNIQUE):**
- [ ] Token created
- [ ] Metadata uploaded (IPFS or similar)
- [ ] Supply key configured
- [ ] Treasury account set

**Record:**
```
Asset NFT Token ID: 0.0._____________
Asset Name:         _____________________
Symbol:             _____________________
```

**Fraction Token (FUNGIBLE_COMMON):**
- [ ] Token created
- [ ] Initial supply minted (e.g., 100,000)
- [ ] Decimals set (18 recommended)
- [ ] Treasury account set

**Record:**
```
Fraction Token ID:  0.0._____________
Token Name:         _____________________
Symbol:             _____________________
Initial Supply:     _____________________
Decimals:           _____________________
```

### Step 3: Create Distributor

```bash
export ASSET_NFT_TOKEN=0.0.xxxxx
export FRACTION_TOKEN=0.0.xxxxx
export TOTAL_SUPPLY=100000000000000000000000
export DISTRIBUTOR_OWNER=0.0.xxxxx

npx hardhat run scripts/create-distributor.js --network testnet
```

**Verification:**
- [ ] Transaction succeeded
- [ ] Distributor address received
- [ ] Event `DistributorCreated` emitted
- [ ] Distributor info saved to `deployments/distributors/`
- [ ] HashScan link opens successfully

**Record:**
```
Distributor Address: ___________________________________
Deploy Tx Hash:      ___________________________________
HashScan Link:       ___________________________________
```

### Step 4: Configure Distributor

**Enable Payout Tokens:**
```bash
export DISTRIBUTOR_ADDRESS=0x...
export PAYOUT_TOKEN=0.0.xxxxx
export ENABLED=true
export ACTION=5

npx hardhat run scripts/interact.js --network testnet
```

**Verification:**
- [ ] Payout token enabled
- [ ] Event `PayoutTokenUpdated` emitted
- [ ] Transaction confirmed on HashScan

**Associate Contract with Tokens:**
- [ ] Distributor associated with fraction token
- [ ] Distributor associated with payout tokens
- [ ] Treasury/issuer associated with fraction token

### Step 5: Initial Testing

**Test Deposit:**
```bash
export DISTRIBUTOR_ADDRESS=0x...
export ACTION=1
export DEPOSIT_AMOUNT=10

npx hardhat run scripts/interact.js --network testnet
```

**Verification:**
- [ ] Deposit successful
- [ ] Contract balance increased
- [ ] `accumulatedPerShare` updated
- [ ] Event `HbarDeposited` emitted

**Test Claim (if eligible):**
```bash
export ACTION=2
npx hardhat run scripts/interact.js --network testnet
```

**Verification:**
- [ ] Claim successful (or reverts if no rewards)
- [ ] User balance updated
- [ ] Event `RewardsClaimed` emitted

---

## Post-Deployment

### Backend Integration

- [ ] Factory address added to backend config
- [ ] Distributor addresses stored in database
- [ ] Contract ABIs copied to backend
- [ ] Mirror Node integration tested
- [ ] Event listener configured

**Backend Config:**
```javascript
// config.js
module.exports = {
  FACTORY_ADDRESS: "0x...",
  HTS_PRECOMPILE: "0x167",
  NETWORK: "testnet",
  MIRROR_NODE_URL: "https://testnet.mirrornode.hedera.com/api/v1"
};
```

### Frontend Integration

- [ ] Contract addresses configured
- [ ] ABIs imported
- [ ] HashConnect integration tested
- [ ] Token association flow tested
- [ ] Deposit flow tested
- [ ] Claim flow tested
- [ ] HashScan links working

**Frontend Config:**
```javascript
// constants.js
export const FACTORY_ADDRESS = "0x...";
export const NETWORK = "testnet";
export const CHAIN_ID = 296; // Hedera testnet
```

### Database Setup

- [ ] Assets table updated with distributor addresses
- [ ] Contract addresses indexed
- [ ] Event history synced from Mirror Node
- [ ] User balances tracked

**Example Schema:**
```sql
-- Add distributor_address column
ALTER TABLE assets ADD COLUMN distributor_address VARCHAR(42);

-- Update existing asset
UPDATE assets
SET distributor_address = '0x...'
WHERE id = 'asset_id';
```

### Monitoring Setup

- [ ] Contract event monitoring configured
- [ ] HashScan bookmarks created
- [ ] Alert thresholds set
- [ ] Dashboard updated with contract metrics

**Monitor These Events:**
- `HbarDeposited` - Track reward deposits
- `RewardsClaimed` - Track user claims
- `DistributorCreated` - Track new assets
- `EmergencyWithdraw` - Alert on emergency actions
- `PauseStateChanged` - Alert on pause events

---

## Testing & Validation

### Functional Tests

**Test: End-to-End Flow**
- [ ] User can buy fraction tokens
- [ ] Issuer can deposit rewards
- [ ] Holder can see pending rewards
- [ ] Holder can claim rewards
- [ ] Balance updates correctly
- [ ] HashScan shows all transactions

**Test: Multi-User Scenario**
- [ ] Create 3 test accounts
- [ ] Distribute fraction tokens to each
- [ ] Deposit rewards
- [ ] Each user claims proportional amount
- [ ] Verify math is correct

**Test: Edge Cases**
- [ ] Deposit with zero holders (should work)
- [ ] Claim with no rewards (should revert)
- [ ] Claim multiple times (second claim should revert)
- [ ] Transfer tokens and verify new holder can claim

### Security Tests

**Test: Access Control**
- [ ] Non-owner cannot pause contract
- [ ] Non-owner cannot update supply
- [ ] Non-owner cannot emergency withdraw
- [ ] Non-owner cannot enable payout tokens

**Test: Input Validation**
- [ ] Cannot deposit 0 HBAR
- [ ] Cannot create distributor with zero supply
- [ ] Cannot transfer to zero address
- [ ] HTS errors handled gracefully

**Test: Reentrancy Protection**
- [ ] Deploy malicious contract
- [ ] Attempt reentrancy attack
- [ ] Verify attack fails

---

## Documentation

### Internal Documentation

- [ ] Deployment addresses documented
- [ ] Network configuration documented
- [ ] Access control documented (who has keys)
- [ ] Emergency procedures documented
- [ ] Contact information updated

### User Documentation

- [ ] How to buy fractions
- [ ] How to claim rewards
- [ ] How to check pending rewards
- [ ] HashScan navigation guide
- [ ] FAQ updated

### Developer Documentation

- [ ] API endpoints documented
- [ ] Event schemas documented
- [ ] Integration examples updated
- [ ] Troubleshooting guide created

---

## Mainnet Preparation (Future)

### Pre-Mainnet

- [ ] Complete security audit
- [ ] Resolve all audit findings
- [ ] Stress test on testnet (100+ users)
- [ ] Gas cost analysis at scale
- [ ] Legal compliance review
- [ ] Multi-sig setup for owner
- [ ] Insurance coverage evaluated
- [ ] Bug bounty program launched

### Mainnet Deployment

- [ ] Repeat all deployment steps on mainnet
- [ ] Use multi-sig for owner
- [ ] Start with low limits/paused state
- [ ] Gradual rollout plan
- [ ] Monitoring and alerts active
- [ ] Support team ready
- [ ] Incident response plan activated

---

## Emergency Procedures

### If Contract Must Be Paused

```bash
export DISTRIBUTOR_ADDRESS=0x...
export ACTION=6

npx hardhat run scripts/interact.js --network testnet
```

**Steps:**
1. Pause contract immediately
2. Investigate issue
3. Communicate to users
4. Develop fix if needed
5. Deploy new contract if necessary
6. Unpause or migrate

### If Funds Are Stuck

```bash
# Emergency withdraw (owner only)
npx hardhat run scripts/emergency-withdraw.js --network testnet
```

**Steps:**
1. Verify issue
2. Calculate stuck amount
3. Execute emergency withdraw
4. Redistribute manually if needed
5. Document incident
6. Implement fix

### If HTS Token Issues

**Common Issues:**
- Account not associated → Guide user to associate
- Insufficient balance → Verify token distribution
- Token frozen → Contact token admin
- Network congestion → Retry with higher gas

---

## Rollback Plan

### If Deployment Fails

1. **Do not panic** - testnet funds are not real
2. Review error messages carefully
3. Check Hardhat console output
4. Verify HashScan for transaction details
5. Fix issues in code/config
6. Redeploy from scratch
7. Update documentation

### If Contract Has Bug

1. **Pause contract immediately**
2. Assess severity and impact
3. If critical: deploy new contract
4. If minor: document workaround
5. Update frontend to use new contract
6. Migrate data if necessary
7. Post-mortem analysis

---

## Success Criteria

### Deployment Successful If:

- [ ] All contracts deployed without errors
- [ ] All HashScan links open successfully
- [ ] Factory can create distributors
- [ ] Distributors can accept deposits
- [ ] Users can claim rewards
- [ ] Events are emitted correctly
- [ ] Backend integration works
- [ ] Frontend integration works
- [ ] No security vulnerabilities found
- [ ] Gas costs are acceptable

### Ready for Demo If:

- [ ] End-to-end flow works (< 2 minutes)
- [ ] At least 1 asset with fractions created
- [ ] At least 1 successful reward distribution
- [ ] At least 1 successful claim
- [ ] All transactions visible on HashScan
- [ ] No critical bugs in happy path
- [ ] Presentation ready
- [ ] Fallback demo video recorded

---

## Contact Information

**Technical Lead:** ___________________
**Email:** ___________________
**Phone:** ___________________

**Emergency Contacts:**
- Backend Dev: ___________________
- Frontend Dev: ___________________
- Smart Contract Dev: ___________________

**Resources:**
- Hedera Support: https://hedera.com/discord
- HashScan: https://hashscan.io/testnet
- Documentation: ./README.md, ./TECHNICAL.md

---

## Changelog

| Date | Action | By | Notes |
|------|--------|-----|-------|
| 2024-10-25 | Factory deployed | [Name] | Address: 0x... |
| 2024-10-25 | First distributor created | [Name] | Asset: XYZ |
|  |  |  |  |
|  |  |  |  |

---

**Last Updated:** October 25, 2024
**Version:** 1.0.0
**Network:** Hedera Testnet
