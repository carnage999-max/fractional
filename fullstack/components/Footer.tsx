import Link from "next/link";
export default function Footer(){
  return (<footer className="border-t border-border/60">
    <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-foreground/70">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <p>© {new Date().getFullYear()} Fractional — Built on Hedera</p>
        <div className="flex items-center gap-4">
          <Link href="https://hashscan.io" className="hover:text-foreground" target="_blank">HashScan</Link>
          <Link href="https://github.com/Fractional-three/fractional" className="hover:text-foreground">GitHub</Link>
        </div>
      </div>
    </div>
  </footer>);
}
