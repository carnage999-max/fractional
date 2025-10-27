"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/components/wallet/HWCProvider";
import { useToast } from "@/components/ui/ToastProvider";

type HoldingRow = {
  assetId: string;
  name: string;
  shares: number;
  pendingHbar: string;
  pendingTinybars: string;
  distributor: string;
  fractionTokenId: string;
  pricePerShare: string;
  metadataCid: string | null;
};

export default function PortfolioPage() {
  const { accountId, connect, connectExtension, signAndExecute, status } = useWallet();
  const toast = useToast();
  const [balanceHbar, setBalanceHbar] = useState<string>("0");
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimFeedback, setClaimFeedback] = useState<Record<string, { message: string; link?: string; error?: boolean }>>({});

  const hasWallet = !!accountId;

  const fetchPortfolio = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portfolio?account=${accountId}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `Failed to load portfolio (${res.status})`);
      }

      setBalanceHbar(Number(json.balanceHbar || 0).toFixed(6));
      setHoldings(json.holdings || []);
    } catch (err: any) {
      setError(err?.message || "Failed to fetch portfolio");
      setHoldings([]);
      toast.error(err?.message || "Failed to fetch portfolio");
    } finally {
      setLoading(false);
    }
  }, [accountId, toast]);

  useEffect(() => {
    if (accountId) {
      fetchPortfolio();
    }
  }, [accountId, fetchPortfolio]);

  const claimRewards = useCallback(async (asset: HoldingRow) => {
    if (!accountId) {
      setClaimFeedback((prev) => ({
        ...prev,
        [asset.assetId]: { message: "Connect your wallet first", error: true },
      }));
      return;
    }

    setClaiming(asset.assetId);
    setClaimFeedback((prev) => ({ ...prev, [asset.assetId]: { message: "Preparing claim..." } }));

    try {
      const composeRes = await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.assetId, accountId }),
      });
      const composeJson = await composeRes.json();
      if (!composeRes.ok) {
        throw new Error(composeJson?.error || "Failed to prepare claim");
      }

      const txId = await signAndExecute(composeJson.bytes);
      const hashscan = composeJson.expectedHashscan || `https://hashscan.io/testnet/transaction/${txId}`;

      await fetch("/api/rewards/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "record",
          assetId: asset.assetId,
          accountId,
          txId,
          txLink: hashscan,
          amountHbar: composeJson.pendingHbar,
        }),
      });

      setClaimFeedback((prev) => ({
        ...prev,
        [asset.assetId]: { message: `Claimed ${composeJson.pendingHbar} HBAR`, link: hashscan },
      }));
      toast.success(`Claimed ${Number(composeJson.pendingHbar || "0").toFixed(6)} HBAR`);

      await fetchPortfolio();
    } catch (err: any) {
      setClaimFeedback((prev) => ({
        ...prev,
        [asset.assetId]: { message: err?.message || "Claim failed", error: true },
      }));
      toast.error(err?.message || "Failed to claim rewards");
    } finally {
      setClaiming(null);
    }
  }, [accountId, fetchPortfolio, signAndExecute, toast]);

  const connectButtons = useMemo(() => (
    <div className="flex gap-3">
      <Button onClick={connectExtension}>Connect HashPack</Button>
      <Button variant="ghost" onClick={connect}>WalletConnect</Button>
    </div>
  ), [connect, connectExtension]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Portfolio</h1>
        {!hasWallet && connectButtons}
      </div>

      {hasWallet && (
        <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground/70">HBAR Balance</p>
            <p className="text-xl font-bold">{balanceHbar} HBAR</p>
            <p className="text-xs text-foreground/50">Wallet status: {status}</p>
          </div>
          <a href={`https://hashscan.io/testnet/account/${accountId}`} target="_blank" className="text-accent underline" rel="noreferrer">View on HashScan</a>
        </div>
      )}

      {!hasWallet && (
        <div className="rounded-3xl border border-dashed border-accent/40 bg-card/60 p-6 text-center text-sm text-foreground/70">
          Connect your Hedera wallet to see on-chain holdings and pending rewards.
        </div>
      )}

      {hasWallet && (
        <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow">
          {loading ? (
            <p className="text-sm text-foreground/70">Loading portfolio...</p>
          ) : error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : holdings.length === 0 ? (
            <p className="text-sm text-foreground/60">You don&apos;t have any fractional holdings yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-foreground/70">
                <tr>
                  <th className="text-left p-2">Asset</th>
                  <th className="text-right p-2">Shares</th>
                  <th className="text-right p-2">Pending (HBAR)</th>
                  <th className="text-right p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => {
                  const pending = Number(holding.pendingHbar || "0");
                  const feedback = claimFeedback[holding.assetId];
                  return (
                    <tr key={holding.assetId} className="border-t border-border/60">
                      <td className="p-2">
                        <div className="flex flex-col">
                          <span className="font-medium">{holding.name}</span>
                          <span className="text-xs text-foreground/60">{holding.assetId}</span>
                        </div>
                      </td>
                      <td className="p-2 text-right">{holding.shares.toLocaleString()}</td>
                      <td className="p-2 text-right">{pending.toFixed(6)}</td>
                      <td className="p-2 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            size="sm"
                            onClick={() => claimRewards(holding)}
                            disabled={pending <= 0 || claiming === holding.assetId}
                          >
                            {claiming === holding.assetId ? "Claiming..." : "Claim"}
                          </Button>
                          {feedback && (
                            <span className={`text-xs ${feedback.error ? "text-red-400" : "text-foreground/70"}`}>
                              {feedback.message}
                              {feedback.link && (
                                <>
                                  {" "}
                                  <a href={feedback.link} className="text-accent underline" target="_blank" rel="noreferrer">
                                    HashScan
                                  </a>
                                </>
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </main>
  );
}
