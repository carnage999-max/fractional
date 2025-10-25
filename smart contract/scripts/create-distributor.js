const hre = require("hardhat");
const fs = require("fs");

/**
 * Script to create a new DividendDistributor through the factory
 * Usage: npx hardhat run scripts/create-distributor.js --network testnet
 */

async function main() {
  console.log("Creating new DividendDistributor...");
  console.log("Network:", hre.network.name);

  // Load latest deployment
  const deploymentPath = `./deployments/${hre.network.name}-latest.json`;
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ No deployment found. Please deploy the factory first.");
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const factoryAddress = deployment.factoryAddress;

  console.log("Factory address:", factoryAddress);

  // Get signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Creating distributor with account:", signer.address);

  // Connect to factory
  const FractionalFactory = await hre.ethers.getContractFactory("FractionalFactory");
  const factory = FractionalFactory.attach(factoryAddress);

  // Example parameters - replace with actual HTS token addresses
  const assetNftToken = process.env.ASSET_NFT_TOKEN || "0x0000000000000000000000000000000000000001";
  const fractionToken = process.env.FRACTION_TOKEN || "0x0000000000000000000000000000000000000002";
  const totalSupply = process.env.TOTAL_SUPPLY || hre.ethers.parseUnits("100000", 18);
  const distributorOwner = process.env.DISTRIBUTOR_OWNER || signer.address;

  console.log("\n📋 Distributor Parameters:");
  console.log("Asset NFT:", assetNftToken);
  console.log("Fraction Token:", fractionToken);
  console.log("Total Supply:", totalSupply.toString());
  console.log("Owner:", distributorOwner);

  // Create distributor
  console.log("\n🚀 Creating distributor...");
  const tx = await factory.createDistributor(
    assetNftToken,
    fractionToken,
    totalSupply,
    distributorOwner
  );

  console.log("Transaction hash:", tx.hash);
  console.log("Waiting for confirmation...");

  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed!");

  // Get distributor address from event
  const event = receipt.logs.find((log) => {
    try {
      const parsed = factory.interface.parseLog(log);
      return parsed.name === "DistributorCreated";
    } catch {
      return false;
    }
  });

  if (!event) {
    console.error("❌ Could not find DistributorCreated event");
    process.exit(1);
  }

  const parsedEvent = factory.interface.parseLog(event);
  const distributorAddress = parsedEvent.args.distributor;

  console.log("\n✨ Distributor created successfully!");
  console.log("Distributor address:", distributorAddress);

  // Verify distributor
  const DividendDistributor = await hre.ethers.getContractFactory("DividendDistributor");
  const distributor = DividendDistributor.attach(distributorAddress);

  console.log("\n🔍 Verifying distributor...");
  console.log("Asset NFT:", await distributor.assetNftToken());
  console.log("Fraction Token:", await distributor.fractionToken());
  console.log("Total Supply:", (await distributor.totalFractionSupply()).toString());
  console.log("Owner:", await distributor.owner());
  console.log("Paused:", await distributor.paused());

  // Save distributor info
  const distributorInfo = {
    network: hre.network.name,
    factoryAddress: factoryAddress,
    distributorAddress: distributorAddress,
    assetNftToken: assetNftToken,
    fractionToken: fractionToken,
    totalSupply: totalSupply.toString(),
    owner: distributorOwner,
    creator: signer.address,
    txHash: tx.hash,
    timestamp: new Date().toISOString(),
  };

  const distributorsDir = "./deployments/distributors";
  if (!fs.existsSync(distributorsDir)) {
    fs.mkdirSync(distributorsDir, { recursive: true });
  }

  const filename = `${distributorsDir}/${hre.network.name}-${distributorAddress}.json`;
  fs.writeFileSync(filename, JSON.stringify(distributorInfo, null, 2));
  console.log(`\n💾 Distributor info saved to: ${filename}`);

  // Generate HashScan links
  const networkName = hre.network.name === "testnet" ? "testnet" : "mainnet";
  console.log("\n🔗 HashScan Links:");
  console.log(`Distributor: https://hashscan.io/${networkName}/contract/${distributorAddress}`);
  console.log(`Transaction: https://hashscan.io/${networkName}/transaction/${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
