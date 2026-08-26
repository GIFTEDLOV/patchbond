import type { CaseRecord } from "./contract-api";

export type CaseAction = "ACCEPT" | "SUBMIT_PATCH" | "CHALLENGE" | "RESPOND" | "FINALIZE" | "REFUND";

export function isDeadlineOpen(nowSeconds: number, deadlineSeconds: number): boolean {
  return nowSeconds <= deadlineSeconds;
}

export function availableActions(caseRecord: CaseRecord, walletAddress: string | null, nowSeconds: number): CaseAction[] {
  if (!walletAddress) return [];
  const wallet = walletAddress.toLowerCase();
  const isClient = wallet === caseRecord.client_address.toLowerCase();
  const isDeveloper = wallet === caseRecord.developer_address.toLowerCase();
  if (caseRecord.status === "OPEN") return isDeveloper ? ["ACCEPT"] : [];
  if (caseRecord.status === "ACCEPTED") return isDeveloper ? ["SUBMIT_PATCH"] : [];
  if (caseRecord.status === "PROVISIONAL_FIXED") {
    if (isDeadlineOpen(nowSeconds, caseRecord.challenge_deadline)) return isClient ? ["CHALLENGE"] : [];
    return ["FINALIZE"];
  }
  if (caseRecord.status === "CHALLENGED") {
    if (isDeadlineOpen(nowSeconds, caseRecord.response_deadline)) return isDeveloper ? ["RESPOND"] : [];
    return ["REFUND"];
  }
  return [];
}
