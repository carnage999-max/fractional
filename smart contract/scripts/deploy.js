const hre = require("hardhat");

async function main() {
  console.log("Starting deployment to Hedera...");
  console.log("Network:", hre.network.name);

  // Get deployer account
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Get deployer balance
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "HBAR");

  // Deploy FractionalFactory
  console.log("\n📦 Deploying FractionalFactory...");
  const FractionalFactory = await hre.ethers.getContractFactory("FractionalFactory");
  const factory = await FractionalFactory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("✅ FractionalFactory deployed to:", factoryAddress);

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  const owner = await factory.owner();
  console.log("Factory owner:", owner);
  console.log("Distributor count:", (await factory.getDistributorCount()).toString());

  // Output deployment info
  console.log("\n📋 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Network:", hre.network.name);
  console.log("FractionalFactory:", factoryAddress);
  console.log("Deployer:", deployer.address);
  console.log("Gas used: Check transaction on HashScan");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Generate HashScan links
  const networkName = hre.network.name === "testnet" ? "testnet" : "mainnet";
  console.log("\n🔗 HashScan Links:");
  console.log(`Factory: https://hashscan.io/${networkName}/contract/${factoryAddress}`);
  console.log(`Deployer: https://hashscan.io/${networkName}/account/${deployer.address}`);

  // Save deployment info
  const fs = require("fs");
  const deploymentInfo = {
    network: hre.network.name,
    factoryAddress: factoryAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
  };

  const deploymentsDir = "./deployments";
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const filename = `${deploymentsDir}/${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\n💾 Deployment info saved to: ${filename}`);

  // Save latest deployment
  const latestFilename = `${deploymentsDir}/${hre.network.name}-latest.json`;
  fs.writeFileSync(latestFilename, JSON.stringify(deploymentInfo, null, 2));
  console.log(`💾 Latest deployment saved to: ${latestFilename}`);

  console.log("\n✨ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
