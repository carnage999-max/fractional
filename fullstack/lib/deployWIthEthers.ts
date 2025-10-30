import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
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
  const moduleDir = (() => {
    try {
      if (typeof __dirname === "string") {
        return __dirname;
      }
    } catch {
      // no-op
    }
    try {
      return path.dirname(fileURLToPath(import.meta.url));
    } catch {
      return process.cwd();
    }
  })();

  const unique = <T>(values: T[]) => Array.from(new Set(values));
  const candidateRoots = unique(
    [
      process.env.SMART_CONTRACT_ARTIFACT_ROOT && path.resolve(process.env.SMART_CONTRACT_ARTIFACT_ROOT),
      process.env.APP_ROOT && path.resolve(process.env.APP_ROOT),
      process.cwd(),
      path.resolve(process.cwd(), ".."),
      path.resolve(process.cwd(), "../.."),
      moduleDir,
      path.resolve(moduleDir, ".."),
      path.resolve(moduleDir, "../.."),
      path.resolve(moduleDir, "../../.."),
    ].filter(Boolean) as string[]
  );

  const resolveArtifactDir = () => {
    const customDir = process.env.SMART_CONTRACT_ARTIFACT_DIR;
    if (customDir) {
      const resolved = path.resolve(process.cwd(), customDir);
      if (fs.existsSync(resolved)) {
        return resolved;
      }
      throw new Error(
        `SMART_CONTRACT_ARTIFACT_DIR set to "${customDir}" but directory was not found from ${process.cwd()}`
      );
    }

    for (const root of candidateRoots) {
      const withSpace = path.resolve(root, "smart contract", "artifacts");
      if (fs.existsSync(withSpace)) {
        return withSpace;
      }

      const hyphenated = path.resolve(root, "smart-contract", "artifacts");
      if (fs.existsSync(hyphenated)) {
        return hyphenated;
      }

      const standaloneWithSpace = path.resolve(root, ".next", "standalone", "smart contract", "artifacts");
      if (fs.existsSync(standaloneWithSpace)) {
        return standaloneWithSpace;
      }

      const standaloneHyphen = path.resolve(root, ".next", "standalone", "smart-contract", "artifacts");
      if (fs.existsSync(standaloneHyphen)) {
        return standaloneHyphen;
      }
    }

    throw new Error(
      "Unable to locate smart contract artifacts. Provide SMART_CONTRACT_ARTIFACT_DIR or keep '../smart contract/artifacts' in the deployment bundle."
    );
  };

  const artifactsDir = resolveArtifactDir();
  const artifactPath = path.resolve(
    artifactsDir,
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
