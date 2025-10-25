import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/dbService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get("assetId");
    
    if (!assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }
    
    const activities = await dbService.getActivities(assetId);
    return NextResponse.json(activities);
  } catch (error) {
    console.error("Error fetching activities:", error);
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
export async function GET(req: NextRequest){
  const { searchParams } = new URL(req.url);
  const assetId = String(searchParams.get("assetId") || "");
  const events = db.activity.get(assetId) || [];
  return NextResponse.json({ events });
}
