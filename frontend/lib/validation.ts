import type { CreateCaseInput } from "./contract-api";

export const MAX_SPEC_LENGTH = 4_000;
export const MAX_CRITERIA_LENGTH = 4_000;
export const MIN_CHALLENGE_SECONDS = 3_600;
export const MAX_CHALLENGE_SECONDS = 604_800;
export const SHA_PATTERN = /^[0-9a-f]{40}$/;
export const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const CASE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const OWNER_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;
const REPO_PATTERN = /^[a-z0-9._-]+$/;
const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

export interface CaseDraft {
  caseId: string;
  developerAddress: string;
  repoOwner: string;
  repoName: string;
  baseCommitSha: string;
  vulnerabilitySpec: string;
  acceptanceCriteria: string;
  reviewPaths: string[];
  challengeWindowSeconds: number;
  bountyGen: string;
}

export type ValidationErrors = Partial<Record<keyof CaseDraft | "form", string>>;

export function validateReviewPath(path: string): string | null {
  if (!path || path.length > 160 || path !== path.trim() || path.startsWith("/") || path.includes("\\")) return "Use a repository-relative path up to 160 characters.";
  if (["://", ":", "?", "#", "%"].some((token) => path.includes(token))) return "URLs, query strings, fragments, and encoded paths are not allowed.";
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || !PATH_SEGMENT_PATTERN.test(part))) return "Path contains traversal or unsupported characters.";
  return null;
}

export function validateChallengePath(path: string): string | null {
  const baseError = validateReviewPath(path);
  if (baseError) return baseError;
  if (!path.startsWith(".patchbond/challenges/") || !/\.(txt|md|json)$/i.test(path)) return "Use a .txt, .md, or .json file under .patchbond/challenges/.";
  return null;
}

export function genToWei(value: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value)) throw new Error("Enter a positive GEN amount with at most 18 decimal places.");
  const [whole, fraction = ""] = value.split(".");
  const wei = BigInt(whole) * 10n ** 18n + BigInt((fraction + "0".repeat(18)).slice(0, 18));
  if (wei <= 0n) throw new Error("Bounty must be greater than zero.");
  return wei;
}

export function validateCaseDraft(draft: CaseDraft, connectedAddress?: string | null): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!CASE_ID_PATTERN.test(draft.caseId)) errors.caseId = "Use 1–64 lowercase letters, numbers, underscores, or hyphens.";
  if (!ADDRESS_PATTERN.test(draft.developerAddress) || /^0x0{40}$/i.test(draft.developerAddress)) errors.developerAddress = "Enter a nonzero 20-byte wallet address.";
  if (connectedAddress && connectedAddress.toLowerCase() === draft.developerAddress.toLowerCase()) errors.developerAddress = "Client and developer must be different wallets.";
  if (!OWNER_PATTERN.test(draft.repoOwner) || draft.repoOwner.includes("--") || draft.repoOwner.length > 39) errors.repoOwner = "Enter a lowercase GitHub owner name.";
  if (!REPO_PATTERN.test(draft.repoName) || draft.repoName.length > 100 || [".", ".."].includes(draft.repoName) || draft.repoName.endsWith(".git")) errors.repoName = "Enter a GitHub-safe repository name without .git.";
  if (!SHA_PATTERN.test(draft.baseCommitSha)) errors.baseCommitSha = "Commit must be exactly 40 lowercase hexadecimal characters.";
  if (!draft.vulnerabilitySpec.trim() || draft.vulnerabilitySpec !== draft.vulnerabilitySpec.trim() || draft.vulnerabilitySpec.length > MAX_SPEC_LENGTH || draft.vulnerabilitySpec.includes("\0")) errors.vulnerabilitySpec = "Required, trimmed, and at most 4,000 characters.";
  if (!draft.acceptanceCriteria.trim() || draft.acceptanceCriteria !== draft.acceptanceCriteria.trim() || draft.acceptanceCriteria.length > MAX_CRITERIA_LENGTH || draft.acceptanceCriteria.includes("\0")) errors.acceptanceCriteria = "Required, trimmed, and at most 4,000 characters.";
  if (draft.reviewPaths.length < 1 || draft.reviewPaths.length > 4) errors.reviewPaths = "Choose between 1 and 4 review paths.";
  else if (new Set(draft.reviewPaths).size !== draft.reviewPaths.length) errors.reviewPaths = "Review paths must be unique.";
  else if (draft.reviewPaths.reduce((sum, path) => sum + path.length, 0) > 512) errors.reviewPaths = "Combined review paths exceed 512 characters.";
  else {
    const pathError = draft.reviewPaths.map(validateReviewPath).find(Boolean);
    if (pathError) errors.reviewPaths = pathError;
  }
  if (!Number.isInteger(draft.challengeWindowSeconds) || draft.challengeWindowSeconds < MIN_CHALLENGE_SECONDS || draft.challengeWindowSeconds > MAX_CHALLENGE_SECONDS) errors.challengeWindowSeconds = "Choose a challenge window from 1 hour to 7 days.";
  try { genToWei(draft.bountyGen); } catch (error) { errors.bountyGen = error instanceof Error ? error.message : "Invalid bounty."; }
  return errors;
}

export function toCreateCaseInput(draft: CaseDraft): CreateCaseInput {
  const errors = validateCaseDraft(draft);
  if (Object.keys(errors).length) throw new Error("Case draft is invalid");
  return {
    caseId: draft.caseId,
    developerAddress: draft.developerAddress,
    repoOwner: draft.repoOwner,
    repoName: draft.repoName,
    baseCommitSha: draft.baseCommitSha,
    vulnerabilitySpec: draft.vulnerabilitySpec,
    acceptanceCriteria: draft.acceptanceCriteria,
    reviewPaths: [...draft.reviewPaths],
    challengeWindowSeconds: draft.challengeWindowSeconds,
    bountyWei: genToWei(draft.bountyGen),
  };
}

export function validateCaseId(caseId: string): boolean { return CASE_ID_PATTERN.test(caseId); }
export function validateCommitSha(sha: string): boolean { return SHA_PATTERN.test(sha); }
