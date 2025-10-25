import { NextRequest, NextResponse } from "next/server";
import { dbService } from "@/lib/dbService";

export async function POST(req: NextRequest) {
  try {
    await dbService.seed();
    return NextResponse.json({ message: "Database seeded successfully!" });
  } catch (error) {
    console.error("Seeding failed:", error);
    return NextResponse.json({ error: "Failed to seed database" }, { status: 500 });
  }
}