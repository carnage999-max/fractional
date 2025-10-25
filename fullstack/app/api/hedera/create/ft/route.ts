import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/hedera";
import { TokenCreateTransaction, TokenSupplyType, Hbar } from "@hashgraph/sdk";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { name, symbol, decimals = 0, initialSupply = 0 } = body;
  if (!name || !symbol) return NextResponse.json({ error: "Missing name/symbol" }, { status: 400 });
  try {
    const client = getClient();
    const tx = new TokenCreateTransaction()
      .setTokenName(name)
      .setTokenSymbol(symbol)
      .setDecimals(decimals)
      .setInitialSupply(initialSupply)
      .setTreasuryAccountId(process.env.OPERATOR_ID!)
      .setSupplyType(TokenSupplyType.Infinite)
      .setAutoRenewAccountId(process.env.OPERATOR_ID!)
      .setAutoRenewPeriod(7776000) // 90 days
      .setMaxTransactionFee(new Hbar(3));
    const submit = await tx.execute(client);
    const receipt = await submit.getReceipt(client);
    return NextResponse.json({ ok: true, tokenId: receipt.tokenId?.toString(), status: receipt.status.toString() });
  } catch (e:any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
