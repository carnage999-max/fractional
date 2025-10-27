import path from "path";
import fs from "fs/promises";
import {
  AccountId,
  Client,
  ContractCreateFlow,
  ContractCreateTransaction,
  ContractFunctionParameters,
  FileAppendTransaction,
  FileCreateTransaction,
  PrivateKey,
  TokenId,
} from "@hashgraph/sdk";

async function main() {
  const operatorId = process.env.OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  if (!operatorId || !operatorKey) {
    throw new Error("Missing OPERATOR_ID or OPERATOR_KEY in environment");
  }

  const nftTokenId = process.argv[2];
  const fractionTokenId = process.argv[3];
  const initialSupply = Number(process.argv[4] ?? "0");
  const artifactRelative = process.argv[5] ?? path.join(
    "..",
    "smart contract",
    "artifacts",
    "contracts",
    "DividendDistributor.sol",
    "DividendDistributor.json"
  );

  if (!nftTokenId || !fractionTokenId || !initialSupply) {
    console.error(
      "Usage: node scripts/debug-contract.js <nftTokenId> <fractionTokenId> <initialSupply> [artifactRelativePath]"
    );
    process.exit(1);
  }

  const artifactPath = path.resolve(process.cwd(), artifactRelative);

  const artifactRaw = await fs.readFile(artifactPath, "utf8");
  const artifact = JSON.parse(artifactRaw);

  const bytecodeHex = artifact.bytecode;
  if (!bytecodeHex || typeof bytecodeHex !== "string") {
    throw new Error("DividendDistributor artifact missing bytecode string");
  }

  const bytecode = Buffer.from(bytecodeHex.replace(/^0x/, ""), "hex");
  console.log("bytecode length", bytecode.length);

  const network = (process.env.HEDERA_NETWORK || "testnet").toLowerCase();
  const client =
    network === "mainnet"
      ? Client.forMainnet()
      : network === "previewnet"
      ? Client.forPreviewnet()
      : Client.forTestnet();
  const hashscanBase =
    network === "mainnet"
      ? "https://hashscan.io/mainnet"
      : network === "previewnet"
      ? "https://hashscan.io/previewnet"
      : "https://hashscan.io/testnet";

  const operatorAccount = AccountId.fromString(operatorId);
  const operatorPrivateKey = PrivateKey.fromString(operatorKey);

  client.setOperator(operatorAccount, operatorPrivateKey);

  const nftAddress = `0x${TokenId.fromString(nftTokenId).toSolidityAddress()}`;
  const fractionAddress = `0x${TokenId.fromString(fractionTokenId).toSolidityAddress()}`;
  const ownerAddress = `0x${operatorAccount.toSolidityAddress()}`;

  console.log("constructorParams", {
    nftAddress,
    fractionAddress,
    initialSupply,
    ownerAddress,
  });

  const constructorParameters = new ContractFunctionParameters()
    .addAddress(nftAddress)
    .addAddress(fractionAddress)
    .addUint256(initialSupply)
    .addAddress(ownerAddress);

  try {
    console.log("Attempting deployment via ContractCreateFlow...");
    const response = await new ContractCreateFlow()
      .setGas(3_000_000)
      .setBytecode(bytecode)
      .setConstructorParameters(constructorParameters)
      .execute(client);

    console.log("submitted transactionId", response.transactionId.toString());
    const receipt = await response.getReceipt(client);
    console.log("receipt status", receipt.status.toString());
    if (receipt.contractId) {
      console.log("contractId", receipt.contractId.toString());
      return;
    }
  } catch (error) {
    console.error("ContractCreateFlow deployment failed", error);
    if (error?.transactionId) {
      console.error("transactionId", error.transactionId);
    }
  }

  console.log("\nRetrying with manual file upload + ContractCreateTransaction...");
  const fileCreateTx = await new FileCreateTransaction()
    .setKeys([operatorPrivateKey.publicKey])
    .setContents(bytecode.subarray(0, 4000))
    .execute(client);

  const fileCreateReceipt = await fileCreateTx.getReceipt(client);
  const fileId = fileCreateReceipt.fileId;
  if (!fileId) {
    throw new Error("FileCreateTransaction did not return a file ID");
  }
  const fileCreateTxId = fileCreateTx.transactionId.toString();
  console.log("Created bytecode file", fileId.toString());
  console.log("FileCreate hashscan", `${hashscanBase}/transaction/${fileCreateTxId}`);

  let offset = 4000;
  while (offset < bytecode.length) {
    const chunk = bytecode.subarray(offset, offset + 4000);
    const appendTx = await new FileAppendTransaction()
      .setFileId(fileId)
      .setContents(chunk)
      .execute(client);
    await appendTx.getReceipt(client);
    offset += 4000;
  }
  console.log("Uploaded bytecode via", Math.ceil(bytecode.length / 4000), "chunks");

  try {
    const contractTx = await new ContractCreateTransaction()
      .setGas(3_000_000)
      .setBytecodeFileId(fileId)
      .setConstructorParameters(constructorParameters)
      .execute(client);

  const txId = contractTx.transactionId.toString();
  console.log("submitted transactionId", txId);
  console.log("ContractCreate hashscan", `${hashscanBase}/transaction/${txId}`);
    const receipt = await contractTx.getReceipt(client);
    console.log("receipt status", receipt.status.toString());
    if (receipt.contractId) {
      console.log("contractId", receipt.contractId.toString());
    }
  } catch (error) {
    console.error("ContractCreateTransaction failed", error);
    console.error("Check bytecode file", fileId.toString());
    console.error("Last file tx", `${hashscanBase}/transaction/${fileCreateTxId}`);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
