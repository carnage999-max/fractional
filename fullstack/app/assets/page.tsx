import AssetCard from "@/components/AssetCard";
import { Asset } from "@/lib/types";
import { getBaseUrl } from "@/lib/baseUrl";

async function getAssets(): Promise<Asset[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/assets`, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[assets] Failed to load assets: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json().catch((error) => {
      console.error("[assets] Failed to parse assets response", error);
      return null;
    });

    if (!data || !Array.isArray(data.items)) {
      console.warn("[assets] Assets response missing items array");
      return [];
    }

    return data.items as Asset[];
  } catch (error) {
    console.error("[assets] Unexpected error loading assets", error);
    return [];
  }
}

export default async function AssetsPage() {
  const items = await getAssets();
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">All Assets</h1>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => (
          <AssetCard key={a.id} item={a} />
        ))}
      </div>
    </main>
  );
}
