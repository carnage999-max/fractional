import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(async () => {
    const fd = await req.formData();
    return { assetId: fd.get("assetId"), amount: Number(fd.get("amount") || 0) };
  });
  const assetId = String(body.assetId || "");
  const amount = Number(body.amount || 0); // in HBAR for demo
  if (amount <= 0) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  for (const [owner, list] of db.holdings.entries()) {
    const h = list.find(x => x.assetId === assetId);
    if (h) {
      const asset = db.assets.find(a => a.id === assetId);
      if (!asset) continue;
      const total = asset.sharesTotal - asset.sharesAvailable;
      if (total > 0) {
        h.pendingRewards += (amount * (h.shares / total)); // pending in HBAR
      }
    }
  }
  const at = new Date().toISOString();
  const activity = db.activity.get(assetId) || [];
  activity.push({ type: "DEPOSIT_REWARDS", amount, txLink: "#", at });
  db.activity.set(assetId, activity);

  return NextResponse.json({ ok: true, poolTotal: amount, txLink: "#" });
}
