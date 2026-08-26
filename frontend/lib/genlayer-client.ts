import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus, type GenLayerClient, type GenLayerTransaction, type TransactionHash as SdkTransactionHash } from "genlayer-js/types";
import type { CalldataEncodable } from "genlayer-js/types";
import type { Address, CaseRecord, CreateCaseInput, SubmissionRecord, AccountingRecord, TransactionHash, WriteMethod } from "./contract-api";
import { parseAccountingRecord, parseCaseRecord, parseSubmissionRecord } from "./contract-api";
import { getPublicConfig } from "./config";

export { ExecutionResult, TransactionStatus };
export type { GenLayerTransaction };

const config = getPublicConfig();
const configuredChain = {
  ...testnetBradbury,
  id: config.chainId,
  rpcUrls: { default: { http: [config.rpcUrl] as readonly string[] } },
};

let readClient: GenLayerClient<typeof configuredChain> | null = null;

export function requireContractAddress(): Address {
  if (config.configurationError) throw new Error(config.configurationError);
  if (!config.contractAddress) throw new Error("Live contract not deployed yet");
  return config.contractAddress;
}

export function getReadClient() {
  readClient ??= createClient({ chain: configuredChain, endpoint: config.rpcUrl });
  return readClient;
}

type SdkProvider = NonNullable<Parameters<typeof createClient>[0]>["provider"];

export function getWriteClient(account: Address, provider: SdkProvider) {
  return createClient({ chain: configuredChain, endpoint: config.rpcUrl, account, provider });
}

export async function readCase(caseId: string): Promise<CaseRecord> {
  const result = await getReadClient().readContract({
    address: requireContractAddress(),
    functionName: "get_case",
    args: [caseId],
    jsonSafeReturn: true,
  });
  return parseCaseRecord(result);
}

export async function readSubmission(submissionId: string): Promise<SubmissionRecord> {
  const result = await getReadClient().readContract({
    address: requireContractAddress(),
    functionName: "get_submission",
    args: [submissionId],
    jsonSafeReturn: true,
  });
  return parseSubmissionRecord(result);
}

export async function readSubmissionHistory(caseRecord: CaseRecord): Promise<SubmissionRecord[]> {
  if (!caseRecord.active_submission_id) return [];
  const prefix = `${caseRecord.case_id}:`;
  if (!caseRecord.active_submission_id.startsWith(prefix)) throw new Error("Invalid active submission ID");
  const count = Number(caseRecord.active_submission_id.slice(prefix.length));
  if (!Number.isSafeInteger(count) || count < 1 || count > 1_000) throw new Error("Invalid submission history bound");
  return Promise.all(Array.from({ length: count }, (_, index) => readSubmission(`${caseRecord.case_id}:${index + 1}`)));
}

export async function readAccounting(): Promise<AccountingRecord> {
  const result = await getReadClient().readContract({
    address: requireContractAddress(),
    functionName: "get_accounting",
    args: [],
    jsonSafeReturn: true,
  });
  return parseAccountingRecord(result);
}

export function createCaseArgs(input: CreateCaseInput): CalldataEncodable[] {
  return [
    input.caseId,
    input.developerAddress,
    input.repoOwner,
    input.repoName,
    input.baseCommitSha,
    input.vulnerabilitySpec,
    input.acceptanceCriteria,
    input.reviewPaths,
    input.challengeWindowSeconds,
  ];
}

export async function writeContract(
  account: Address,
  provider: SdkProvider,
  method: WriteMethod,
  args: CalldataEncodable[],
  value = 0n,
): Promise<TransactionHash> {
  const hash = await getWriteClient(account, provider).writeContract({
    address: requireContractAddress(),
    functionName: method,
    args,
    value,
  });
  if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("RPC returned an invalid transaction hash");
  return hash as TransactionHash;
}

export async function getTransaction(hash: TransactionHash): Promise<GenLayerTransaction> {
  return getReadClient().getTransaction({ hash: hash as SdkTransactionHash });
}

export async function waitForFinalized(hash: TransactionHash): Promise<GenLayerTransaction> {
  return getReadClient().waitForTransactionReceipt({
    hash: hash as SdkTransactionHash,
    status: TransactionStatus.FINALIZED,
    interval: 5_000,
    retries: 12,
  });
}

export type BrowserEthereumProvider = SdkProvider & {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void): void;
  removeListener?(event: "accountsChanged" | "chainChanged", listener: (...args: unknown[]) => void): void;
};

export function isWalletAddress(value: unknown): value is Address {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function browserProvider(): BrowserEthereumProvider | null {
  if (typeof window === "undefined") return null;
  return (window as typeof window & { ethereum?: BrowserEthereumProvider }).ethereum ?? null;
}

export async function requestWallet(): Promise<{ address: Address; chainId: number; provider: BrowserEthereumProvider }> {
  const provider = browserProvider();
  if (!provider) throw new Error("No compatible browser wallet found");
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || !isWalletAddress(accounts[0])) throw new Error("Wallet returned no valid account");
  const rawChain = await provider.request({ method: "eth_chainId" });
  const chainId = typeof rawChain === "string" ? Number.parseInt(rawChain, 16) : Number(rawChain);
  return { address: accounts[0], chainId, provider };
}

export function configuredChainId(): number { return config.chainId; }
