const hre = require("hardhat");
const fs = require("fs");

/**
 * Script to interact with a deployed DividendDistributor
 * Demonstrates: deposit, claim, and admin operations
 * Usage: npx hardhat run scripts/interact.js --network testnet
 */

async function main() {
  console.log("Interacting with DividendDistributor...");
  console.log("Network:", hre.network.name);

  // Get distributor address from environment or deployments
  const distributorAddress =
    process.env.DISTRIBUTOR_ADDRESS || getLatestDistributor(hre.network.name);

  if (!distributorAddress) {
    console.error("❌ No distributor address found.");
    console.log("Set DISTRIBUTOR_ADDRESS env var or create a distributor first.");
    process.exit(1);
  }

  console.log("Distributor address:", distributorAddress);

  // Get signer
  const [signer] = await hre.ethers.getSigners();
  console.log("Account:", signer.address);

  // Connect to distributor
  const DividendDistributor = await hre.ethers.getContractFactory("DividendDistributor");
  const distributor = DividendDistributor.attach(distributorAddress);

  // Display current state
  await displayState(distributor, signer.address);

  // Interactive menu
  console.log("\n📋 Available Actions:");
  console.log("1. Deposit HBAR");
  console.log("2. Claim HBAR rewards");
  console.log("3. Check pending rewards");
  console.log("4. Update total supply (owner only)");
  console.log("5. Enable payout token (owner only)");
  console.log("6. Pause/Unpause (owner only)");

  const action = process.env.ACTION || "3"; // Default to checking pending rewards

  switch (action) {
    case "1":
      await depositHbar(distributor, signer);
      break;
    case "2":
      await claimHbar(distributor, signer);
      break;
    case "3":
      await checkPending(distributor, signer.address);
      break;
    case "4":
      await updateSupply(distributor, signer);
      break;
    case "5":
      await enablePayoutToken(distributor, signer);
      break;
    case "6":
      await togglePause(distributor, signer);
      break;
    default:
      await checkPending(distributor, signer.address);
  }
}

async function displayState(distributor, userAddress) {
  console.log("\n📊 Current State:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    const assetNft = await distributor.assetNftToken();
    const fractionToken = await distributor.fractionToken();
    const totalSupply = await distributor.totalFractionSupply();
    const accPerShare = await distributor.accumulatedPerShare();
    const totalDistributed = await distributor.totalHbarDistributed();
    const contractBalance = await distributor.getContractHbarBalance();
    const paused = await distributor.paused();
    const owner = await distributor.owner();

    console.log("Asset NFT:", assetNft);
    console.log("Fraction Token:", fractionToken);
    console.log("Total Supply:", hre.ethers.formatEther(totalSupply));
    console.log("Accumulated Per Share:", accPerShare.toString());
    console.log("Total HBAR Distributed:", hre.ethers.formatEther(totalDistributed));
    console.log("Contract HBAR Balance:", hre.ethers.formatEther(contractBalance));
    console.log("Paused:", paused);
    console.log("Owner:", owner);

    // User-specific data
    const pending = await distributor.pendingHbar(userAddress);
    const rewardDebt = await distributor.rewardDebt(userAddress);

    console.log("\n👤 Your Info:");
    console.log("Address:", userAddress);
    console.log("Pending Rewards:", hre.ethers.formatEther(pending));
    console.log("Reward Debt:", rewardDebt.toString());
  } catch (error) {
    console.error("Error fetching state:", error.message);
  }

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

async function depositHbar(distributor, signer) {
  const amount = process.env.DEPOSIT_AMOUNT || "10"; // 10 HBAR default
  const depositValue = hre.ethers.parseEther(amount);

  console.log(`\n💰 Depositing ${amount} HBAR...`);

  try {
    const tx = await distributor.connect(signer).depositHbar({ value: depositValue });
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Deposit successful!");
    console.log("Gas used:", receipt.gasUsed.toString());

    // Display updated state
    await displayState(distributor, signer.address);
  } catch (error) {
    console.error("❌ Deposit failed:", error.message);
  }
}

async function claimHbar(distributor, signer) {
  console.log("\n💸 Claiming HBAR rewards...");

  try {
    const pending = await distributor.pendingHbar(signer.address);
    console.log("Pending rewards:", hre.ethers.formatEther(pending));

    if (pending === 0n) {
      console.log("⚠️  No rewards to claim");
      return;
    }

    const tx = await distributor.connect(signer).claimHbar();
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Claim successful!");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Claimed:", hre.ethers.formatEther(pending), "HBAR");

    // Display updated state
    await displayState(distributor, signer.address);
  } catch (error) {
    console.error("❌ Claim failed:", error.message);
  }
}

async function checkPending(distributor, userAddress) {
  console.log("\n🔍 Checking pending rewards...");

  try {
    const pending = await distributor.pendingHbar(userAddress);
    console.log("Pending HBAR rewards:", hre.ethers.formatEther(pending));

    if (pending > 0n) {
      console.log("💡 Run with ACTION=2 to claim these rewards");
    }
  } catch (error) {
    console.error("❌ Error checking pending:", error.message);
  }
}

async function updateSupply(distributor, signer) {
  const newSupply = process.env.NEW_SUPPLY || hre.ethers.parseUnits("200000", 18);

  console.log(`\n📝 Updating total supply to ${hre.ethers.formatEther(newSupply)}...`);

  try {
    const tx = await distributor.connect(signer).updateTotalSupply(newSupply);
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Supply updated!");
    console.log("Gas used:", receipt.gasUsed.toString());
  } catch (error) {
    console.error("❌ Update failed:", error.message);
  }
}

async function enablePayoutToken(distributor, signer) {
  const tokenAddress = process.env.PAYOUT_TOKEN || "0x0000000000000000000000000000000000000003";
  const enabled = process.env.ENABLED !== "false"; // Default true

  console.log(`\n🎫 ${enabled ? "Enabling" : "Disabling"} payout token ${tokenAddress}...`);

  try {
    const tx = await distributor.connect(signer).setPayoutToken(tokenAddress, enabled);
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Payout token updated!");
    console.log("Gas used:", receipt.gasUsed.toString());
  } catch (error) {
    console.error("❌ Update failed:", error.message);
  }
}

async function togglePause(distributor, signer) {
  const paused = await distributor.paused();
  const newState = !paused;

  console.log(`\n⏸️  ${newState ? "Pausing" : "Unpausing"} contract...`);

  try {
    const tx = await distributor.connect(signer).setPaused(newState);
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("✅ Pause state updated!");
    console.log("Gas used:", receipt.gasUsed.toString());
  } catch (error) {
    console.error("❌ Update failed:", error.message);
  }
}

function getLatestDistributor(network) {
  const distributorsDir = "./deployments/distributors";
  if (!fs.existsSync(distributorsDir)) {
    return null;
  }

  const files = fs.readdirSync(distributorsDir).filter((f) => f.startsWith(network));

  if (files.length === 0) {
    return null;
  }

  // Get most recent file
  const latest = files.sort().reverse()[0];
  const deployment = JSON.parse(fs.readFileSync(`${distributorsDir}/${latest}`, "utf8"));

  return deployment.distributorAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
