import { NextRequest, NextResponse } from "next/server";
import { getAccount } from "@/lib/mirror";

export async function GET(_: NextRequest, { params }: { params: { id: string }}) {
  try {
    const data = await getAccount(params.id);
    return NextResponse.json(data);
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
