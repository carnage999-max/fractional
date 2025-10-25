import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getClient } from "@/lib/hedera";
import { TransferTransaction, Hbar } from "@hashgraph/sdk";

export async function POST(req: NextRequest) {
  const body = await req.formData();
  const assetId = String(body.get("assetId") || "");
  const owner = String(body.get("owner") || "0.0.user");

  const list = db.holdings.get(owner) || [];
  const h = list.find(x => x.assetId === assetId);
  if (!h) return NextResponse.json({ error: "No holdings" }, { status: 404 });

  const claimed = h.pendingRewards;
  if (claimed <= 0) return NextResponse.redirect(new URL(`/portfolio`, req.url));

  // Send HBAR from operator to owner
  try {
    const client = getClient();
    const tx = await new TransferTransaction()
      .addHbarTransfer(process.env.OPERATOR_ID!, new Hbar(-claimed))
      .addHbarTransfer(owner, new Hbar(claimed))
      .execute(client);
    const receipt = await tx.getReceipt(client);
    h.pendingRewards = 0;

    const at = new Date().toISOString();
    const activity = db.activity.get(assetId) || [];
    activity.push({ type: "CLAIM_REWARDS", by: owner, amount: claimed, txLink: "#", at });
    db.activity.set(assetId, activity);

    return NextResponse.redirect(new URL(`/portfolio`, req.url));
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
