/**
 * Exact frontend mapping of every @gl.public method in contracts/patchbond.py.
 * Keep Python names and positional order unchanged; the contract is authoritative.
 */

export const CASE_STATUSES = [
  "OPEN",
  "ACCEPTED",
  "PROVISIONAL_FIXED",
  "CHALLENGED",
  "FINALIZED_DEVELOPER",
  "FINALIZED_CLIENT",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];
export type Verdict = "FIXED" | "NOT_FIXED" | "INCONCLUSIVE";
export type Address = `0x${string}`;
export type TransactionHash = `0x${string}`;

export interface CaseRecord {
  case_id: string;
  client_address: string;
  developer_address: string;
  repo_owner: string;
  repo_name: string;
  base_commit_sha: string;
  vulnerability_spec: string;
  acceptance_criteria: string;
  review_paths: string[];
  bounty_amount: bigint;
  challenge_window_seconds: number;
  status: CaseStatus;
  accepted: boolean;
  active_submission_id: string;
  provisional_submission_id: string;
  provisional_at: number;
  challenge_deadline: number;
  challenge_commit_sha: string;
  challenge_path: string;
  challenge_evidence_digest: string;
  response_deadline: number;
  settlement_recipient: string;
  settlement_amount: bigint;
  settlement_status: "NONE" | "AUTHORIZED_FINALIZED_ONLY" | string;
}

export interface SubmissionRecord {
  submission_id: string;
  patch_commit_sha: string;
  verdict: Verdict;
  evidence_manifest_digest: string;
}

export interface AccountingRecord {
  total_received: bigint;
  open_liability: bigint;
  total_authorized: bigint;
}

export interface CreateCaseInput {
  caseId: string;
  developerAddress: string;
  repoOwner: string;
  repoName: string;
  baseCommitSha: string;
  vulnerabilitySpec: string;
  acceptanceCriteria: string;
  reviewPaths: string[];
  challengeWindowSeconds: number;
  bountyWei: bigint;
}

export const CONTRACT_API = {
  writes: {
    create_case: {
      args: ["case_id", "developer_address", "repo_owner", "repo_name", "base_commit_sha", "vulnerability_spec", "acceptance_criteria", "review_paths", "challenge_window_seconds"],
      payable: true,
      caller: "client",
    },
    accept_case: { args: ["case_id"], payable: false, caller: "named developer" },
    submit_patch: { args: ["case_id", "patch_commit_sha"], payable: false, caller: "named developer" },
    challenge: { args: ["case_id", "challenge_commit_sha", "challenge_path"], payable: false, caller: "client" },
    respond_to_challenge: { args: ["case_id", "response_patch_sha"], payable: false, caller: "named developer" },
    finalize_uncontested: { args: ["case_id"], payable: false, caller: "permissionless after deadline" },
    authorize_client_refund: { args: ["case_id"], payable: false, caller: "permissionless after response deadline" },
  },
  views: {
    get_case: { args: ["case_id"], returns: "CaseRecord" },
    get_submission: { args: ["submission_id"], returns: "SubmissionRecord" },
    get_accounting: { args: [], returns: "AccountingRecord" },
  },
} as const;

export type WriteMethod = keyof typeof CONTRACT_API.writes;
export type ViewMethod = keyof typeof CONTRACT_API.views;

const asObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Unexpected contract response");
  return value as Record<string, unknown>;
};
const asString = (value: unknown, field: string) => {
  if (typeof value !== "string") throw new Error(`Invalid ${field} in contract response`);
  return value;
};
const asNumber = (value: unknown, field: string) => {
  const parsed = typeof value === "bigint" ? Number(value) : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`Invalid ${field} in contract response`);
  return parsed;
};
const asBigInt = (value: unknown, field: string) => {
  try { return BigInt(value as string | number | bigint); } catch { throw new Error(`Invalid ${field} in contract response`); }
};

export function parseCaseRecord(value: unknown): CaseRecord {
  const data = asObject(value);
  const status = asString(data.status, "status");
  if (!CASE_STATUSES.includes(status as CaseStatus)) throw new Error("Unknown case status");
  if (!Array.isArray(data.review_paths) || !data.review_paths.every((item) => typeof item === "string")) throw new Error("Invalid review_paths in contract response");
  return {
    case_id: asString(data.case_id, "case_id"),
    client_address: asString(data.client_address, "client_address"),
    developer_address: asString(data.developer_address, "developer_address"),
    repo_owner: asString(data.repo_owner, "repo_owner"),
    repo_name: asString(data.repo_name, "repo_name"),
    base_commit_sha: asString(data.base_commit_sha, "base_commit_sha"),
    vulnerability_spec: asString(data.vulnerability_spec, "vulnerability_spec"),
    acceptance_criteria: asString(data.acceptance_criteria, "acceptance_criteria"),
    review_paths: [...data.review_paths] as string[],
    bounty_amount: asBigInt(data.bounty_amount, "bounty_amount"),
    challenge_window_seconds: asNumber(data.challenge_window_seconds, "challenge_window_seconds"),
    status: status as CaseStatus,
    accepted: data.accepted === true,
    active_submission_id: asString(data.active_submission_id, "active_submission_id"),
    provisional_submission_id: asString(data.provisional_submission_id, "provisional_submission_id"),
    provisional_at: asNumber(data.provisional_at, "provisional_at"),
    challenge_deadline: asNumber(data.challenge_deadline, "challenge_deadline"),
    challenge_commit_sha: asString(data.challenge_commit_sha, "challenge_commit_sha"),
    challenge_path: asString(data.challenge_path, "challenge_path"),
    challenge_evidence_digest: asString(data.challenge_evidence_digest, "challenge_evidence_digest"),
    response_deadline: asNumber(data.response_deadline, "response_deadline"),
    settlement_recipient: asString(data.settlement_recipient, "settlement_recipient"),
    settlement_amount: asBigInt(data.settlement_amount, "settlement_amount"),
    settlement_status: asString(data.settlement_status, "settlement_status"),
  };
}

export function parseSubmissionRecord(value: unknown): SubmissionRecord {
  const data = asObject(value);
  const verdict = asString(data.verdict, "verdict") as Verdict;
  if (!["FIXED", "NOT_FIXED", "INCONCLUSIVE"].includes(verdict)) throw new Error("Unknown submission verdict");
  return {
    submission_id: asString(data.submission_id, "submission_id"),
    patch_commit_sha: asString(data.patch_commit_sha, "patch_commit_sha"),
    verdict,
    evidence_manifest_digest: asString(data.evidence_manifest_digest, "evidence_manifest_digest"),
  };
}

export function parseAccountingRecord(value: unknown): AccountingRecord {
  const data = asObject(value);
  return {
    total_received: asBigInt(data.total_received, "total_received"),
    open_liability: asBigInt(data.open_liability, "open_liability"),
    total_authorized: asBigInt(data.total_authorized, "total_authorized"),
  };
}
