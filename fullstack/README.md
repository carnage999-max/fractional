# Fractional (Testnet Demo)

- Next.js App Router (frontend + API)
- HashConnect + HashPack wallet pairing
- Hedera SDK server helpers
- Mirror Node reads
- Testnet-first: set `HEDERA_NETWORK=testnet`

## Setup
1) `cp .env.local.example .env.local` and fill `OPERATOR_ID`, `OPERATOR_KEY`
2) `npm install`
3) `npm run dev`

## Endpoints
- `POST /api/hedera/create/ft` { name, symbol, decimals, initialSupply }
- `POST /api/rpc/compose/token-associate` { tokenId, account }
- `POST /api/rpc/compose/ft-transfer` { tokenId, sender, recipient, amount }
- `POST /api/rpc/submit` { signedB64 }
- Rewards (HBAR): `POST /api/rewards/deposit`, `POST /api/rewards/claim`
- Mirror: `GET /api/mirror/account/[id]`

*This demo uses an in-memory DB; restart clears state.*
