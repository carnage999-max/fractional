import { overwriteJsonInHfsFile, storeJsonInHfs, readHfsFileContents } from "./hedera";
import { MIRROR, getAccountTokenBalance } from "./mirror";
import type { ActivityEvent, Asset, AssetCategory } from "./types";

const REGISTRY_VERSION = 1;
const REGISTRY_KIND = "fractional.registry.v1";
const REGISTRY_MEMO = "fractional-registry-v1";

export type AssetRecord = {
  id: string;
  name: string;
  description: string;
  image: string;
  category: AssetCategory;
  nftTokenId: string;
  fractionTokenId: string;
  distributor: string;
  treasuryAccountId: string;
  pricePerShare: string;
  sharesTotal: number;
  apr?: string;
  metadataCid?: string;
  metadataUrl?: string;
  metadataGatewayUrl?: string;
  metadataFileId?: string;
  nftSerialNumber?: number;
  creator: string;
  createdAt: string;
  activities: ActivityEvent[];
};

type RegistryDocument = {
  version: number;
  kind: string;
  assets: AssetRecord[];
};

const emptyRegistry: RegistryDocument = { version: REGISTRY_VERSION, kind: REGISTRY_KIND, assets: [] };

function normaliseSearch(value: string) {
  return value.trim().toLowerCase();
}

async function fetchRegistryDocument(fileId: string): Promise<RegistryDocument> {
  const sources: Array<() => Promise<string>> = [
    async () => {
      const res = await fetch(`${MIRROR}/files/${fileId}/contents`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Mirror read failed with status ${res.status}`);
      }
      return await res.text();
    },
    async () => {
      const buffer = await readHfsFileContents(fileId);
      return buffer.toString("utf8");
    },
  ];

  let lastError: Error | null = null;
  for (const getSource of sources) {
    try {
      const raw = await getSource();
      const trimmed = raw.trim();
      if (!trimmed) return emptyRegistry;
      try {
        const doc = JSON.parse(trimmed);
        if (!Array.isArray(doc.assets)) {
          throw new Error("Not a registry document");
        }
        return {
          version: typeof doc.version === "number" ? doc.version : REGISTRY_VERSION,
          kind: typeof doc.kind === "string" ? doc.kind : REGISTRY_KIND,
          assets: doc.assets,
        };
      } catch {
        const decoded = Buffer.from(trimmed, "base64").toString("utf8");
        const doc = JSON.parse(decoded);
        if (!Array.isArray(doc.assets)) {
          throw new Error("Not a registry document");
        }
        return {
          version: typeof doc.version === "number" ? doc.version : REGISTRY_VERSION,
          kind: typeof doc.kind === "string" ? doc.kind : REGISTRY_KIND,
          assets: doc.assets,
        };
      }
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error(`Failed to read registry file ${fileId}`);
}

async function discoverRegistryFileId(): Promise<string | null> {
  const operatorAccount = process.env.OPERATOR_ID;
  if (!operatorAccount) return null;

  try {
    const params = new URLSearchParams({
      "account.id": operatorAccount,
      order: "desc",
      limit: "25",
    });
    const res = await fetch(`${MIRROR}/files?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Mirror file query failed (${res.status})`);
    }

    const json = await res.json();
    const files: Array<{ file_id?: string }> = Array.isArray(json.files) ? json.files : [];

    for (const entry of files) {
      const candidateId = entry.file_id;
      if (!candidateId) continue;
      try {
        const doc = await fetchRegistryDocument(candidateId);
        if (doc.kind === REGISTRY_KIND && Array.isArray(doc.assets)) {
          process.env.ASSET_REGISTRY_FILE_ID = candidateId;
          return candidateId;
        }
      } catch {
        continue;
      }
    }
  } catch (error) {
    console.warn("Failed to auto-discover registry file from mirror", error);
  }

  return null;
}

async function ensureRegistry(): Promise<{ fileId: string; doc: RegistryDocument }> {
  let fileId = process.env.ASSET_REGISTRY_FILE_ID ?? (await discoverRegistryFileId());
  if (!fileId) {
    const created = await storeJsonInHfs(emptyRegistry, { memo: REGISTRY_MEMO });
    fileId = created.fileId;
    process.env.ASSET_REGISTRY_FILE_ID = fileId;
    console.warn(`Created new asset registry file on HFS: ${fileId}. Persist this ID in ASSET_REGISTRY_FILE_ID.`);
    return { fileId, doc: emptyRegistry };
  }

  try {
    const doc = await fetchRegistryDocument(fileId);
    if (doc.kind !== REGISTRY_KIND) {
      console.warn(`Registry file ${fileId} has unexpected kind ${doc.kind}; resetting to empty registry.`);
      return { fileId, doc: emptyRegistry };
    }
    return { fileId, doc };
  } catch (error) {
    console.error("Failed to read asset registry from HFS; falling back to empty registry", error);
    return { fileId, doc: emptyRegistry };
  }
}

async function loadRegistry(): Promise<{ fileId: string | null; doc: RegistryDocument }> {
  let fileId = process.env.ASSET_REGISTRY_FILE_ID ?? (await discoverRegistryFileId());
  if (!fileId) return { fileId: null, doc: emptyRegistry };
  try {
    const doc = await fetchRegistryDocument(fileId);
    if (doc.kind !== REGISTRY_KIND) {
      console.warn(`Registry file ${fileId} has unexpected kind ${doc.kind}; returning empty registry.`);
      return { fileId, doc: emptyRegistry };
    }
    return { fileId, doc };
  } catch (error) {
    console.error("Failed to read asset registry from HFS", error);
    return { fileId, doc: emptyRegistry };
  }
}

async function persistRegistry(fileId: string, doc: RegistryDocument) {
  await overwriteJsonInHfsFile(fileId, doc);
}

async function enrichRecord(record: AssetRecord): Promise<Asset> {
  let sharesAvailable = record.sharesTotal;
  try {
    sharesAvailable = await getAccountTokenBalance(record.treasuryAccountId, record.fractionTokenId);
  } catch (error) {
    console.warn(`Failed to read fraction balance for ${record.fractionTokenId}`, error);
  }

  return {
    id: record.id,
    name: record.name,
    description: record.description,
    image: record.image,
    category: record.category,
    nftTokenId: record.nftTokenId,
    fractionTokenId: record.fractionTokenId,
    distributor: record.distributor,
    pricePerShare: record.pricePerShare,
    sharesTotal: record.sharesTotal,
    sharesAvailable,
    apr: record.apr,
    metadataCid: record.metadataCid,
    metadataFileId: record.metadataFileId,
    nftSerialNumber: record.nftSerialNumber,
    creator: record.creator,
    treasuryAccountId: record.treasuryAccountId,
    createdAt: record.createdAt,
  };
}

export async function listAssets(limit = 100, search = ""): Promise<Asset[]> {
  const { fileId, doc } = await loadRegistry();
  console.log("[assetRegistry] listAssets", {
    fileId,
    assetCount: doc.assets.length,
    search,
    limit,
  });
  const term = normaliseSearch(search);
  const filtered = term
    ? doc.assets.filter((asset) =>
        asset.name.toLowerCase().includes(term) || asset.description.toLowerCase().includes(term)
      )
    : doc.assets;

  const ordered = [...filtered].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const sliced = ordered.slice(0, limit);
  return Promise.all(sliced.map((record) => enrichRecord(record)));
}

export async function getAssetById(id: string): Promise<Asset | null> {
  const { doc } = await loadRegistry();
  const record = doc.assets.find((asset) => asset.id === id || asset.nftTokenId === id);
  if (!record) return null;
  return enrichRecord(record);
}

export async function getAssetRecord(id: string): Promise<AssetRecord | null> {
  const { doc } = await loadRegistry();
  return doc.assets.find((asset) => asset.id === id || asset.nftTokenId === id) ?? null;
}

export async function createAssetRecord(record: Omit<AssetRecord, "activities"> & { activities?: ActivityEvent[] }) {
  const { fileId, doc } = await ensureRegistry();
  const existing = doc.assets.find((asset) => asset.id === record.id || asset.nftTokenId === record.nftTokenId);
  if (existing) {
    throw new Error(`Asset with id ${record.id} already exists in registry`);
  }
  const entry: AssetRecord = { ...record, activities: record.activities ?? [] };
  doc.assets.push(entry);
  await persistRegistry(fileId, doc);
  return enrichRecord(entry);
}

export async function updateAssetRecord(id: string, patch: Partial<AssetRecord>) {
  const { fileId, doc } = await ensureRegistry();
  const target = doc.assets.find((asset) => asset.id === id || asset.nftTokenId === id);
  if (!target) throw new Error(`Asset ${id} not found in registry`);
  Object.assign(target, patch);
  await persistRegistry(fileId, doc);
  return enrichRecord(target);
}

export async function addActivity(assetId: string, activity: ActivityEvent) {
  const { fileId, doc } = await ensureRegistry();
  const target = doc.assets.find((asset) => asset.id === assetId || asset.nftTokenId === assetId);
  if (!target) throw new Error(`Asset ${assetId} not found in registry`);
  target.activities = target.activities || [];
  target.activities.unshift(activity);
  await persistRegistry(fileId, doc);
}

export async function listActivities(assetId: string): Promise<ActivityEvent[]> {
  const record = await getAssetRecord(assetId);
  if (!record) return [];
  return record.activities ?? [];
}

export async function ensureRegistryFileId(): Promise<string> {
  const { fileId } = await ensureRegistry();
  return fileId;
}
