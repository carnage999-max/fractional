import { NextRequest, NextResponse } from "next/server";
import { getAssetRecord } from "@/lib/assetRegistry";
import { getClient } from "@/lib/hedera";
import { ContractCallQuery, ContractId } from "@hashgraph/sdk";

export const dynamic = 'force-dynamic';

/**
 * Get reward statistics for an asset
 * GET /api/rewards/stats?assetId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get("assetId");

    if (!assetId) {
      return NextResponse.json({ error: "assetId is required" }, { status: 400 });
    }

    const asset = await getAssetRecord(assetId);
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    if (!asset.distributor) {
      return NextResponse.json({ error: "Asset has no distributor contract" }, { status: 400 });
    }

    const client = getClient();
    const contractId = ContractId.fromString(asset.distributor);

    // Query contract for total HBAR distributed
    let totalHbarDistributed = 0;
    let contractHbarBalance = 0;

    try {
      // Call totalHbarDistributed() view function
      const distributedQuery = new ContractCallQuery()
        .setContractId(contractId)
        .setGas(100000)
        .setFunction("totalHbarDistributed");

      const distributedResult = await distributedQuery.execute(client);
      totalHbarDistributed = distributedResult.getUint256(0).toNumber() / 100_000_000; // Convert tinybars to HBAR

      // Call getContractHbarBalance() view function
      const balanceQuery = new ContractCallQuery()
        .setContractId(contractId)
        .setGas(100000)
        .setFunction("getContractHbarBalance");

      const balanceResult = await balanceQuery.execute(client);
      contractHbarBalance = balanceResult.getUint256(0).toNumber() / 100_000_000; // Convert tinybars to HBAR
    } catch (err) {
      console.warn("[reward-stats] Failed to query contract:", err);
      // Fall back to activity-based calculation
      const depositActivities = asset.activities?.filter(a => a.type === "DEPOSIT_REWARDS") || [];
      totalHbarDistributed = depositActivities.reduce((sum, a) => sum + Number(a.amount || 0), 0);
    }

    // Calculate APY
    // APY = (Total Rewards / Asset Value) * (365 / Days Since Creation) * 100
    let estimatedAPY = 0;
    try {
      const assetValue = Number(asset.pricePerShare) * asset.sharesTotal;
      const daysSinceCreation = (Date.now() - new Date(asset.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      
      if (assetValue > 0 && daysSinceCreation > 0 && totalHbarDistributed > 0) {
        // Assume 1 HBAR ≈ $0.05 for rough USD conversion (you can make this dynamic)
        const HBAR_USD_RATE = 0.05;
        const rewardsInUSD = totalHbarDistributed * HBAR_USD_RATE;
        const annualizedRewards = (rewardsInUSD / daysSinceCreation) * 365;
        estimatedAPY = (annualizedRewards / assetValue) * 100;
      }
    } catch (err) {
      console.warn("[reward-stats] Failed to calculate APY:", err);
    }

    // Get deposit history from activities
    const depositHistory = asset.activities
      ?.filter(a => a.type === "DEPOSIT_REWARDS")
      .map(a => ({
        depositor: a.by || "unknown",
        amount: Number(a.amount || 0),
        timestamp: a.at,
        txLink: a.txLink,
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) || [];

    return NextResponse.json({
      ok: true,
      assetId,
      distributor: asset.distributor,
      statistics: {
        totalHbarDistributed: Number(totalHbarDistributed.toFixed(6)),
        contractHbarBalance: Number(contractHbarBalance.toFixed(6)),
        totalHbarClaimed: Number((totalHbarDistributed - contractHbarBalance).toFixed(6)),
        estimatedAPY: Number(estimatedAPY.toFixed(2)),
        depositCount: depositHistory.length,
        lastDepositAt: depositHistory[0]?.timestamp || null,
      },
      depositHistory: depositHistory.slice(0, 10), // Last 10 deposits
    });
  } catch (error: any) {
    console.error("Error fetching reward stats:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch reward stats" }, { status: 500 });
  }
}
