import { NextRequest, NextResponse } from "next/server";
import { composeTokenAssociation } from "@/lib/hedera";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  
  // Support both old format (tokenId, account) and new format (tokenIds, accountId)
  const tokenId = body.tokenId;
  const account = body.account || body.accountId;
  const tokenIds = body.tokenIds || (tokenId ? [tokenId] : []);
  
  console.log("[token-associate] Received request:", { account, tokenIds });
  
  if (!account || !tokenIds || tokenIds.length === 0) {
    const missing = [];
    if (!account) missing.push("account/accountId");
    if (!tokenIds || tokenIds.length === 0) missing.push("tokenId/tokenIds");
    console.error("[token-associate] Missing fields:", missing);
    return NextResponse.json({ error: `Missing fields: ${missing.join(", ")}` }, { status: 400 });
  }
  
  try {
    const composed = await composeTokenAssociation({ accountId: account, tokenIds });
    return NextResponse.json({ ok: true, ...composed });
  } catch (e: any) {
    console.error("[token-associate] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
