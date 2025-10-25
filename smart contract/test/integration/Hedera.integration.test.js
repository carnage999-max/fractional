const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Integration tests for Hedera-specific functionality
 * These tests are designed to run against a local Hedera node or testnet
 *
 * Prerequisites:
 * - Hedera local node running OR testnet access
 * - HTS tokens created for testing
 * - Proper network configuration in hardhat.config.js
 *
 * Note: Some tests are marked as .skip by default as they require
 * actual HTS token addresses and Hedera network access
 */

describe.skip("Hedera Integration Tests", function () {
  let factory;
  let distributor;
  let owner;
  let user1;
  let user2;

  // Replace these with actual HTS token addresses from your Hedera testnet
  const ASSET_NFT_TOKEN = process.env.TEST_ASSET_NFT || "0.0.12345";
  const FRACTION_TOKEN = process.env.TEST_FRACTION_TOKEN || "0.0.12346";
  const PAYOUT_TOKEN = process.env.TEST_PAYOUT_TOKEN || "0.0.12347";

  before(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    console.log("Deploying to Hedera network:", hre.network.name);
    console.log("Owner:", owner.address);

    // Deploy factory
    const FractionalFactory = await ethers.getContractFactory("FractionalFactory");
    factory = await FractionalFactory.deploy();
    await factory.waitForDeployment();

    console.log("Factory deployed:", await factory.getAddress());
  });

  describe("Factory Deployment", function () {
    it("Should deploy factory successfully", async function () {
      expect(await factory.getAddress()).to.be.properAddress;
      expect(await factory.owner()).to.equal(owner.address);
    });
  });

  describe("Distributor Creation", function () {
    it("Should create a distributor with HTS tokens", async function () {
      const totalSupply = ethers.parseUnits("100000", 18);

      const tx = await factory.createDistributor(
        ASSET_NFT_TOKEN,
        FRACTION_TOKEN,
        totalSupply,
        owner.address
      );

      const receipt = await tx.wait();
      expect(receipt).to.not.be.null;

      // Get distributor address from event
      const event = receipt.logs.find((log) => {
        try {
          const parsed = factory.interface.parseLog(log);
          return parsed.name === "DistributorCreated";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;
      const parsedEvent = factory.interface.parseLog(event);
      const distributorAddress = parsedEvent.args.distributor;

      expect(distributorAddress).to.be.properAddress;

      // Connect to distributor
      const DividendDistributor = await ethers.getContractFactory("DividendDistributor");
      distributor = DividendDistributor.attach(distributorAddress);

      console.log("Distributor created:", distributorAddress);
    });

    it("Should initialize distributor correctly", async function () {
      expect(await distributor.assetNftToken()).to.equal(ASSET_NFT_TOKEN);
      expect(await distributor.fractionToken()).to.equal(FRACTION_TOKEN);
      expect(await distributor.owner()).to.equal(owner.address);
      expect(await distributor.paused()).to.equal(false);
    });
  });

  describe("HBAR Operations", function () {
    it("Should deposit HBAR successfully", async function () {
      const depositAmount = ethers.parseEther("10");

      const tx = await distributor.connect(user1).depositHbar({ value: depositAmount });
      const receipt = await tx.wait();

      expect(receipt).to.not.be.null;
      expect(await distributor.getContractHbarBalance()).to.equal(depositAmount);
      expect(await distributor.totalHbarDistributed()).to.equal(depositAmount);
    });

    it("Should accumulate per-share correctly", async function () {
      const accPerShare = await distributor.accumulatedPerShare();
      expect(accPerShare).to.be.gt(0);
    });

    it("Should handle multiple deposits", async function () {
      const deposit1 = ethers.parseEther("5");
      const deposit2 = ethers.parseEther("3");

      await distributor.connect(user1).depositHbar({ value: deposit1 });
      const balance1 = await distributor.getContractHbarBalance();

      await distributor.connect(user2).depositHbar({ value: deposit2 });
      const balance2 = await distributor.getContractHbarBalance();

      expect(balance2).to.equal(balance1 + deposit2);
    });
  });

  describe.skip("HTS Token Operations", function () {
    // These tests require actual HTS token setup with associations and approvals

    before(async function () {
      // Enable payout token
      await distributor.connect(owner).setPayoutToken(PAYOUT_TOKEN, true);
    });

    it("Should enable payout token", async function () {
      expect(await distributor.payoutTokenEnabled(PAYOUT_TOKEN)).to.equal(true);
    });

    it("Should deposit HTS tokens", async function () {
      // This requires:
      // 1. User to have PAYOUT_TOKEN balance
      // 2. Contract to be associated with PAYOUT_TOKEN
      // 3. User to approve contract for transfer

      const depositAmount = ethers.parseUnits("100", 18);

      // In real integration test, you would:
      // 1. Associate contract with token via HTS
      // 2. Approve contract to spend tokens
      // 3. Call depositToken

      const tx = await distributor.connect(user1).depositToken(PAYOUT_TOKEN, depositAmount);
      const receipt = await tx.wait();

      expect(receipt).to.not.be.null;
    });

    it("Should track token distributions", async function () {
      const distributed = await distributor.totalTokenDistributed(PAYOUT_TOKEN);
      expect(distributed).to.be.gt(0);
    });
  });

  describe("Admin Operations", function () {
    it("Should allow owner to pause", async function () {
      const tx = await distributor.connect(owner).setPaused(true);
      await tx.wait();

      expect(await distributor.paused()).to.equal(true);
    });

    it("Should prevent deposits when paused", async function () {
      await expect(
        distributor.connect(user1).depositHbar({ value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(distributor, "ContractPaused");
    });

    it("Should allow owner to unpause", async function () {
      const tx = await distributor.connect(owner).setPaused(false);
      await tx.wait();

      expect(await distributor.paused()).to.equal(false);
    });

    it("Should update total supply", async function () {
      const newSupply = ethers.parseUnits("200000", 18);

      const tx = await distributor.connect(owner).updateTotalSupply(newSupply);
      await tx.wait();

      expect(await distributor.totalFractionSupply()).to.equal(newSupply);
    });
  });

  describe("Emergency Operations", function () {
    it("Should allow owner to emergency withdraw HBAR", async function () {
      const contractBalance = await distributor.getContractHbarBalance();

      if (contractBalance > 0n) {
        const withdrawAmount = contractBalance / 2n;

        const tx = await distributor
          .connect(owner)
          .emergencyWithdraw(owner.address, withdrawAmount, ethers.ZeroAddress, 0);

        await tx.wait();

        const newBalance = await distributor.getContractHbarBalance();
        expect(newBalance).to.equal(contractBalance - withdrawAmount);
      }
    });
  });

  describe("Gas Usage Analysis", function () {
    it("Should measure gas for deposit", async function () {
      const tx = await distributor
        .connect(user1)
        .depositHbar({ value: ethers.parseEther("1") });

      const receipt = await tx.wait();
      console.log("Deposit gas used:", receipt.gasUsed.toString());

      // Hedera has low gas costs, but we still track them
      expect(receipt.gasUsed).to.be.gt(0);
    });

    it("Should measure gas for claim (if rewards available)", async function () {
      // This would require proper HTS balance mocking or real token setup
      console.log("Claim gas measurement requires HTS balance setup");
    });
  });
});

/**
 * Helper functions for integration testing
 */
describe.skip("Hedera Helper Functions", function () {
  it("Should verify network connection", async function () {
    const network = await ethers.provider.getNetwork();
    console.log("Connected to network:", network.name);
    console.log("Chain ID:", network.chainId.toString());

    // Hedera testnet chain ID is 296
    // Hedera mainnet chain ID is 295
    expect([295n, 296n, 297n]).to.include(network.chainId);
  });

  it("Should check account balance", async function () {
    const [signer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(signer.address);

    console.log("Account:", signer.address);
    console.log("Balance:", ethers.formatEther(balance), "HBAR");

    expect(balance).to.be.gt(0);
  });
});
