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

    console.log("[portfolio] Account:", account);
    console.log("[portfolio] Total assets in registry:", assets.length);
    console.log("[portfolio] Tokens from mirror node:", accountInfo?.tokens?.length || 0);

    const tokenBalances = new Map<string, number>();
    // Tokens are nested inside balance object in mirror node response
    const tokens = accountInfo?.balance?.tokens ?? accountInfo?.tokens ?? [];
    for (const token of tokens) {
      if (token?.token_id) {
        const balance = Number(token.balance || 0);
        tokenBalances.set(token.token_id, balance);
        console.log(`[portfolio] Token ${token.token_id}: ${balance}`);
      }
    }

    console.log("[portfolio] Token balances map:", Object.fromEntries(tokenBalances));
    console.log("[portfolio] Asset fraction tokens:", assets.map(a => ({ id: a.id, name: a.name, fractionTokenId: a.fractionTokenId })));

    const assetsWithBalances = assets.filter((asset) => {
      const balance = tokenBalances.get(asset.fractionTokenId) ?? 0;
      console.log(`[portfolio] Checking asset ${asset.name} (${asset.fractionTokenId}): balance = ${balance}`);
      return balance > 0;
    });

    console.log("[portfolio] Assets with balances:", assetsWithBalances.length);

    const holdings = await Promise.all(
      assetsWithBalances
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
