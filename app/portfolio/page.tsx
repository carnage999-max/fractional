import { Button } from "@/components/ui/Button";
import { Holding } from "@/lib/types";

import { getBaseUrl } from "@/lib/baseUrl";

async function getPortfolio(owner: string): Promise<Holding[]> {
  const res = await fetch(`${getBaseUrl()}/api/portfolio?owner=${owner}`, { cache: "no-store" });
  const data = await res.json();
  return data.holdings as Holding[];
}

async function getAccount(accountId: string) {
  const res = await fetch(`${getBaseUrl()}/api/mirror/account/${accountId}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function PortfolioPage() {
  const owner = "0.0.user"; // demo
  const holdings = await getPortfolio(owner);
  const acct = await getAccount(owner);

  const tiny = acct?.balance?.balance || 0;
  const hbar = (tiny / 100_000_000).toFixed(4);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">My Portfolio</h1>

      <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground/70">HBAR Balance</p>
            <p className="text-xl font-bold">{hbar} HBAR</p>
          </div>
          <a href="https://hashscan.io/testnet" target="_blank" className="text-accent underline">View on HashScan</a>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow">
        <table className="w-full text-sm">
          <thead className="text-foreground/70">
            <tr><th className="text-left p-2">Asset</th><th className="text-right p-2">Shares</th><th className="text-right p-2">Pending (HBAR)</th><th className="text-right p-2">Action</th></tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => (
              <tr key={i} className="border-t border-border/60">
                <td className="p-2">{h.assetId}</td>
                <td className="p-2 text-right">{h.shares}</td>
                <td className="p-2 text-right">{h.pendingRewards.toFixed(2)}</td>
                <td className="p-2 text-right">
                  <form action="/api/rewards/claim" method="post">
                    <input type="hidden" name="assetId" value={h.assetId} />
                    <input type="hidden" name="owner" value={owner} />
                    <Button type="submit">Claim</Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
