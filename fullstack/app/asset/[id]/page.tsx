"use client";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { useWallet } from "@/components/wallet/HWCProvider";
import { useEffect, useMemo, useState } from "react";

type Asset = {
  id: string;
  name: string;
  description: string;
  image: string;
  fractionTokenId: string;
  sharesAvailable: number;
  pricePerShare: string;
  metadataCid?: string | null;
  metadataFileId?: string | null;
  treasuryAccountId?: string | null;
};

type ActivityEvent = {
  type: string;
  txLink: string;
  at: string;
  by?: string;
  amount?: string | number;
};

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AssetDetail({ params }: { params: { id: string } }) {
  const { accountId, signAndExecute, status } = useWallet();
  const toast = useToast();
  
  // Debug wallet state
  useEffect(() => {
    console.log("[AssetDetail] Wallet state:", { accountId, status });
  }, [accountId, status]);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositMsg, setDepositMsg] = useState<string | null>(null);
  const [depositLink, setDepositLink] = useState<string | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [metadata, setMetadata] = useState<any | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setFetching(true);
      setError(null);
      try {
        const assetResponse = await fetchJSON(`/api/assets/${params.id}`);
        const normalizedAsset = assetResponse?.item ?? assetResponse;
        if (!normalizedAsset) {
          throw new Error("Asset not found");
        }
        if (!cancelled) {
          setAsset(normalizedAsset as Asset);
        }

        const cid = normalizedAsset?.metadataCid;
        if (cid && !cancelled) {
          setMetadataLoading(true);
          setMetadataError(null);
          const gatewayUrl = `https://ipfs.io/ipfs/${String(cid).replace(/^ipfs:\/\//, "")}`;
          try {
            const meta = await fetchJSON(gatewayUrl);
            if (!cancelled) {
              setMetadata(meta);
            }
          } catch (err: any) {
            console.error("Failed to load metadata", err);
            if (!cancelled) {
              setMetadataError(err?.message || "Failed to load metadata");
            }
          } finally {
            if (!cancelled) {
              setMetadataLoading(false);
            }
          }
        } else {
          setMetadata(null);
          setMetadataError(null);
          setMetadataLoading(false);
        }

        const activityResponse = await fetchJSON(`/api/activity?assetId=${params.id}`);
        const normalizedActivity = Array.isArray(activityResponse)
          ? activityResponse
          : activityResponse?.events ?? [];

        if (!cancelled) {
          setActivity(normalizedActivity as ActivityEvent[]);
        }
      } catch (e: any) {
        console.error("Failed to load asset detail", e);
        if (!cancelled) {
          setError(e?.message || "Failed to load asset");
          setAsset(null);
          setActivity([]);
        }
      } finally {
        if (!cancelled) {
          setFetching(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const buy = async () => {
    if (!asset) return;
    console.log("[AssetDetail] Buy clicked, accountId:", accountId);
    if (!accountId) { 
      setMsg("Wallet not connected. Please connect your wallet first."); 
      toast.error("Wallet not connected");
      return; 
    }
    if (amount <= 0) { setMsg("Enter a valid share amount."); return; }
    try {
      setLoading(true); setMsg(null);
      const body = {
        tokenId: asset.fractionTokenId,
        sender: asset.treasuryAccountId || accountId,
        recipient: accountId,
        amount: Math.floor(Number(amount)),
      };
      const composed = await fetchJSON("/api/rpc/compose/ft-transfer", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(body) });
      const txId = await signAndExecute(composed.bytes);
      setMsg(`Submitted: ${txId}`);
      toast.success("Share purchase submitted to your wallet");
    } catch (e:any) {
      setMsg(e.message || "Failed to buy");
      toast.error(e?.message || "Failed to buy shares");
    } finally {
      setLoading(false);
    }
  };

  const displayImage = useMemo(() => {
    const fromMetadata = metadata?.image ? String(metadata.image) : null;
    const fallback = asset?.image || "/logo.svg";
    const uri = fromMetadata || fallback;
    if (!uri) return "/logo.svg";
    if (uri.startsWith("ipfs://")) {
      return `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}`;
    }
    return uri;
  }, [asset?.image, metadata?.image]);

  const depositRewards = async () => {
    if (!asset) return;
    if (!accountId) { setDepositMsg("Connect your wallet first."); return; }
    const numericAmount = Number(depositAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setDepositMsg("Enter a positive HBAR amount.");
      return;
    }

    try {
      setDepositLoading(true);
  setDepositMsg(null);
  setDepositLink(null);
      const res = await fetch("/api/rewards/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset.id,
          amount: depositAmount,
          depositor: accountId,
          memo: `Rewards for ${asset.id}`,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to deposit rewards");
      }

  setDepositMsg(`Deposited ${depositAmount} HBAR.`);
  toast.success("Rewards deposited successfully");
  setDepositLink(json.txLink || null);
      setDepositAmount("");
      setActivity((prev) => [
        {
          type: "DEPOSIT_REWARDS",
          txLink: json.txLink,
          at: new Date().toISOString(),
          by: accountId,
          amount: depositAmount,
        },
        ...prev,
      ]);
    } catch (error: any) {
  const message = error?.message || "Failed to deposit rewards";
  setDepositMsg(message);
  toast.error(message);
  setDepositLink(null);
    } finally {
      setDepositLoading(false);
    }
  };

  if (fetching) {
    return <main className="mx-auto max-w-7xl px-4 py-10">Loading...</main>;
  }

  if (error || !asset) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10">
        <p className="text-sm text-red-400">{error || "Asset not found."}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 grid gap-8 md:grid-cols-2">
      <section className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow space-y-4">
        <div className="relative h-64 w-full overflow-hidden rounded-2xl bg-muted/80">
          <Image
            src={displayImage}
            alt={metadata?.name || asset.name}
            fill
            className="object-cover"
          />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{metadata?.name || asset.name}</h1>
          <p className="text-sm text-foreground/80">{metadata?.description || asset.description}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/60 p-4 text-xs text-foreground/70 space-y-2">
          {asset.metadataCid ? (
            <>
              <div className="flex items-center justify-between">
                <span>Metadata CID</span>
                <a
                  href={`https://ipfs.io/ipfs/${asset.metadataCid}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline"
                >
                  {asset.metadataCid}
                </a>
              </div>
              {asset.metadataFileId && (
                <div className="flex items-center justify-between">
                  <span>HFS File ID</span>
                  <span className="font-mono">{asset.metadataFileId}</span>
                </div>
              )}
              {metadataLoading && <p>Loading metadata…</p>}
              {metadataError && <p className="text-red-400">{metadataError}</p>}
              {Array.isArray(metadata?.attributes) && metadata.attributes.length > 0 && (
                <div>
                  <p className="font-semibold mb-1">Attributes</p>
                  <ul className="space-y-1">
                    {metadata.attributes.map((attr: any, idx: number) => (
                      <li key={idx} className="flex items-center justify-between">
                        <span>{attr.trait_type}</span>
                        <span className="font-medium">{String(attr.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p>No metadata CID available for this asset.</p>
          )}
        </div>
      </section>
      <section className="space-y-4">
        <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow">
          <div className="flex items-center justify-between"><span className="text-sm text-foreground/70">Price per share</span><span className="font-semibold">${asset.pricePerShare}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-foreground/70">Available</span><span className="font-semibold">{asset.sharesAvailable}</span></div>
          {accountId && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-foreground/70">Your Account</span>
              <span className="text-xs font-mono text-green-400">{accountId}</span>
            </div>
          )}
          {!accountId && (
            <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <p className="text-xs text-yellow-400">⚠️ Wallet not connected. Please connect your wallet from the navbar.</p>
            </div>
          )}
          <div className="mt-4 space-y-2">
            <input value={amount || ""} onChange={(e)=>setAmount(Number(e.target.value))} placeholder="Amount of shares" className="w-full rounded-2xl bg-muted/80 border border-border px-3 py-2 text-foreground placeholder:text-foreground/40"/>
            <Button className="w-full" disabled={loading || !accountId} onClick={buy}>{loading? "Processing..." : !accountId ? "Connect Wallet First" : "Buy Shares"}</Button>
            {msg && <p className="text-xs text-foreground/80 mt-2">{msg}</p>}
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow">
          <h3 className="font-semibold mb-3">Distribute Rewards</h3>
          <p className="text-xs text-foreground/70 mb-2">Deposit HBAR into the distributor contract to reward fraction holders.</p>
          <input
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Amount in HBAR"
            className="w-full rounded-2xl bg-muted/80 border border-border px-3 py-2 text-foreground placeholder:text-foreground/40"
          />
          <Button className="w-full mt-3" disabled={depositLoading} onClick={depositRewards}>
            {depositLoading ? "Depositing..." : "Distribute Rewards"}
          </Button>
          {depositMsg && (
            <p className="text-xs text-foreground/80 mt-2 break-words">
              {depositMsg}
              {depositLink && (
                <>
                  {" "}
                  <a href={depositLink} className="text-accent underline" target="_blank" rel="noreferrer">
                    HashScan
                  </a>
                </>
              )}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow">
          <h3 className="font-semibold mb-3">Activity</h3>
          <ul className="space-y-2 text-sm">
            {activity.length === 0 && <li className="text-foreground/60 text-xs">No activity yet.</li>}
            {activity.map((e,i)=>(
              <li key={i} className="flex items-center justify-between">
                <span>{e.type}</span>
                <a href={e.txLink} className="text-accent underline" target="_blank" rel="noreferrer">tx</a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
