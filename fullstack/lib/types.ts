export type AssetCategory = "RWA" | "GAMING";
export interface Asset {
  id: string; name: string; description: string; image: string; category: AssetCategory;
  nftTokenId: string; fractionTokenId: string; distributor: string;
  pricePerShare: string; sharesTotal: number; sharesAvailable: number; apr?: string;
  creator: string; createdAt: string;
}
export interface Holding { assetId: string; shares: number; pendingRewards: number; }
export interface ActivityEvent { type: "MINT_NFT"|"CREATE_FT"|"BUY_SHARES"|"DEPOSIT_REWARDS"|"CLAIM_REWARDS"; by?: string; amount?: number|string; txLink: string; at: string; }
