import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
export async function GET(req: NextRequest){
  const { searchParams } = new URL(req.url);
  const assetId = String(searchParams.get("assetId") || "");
  const events = db.activity.get(assetId) || [];
  return NextResponse.json({ events });
}
