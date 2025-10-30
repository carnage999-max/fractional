import fs from "fs";
import path from "path";

const PINATA_PIN_JSON_ENDPOINT = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

function resolvePinataJwt(): string | null {
  const fromEnv = process.env.PINATA_JWT?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const fromFile = process.env.PINATA_JWT_FILE?.trim();
  if (fromFile) {
    const target = path.isAbsolute(fromFile)
      ? fromFile
      : path.resolve(process.cwd(), fromFile);
    try {
      if (fs.existsSync(target)) {
        const raw = fs.readFileSync(target, "utf8").trim();
        if (raw) {
          return raw;
        }
      } else {
        console.warn(`[pinata] PINATA_JWT_FILE set to ${target}, but file not found.`);
      }
    } catch (error) {
      console.warn("[pinata] Failed to load PINATA_JWT_FILE:", error);
    }
  }

  const fallback = process.env.NEXT_PUBLIC_PINATA_JWT?.trim();
  if (fallback) {
    console.warn("[pinata] Falling back to NEXT_PUBLIC_PINATA_JWT. Avoid exposing secrets publicly.");
    return fallback;
  }

  return null;
}

export type PinataResponse = {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
};

export type UploadMetadataResult = {
  cid: string;
  url: string;
  gatewayUrl: string;
  pinSize?: number;
  timestamp?: string;
};

export async function uploadMetadataToIpfs(payload: unknown): Promise<UploadMetadataResult> {
  const jwt = resolvePinataJwt();
  if (!jwt) {
    throw new Error("Missing PINATA_JWT environment variable. Provide a Pinata JWT to enable IPFS uploads.");
  }

  const response = await fetch(PINATA_PIN_JSON_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pinataContent: payload }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "<unreadable response>");
    throw new Error(`Pinata upload failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as PinataResponse;
  return {
    cid: data.IpfsHash,
    url: `ipfs://${data.IpfsHash}`,
    gatewayUrl: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`,
    pinSize: data.PinSize,
    timestamp: data.Timestamp,
  };
}
