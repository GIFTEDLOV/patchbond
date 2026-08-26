import { describe, expect, it, vi } from "vitest";
import { ExecutionResult, TransactionStatus } from "@/lib/genlayer-client";
import { classifyError } from "@/lib/failure-taxonomy";
import {
  TX_STORAGE_KEY,
  assertNoBlindRebroadcast,
  broadcastOnce,
  loadTransactions,
  persistBroadcast,
  reconcileSameHash,
  unresolvedTransactions,
  verifyExpectedCase,
  type PendingTransaction,
  type StorageLike,
} from "@/lib/transactions";
import { caseFixture, CLIENT, DEVELOPER, HASH } from "./fixtures";

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const baseRecord: PendingTransaction = {
  network: "testnetBradbury",
  contractAddress: "0x4444444444444444444444444444444444444444",
  method: "accept_case",
  caseId: "case-1",
  txHash: HASH,
  createdAt: "2026-08-25T00:00:00.000Z",
  expected: { allowedStatuses: ["ACCEPTED"] },
  stage: "Submitted",
};

const finalized = { statusName: TransactionStatus.FINALIZED, txExecutionResultName: ExecutionResult.FINISHED_WITH_RETURN };

describe("durable same-hash transaction lifecycle", () => {
  it("persists the required recovery record immediately after broadcast", async () => {
    const storage = new MemoryStorage();
    const wait = vi.fn(async () => {
      expect(loadTransactions(storage)[0].txHash).toBe(HASH);
      return finalized;
    });
    const result = await broadcastOnce(storage, {
      network: baseRecord.network,
      contractAddress: baseRecord.contractAddress,
      method: baseRecord.method,
      caseId: baseRecord.caseId,
      expected: baseRecord.expected,
    }, {
      precondition: vi.fn(async () => undefined),
      broadcast: vi.fn(async () => HASH),
      waitForFinalized: wait,
      getTransaction: vi.fn(),
      readCase: vi.fn(async () => caseFixture({ status: "ACCEPTED", accepted: true })),
    });
    expect(result.stage).toBe("Complete");
    expect(JSON.parse(storage.getItem(TX_STORAGE_KEY) || "[]")[0]).toMatchObject({ network: "testnetBradbury", method: "accept_case", caseId: "case-1", txHash: HASH });
  });

  it("recovers after refresh by reconciling the same hash and never broadcasts", async () => {
    const storage = new MemoryStorage();
    persistBroadcast(storage, baseRecord);
    const deps = { waitForFinalized: vi.fn(async (hash) => { expect(hash).toBe(HASH); return finalized; }), getTransaction: vi.fn(), readCase: vi.fn(async () => caseFixture({ status: "ACCEPTED", accepted: true })) };
    const recovered = unresolvedTransactions(storage)[0];
    const result = await reconcileSameHash(storage, recovered, deps);
    expect(result.stage).toBe("Complete");
    expect(deps.waitForFinalized).toHaveBeenCalledOnce();
  });

  it("continues execution and state verification when the fallback read is already finalized", async () => {
    const storage = new MemoryStorage();
    const result = await reconcileSameHash(storage, baseRecord, {
      waitForFinalized: vi.fn(async () => { throw new Error("wait timed out"); }),
      getTransaction: vi.fn(async () => finalized),
      readCase: vi.fn(async () => caseFixture({ status: "ACCEPTED", accepted: true })),
    });
    expect(result.stage).toBe("Complete");
    expect(result.failure).toBeUndefined();
  });

  it("blocks blind rebroadcast while an unresolved method/case hash exists", async () => {
    const storage = new MemoryStorage();
    persistBroadcast(storage, baseRecord);
    expect(() => assertNoBlindRebroadcast(storage, baseRecord.contractAddress, "accept_case", "case-1")).toThrow(/must be reconciled/);
    const broadcast = vi.fn(async () => HASH);
    await expect(broadcastOnce(storage, { network: baseRecord.network, contractAddress: baseRecord.contractAddress, method: baseRecord.method, caseId: baseRecord.caseId, expected: baseRecord.expected }, { precondition: vi.fn(), broadcast, waitForFinalized: vi.fn(), getTransaction: vi.fn(), readCase: vi.fn() })).rejects.toThrow(/do not rebroadcast/);
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("does not complete when a FINALIZED transaction executed with error", async () => {
    const storage = new MemoryStorage();
    const result = await reconcileSameHash(storage, baseRecord, { waitForFinalized: vi.fn(async () => ({ ...finalized, txExecutionResultName: ExecutionResult.FINISHED_WITH_ERROR })), getTransaction: vi.fn(), readCase: vi.fn() });
    expect(result.failure?.category).toBe("EXECUTION_FAILURE");
    expect(result.stage).not.toBe("Complete");
  });

  it("does not complete when expected stored state is absent", async () => {
    const storage = new MemoryStorage();
    const result = await reconcileSameHash(storage, baseRecord, { waitForFinalized: vi.fn(async () => finalized), getTransaction: vi.fn(), readCase: vi.fn(async () => caseFixture({ status: "OPEN" })) });
    expect(result.failure?.category).toBe("STATE_MISMATCH");
  });

  it("reconciles exact settlement recipient, amount, and authorization", () => {
    const record = { ...baseRecord, method: "finalize_uncontested" as const, expected: { allowedStatuses: ["FINALIZED_DEVELOPER" as const], requiresSettlement: true, settlementRecipient: DEVELOPER } };
    expect(() => verifyExpectedCase(record, caseFixture({ status: "FINALIZED_DEVELOPER", settlement_recipient: DEVELOPER, settlement_amount: 25n * 10n ** 18n, settlement_status: "AUTHORIZED_FINALIZED_ONLY" }))).not.toThrow();
    expect(() => verifyExpectedCase(record, caseFixture({ status: "FINALIZED_DEVELOPER", settlement_recipient: CLIENT, settlement_amount: 25n * 10n ** 18n, settlement_status: "AUTHORIZED_FINALIZED_ONLY" }))).toThrow(/recipient/);
  });

  it("keeps disagreement, leader timeout, and validator timeout distinct", async () => {
    const disagree = await reconcileSameHash(new MemoryStorage(), baseRecord, { waitForFinalized: vi.fn(async () => { throw new Error("wait"); }), getTransaction: vi.fn(async () => ({ statusName: TransactionStatus.UNDETERMINED })), readCase: vi.fn() });
    const leaderTimeout = await reconcileSameHash(new MemoryStorage(), baseRecord, { waitForFinalized: vi.fn(async () => { throw new Error("wait"); }), getTransaction: vi.fn(async () => ({ statusName: TransactionStatus.LEADER_TIMEOUT })), readCase: vi.fn() });
    const timeout = await reconcileSameHash(new MemoryStorage(), baseRecord, { waitForFinalized: vi.fn(async () => { throw new Error("wait"); }), getTransaction: vi.fn(async () => ({ statusName: TransactionStatus.VALIDATORS_TIMEOUT })), readCase: vi.fn() });
    expect(disagree.failure?.category).toBe("VALIDATOR_DISAGREEMENT");
    expect(leaderTimeout.failure?.category).toBe("LEADER_TIMEOUT");
    expect(timeout.failure?.category).toBe("VALIDATOR_TIMEOUT");
  });

  it("does not persist or rebroadcast automatically after wallet rejection", async () => {
    const storage = new MemoryStorage();
    const broadcast = vi.fn(async () => { throw new Error("User rejected wallet request"); });
    await expect(broadcastOnce(storage, { network: baseRecord.network, contractAddress: baseRecord.contractAddress, method: baseRecord.method, caseId: baseRecord.caseId, expected: baseRecord.expected }, { precondition: vi.fn(async () => undefined), broadcast, waitForFinalized: vi.fn(), getTransaction: vi.fn(), readCase: vi.fn() })).rejects.toThrow(/rejected/);
    expect(loadTransactions(storage)).toEqual([]);
    expect(broadcast).toHaveBeenCalledOnce();
  });
});

describe("failure taxonomy", () => {
  it("separates evidence outage, integrity failure, and NOT_FIXED", () => {
    expect(classifyError(new Error("EVIDENCE_FAILURE: HTTP_503")).category).toBe("EVIDENCE_UNAVAILABLE");
    expect(classifyError(new Error("EVIDENCE_FAILURE: BLOB_INTEGRITY")).category).toBe("EVIDENCE_INTEGRITY");
    expect(classifyError(new Error("NOT_FIXED")).category).toBe("BUSINESS_NOT_FIXED");
  });

  it("classifies wallet rejection and network mismatch without calling either a patch rejection", () => {
    expect(classifyError(new Error("User rejected wallet request")).category).toBe("WALLET_NETWORK");
    expect(classifyError(new Error("wrong network")).title).toBe("Wallet/network failure");
  });
});
