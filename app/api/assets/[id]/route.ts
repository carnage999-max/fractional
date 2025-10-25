import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
export async function GET(_: NextRequest, { params }: { params: { id: string }}){
  const item = db.assets.find(a=>a.id===params.id);
  if(!item) return NextResponse.json({error:"Not found"},{status:404});
  return NextResponse.json({ item });
}
