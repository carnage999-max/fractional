import { NextRequest, NextResponse } from "next/server";
import { addActivity, getAssetRecord } from "@/lib/assetRegistry";
import { depositHbarToDistributor } from "@/lib/hedera";

type DepositPayload = {
  assetId: string;
  amount: string;
  depositor?: string;
  memo?: string;
};

async function parseDepositPayload(req: NextRequest): Promise<DepositPayload> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await req.json();
    return {
      assetId: String(json.assetId ?? "").trim(),
      amount: String(json.amount ?? "").trim(),
      depositor: json.depositor ? String(json.depositor) : undefined,
      memo: json.memo ? String(json.memo) : undefined,
    };
  }

  const form = await req.formData();
  return {
    assetId: String(form.get("assetId") ?? "").trim(),
    amount: String(form.get("amount") ?? "").trim(),
    depositor: form.get("depositor") ? String(form.get("depositor")) : undefined,
    memo: form.get("memo") ? String(form.get("memo")) : undefined,
  };
}

function validateDepositPayload(payload: DepositPayload) {
  if (!payload.assetId) {
    throw new Error("assetId is required");
  }

  if (!payload.amount) {
    throw new Error("amount is required");
  }

  const numericAmount = Number(payload.amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("amount must be a positive number");
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await parseDepositPayload(req);
    validateDepositPayload(payload);

  const asset = await getAssetRecord(payload.assetId);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (!asset.distributor) {
      return NextResponse.json({ error: "Asset distributor contract is not set" }, { status: 400 });
    }

    const result = await depositHbarToDistributor({
      contractId: asset.distributor,
      amount: payload.amount,
      memo: payload.memo,
    });

    await addActivity(payload.assetId, {
      type: "DEPOSIT_REWARDS",
      by: payload.depositor || process.env.OPERATOR_ID || undefined,
      amount: payload.amount,
      txLink: result.link,
      at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      assetId: payload.assetId,
      distributor: asset.distributor,
      amount: payload.amount,
      transactionId: result.transactionId,
      status: result.status,
      txLink: result.link,
    });
  } catch (error: any) {
    console.error("Failed to deposit rewards:", error);
    const message = error?.message || "Failed to deposit rewards";
    const statusCode = message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
