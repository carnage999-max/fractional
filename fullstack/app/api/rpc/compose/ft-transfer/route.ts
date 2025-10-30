import { NextRequest, NextResponse } from "next/server";
import { composeFtTransfer } from "@/lib/hedera";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { tokenId, sender, recipient, amount } = body;
  
  console.log("[ft-transfer] Received request:", { tokenId, sender, recipient, amount });
  
  if (!tokenId || !sender || !recipient || !amount) {
    const missing = [];
    if (!tokenId) missing.push("tokenId");
    if (!sender) missing.push("sender");
    if (!recipient) missing.push("recipient");
    if (!amount) missing.push("amount");
    console.error("[ft-transfer] Missing fields:", missing);
    return NextResponse.json({ error: `Missing fields: ${missing.join(", ")}` }, { status: 400 });
  }
  try {
    const composed = await composeFtTransfer({ tokenId, sender, recipient, amount: Number(amount) });
    return NextResponse.json({ ok: true, ...composed });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
