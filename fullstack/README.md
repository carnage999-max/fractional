# Fractional (Testnet Demo)

Full-stack Fractional RWA demo running on the Hedera testnet.

- Next.js App Router (frontend + API)
- HashConnect + HashPack wallet & WalletConnect v2 pairing
- Hedera SDK utilities for NFT + FT minting, distributor contract deployment, and rewards
- HFS-backed asset registry (no database required)
- Pinata IPFS uploads and Mirror Node reads

## Prerequisites

- Node.js 18.17+ (Next.js 14 requirement)
- An operator account on Hedera testnet (ID + private key)
- Pinata JWT with `pinFileToIPFS` scope (or adjust `lib/ipfs.ts` to use another IPFS pinning service)
- (Optional) Pre-create an HFS file for the asset registry and store its ID in `ASSET_REGISTRY_FILE_ID`

## Environment variables

Create `.env.local` at the repo root using the template below. All variables without a default are required.

| Variable | Purpose |
| --- | --- |
| `OPERATOR_ID` | Hedera testnet account ID used as treasury + operator |
| `OPERATOR_KEY` | Private key for the operator account |
| `OPERATOR_EVM_KEY` *(optional)* | 64-byte ECDSA private key used when deploying the DividendDistributor via ethers. Falls back to `OPERATOR_KEY` when unset. |
| `PINATA_JWT` | Pinata JWT for uploading metadata + assets to IPFS |
| `ASSET_REGISTRY_FILE_ID` *(optional)* | Hedera File Service ID that stores the asset/index registry. Leave empty to auto-create on first write and copy the logged value back into `.env.local`. |
| `HEDERA_NETWORK` *(optional)* | Overrides network for server code (`testnet` by default) |
| `MIRROR_NODE_URL` *(optional)* | Custom Mirror Node REST endpoint (defaults to Hedera public testnet) |
| `APP_URL` *(optional)* | Public base URL used in server-rendered links |
| `NEXT_PUBLIC_APP_URL` *(optional)* | Client-side base URL; falls back to `APP_URL` |
| `NEXT_PUBLIC_HEDERA_NETWORK` *(optional)* | Network badge + client usage (`testnet` default) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` *(optional)* | WalletConnect cloud project for mobile wallets |
| `NEXT_PUBLIC_WC_RELAY_URL` *(optional)* | WalletConnect relay (defaults to `wss://relay.walletconnect.com`) |
| `SMART_CONTRACT_ARTIFACT_DIR` *(optional)* | Absolute or relative path to the `smart contract/artifacts` directory. Useful when deploying to platforms like AWS Amplify. Defaults to `../smart contract/artifacts`. |

## Setup & local development

```bash
npm install
cp .env.local.example .env.local  # then edit with your secrets
npm run dev
```

- Visit `http://localhost:3000` and connect with HashPack (extension or WalletConnect).
- Use the **Create** page to mint an NFT + fractional FT pair. Metadata is uploaded to Pinata + Hedera File Service.
- Rewards can be deposited via the asset detail page and claimed from the Portfolio view.

## Asset registry persistence

On the first asset creation the server will automatically create a JSON registry file in Hedera File Service (HFS) if `ASSET_REGISTRY_FILE_ID` is unset. The generated file ID is printed to the server logs—copy that value into `.env.local` so subsequent deploys keep using the same registry. You can also create an empty JSON file in advance and place its ID in `ASSET_REGISTRY_FILE_ID` to skip the auto-create path.

## Quality gates

Run the same checks we use for demo readiness:

```bash
npm run lint
npm run build
npm --prefix . run start  # ensure the production server boots (Ctrl+C to stop)
```

Warnings during `npm run build` about dynamic routes are expected—the API handlers require runtime context and stay dynamic.

## Deploying to AWS Amplify

1. **Connect the repository** and set `fullstack/` as the app root when prompted by Amplify.
2. **Add the environment variables** listed above (at least `OPERATOR_ID`, `OPERATOR_KEY`, `PINATA_JWT`, WalletConnect IDs, and `SMART_CONTRACT_ARTIFACT_DIR=./smart-contract/artifacts`). Mark secrets as protected.
3. **Amplify uses** the included [`amplify.yml`](./amplify.yml) build spec:
	- Installs dependencies with `npm ci`.
	- Copies `../smart contract/artifacts` into `./smart-contract/artifacts` so server code can read the ABI/bytecode at runtime.
	- Runs `npm run build` to produce the Next.js output.
4. Trigger a build and verify that minting an asset, buying shares, and fractionalizing work against your configured Hedera network.

If you adjust the Solidity contracts later, run `npx hardhat compile` inside `smart contract/` and commit the refreshed `artifacts/` before pushing to Amplify.

## Key API routes

- `POST /api/assets` – Mint NFT + fractional FT, deploy distributor contract, store metadata
- `POST /api/assets/fractionalize` – Wrap a wallet-owned NFT into fractional shares
- `POST /api/rewards/deposit` – Deposit HBAR rewards into the distributor contract
- `POST /api/rewards/claim` – Compose a wallet-signed claim transaction
- Mirror helpers: `GET /api/mirror/account/[id]`, `GET /api/mirror/account/[id]/nfts`
- RPC helpers: `POST /api/rpc/compose/token-associate`, `POST /api/rpc/compose/ft-transfer`, `POST /api/rpc/submit`

## Troubleshooting

- **WalletConnect payload publish errors:** double-check `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and network connectivity. The provider automatically falls back to extension-only mode when WalletConnect fails.
- **Mirror Node timeouts:** set `MIRROR_NODE_URL` to a self-hosted mirror or try again—the public testnet endpoint occasionally rate limits.
- **Operator account insufficient balance:** minting NFTs and deploying contracts consume HBAR; fund your operator via [Hedera Faucet](https://portal.hedera.com/register). 

Happy fractionalizing!
