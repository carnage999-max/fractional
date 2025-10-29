import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import dynamic from "next/dynamic";
import ToastProvider from "@/components/ui/ToastProvider";
import dynamic from "next/dynamic";
const ChunkReloadHandler = dynamic(() => import("@/components/ChunkReloadHandler"), { ssr: false });

const HWCProvider = dynamic(() => import("@/components/wallet/HWCProvider"), { ssr: false });


export const metadata: Metadata = {
  title: "Fractional • Hedera RWA & NFTs",
  description: "Tokenize assets, fractionalize ownership, automate payouts. Built on Hedera.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_10%,rgba(34,197,94,0.15),transparent_60%)]" />
        {/* Wrap the entire app including Navbar so the provider actually mounts on the client */}
        <HWCProvider>
          <ToastProvider>
            <ChunkReloadHandler />
            <Navbar />
            {children}
          </ToastProvider>
        </HWCProvider>
        <Footer />
      </body>
    </html>
  );
}
