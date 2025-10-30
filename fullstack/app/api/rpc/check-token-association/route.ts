import { NextRequest, NextResponse } from "next/server";
import { checkTokenAssociations } from "@/lib/hedera";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  
  const { accountId, tokenIds } = body;
  
  console.log("[check-token-association] Received request:", { accountId, tokenIds });
  
  if (!accountId || !tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
    const missing = [];
    if (!accountId) missing.push("accountId");
    if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) missing.push("tokenIds (array)");
    console.error("[check-token-association] Missing or invalid fields:", missing);
    return NextResponse.json({ error: `Missing or invalid fields: ${missing.join(", ")}` }, { status: 400 });
  }
  
  try {
    const associations = await checkTokenAssociations({ accountId, tokenIds });
    return NextResponse.json({ ok: true, associations });
  } catch (e: any) {
    console.error("[check-token-association] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
