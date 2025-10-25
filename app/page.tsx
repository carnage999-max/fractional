import { Button } from "@/components/ui/Button";
import FeatureCard from "@/components/FeatureCard";
import AssetCard from "@/components/AssetCard";
import { Coins, Lock, Rocket, Sparkles } from "lucide-react";
import { Asset } from "@/lib/types";
import { getBaseUrl } from "@/lib/baseUrl";
async function getFeatured(): Promise<Asset[]>{ const res=await fetch(`${getBaseUrl()}/api/assets?limit=3`,{cache:"no-store"}); try{ return (await res.json()).items as Asset[];}catch{return[];}}
export default async function Page(){
  const items=await getFeatured();
  return (<main className="mx-auto max-w-7xl px-4">
    <section className="relative grid gap-8 py-16 md:grid-cols-2 md:py-24">
      <div className="z-10 space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          <Sparkles className="h-3.5 w-3.5"/> Built on Hedera — Fast, Green, Final
        </div>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">Own a piece of the world — one token at a time.</h1>
        <p className="max-w-xl text-base text-foreground/80">Tokenize real-world assets and in-game items. Fractionalize ownership, unlock liquidity, and automate payouts — all with predictable, low fees.</p>
        <div className="flex flex-wrap gap-3"><a href="/assets"><Button>Launch App</Button></a><a href="/create"><Button variant="ghost">List Asset</Button></a></div>
      </div>
      <div className="relative"><div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card/70 p-6 shadow-innerglow">
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between"><span className="text-foreground/70">Asset</span><span className="font-semibold">Solar Array #001</span></div>
          <div className="flex items-center justify-between"><span className="text-foreground/70">Fraction Price</span><span className="font-semibold">$0.50</span></div>
          <div className="flex items-center justify-between"><span className="text-foreground/70">APR</span><span className="font-semibold">12%</span></div>
          <div className="pt-2"><a href="/assets"><Button className="w-full">Buy Shares</Button></a></div>
        </div></div>
      </div>
    </section>
    <section id="features" className="space-y-6 py-8">
      <h2 className="text-xl font-bold">Why Fractional?</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureCard icon={<Coins className="h-5 w-5 text-accent"/>} title="Micro-Ownership" desc="Invest from as little as $1 with tokenized fractions via HTS."/>
        <FeatureCard icon={<Lock className="h-5 w-5 text-accent"/>} title="Trustless Payouts" desc="Smart contracts handle pro-rata rewards in HBAR or tokens."/>
        <FeatureCard icon={<Rocket className="h-5 w-5 text-accent"/>} title="Fast & Low Cost" desc="Hedera finality in seconds and predictable fees."/>
        <FeatureCard icon={<Sparkles className="h-5 w-5 text-accent"/>} title="Web3 Native" desc="Seamless wallet connect, NFTs + FTs, and on-chain proofs."/>
      </div>
    </section>
    <section id="assets" className="space-y-6 py-8">
      <h2 className="text-xl font-bold">Featured Assets</h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((a)=>(<AssetCard key={a.id} item={a}/>))}</div>
    </section>
    <section className="mb-20 rounded-3xl border border-accent/30 bg-accent/10 p-8 text-center shadow-glow">
      <h3 className="text-2xl font-extrabold">Ready to tokenize?</h3>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-foreground/80">Create an asset, fractionalize ownership, and invite your community to co‑own and earn.</p>
      <div className="mt-4 flex justify-center gap-3"><a href="/create"><Button>Get Started</Button></a><a href="/assets"><Button variant="outline">Explore</Button></a></div>
    </section>
  </main>);
}
