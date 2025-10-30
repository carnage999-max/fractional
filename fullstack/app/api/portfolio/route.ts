import { NextRequest, NextResponse } from "next/server";
import { listAssets } from "@/lib/assetRegistry";
import { getAccount } from "@/lib/mirror";
import { getPendingHbarForAccount } from "@/lib/hedera";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const account = searchParams.get("account");

    if (!account) {
      return NextResponse.json({ error: "account is required" }, { status: 400 });
    }

    const [accountInfo, assets] = await Promise.all([
      getAccount(account),
      listAssets(1000),
    ]);

    const tokenBalances = new Map<string, number>();
    for (const token of accountInfo?.tokens ?? []) {
      if (token?.token_id) {
        tokenBalances.set(token.token_id, Number(token.balance || 0));
      }
    }

    const holdings = await Promise.all(
      assets
        .filter((asset) => tokenBalances.get(asset.fractionTokenId) ?? 0)
        .map(async (asset) => {
          const shares = tokenBalances.get(asset.fractionTokenId) ?? 0;
          let pendingTinybars = "0";
          let pendingHbar = "0";

          if (asset.distributor) {
            try {
              const pending = await getPendingHbarForAccount({
                contractId: asset.distributor,
                accountId: account,
              });
              pendingTinybars = pending.tinybars;
              pendingHbar = pending.hbar;
            } catch (err) {
              console.warn(`Failed to fetch pending rewards for ${asset.distributor}`, err);
            }
          }

          return {
            assetId: asset.id,
            name: asset.name,
            fractionTokenId: asset.fractionTokenId,
            distributor: asset.distributor,
            shares,
            pendingTinybars,
            pendingHbar,
            pricePerShare: asset.pricePerShare,
            metadataCid: asset.metadataCid ?? null,
          };
        })
    );

    const balanceTinybar = Number(accountInfo?.balance?.balance || 0);

    return NextResponse.json({
      accountId: account,
      balanceTinybar,
      balanceHbar: balanceTinybar / 100_000_000,
      holdings,
    });
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    return NextResponse.json({ error: "Failed to fetch portfolio" }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
