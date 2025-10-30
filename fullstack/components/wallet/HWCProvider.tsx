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
                    console.log("[HWC] Pairing topic:", data?.topic);
                    console.log("[HWC] Pairing metadata:", data?.metadata);
                    
                    // Detect if this is an extension connection based on metadata URL
                    const isExtension = data?.metadata?.url?.includes('chrome-extension://') || 
                                       data?.metadata?.name === 'HashPack';
                    console.log("[HWC] Is extension connection:", isExtension);
                    
                    if (isExtension) {
                        setIsExtensionAvailable(true);
                    }
                    
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
                        
                        // Detect if restored pairing is from extension
                        const isExtension = parsed?.metadata?.url?.includes('chrome-extension://') || 
                                           parsed?.metadata?.name === 'HashPack';
                        console.log("[HWC] Restored pairing is extension:", isExtension);
                        
                        if (isExtension) {
                            setIsExtensionAvailable(true);
                        }
                        
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
                    let extensionAvailable = !!(window as any)?.HashPackExtension || !!(window as any)?.hashpack;
                    
                    // Also check localStorage for extension connection
                    const savedData = localStorage.getItem("hashconnectData");
                    if (savedData) {
                        try {
                            const parsed = JSON.parse(savedData);
                            const isExtension = parsed?.metadata?.url?.includes('chrome-extension://') || 
                                               parsed?.metadata?.name === 'HashPack';
                            if (isExtension) {
                                extensionAvailable = true;
                            }
                        } catch {}
                    }
                    
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
        console.log("[HWC] signAndExecute called", { 
            hasHashConnect: !!hashConnect, 
            accountId, 
            hasPairing: !!pairing,
            pairingTopic: pairing?.topic,
            isExtensionAvailable
        });
        
        if (!hashConnect || !accountId) {
            throw new Error("Wallet not connected");
        }
        
        // Check if this is a WalletConnect session without proper mobile wallet connection
        if (!isExtensionAvailable && !pairing?.topic) {
            throw new Error("Please install HashPack browser extension from https://hashpack.app or use a mobile wallet with WalletConnect");
        }
        
        // For extension connections, we don't need a topic - the extension handles it
        let topic = pairing?.topic;
        const isExtensionConnection = isExtensionAvailable && !topic;
        
        console.log("[HWC] Connection type:", isExtensionConnection ? "Extension" : "WalletConnect");
        
        if (!isExtensionConnection && !topic) {
            console.warn("[HWC] No pairing topic in state, checking hashConnect internals");
            
            // Check the WalletConnect SignClient for active sessions
            const signClient = (hashConnect as any)._signClient;
            console.log("[HWC] signClient:", signClient);
            
            if (signClient?.session) {
                const sessions = signClient.session.getAll();
                console.log("[HWC] Active sessions:", sessions);
                
                if (sessions && sessions.length > 0) {
                    topic = sessions[0].topic;
                    console.log("[HWC] Using session topic:", topic);
                }
            }
        }
        
        if (!isExtensionConnection && !topic) {
            throw new Error("No active wallet connection topic found. Please reconnect your wallet.");
        }

        setStatus("tx:signing");
        try {
            console.log("[HWC] Attempting to send transaction");
            console.log("[HWC] Connection type:", isExtensionConnection ? "Extension" : "WalletConnect");
            console.log("[HWC] Topic:", topic);
            console.log("[HWC] AccountId:", accountId);
            
            let result;
            
            if (isExtensionConnection) {
                // For extension connections, we need to use the request method
                console.log("[HWC] Sending transaction via extension...");
                
                // Import Transaction from Hedera SDK to deserialize
                const { Transaction } = await import('@hashgraph/sdk');
                
                // Deserialize the transaction from base64
                const txBytes = Buffer.from(txBase64, 'base64');
                const transaction = Transaction.fromBytes(txBytes);
                console.log("[HWC] Deserialized transaction:", transaction);
                
                // Try to get the extension signer
                const signer = (hashConnect as any).getSigner?.(accountId);
                console.log("[HWC] Extension signer:", signer);
                
                if (signer && typeof signer.call === 'function') {
                    console.log("[HWC] Using extension signer.call method with Transaction object");
                    // Use the signer's call method with the Transaction object
                    result = await signer.call(transaction);
                    console.log("[HWC] Signer call result:", result);
                } else {
                    throw new Error("Extension signer not available");
                }
            } else {
                // For WalletConnect sessions, use the topic
                console.log("[HWC] Sending transaction via WalletConnect...");
                try {
                    result = await hashConnect.sendTransaction(topic, {
                        byteArray: txBase64,
                        metadata: { accountToSign: accountId, returnTransaction: false }
                    } as any);
                } catch (sendError: any) {
                    console.error("[HWC] sendTransaction failed:", sendError);
                    
                    // If sendTransaction fails, try using the request method directly
                    console.log("[HWC] Trying alternative request method...");
                    const signClient = (hashConnect as any)._signClient;
                    
                    if (signClient && typeof signClient.request === 'function') {
                        result = await signClient.request({
                            topic: topic,
                            chainId: 'hedera:testnet',
                            request: {
                                method: 'hedera_signAndExecuteTransaction',
                                params: {
                                    signerAccountId: accountId,
                                    transactionBytes: txBase64
                                }
                            }
                        });
                        console.log("[HWC] Alternative request result:", result);
                    } else {
                        throw sendError;
                    }
                }
            }
            
            console.log("[HWC] Transaction result:", result);
            console.log("[HWC] Result keys:", result ? Object.keys(result) : 'null');
            console.log("[HWC] Result type:", typeof result);
            
            // Extension signer returns the executed transaction directly
            let txId = "";
            
            if (result?.transactionId) {
                txId = result.transactionId.toString();
            } else if (result?.receipt?.transactionId) {
                txId = result.receipt.transactionId.toString();
            } else if (result?.response?.transactionId) {
                txId = result.response.transactionId.toString();
            } else if (typeof result === 'object' && result !== null) {
                // Try to extract transaction ID from the result object
                const resultStr = JSON.stringify(result);
                console.log("[HWC] Result as JSON:", resultStr);
                txId = result.toString?.() || "Transaction submitted successfully";
            }
            
            if (!txId) {
                console.warn("[HWC] Could not extract transaction ID, but transaction likely succeeded");
                txId = "Transaction submitted successfully";
            }

            setStatus("tx:submitted");
            console.log("[HWC] Final Transaction ID:", txId);
            return txId;
        } catch (e: any) {
            console.error("[HWC] Transaction error:", e);
            setStatus("tx:error");
            
            // If session error, prompt reconnect
            if (e?.message?.includes("session") || e?.message?.includes("Signer")) {
                throw new Error(`Wallet session expired. Please disconnect and reconnect your wallet. (${e?.message})`);
            }
            
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