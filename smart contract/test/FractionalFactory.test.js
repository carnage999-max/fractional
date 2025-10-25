const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("FractionalFactory", function () {
  // ============ Fixtures ============

  async function deployFactoryFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    const FractionalFactory = await ethers.getContractFactory("FractionalFactory");
    const factory = await FractionalFactory.deploy();

    return { factory, owner, user1, user2 };
  }

  // ============ Deployment Tests ============

  describe("Deployment", function () {
    it("Should set the deployer as owner", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero distributors", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);
      expect(await factory.getDistributorCount()).to.equal(0);
    });
  });

  // ============ Create Distributor Tests ============

  describe("Create Distributor", function () {
    it("Should create a new distributor", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const assetNft = "0x0000000000000000000000000000000000000001";
      const fractionToken = "0x0000000000000000000000000000000000000002";
      const totalSupply = ethers.parseUnits("100000", 18);

      const tx = await factory
        .connect(user1)
        .createDistributor(assetNft, fractionToken, totalSupply, user1.address);

      await expect(tx).to.not.be.reverted;
    });

    it("Should emit DistributorCreated event", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const assetNft = "0x0000000000000000000000000000000000000001";
      const fractionToken = "0x0000000000000000000000000000000000000002";
      const totalSupply = ethers.parseUnits("100000", 18);

      await expect(
        factory
          .connect(user1)
          .createDistributor(assetNft, fractionToken, totalSupply, user1.address)
      )
        .to.emit(factory, "DistributorCreated")
        .withArgs(
          (value) => value !== ethers.ZeroAddress, // distributor address
          assetNft,
          fractionToken,
          totalSupply,
          user1.address
        );
    });

    it("Should increment distributor count", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const assetNft1 = "0x0000000000000000000000000000000000000001";
      const fractionToken1 = "0x0000000000000000000000000000000000000002";
      const assetNft2 = "0x0000000000000000000000000000000000000003";
      const fractionToken2 = "0x0000000000000000000000000000000000000004";
      const totalSupply = ethers.parseUnits("100000", 18);

      await factory
        .connect(user1)
        .createDistributor(assetNft1, fractionToken1, totalSupply, user1.address);

      expect(await factory.getDistributorCount()).to.equal(1);

      await factory
        .connect(user1)
        .createDistributor(assetNft2, fractionToken2, totalSupply, user1.address);

      expect(await factory.getDistributorCount()).to.equal(2);
    });

    it("Should store distributor in mappings", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const assetNft = "0x0000000000000000000000000000000000000001";
      const fractionToken = "0x0000000000000000000000000000000000000002";
      const totalSupply = ethers.parseUnits("100000", 18);

      await factory
        .connect(user1)
        .createDistributor(assetNft, fractionToken, totalSupply, user1.address);

      const distributorByAsset = await factory.getDistributorByAsset(assetNft);
      const distributorByFraction = await factory.getDistributorByFraction(fractionToken);

      expect(distributorByAsset).to.not.equal(ethers.ZeroAddress);
      expect(distributorByAsset).to.equal(distributorByFraction);
      expect(await factory.isDistributor(distributorByAsset)).to.equal(true);
    });

    it("Should revert if asset NFT is zero address", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const fractionToken = "0x0000000000000000000000000000000000000002";
      const totalSupply = ethers.parseUnits("100000", 18);

      await expect(
        factory
          .connect(user1)
          .createDistributor(ethers.ZeroAddress, fractionToken, totalSupply, user1.address)
      ).to.be.revertedWithCustomError(factory, "InvalidAddress");
    });

    it("Should revert if fraction token is zero address", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const assetNft = "0x0000000000000000000000000000000000000001";
      const totalSupply = ethers.parseUnits("100000", 18);

      await expect(
        factory
          .connect(user1)
          .createDistributor(assetNft, ethers.ZeroAddress, totalSupply, user1.address)
      ).to.be.revertedWithCustomError(factory, "InvalidAddress");
    });

    it("Should revert if owner is zero address", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const assetNft = "0x0000000000000000000000000000000000000001";
      const fractionToken = "0x0000000000000000000000000000000000000002";
      const totalSupply = ethers.parseUnits("100000", 18);

      await expect(
        factory
          .connect(user1)
          .createDistributor(assetNft, fractionToken, totalSupply, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(factory, "InvalidAddress");
    });

    it("Should revert if distributor already exists for asset", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const assetNft = "0x0000000000000000000000000000000000000001";
      const fractionToken1 = "0x0000000000000000000000000000000000000002";
      const fractionToken2 = "0x0000000000000000000000000000000000000003";
      const totalSupply = ethers.parseUnits("100000", 18);

      await factory
        .connect(user1)
        .createDistributor(assetNft, fractionToken1, totalSupply, user1.address);

      await expect(
        factory
          .connect(user1)
          .createDistributor(assetNft, fractionToken2, totalSupply, user1.address)
      ).to.be.revertedWithCustomError(factory, "DistributorAlreadyExists");
    });

    it("Should revert if distributor already exists for fraction token", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const assetNft1 = "0x0000000000000000000000000000000000000001";
      const assetNft2 = "0x0000000000000000000000000000000000000003";
      const fractionToken = "0x0000000000000000000000000000000000000002";
      const totalSupply = ethers.parseUnits("100000", 18);

      await factory
        .connect(user1)
        .createDistributor(assetNft1, fractionToken, totalSupply, user1.address);

      await expect(
        factory
          .connect(user1)
          .createDistributor(assetNft2, fractionToken, totalSupply, user1.address)
      ).to.be.revertedWithCustomError(factory, "DistributorAlreadyExists");
    });

    it("Should allow multiple distributors with different assets and tokens", async function () {
      const { factory, user1, user2 } = await loadFixture(deployFactoryFixture);

      const assetNft1 = "0x0000000000000000000000000000000000000001";
      const fractionToken1 = "0x0000000000000000000000000000000000000002";
      const assetNft2 = "0x0000000000000000000000000000000000000003";
      const fractionToken2 = "0x0000000000000000000000000000000000000004";
      const totalSupply = ethers.parseUnits("100000", 18);

      await factory
        .connect(user1)
        .createDistributor(assetNft1, fractionToken1, totalSupply, user1.address);

      await factory
        .connect(user2)
        .createDistributor(assetNft2, fractionToken2, totalSupply, user2.address);

      expect(await factory.getDistributorCount()).to.equal(2);
    });
  });

  // ============ Getter Tests ============

  describe("Getters", function () {
    it("Should get distributor at index", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const assetNft = "0x0000000000000000000000000000000000000001";
      const fractionToken = "0x0000000000000000000000000000000000000002";
      const totalSupply = ethers.parseUnits("100000", 18);

      await factory
        .connect(user1)
        .createDistributor(assetNft, fractionToken, totalSupply, user1.address);

      const distributor = await factory.getDistributorAt(0);
      expect(distributor).to.not.equal(ethers.ZeroAddress);
    });

    it("Should revert when getting out of bounds index", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);

      await expect(factory.getDistributorAt(0)).to.be.revertedWith("Index out of bounds");
    });

    it("Should get all distributors", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const assetNft1 = "0x0000000000000000000000000000000000000001";
      const fractionToken1 = "0x0000000000000000000000000000000000000002";
      const assetNft2 = "0x0000000000000000000000000000000000000003";
      const fractionToken2 = "0x0000000000000000000000000000000000000004";
      const totalSupply = ethers.parseUnits("100000", 18);

      await factory
        .connect(user1)
        .createDistributor(assetNft1, fractionToken1, totalSupply, user1.address);

      await factory
        .connect(user1)
        .createDistributor(assetNft2, fractionToken2, totalSupply, user1.address);

      const allDistributors = await factory.getAllDistributors();
      expect(allDistributors.length).to.equal(2);
      expect(allDistributors[0]).to.not.equal(ethers.ZeroAddress);
      expect(allDistributors[1]).to.not.equal(ethers.ZeroAddress);
    });

    it("Should get distributor by asset", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const assetNft = "0x0000000000000000000000000000000000000001";
      const fractionToken = "0x0000000000000000000000000000000000000002";
      const totalSupply = ethers.parseUnits("100000", 18);

      await factory
        .connect(user1)
        .createDistributor(assetNft, fractionToken, totalSupply, user1.address);

      const distributor = await factory.getDistributorByAsset(assetNft);
      expect(distributor).to.not.equal(ethers.ZeroAddress);
      expect(await factory.isDistributor(distributor)).to.equal(true);
    });

    it("Should get distributor by fraction token", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const assetNft = "0x0000000000000000000000000000000000000001";
      const fractionToken = "0x0000000000000000000000000000000000000002";
      const totalSupply = ethers.parseUnits("100000", 18);

      await factory
        .connect(user1)
        .createDistributor(assetNft, fractionToken, totalSupply, user1.address);

      const distributor = await factory.getDistributorByFraction(fractionToken);
      expect(distributor).to.not.equal(ethers.ZeroAddress);
      expect(await factory.isDistributor(distributor)).to.equal(true);
    });

    it("Should return zero address for non-existent asset", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);

      const distributor = await factory.getDistributorByAsset(
        "0x0000000000000000000000000000000000000099"
      );
      expect(distributor).to.equal(ethers.ZeroAddress);
    });

    it("Should return zero address for non-existent fraction token", async function () {
      const { factory } = await loadFixture(deployFactoryFixture);

      const distributor = await factory.getDistributorByFraction(
        "0x0000000000000000000000000000000000000099"
      );
      expect(distributor).to.equal(ethers.ZeroAddress);
    });

    it("Should return false for non-distributor address", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      expect(await factory.isDistributor(user1.address)).to.equal(false);
    });
  });

  // ============ Ownership Tests ============

  describe("Ownership", function () {
    it("Should transfer ownership", async function () {
      const { factory, owner, user1 } = await loadFixture(deployFactoryFixture);

      await expect(factory.connect(owner).transferOwnership(user1.address))
        .to.emit(factory, "OwnershipTransferred")
        .withArgs(owner.address, user1.address);

      expect(await factory.owner()).to.equal(user1.address);
    });

    it("Should revert if non-owner tries to transfer ownership", async function () {
      const { factory, user1, user2 } = await loadFixture(deployFactoryFixture);

      await expect(
        factory.connect(user1).transferOwnership(user2.address)
      ).to.be.revertedWithCustomError(factory, "Unauthorized");
    });

    it("Should revert if transferring to zero address", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);

      await expect(
        factory.connect(owner).transferOwnership(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(factory, "InvalidAddress");
    });
  });

  // ============ Integration Tests ============

  describe("Integration", function () {
    it("Should create multiple distributors and track them correctly", async function () {
      const { factory, user1, user2 } = await loadFixture(deployFactoryFixture);

      const totalSupply = ethers.parseUnits("100000", 18);

      // Create first distributor
      const assetNft1 = "0x0000000000000000000000000000000000000001";
      const fractionToken1 = "0x0000000000000000000000000000000000000002";
      await factory
        .connect(user1)
        .createDistributor(assetNft1, fractionToken1, totalSupply, user1.address);

      // Create second distributor
      const assetNft2 = "0x0000000000000000000000000000000000000003";
      const fractionToken2 = "0x0000000000000000000000000000000000000004";
      await factory
        .connect(user2)
        .createDistributor(assetNft2, fractionToken2, totalSupply, user2.address);

      // Create third distributor
      const assetNft3 = "0x0000000000000000000000000000000000000005";
      const fractionToken3 = "0x0000000000000000000000000000000000000006";
      await factory
        .connect(user1)
        .createDistributor(assetNft3, fractionToken3, totalSupply, user1.address);

      // Verify count
      expect(await factory.getDistributorCount()).to.equal(3);

      // Verify all distributors are tracked
      const allDistributors = await factory.getAllDistributors();
      expect(allDistributors.length).to.equal(3);

      // Verify lookups work
      expect(await factory.getDistributorByAsset(assetNft1)).to.equal(allDistributors[0]);
      expect(await factory.getDistributorByAsset(assetNft2)).to.equal(allDistributors[1]);
      expect(await factory.getDistributorByAsset(assetNft3)).to.equal(allDistributors[2]);

      expect(await factory.getDistributorByFraction(fractionToken1)).to.equal(
        allDistributors[0]
      );
      expect(await factory.getDistributorByFraction(fractionToken2)).to.equal(
        allDistributors[1]
      );
      expect(await factory.getDistributorByFraction(fractionToken3)).to.equal(
        allDistributors[2]
      );
    });

    it("Should deploy functional distributor contracts", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);

      const assetNft = "0x0000000000000000000000000000000000000001";
      const fractionToken = "0x0000000000000000000000000000000000000002";
      const totalSupply = ethers.parseUnits("100000", 18);

      // Create distributor
      await factory
        .connect(user1)
        .createDistributor(assetNft, fractionToken, totalSupply, user1.address);

      const distributorAddress = await factory.getDistributorByAsset(assetNft);

      // Get distributor instance
      const DividendDistributor = await ethers.getContractFactory("DividendDistributor");
      const distributor = DividendDistributor.attach(distributorAddress);

      // Verify it's properly initialized
      expect(await distributor.assetNftToken()).to.equal(assetNft);
      expect(await distributor.fractionToken()).to.equal(fractionToken);
      expect(await distributor.totalFractionSupply()).to.equal(totalSupply);
      expect(await distributor.owner()).to.equal(user1.address);

      // Verify it can receive deposits
      const depositAmount = ethers.parseEther("5");
      await expect(distributor.connect(user1).depositHbar({ value: depositAmount })).to.not.be
        .reverted;

      expect(await distributor.getContractHbarBalance()).to.equal(depositAmount);
    });
  });
});
