import { pgTable, text, integer, decimal, timestamp, serial, primaryKey } from "drizzle-orm/pg-core";

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  image: text("image").notNull(),
  category: text("category").notNull(), // "RWA" | "GAMING"
  nftTokenId: text("nft_token_id").notNull(),
  fractionTokenId: text("fraction_token_id").notNull(),
  distributor: text("distributor").notNull(),
  pricePerShare: decimal("price_per_share", { precision: 10, scale: 2 }).notNull(),
  sharesTotal: integer("shares_total").notNull(),
  sharesAvailable: integer("shares_available").notNull(),
  apr: text("apr"),
  creator: text("creator").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const holdings = pgTable("holdings", {
  id: serial("id").primaryKey(),
  accountId: text("account_id").notNull(),
  assetId: text("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  shares: integer("shares").notNull().default(0),
  pendingRewards: decimal("pending_rewards", { precision: 10, scale: 2 }).notNull().default("0"),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  assetId: text("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // "MINT_NFT"|"CREATE_FT"|"BUY_SHARES"|"DEPOSIT_REWARDS"|"CLAIM_REWARDS"
  by: text("by"), // account that performed the action
  amount: text("amount"), // could be number or string
  txLink: text("tx_link").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Index for common queries
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type Holding = typeof holdings.$inferSelect;
export type NewHolding = typeof holdings.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;