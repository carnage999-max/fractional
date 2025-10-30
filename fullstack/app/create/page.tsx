 "use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { useWallet } from "@/components/wallet/HWCProvider";

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
  const { accountId, status, connect, connectExtension, isExtensionAvailable } = useWallet();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateAssetResult | null>(null);
  const [createdAssetId, setCreatedAssetId] = useState<string | null>(null);

  const connectWalletLabel = useMemo(() => {
    if (!status) return "Connect Wallet";
    if (status.startsWith("error:")) return "Retry Wallet";
    return status.replace(/^[a-z]+:/i, (prefix) => `${prefix.replace(":", " ")}:`).trim();
  }, [status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
  setResult(null);
  setCreatedAssetId(null);

    if (!accountId) {
      const message = "Connect your wallet before minting.";
      setError(message);
      toast.error(message);
      return;
    }

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
      creator: accountId,
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
      setCreatedAssetId(json.asset.id);
      toast.success("Asset minted on Hedera");
      form.reset();
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
        {!accountId && (
          <div className="mt-2 rounded-xl border border-border/70 bg-muted/40 p-3 text-xs text-foreground/80">
            <p className="font-medium">Wallet required</p>
            <p className="mt-1">Connect a Hedera wallet to mint new assets.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {isExtensionAvailable && (
                <Button type="button" variant="outline" onClick={connectExtension}>
                  Use HashPack Extension
                </Button>
              )}
              <Button type="button" variant={isExtensionAvailable ? "ghost" : "outline"} onClick={connect}>
                {connectWalletLabel || "Connect Wallet"}
              </Button>
            </div>
          </div>
        )}
        {accountId && (
          <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-foreground/80">
            <p className="font-medium text-amber-600 dark:text-amber-400">Important: Token Association Required</p>
            <p className="mt-1">
              After creating an asset, you&apos;ll need to associate the NFT and Fraction tokens with your account before you can receive them.
              The system will automatically transfer them to you once associated. If transfers fail, visit the asset page and manually
              claim your tokens.
            </p>
          </div>
        )}
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
        <Button type="submit" disabled={loading || !accountId}>
          {loading ? "Minting..." : accountId ? "Mint & Create" : "Connect Wallet First"}
        </Button>
      </form>

      {result?.hedera && (
        <div className="rounded-3xl border border-border bg-muted/40 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Latest Hedera actions</h2>
            {createdAssetId && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground/60">Asset ready</span>
                <Button size="sm" variant="outline" onClick={() => router.push(`/asset/${createdAssetId}`)}>
                  View asset
                </Button>
              </div>
            )}
          </div>
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
