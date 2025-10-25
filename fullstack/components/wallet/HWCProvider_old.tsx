"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";

type Ctx = {
    accountId: string | null;
    connect: () => Promise<void>;
    connectExtension: () => Promise<void>;
    disconnect: () => Promise<void>;
    // Send a base64-encoded @hashgraph/sdk Transaction to be signed+executed
    signAndExecute: (txBase64: string) => Promise<string>; // returns txId
    status: string;
    isExtensionAvailable: boolean;
};

const WalletCtx = createContext<Ctx>({
    accountId: null,
    connect: async () => { },
    connectExtension: async () => { },
    disconnect: async () => { },
    signAndExecute: async () => "",
    status: "idle",
    isExtensionAvailable: false,
});

export const useWallet = () => useContext(WalletCtx);

export default function HWCProvider({ children }: { children: React.ReactNode }) {
    const [connector, setConnector] = useState<DAppConnector | null>(null);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [status, setStatus] = useState("init");
    const [isExtensionAvailable, setIsExtensionAvailable] = useState(false);
    const [hashConnect, setHashConnect] = useState<any>(null);
    const [extensionPairing, setExtensionPairing] = useState<any>(null);

    useEffect(() => {
        (async () => {
            try {
                setStatus("loading");
                
                // Initialize WalletConnect
                const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;
                if (!projectId) {
                    setStatus("error:missing_project_id");
                    console.error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required");
                    return;
                }

                const net = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || "testnet").toLowerCase();
                const ledger =
                    net === "mainnet" ? LedgerId.MAINNET :
                        net === "previewnet" ? LedgerId.PREVIEWNET :
                            LedgerId.TESTNET;

                const metadata = {
                    name: "Fractional",
                    description: "RWA & NFTs on Hedera",
                    url: window.location.origin,
                    icons: [window.location.origin + "/logo.svg"],
                };

                const d = new DAppConnector(
                    metadata,
                    ledger,
                    projectId,
                    Object.values(HederaJsonRpcMethod),
                    [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
                    [HederaChainId.Mainnet, HederaChainId.Testnet]
                );

                await d.init({ logger: "error" });

                // Listen for account changes from WalletConnect
                (d as any).on(HederaSessionEvent.AccountsChanged, (e: { accounts: { split: (arg0: string) => null[]; }[]; }) => {
                    const id = e?.accounts?.[0]?.split(":").pop() || null;
                    setAccountId(id);
                });

                // Check for existing WalletConnect session
                const sess = (d as any).getActiveSession?.() ?? (d as any).getSessions?.()?.[0] ?? (d as any).getSession?.();
                if (sess?.accounts?.length) {
                    const id = sess.accounts[0].split(":").pop() || null;
                    setAccountId(id);
                }

                setConnector(d);

                // Initialize HashConnect for extension detection
                try {
                    const { HashConnect } = await import("hashconnect");
                    const appMeta = {
                        name: "Fractional",
                        description: "RWA & NFTs on Hedera",
                        icon: window.location.origin + "/logo.svg",
                    };

                    const hc = new (HashConnect as any)(true);
                    
                    // Listen for extension detection
                    hc.foundExtensionEvent?.on((walletMeta: any) => {
                        console.log("[HWC] HashPack extension found", walletMeta);
                        setIsExtensionAvailable(true);
                    });

                    // Listen for extension pairing
                    hc.pairingEvent.on((data: any) => {
                        console.log("[HWC] Extension paired", data);
                        setExtensionPairing(data);
                        const id = data?.accountIds?.[0] || null;
                        setAccountId(id);
                        try { 
                            localStorage.setItem("hashconnectData", JSON.stringify(data)); 
                        } catch { }
                    });

                    await hc.init(appMeta, net as any, true);
                    
                    // Check for saved extension pairing
                    const saved = localStorage.getItem("hashconnectData");
                    if (saved) {
                        try {
                            const parsed = JSON.parse(saved);
                            setExtensionPairing(parsed);
                            const id = parsed?.accountIds?.[0] || null;
                            if (id) setAccountId(id);
                            console.log("[HWC] Restored extension pairing", parsed);
                        } catch { }
                    }

                    // Try to find HashPack extension
                    try {
                        await hc.findLocalWallets?.();
                    } catch (e) {
                        console.log("[HWC] Extension detection failed (normal if no extension)", e);
                    }

                    setHashConnect(hc);
                } catch (extensionError) {
                    console.log("[HWC] HashConnect extension init failed", extensionError);
                }

                setStatus("ready");
                console.log("[HWC] ready");
            } catch (err) {
                console.error("[HWC] init error", err);
                setStatus("error");
            }
        })();
    }, []);

    const connect = async () => {
        if (!connector) return;
        setStatus("connecting");
        // Opens the WalletConnect modal (QR / desktop deep-link)
        await connector.openModal();
        setStatus("pairing");
    };

    const connectExtension = async () => {
        if (!hashConnect) {
            setStatus("error:extension_not_available");
            return;
        }
        setStatus("connecting:extension");
        try {
            // This triggers the HashPack browser extension pairing popup
            await hashConnect.connectToLocalWallet?.();
            setStatus("connecting:extension_requested");
        } catch (e: any) {
            console.error("[HWC] extension connect error", e);
            setStatus(`error:${e?.message || e}`);
        }
    };

    const disconnect = async () => {
        try {
            // Disconnect WalletConnect if connected
            if (connector) {
                const topic =
                    (connector as any).getActiveSession?.()?.topic ??
                    (connector as any).getSessions?.()?.[0]?.topic ??
                    null;
                if (topic) {
                    await connector.disconnect(topic);
                } else {
                    await (connector as any).disconnect?.();
                }
            }

            // Clear extension pairing if connected
            if (extensionPairing) {
                try {
                    localStorage.removeItem("hashconnectData");
                    setExtensionPairing(null);
                } catch (e) {
                    console.warn("Failed to clear extension data", e);
                }
            }
        } finally {
            setAccountId(null);
            setStatus("disconnected");
        }
    };

    const signAndExecute = async (txBase64: string) => {
        if (!accountId) throw new Error("No wallet connected");

        // Try extension first if available
        if (extensionPairing && hashConnect) {
            setStatus("tx:signing:extension");
            const res = await hashConnect.sendTransaction(extensionPairing.topic, {
                byteArray: txBase64,
                metadata: { accountToSign: accountId, returnTransaction: false }
            } as any);
            if (!res?.receipt) throw new Error("No receipt returned from extension");
            setStatus("tx:submitted");
            return res.receipt?.transactionId || "";
        }

        // Fall back to WalletConnect
        if (connector) {
            setStatus("tx:signing:walletconnect");
            const result = await (connector as any).request(HederaJsonRpcMethod.SignAndExecuteTransaction, {
                transactionBytes: txBase64,
            });
            const txId = (result?.transactionId as string) || "";
            setStatus("tx:submitted");
            return txId;
        }

        throw new Error("No wallet connected");
    };

    const value = useMemo(() => ({ 
        accountId, 
        connect, 
        connectExtension, 
        disconnect, 
        signAndExecute, 
        status, 
        isExtensionAvailable 
    }), [accountId, connector, hashConnect, extensionPairing, status, isExtensionAvailable]);
    return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}
