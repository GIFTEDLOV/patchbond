import type { CaseRecord, TransactionHash, WriteMethod } from "./contract-api";
import type { GenLayerTransaction } from "./genlayer-client";
import { ExecutionResult, TransactionStatus } from "./genlayer-client";
import { classifyError, failureFor, type ClassifiedFailure } from "./failure-taxonomy";

export const TX_STORAGE_KEY = "patchbond.pending-transactions.v1";
export const TX_STAGES = [
  "Waiting for wallet",
  "Broadcasting",
  "Submitted",
  "Awaiting consensus",
  "Accepted",
  "Awaiting finality",
  "Finalized",
  "Verifying execution",
  "Verifying case state",
  "Complete",
] as const;
export type TxStage = (typeof TX_STAGES)[number];

export interface ExpectedTransition {
  allowedStatuses: CaseRecord["status"][];
  previousActiveSubmissionId?: string;
  requiresSettlement?: boolean;
  settlementStatuses?: CaseRecord["status"][];
  settlementRecipient?: string;
}

export interface PendingTransaction {
  network: string;
  contractAddress: string;
  method: WriteMethod;
  caseId: string;
  txHash: TransactionHash;
  createdAt: string;
  expected: ExpectedTransition;
  stage: TxStage;
  lastCheckedAt?: string;
  failure?: ClassifiedFailure;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const isHash = (value: unknown): value is TransactionHash => typeof value === "string" && /^0x[0-9a-fA-F]{64}$/.test(value);

export function loadTransactions(storage: StorageLike): PendingTransaction[] {
  try {
    const parsed = JSON.parse(storage.getItem(TX_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PendingTransaction =>
      item && typeof item === "object" && typeof item.network === "string" && typeof item.contractAddress === "string" &&
      typeof item.method === "string" && typeof item.caseId === "string" && isHash(item.txHash) &&
      typeof item.createdAt === "string" && item.expected && Array.isArray(item.expected.allowedStatuses) && typeof item.stage === "string"
    );
  } catch { return []; }
}

export function saveTransaction(storage: StorageLike, record: PendingTransaction): PendingTransaction {
  const records = loadTransactions(storage);
  const index = records.findIndex((item) => item.txHash.toLowerCase() === record.txHash.toLowerCase());
  if (index >= 0) records[index] = record; else records.push(record);
  storage.setItem(TX_STORAGE_KEY, JSON.stringify(records));
  return record;
}

export function unresolvedTransactions(storage: StorageLike): PendingTransaction[] {
  return loadTransactions(storage).filter((item) => item.stage !== "Complete");
}

export function assertNoBlindRebroadcast(storage: StorageLike, contractAddress: string, method: WriteMethod, caseId: string): void {
  const duplicate = unresolvedTransactions(storage).find((item) =>
    item.contractAddress.toLowerCase() === contractAddress.toLowerCase() && item.method === method && item.caseId === caseId
  );
  if (duplicate) throw new Error(`Pending transaction ${duplicate.txHash} must be reconciled; do not rebroadcast`);
}

export function persistBroadcast(
  storage: StorageLike,
  input: Omit<PendingTransaction, "stage" | "createdAt"> & { createdAt?: string },
): PendingTransaction {
  return saveTransaction(storage, { ...input, createdAt: input.createdAt ?? new Date().toISOString(), stage: "Submitted" });
}

export interface ReconcileDependencies {
  waitForFinalized(hash: TransactionHash): Promise<GenLayerTransaction>;
  getTransaction(hash: TransactionHash): Promise<GenLayerTransaction>;
  readCase(caseId: string): Promise<CaseRecord>;
}

const receiptStatus = (receipt: GenLayerTransaction): string => String(receipt.statusName ?? receipt.status ?? "").toUpperCase();
const receiptResult = (receipt: GenLayerTransaction): string => String(receipt.resultName ?? receipt.lastRound?.validatorVotesName?.join(",") ?? "").toUpperCase();

function failureFromReceipt(receipt: GenLayerTransaction): ClassifiedFailure | null {
  const status = receiptStatus(receipt);
  const result = receiptResult(receipt);
  if (status === TransactionStatus.UNDETERMINED || result.includes("DISAGREE") || result.includes("NO_MAJORITY")) return failureFor("VALIDATOR_DISAGREEMENT");
  if (status === TransactionStatus.LEADER_TIMEOUT || result.includes("LEADER_TIMEOUT")) return failureFor("LEADER_TIMEOUT");
  if (status === TransactionStatus.VALIDATORS_TIMEOUT || result.includes("TIMEOUT")) return failureFor("VALIDATOR_TIMEOUT");
  return null;
}

export function verifyExpectedCase(record: PendingTransaction, caseRecord: CaseRecord): void {
  if (!record.expected.allowedStatuses.includes(caseRecord.status)) throw new Error("STATE_MISMATCH: unexpected case status");
  if (record.expected.previousActiveSubmissionId !== undefined && caseRecord.active_submission_id === record.expected.previousActiveSubmissionId) throw new Error("STATE_MISMATCH: submission was not stored");
  const settlementRequired = record.expected.requiresSettlement || record.expected.settlementStatuses?.includes(caseRecord.status);
  if (settlementRequired) {
    if (caseRecord.settlement_status !== "AUTHORIZED_FINALIZED_ONLY" || caseRecord.settlement_amount !== caseRecord.bounty_amount || caseRecord.settlement_amount <= 0n) throw new Error("SETTLEMENT_MISMATCH: authorization or amount");
    const derivedRecipient = caseRecord.status === "FINALIZED_DEVELOPER" ? caseRecord.developer_address : caseRecord.status === "FINALIZED_CLIENT" ? caseRecord.client_address : record.expected.settlementRecipient;
    const expectedRecipient = record.expected.settlementRecipient ?? derivedRecipient;
    if (expectedRecipient && caseRecord.settlement_recipient.toLowerCase() !== expectedRecipient.toLowerCase()) throw new Error("SETTLEMENT_MISMATCH: recipient");
  }
}

export async function reconcileSameHash(storage: StorageLike, record: PendingTransaction, deps: ReconcileDependencies): Promise<PendingTransaction> {
  let working = saveTransaction(storage, { ...record, stage: "Awaiting consensus", failure: undefined, lastCheckedAt: new Date().toISOString() });
  let receipt: GenLayerTransaction;
  try {
    receipt = await deps.waitForFinalized(record.txHash);
  } catch (waitError) {
    try {
      receipt = await deps.getTransaction(record.txHash);
      const consensusFailure = failureFromReceipt(receipt);
      if (consensusFailure) return saveTransaction(storage, { ...working, failure: consensusFailure, lastCheckedAt: new Date().toISOString() });
      const status = receiptStatus(receipt);
      if (status !== TransactionStatus.FINALIZED) {
        const stage: TxStage = status === TransactionStatus.ACCEPTED ? "Awaiting finality" : "Awaiting consensus";
        return saveTransaction(storage, { ...working, stage, failure: failureFor("VALIDATOR_TIMEOUT"), lastCheckedAt: new Date().toISOString() });
      }
    } catch {
      return saveTransaction(storage, { ...working, failure: classifyError(waitError), lastCheckedAt: new Date().toISOString() });
    }
  }

  const consensusFailure = failureFromReceipt(receipt);
  if (consensusFailure) return saveTransaction(storage, { ...working, failure: consensusFailure, lastCheckedAt: new Date().toISOString() });
  if (receiptStatus(receipt) !== TransactionStatus.FINALIZED) return saveTransaction(storage, { ...working, stage: "Awaiting finality", failure: failureFor("VALIDATOR_TIMEOUT"), lastCheckedAt: new Date().toISOString() });

  working = saveTransaction(storage, { ...working, stage: "Verifying execution", lastCheckedAt: new Date().toISOString() });
  if (receipt.txExecutionResultName !== ExecutionResult.FINISHED_WITH_RETURN) {
    return saveTransaction(storage, { ...working, failure: failureFor("EXECUTION_FAILURE") });
  }

  working = saveTransaction(storage, { ...working, stage: "Verifying case state" });
  try {
    const caseRecord = await deps.readCase(record.caseId);
    verifyExpectedCase(record, caseRecord);
    return saveTransaction(storage, { ...working, stage: "Complete", failure: undefined, lastCheckedAt: new Date().toISOString() });
  } catch (error) {
    return saveTransaction(storage, { ...working, failure: classifyError(error), lastCheckedAt: new Date().toISOString() });
  }
}

export interface BroadcastDependencies extends ReconcileDependencies {
  precondition(): Promise<void>;
  broadcast(): Promise<TransactionHash>;
}

export async function broadcastOnce(
  storage: StorageLike,
  base: Omit<PendingTransaction, "txHash" | "createdAt" | "stage">,
  deps: BroadcastDependencies,
): Promise<PendingTransaction> {
  assertNoBlindRebroadcast(storage, base.contractAddress, base.method, base.caseId);
  await deps.precondition();
  const hash = await deps.broadcast();
  const persisted = persistBroadcast(storage, { ...base, txHash: hash });
  return reconcileSameHash(storage, persisted, deps);
}
