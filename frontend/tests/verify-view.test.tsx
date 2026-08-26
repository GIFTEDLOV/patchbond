import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerificationView } from "@/components/case-screen";
import { caseFixture, DEVELOPER, PATCH_SHA } from "./fixtures";

describe("public verify rendering", () => {
  const record = caseFixture({
    status: "FINALIZED_DEVELOPER",
    accepted: true,
    active_submission_id: "case-1:1",
    provisional_submission_id: "case-1:1",
    settlement_recipient: DEVELOPER,
    settlement_amount: 25n * 10n ** 18n,
    settlement_status: "AUTHORIZED_FINALIZED_ONLY",
  });
  const submissions = [{ submission_id: "case-1:1", patch_commit_sha: PATCH_SHA, verdict: "FIXED" as const, evidence_manifest_digest: "d".repeat(64) }];

  it("shows human-readable identity, verdict history, settlement, and trust statement", () => {
    render(<VerificationView caseRecord={record} submissions={submissions} nowSeconds={100} />);
    expect(screen.getByText("Fix approved")).toBeInTheDocument();
    expect(screen.getByText("25 GEN")).toBeInTheDocument();
    expect(screen.getByText("Fix demonstrated")).toBeInTheDocument();
    expect(screen.getByText(/Consensus proves validator agreement about interpretation/)).toBeInTheDocument();
    expect(screen.getByText("Settlement authorized")).toBeInTheDocument();
  });

  it("keeps exact identifiers in a collapsed technical-details section", () => {
    render(<VerificationView caseRecord={record} submissions={submissions} nowSeconds={100} />);
    const details = screen.getByText("Technical details").closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByText("d".repeat(64))).toBeInTheDocument();
  });

  it("requires no wallet control", () => {
    render(<VerificationView caseRecord={record} submissions={submissions} nowSeconds={100} />);
    expect(screen.queryByText("Connect wallet")).not.toBeInTheDocument();
  });
});
