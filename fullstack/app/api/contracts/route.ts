import { NextRequest, NextResponse } from "next/server";
import { addActivity, getAssetRecord, updateAssetRecord } from "@/lib/assetRegistry";
import { associateTokenToContract, deployDividendDistributor, toHashscanLink } from "@/lib/hedera";

interface ContractRequestBody {
  assetId?: string;
  nftTokenId?: string;
  fractionTokenId?: string;
  initialSupply?: number;
  ownerAccountId?: string;
}

function requireField<T>(value: T | undefined, message: string): T {
  if (value === undefined || value === null || value === "") {
    throw new Error(message);
  }
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ContractRequestBody;

    const assetId = body.assetId?.trim();
    let nftTokenId = body.nftTokenId?.trim();
    let fractionTokenId = body.fractionTokenId?.trim();
    let initialSupply = body.initialSupply;

    let asset = null;
    if (assetId) {
      asset = await getAssetRecord(assetId);
      if (!asset) {
        return NextResponse.json({ error: `Asset ${assetId} not found` }, { status: 404 });
      }

      nftTokenId = nftTokenId ?? asset.nftTokenId;
      fractionTokenId = fractionTokenId ?? asset.fractionTokenId;
      initialSupply = initialSupply ?? asset.sharesTotal;
    }

    nftTokenId = requireField(nftTokenId, "nftTokenId is required");
    fractionTokenId = requireField(fractionTokenId, "fractionTokenId is required");
    initialSupply = requireField(initialSupply, "initialSupply is required");

    const deployment = await deployDividendDistributor({
      nftTokenId,
      fractionTokenId,
      initialSupply,
      ownerAccountId: body.ownerAccountId,
    });

    const association = await associateTokenToContract(deployment.contractId, fractionTokenId);

    if (assetId) {
      await updateAssetRecord(assetId, { distributor: deployment.contractId });
      await addActivity(assetId, {
        type: "DEPLOY_CONTRACT",
        by: body.ownerAccountId || process.env.OPERATOR_ID || undefined,
        amount: String(initialSupply),
        txLink: deployment.deployLink,
        at: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      {
        contract: {
          id: deployment.contractId,
          transactionId: deployment.transactionId,
          contractLink: deployment.contractLink,
          deployLink: deployment.deployLink,
        },
        association,
        hashscan: {
          contract: toHashscanLink("contract", deployment.contractId),
          transaction: deployment.deployLink,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Contract deployment error:", error);
    const message = error?.message || "Failed to deploy contract";
    return NextResponse.json({ error: message }, { status: message.includes("required") ? 400 : 500 });
  }
}
