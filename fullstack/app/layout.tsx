import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import dynamic from "next/dynamic";
import ToastProvider from "@/components/ui/ToastProvider";
const ChunkReloadHandler = dynamic(() => import("@/components/ChunkReloadHandler"), { ssr: false });

const HWCProvider = dynamic(() => import("@/components/wallet/HWCProvider"), { ssr: false });


export const metadata: Metadata = {
  title: "Fractional • Hedera RWA & NFTs",
  description: "Tokenize assets, fractionalize ownership, automate payouts. Built on Hedera.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* CRITICAL: Unregister all service workers immediately on EVERY page load to prevent stale cache */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(regs){
                regs.forEach(function(r){ r.unregister(); });
              }).catch(function(){});
            }
          })();
        ` }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_10%,rgba(34,197,94,0.15),transparent_60%)]" />
        {/* Inline early-error handler: detect webpack chunk load failures and reload once */}
        <script dangerouslySetInnerHTML={{ __html: `(() => {
          try { if (sessionStorage.getItem('_chunk_reload') === '1') return; } catch(e) {}
          function doReload(){
            try{ sessionStorage.setItem('_chunk_reload','1'); }catch(e){}
            location.reload();
          }
          window.addEventListener('error', function(ev){
            try{
              var m = (ev && (ev.message || (ev.error && ev.error.message))) || '';
              if (/Loading chunk/.test(String(m))) { doReload(); }
            } catch(e){}
          });
          window.addEventListener('unhandledrejection', function(ev){
            try{
              var m = (ev && ev.reason && ev.reason.message) || '';
              if (/Loading chunk/.test(String(m))) { doReload(); }
            } catch(e){}
          });
        })();` }} />
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
