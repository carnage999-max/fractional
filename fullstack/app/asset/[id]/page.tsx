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
  const [rewardStats, setRewardStats] = useState<{
    totalHbarDistributed: number;
    contractHbarBalance: number;
    totalHbarClaimed: number;
    estimatedAPY: number;
    depositCount: number;
    lastDepositAt: string | null;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

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

        // Fetch reward statistics
        setStatsLoading(true);
        try {
          const statsResponse = await fetchJSON(`/api/rewards/stats?assetId=${params.id}`);
          if (!cancelled && statsResponse.ok) {
            setRewardStats(statsResponse.statistics);
          }
        } catch (err) {
          console.warn("Failed to load reward stats:", err);
        } finally {
          if (!cancelled) {
            setStatsLoading(false);
          }
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
      
      // Step 1: Check if account is associated with the token
      console.log("[AssetDetail] Checking token association for:", { accountId, fractionTokenId: asset.fractionTokenId });
      const checkRes = await fetchJSON("/api/rpc/check-token-association", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, tokenIds: [asset.fractionTokenId] })
      });
      console.log("[AssetDetail] Association check result:", checkRes);
      
      const isAssociated = checkRes.associations?.[asset.fractionTokenId];
      
      // Step 2: If not associated, compose and execute association transaction
      if (!isAssociated) {
        console.log("[AssetDetail] Token not associated, requesting association...");
        setMsg("Associating token with your account...");
        toast.info("Please sign the token association in your wallet");
        
        const associateRes = await fetchJSON("/api/rpc/compose/token-associate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, tokenIds: [asset.fractionTokenId] })
        });
        console.log("[AssetDetail] Association composed:", associateRes);
        
        const associateTxId = await signAndExecute(associateRes.bytes);
        console.log("[AssetDetail] Token association executed:", associateTxId);
        setMsg("Token associated successfully, proceeding with purchase...");
        toast.success("Token associated successfully");
        
        // Small delay to ensure association is reflected on network
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log("[AssetDetail] Token already associated, proceeding with transfer");
      }
      
      // Step 3: Execute server-side token transfer from treasury to user
      const buyBody = {
        tokenId: asset.fractionTokenId,
        recipient: accountId,
        amount: Math.floor(Number(amount)),
        assetId: asset.id,
      };
      console.log("[AssetDetail] Sending buy request to server:", buyBody);
      setMsg("Processing share purchase...");
      
      const buyResult = await fetchJSON("/api/shares/buy", { 
        method: "POST", 
        headers: { "Content-Type":"application/json" }, 
        body: JSON.stringify(buyBody) 
      });
      console.log("[AssetDetail] Buy result:", buyResult);
      
      if (!buyResult.ok) {
        throw new Error(buyResult.error || "Failed to purchase shares");
      }

      const successMessage =
        buyResult.message ||
        (buyResult.transactionId ? `Share purchase successful! TX: ${buyResult.transactionId}` : "Share purchase successful!");

      setMsg(successMessage);
      toast.success(successMessage);
      
      // Refresh asset data to show updated holdings
      window.location.reload();
    } catch (e:any) {
      console.error("[AssetDetail] Buy failed:", e);
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
    if (!accountId) { 
      setDepositMsg("Connect your wallet first."); 
      toast.error("Connect your wallet first");
      return; 
    }
    
    const numericAmount = Number(depositAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setDepositMsg("Enter a positive HBAR amount.");
      toast.error("Enter a positive HBAR amount");
      return;
    }

    const MIN_DEPOSIT = 0.01;
    if (numericAmount < MIN_DEPOSIT) {
      setDepositMsg(`Minimum deposit is ${MIN_DEPOSIT} HBAR`);
      toast.error(`Minimum deposit is ${MIN_DEPOSIT} HBAR`);
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

      setDepositMsg(`Deposited ${depositAmount} HBAR by ${json.depositor || accountId}`);
      toast.success(`Rewards deposited successfully: ${depositAmount} HBAR`);
      setDepositLink(json.txLink || null);
      setDepositAmount("");
      
      setActivity((prev) => [
        {
          type: "DEPOSIT_REWARDS",
          txLink: json.txLink,
          at: new Date().toISOString(),
          by: json.depositor || accountId,
          amount: depositAmount,
        },
        ...prev,
      ]);

      // Refresh reward stats
      try {
        const statsResponse = await fetchJSON(`/api/rewards/stats?assetId=${asset.id}`);
        if (statsResponse.ok) {
          setRewardStats(statsResponse.statistics);
        }
      } catch (err) {
        console.warn("Failed to refresh reward stats:", err);
      }
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
          <h3 className="font-semibold mb-3">Reward Distribution</h3>
          
          {/* Reward Statistics */}
          {rewardStats && (
            <div className="mb-4 p-3 rounded-lg bg-muted/50 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-foreground/70">Total Distributed</span>
                <span className="font-semibold text-green-400">{rewardStats.totalHbarDistributed} HBAR</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground/70">Available to Claim</span>
                <span className="font-semibold">{rewardStats.contractHbarBalance} HBAR</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground/70">Total Claimed</span>
                <span className="font-semibold text-blue-400">{rewardStats.totalHbarClaimed} HBAR</span>
              </div>
              {rewardStats.estimatedAPY > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground/70">Estimated APY</span>
                  <span className="font-semibold text-purple-400">{rewardStats.estimatedAPY}%</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-foreground/70">Deposits</span>
                <span className="font-semibold">{rewardStats.depositCount}</span>
              </div>
              {rewardStats.lastDepositAt && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground/70">Last Deposit</span>
                  <span className="font-mono text-[10px]">{new Date(rewardStats.lastDepositAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}
          {statsLoading && <p className="text-xs text-foreground/60 mb-3">Loading reward stats...</p>}

          <p className="text-xs text-foreground/70 mb-2">Deposit HBAR to reward all fraction holders proportionally. <span className="font-semibold text-accent">Minimum: 0.01 HBAR</span></p>
          <input
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Amount in HBAR (min: 0.01)"
            className="w-full rounded-2xl bg-muted/80 border border-border px-3 py-2 text-foreground placeholder:text-foreground/40"
          />
          <Button className="w-full mt-3" disabled={depositLoading || !accountId} onClick={depositRewards}>
            {depositLoading ? "Depositing..." : !accountId ? "Connect Wallet First" : "Distribute Rewards"}
          </Button>
          {depositMsg && (
            <p className="text-xs text-foreground/80 mt-2 break-words">
              {depositMsg}
              {depositLink && (
                <>
                  {" "}
                  <a href={depositLink} className="text-accent underline" target="_blank" rel="noreferrer">
                    View Transaction
                  </a>
                </>
              )}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow">
          <h3 className="font-semibold mb-3">Recent Activity</h3>
          <ul className="space-y-3 text-xs">
            {activity.length === 0 && <li className="text-foreground/60 text-xs">No activity yet.</li>}
            {activity.map((e, i) => {
              const eventName = e.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
              const isRewardDeposit = e.type === "DEPOSIT_REWARDS";
              const shortAccount = e.by ? `${e.by.slice(0, 7)}...${e.by.slice(-4)}` : "Unknown";
              
              return (
                <li key={i} className="border-b border-border/30 pb-2 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isRewardDeposit ? 'text-green-400' : 'text-foreground'}`}>
                          {eventName}
                        </span>
                        {e.amount && (
                          <span className="text-foreground/70">
                            {isRewardDeposit ? `${e.amount} HBAR` : `${e.amount} shares`}
                          </span>
                        )}
                      </div>
                      {e.by && (
                        <div className="text-[10px] text-foreground/50 mt-1">
                          {isRewardDeposit ? 'Deposited by' : 'By'}: <span className="font-mono">{shortAccount}</span>
                        </div>
                      )}
                      <div className="text-[10px] text-foreground/40 mt-1">
                        {new Date(e.at).toLocaleString()}
                      </div>
                    </div>
                    <a 
                      href={e.txLink} 
                      className="text-accent underline text-[10px] whitespace-nowrap" 
                      target="_blank" 
                      rel="noreferrer"
                    >
                      View TX
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </main>
  );
}
