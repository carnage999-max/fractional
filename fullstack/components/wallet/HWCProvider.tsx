"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from "react";
import { safeDynamicImport } from "@/lib/safeImport";



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

// Global HashConnect instance to prevent double initialization
let globalHashConnect: any = null;
let isInitializing = false;

export default function HWCProvider({ children }: { children: React.ReactNode }) {
    const [hashConnect, setHashConnect] = useState<any>(null);
    const [accountId, setAccountId] = useState<string | null>(null);
    const [status, setStatus] = useState("init");
    const [isExtensionAvailable, setIsExtensionAvailable] = useState(false);
    const [pairing, setPairing] = useState<any>(null);
    const mounted = useRef(true);

    const waitForDomReady = () =>
        new Promise<void>((resolve) => {
            if (document.readyState === "complete") return resolve();
            const onReady = () => { resolve(); window.removeEventListener("load", onReady); };
            window.addEventListener("load", onReady);
        });

    useEffect(() => {
        mounted.current = true;

        // If we already have a global instance, reuse it
        if (globalHashConnect && !isInitializing) {
            console.log("[HWC] Reusing existing HashConnect instance");
            setHashConnect(globalHashConnect);
            setStatus("ready");
            return;
        }

        // Prevent multiple initializations
        if (isInitializing) {
            console.log("[HWC] Already initializing, waiting...");
            const checkReady = setInterval(() => {
                if (globalHashConnect && !isInitializing) {
                    console.log("[HWC] Using initialized instance");
                    setHashConnect(globalHashConnect);
                    setStatus("ready");
                    clearInterval(checkReady);
                }
            }, 100);
            return () => clearInterval(checkReady);
        }

        isInitializing = true;

        (async () => {
            try {
                console.log("[HWC] Starting initialization...");
                setStatus("loading");

                // Wait for DOM to be ready
                await waitForDomReady();
                // Wait until Next.js hydration completes
                await new Promise((r) => setTimeout(r, 300));
                console.log("[HWC] Next.js hydration completed");

                // Initialize HashConnect (supports both extension and WalletConnect)  
                const { HashConnect } = await safeDynamicImport(() => import("hashconnect"));
                const { LedgerId } = await safeDynamicImport(() => import("@hashgraph/sdk"));

                const appMeta = {
                    name: "Fractional",
                    description: "RWA & NFTs on Hedera",
                    icons: [window.location.origin + "/logo.svg"],
                    url: window.location.origin,
                };

                // Get WalletConnect configuration
                const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
                const relayUrl = process.env.NEXT_PUBLIC_WC_RELAY_URL || "wss://relay.walletconnect.com";

                console.log("[HWC] Creating HashConnect instance...");
                console.log("[HWC] Project ID from env:", projectId);
                console.log("[HWC] Relay URL from env:", relayUrl);

                let hc;
                if (projectId) {
                    console.log("[HWC] Initializing with WalletConnect support using Project ID:", projectId);
                    try {
                        hc = new HashConnect(
                            LedgerId.TESTNET, // network
                            projectId, // walletconnect project id from env
                            appMeta, // metadata
                            true // debug mode enabled for troubleshooting
                        );
                    } catch (e) {
                        console.warn("[HWC] Failed to create HashConnect with WalletConnect, falling back to extension-only", e);
                        hc = new HashConnect(
                            LedgerId.TESTNET, // network
                            "", // empty project id to disable WalletConnect
                            appMeta, // metadata
                            true // debug mode enabled for troubleshooting
                        );
                    }
                } else {
                    console.log("[HWC] No Project ID found - initializing without WalletConnect (extension only)...");
                    // Initialize without WalletConnect support - extension only
                    hc = new HashConnect(
                        LedgerId.TESTNET, // network
                        "", // empty project id to disable WalletConnect
                        appMeta, // metadata
                        true // debug mode enabled for troubleshooting
                    );
                }

                console.log("[HWC] Setting up event listeners...");

                // Listen for pairing events (both extension and WalletConnect)
                hc.pairingEvent.on((data: any) => {
                    console.log("[HWC] Pairing established", data);
                    setPairing(data);
                    const id = data?.accountIds?.[0] || null;
                    setAccountId(id);
                    try {
                        localStorage.setItem("hashconnectData", JSON.stringify(data));
                    } catch { }
                    setStatus(`paired:${id || "unknown"}`);
                });

                // Listen for connection status changes
                hc.connectionStatusChangeEvent.on((status: any) => {
                    console.log("[HWC] Connection status changed", status);
                });

                console.log("[HWC] Initializing HashConnect...");
                // Initialize HashConnect with shorter timeout and retry logic
                try {
                    const initPromise = hc.init();
                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("HashConnect initialization timeout (5s)")), 5000)
                    );

                    await Promise.race([initPromise, timeoutPromise]);
                    console.log("[HWC] HashConnect initialized successfully");
                } catch (initError: any) {
                    if (initError?.name === "ChunkLoadError") {
                        console.warn("[HWC] Detected ChunkLoadError during init, forcing reload");
                        window.location.reload();
                        return;
                    }
                    console.warn("[HWC] Initial HashConnect init failed:", initError.message);

                    // If WalletConnect fails, try again with extension-only mode
                    if (projectId && (initError.message.includes("Failed to publish") || initError.message.includes("WebSocket") || initError.message.includes("timeout"))) {
                        console.log("[HWC] WalletConnect seems to be failing, retrying with extension-only mode...");
                        hc = new HashConnect(
                            LedgerId.TESTNET,
                            "", // Force extension-only mode
                            appMeta,
                            true
                        );

                        try {
                            await hc.init();
                            console.log("[HWC] Extension-only mode initialized successfully");
                        } catch (fallbackError) {
                            console.error("[HWC] Even extension-only mode failed:", fallbackError);
                            throw new Error(`Both WalletConnect and extension modes failed: ${fallbackError}`);
                        }
                    } else {
                        throw initError;
                    }
                }

                // Try to restore previous pairing
                const saved = localStorage.getItem("hashconnectData");
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        setPairing(parsed);
                        const id = parsed?.accountIds?.[0] || null;
                        if (id) {
                            setAccountId(id);
                            setStatus(`restored:${id}`);
                        }
                        console.log("[HWC] Restored previous pairing", parsed);
                    } catch (e) {
                        console.warn("[HWC] Failed to restore pairing", e);
                    }
                }

                // Check for HashPack extension availability
                try {
                    const extensionAvailable = !!(window as any)?.HashPackExtension || !!(window as any)?.hashpack;
                    setIsExtensionAvailable(extensionAvailable);
                    console.log("[HWC] HashPack extension available:", extensionAvailable);
                } catch (e) {
                    console.warn("[HWC] Failed to check extension availability", e);
                    setIsExtensionAvailable(false);
                }

                // Store globally and update state
                globalHashConnect = hc;
                setHashConnect(hc);
                setStatus("ready");
                isInitializing = false;
                console.log("[HWC] HashConnect ready");
            } catch (err) {
                console.error("[HWC] Initialization error", err);
                setStatus(`error:${err instanceof Error ? err.message : 'unknown'}`);
                isInitializing = false;
            }
        })();

        return () => {
            mounted.current = false;
        };
    }, []);

    const connectExtension = useCallback(async () => {
        console.log("[HWC] connectExtension called, hashConnect:", !!hashConnect);
        if (!hashConnect) {
            console.error("[HWC] HashConnect not initialized");
            setStatus("error:not_initialized");
            return;
        }
        setStatus("connecting:extension");
        try {
            console.log("[HWC] Attempting to connect via HashPack extension...");
            if (typeof hashConnect.openPairingModal === "function") {
                await hashConnect.openPairingModal();
                setStatus("connecting:extension_modal_open");
                console.log("[HWC] Pairing modal opened for extension flow");
            } else {
                throw new Error("HashConnect.openPairingModal is not available");
            }
        } catch (e: any) {
            console.error("[HWC] Extension connect error", e);
            setStatus(`error:${e?.message || e}`);
        }
    }, [hashConnect]);

    // Connect via WalletConnect modal (for mobile wallets)
    const connect = useCallback(async () => {
        console.log("[HWC] connect called, hashConnect:", !!hashConnect, "status:", status);

        if (!hashConnect) {
            console.warn("[HWC] HashConnect not ready when connect called");
            setStatus("error:not_initialized");
            return;
        }

        // Check if WalletConnect is configured
        const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
        console.log("[HWC] Checking Project ID for WalletConnect:", projectId);
        if (!projectId) {
            console.warn("[HWC] WalletConnect not configured - extension only mode");
            setStatus("error:walletconnect_not_configured - Please use HashPack extension or configure WalletConnect");
            return;
        }

        setStatus("connecting:modal");
        try {
            console.log("[HWC] Attempting to open WalletConnect pairing modal...");
            if (typeof hashConnect.openPairingModal !== "function") {
                throw new Error("HashConnect.openPairingModal is not available");
            }

            await hashConnect.openPairingModal();
            setStatus("connecting:modal_opened");
            console.log("[HWC] WalletConnect pairing modal opened successfully");
        } catch (e: any) {
            console.error("[HWC] Modal connect error", e);
            console.error("[HWC] Error details:", {
                message: e.message,
                code: e.code,
                stack: e.stack,
                cause: e.cause
            });

            if (e.message && e.message.includes("Failed to publish payload")) {
                console.error("[HWC] WalletConnect payload publish failed - network or configuration issue");
                setStatus("error:WalletConnect network issue - try HashPack extension instead");
            } else if (e.message && e.message.includes("WebSocket")) {
                setStatus("error:Network connectivity issue - try HashPack extension");
            } else if (e.message && e.message.includes("project")) {
                setStatus("error:WalletConnect project configuration issue");
            } else {
                setStatus(`error:${e?.message || e}`);
            }
        }
    }, [hashConnect, status]);

    const disconnect = useCallback(async () => {
        try {
            if (pairing && hashConnect) {
                try {
                    await hashConnect.disconnect(pairing.topic);
                } catch (e) {
                    console.warn("[HWC] Disconnect failed", e);
                }
            }

            // Clear local storage
            try {
                localStorage.removeItem("hashconnectData");
            } catch (e) {
                console.warn("[HWC] Failed to clear storage", e);
            }

            setPairing(null);
            setAccountId(null);
            setStatus("disconnected");
        } catch (e) {
            console.error("[HWC] Disconnect error", e);
            setStatus("disconnected");
        }
    }, [hashConnect, pairing]);

    const signAndExecute = useCallback(async (txBase64: string) => {
        if (!hashConnect || !accountId || !pairing?.topic) {
            throw new Error("Wallet not connected");
        }

        setStatus("tx:signing");
        try {
            const result = await hashConnect.sendTransaction(pairing.topic, {
                byteArray: txBase64,
                metadata: { accountToSign: accountId, returnTransaction: false }
            } as any);

            if (!result?.receipt) {
                throw new Error("No receipt returned");
            }

            setStatus("tx:submitted");
            return result.receipt?.transactionId || "";
        } catch (e: any) {
            setStatus("tx:error");
            throw new Error(`Transaction failed: ${e?.message || e}`);
        }
    }, [accountId, hashConnect, pairing]);

    const value = useMemo(() => ({
        accountId,
        connect,
        connectExtension,
        disconnect,
        signAndExecute,
        status,
        isExtensionAvailable
    }), [accountId, connect, connectExtension, disconnect, signAndExecute, status, isExtensionAvailable]);

    return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}