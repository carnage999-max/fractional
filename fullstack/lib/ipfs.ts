const PINATA_PIN_JSON_ENDPOINT = "https://api.pinata.cloud/pinning/pinJSONToIPFS";

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
  const jwt = process.env.PINATA_JWT;
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
