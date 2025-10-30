export const MIRROR = process.env.MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com/api/v1";

export async function mirrorFetch(path: string) {
  const url = `${MIRROR}${path}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Mirror error ${res.status}`);
  return res.json();
}

export async function getAccount(accountId: string) {
  const data = await mirrorFetch(`/accounts/${accountId}`);
  console.log(`[mirror] getAccount(${accountId}) response:`, JSON.stringify(data, null, 2).substring(0, 500));
  console.log(`[mirror] Tokens array length:`, data?.tokens?.length || 0);
  console.log(`[mirror] Balance object:`, data?.balance);
  return data;
}

export async function getAccountTokenBalance(accountId: string, tokenId: string): Promise<number> {
  const data = await getAccount(accountId);
  // Tokens are nested inside balance object in mirror node API v1
  const tokens = data?.balance?.tokens ?? data?.tokens ?? [];
  const token = tokens.find((t: any) => t.token_id === tokenId);
  if (!token) return 0;
  return Number(token.balance || 0);
}

export async function getHBARBalanceTinybar(accountId: string): Promise<number> {
  const data = await getAccount(accountId);
  return Number(data?.balance?.balance || 0); // tinybars
}
