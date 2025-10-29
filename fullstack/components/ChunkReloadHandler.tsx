"use client"

import { useEffect, useState } from "react";

export default function ChunkReloadHandler() {
  const [info, setInfo] = useState<{ msg?: string; url?: string; status?: number | string; details?: string } | null>(null);

  useEffect(() => {
    let handled = false;

    const unregisterSW = async () => {
      try {
        if (typeof navigator !== "undefined" && 'serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
        }
      } catch (_) {}
    };

    const tryReload = async () => {
      if (handled) return;
      try {
        await unregisterSW();
      } catch (_) {}
      try {
        sessionStorage.setItem("_chunk_reload", "1");
      } catch (_) {}
      handled = true;
      window.location.reload();
    };

    const fetchInfo = async (url: string) => {
      try {
        const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
        const headers: Record<string,string> = {};
        res.headers.forEach((v,k) => headers[k] = v);
        const length = headers['content-length'] || String((await res.clone().text()).length);
        setInfo((s) => ({ ...(s || {}), status: res.status, details: `content-type:${headers['content-type'] || ''} content-length:${length}` }));
      } catch (err: any) {
        setInfo((s) => ({ ...(s || {}), status: 'fetch-failed', details: String(err?.message || err) }));
      }
    };

    const onError = (ev: ErrorEvent | PromiseRejectionEvent) => {
      const msg = (ev && ((ev as any).message || (ev as any).reason?.message)) || "";
      if (typeof msg === "string" && /Loading chunk [0-9]+ failed|Loading chunk .* failed/i.test(msg)) {
        try {
          if (sessionStorage.getItem("_chunk_reload") === "1") return;
        } catch (_) {}
        // try to extract URL from message
        const urlMatch = msg.match(/https?:\/\/[^)\s]+/);
        const url = urlMatch ? urlMatch[0] : undefined;
        console.warn("Detected chunk load failure", { msg, url });
        setInfo({ msg, url, status: 'detected' });
        if (url) fetchInfo(url);
        // do not automatically reload right away — show UI so user can inspect and choose to reload
      }
    };

    window.addEventListener("error", onError as EventListener);
    window.addEventListener("unhandledrejection", onError as EventListener);

    return () => {
      window.removeEventListener("error", onError as EventListener);
      window.removeEventListener("unhandledrejection", onError as EventListener);
    };
  }, []);

  if (!info) return null;

  return (
    <div style={{position:'fixed',right:12,top:12,zIndex:9999,background:'#111827',color:'#fff',padding:'12px 16px',borderRadius:8,boxShadow:'0 6px 18px rgba(0,0,0,0.4)',maxWidth:520,fontSize:13}}>
      <div style={{fontWeight:600,marginBottom:6}}>A static chunk failed to load</div>
      <div style={{marginBottom:8,whiteSpace:'pre-wrap',opacity:0.9}}>{info.msg}</div>
      {info.url && <div style={{marginBottom:8}}>URL: <a href={info.url} target="_blank" rel="noreferrer" style={{color:'#93c5fd'}}>{info.url}</a></div>}
      {info.status && <div style={{marginBottom:8}}>Status: {String(info.status)}</div>}
      {info.details && <div style={{marginBottom:8}}>Details: {info.details}</div>}
      <div style={{display:'flex',gap:8}}>
        {info.url && <button onClick={() => { fetch(info.url!, {cache:'no-store', credentials:'same-origin'}).then(r=>r.text().then(t=>{console.log('fetched length', t.length); alert('fetch OK, length='+t.length)})).catch(e=>{alert('fetch failed: '+e)}) }} style={{background:'#065f46',color:'#fff',border:'none',padding:'6px 10px',borderRadius:6}}>Retry fetch</button>}
        <button onClick={() => { try { sessionStorage.setItem('_chunk_reload','1') } catch(_){}; if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) { navigator.serviceWorker.getRegistrations().then(regs=>regs.forEach(r=>r.unregister())).finally(()=>window.location.reload()) } else { window.location.reload() } }} style={{background:'#0ea5e9',color:'#000',border:'none',padding:'6px 10px',borderRadius:6}}>Reload (unregister SW)</button>
      </div>
    </div>
  );
}
