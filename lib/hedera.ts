import { Client, AccountId, PrivateKey, Hbar, TokenId, TokenTransferTransaction, Transaction, TransactionId } from "@hashgraph/sdk";

export function getClient() {
  const network = process.env.HEDERA_NETWORK || "testnet";
  const operatorId = process.env.OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  if (!operatorId || !operatorKey) throw new Error("Missing OPERATOR_ID/OPERATOR_KEY");
  const client = network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromString(operatorKey));
  return client;
}

export async function composeFtTransfer({
  tokenId,
  sender,
  recipient,
  amount,
}: { tokenId: string; sender: string; recipient: string; amount: number; }) {
  const client = getClient();
  const tid = TokenId.fromString(tokenId);
  // Build transfer; NOTE: we DO NOT sign with user keys. The client here is only used to get a node + freeze.
  const tx = new TokenTransferTransaction()
    .addTokenTransfer(tid, sender, -amount)
    .addTokenTransfer(tid, recipient, amount);

  // Build a transaction ID as if from the sender (wallet will ultimately sign)
  const transactionId = TransactionId.generate(sender);
  tx.setTransactionId(transactionId);
  tx.setNodeAccountIds([client._network.getNodeAccountIdsForExecute()[0]]);
  const frozen = await tx.freezeWith(client);
  const bytes = frozen.toBytes();
  return { bytes: Buffer.from(bytes).toString("base64"), transactionId: transactionId.toString() };
}

export async function submitSigned(signedB64: string) {
  const client = getClient();
  const bytes = Buffer.from(signedB64, "base64");
  const tx = Transaction.fromBytes(bytes);
  const res = await tx.execute(client);
  const receipt = await res.getReceipt(client);
  return { txId: res.transactionId.toString(), status: receipt.status.toString() };
}
