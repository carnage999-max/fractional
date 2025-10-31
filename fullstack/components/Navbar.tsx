"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import WalletConnectButton from "./WalletConnectButton";

const NETWORK = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || "testnet").toUpperCase();

const NAV_ITEMS = [
  { href: "/assets", label: "Assets" },
  { href: "/create", label: "Create" },
  { href: "/fractionalize", label: "Fractionalize" },
  { href: "/portfolio", label: "Portfolio" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image className="inline-block h-8 w-8 rounded-xl shadow-glow" src="/logo.png" alt="Logo" width={32} height={32} />
          <span className="text-sm font-mono uppercase tracking-widest text-accent">Fractional</span>
        </Link>

        <div className="hidden gap-6 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-foreground/80 hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center justify-center rounded-md border border-border p-2 text-foreground transition-colors hover:bg-accent/10 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="hidden rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent md:inline-flex">
            {NETWORK} ONLY
          </span>
          <WalletConnectButton />
        </div>
      </nav>

      <div
        className={`md:hidden overflow-hidden border-t border-border transition-all duration-200 ${
          open ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="inline-flex w-max rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            {NETWORK} ONLY
          </span>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-accent/10"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
