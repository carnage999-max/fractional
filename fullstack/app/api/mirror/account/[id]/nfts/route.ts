import { NextRequest, NextResponse } from "next/server";
import { mirrorFetch } from "@/lib/mirror";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await mirrorFetch(`/accounts/${params.id}/nfts?limit=100`);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch NFTs" }, { status: 500 });
  }
}
