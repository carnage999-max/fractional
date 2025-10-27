import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Seeding disabled: backend operates statelessly from Hedera resources." },
    { status: 410 }
  );
}