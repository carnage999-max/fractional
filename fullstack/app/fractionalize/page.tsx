"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/components/wallet/HWCProvider";
import { useToast } from "@/components/ui/ToastProvider";

const toGateway = (uri?: string | null) => {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    const stripped = uri.replace("ipfs://", "").replace(/^\/+/, "");
    return stripped ? `https://ipfs.io/ipfs/${stripped}` : null;
  }
  if (/^https?:\/\//i.test(uri) || uri.startsWith("/")) {
    return uri;
  }
  return null;
};

type OwnedNft = {
  tokenId: string;
  serial: number;
  metadataUri: string | null;
};

type FractionalizeResponse = {
  asset: { id: string };
  hedera: {
    nft: { tokenId: string; serial: number; tokenLink: string };
    fraction: { tokenId: string; tokenLink: string; createLink: string };
    contract: { contractLink: string; deployLink: string; associationLink: string };
  };
};

const decodeMetadataUri = (base64?: string | null) => {
  if (!base64) return null;
  try {
    return atob(base64);
  } catch {
    return null;
  }
};

export default function FractionalizePage() {
  const router = useRouter();
  const { accountId, connect, connectExtension, status } = useWallet();
  const toast = useToast();
  const [loadingNfts, setLoadingNfts] = useState(false);
  const [nfts, setNfts] = useState<OwnedNft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OwnedNft | null>(null);
  const [selectedMetadata, setSelectedMetadata] = useState<any | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [totalShares, setTotalShares] = useState<string>("");
  const [pricePerShare, setPricePerShare] = useState<string>("");
  const [category, setCategory] = useState<"RWA" | "GAMING">("RWA");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<FractionalizeResponse | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const hasWallet = !!accountId;

  useEffect(() => {
    if (!accountId) {
      setNfts([]);
      setSelected(null);
      setSelectedMetadata(null);
      return;
    }

    (async () => {
      setLoadingNfts(true);
      setError(null);
      try {
        const res = await fetch(`/api/mirror/account/${accountId}/nfts`);
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error || `Failed to load NFTs (${res.status})`);
        }

        const items: OwnedNft[] = (json?.nfts || []).map((nft: any) => ({
          tokenId: nft.token_id,
          serial: Number(nft.serial_number || 0),
          metadataUri: decodeMetadataUri(nft.metadata),
        }));
        setNfts(items);
        if (items.length === 0) {
          setError("No NFTs found in this account.");
        }
      } catch (err: any) {
        setError(err?.message || "Failed to load NFTs");
        setNfts([]);
        toast.error(err?.message || "Failed to load NFTs");
      } finally {
        setLoadingNfts(false);
      }
    })();
  }, [accountId, toast]);

  useEffect(() => {
    if (!selected?.metadataUri) {
      setSelectedMetadata(null);
      setMetadataError(null);
      setMetadataLoading(false);
      return;
    }

    (async () => {
      setMetadataLoading(true);
      setMetadataError(null);
      try {
        const gateway = toGateway(selected.metadataUri);
        if (!gateway) throw new Error("Unsupported metadata URI");
        const res = await fetch(gateway);
        if (!res.ok) {
          throw new Error(`Failed to load metadata (${res.status})`);
        }
        const json = await res.json();
        setSelectedMetadata(json);
      } catch (err: any) {
        setMetadataError(err?.message || "Failed to load metadata");
        setSelectedMetadata(null);
        toast.error(err?.message || "Failed to load metadata");
      } finally {
        setMetadataLoading(false);
      }
    })();
  }, [selected?.metadataUri, toast]);

  const previewImage = useMemo(() => {
    const uri = selectedMetadata?.image || selected?.metadataUri;
    return toGateway(uri) || "/logo.svg";
  }, [selectedMetadata?.image, selected?.metadataUri]);

  const handleSubmit = async () => {
    if (!accountId || !selected) {
      setSubmitMessage("Connect a wallet and select an NFT first");
      return;
    }
    if (!totalShares || Number(totalShares) <= 0) {
      setSubmitMessage("Enter a positive number of shares");
      return;
    }
    if (!pricePerShare) {
      setSubmitMessage("Provide a price per share");
      return;
    }

    setSubmitting(true);
    setSubmitMessage(null);
    setResult(null);

    try {
      const res = await fetch("/api/assets/fractionalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nftTokenId: selected.tokenId,
          ownerAccountId: accountId,
          totalShares: Number(totalShares),
          pricePerShare,
          category,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to fractionalize NFT");
      }

      setResult(json as FractionalizeResponse);
      setSubmitMessage("Fractionalization complete!");
      setTotalShares("");
      setPricePerShare("");
      toast.success("Fractionalization complete!");
      router.push(`/asset/${json.asset.id}`);
    } catch (err: any) {
      setSubmitMessage(err?.message || "Fractionalization failed");
      toast.error(err?.message || "Fractionalization failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fractionalize an Existing NFT</h1>
        {!hasWallet && (
          <div className="flex gap-3">
            <Button onClick={connectExtension}>Connect HashPack</Button>
            <Button variant="ghost" onClick={connect}>WalletConnect</Button>
          </div>
        )}
      </div>

      {hasWallet && (
        <p className="text-sm text-foreground/60">Connected account: {accountId} (status: {status})</p>
      )}

      {!hasWallet && (
        <div className="rounded-3xl border border-dashed border-accent/40 bg-card/60 p-6 text-center text-sm text-foreground/70">
          Connect your Hedera wallet to view owned NFTs.
        </div>
      )}

      {hasWallet && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow space-y-4">
            <h2 className="text-lg font-semibold">1. Choose an NFT</h2>
            {loadingNfts ? (
              <p className="text-sm text-foreground/70">Loading NFTs…</p>
            ) : error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : nfts.length === 0 ? (
              <p className="text-sm text-foreground/60">No NFTs available in this account.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-auto pr-2">
                {nfts.map((nft) => (
                  <label
                    key={`${nft.tokenId}-${nft.serial}`}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border px-3 py-2 text-sm ${
                      selected?.tokenId === nft.tokenId && selected.serial === nft.serial
                        ? "border-accent bg-accent/10"
                        : "border-border/60 bg-card/40"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{nft.tokenId}</span>
                      <span className="text-xs text-foreground/60">Serial #{nft.serial}</span>
                      {nft.metadataUri && (
                        <span className="text-xs text-accent/80 break-all">{nft.metadataUri}</span>
                      )}
                    </div>
                    <input
                      type="radio"
                      name="selectedNft"
                      className="h-4 w-4"
                      checked={selected?.tokenId === nft.tokenId && selected.serial === nft.serial}
                      onChange={() => setSelected(nft)}
                    />
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow space-y-4">
            <h2 className="text-lg font-semibold">2. Configure fractional shares</h2>
            {selected ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="relative h-28 w-28 overflow-hidden rounded-2xl bg-muted/60">
                    <Image src={previewImage} alt="NFT preview" fill className="object-cover" />
                  </div>
                  <div className="text-xs text-foreground/70 space-y-1">
                    <div>
                      <span className="font-semibold">Token ID:</span> {selected.tokenId}
                    </div>
                    <div>
                      <span className="font-semibold">Serial:</span> {selected.serial}
                    </div>
                    {metadataLoading && <p>Loading metadata…</p>}
                    {metadataError && <p className="text-red-400">{metadataError}</p>}
                    {selectedMetadata?.name && (
                      <p>
                        <span className="font-semibold">Name:</span> {selectedMetadata.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-foreground/60">Total Shares</label>
                    <input
                      type="number"
                      min="1"
                      value={totalShares}
                      onChange={(e) => setTotalShares(e.target.value)}
                      className="w-full rounded-2xl border border-border bg-muted/80 px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-foreground/60">Price per Share (USD)</label>
                    <input
                      type="text"
                      value={pricePerShare}
                      onChange={(e) => setPricePerShare(e.target.value)}
                      className="w-full rounded-2xl border border-border bg-muted/80 px-3 py-2 text-sm text-foreground"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-foreground/60">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value === "GAMING" ? "GAMING" : "RWA")}
                    className="w-full rounded-2xl border border-border bg-muted/80 px-3 py-2 text-sm text-foreground"
                  >
                    <option value="RWA">RWA</option>
                    <option value="GAMING">GAMING</option>
                  </select>
                </div>

                <Button className="w-full" disabled={submitting} onClick={handleSubmit}>
                  {submitting ? "Fractionalizing…" : "Fractionalize NFT"}
                </Button>
                {submitMessage && (
                  <p className={`text-xs ${result ? "text-foreground/70" : "text-red-400"}`}>{submitMessage}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-foreground/60">Select an NFT to continue.</p>
            )}
          </section>
        </div>
      )}

      {result && (
        <section className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow space-y-2 text-sm text-foreground/70">
          <h2 className="text-lg font-semibold text-foreground">On-Chain Results</h2>
          <p>
            Asset listed: <a href={`/asset/${result.asset.id}`} className="text-accent underline">View asset</a>
          </p>
          <p>
            Fraction token: <a href={result.hedera.fraction.tokenLink} className="text-accent underline" target="_blank" rel="noreferrer">HashScan</a>
          </p>
          <p>
            Distributor contract: <a href={result.hedera.contract.contractLink} className="text-accent underline" target="_blank" rel="noreferrer">HashScan</a>
          </p>
        </section>
      )}
    </main>
  );
}
