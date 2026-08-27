"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type { CalldataEncodable } from "genlayer-js/types";
import type { CaseAction } from "@/lib/action-policy";
import { availableActions, isDeadlineOpen } from "@/lib/action-policy";
import type { CaseRecord, SubmissionRecord, WriteMethod } from "@/lib/contract-api";
import { readCase, readSubmissionHistory } from "@/lib/genlayer-client";
import { countdown, formatDeadline, formatGen, shortHash } from "@/lib/format";
import { githubCommitUrl } from "@/lib/github";
import { validateCaseId, validateChallengePath, validateCommitSha } from "@/lib/validation";
import { useCaseWrite } from "@/hooks/use-case-write";
import type { ExpectedTransition } from "@/lib/transactions";
import { LiveContractNotice } from "./live-contract-notice";
import { TechnicalDetails } from "./technical-details";
import { TransactionStatusCard } from "./transaction-status";
import { WalletControl, useWallet } from "./wallet";

const STATUS_COPY: Record<CaseRecord["status"], { title: string; note: string; eyebrow: string }> = {
  OPEN: { eyebrow: "Funded case", title: "Awaiting developer", note: "The bounty is funded. The named developer can inspect and accept these immutable terms." },
  ACCEPTED: { eyebrow: "Terms accepted", title: "Developer accepted", note: "The developer can submit an exact patch commit for validator review." },
  PROVISIONAL_FIXED: { eyebrow: "Decision reached", title: "Fix provisionally approved", note: "Authenticated patch evidence satisfied the criteria. Settlement waits through the challenge window." },
  CHALLENGED: { eyebrow: "Challenge active", title: "Developer response due", note: "A repository-bound challenge is registered. The developer retains the full response window." },
  FINALIZED_DEVELOPER: { eyebrow: "Final outcome", title: "Fix approved", note: "Developer settlement is authorized in the finalized case state." },
  FINALIZED_CLIENT: { eyebrow: "Final outcome", title: "Client refund authorized", note: "The case resolved to the client and the original bounty is authorized for refund." },
};

const LIFECYCLE = [
  ["OPEN", "Funded"], ["ACCEPTED", "Accepted"], ["PATCH", "Patch submitted"],
  ["PROVISIONAL_FIXED", "Decision"], ["CHALLENGE", "Challenge"], ["FINAL", "Finalized"],
] as const;

function lifecycleIndex(status: CaseRecord["status"]): number {
  if (status === "OPEN") return 0;
  if (status === "ACCEPTED") return 1;
  if (status === "PROVISIONAL_FIXED") return 3;
  if (status === "CHALLENGED") return 4;
  return 5;
}

function LifecycleRail({ status }: { status: CaseRecord["status"] }) {
  const current = lifecycleIndex(status);
  return <ol className="lifecycle-rail" aria-label="Case lifecycle">{LIFECYCLE.map(([key, label], index) => <li key={key} className={index < current ? "complete" : index === current ? "current" : ""}><span aria-hidden="true">{index < current ? "✓" : String(index + 1).padStart(2, "0")}</span><small>{label}</small></li>)}</ol>;
}

function ExactValue({ value }: { value: string }) { return <code className="breakable" title={value}>{shortHash(value)}</code>; }

export function StatusSummary({ caseRecord, nowSeconds }: { caseRecord: CaseRecord; nowSeconds: number }) {
  const copy = STATUS_COPY[caseRecord.status];
  const deadline = caseRecord.status === "PROVISIONAL_FIXED" ? caseRecord.challenge_deadline : caseRecord.status === "CHALLENGED" ? caseRecord.response_deadline : 0;
  return <section className={`status-banner status-${caseRecord.status.toLowerCase()}`}><div className="status-copy"><p className="kicker">{copy.eyebrow}</p><h2>{copy.title}</h2><p>{copy.note}</p></div>{deadline > 0 && <div className="deadline-card"><span>{caseRecord.status === "PROVISIONAL_FIXED" ? "Challenge deadline" : "Response deadline"}</span><strong>{countdown(deadline, nowSeconds)}</strong><small>{formatDeadline(deadline)}</small></div>}{caseRecord.status.startsWith("FINALIZED") && <div className="settled-stamp"><span>Finality confirmed</span><strong>{caseRecord.settlement_status === "AUTHORIZED_FINALIZED_ONLY" ? "Settlement authorized" : "Reconciliation required"}</strong><small>Stored state: {caseRecord.status}</small></div>}</section>;
}

export function CaseFacts({ caseRecord }: { caseRecord: CaseRecord }) {
  const baseUrl = githubCommitUrl(caseRecord.repo_owner, caseRecord.repo_name, caseRecord.base_commit_sha);
  return <section className="case-facts" aria-labelledby="terms-title"><div className="module-header"><div><p className="kicker">Immutable terms</p><h2 id="terms-title">What the bounty requires</h2></div><span className="section-index">CONTRACT-BOUND</span></div><dl className="fact-grid"><div><dt>Repository</dt><dd>{caseRecord.repo_owner}/{caseRecord.repo_name}</dd></div><div><dt>Base commit</dt><dd>{baseUrl ? <a href={baseUrl} target="_blank" rel="noopener noreferrer"><ExactValue value={caseRecord.base_commit_sha} /> <span aria-hidden="true">↗</span></a> : <ExactValue value={caseRecord.base_commit_sha} />}</dd></div><div><dt>Developer</dt><dd><ExactValue value={caseRecord.developer_address} /></dd></div><div><dt>Client</dt><dd><ExactValue value={caseRecord.client_address} /></dd></div></dl><div className="terms-copy"><article><h3>Vulnerability</h3><p>{caseRecord.vulnerability_spec}</p></article><article><h3>Acceptance criteria</h3><p>{caseRecord.acceptance_criteria}</p></article></div><div className="review-paths"><h3>Review paths</h3><ul>{caseRecord.review_paths.map((path) => <li key={path}><code>{path}</code></li>)}</ul></div></section>;
}

function SubmissionHistory({ caseRecord, submissions }: { caseRecord: CaseRecord; submissions: SubmissionRecord[] }) {
  if (!submissions.length) return <div className="empty-inline">No patch has been submitted.</div>;
  return <ol className="submission-list">{submissions.map((submission, index) => { const commitUrl = githubCommitUrl(caseRecord.repo_owner, caseRecord.repo_name, submission.patch_commit_sha); return <li key={submission.submission_id}><span className="submission-index">{String(index + 1).padStart(2, "0")}</span><div><strong>{submission.verdict === "FIXED" ? "Fix demonstrated" : submission.verdict === "NOT_FIXED" ? "Criteria not satisfied" : "Assessment inconclusive"}</strong><span>{commitUrl ? <a href={commitUrl} target="_blank" rel="noopener noreferrer"><ExactValue value={submission.patch_commit_sha} /> ↗</a> : <ExactValue value={submission.patch_commit_sha} />}</span></div><span className={`verdict verdict-${submission.verdict.toLowerCase()}`}>{submission.verdict.replace("_", " ")}</span></li>; })}</ol>;
}

interface ActionExecution { method: WriteMethod; args: CalldataEncodable[]; expected: ExpectedTransition; expectedStatus: CaseRecord["status"]; role?: "client" | "developer"; deadline?: number; }

function ActionPanel({ caseRecord, nowSeconds, onReload }: { caseRecord: CaseRecord; nowSeconds: number; onReload(): Promise<void> }) {
  const wallet = useWallet();
  const actions = useMemo(() => availableActions(caseRecord, wallet.address, nowSeconds), [caseRecord, wallet.address, nowSeconds]);
  const tx = useCaseWrite();
  const [sha, setSha] = useState("");
  const [challengePath, setChallengePath] = useState(".patchbond/challenges/");
  const [inputError, setInputError] = useState("");

  const execute = async (execution: ActionExecution) => {
    setInputError("");
    try {
      const result = await tx.run({ method: execution.method, caseId: caseRecord.case_id, args: execution.args, expected: execution.expected, precondition: async () => { const fresh = await readCase(caseRecord.case_id); if (fresh.status !== execution.expectedStatus) throw new Error(`Case state changed to ${fresh.status}`); if (execution.role && wallet.address?.toLowerCase() !== fresh[execution.role === "client" ? "client_address" : "developer_address"].toLowerCase()) throw new Error(`Connected wallet is not the ${execution.role}`); if (execution.deadline !== undefined && !isDeadlineOpen(Math.floor(Date.now() / 1_000), execution.deadline)) throw new Error("The action window has closed"); } });
      if (result.stage === "Complete") await onReload();
    } catch (error) { setInputError(error instanceof Error ? error.message : "Action failed"); }
  };

  if (!wallet.address) return <section className="action-panel"><p className="kicker">Current action</p><h2>Connect to continue</h2><p>PatchBond rereads the contract and checks the caller before every write.</p><WalletControl /></section>;
  if (!wallet.networkMatches) return <section className="action-panel"><p className="kicker">Wallet check</p><h2>Switch to Bradbury</h2><p>No transaction can be broadcast from the current wallet network.</p><WalletControl /></section>;
  if (!actions.length) return <section className="action-panel action-muted"><p className="kicker">Current action</p><h2>Nothing to sign right now</h2><p>The contract state and connected role do not permit a write right now.</p><WalletControl /></section>;

  const action = actions[0];
  const isShaAction = ["SUBMIT_PATCH", "CHALLENGE", "RESPOND"].includes(action);
  const validateInputs = () => { if (isShaAction && !validateCommitSha(sha)) return "Commit must be exactly 40 lowercase hexadecimal characters."; if (action === "CHALLENGE") return validateChallengePath(challengePath) ?? ""; return ""; };
  const submit = (event: FormEvent) => { event.preventDefault(); const validation = validateInputs(); if (validation) { setInputError(validation); return; } const common = { expectedStatus: caseRecord.status } as const; if (action === "ACCEPT") void execute({ ...common, method: "accept_case", args: [caseRecord.case_id], expected: { allowedStatuses: ["ACCEPTED"] }, role: "developer" }); if (action === "SUBMIT_PATCH") void execute({ ...common, method: "submit_patch", args: [caseRecord.case_id, sha], expected: { allowedStatuses: ["ACCEPTED", "PROVISIONAL_FIXED"], previousActiveSubmissionId: caseRecord.active_submission_id }, role: "developer" }); if (action === "CHALLENGE") void execute({ ...common, method: "challenge", args: [caseRecord.case_id, sha, challengePath], expected: { allowedStatuses: ["CHALLENGED"] }, role: "client", deadline: caseRecord.challenge_deadline }); if (action === "RESPOND") void execute({ ...common, method: "respond_to_challenge", args: [caseRecord.case_id, sha], expected: { allowedStatuses: ["CHALLENGED", "FINALIZED_DEVELOPER", "FINALIZED_CLIENT"], previousActiveSubmissionId: caseRecord.active_submission_id, settlementStatuses: ["FINALIZED_DEVELOPER", "FINALIZED_CLIENT"] }, role: "developer", deadline: caseRecord.response_deadline }); if (action === "FINALIZE") void execute({ ...common, method: "finalize_uncontested", args: [caseRecord.case_id], expected: { allowedStatuses: ["FINALIZED_DEVELOPER"], requiresSettlement: true, settlementRecipient: caseRecord.developer_address } }); if (action === "REFUND") void execute({ ...common, method: "authorize_client_refund", args: [caseRecord.case_id], expected: { allowedStatuses: ["FINALIZED_CLIENT"], requiresSettlement: true, settlementRecipient: caseRecord.client_address } }); };

  const actionCopy: Record<CaseAction, [string, string, string]> = { ACCEPT: ["Accept case", "Accept immutable terms", "Acceptance changes no term and unlocks patch submission."], SUBMIT_PATCH: ["Submit patch", "Submit exact patch commit", "PatchBond retrieves the committed repository and exact commit itself."], CHALLENGE: ["Challenge result", "Submit repository-bound challenge", "The artifact is authenticated to this repository and commit; validators still judge its substance."], RESPOND: ["Respond", "Submit response patch", "The response remains bound to the original vulnerability and acceptance criteria."], FINALIZE: ["Finalize fix", "Authorize developer settlement", "The challenge window has closed. Finalization selects the developer and exact bounty."], REFUND: ["Authorize refund", "Authorize client refund", "The guaranteed response window has closed without a terminal response."] };
  const [button, title, note] = actionCopy[action];
  return <section className="action-panel"><div className="action-heading"><div><p className="kicker">Current action / wallet authorized</p><h2>{title}</h2></div><span className="action-code">{action}</span></div><p>{note}</p><form onSubmit={submit} noValidate>{isShaAction && <label>{action === "CHALLENGE" ? "Challenge commit SHA" : action === "RESPOND" ? "Response patch SHA" : "Patch commit SHA"}<input className="mono" value={sha} onChange={(event) => { setSha(event.target.value); setInputError(""); }} placeholder="40 lowercase hexadecimal characters" autoComplete="off" /></label>}{action === "CHALLENGE" && <label>Challenge path<input className="mono" value={challengePath} onChange={(event) => { setChallengePath(event.target.value); setInputError(""); }} autoComplete="off" /><span className="field-help">Must be a committed .txt, .md, or .json file under .patchbond/challenges/ in the same repository.</span></label>}{inputError && <p className="field-error" role="alert">{inputError}</p>}{tx.failure && <div className="failure-panel" role="alert"><strong>{tx.failure.title}</strong><p>{tx.failure.message}</p></div>}{tx.record && <TransactionStatusCard record={tx.record} />}<button className="button button-primary" type="submit" disabled={tx.busy || tx.record?.stage === "Complete"}>{tx.busy ? "Reconciling transaction..." : button}<span aria-hidden="true">→</span></button></form></section>;
}

function CaseTechnicalDetails({ caseRecord, submissions }: { caseRecord: CaseRecord; submissions: SubmissionRecord[] }) {
  return <TechnicalDetails><dl className="technical-grid"><div><dt>Case status identifier</dt><dd><code>{caseRecord.status}</code></dd></div><div><dt>Base commit SHA</dt><dd><code className="breakable">{caseRecord.base_commit_sha}</code></dd></div><div><dt>Active submission ID</dt><dd><code>{caseRecord.active_submission_id || "None"}</code></dd></div><div><dt>Challenge deadline</dt><dd><code>{caseRecord.challenge_deadline}</code></dd></div><div><dt>Response deadline</dt><dd><code>{caseRecord.response_deadline}</code></dd></div><div><dt>Settlement status</dt><dd><code>{caseRecord.settlement_status}</code></dd></div><div><dt>Settlement recipient</dt><dd><code className="breakable">{caseRecord.settlement_recipient}</code></dd></div><div><dt>Settlement amount (wei)</dt><dd><code>{caseRecord.settlement_amount.toString()}</code></dd></div>{submissions.map((submission) => <div key={submission.submission_id}><dt>{submission.submission_id} evidence digest</dt><dd><code className="breakable">{submission.evidence_manifest_digest}</code></dd></div>)}</dl></TechnicalDetails>;
}

function ProofLayers({ caseRecord, submission }: { caseRecord: CaseRecord; submission?: SubmissionRecord }) {
  const settlementAuthorized = caseRecord.settlement_status === "AUTHORIZED_FINALIZED_ONLY";
  return <div className="proof-layers"><section className="proof-layer"><div className="proof-layer-header"><span>01</span><div><p className="kicker">Evidence authentication</p><h2>Exact source, exact scope.</h2></div><strong>COMMIT-BOUND</strong></div><dl className="proof-layer-grid"><div><dt>Repository</dt><dd>{caseRecord.repo_owner}/{caseRecord.repo_name}</dd></div><div><dt>Base commit</dt><dd><ExactValue value={caseRecord.base_commit_sha} /></dd></div><div><dt>Patch commit</dt><dd>{submission ? <ExactValue value={submission.patch_commit_sha} /> : "Not submitted"}</dd></div><div><dt>Review path</dt><dd>{caseRecord.review_paths.join(", ")}</dd></div><div className="span-2"><dt>Evidence manifest digest</dt><dd>{submission ? <ExactValue value={submission.evidence_manifest_digest} /> : "Not available"}</dd></div></dl><div className="proof-requirement"><dt>Funded requirement</dt><p>{caseRecord.vulnerability_spec}</p><dt>Acceptance criteria</dt><p>{caseRecord.acceptance_criteria}</p></div></section><section className="proof-layer"><div className="proof-layer-header"><span>02</span><div><p className="kicker">Semantic interpretation</p><h2>What the patch means.</h2></div><strong>BOUNDED OUTPUT</strong></div><div className="proof-decision"><span className={`verdict verdict-${submission?.verdict?.toLowerCase() ?? "inconclusive"}`}>{submission?.verdict ?? "NO SUBMISSION"}</span><p>Validators independently assess the authenticated evidence against the immutable requirement. Model output cannot choose a recipient or amount.</p></div></section><section className="proof-layer"><div className="proof-layer-header"><span>03</span><div><p className="kicker">Consensus + finality</p><h2>Irreversible state.</h2></div><strong>{caseRecord.status.startsWith("FINALIZED") ? "FINALIZED" : "PENDING"}</strong></div><div className="proof-decision"><span className="proof-check">{caseRecord.status.startsWith("FINALIZED") ? "✓" : "·"}</span><p>{caseRecord.status.startsWith("FINALIZED") ? "The contract reports a finalized terminal state. Consensus is agreement about interpretation; it does not authenticate evidence." : "The case is not yet in a finalized terminal state."}</p></div></section><section className="proof-layer"><div className="proof-layer-header"><span>04</span><div><p className="kicker">State consequence</p><h2>Money follows the state.</h2></div><strong>{settlementAuthorized ? "AUTHORIZED" : "NOT AUTHORIZED"}</strong></div><dl className="proof-layer-grid"><div><dt>Final stored state</dt><dd>{caseRecord.status}</dd></div><div><dt>Recipient</dt><dd><ExactValue value={caseRecord.settlement_recipient} /></dd></div><div><dt>Authorized amount</dt><dd>{caseRecord.settlement_amount > 0n ? formatGen(caseRecord.settlement_amount) : "None"}</dd></div><div><dt>Settlement record</dt><dd>{settlementAuthorized ? "Authorization recorded" : "No settlement authorization"}</dd></div></dl><p className="proof-disclaimer">A stored terminal state is separate from external transfer reconciliation. Confirm the transfer through the published proof artifact when one is available.</p></section></div>;
}

export function VerificationView({ caseRecord, submissions, nowSeconds }: { caseRecord: CaseRecord; submissions: SubmissionRecord[]; nowSeconds: number }) {
  const submission = submissions.find((item) => item.submission_id === caseRecord.active_submission_id) ?? submissions.at(-1);
  return <><div className="verification-certificate"><span className="verification-certificate-mark">✓</span><div><p className="kicker">Public verification certificate</p><h2>Read the result without a wallet.</h2><p>One read-only view of the evidence boundary, interpretation, finality, and settlement consequence.</p></div></div><StatusSummary caseRecord={caseRecord} nowSeconds={nowSeconds} /><LifecycleRail status={caseRecord.status} /><ProofLayers caseRecord={caseRecord} submission={submission} /><section className="audit-section"><div className="module-header"><div><p className="kicker">Public audit</p><h2>Patch and verdict history</h2></div><span className="section-index">READ ONLY</span></div><SubmissionHistory caseRecord={caseRecord} submissions={submissions} />{caseRecord.challenge_commit_sha && <div className="challenge-record"><h3>Challenge registered</h3><dl><div><dt>Commit</dt><dd><ExactValue value={caseRecord.challenge_commit_sha} /></dd></div><div><dt>Path</dt><dd><code>{caseRecord.challenge_path}</code></dd></div><div><dt>Evidence digest</dt><dd><ExactValue value={caseRecord.challenge_evidence_digest} /></dd></div></dl></div>}</section><section className="trust-statement"><strong>What consensus proves</strong><p>Consensus proves validator agreement about interpretation. Repository and commit provenance are verified before semantic evaluation; consensus itself does not authenticate evidence.</p></section><CaseTechnicalDetails caseRecord={caseRecord} submissions={submissions} /></>;
}

export function CaseScreen({ caseId, verify = false }: { caseId: string; verify?: boolean }) {
  const [caseRecord, setCaseRecord] = useState<CaseRecord | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1_000));
  const load = useCallback(async () => { if (!validateCaseId(caseId)) { setError("Invalid case ID. Use the exact lowercase identifier."); setLoading(false); return; } setLoading(true); setError(""); try { const record = await readCase(caseId); const history = await readSubmissionHistory(record); setCaseRecord(record); setSubmissions(history); } catch (caught) { setError(caught instanceof Error ? caught.message : "Case could not be read"); } finally { setLoading(false); } }, [caseId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { const interval = window.setInterval(() => setNow(Math.floor(Date.now() / 1_000)), 30_000); return () => window.clearInterval(interval); }, []);
  if (loading) return <div className="page-shell"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-panel" /></div>;
  if (error || !caseRecord) return <div className="page-shell narrow"><LiveContractNotice /><div className="empty-state"><p className="kicker">Case unavailable</p><h1>No authoritative case state loaded.</h1><p>{error}</p><button className="button button-secondary" type="button" onClick={() => void load()}>Try read again</button></div></div>;
  return <div className={`case-shell ${verify ? "verification-page" : ""}`}><header className="case-heading"><div><p className="kicker">{verify ? "Public verification" : "PatchBond case"}</p><h1>{caseRecord.case_id}</h1><p>{caseRecord.repo_owner}/{caseRecord.repo_name}</p></div><div className="case-heading-actions">{!verify && <Link className="text-link" href={`/verify/${encodeURIComponent(caseRecord.case_id)}`}>Public verification <span aria-hidden="true">↗</span></Link>}<strong className="case-bounty">{formatGen(caseRecord.bounty_amount)}</strong></div></header>{verify ? <VerificationView caseRecord={caseRecord} submissions={submissions} nowSeconds={now} /> : <><StatusSummary caseRecord={caseRecord} nowSeconds={now} /><LifecycleRail status={caseRecord.status} /><div className="case-workspace"><main className="case-main"><CaseFacts caseRecord={caseRecord} /><section className="audit-section compact-section"><div className="module-header"><div><p className="kicker">Assessment history</p><h2>Patch submissions</h2></div></div><SubmissionHistory caseRecord={caseRecord} submissions={submissions} /></section><CaseTechnicalDetails caseRecord={caseRecord} submissions={submissions} /></main><aside className="case-action-rail"><ActionPanel caseRecord={caseRecord} nowSeconds={now} onReload={load} /></aside></div></>}</div>;
}
