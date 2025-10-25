import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/dbService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const account = searchParams.get("account");
    
    if (!account) {
      return NextResponse.json({ error: "account is required" }, { status: 400 });
    }
    
    const holdings = await dbService.getHoldings(account);
    return NextResponse.json({ holdings });
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    return NextResponse.json({ error: "Failed to fetch portfolio" }, { status: 500 });
  }
}
