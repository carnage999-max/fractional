import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/dbService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || "100");
    const q = searchParams.get("q") || "";
    
    const items = await dbService.getAssets(limit, q);
    
    return NextResponse.json({ 
      items, 
      page: 1, 
      pageSize: items.length, 
      total: items.length 
    });
  } catch (error) {
    console.error("Error fetching assets:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.formData();
    const name = String(body.get("name") || "Untitled");
    const description = String(body.get("description") || "");
    const totalShares = Number(body.get("totalShares") || 0);
    const pricePerShare = String(body.get("pricePerShare") || "0");
    const category = (String(body.get("category") || "RWA") as any);
    const image = String(body.get("image") || "/logo.svg");
    
    // Generate next asset ID
    const existingAssets = await dbService.getAssets(1000);
    const nextNum = existingAssets.length + 1;
    const id = `asset_${nextNum.toString().padStart(3, "0")}`;
    
    const asset = {
      id,
      name,
      description,
      image,
      category,
      nftTokenId: `0.0.${1000 + nextNum}`,
      fractionTokenId: `0.0.${2000 + nextNum}`,
      distributor: `0xDistributor${nextNum}`,
      pricePerShare,
      sharesTotal: totalShares,
      sharesAvailable: totalShares,
      creator: "0.0.issuer",
    };
    
    await dbService.createAsset(asset);
    
    // Add initial activities
    await dbService.addActivity(id, { type: "MINT_NFT", txLink: "#" });
    await dbService.addActivity(id, { type: "CREATE_FT", txLink: "#" });
    
    return NextResponse.redirect(new URL(`/asset/${id}`, req.url));
  } catch (error) {
    console.error("Error creating asset:", error);
    return NextResponse.json({ error: "Failed to create asset" }, { status: 500 });
  }
}
