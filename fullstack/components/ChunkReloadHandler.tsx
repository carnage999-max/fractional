"use client"

import { useEffect } from "react";

export default function ChunkReloadHandler() {
  useEffect(() => {
    let handled = false;

    const tryReload = () => {
      if (handled) return;
      try {
        // Unregister any service workers to avoid serving stale files
        if (typeof navigator !== "undefined" && 'serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((regs) => {
            regs.forEach((r) => r.unregister());
          }).catch(() => {});
        }
      } catch (_) {}
      // mark so we only reload once to avoid loops
      try {
        sessionStorage.setItem("_chunk_reload", "1");
      } catch (_) {}
      handled = true;
      // perform a full reload
      window.location.reload();
    };

    const onError = (ev: ErrorEvent | PromiseRejectionEvent) => {
      const msg = (ev && ((ev as any).message || (ev as any).reason?.message)) || "";
      if (typeof msg === "string" && /Loading chunk [0-9]+ failed|Loading chunk .* failed/i.test(msg)) {
        // avoid immediate reload if we've already reloaded once
        try {
          if (sessionStorage.getItem("_chunk_reload") === "1") return;
        } catch (_) {}
        console.warn("Detected chunk load failure, reloading to recover...");
        tryReload();
      }
    };

    window.addEventListener("error", onError as EventListener);
    window.addEventListener("unhandledrejection", onError as EventListener);

    return () => {
      window.removeEventListener("error", onError as EventListener);
      window.removeEventListener("unhandledrejection", onError as EventListener);
    };
  }, []);

  return null;
}
