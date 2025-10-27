import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAssetRecord, listAssets } from "@/lib/assetRegistry";
import { associateTokenToContract, createAssetTokens, deployDividendDistributor, storeJsonInHfs, toHashscanLink } from "@/lib/hedera";
import { uploadMetadataToIpfs } from "@/lib/ipfs";

type AssetPayload = {
  name: string;
  description: string;
  totalShares: number;
  pricePerShare: string;
  category: string;
  image: string;
  apr?: string;
  creator?: string;
};

async function parseAssetPayload(req: NextRequest): Promise<AssetPayload> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await req.json();
    return {
      name: String(json.name ?? "").trim(),
      description: String(json.description ?? "").trim(),
      totalShares: Number(json.totalShares ?? 0),
      pricePerShare: String(json.pricePerShare ?? "0"),
      category: String(json.category ?? "RWA"),
      image: String(json.image ?? ""),
      apr: json.apr ? String(json.apr) : undefined,
      creator: json.creator ? String(json.creator) : undefined,
    };
  }

  const form = await req.formData();
  return {
    name: String(form.get("name") ?? "").trim(),
    description: String(form.get("description") ?? "").trim(),
    totalShares: Number(form.get("totalShares") ?? 0),
    pricePerShare: String(form.get("pricePerShare") ?? "0"),
    category: String(form.get("category") ?? "RWA"),
    image: String(form.get("image") ?? ""),
    apr: form.get("apr") ? String(form.get("apr")) : undefined,
    creator: form.get("creator") ? String(form.get("creator")) : undefined,
  };
}

function validatePayload(payload: AssetPayload) {
  if (!payload.name) throw new Error("Asset name is required");
  if (!payload.description) throw new Error("Description is required");
  if (!Number.isFinite(payload.totalShares) || payload.totalShares <= 0) {
    throw new Error("totalShares must be a positive number");
  }
  if (!payload.pricePerShare) throw new Error("pricePerShare is required");
}

function generateAssetId() {
  return `asset_${randomUUID()}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || "100");
    const q = searchParams.get("q") || "";

  const items = await listAssets(limit, q);

    return NextResponse.json({
      items,
      page: 1,
      pageSize: items.length,
      total: items.length,
    });
  } catch (error) {
    console.error("Error fetching assets:", error);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await parseAssetPayload(req);
    validatePayload(payload);

    const assetId = generateAssetId();
    const createdAtIso = new Date().toISOString();
    const operatorAccount = process.env.OPERATOR_ID || "0.0.0";
    const creatorAccount = payload.creator || operatorAccount;

    const metadata = {
      name: payload.name,
      description: payload.description,
      image: payload.image || undefined,
      attributes: [
        { trait_type: "Category", value: payload.category },
        { trait_type: "Total Shares", value: payload.totalShares },
        { trait_type: "Price Per Share", value: payload.pricePerShare },
        { trait_type: "Created At", value: createdAtIso },
      ],
      external_url: process.env.APP_URL ? `${process.env.APP_URL}/asset/${assetId}` : undefined,
    };

    const metadataUpload = await uploadMetadataToIpfs(metadata);
    const hfsRecord = await storeJsonInHfs({
      cid: metadataUpload.cid,
      gatewayUrl: metadataUpload.gatewayUrl,
      pinnedAt: metadataUpload.timestamp,
      metadata,
    });

    const tokens = await createAssetTokens({
      name: payload.name,
      totalShares: payload.totalShares,
      metadataCid: metadataUpload.cid,
      metadataUrl: metadataUpload.gatewayUrl,
    });

    const deployment = await deployDividendDistributor({
      nftTokenId: tokens.nft.tokenId,
      fractionTokenId: tokens.fraction.tokenId,
      initialSupply: payload.totalShares,
      ownerAccountId: creatorAccount,
    });

    const association = await associateTokenToContract(deployment.contractId, tokens.fraction.tokenId);

    const newAsset = await createAssetRecord({
      id: assetId,
      name: payload.name,
      description: payload.description,
      image: payload.image || metadataUpload.gatewayUrl,
      category: payload.category as "RWA" | "GAMING",
      nftTokenId: tokens.nft.tokenId,
      fractionTokenId: tokens.fraction.tokenId,
      distributor: deployment.contractId,
      treasuryAccountId: operatorAccount,
      metadataCid: metadataUpload.cid,
      metadataUrl: metadataUpload.url,
      metadataGatewayUrl: metadataUpload.gatewayUrl,
      metadataFileId: hfsRecord.fileId,
      nftSerialNumber: tokens.nft.serials[0] ?? undefined,
      pricePerShare: payload.pricePerShare,
      sharesTotal: payload.totalShares,
      apr: payload.apr,
      creator: creatorAccount,
      createdAt: createdAtIso,
      activities: [
        {
          type: "MINT_NFT",
          by: creatorAccount,
          amount: "1",
          txLink: tokens.nft.mintLink,
          at: createdAtIso,
        },
        {
          type: "CREATE_FT",
          by: creatorAccount,
          amount: String(payload.totalShares),
          txLink: tokens.fraction.createLink,
          at: createdAtIso,
        },
        {
          type: "DEPLOY_CONTRACT",
          by: creatorAccount,
          amount: String(payload.totalShares),
          txLink: deployment.deployLink,
          at: createdAtIso,
        },
      ],
    });

    return NextResponse.json(
      {
        asset: newAsset,
        metadata: {
          cid: metadataUpload.cid,
          url: metadataUpload.url,
          gatewayUrl: metadataUpload.gatewayUrl,
          hfsFileId: hfsRecord.fileId,
          hfsTransactions: hfsRecord.hashscanLinks,
        },
        hedera: {
          nft: {
            tokenId: tokens.nft.tokenId,
            serials: tokens.nft.serials,
            transactionId: tokens.nft.mintTxId,
            mintLink: tokens.nft.mintLink,
            createLink: tokens.nft.createLink,
            tokenLink: toHashscanLink("token", tokens.nft.tokenId),
          },
          fraction: {
            tokenId: tokens.fraction.tokenId,
            transactionId: tokens.fraction.createTxId,
            createLink: tokens.fraction.createLink,
            tokenLink: toHashscanLink("token", tokens.fraction.tokenId),
          },
          contract: {
            id: deployment.contractId,
            transactionId: deployment.transactionId,
            contractLink: deployment.contractLink,
            deployLink: deployment.deployLink,
            associationTxId: association.transactionId,
            associationLink: association.link,
          },
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating on-chain asset:", error);
    const message = error?.message || "Failed to create asset";
    return NextResponse.json({ error: message }, { status: message.includes("Missing PINATA_JWT") ? 400 : 500 });
  }
}
