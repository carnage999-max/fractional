import { NextRequest, NextResponse } from "next/server";
// import { transferFtToAccount } from "@/lib/hedera";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  
  const { tokenId, recipient, amount, assetId } = body;
  
  console.log("[buy-shares] Received request:", { tokenId, recipient, amount, assetId });
  
  if (!tokenId || !recipient || !amount) {
    const missing = [];
    if (!tokenId) missing.push("tokenId");
    if (!recipient) missing.push("recipient");
    if (!amount) missing.push("amount");
    console.error("[buy-shares] Missing fields:", missing);
    return NextResponse.json({ error: `Missing fields: ${missing.join(", ")}` }, { status: 400 });
  }
  
  try {
    // NOTE: For the current MVP demo the treasury transfer is skipped because
    // fractional supply now lives in the creator's wallet rather than the operator.
    // This stubbed response keeps the UI flow working without moving tokens server-side.
    console.warn("[buy-shares] Treasury transfer skipped for MVP demo flow");
    return NextResponse.json({
      ok: true,
      transactionId: null,
      link: null,
      status: "TRANSFER_SKIPPED",
      message: "Server-side transfer skipped; please handle peer-to-peer settlement manually.",
    });
  } catch (e: any) {
    console.error("[buy-shares] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
