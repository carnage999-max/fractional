import { NextRequest, NextResponse } from "next/server";
import { addActivity, getAssetRecord } from "@/lib/assetRegistry";
import { composeDistributorClaimHbar, getPendingHbarForAccount, toHashscanLink } from "@/lib/hedera";

type ClaimPayload = {
  assetId: string;
  accountId: string;
  memo?: string;
  mode?: "compose" | "record";
  txId?: string;
  txLink?: string;
  amountHbar?: string;
};

async function parseClaimPayload(req: NextRequest): Promise<ClaimPayload> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await req.json();
    return {
      assetId: String(json.assetId ?? "").trim(),
      accountId: String(json.accountId ?? "").trim(),
      memo: json.memo ? String(json.memo) : undefined,
      mode: json.mode === "record" ? "record" : "compose",
      txId: json.txId ? String(json.txId) : undefined,
      txLink: json.txLink ? String(json.txLink) : undefined,
      amountHbar: json.amountHbar ? String(json.amountHbar) : undefined,
    };
  }

  const form = await req.formData();
  return {
    assetId: String(form.get("assetId") ?? "").trim(),
    accountId: String(form.get("accountId") ?? form.get("owner") ?? "").trim(),
    memo: form.get("memo") ? String(form.get("memo")) : undefined,
    mode: form.get("mode") === "record" ? "record" : "compose",
    txId: form.get("txId") ? String(form.get("txId")) : undefined,
    txLink: form.get("txLink") ? String(form.get("txLink")) : undefined,
    amountHbar: form.get("amountHbar") ? String(form.get("amountHbar")) : undefined,
  };
}

function ensureRequired(payload: ClaimPayload) {
  if (!payload.assetId) throw new Error("assetId is required");
  if (!payload.accountId) throw new Error("accountId is required");
}

export async function POST(req: NextRequest) {
  try {
    const payload = await parseClaimPayload(req);
    ensureRequired(payload);

  const asset = await getAssetRecord(payload.assetId);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (!asset.distributor) {
      return NextResponse.json({ error: "Asset distributor contract is not set" }, { status: 400 });
    }

    if (payload.mode === "record") {
      if (!payload.txLink || !payload.amountHbar) {
        return NextResponse.json({ error: "txLink and amountHbar are required to record claim" }, { status: 400 });
      }

      await addActivity(payload.assetId, {
        type: "CLAIM_REWARDS",
        by: payload.accountId,
        amount: payload.amountHbar,
        txLink: payload.txLink,
        at: new Date().toISOString(),
      });

      return NextResponse.json({ ok: true });
    }

    const pending = await getPendingHbarForAccount({
      contractId: asset.distributor,
      accountId: payload.accountId,
    });

    if (!pending || pending.tinybars === "0") {
      return NextResponse.json({ error: "No pending rewards" }, { status: 400 });
    }

    const claimTx = await composeDistributorClaimHbar({
      contractId: asset.distributor,
      accountId: payload.accountId,
      memo: payload.memo,
    });

    return NextResponse.json({
      ok: true,
      ...claimTx,
      pendingTinybars: pending.tinybars,
      pendingHbar: pending.hbar,
      expectedHashscan: toHashscanLink("transaction", claimTx.transactionId),
    });
  } catch (error: any) {
    console.error("Failed to compose claim:", error);
    const message = error?.message || "Failed to process claim";
    const statusCode = message.includes("required") || message.includes("pending") ? 400 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
