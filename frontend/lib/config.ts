import type { Address } from "./contract-api";

const DEFAULT_RPC = "https://rpc-bradbury.genlayer.com";
const BRADBURY_CHAIN_ID = 4221;

function parseRpc(value: string | undefined): string {
  const raw = value || DEFAULT_RPC;
  try {
    const url = new URL(raw);
    const safeLocal = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !safeLocal) throw new Error();
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error("NEXT_PUBLIC_GENLAYER_RPC_URL must be HTTPS or local HTTP");
  }
}

function parseChainId(value: string | undefined): number {
  const parsed = Number(value || BRADBURY_CHAIN_ID);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error("NEXT_PUBLIC_GENLAYER_CHAIN_ID is invalid");
  return parsed;
}

function parseAddress(value: string | undefined): Address | null {
  if (!value) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/.test(value)) throw new Error("NEXT_PUBLIC_PATCHBOND_CONTRACT_ADDRESS is invalid");
  return value as Address;
}

export interface PublicConfig {
  network: "testnetBradbury";
  rpcUrl: string;
  chainId: number;
  contractAddress: Address | null;
  configured: boolean;
  configurationError: string | null;
}

export function getPublicConfig(): PublicConfig {
  try {
    const contractAddress = parseAddress(process.env.NEXT_PUBLIC_PATCHBOND_CONTRACT_ADDRESS);
    return {
      network: "testnetBradbury",
      rpcUrl: parseRpc(process.env.NEXT_PUBLIC_GENLAYER_RPC_URL),
      chainId: parseChainId(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID),
      contractAddress,
      configured: contractAddress !== null,
      configurationError: null,
    };
  } catch (error) {
    return {
      network: "testnetBradbury",
      rpcUrl: DEFAULT_RPC,
      chainId: BRADBURY_CHAIN_ID,
      contractAddress: null,
      configured: false,
      configurationError: error instanceof Error ? error.message : "Invalid public configuration",
    };
  }
}
