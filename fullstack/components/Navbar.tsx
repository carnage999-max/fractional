"use client";
import Link from "next/link";
import WalletConnectButton from "./WalletConnectButton";
import Image from 'next/image';

const NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || "testnet").toUpperCase();

export default function Navbar(){
  return (
    <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b border-border">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image className="inline-block h-8 w-8 rounded-xl shadow-glow" src="/logo.png" alt="Logo" width={32} height={32} />
          <span className="text-sm font-mono tracking-widest text-accent uppercase">Fractional</span>
        </Link>
        <div className="hidden gap-6 md:flex">
          <Link href="/assets" className="text-sm text-foreground/80 hover:text-foreground">Assets</Link>
          <Link href="/create" className="text-sm text-foreground/80 hover:text-foreground">Create</Link>
          <Link href="/fractionalize" className="text-sm text-foreground/80 hover:text-foreground">Fractionalize</Link>
          <Link href="/portfolio" className="text-sm text-foreground/80 hover:text-foreground">Portfolio</Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent md:inline-flex">
            {NETWORK} ONLY
          </span>
          <WalletConnectButton/>
        </div>
      </nav>
    </header>
  );
}
