import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { AccountId, ContractId, TokenId, PrivateKey } from "@hashgraph/sdk";

export type DeployDividendDistributorResult = {
  contractId: string;
  contractAddress: string;
  transactionHash: string | null;
  chainId: number;
};

type DeployDividendDistributorParams = {
  nftTokenId: string;
  fractionTokenId: string;
  initialSupply: number;
  ownerAccountId: string;
  gasLimit?: number;
};

function resolveJsonRpcUrl() {
  return (
    process.env.HEDERA_JSON_RPC_URL ||
    process.env.HEDERA_TESTNET_URL ||
    "https://testnet.hashio.io/api"
  );
}

function resolveEvmPrivateKey() {
  const key =
    process.env.OPERATOR_EVM_KEY ||
    process.env.OPERATOR_PRIVATE_KEY ||
    process.env.OPERATOR_KEY ||
    process.env.PRIVATE_KEY;

  if (!key) {
    throw new Error(
      "Missing OPERATOR_EVM_KEY/OPERATOR_PRIVATE_KEY/OPERATOR_KEY/PRIVATE_KEY for ethers deployment. Set this to your Hedera ECDSA private key (same one used for Hardhat)."
    );
  }

  const trimmed = key.trim();
  const hexLike = /^(0x)?[0-9a-fA-F]{64}$/;
  if (hexLike.test(trimmed)) {
    return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  }

  try {
    const parsed = PrivateKey.fromString(trimmed);
    if (parsed.type !== "ECDSA") {
      throw new Error(
        "Provided Hedera private key is not ECDSA/secp256k1. Switch the account to use an ECDSA key pair before deploying via ethers."
      );
    }
    return ethers.hexlify(parsed.toBytesRaw());
  } catch (err: any) {
    const reason = err?.message ?? String(err);
    throw new Error(
      `Unable to normalize operator private key for ethers deployment. Ensure you provide the 64-byte ECDSA key in hex (with or without 0x prefix). Original error: ${reason}`
    );
  }
}

function toEvmAddressFromTokenId(id: string) {
  return `0x${TokenId.fromString(id).toSolidityAddress()}`;
}

function toEvmAddressFromAccountId(id: string) {
  return `0x${AccountId.fromString(id).toSolidityAddress()}`;
}

export async function deployDividendDistributorEthers({
  nftTokenId,
  fractionTokenId,
  initialSupply,
  ownerAccountId,
  gasLimit,
}: DeployDividendDistributorParams): Promise<DeployDividendDistributorResult> {
  const artifactPath = path.resolve(
    process.cwd(),
    "..",
    "smart contract",
    "artifacts",
    "contracts",
    "DividendDistributor.sol",
    "DividendDistributor.json"
  );

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const { abi, bytecode } = artifact;

  const provider = new ethers.JsonRpcProvider(resolveJsonRpcUrl());
  const wallet = new ethers.Wallet(resolveEvmPrivateKey(), provider);

  const nftAddress = toEvmAddressFromTokenId(nftTokenId);
  const fractionAddress = toEvmAddressFromTokenId(fractionTokenId);
  const ownerAddress = toEvmAddressFromAccountId(ownerAccountId);
  const sanitizedSupply = BigInt(Math.max(1, Math.trunc(initialSupply)));
  const deployGas = gasLimit ?? 5_000_000;

  console.log("Deploying DividendDistributor via ethers", {
    nftAddress,
    fractionAddress,
    initialSupply: sanitizedSupply.toString(),
    ownerAddress,
    gasLimit: deployGas,
  });

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy(nftAddress, fractionAddress, sanitizedSupply, ownerAddress, {
    gasLimit: deployGas,
  });

  const deploymentTx = contract.deploymentTransaction();
  const txHash = deploymentTx?.hash ?? null;
  if (deploymentTx) {
    await deploymentTx.wait();
  } else {
    await contract.waitForDeployment();
  }

  const contractAddress = await contract.getAddress();
  const contractId = ContractId.fromEvmAddress(0, 0, contractAddress).toString();
  const network = await provider.getNetwork();

  console.log("✅ Deployed DividendDistributor", {
    contractId,
    contractAddress,
    transactionHash: txHash,
    chainId: Number(network.chainId),
  });

  return {
    contractId,
    contractAddress,
    transactionHash: txHash,
    chainId: Number(network.chainId),
  };
}
