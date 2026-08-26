export type FailureCategory =
  | "EVIDENCE_UNAVAILABLE"
  | "EVIDENCE_INTEGRITY"
  | "ASSESSMENT_INCONCLUSIVE"
  | "VALIDATOR_DISAGREEMENT"
  | "VALIDATOR_TIMEOUT"
  | "LEADER_TIMEOUT"
  | "MODEL_FAILURE"
  | "EXECUTION_FAILURE"
  | "WALLET_NETWORK"
  | "BUSINESS_NOT_FIXED"
  | "STATE_MISMATCH";

export interface ClassifiedFailure {
  category: FailureCategory;
  title: string;
  message: string;
  retrySameHash: boolean;
}

const details: Record<FailureCategory, Omit<ClassifiedFailure, "category">> = {
  EVIDENCE_UNAVAILABLE: { title: "Evidence unavailable", message: "The bound repository evidence could not be retrieved. No patch verdict was produced.", retrySameHash: true },
  EVIDENCE_INTEGRITY: { title: "Evidence integrity failure", message: "Repository, commit, lineage, or content integrity checks failed before assessment.", retrySameHash: false },
  ASSESSMENT_INCONCLUSIVE: { title: "Patch assessment inconclusive", message: "Authenticated evidence was available, but remediation could not be determined reliably.", retrySameHash: false },
  VALIDATOR_DISAGREEMENT: { title: "Validator disagreement", message: "Validators did not reach a stable consensus-critical result. This is not a rejected patch.", retrySameHash: true },
  VALIDATOR_TIMEOUT: { title: "Validator timeout", message: "Consensus did not complete within the current check window. Recheck the same transaction hash.", retrySameHash: true },
  LEADER_TIMEOUT: { title: "Leader timeout", message: "The leader did not complete the transaction within the current check window. Recheck the same transaction hash.", retrySameHash: true },
  MODEL_FAILURE: { title: "Model/assessment failure", message: "The bounded assessment failed or returned an invalid schema. No business verdict was produced.", retrySameHash: false },
  EXECUTION_FAILURE: { title: "Transaction execution failure", message: "The transaction finalized without successful contract execution. Stored state was not accepted as changed.", retrySameHash: false },
  WALLET_NETWORK: { title: "Wallet/network failure", message: "The wallet rejected the request, is on the wrong network, or the RPC is unavailable.", retrySameHash: false },
  BUSINESS_NOT_FIXED: { title: "Patch not fixed", message: "Authenticated evidence affirmatively showed that the committed remediation criteria were not satisfied.", retrySameHash: false },
  STATE_MISMATCH: { title: "Stored state did not match", message: "The transaction finalized successfully, but the expected PatchBond case state was not observed.", retrySameHash: true },
};

export function failureFor(category: FailureCategory): ClassifiedFailure {
  return { category, ...details[category] };
}

export function classifyError(error: unknown): ClassifiedFailure {
  const raw = error instanceof Error ? error.message : String(error);
  const text = raw.toUpperCase();
  if (text.includes("INCONCLUSIVE")) return failureFor("ASSESSMENT_INCONCLUSIVE");
  if (text.includes("NOT_FIXED")) return failureFor("BUSINESS_NOT_FIXED");
  if (text.includes("UNDETERMINED") || text.includes("DISAGREE") || text.includes("NO_MAJORITY")) return failureFor("VALIDATOR_DISAGREEMENT");
  if (text.includes("LEADER_TIMEOUT") || text.includes("LEADER TIMEOUT")) return failureFor("LEADER_TIMEOUT");
  if (text.includes("VALIDATORS_TIMEOUT") || text.includes("VALIDATOR TIMEOUT") || text.includes("TIMEOUT")) return failureFor("VALIDATOR_TIMEOUT");
  if (text.includes("MODEL_FAILURE") || text.includes("SCHEMA")) return failureFor("MODEL_FAILURE");
  if (text.includes("EVIDENCE_FAILURE")) {
    if (/HTTP_(404|408|425|429|5\d\d)|EMPTY_HTTP_BODY/.test(text)) return failureFor("EVIDENCE_UNAVAILABLE");
    return failureFor("EVIDENCE_INTEGRITY");
  }
  if (text.includes("FINISHED_WITH_ERROR") || text.includes("EXECUTION")) return failureFor("EXECUTION_FAILURE");
  if (text.includes("STATE_MISMATCH") || text.includes("SETTLEMENT_MISMATCH")) return failureFor("STATE_MISMATCH");
  return failureFor("WALLET_NETWORK");
}
