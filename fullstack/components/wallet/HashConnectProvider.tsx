"use client";
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

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
  const accountId = pairing?.accountIds?.[0] || null;
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        setStatus("loading:import");
        // dynamic import only in browser
        const { HashConnect } = await import("hashconnect");
        setStatus("loading:init");

        const appMeta = {
          name: "Fractional",
          description: "RWA & NFTs on Hedera",
          icon: (typeof window !== "undefined" ? window.location.origin : "") + "/logo.svg",
        };

        // Use a browser-visible env for network; fall back to server or testnet
        const network =
          (process.env.NEXT_PUBLIC_HEDERA_NETWORK as string) ||
          (process.env.HEDERA_NETWORK as string) ||
          "testnet";

        const h = new HashConnect(network, appMeta, true);
        // init(appMeta, network, debug)
        await h.init(appMeta, network, true);
        if (!mounted.current) return;

        setHc(h);
        setStatus("ready");

        // restore prior session if present
        const saved = typeof localStorage !== "undefined" ? localStorage.getItem("hashconnectData") : null;
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setPairing(parsed);
            setStatus(`paired:${parsed?.accountIds?.[0] || "unknown"}`);
          } catch { }
        }

        // event logs (very helpful)
        h.foundExtensionEvent.on((walletMeta: any) => {
          console.log("[HashConnect] foundExtensionEvent", walletMeta);
          setStatus("extension:found");
        });
        h.pairingEvent.on((data: any) => {
          console.log("[HashConnect] pairingEvent", data);
          setPairing(data);
          if (typeof localStorage !== "undefined") localStorage.setItem("hashconnectData", JSON.stringify(data));
          setStatus(`paired:${data?.accountIds?.[0] || ""}`);
        });
        h.connectionStatusChangeEvent.on((s: any) => {
          console.log("[HashConnect] connectionStatus", s);
        });
      } catch (e: any) {
        console.error("[HashConnect] init error", e);
        setStatus(`error:${e?.message || e}`);
      }
    })();
    return () => { mounted.current = false; };
  }, []);

  const connect = async () => {
    if (!hc) { setStatus("error:not_initialized"); return; }
    setStatus("connecting");

    try {
      // First try to detect/open the local extension pairing
      const opened = await hc.connectToLocalWallet(); // hashpack extension
      // Some versions return void; rely on events instead:
      setStatus("connecting:requested");

      // Fallback after ~1s if no extension is detected
      setTimeout(() => {
        if (!pairing && mounted.current) {
          // Open download page as a nudge — user can install and retry
          window.open("https://www.hashpack.app/download", "_blank");
          setStatus("extension:not_found");
        }
      }, 1000);
    } catch (e: any) {
      console.error("[HashConnect] connect error", e);
      setStatus(`error:${e?.message || e}`);
    }
  };

  const disconnect = () => {
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem("hashconnectData");
      setPairing(null);
      setStatus("disconnected");
    } catch (e) {
      console.warn("disconnect failed", e);
    }
  };

  const signAndSubmit = async (base64Tx: string) => {
    if (!hc || !accountId || !pairing?.topic) throw new Error("Wallet not connected");
    setStatus("tx:signing");
    const res = await hc.sendTransaction(pairing.topic, {
      byteArray: base64Tx,
      metadata: { accountToSign: accountId, returnTransaction: false }
    } as any);
    if (!res?.receipt) throw new Error("No receipt returned");
    setStatus("tx:submitted");
    return { txId: res.receipt?.transactionId || "" };
  };

  const value = useMemo(() => ({ accountId, connect, disconnect, signAndSubmit, status }), [accountId, hc, pairing, status]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
