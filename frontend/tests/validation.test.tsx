import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImmutableTermReview } from "@/components/create-case-form";
import { githubCommitUrl } from "@/lib/github";
import { genToWei, validateCaseDraft, validateChallengePath, type CaseDraft } from "@/lib/validation";
import { BASE_SHA, DEVELOPER } from "./fixtures";

const validDraft: CaseDraft = {
  caseId: "auth-cve-2026",
  developerAddress: DEVELOPER,
  repoOwner: "patchbond",
  repoName: "secure-repo",
  baseCommitSha: BASE_SHA,
  vulnerabilitySpec: "Forged sessions are accepted.",
  acceptanceCriteria: "Reject tokens without a valid signature.",
  reviewPaths: ["src/auth.py", "tests/test_auth.py"],
  challengeWindowSeconds: 86_400,
  bountyGen: "25.5",
};

describe("create-case validation and immutable review", () => {
  it("accepts a contract-compatible case and converts GEN exactly", () => {
    expect(validateCaseDraft(validDraft)).toEqual({});
    expect(genToWei("25.5")).toBe(25_500_000_000_000_000_000n);
  });

  it("rejects malformed commit, traversal, duplicate paths, oversized terms, and same participant", () => {
    const errors = validateCaseDraft({ ...validDraft, baseCommitSha: "ABC", vulnerabilitySpec: "x".repeat(4_001), reviewPaths: ["../secret", "../secret"] }, DEVELOPER);
    expect(errors.baseCommitSha).toBeDefined();
    expect(errors.vulnerabilitySpec).toBeDefined();
    expect(errors.reviewPaths).toBeDefined();
    expect(errors.developerAddress).toContain("different");
  });

  it("restricts challenge artifacts to the reserved repository path", () => {
    expect(validateChallengePath(".patchbond/challenges/regression.md")).toBeNull();
    expect(validateChallengePath("https://evil.test/proof.md")).not.toBeNull();
    expect(validateChallengePath(".patchbond/challenges/../proof.md")).not.toBeNull();
  });

  it("only builds GitHub links from contract-compatible repository and commit values", () => {
    expect(githubCommitUrl("patchbond", "secure-repo", BASE_SHA)).toBe(`https://github.com/patchbond/secure-repo/commit/${BASE_SHA}`);
    expect(githubCommitUrl("..", "secure-repo", BASE_SHA)).toBeNull();
    expect(githubCommitUrl("PatchBond", "secure-repo", BASE_SHA)).toBeNull();
    expect(githubCommitUrl("patchbond", "..", BASE_SHA)).toBeNull();
  });

  it("renders every immutable term before broadcast", () => {
    render(<ImmutableTermReview draft={validDraft} />);
    expect(screen.getByText("patchbond/secure-repo")).toBeInTheDocument();
    expect(screen.getByText(BASE_SHA)).toBeInTheDocument();
    expect(screen.getByText("25.5 GEN")).toBeInTheDocument();
    expect(screen.getByText("tests/test_auth.py")).toBeInTheDocument();
    expect(screen.getByText(validDraft.acceptanceCriteria)).toBeInTheDocument();
  });
});
