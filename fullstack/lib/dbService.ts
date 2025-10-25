import { db } from "./database";
import { assets, holdings, activities } from "./schema";
import { eq, desc, like, and, sql } from "drizzle-orm";
import type { Asset, Holding, ActivityEvent } from "./types";

export class DatabaseService {
  // Assets
  async getAssets(limit = 100, search = ""): Promise<Asset[]> {
    let results;
    
    if (search) {
      results = await db.select().from(assets)
        .where(sql`lower(${assets.name}) like lower(${'%' + search + '%'})`)
        .orderBy(desc(assets.createdAt))
        .limit(limit);
    } else {
      results = await db.select().from(assets)
        .orderBy(desc(assets.createdAt))
        .limit(limit);
    }
    
    return results.map(asset => ({
      id: asset.id,
      name: asset.name,
      description: asset.description,
      image: asset.image,
      category: asset.category as "RWA" | "GAMING",
      nftTokenId: asset.nftTokenId,
      fractionTokenId: asset.fractionTokenId,
      distributor: asset.distributor,
      pricePerShare: asset.pricePerShare,
      sharesTotal: asset.sharesTotal,
      sharesAvailable: asset.sharesAvailable,
      apr: asset.apr || undefined,
      creator: asset.creator,
      createdAt: asset.createdAt.toISOString(),
    }));
  }

  async getAssetById(id: string): Promise<Asset | null> {
    const [result] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
    
    if (!result) return null;
    
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      image: result.image,
      category: result.category as "RWA" | "GAMING",
      nftTokenId: result.nftTokenId,
      fractionTokenId: result.fractionTokenId,
      distributor: result.distributor,
      pricePerShare: result.pricePerShare,
      sharesTotal: result.sharesTotal,
      sharesAvailable: result.sharesAvailable,
      apr: result.apr || undefined,
      creator: result.creator,
      createdAt: result.createdAt.toISOString(),
    };
  }

  async createAsset(asset: Omit<Asset, "createdAt">): Promise<Asset> {
    const [created] = await db.insert(assets).values({
      id: asset.id,
      name: asset.name,
      description: asset.description,
      image: asset.image,
      category: asset.category,
      nftTokenId: asset.nftTokenId,
      fractionTokenId: asset.fractionTokenId,
      distributor: asset.distributor,
      pricePerShare: asset.pricePerShare,
      sharesTotal: asset.sharesTotal,
      sharesAvailable: asset.sharesAvailable,
      apr: asset.apr,
      creator: asset.creator,
    }).returning();

    return {
      ...asset,
      createdAt: created.createdAt.toISOString(),
    };
  }

  // Holdings
  async getHoldings(accountId: string): Promise<Holding[]> {
    const results = await db.select().from(holdings).where(eq(holdings.accountId, accountId));
    
    return results.map(holding => ({
      assetId: holding.assetId,
      shares: holding.shares,
      pendingRewards: parseFloat(holding.pendingRewards),
    }));
  }

  async updateHolding(accountId: string, assetId: string, shares: number, pendingRewards: number) {
    const existing = await db.select().from(holdings)
      .where(and(eq(holdings.accountId, accountId), eq(holdings.assetId, assetId)))
      .limit(1);

    if (existing.length > 0) {
      await db.update(holdings)
        .set({
          shares: shares,
          pendingRewards: pendingRewards.toString(),
        })
        .where(and(eq(holdings.accountId, accountId), eq(holdings.assetId, assetId)));
    } else {
      await db.insert(holdings).values({
        accountId,
        assetId,
        shares,
        pendingRewards: pendingRewards.toString(),
      });
    }
  }

  // Activities
  async getActivities(assetId: string): Promise<ActivityEvent[]> {
    const results = await db.select().from(activities)
      .where(eq(activities.assetId, assetId))
      .orderBy(desc(activities.createdAt));
    
    return results.map(activity => ({
      type: activity.type as ActivityEvent["type"],
      by: activity.by || undefined,
      amount: activity.amount || undefined,
      txLink: activity.txLink,
      at: activity.createdAt.toISOString(),
    }));
  }

  async addActivity(assetId: string, activity: Omit<ActivityEvent, "at">) {
    await db.insert(activities).values({
      assetId,
      type: activity.type,
      by: activity.by,
      amount: activity.amount?.toString(),
      txLink: activity.txLink,
    });
  }

  // Seed data for development
  async seed() {
    // Check if we already have data
    const existingAssets = await db.select().from(assets).limit(1);
    if (existingAssets.length > 0) {
      console.log("Database already seeded");
      return;
    }

    console.log("Seeding database...");
    const now = new Date().toISOString();
    
    const seedAssets = [
      {
        id: "asset_001",
        name: "Community Solar Array",
        description: "Own fractions of a local solar mini-grid.",
        image: "/logo.svg",
        category: "RWA" as const,
        nftTokenId: "0.0.1001",
        fractionTokenId: "0.0.2001",
        distributor: "0xDistributor1",
        pricePerShare: "0.50",
        sharesTotal: 10000,
        sharesAvailable: 8200,
        apr: "12",
        creator: "0.0.issuer",
      },
      {
        id: "asset_002",
        name: "Indie Music Royalties",
        description: "Back a rising artist and share streaming revenue.",
        image: "/logo.svg",
        category: "RWA" as const,
        nftTokenId: "0.0.1002",
        fractionTokenId: "0.0.2002",
        distributor: "0xDistributor2",
        pricePerShare: "1.00",
        sharesTotal: 5000,
        sharesAvailable: 4300,
        apr: "8",
        creator: "0.0.issuer",
      },
      {
        id: "asset_003",
        name: "Gaming Skins Vault",
        description: "Tradable game cosmetics with revenue share on sales.",
        image: "/logo.svg",
        category: "GAMING" as const,
        nftTokenId: "0.0.1003",
        fractionTokenId: "0.0.2003",
        distributor: "0xDistributor3",
        pricePerShare: "0.25",
        sharesTotal: 20000,
        sharesAvailable: 20000,
        creator: "0.0.issuer",
      }
    ];

    // Insert assets
    await db.insert(assets).values(seedAssets);

    // Insert activities
    const seedActivities = [
      { assetId: "asset_001", type: "MINT_NFT", txLink: "#" },
      { assetId: "asset_001", type: "CREATE_FT", txLink: "#" },
      { assetId: "asset_002", type: "MINT_NFT", txLink: "#" },
      { assetId: "asset_002", type: "CREATE_FT", txLink: "#" },
      { assetId: "asset_003", type: "MINT_NFT", txLink: "#" },
      { assetId: "asset_003", type: "CREATE_FT", txLink: "#" },
    ];

    await db.insert(activities).values(seedActivities);
    console.log("Database seeded successfully");
  }
}

export const dbService = new DatabaseService();