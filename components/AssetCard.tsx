import { Button } from "@/components/ui/Button";
import Image from "next/image";
import Link from "next/link";
import { Asset } from "@/lib/types";
export default function AssetCard({item}:{item:Asset}){
  return (<div className="group relative overflow-hidden rounded-3xl border border-border bg-card/70 shadow-innerglow">
    <div className="relative h-44 w-full">
      <Image src={item.image || "/logo.svg"} alt={item.name} fill className="object-contain p-6 opacity-90 group-hover:opacity-100 transition-opacity"/>
    </div>
    <div className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-foreground">{item.name}</h4>
        {item.apr && (<span className="rounded-full bg-accent/15 px-2 py-1 text-xs font-medium text-accent ring-1 ring-accent/30">APR {item.apr}%</span>)}
      </div>
      <div className="flex items-center justify-between text-sm text-foreground/80">
        <span>Shares: {item.sharesTotal.toLocaleString()}</span>
        <span>Price: ${item.pricePerShare}</span>
      </div>
      <div className="flex gap-2 pt-1">
        <Link href={`/asset/${item.id}`} className="w-full"><Button className="w-full">View</Button></Link>
      </div>
    </div>
    <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rotate-12 rounded-full bg-accent/10 blur-2xl"/>
  </div>);
}
