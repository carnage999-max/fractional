"use client";
import { Button } from "@/components/ui/Button";
import { useWallet } from "@/components/wallet/HashConnectProvider";
import { useEffect, useState } from "react";

type Asset = {
  id: string; name: string; description: string; image: string;
  fractionTokenId: string; sharesAvailable: number; pricePerShare: string;
};

type ActivityEvent = { type: string; txLink: string; at: string; };

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function AssetDetail({ params }: { params: { id: string } }) {
  const { accountId, signAndSubmit } = useWallet();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [amount, setAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const a = await fetchJSON(`/api/assets/${params.id}`);
      setAsset(a.item);
      const act = await fetchJSON(`/api/activity?assetId=${params.id}`);
      setActivity(act.events);
    })();
  }, [params.id]);

  const buy = async () => {
    if (!asset) return;
    if (!accountId) { setMsg("Connect your wallet first."); return; }
    if (amount <= 0) { setMsg("Enter a valid share amount."); return; }
    try {
      setLoading(true); setMsg(null);
      const body = {
        tokenId: asset.fractionTokenId || process.env.DEMO_FT_TOKEN_ID,
        sender: "0.0.issuer",         // demo treasury; replace in real flow
        recipient: accountId,
        amount: Math.floor(Number(amount)),
      };
      const composed = await fetchJSON("/api/rpc/compose/ft-transfer", { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(body) });
      const signed = await signAndSubmit(composed.bytes);
      setMsg(`Submitted: ${signed.txId}`);
    } catch (e:any) {
      setMsg(e.message || "Failed to buy");
    } finally {
      setLoading(false);
    }
  };

  if (!asset) return <main className="mx-auto max-w-7xl px-4 py-10">Loading...</main>;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 grid gap-8 md:grid-cols-2">
      <section className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow">
        <div className="h-64 w-full bg-muted/80 rounded-2xl flex items-center justify-center">Image</div>
        <h1 className="mt-4 text-2xl font-bold">{asset.name}</h1>
        <p className="text-sm text-foreground/80">{asset.description}</p>
      </section>
      <section className="space-y-4">
        <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow">
          <div className="flex items-center justify-between"><span className="text-sm text-foreground/70">Price per share</span><span className="font-semibold">${asset.pricePerShare}</span></div>
          <div className="flex items-center justify-between"><span className="text-sm text-foreground/70">Available</span><span className="font-semibold">{asset.sharesAvailable}</span></div>
          <div className="mt-4 space-y-2">
            <input value={amount || ""} onChange={(e)=>setAmount(Number(e.target.value))} placeholder="Amount of shares" className="w-full rounded-2xl bg-muted/80 border border-border px-3 py-2 text-foreground placeholder:text-foreground/40"/>
            <Button className="w-full" disabled={loading} onClick={buy}>{loading? "Processing..." : "Buy Shares"}</Button>
            {msg && <p className="text-xs text-foreground/80 mt-2">{msg}</p>}
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow">
          <h3 className="font-semibold mb-3">Activity</h3>
          <ul className="space-y-2 text-sm">{activity.map((e,i)=>(<li key={i} className="flex items-center justify-between"><span>{e.type}</span><a href={e.txLink} className="text-accent underline">tx</a></li>))}</ul>
        </div>
      </section>
    </main>
  );
}
