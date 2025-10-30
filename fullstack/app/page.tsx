import { Button } from "@/components/ui/Button";
import FeatureCard from "@/components/FeatureCard";
import AssetCard from "@/components/AssetCard";
import { Coins, Lock, Rocket, Sparkles, ArrowRight, Shield, Globe, Users } from "lucide-react";
import { Asset } from "@/lib/types";
import { getBaseUrl } from "@/lib/baseUrl";

async function getFeatured(): Promise<Asset[]> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/assets?limit=3`, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[home] Failed to load featured assets: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json().catch((error) => {
      console.error("[home] Failed to parse featured assets response", error);
      return null;
    });

    if (!data || !Array.isArray(data.items)) {
      console.warn("[home] Featured assets response missing items array");
      return [];
    }

    return data.items as Asset[];
  } catch (error) {
    console.error("[home] Unexpected error loading featured assets", error);
    return [];
  }
}

export default async function Page() {
  const items = await getFeatured();
  
  return (
    <div>
      <main className="relative mx-auto max-w-7xl px-4 z-10">
        <section className="relative grid gap-8 py-16 md:grid-cols-2 md:py-24">
          <div className="z-10 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <Sparkles className="h-3.5 w-3.5"/> Built on Hedera — Fast, Green, Final
            </div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight md:text-6xl bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">
              Own a piece of the world — one token at a time.
            </h1>
            <p className="max-w-xl text-lg text-foreground/80">
              Tokenize real-world assets and in-game items. Fractionalize ownership, unlock liquidity, and automate payouts — all with predictable, low fees.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="/assets">
                <Button size="lg" className="text-base">
                  Launch App <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="/create">
                <Button variant="outline" size="lg" className="text-base">
                  List Asset
                </Button>
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card/70 backdrop-blur-sm p-6 shadow-innerglow">
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-foreground/70">Asset</span>
                  <span className="font-semibold">Solar Array #001</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground/70">Fraction Price</span>
                  <span className="font-semibold text-accent">$0.50</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground/70">APR</span>
                  <span className="font-semibold text-green-400">12%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-foreground/70">Total Value</span>
                  <span className="font-semibold">$2.5M</span>
                </div>
                <div className="pt-3">
                  <a href="/assets">
                    <Button className="w-full">Buy Shares</Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="space-y-8 py-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Why Choose Fractional?</h2>
            <p className="text-foreground/70 max-w-2xl mx-auto">
              Built on Hedera for unmatched speed, sustainability, and cost-effectiveness.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard 
              icon={<Coins className="h-6 w-6 text-accent"/>} 
              title="Micro-Ownership" 
              desc="Invest from as little as $1 with tokenized fractions via Hedera Token Service."
            />
            <FeatureCard 
              icon={<Lock className="h-6 w-6 text-accent"/>} 
              title="Trustless Payouts" 
              desc="Smart contracts automatically distribute rewards proportionally."
            />
            <FeatureCard 
              icon={<Rocket className="h-6 w-6 text-accent"/>} 
              title="Lightning Fast" 
              desc="Hedera's hashgraph consensus delivers 3-5 second finality."
            />
            <FeatureCard 
              icon={<Shield className="h-6 w-6 text-accent"/>} 
              title="Enterprise Security" 
              desc="Bank-grade security with aBFT consensus."
            />
            <FeatureCard 
              icon={<Globe className="h-6 w-6 text-accent"/>} 
              title="Carbon Negative" 
              desc="Hedera is the most sustainable DLT."
            />
            <FeatureCard 
              icon={<Users className="h-6 w-6 text-accent"/>} 
              title="Community Driven" 
              desc="Join a global community of fractional owners."
            />
          </div>
        </section>

        <section id="assets" className="space-y-8 py-16">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Featured Assets</h2>
            <p className="text-foreground/70">
              Discover high-quality assets carefully curated by our team.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <AssetCard key={a.id} item={a} />
            ))}
          </div>
        </section>

        <section className="mb-20 rounded-3xl border border-accent/30 bg-gradient-to-r from-accent/10 to-accent/5 p-12 text-center shadow-glow">
          <h3 className="text-3xl font-extrabold mb-4">Ready to tokenize your future?</h3>
          <p className="mx-auto max-w-2xl text-lg text-foreground/80 mb-8">
            Join thousands of investors and asset owners building the future of fractional ownership.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <a href="/create">
              <Button size="lg" className="text-base">
                Get Started <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
            <a href="/assets">
              <Button variant="outline" size="lg" className="text-base">
                Explore Assets
              </Button>
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
