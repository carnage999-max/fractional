export type AssetCategory = "RWA" | "GAMING";
export interface Asset {
  id: string; name: string; description: string; image: string; category: AssetCategory;
  nftTokenId: string; fractionTokenId: string; distributor: string;
  pricePerShare: string; sharesTotal: number; sharesAvailable: number; apr?: string;
  metadataCid?: string | null; metadataFileId?: string | null; nftSerialNumber?: number | null;
  creator: string; createdAt: string;
}
export interface Holding { assetId: string; shares: number; pendingRewards: number; }
export interface ActivityEvent {
  type:
    | "MINT_NFT"
    | "CREATE_FT"
    | "BUY_SHARES"
    | "DEPOSIT_REWARDS"
    | "CLAIM_REWARDS"
    | "DEPLOY_CONTRACT"
    | "FRACTIONALIZE_NFT"
    | "TRANSFER_NFT"
    | "TRANSFER_FT"
    | "TRANSFER_NFT_FAILED"
    | "TRANSFER_FT_FAILED";
  by?: string;
  amount?: number | string;
  txLink: string;
  at: string;
  to?: string;
  error?: string;
}
