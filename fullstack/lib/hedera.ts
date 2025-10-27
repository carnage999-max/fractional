import fs from "fs/promises";
import path from "path";
import {
  AccountId,
  Client,
  ContractCreateFlow,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  ContractCallQuery,
  FileAppendTransaction,
  FileCreateTransaction,
  FileId,
  FileUpdateTransaction,
  Hbar,
  PrivateKey,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenId,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  Transaction,
  TransactionId,
  TransferTransaction,
} from "@hashgraph/sdk";

type HederaNetwork = "mainnet" | "testnet" | "previewnet";

const NETWORK_FACTORIES: Record<HederaNetwork, () => Client> = {
  mainnet: Client.forMainnet,
  testnet: Client.forTestnet,
  previewnet: Client.forPreviewnet,
};

const HASHSCAN_BASE: Record<HederaNetwork, string> = {
  mainnet: "https://hashscan.io/mainnet",
  testnet: "https://hashscan.io/testnet",
  previewnet: "https://hashscan.io/previewnet",
};

let cachedClient: Client | null = null;
let cachedNetwork: HederaNetwork | null = null;
let cachedDistributorArtifact: { bytecode: string; abi: any } | null = null;
let cachedDistributorArtifactMtimeMs: number | null = null;

function resolveNetwork(): HederaNetwork {
  const fromEnv = (process.env.HEDERA_NETWORK || process.env.NEXT_PUBLIC_HEDERA_NETWORK || "testnet").toLowerCase();
  if (fromEnv === "mainnet" || fromEnv === "previewnet") return fromEnv;
  return "testnet";
}

export function getOperatorCredentials() {
  const operatorId = process.env.OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  if (!operatorId || !operatorKey) {
    throw new Error("Missing OPERATOR_ID/OPERATOR_KEY environment variables");
  }
  return {
    operatorId: AccountId.fromString(operatorId),
    operatorKey: PrivateKey.fromString(operatorKey),
  };
}

export function resetCachedClient() {
  cachedClient = null;
  cachedNetwork = null;
}

export function getClient(): Client {
  const network = resolveNetwork();

  if (cachedClient && cachedNetwork === network) {
    return cachedClient;
  }

  const factory = NETWORK_FACTORIES[network];
  if (!factory) {
    throw new Error(`Unsupported Hedera network: ${network}`);
  }

  const client = factory();
  const { operatorId, operatorKey } = getOperatorCredentials();
  client.setOperator(operatorId, operatorKey);

  cachedClient = client;
  cachedNetwork = network;

  return client;
}

export function getHashscanBaseUrl(): string {
  const network = cachedNetwork ?? resolveNetwork();
  return HASHSCAN_BASE[network];
}

export function toHashscanLink(type: "token" | "contract" | "account" | "transaction", id: string) {
  const base = getHashscanBaseUrl();
  return `${base}/${type}/${id}`;
}

export async function composeFtTransfer({
  tokenId,
  sender,
  recipient,
  amount,
}: {
  tokenId: string;
  sender: string;
  recipient: string;
  amount: number;
}) {
  const client = getClient();
  const tid = TokenId.fromString(tokenId);

  const tx = new TransferTransaction()
    .addTokenTransfer(tid, sender, -amount)
    .addTokenTransfer(tid, recipient, amount);

  const transactionId = TransactionId.generate(sender);
  tx.setTransactionId(transactionId);

  const frozen = await tx.freezeWith(client);
  const bytes = frozen.toBytes();
  return { bytes: Buffer.from(bytes).toString("base64"), transactionId: transactionId.toString() };
}

export async function submitSigned(signedB64: string) {
  const client = getClient();
  const bytes = Buffer.from(signedB64, "base64");
  const tx = Transaction.fromBytes(bytes);
  const res = await tx.execute(client);
  const receipt = await res.getReceipt(client);
  return { txId: res.transactionId.toString(), status: receipt.status.toString(), hashscan: toHashscanLink("transaction", res.transactionId.toString()) };
}

export const MAX_FILE_CHUNK_BYTES = 4000;

export async function storeJsonInHfs(payload: unknown) {
  const client = getClient();
  const { operatorKey } = getOperatorCredentials();
  const contents = Buffer.from(JSON.stringify(payload));

  const initialChunk = contents.subarray(0, MAX_FILE_CHUNK_BYTES);
  const createTx = await new FileCreateTransaction()
    .setKeys([operatorKey.publicKey])
    .setContents(initialChunk)
    .execute(client);
  const createReceipt = await createTx.getReceipt(client);
  const fileId = createReceipt.fileId;
  if (!fileId) {
    throw new Error("Failed to create HFS file");
  }

  const transactionIds = [createTx.transactionId.toString()];

  let offset = MAX_FILE_CHUNK_BYTES;
  while (offset < contents.length) {
    const chunk = contents.subarray(offset, offset + MAX_FILE_CHUNK_BYTES);
    const appendTx = await new FileAppendTransaction()
      .setFileId(fileId)
      .setContents(chunk)
      .execute(client);
    await appendTx.getReceipt(client);
    transactionIds.push(appendTx.transactionId.toString());
    offset += MAX_FILE_CHUNK_BYTES;
  }

  return {
    fileId: fileId.toString(),
    transactionIds,
    hashscanLinks: transactionIds.map((id) => toHashscanLink("transaction", id)),
  };
}

export async function overwriteJsonInHfsFile(fileId: string, payload: unknown) {
  const client = getClient();
  const { operatorKey } = getOperatorCredentials();
  const buffer = Buffer.from(JSON.stringify(payload));
  const transactionIds: string[] = [];

  const targetFileId = FileId.fromString(fileId);
  const initialChunk = buffer.subarray(0, MAX_FILE_CHUNK_BYTES);

  const updateTx = await new FileUpdateTransaction()
    .setFileId(targetFileId)
    .setContents(initialChunk)
    .setKeys([operatorKey.publicKey])
    .execute(client);
  await updateTx.getReceipt(client);
  transactionIds.push(updateTx.transactionId.toString());

  let offset = MAX_FILE_CHUNK_BYTES;
  while (offset < buffer.length) {
    const chunk = buffer.subarray(offset, offset + MAX_FILE_CHUNK_BYTES);
    const appendTx = await new FileAppendTransaction()
      .setFileId(targetFileId)
      .setContents(chunk)
      .execute(client);
    await appendTx.getReceipt(client);
    transactionIds.push(appendTx.transactionId.toString());
    offset += MAX_FILE_CHUNK_BYTES;
  }

  return {
    fileId,
    transactionIds,
    hashscanLinks: transactionIds.map((id) => toHashscanLink("transaction", id)),
  };
}

function sanitizeSymbol(name: string, suffix = "") {
  const base = name
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
  return `${base}${suffix}`.slice(0, 6) || `AST${suffix}`;
}

export async function createAssetTokens(params: {
  name: string;
  symbol?: string;
  totalShares: number;
  metadataCid: string;
  metadataUrl?: string;
  treasuryAccountId?: string;
}) {
  const client = getClient();
  const { operatorId, operatorKey } = getOperatorCredentials();

  const treasury = params.treasuryAccountId
    ? AccountId.fromString(params.treasuryAccountId)
    : operatorId;

  const baseSymbol = sanitizeSymbol(params.symbol ?? params.name);
  const nftSymbol = baseSymbol;
  const ftSymbol = `${baseSymbol}F`; // Fraction token indicator

  // --- Create NFT token
  const nftCreateTx = await new TokenCreateTransaction()
    .setTokenName(params.name)
    .setTokenSymbol(nftSymbol)
    .setTokenMemo(`ipfs://${params.metadataCid}`)
    .setTokenType(TokenType.NonFungibleUnique)
    .setTreasuryAccountId(treasury)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(1)
    .setAdminKey(operatorKey.publicKey)
    .setSupplyKey(operatorKey.publicKey)
    .setFreezeDefault(false)
    .execute(client);

  const nftCreateReceipt = await nftCreateTx.getReceipt(client);
  if (!nftCreateReceipt.tokenId) {
    throw new Error("Failed to create asset NFT token");
  }

  const nftMintTx = await new TokenMintTransaction()
    .setTokenId(nftCreateReceipt.tokenId)
    .addMetadata(Buffer.from(params.metadataCid));
  const nftMintSubmit = await nftMintTx.execute(client);
  const nftMintReceipt = await nftMintSubmit.getReceipt(client);
  const nftSerials = (nftMintReceipt.serials ?? []).map((serial) => Number(serial.toString()));

  // --- Create Fraction token
  const shares = Math.max(1, Math.trunc(params.totalShares));
  const ftCreateTx = await new TokenCreateTransaction()
    .setTokenName(`${params.name} Fraction`)
    .setTokenSymbol(ftSymbol)
    .setTokenMemo(`ipfs://${params.metadataCid}`)
    .setTokenType(TokenType.FungibleCommon)
    .setTreasuryAccountId(treasury)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(shares)
    .setInitialSupply(shares)
    .setDecimals(0)
    .setAdminKey(operatorKey.publicKey)
    .setSupplyKey(operatorKey.publicKey)
    .setFreezeDefault(false)
    .execute(client);

  const ftReceipt = await ftCreateTx.getReceipt(client);
  if (!ftReceipt.tokenId) {
    throw new Error("Failed to create fraction token");
  }

  return {
    nft: {
      tokenId: nftCreateReceipt.tokenId.toString(),
      createTxId: nftCreateTx.transactionId.toString(),
      mintTxId: nftMintSubmit.transactionId.toString(),
      serials: nftSerials,
      createLink: toHashscanLink("transaction", nftCreateTx.transactionId.toString()),
      mintLink: toHashscanLink("transaction", nftMintSubmit.transactionId.toString()),
    },
    fraction: {
      tokenId: ftReceipt.tokenId.toString(),
      createTxId: ftCreateTx.transactionId.toString(),
      createLink: toHashscanLink("transaction", ftCreateTx.transactionId.toString()),
    },
  };
}

export async function createFractionToken(params: {
  name: string;
  symbol?: string;
  totalShares: number;
  metadataCid: string;
  treasuryAccountId?: string;
}) {
  const client = getClient();
  const { operatorId, operatorKey } = getOperatorCredentials();

  const treasury = params.treasuryAccountId
    ? AccountId.fromString(params.treasuryAccountId)
    : operatorId;

  const baseSymbol = sanitizeSymbol(params.symbol ?? params.name, "F");
  const shares = Math.max(1, Math.trunc(params.totalShares));

  const tx = await new TokenCreateTransaction()
    .setTokenName(params.name)
    .setTokenSymbol(baseSymbol)
    .setTokenMemo(`ipfs://${params.metadataCid}`)
    .setTokenType(TokenType.FungibleCommon)
    .setTreasuryAccountId(treasury)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(shares)
    .setInitialSupply(shares)
    .setDecimals(0)
    .setAdminKey(operatorKey.publicKey)
    .setSupplyKey(operatorKey.publicKey)
    .setFreezeDefault(false)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  if (!receipt.tokenId) {
    throw new Error("Failed to create fraction token");
  }

  return {
    tokenId: receipt.tokenId.toString(),
    transactionId: tx.transactionId.toString(),
    link: toHashscanLink("transaction", tx.transactionId.toString()),
  };
}

async function getDistributorArtifact() {
  const artifactPath = path.resolve(
    process.cwd(),
    "..",
    "smart contract",
    "artifacts",
    "contracts",
    "DividendDistributor.sol",
    "DividendDistributor.json"
  );

  const stats = await fs.stat(artifactPath);
  if (cachedDistributorArtifact && cachedDistributorArtifactMtimeMs === stats.mtimeMs) {
    return cachedDistributorArtifact;
  }

  const raw = await fs.readFile(artifactPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed.bytecode) {
    throw new Error("DividendDistributor artifact missing bytecode");
  }

  cachedDistributorArtifact = { bytecode: parsed.bytecode, abi: parsed.abi };
  cachedDistributorArtifactMtimeMs = stats.mtimeMs;
  return cachedDistributorArtifact;
}

export async function deployDividendDistributor(params: {
  nftTokenId: string;
  fractionTokenId: string;
  initialSupply: number;
  ownerAccountId?: string;
  gas?: number;
}) {
  const client = getClient();
  const { operatorId } = getOperatorCredentials();
  const artifact = await getDistributorArtifact();

  const bytecode = Buffer.from(artifact.bytecode.replace(/^0x/, ""), "hex");
  console.log("deployDividendDistributor.bytecodeLength", bytecode.length);

  const nftAddress = `0x${TokenId.fromString(params.nftTokenId).toSolidityAddress()}`;
  const fractionAddress = `0x${TokenId.fromString(params.fractionTokenId).toSolidityAddress()}`;
  const ownerAccount = params.ownerAccountId
    ? AccountId.fromString(params.ownerAccountId)
    : operatorId;
  const ownerAddress = `0x${ownerAccount.toSolidityAddress()}`;

  const constructorParameters = new ContractFunctionParameters()
    .addAddress(nftAddress)
    .addAddress(fractionAddress)
    .addUint256(Math.max(1, params.initialSupply))
    .addAddress(ownerAddress);
  console.log("deployDividendDistributor.constructorParams", {
    nftAddress,
    fractionAddress,
    initialSupply: Math.max(1, params.initialSupply),
    ownerAddress,
  });

  const createTx = await new ContractCreateFlow()
    .setGas(params.gas ?? 3_000_000)
    .setBytecode(bytecode)
    .setConstructorParameters(constructorParameters)
    .execute(client);

  const receipt = await createTx.getReceipt(client);
  if (!receipt.contractId) {
    throw new Error("Failed to deploy DividendDistributor contract");
  }

  const contractId = receipt.contractId.toString();

  return {
    contractId,
    transactionId: createTx.transactionId.toString(),
    contractLink: toHashscanLink("contract", contractId),
    deployLink: toHashscanLink("transaction", createTx.transactionId.toString()),
  };
}

export async function depositHbarToDistributor(params: {
  contractId: string;
  amount: number | string;
  gas?: number;
  memo?: string;
}) {
  const client = getClient();
  const hbarAmount = Hbar.fromString(String(params.amount));

  const tx = new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(params.contractId))
    .setGas(params.gas ?? 500_000)
    .setFunction("depositHbar")
    .setPayableAmount(hbarAmount);

  if (params.memo) {
    tx.setTransactionMemo(params.memo);
  }

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);

  return {
    transactionId: submit.transactionId.toString(),
    status: receipt.status.toString(),
    link: toHashscanLink("transaction", submit.transactionId.toString()),
  };
}

export async function composeDistributorClaimHbar(params: {
  contractId: string;
  accountId: string;
  gas?: number;
  memo?: string;
}) {
  const client = getClient();
  const payer = AccountId.fromString(params.accountId);
  const contract = ContractId.fromString(params.contractId);

  const txId = TransactionId.generate(payer);
  const tx = new ContractExecuteTransaction()
    .setContractId(contract)
    .setGas(params.gas ?? 500_000)
    .setFunction("claimHbar")
    .setTransactionId(txId);

  if (params.memo) {
    tx.setTransactionMemo(params.memo);
  }

  const frozen = await tx.freezeWith(client);
  const bytes = frozen.toBytes();

  return {
    bytes: Buffer.from(bytes).toString("base64"),
    transactionId: txId.toString(),
  };
}

export async function getPendingHbarForAccount(params: {
  contractId: string;
  accountId: string;
  gas?: number;
}) {
  const client = getClient();
  const contract = ContractId.fromString(params.contractId);
  const account = AccountId.fromString(params.accountId);
  const accountAddress = `0x${account.toSolidityAddress()}`;

  const query = await new ContractCallQuery()
    .setContractId(contract)
    .setGas(params.gas ?? 250_000)
    .setFunction(
      "pendingHbar",
      new ContractFunctionParameters().addAddress(accountAddress)
    );

  const res = await query.execute(client);
  const tinybars = res.getUint256(0);
  const tinybarString = tinybars.toString();
  const hbar = Hbar.fromTinybars(tinybarString).toBigNumber().toString();

  return {
    tinybars: tinybarString,
    hbar,
  };
}

export async function associateTokenToContract(contractId: string, tokenId: string) {
  const client = getClient();
  const tx = await new TokenAssociateTransaction()
    .setAccountId(AccountId.fromString(contractId))
    .setTokenIds([TokenId.fromString(tokenId)])
    .execute(client);
  await tx.getReceipt(client);
  return {
    transactionId: tx.transactionId.toString(),
    link: toHashscanLink("transaction", tx.transactionId.toString()),
  };
}
