import path from "path";
import fs from "fs/promises";
import { AccountId, Client, ContractCreateFlow, PrivateKey } from "@hashgraph/sdk";

async function main() {
  const operatorId = process.env.OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  if (!operatorId || !operatorKey) {
    throw new Error("Missing OPERATOR_ID or OPERATOR_KEY in environment");
  }

  const artifactPath = path.resolve(
    process.cwd(),
    "..",
    "smart contract",
    "artifacts",
    "contracts",
    "TestHello.sol",
    "TestHello.json"
  );

  const artifactRaw = await fs.readFile(artifactPath, "utf8");
  const artifact = JSON.parse(artifactRaw);
  const bytecode = Buffer.from(String(artifact.bytecode).replace(/^0x/, ""), "hex");
  console.log("bytecode length", bytecode.length);

  const client = Client.forTestnet();
  const operatorAccount = AccountId.fromString(operatorId);
  const operatorPrivateKey = PrivateKey.fromString(operatorKey);
  client.setOperator(operatorAccount, operatorPrivateKey);

  try {
    const response = await new ContractCreateFlow()
      .setGas(1_000_000)
      .setBytecode(bytecode)
      .execute(client);

    console.log("submitted transactionId", response.transactionId.toString());
    const receipt = await response.getReceipt(client);
    console.log("receipt status", receipt.status.toString());
    if (receipt.contractId) {
      console.log("contractId", receipt.contractId.toString());
    }
  } catch (error) {
    console.error(error);
    if (error?.transactionId) {
      console.error("transactionId", error.transactionId.toString());
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
