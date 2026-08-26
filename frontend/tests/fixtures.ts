import type { CaseRecord } from "@/lib/contract-api";

export const CLIENT = "0x1111111111111111111111111111111111111111";
export const DEVELOPER = "0x2222222222222222222222222222222222222222";
export const OTHER = "0x3333333333333333333333333333333333333333";
export const HASH = `0x${"a".repeat(64)}` as const;
export const BASE_SHA = "a".repeat(40);
export const PATCH_SHA = "b".repeat(40);

export function caseFixture(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    case_id: "case-1",
    client_address: CLIENT,
    developer_address: DEVELOPER,
    repo_owner: "patchbond",
    repo_name: "secure-repo",
    base_commit_sha: BASE_SHA,
    vulnerability_spec: "Authentication accepts a forged session token.",
    acceptance_criteria: "Reject invalid signatures before creating a session.",
    review_paths: ["src/auth.py"],
    bounty_amount: 25n * 10n ** 18n,
    challenge_window_seconds: 86_400,
    status: "OPEN",
    accepted: false,
    active_submission_id: "",
    provisional_submission_id: "",
    provisional_at: 0,
    challenge_deadline: 0,
    challenge_commit_sha: "",
    challenge_path: "",
    challenge_evidence_digest: "",
    response_deadline: 0,
    settlement_recipient: "0x0000000000000000000000000000000000000000",
    settlement_amount: 0n,
    settlement_status: "NONE",
    ...overrides,
  };
}
