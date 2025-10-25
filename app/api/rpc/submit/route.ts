import { NextRequest, NextResponse } from "next/server";
import { submitSigned } from "@/lib/hedera";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.signedB64) return NextResponse.json({ error: "Missing signedB64" }, { status: 400 });
  try {
    const out = await submitSigned(body.signedB64);
    return NextResponse.json({ ok: true, ...out });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
