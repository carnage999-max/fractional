import { NextRequest, NextResponse } from "next/server";
import { transferFtToAccount } from "@/lib/hedera";

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
    // Server-side transfer from treasury (operator account) to buyer
    const result = await transferFtToAccount({
      tokenId,
      toAccountId: recipient,
      amount: Number(amount),
      memo: `Share purchase${assetId ? ` for ${assetId}` : ''}`,
    });
    
    console.log("[buy-shares] Transfer successful:", result);
    
    return NextResponse.json({ 
      ok: true, 
      transactionId: result.transactionId,
      link: result.link,
      status: result.status
    });
  } catch (e: any) {
    console.error("[buy-shares] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
