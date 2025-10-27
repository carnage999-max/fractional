 "use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";

type CreateAssetResult = {
  asset: { id: string; name: string };
  hedera?: {
    nft?: { tokenId: string; mintLink?: string; createLink?: string; tokenLink?: string };
    fraction?: { tokenId: string; createLink?: string; tokenLink?: string };
    contract?: { id: string; deployLink?: string; associationLink?: string };
  };
  error?: string;
};

export default function CreatePage() {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateAssetResult | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim(),
      totalShares: Number(formData.get("totalShares") ?? 0),
      pricePerShare: String(formData.get("pricePerShare") ?? "").trim(),
      category: String(formData.get("category") ?? "RWA").trim(),
      image: String(formData.get("image") ?? "").trim(),
    };

    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => ({}))) as CreateAssetResult;
      if (!res.ok || !json?.asset?.id) {
        throw new Error(json?.error || "Failed to mint asset");
      }

      setResult(json);
      toast.success("Asset minted on Hedera");
      form.reset();
      router.push(`/asset/${json.asset.id}`);
    } catch (err: any) {
      const message = err?.message || "Failed to mint asset";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">List an Asset</h1>
        <p className="text-sm text-foreground/60">
          Uploads metadata to IPFS + HFS, mints HTS tokens, and deploys the distributor contract.
        </p>
      </div>

      {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow">
        <div>
          <label className="mb-1 block text-xs text-foreground/70">Name</label>
          <input
            name="name"
            required
            disabled={loading}
            className="w-full rounded-2xl border border-border bg-muted/80 px-3 py-2 text-foreground placeholder:text-foreground/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-foreground/70">Description</label>
          <textarea
            name="description"
            required
            rows={3}
            disabled={loading}
            className="w-full rounded-2xl border border-border bg-muted/80 px-3 py-2 text-foreground placeholder:text-foreground/40"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-foreground/70">Total Shares</label>
            <input
              name="totalShares"
              type="number"
              min="1"
              required
              disabled={loading}
              className="w-full rounded-2xl border border-border bg-muted/80 px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-foreground/70">Price per Share (USD)</label>
            <input
              name="pricePerShare"
              type="text"
              required
              disabled={loading}
              className="w-full rounded-2xl border border-border bg-muted/80 px-3 py-2 text-foreground"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-foreground/70">Category</label>
            <select
              name="category"
              defaultValue="RWA"
              disabled={loading}
              className="w-full rounded-2xl border border-border bg-muted/80 px-3 py-2 text-foreground"
            >
              <option value="RWA">RWA</option>
              <option value="GAMING">GAMING</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-foreground/70">Image URL</label>
            <input
              name="image"
              placeholder="/logo.svg or ipfs://..."
              disabled={loading}
              className="w-full rounded-2xl border border-border bg-muted/80 px-3 py-2 text-foreground"
            />
          </div>
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? "Minting..." : "Mint & Create"}
        </Button>
      </form>

      {result?.hedera && (
        <div className="rounded-3xl border border-border bg-muted/40 p-4 text-sm">
          <h2 className="font-semibold">Latest Hedera actions</h2>
          <ul className="mt-2 space-y-1">
            {result.hedera.nft?.tokenLink && (
              <li>
                NFT Token:{" "}
                <a href={result.hedera.nft.tokenLink} target="_blank" rel="noreferrer" className="text-primary underline">
                  {result.hedera.nft.tokenId}
                </a>
              </li>
            )}
            {result.hedera.fraction?.tokenLink && (
              <li>
                Fraction Token:{" "}
                <a href={result.hedera.fraction.tokenLink} target="_blank" rel="noreferrer" className="text-primary underline">
                  {result.hedera.fraction.tokenId}
                </a>
              </li>
            )}
            {result.hedera.contract?.deployLink && (
              <li>
                Distributor Contract:{" "}
                <a href={result.hedera.contract.deployLink} target="_blank" rel="noreferrer" className="text-primary underline">
                  {result.hedera.contract.id}
                </a>
              </li>
            )}
          </ul>
        </div>
      )}
    </main>
  );
}
