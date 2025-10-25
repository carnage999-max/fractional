import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
export async function GET(req: NextRequest){
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") || "100");
  const q = (searchParams.get("q") || "").toLowerCase();
  const items = db.assets.filter(a=>!q || a.name.toLowerCase().includes(q)).slice(0, limit);
  return NextResponse.json({ items, page:1, pageSize: items.length, total: items.length });
}
export async function POST(req: NextRequest){
  const body = await req.formData();
  const name = String(body.get("name") || "Untitled");
  const description = String(body.get("description") || "");
  const totalShares = Number(body.get("totalShares") || 0);
  const pricePerShare = String(body.get("pricePerShare") || "0");
  const category = (String(body.get("category") || "RWA") as any);
  const image = String(body.get("image") || "/logo.svg");
  const id = `asset_${(db.assets.length + 1).toString().padStart(3,"0")}`;
  const now = new Date().toISOString();
  const item:any = { id, name, description, image, category, nftTokenId:`0.0.${1000+db.assets.length+1}`, fractionTokenId:`0.0.${2000+db.assets.length+1}`, distributor:`0xDistributor${db.assets.length+1}`, pricePerShare, sharesTotal: totalShares, sharesAvailable: totalShares, creator:"0.0.issuer", createdAt: now };
  db.assets.unshift(item);
  db.activity.set(id, [{type:"MINT_NFT",txLink:"#",at:now},{type:"CREATE_FT",txLink:"#",at:now}] as any);
  return NextResponse.redirect(new URL(`/asset/${id}`, req.url));
}
