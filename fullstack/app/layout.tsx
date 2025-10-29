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
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(60%_60%_at_50%_10%,rgba(34,197,94,0.15),transparent_60%)]" />
        {/* Inline early-error handler: detect webpack chunk load failures and reload once (unregister SW) */}
        <script dangerouslySetInnerHTML={{ __html: `(() => {
          try { if (sessionStorage.getItem('_chunk_reload') === '1') return; } catch(e) {}
          function unregisterAndReload(){
            try {
              if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(regs=>{
                  regs.forEach(r=>{ try{ r.unregister(); }catch(e){} });
                }).finally(()=>{
                  try{ sessionStorage.setItem('_chunk_reload','1'); }catch(e){}
                  location.reload(true);
                });
              } else {
                try{ sessionStorage.setItem('_chunk_reload','1'); }catch(e){}
                location.reload(true);
              }
            } catch(e){ try{ sessionStorage.setItem('_chunk_reload','1'); }catch(_){}; location.reload(true); }
          }
          window.addEventListener('error', function(ev){
            try{
              var m = (ev && (ev.message || (ev.error && ev.error.message))) || '';
              if (/Loading chunk/.test(String(m))) { unregisterAndReload(); }
            } catch(e){}
          });
          window.addEventListener('unhandledrejection', function(ev){
            try{
              var m = (ev && ev.reason && ev.reason.message) || '';
              if (/Loading chunk/.test(String(m))) { unregisterAndReload(); }
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
