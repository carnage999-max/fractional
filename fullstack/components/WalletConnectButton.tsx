"use client";
import { Button } from "./ui/Button";
import { useWallet } from "./wallet/HWCProvider";
import { Wallet, Zap } from "lucide-react";
import { useState } from "react";

export default function WalletConnectButton() {
  const { accountId, connect, connectExtension, disconnect, status, isExtensionAvailable } = useWallet();
  const [showOptions, setShowOptions] = useState(false);

  console.log("[WalletButton] State:", { accountId, status, isExtensionAvailable, showOptions });

  if (accountId) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={disconnect}>
          {accountId} (Disconnect)
        </Button>
        <span className="text-xs text-foreground/60">{status}</span>
      </div>
    );
  }

  // If extension is available, show both options
  if (isExtensionAvailable && !showOptions) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={connectExtension}>
          <Zap className="mr-2 h-4 w-4" /> HashPack
        </Button>
        <Button variant="ghost" onClick={() => setShowOptions(true)}>
          More options
        </Button>
        <span className="text-xs text-foreground/60">{status}</span>
      </div>
    );
  }

  // Show all options
  if (showOptions) {
    return (
      <div className="flex items-center gap-2">
        {isExtensionAvailable && (
          <Button variant="outline" onClick={connectExtension}>
            <Zap className="mr-2 h-4 w-4" /> HashPack Extension
          </Button>
        )}
        <Button variant="outline" onClick={connect}>
          <Wallet className="mr-2 h-4 w-4" /> Other Wallets
        </Button>
        <Button variant="ghost" onClick={() => setShowOptions(false)}>
          ←
        </Button>
        <span className="text-xs text-foreground/60">{status}</span>
      </div>
    );
  }

  // Fallback to WalletConnect modal only
  return (
    <div className="flex items-center gap-2">
      <Button 
        variant="outline" 
        onClick={() => {
          console.log("[WalletButton] Connect clicked, calling connect()");
          connect();
        }}
      >
        <Wallet className="mr-2 h-4 w-4" /> Connect Wallet
      </Button>
      <span className="text-xs text-foreground/60">
        {status.includes("error:") ? (
          <span className="text-red-500">
            {status.replace("error:", "Error: ")}
          </span>
        ) : status.includes("walletconnect") ? "Extension Only" : status}
      </span>
    </div>
  );
}
