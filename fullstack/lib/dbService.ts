import type { ActivityEvent } from "./types";
import {
  addActivity as registryAddActivity,
  createAssetRecord,
  getAssetById,
  listActivities,
  listAssets,
  updateAssetRecord,
} from "./assetRegistry";

export const dbService = {
  async getAssets(limit?: number, search?: string) {
    return listAssets(limit, search);
  },
  getAssetById,
  createAsset: createAssetRecord,
  async setAssetDistributor(assetId: string, distributorAccount: string) {
    await updateAssetRecord(assetId, { distributor: distributorAccount });
  },
  async getHoldings() {
    return [];
  },
  async updateHolding() {
    throw new Error("Holdings are derived from Hedera balances; local mutations are disabled.");
  },
  getActivities: listActivities,
  async addActivity(assetId: string, activity: Omit<ActivityEvent, "at"> & { at?: string }) {
    const at = activity.at ?? new Date().toISOString();
    await registryAddActivity(assetId, { ...activity, at });
  },
  async seed() {
    console.warn("Seed skipped: backend operates without a database.");
  },
};