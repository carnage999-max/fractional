import { NextRequest, NextResponse } from "next/server";
import { Client, TransactionId, TokenAssociateTransaction, AccountId } from "@hashgraph/sdk";
import { getClient } from "@/lib/hedera";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { tokenId, account } = body;
  if (!tokenId || !account) return NextResponse.json({ error: "Missing tokenId/account" }, { status: 400 });
  try {
    const client = getClient();
    const tx = new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(account))
      .setTokenIds([tokenId]);
    const transactionId = TransactionId.generate(account);
    tx.setTransactionId(transactionId);
    tx.setNodeAccountIds([client._network.getNodeAccountIdsForExecute()[0]]);
    const frozen = await tx.freezeWith(client);
    const bytes = Buffer.from(frozen.toBytes()).toString("base64");
    return NextResponse.json({ ok: true, bytes, transactionId: transactionId.toString() });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
