import { NextRequest, NextResponse } from "next/server";
import { getAssetById } from "@/lib/assetRegistry";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
  const asset = await getAssetById(params.id);
    
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    
    return NextResponse.json(asset);
  } catch (error) {
    console.error("Error fetching asset:", error);
    return NextResponse.json({ error: "Failed to fetch asset" }, { status: 500 });
  }
}
