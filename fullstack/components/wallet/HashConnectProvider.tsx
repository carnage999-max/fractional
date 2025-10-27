"use client";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";

/** Extension-only (HashConnect v2) context */
type WalletContextType = {
  accountId: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signAndSubmit: (base64Tx: string) => Promise<{ txId: string }>;
  status: string;
};

const WalletContext = createContext<WalletContextType>({
  accountId: null,
  connect: async () => { },
  disconnect: () => { },
  signAndSubmit: async () => ({ txId: "" }),
  status: "idle",
});

export function useWallet() { return useContext(WalletContext); }

export default function HashConnectProvider({ children }: { children: React.ReactNode }) {
  const [hc, setHc] = useState<any>(null);
  const [pairing, setPairing] = useState<any>(null);
  const [status, setStatus] = useState<string>("init");
  const mounted = useRef(true);
  const accountId = pairing?.accountIds?.[0] || null;

  const log = (...a: any[]) => console.log("[Wallet(ext-only)]", ...a);

  const waitForDomReady = () =>
    new Promise<void>((resolve) => {
      if (document.readyState === "complete") return resolve();
      const onReady = () => { resolve(); window.removeEventListener("load", onReady); };
      window.addEventListener("load", onReady);
    });

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        setStatus("loading:dom");
        await waitForDomReady();

        setStatus("loading:import");
        const { HashConnect } = await import("hashconnect"); // v2

        const appMeta = {
          name: "Fractional",
          description: "RWA & NFTs on Hedera",
          icon: (typeof window !== "undefined" ? window.location.origin : "") + "/logo.svg",
        };
        const network = (process.env.NEXT_PUBLIC_HEDERA_NETWORK as string) || "testnet";

        setStatus("loading:init");
        // v2: new HashConnect(debug)
        const h = new (HashConnect as any)(true);

        // detect extension + pairing events
        h.foundExtensionEvent?.on((walletMeta: any) => {
          log("foundExtensionEvent", walletMeta);
          setStatus("extension:found");
        });

        h.pairingEvent.on((data: any) => {
          log("pairingEvent", data);
          setPairing(data);
          try { localStorage.setItem("hashconnectData", JSON.stringify(data)); } catch { }
          setStatus(`paired:${data?.accountIds?.[0] || ""}`);
        });

        h.connectionStatusChangeEvent?.on((s: any) => log("connectionStatus", s));

        // v2 init signature: init(appMeta, network, debug)
        await h.init(appMeta, network as any, true);

        // Restore old pairing (if present)
        const saved = localStorage.getItem("hashconnectData");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setPairing(parsed);
            setStatus(`paired:${parsed?.accountIds?.[0] || "unknown"}`);
            log("restored prior pairing", parsed);
          } catch { }
        }

        // Ask the extension to announce itself
        try {
          await h.findLocalWallets?.();
        } catch (e) {
          log("findLocalWallets error (ok on some versions)", e);
        }

        setHc(h);
        setStatus("ready");
        log("hashconnect v2 ready (extension-only)");
      } catch (e: any) {
        console.error("[Wallet(ext-only)] init error", e);
        setStatus(`error:${e?.message || e}`);
      }
    })();

    return () => { mounted.current = false; };
  }, []);

  const connect = useCallback(async () => {
    if (!hc) { setStatus("error:not_initialized"); return; }
    setStatus("connecting");
    try {
      // This triggers the HashPack browser extension pairing popup
      await hc.connectToLocalWallet?.();
      setStatus("connecting:requested");
    } catch (e: any) {
      console.error("[Wallet(ext-only)] connect error", e);
      setStatus(`error:${e?.message || e}`);
    }
  }, [hc]);

  const disconnect = useCallback(() => {
    try {
      localStorage.removeItem("hashconnectData");
      setPairing(null);
      setStatus("disconnected");
    } catch (e) {
      console.warn("disconnect failed", e);
    }
  }, []);

  // base64 -> extension sign+submit (same call shape on v2)
  const signAndSubmit = useCallback(async (base64Tx: string) => {
    if (!hc || !accountId || !pairing?.topic) throw new Error("Wallet not connected");
    setStatus("tx:signing");
    const res = await hc.sendTransaction(pairing.topic, {
      byteArray: base64Tx,
      metadata: { accountToSign: accountId, returnTransaction: false }
    } as any);
    if (!res?.receipt) throw new Error("No receipt returned");
    setStatus("tx:submitted");
    return { txId: res.receipt?.transactionId || "" };
  }, [accountId, hc, pairing]);

  const value = useMemo(
    () => ({ accountId, connect, disconnect, signAndSubmit, status }),
    [accountId, connect, disconnect, signAndSubmit, status]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
