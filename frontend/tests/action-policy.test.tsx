import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { availableActions, isDeadlineOpen } from "@/lib/action-policy";
import { StatusSummary } from "@/components/case-screen";
import { caseFixture, CLIENT, DEVELOPER, OTHER } from "./fixtures";

describe("role and state action visibility", () => {
  it("shows only the developer action in OPEN and ACCEPTED", () => {
    expect(availableActions(caseFixture(), DEVELOPER, 10)).toEqual(["ACCEPT"]);
    expect(availableActions(caseFixture(), CLIENT, 10)).toEqual([]);
    expect(availableActions(caseFixture({ status: "ACCEPTED", accepted: true }), DEVELOPER, 10)).toEqual(["SUBMIT_PATCH"]);
  });

  it("enforces the inclusive challenge deadline and permissionless finalizer", () => {
    const record = caseFixture({ status: "PROVISIONAL_FIXED", challenge_deadline: 100 });
    expect(availableActions(record, CLIENT, 99)).toEqual(["CHALLENGE"]);
    expect(availableActions(record, CLIENT, 100)).toEqual(["CHALLENGE"]);
    expect(availableActions(record, CLIENT, 101)).toEqual(["FINALIZE"]);
    expect(availableActions(record, OTHER, 101)).toEqual(["FINALIZE"]);
    expect(isDeadlineOpen(100, 100)).toBe(true);
  });

  it("enforces the inclusive response deadline and timeout refund", () => {
    const record = caseFixture({ status: "CHALLENGED", response_deadline: 200 });
    expect(availableActions(record, DEVELOPER, 199)).toEqual(["RESPOND"]);
    expect(availableActions(record, DEVELOPER, 200)).toEqual(["RESPOND"]);
    expect(availableActions(record, OTHER, 201)).toEqual(["REFUND"]);
    expect(availableActions(record, CLIENT, 199)).toEqual([]);
  });

  it("never shows actions in either terminal state", () => {
    expect(availableActions(caseFixture({ status: "FINALIZED_DEVELOPER" }), DEVELOPER, 1)).toEqual([]);
    expect(availableActions(caseFixture({ status: "FINALIZED_CLIENT" }), CLIENT, 1)).toEqual([]);
  });
});

describe.each([
  ["OPEN", "Awaiting developer"],
  ["ACCEPTED", "Developer accepted"],
  ["PROVISIONAL_FIXED", "Fix provisionally approved"],
  ["CHALLENGED", "Developer response due"],
  ["FINALIZED_DEVELOPER", "Fix approved"],
  ["FINALIZED_CLIENT", "Client refund authorized"],
] as const)("%s state", (status, label) => {
  it(`renders ${label}`, () => {
    render(<StatusSummary caseRecord={caseFixture({ status, challenge_deadline: status === "PROVISIONAL_FIXED" ? 100 : 0, response_deadline: status === "CHALLENGED" ? 100 : 0 })} nowSeconds={50} />);
    expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
  });
});
