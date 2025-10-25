import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
export async function GET(req: NextRequest){
  const { searchParams } = new URL(req.url);
  const owner = String(searchParams.get("owner") || "0.0.user");
  const holdings = db.holdings.get(owner) || [];
  return NextResponse.json({ owner, holdings });
}
