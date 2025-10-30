import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
export async function POST(req: NextRequest){
  const body = await req.formData();
  const assetId = String(body.get("assetId")||"");
  const amount = Number(body.get("amount")||"0");
  const buyer = "0.0.user"; // demo
  const asset = db.assets.find(a=>a.id===assetId);
  if(!asset) return NextResponse.json({error:"Asset not found"},{status:404});
  if(amount<=0) return NextResponse.json({error:"Invalid amount"},{status:400});
  if(asset.sharesAvailable<amount) return NextResponse.json({error:"Not enough shares"},{status:400});
  asset.sharesAvailable -= amount;
  const arr = db.holdings.get(buyer) || [];
  const existing = arr.find(h=>h.assetId===assetId);
  if(existing) existing.shares += amount; else arr.push({assetId, shares: amount, pendingRewards: 0});
  db.holdings.set(buyer, arr);
  const at = new Date().toISOString();
  const activity = db.activity.get(assetId) || [];
  activity.push({type:"BUY_SHARES", by: buyer, amount, txLink:"#", at});
  db.activity.set(assetId, activity);
  return NextResponse.redirect(new URL(`/asset/${assetId}`, req.url));
}
export const dynamic = 'force-dynamic';
