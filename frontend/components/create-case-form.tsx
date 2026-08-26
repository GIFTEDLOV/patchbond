"use client";

import { useState } from "react";
import Link from "next/link";
import { WalletControl, useWallet } from "./wallet";
import { LiveContractNotice } from "./live-contract-notice";
import { TransactionStatusCard } from "./transaction-status";
import { useCaseWrite } from "@/hooks/use-case-write";
import { createCaseArgs, readCase } from "@/lib/genlayer-client";
import { getPublicConfig } from "@/lib/config";
import { toCreateCaseInput, validateCaseDraft, type CaseDraft, type ValidationErrors } from "@/lib/validation";

const initialDraft: CaseDraft = {
  caseId: "", developerAddress: "", repoOwner: "", repoName: "", baseCommitSha: "",
  vulnerabilitySpec: "", acceptanceCriteria: "", reviewPaths: [""], challengeWindowSeconds: 86_400, bountyGen: "",
};

export function ImmutableTermReview({ draft }: { draft: CaseDraft }) {
  return (
    <div className="review-sheet" aria-label="Immutable case review">
      <div className="review-head"><span>Repository</span><strong>{draft.repoOwner}/{draft.repoName}</strong></div>
      <dl>
        <div><dt>Case ID</dt><dd>{draft.caseId}</dd></div>
        <div><dt>Base commit</dt><dd className="mono breakable">{draft.baseCommitSha}</dd></div>
        <div><dt>Developer</dt><dd className="mono breakable">{draft.developerAddress}</dd></div>
        <div><dt>Bounty locked</dt><dd>{draft.bountyGen} GEN</dd></div>
        <div><dt>Challenge window</dt><dd>{draft.challengeWindowSeconds / 3_600} hours</dd></div>
      </dl>
      <div className="review-copy"><h3>Vulnerability</h3><p>{draft.vulnerabilitySpec}</p></div>
      <div className="review-copy"><h3>Acceptance criteria</h3><p>{draft.acceptanceCriteria}</p></div>
      <div className="review-copy"><h3>Review paths</h3><ul>{draft.reviewPaths.map((path) => <li key={path}><code>{path}</code></li>)}</ul></div>
    </div>
  );
}

function FieldError({ value }: { value?: string }) { return value ? <p className="field-error" role="alert">{value}</p> : null; }

export function CreateCaseForm() {
  const [draft, setDraft] = useState<CaseDraft>(initialDraft);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [reviewing, setReviewing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const wallet = useWallet();
  const tx = useCaseWrite();
  const config = getPublicConfig();

  const set = <K extends keyof CaseDraft>(key: K, value: CaseDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const review = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateCaseDraft(draft, wallet.address);
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) setReviewing(true);
  };
  const broadcast = async () => {
    const input = toCreateCaseInput(draft);
    await tx.run({
      method: "create_case",
      caseId: input.caseId,
      args: createCaseArgs(input),
      value: input.bountyWei,
      expected: { allowedStatuses: ["OPEN"] },
      precondition: async () => {
        const currentErrors = validateCaseDraft(draft, wallet.address);
        if (Object.keys(currentErrors).length) throw new Error("Case terms changed and must be reviewed again");
        try {
          await readCase(input.caseId);
          throw new Error("A case with this ID already exists");
        } catch (error) {
          if (error instanceof Error && /CASE_NOT_FOUND/i.test(error.message)) return;
          throw error;
        }
      },
    });
  };

  if (reviewing) return (
    <div className="flow-stack">
      <div className="page-intro compact"><p className="kicker">Final review</p><h1>These terms become immutable.</h1><p>Broadcasting locks the bounty and every term below. A material change requires a new case.</p></div>
      <ImmutableTermReview draft={draft} />
      <LiveContractNotice />
      <WalletControl />
      <label className="confirm-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I reviewed the repository, base commit, developer, criteria, paths, duration, and bounty. Lock these terms.</span></label>
      {tx.failure && <div className="failure-panel" role="alert"><strong>{tx.failure.title}</strong><p>{tx.failure.message}</p></div>}
      {tx.record && <TransactionStatusCard record={tx.record} />}
      <div className="form-actions">
        <button type="button" className="button button-secondary" onClick={() => { setReviewing(false); setConfirmed(false); }} disabled={tx.busy}>Edit terms</button>
        <button type="button" className="button button-primary" onClick={() => void broadcast()} disabled={!confirmed || !wallet.address || !wallet.networkMatches || !config.configured || tx.busy || tx.record?.stage === "Complete"}>
          {tx.busy ? "Reconciling transaction…" : `Fund ${draft.bountyGen} GEN and create case`}
        </button>
      </div>
      {tx.record?.stage === "Complete" && <Link className="button button-primary" href={`/cases/${encodeURIComponent(draft.caseId)}`}>Open funded case →</Link>}
    </div>
  );

  return (
    <form className="case-form" onSubmit={review} noValidate>
      <fieldset><legend>Identity and repository</legend>
        <div className="form-grid">
          <label>Case ID<input value={draft.caseId} onChange={(event) => set("caseId", event.target.value)} placeholder="openssl-cve-2026" /><FieldError value={errors.caseId} /></label>
          <label>Developer wallet address<input className="mono" value={draft.developerAddress} onChange={(event) => set("developerAddress", event.target.value)} placeholder="0x…" /><FieldError value={errors.developerAddress} /></label>
          <label>GitHub owner<input value={draft.repoOwner} onChange={(event) => set("repoOwner", event.target.value)} placeholder="organization" /><FieldError value={errors.repoOwner} /></label>
          <label>GitHub repository<input value={draft.repoName} onChange={(event) => set("repoName", event.target.value)} placeholder="repository" /><FieldError value={errors.repoName} /></label>
          <label className="span-2">Base commit SHA<input className="mono" value={draft.baseCommitSha} onChange={(event) => set("baseCommitSha", event.target.value)} placeholder="40 lowercase hexadecimal characters" /><FieldError value={errors.baseCommitSha} /></label>
        </div>
      </fieldset>
      <fieldset><legend>Remediation terms</legend>
        <label>Vulnerability specification<textarea rows={6} value={draft.vulnerabilitySpec} onChange={(event) => set("vulnerabilitySpec", event.target.value)} placeholder="Describe the exact vulnerability at the committed base revision." /><span className="char-count">{draft.vulnerabilitySpec.length}/4,000</span><FieldError value={errors.vulnerabilitySpec} /></label>
        <label>Acceptance criteria<textarea rows={6} value={draft.acceptanceCriteria} onChange={(event) => set("acceptanceCriteria", event.target.value)} placeholder="State the bounded, observable remediation requirements." /><span className="char-count">{draft.acceptanceCriteria.length}/4,000</span><FieldError value={errors.acceptanceCriteria} /></label>
        <div className="path-editor"><span className="field-label">Review paths (1–4)</span>{draft.reviewPaths.map((path, index) => <div className="path-row" key={index}><input aria-label={`Review path ${index + 1}`} className="mono" value={path} onChange={(event) => set("reviewPaths", draft.reviewPaths.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder="src/security/auth.py" />{draft.reviewPaths.length > 1 && <button type="button" className="icon-button" aria-label={`Remove review path ${index + 1}`} onClick={() => set("reviewPaths", draft.reviewPaths.filter((_, itemIndex) => itemIndex !== index))}>×</button>}</div>)}{draft.reviewPaths.length < 4 && <button className="text-button" type="button" onClick={() => set("reviewPaths", [...draft.reviewPaths, ""])}>+ Add review path</button>}<FieldError value={errors.reviewPaths} /></div>
      </fieldset>
      <fieldset><legend>Escrow and timing</legend><div className="form-grid">
        <label>Bounty amount in GEN<input inputMode="decimal" value={draft.bountyGen} onChange={(event) => set("bountyGen", event.target.value)} placeholder="25" /><span className="field-help">Locked when the case is created.</span><FieldError value={errors.bountyGen} /></label>
        <label>Challenge duration<select value={draft.challengeWindowSeconds} onChange={(event) => set("challengeWindowSeconds", Number(event.target.value))}><option value={3_600}>1 hour</option><option value={21_600}>6 hours</option><option value={86_400}>24 hours</option><option value={259_200}>3 days</option><option value={604_800}>7 days</option></select><FieldError value={errors.challengeWindowSeconds} /></label>
      </div></fieldset>
      <div className="immutability-note"><strong>Review before broadcast</strong><p>The repository, base commit, developer, specifications, paths, challenge duration, and bounty cannot be edited after creation.</p></div>
      <button className="button button-primary" type="submit">Review immutable terms <span aria-hidden="true">→</span></button>
    </form>
  );
}
