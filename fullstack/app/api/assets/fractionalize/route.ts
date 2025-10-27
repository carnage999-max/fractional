import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "buffer";
import { randomUUID } from "crypto";
import { createAssetRecord, listAssets } from "@/lib/assetRegistry";
import { uploadMetadataToIpfs } from "@/lib/ipfs";
import {
  associateTokenToContract,
  createFractionToken,
  deployDividendDistributor,
  storeJsonInHfs,
  toHashscanLink,
} from "@/lib/hedera";
import { mirrorFetch } from "@/lib/mirror";

function generateAssetId() {
  return `asset_${randomUUID()}`;
}

async function getOwnedNftMetadata(owner: string, nftTokenId: string) {
  const owned = await mirrorFetch(`/accounts/${owner}/nfts?token.id=${nftTokenId}&limit=1`);
  const nft = owned?.nfts?.[0];
  if (!nft) {
    throw new Error("Owner does not hold the specified NFT");
  }

  const serial = Number(nft.serial_number || 0);
  const metadataRaw = typeof nft.metadata === "string" ? nft.metadata : "";
  const decoded = metadataRaw ? Buffer.from(metadataRaw, "base64").toString() : "";

  return { serial, metadataUri: decoded };
}

async function fetchTokenInfo(nftTokenId: string) {
  const info = await mirrorFetch(`/tokens/${nftTokenId}`);
  if (info?.type !== "NON_FUNGIBLE_UNIQUE") {
    throw new Error("Token is not an NFT");
  }
  return info;
}

async function fetchMetadataJson(uri: string) {
  if (!uri) return null;
  const cleaned = uri.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}` : uri;
  const res = await fetch(cleaned);
  if (!res.ok) {
    throw new Error(`Failed to fetch NFT metadata (${res.status})`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(async () => {
      const form = await req.formData();
      return {
        nftTokenId: form.get("nftTokenId"),
        ownerAccountId: form.get("ownerAccountId"),
        totalShares: form.get("totalShares"),
        pricePerShare: form.get("pricePerShare"),
        category: form.get("category"),
        symbol: form.get("symbol"),
        memo: form.get("memo"),
      };
    });

    const nftTokenId = String(body.nftTokenId ?? "").trim();
    const ownerAccountId = String(body.ownerAccountId ?? "").trim();
    const totalShares = Number(body.totalShares ?? 0);
    const pricePerShare = String(body.pricePerShare ?? "0").trim();
    const category = (String(body.category ?? "RWA").toUpperCase() === "GAMING" ? "GAMING" : "RWA") as "RWA" | "GAMING";
    const symbol = body.symbol ? String(body.symbol) : undefined;
    const memo = body.memo ? String(body.memo) : undefined;

    if (!nftTokenId) throw new Error("nftTokenId is required");
    if (!ownerAccountId) throw new Error("ownerAccountId is required");
    if (!Number.isFinite(totalShares) || totalShares <= 0) throw new Error("totalShares must be positive");
    if (!pricePerShare) throw new Error("pricePerShare is required");

    const [assets, tokenInfo, ownedInfo] = await Promise.all([
      listAssets(1000),
      fetchTokenInfo(nftTokenId),
      getOwnedNftMetadata(ownerAccountId, nftTokenId),
    ]);

    const assetId = generateAssetId();
    const originalMetadataUri = ownedInfo.metadataUri;
    const originalMetadata = originalMetadataUri ? await fetchMetadataJson(originalMetadataUri).catch(() => null) : null;

    const description = originalMetadata?.description || `Fractionalized access to NFT ${nftTokenId}`;
    const imageFromMetadata = originalMetadata?.image || originalMetadataUri;
    const imageUrl = imageFromMetadata?.startsWith("ipfs://")
      ? `https://ipfs.io/ipfs/${imageFromMetadata.replace("ipfs://", "")}`
      : imageFromMetadata;

    const fractionalMetadata = {
      name: `${tokenInfo?.name || "Fractional NFT"} Shares`,
      description,
      image: imageFromMetadata || null,
      attributes: [
        ...(Array.isArray(originalMetadata?.attributes) ? originalMetadata.attributes : []),
        { trait_type: "Original NFT", value: nftTokenId },
        { trait_type: "Original Serial", value: ownedInfo.serial },
        { trait_type: "Total Shares", value: totalShares },
        { trait_type: "Price Per Share", value: pricePerShare },
      ],
      external_url: process.env.APP_URL ? `${process.env.APP_URL}/asset/${assetId}` : undefined,
      original_metadata_uri: originalMetadataUri || null,
    };

    const metadataUpload = await uploadMetadataToIpfs(fractionalMetadata);
    const hfsRecord = await storeJsonInHfs({
      cid: metadataUpload.cid,
      gatewayUrl: metadataUpload.gatewayUrl,
      pinnedAt: metadataUpload.timestamp,
      metadata: fractionalMetadata,
    });

    const fractionToken = await createFractionToken({
      name: `${tokenInfo?.name || "Fractional"} Fraction`,
      symbol,
      totalShares,
      metadataCid: metadataUpload.cid,
    });

    const deployment = await deployDividendDistributor({
      nftTokenId,
      fractionTokenId: fractionToken.tokenId,
      initialSupply: totalShares,
      ownerAccountId,
    });

    const association = await associateTokenToContract(deployment.contractId, fractionToken.tokenId);

    const treasury = process.env.OPERATOR_ID || ownerAccountId;
    const createdAtIso = new Date().toISOString();

    const newAsset = await createAssetRecord({
      id: assetId,
      name: tokenInfo?.name || `Fractionalized ${nftTokenId}`,
      description,
      image: imageUrl || metadataUpload.gatewayUrl,
      category,
      nftTokenId,
      fractionTokenId: fractionToken.tokenId,
      distributor: deployment.contractId,
      treasuryAccountId: treasury,
      metadataCid: metadataUpload.cid,
      metadataUrl: metadataUpload.url,
      metadataGatewayUrl: metadataUpload.gatewayUrl,
      metadataFileId: hfsRecord.fileId,
      nftSerialNumber: ownedInfo.serial,
      pricePerShare,
      sharesTotal: totalShares,
      creator: ownerAccountId,
      createdAt: createdAtIso,
      activities: [
        {
          type: "FRACTIONALIZE_NFT",
          by: ownerAccountId,
          amount: "1",
          txLink: toHashscanLink("token", nftTokenId),
          at: createdAtIso,
        },
        {
          type: "CREATE_FT",
          by: ownerAccountId,
          amount: String(totalShares),
          txLink: fractionToken.link,
          at: createdAtIso,
        },
        {
          type: "DEPLOY_CONTRACT",
          by: ownerAccountId,
          amount: String(totalShares),
          txLink: deployment.deployLink,
          at: createdAtIso,
        },
      ],
    });

    return NextResponse.json({
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
          tokenId: nftTokenId,
          serial: ownedInfo.serial,
          tokenLink: toHashscanLink("token", nftTokenId),
        },
        fraction: {
          tokenId: fractionToken.tokenId,
          transactionId: fractionToken.transactionId,
          createLink: fractionToken.link,
          tokenLink: toHashscanLink("token", fractionToken.tokenId),
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
    });
  } catch (error: any) {
    console.error("Error fractionalizing NFT:", error);
    const message = error?.message || "Failed to fractionalize NFT";
    const status = message.includes("required") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
