import {
  AccountId,
  AccountInfoQuery,
  Client,
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
  FileInfoQuery,
  FileContentsQuery
} from "@hashgraph/sdk";
import { deployDividendDistributorEthers } from "./deployWIthEthers";

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

/**
 * Get a client WITHOUT operator credentials set
 * Use this for composing transactions that will be signed by user wallets
 */
export function getClientWithoutOperator(): Client {
  const network = resolveNetwork();
  const factory = NETWORK_FACTORIES[network];
  if (!factory) {
    throw new Error(`Unsupported Hedera network: ${network}`);
  }
  return factory();
}

export function getHashscanBaseUrl(): string {
  const network = cachedNetwork ?? resolveNetwork();
  return HASHSCAN_BASE[network];
}

export function toHashscanLink(type: "token" | "contract" | "account" | "transaction", id: string) {
  const base = getHashscanBaseUrl();
  return `${base}/${type}/${id}`;
}

/**
 * Check if an account is associated with specific tokens
 * Returns an object mapping tokenId to boolean (true if associated)
 */
export async function checkTokenAssociations({
  accountId,
  tokenIds,
}: {
  accountId: string;
  tokenIds: string[];
}): Promise<Record<string, boolean>> {
  const client = getClient();
  const account = AccountId.fromString(accountId);
  
  try {
    const query = new AccountInfoQuery().setAccountId(account);
    const accountInfo = await query.execute(client);
    
    // Get the list of associated tokens from tokenRelationships (it's a Map)
    const associatedTokens = new Set<string>();
    if (accountInfo.tokenRelationships) {
      for (const [tokenId] of accountInfo.tokenRelationships) {
        associatedTokens.add(tokenId.toString());
      }
    }
    
    // Check each requested token
    const result: Record<string, boolean> = {};
    for (const tokenId of tokenIds) {
      result[tokenId] = associatedTokens.has(tokenId);
    }
    
    console.log("[checkTokenAssociations]", { accountId, tokenIds, result });
    return result;
  } catch (error: any) {
    console.error("[checkTokenAssociations] Error:", error);
    // If account info query fails, assume tokens are not associated
    return tokenIds.reduce((acc, tokenId) => ({ ...acc, [tokenId]: false }), {});
  }
}

export async function composeTokenAssociation({
  accountId,
  tokenIds,
}: {
  accountId: string;
  tokenIds: string[];
}) {
  console.log("[composeTokenAssociation] START - Input params:", { accountId, tokenIds });
  
  // Use client WITHOUT operator to avoid operator account being used in transaction ID
  const client = getClientWithoutOperator();
  console.log("[composeTokenAssociation] Created client without operator");
  
  const account = AccountId.fromString(accountId);
  const tokens = tokenIds.map(id => TokenId.fromString(id));

  // Create transaction with user's account as the transaction ID
  const transactionId = TransactionId.generate(accountId);
  console.log("[composeTokenAssociation] Generated TransactionId:", transactionId.toString());
  
  const tx = new TokenAssociateTransaction()
    .setAccountId(account)
    .setTokenIds(tokens)
    .setTransactionId(transactionId)
    .setNodeAccountIds([client._network.getNodeAccountIdsForExecute()[0]]);

  console.log("[composeTokenAssociation] Transaction built, about to freeze");
  
  // Freeze with the non-operator client
  const frozen = await tx.freezeWith(client);
  const bytes = frozen.toBytes();
  
  console.log("[composeTokenAssociation] Transaction frozen, final transactionId:", frozen.transactionId?.toString());
  console.log("[composeTokenAssociation] Returning transaction with ID:", transactionId.toString());
  
  return { bytes: Buffer.from(bytes).toString("base64"), transactionId: transactionId.toString() };
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
  // Use client WITHOUT operator to avoid operator account being used in transaction ID
  const client = getClientWithoutOperator();
  const tid = TokenId.fromString(tokenId);

  const transactionId = TransactionId.generate(sender);
  const tx = new TransferTransaction()
    .addTokenTransfer(tid, sender, -amount)
    .addTokenTransfer(tid, recipient, amount)
    .setTransactionId(transactionId)
    .setNodeAccountIds([client._network.getNodeAccountIdsForExecute()[0]]);

  const frozen = await tx.freezeWith(client);
  const bytes = frozen.toBytes();
  
  console.log("[composeFtTransfer] Generated transaction:", {
    tokenId,
    sender,
    recipient,
    amount,
    transactionId: transactionId.toString()
  });
  
  return { bytes: Buffer.from(bytes).toString("base64"), transactionId: transactionId.toString() };
}

export async function composeNftTransfer({
  tokenId,
  serialNumber,
  sender,
  recipient,
}: {
  tokenId: string;
  serialNumber: number;
  sender: string;
  recipient: string;
}) {
  // Use client WITHOUT operator to avoid operator account being used in transaction ID
  const client = getClientWithoutOperator();
  const tid = TokenId.fromString(tokenId);

  const transactionId = TransactionId.generate(sender);
  const tx = new TransferTransaction()
    .addNftTransfer(tid, serialNumber, sender, recipient)
    .setTransactionId(transactionId)
    .setNodeAccountIds([client._network.getNodeAccountIdsForExecute()[0]]);

  const frozen = await tx.freezeWith(client);
  const bytes = frozen.toBytes();
  
  console.log("[composeNftTransfer] Generated transaction:", {
    tokenId,
    serialNumber,
    sender,
    recipient,
    transactionId: transactionId.toString()
  });
  
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

export async function transferFtToAccount({
  tokenId,
  toAccountId,
  amount,
  memo,
  fromAccountId,
}: {
  tokenId: string;
  toAccountId: string;
  amount: number;
  memo?: string;
  fromAccountId?: string;
}) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Transfer amount must be a positive number");
  }

  const client = getClient();
  const { operatorId } = getOperatorCredentials();
  const sender = AccountId.fromString(fromAccountId ?? operatorId.toString());
  const recipient = AccountId.fromString(toAccountId);
  const tid = TokenId.fromString(tokenId);

  const txId = TransactionId.generate(sender);
  const tx = new TransferTransaction()
    .addTokenTransfer(tid, sender, -Math.trunc(amount))
    .addTokenTransfer(tid, recipient, Math.trunc(amount))
    .setTransactionId(txId);

  if (memo) {
    tx.setTransactionMemo(memo.slice(0, 100));
  }

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);

  return {
    transactionId: submit.transactionId.toString(),
    status: receipt.status.toString(),
    link: toHashscanLink("transaction", submit.transactionId.toString()),
  };
}

export async function transferNftToAccount({
  tokenId,
  serialNumber,
  toAccountId,
  memo,
  fromAccountId,
}: {
  tokenId: string;
  serialNumber: number;
  toAccountId: string;
  memo?: string;
  fromAccountId?: string;
}) {
  if (!Number.isInteger(serialNumber) || serialNumber <= 0) {
    throw new Error("serialNumber must be a positive integer");
  }

  const client = getClient();
  const { operatorId } = getOperatorCredentials();
  const sender = AccountId.fromString(fromAccountId ?? operatorId.toString());
  const recipient = AccountId.fromString(toAccountId);
  const tid = TokenId.fromString(tokenId);

  const txId = TransactionId.generate(sender);
  const tx = new TransferTransaction()
    .addNftTransfer(tid, serialNumber, sender, recipient)
    .setTransactionId(txId);

  if (memo) {
    tx.setTransactionMemo(memo.slice(0, 100));
  }

  const submit = await tx.execute(client);
  const receipt = await submit.getReceipt(client);

  return {
    transactionId: submit.transactionId.toString(),
    status: receipt.status.toString(),
    link: toHashscanLink("transaction", submit.transactionId.toString()),
  };
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

export async function readHfsFileContents(fileId: string): Promise<Buffer> {
  const client = getClient();
  const contents = await new FileContentsQuery()
    .setFileId(FileId.fromString(fileId))
    .execute(client);
  return Buffer.from(contents);
}

function sanitizeSymbol(name: string, suffix = "") {
  const base = name
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
  return `${base}${suffix}`.slice(0, 6) || `AST${suffix}`;
}

async function uploadContractBytecode(bytecode: Buffer) {
  if (bytecode.length === 0) {
    throw new Error("Contract bytecode is empty");
  }

  const client = getClient();
  const { operatorKey } = getOperatorCredentials();

  const initialChunk = bytecode.subarray(0, MAX_FILE_CHUNK_BYTES);
  const fileCreateTx = await new FileCreateTransaction()
    .setKeys([operatorKey.publicKey])
    .setContents(initialChunk)
    .execute(client);

  const fileCreateReceipt = await fileCreateTx.getReceipt(client);
  const fileId = fileCreateReceipt.fileId;
  if (!fileId) {
    throw new Error("Failed to create contract bytecode file on HFS");
  }

  const transactionIds = [fileCreateTx.transactionId.toString()];

  let offset = MAX_FILE_CHUNK_BYTES;
  while (offset < bytecode.length) {
    const chunk = bytecode.subarray(offset, offset + MAX_FILE_CHUNK_BYTES);
    const appendTx = await new FileAppendTransaction()
      .setFileId(fileId)
      .setContents(chunk)
      .execute(client);
    await appendTx.getReceipt(client);
    transactionIds.push(appendTx.transactionId.toString());
    offset += MAX_FILE_CHUNK_BYTES;
  }

  // make the file immutable so HSCS can consume it
  await new FileUpdateTransaction()
    .setFileId(fileId)
    .setKeys([]) // remove keys → immutable
    .execute(client)
    .then(tx => tx.getReceipt(client));


  return { fileId, transactionIds };
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

export async function deployDividendDistributor(params: {
  nftTokenId: string;
  fractionTokenId: string;
  initialSupply: number;
  ownerAccountId?: string;
  gas?: number;
}) {
  const { operatorId } = getOperatorCredentials();
  let deployment;
  try {
    deployment = await deployDividendDistributorEthers({
      nftTokenId: params.nftTokenId,
      fractionTokenId: params.fractionTokenId,
      initialSupply: Math.max(1, params.initialSupply),
      ownerAccountId: params.ownerAccountId ?? operatorId.toString(),
      gasLimit: params.gas,
    });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    throw new Error(`Failed to deploy dividend distributor via ethers: ${message}`);
  }

  const contractLink = toHashscanLink("contract", deployment.contractId);
  const transactionId = deployment.transactionHash ?? null;
  const deployLink = transactionId
    ? toHashscanLink("transaction", transactionId)
    : contractLink;

  return {
    contractId: deployment.contractId,
    transactionId,
    contractLink,
    deployLink,
    contractAddress: deployment.contractAddress,
    chainId: deployment.chainId,
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
  const trimmed = contractId.trim();
  let accountId: AccountId;

  const hex40 = /^[0-9a-fA-F]{40}$/;
  if (/^0x[0-9a-fA-F]{40}$/i.test(trimmed)) {
    accountId = AccountId.fromEvmAddress(0, 0, trimmed);
  } else if (/^0\.0\.\d+$/.test(trimmed)) {
    accountId = AccountId.fromString(trimmed);
  } else if (/^0\.0\.[0-9a-fA-F]{40}$/i.test(trimmed)) {
    accountId = AccountId.fromEvmAddress(0, 0, `0x${trimmed.split(".")[2]}`);
  } else if (hex40.test(trimmed)) {
    accountId = AccountId.fromEvmAddress(0, 0, `0x${trimmed}`);
  } else {
    throw new Error(`Unsupported contract identifier format for association: ${contractId}`);
  }

  const tx = await new TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([TokenId.fromString(tokenId)])
    .execute(client);
  await tx.getReceipt(client);
  return {
    transactionId: tx.transactionId.toString(),
    link: toHashscanLink("transaction", tx.transactionId.toString()),
  };
}
