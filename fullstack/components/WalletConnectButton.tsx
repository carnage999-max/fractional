"use client";
import { Button } from "./ui/Button";
import { useWallet } from "./wallet/HashConnectProvider";
import { Wallet } from "lucide-react";

export default function WalletConnectButton(){
  const { accountId, connect, disconnect } = useWallet();
  return accountId ? (
    <Button variant="outline" onClick={disconnect}>{accountId} (Disconnect)</Button>
  ) : (
    <Button variant="outline" onClick={connect}><Wallet className="mr-2 h-4 w-4"/> Connect</Button>
  );
}
