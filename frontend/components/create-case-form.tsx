"use client";

import { useState, type FormEvent } from "react";
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

const STEP_LABELS = ["Source", "Remediation", "Agreement", "Review & fund"] as const;

export function ImmutableTermReview({ draft }: { draft: CaseDraft }) {
  return (
    <div className="review-sheet" aria-label="Immutable case review">
      <div className="review-head"><span>Immutable agreement</span><strong>{draft.repoOwner}/{draft.repoName}</strong></div>
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

function errorsForStep(draft: CaseDraft, address: string | null, step: number): ValidationErrors {
  const all = validateCaseDraft(draft, address);
  if (step === 4) return all;
  const keys: Array<keyof CaseDraft> = step === 1
    ? ["caseId", "repoOwner", "repoName", "baseCommitSha"]
    : step === 2
      ? ["vulnerabilitySpec", "acceptanceCriteria", "reviewPaths"]
      : ["developerAddress", "bountyGen", "challengeWindowSeconds"];
  return Object.fromEntries(keys.filter((key) => all[key]).map((key) => [key, all[key]])) as ValidationErrors;
}

function Stepper({ step }: { step: number }) {
  return <ol className="wizard-stepper" aria-label="Case creation progress">{STEP_LABELS.map((label, index) => {
    const number = index + 1;
    return <li key={label} className={number < step ? "complete" : number === step ? "current" : ""} aria-current={number === step ? "step" : undefined}><span>{number < step ? "✓" : `0${number}`}</span><strong>{label}</strong></li>;
  })}</ol>;
}

function StepHeading({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return <div className="step-heading"><p className="kicker">{eyebrow}</p><h2>{title}</h2><p>{note}</p></div>;
}

export function CreateCaseForm() {
  const [draft, setDraft] = useState<CaseDraft>(initialDraft);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [step, setStep] = useState(1);
  const [confirmed, setConfirmed] = useState(false);
  const wallet = useWallet();
  const tx = useCaseWrite();
  const config = getPublicConfig();

  const set = <K extends keyof CaseDraft>(key: K, value: CaseDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const next = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = errorsForStep(draft, wallet.address, step);
    setErrors(nextErrors);
    if (!Object.keys(nextErrors).length) setStep((current) => Math.min(4, current + 1));
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

  const renderSource = () => <fieldset className="wizard-panel"><StepHeading eyebrow="Step 01 / Source" title="Bind the repository." note="The base commit is the exact version the developer must remediate." /><div className="form-grid"><label>Case ID<input value={draft.caseId} onChange={(event) => set("caseId", event.target.value)} placeholder="openssl-cve-2026" autoComplete="off" /><FieldError value={errors.caseId} /></label><label>GitHub owner<input value={draft.repoOwner} onChange={(event) => set("repoOwner", event.target.value)} placeholder="organization" autoComplete="off" /><FieldError value={errors.repoOwner} /></label><label>Repository<input value={draft.repoName} onChange={(event) => set("repoName", event.target.value)} placeholder="repository" autoComplete="off" /><FieldError value={errors.repoName} /></label><label className="span-2">Base commit SHA<input className="mono" value={draft.baseCommitSha} onChange={(event) => set("baseCommitSha", event.target.value)} placeholder="40 lowercase hexadecimal characters" autoComplete="off" /><span className="field-help">Exact commit identity is authenticated before semantic review.</span><FieldError value={errors.baseCommitSha} /></label></div></fieldset>;
  const renderRemediation = () => <fieldset className="wizard-panel"><StepHeading eyebrow="Step 02 / Remediation" title="Describe what fixed means." note="Keep the requirement bounded, observable, and tied to the code paths validators should inspect." /><label>Vulnerability specification<textarea rows={5} value={draft.vulnerabilitySpec} onChange={(event) => set("vulnerabilitySpec", event.target.value)} placeholder="Describe the exact vulnerability at the committed base revision." /><span className="char-count">{draft.vulnerabilitySpec.length}/4,000</span><FieldError value={errors.vulnerabilitySpec} /></label><label>Acceptance criteria<textarea rows={5} value={draft.acceptanceCriteria} onChange={(event) => set("acceptanceCriteria", event.target.value)} placeholder="State the bounded, observable remediation requirements." /><span className="char-count">{draft.acceptanceCriteria.length}/4,000</span><FieldError value={errors.acceptanceCriteria} /></label><div className="path-editor"><span className="field-label">Review paths <small>1-4 repository-relative files</small></span>{draft.reviewPaths.map((path, index) => <div className="path-row" key={index}><input aria-label={`Review path ${index + 1}`} className="mono" value={path} onChange={(event) => set("reviewPaths", draft.reviewPaths.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder="src/security/auth.py" />{draft.reviewPaths.length > 1 && <button type="button" className="icon-button" aria-label={`Remove review path ${index + 1}`} onClick={() => set("reviewPaths", draft.reviewPaths.filter((_, itemIndex) => itemIndex !== index))}>x</button>}</div>)}{draft.reviewPaths.length < 4 && <button className="text-button" type="button" onClick={() => set("reviewPaths", [...draft.reviewPaths, ""])}>+ Add review path</button>}<FieldError value={errors.reviewPaths} /></div></fieldset>;
  const renderAgreement = () => <fieldset className="wizard-panel"><StepHeading eyebrow="Step 03 / Agreement" title="Set the economic boundary." note="The named developer, bounty, and challenge window become immutable with the case." /><div className="form-grid"><label>Developer wallet address<input className="mono" value={draft.developerAddress} onChange={(event) => set("developerAddress", event.target.value)} placeholder="0x..." autoComplete="off" /><span className="field-help">Must differ from the connected client wallet.</span><FieldError value={errors.developerAddress} /></label><label>Bounty amount in GEN<input inputMode="decimal" value={draft.bountyGen} onChange={(event) => set("bountyGen", event.target.value)} placeholder="0.01" /><span className="field-help">Transferred with case creation and held in escrow.</span><FieldError value={errors.bountyGen} /></label><label>Challenge duration<select value={draft.challengeWindowSeconds} onChange={(event) => set("challengeWindowSeconds", Number(event.target.value))}><option value={3_600}>1 hour</option><option value={21_600}>6 hours</option><option value={86_400}>24 hours</option><option value={259_200}>3 days</option><option value={604_800}>7 days</option></select><FieldError value={errors.challengeWindowSeconds} /></label></div></fieldset>;

  return <div className="wizard-shell"><Stepper step={step} />{step < 4 ? <form className="wizard-form" onSubmit={next} noValidate>{step === 1 && renderSource()}{step === 2 && renderRemediation()}{step === 3 && renderAgreement()}<div className="wizard-actions"><button type="button" className="button button-secondary" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1}>Back</button><button className="button button-primary" type="submit">{step === 3 ? "Review immutable terms" : "Continue"}<span aria-hidden="true">-&gt;</span></button></div></form> : <div className="wizard-review"><StepHeading eyebrow="Step 04 / Review & fund" title="These terms become immutable." note="Broadcasting locks the bounty and every term below. A material change requires a new case." /><ImmutableTermReview draft={draft} /><div className="review-support"><LiveContractNotice /><WalletControl /></div><label className="confirm-row"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I reviewed the repository, base commit, developer, criteria, paths, duration, and bounty. Lock these terms.</span></label>{tx.failure && <div className="failure-panel" role="alert"><strong>{tx.failure.title}</strong><p>{tx.failure.message}</p></div>}{tx.record && <TransactionStatusCard record={tx.record} />}<div className="wizard-actions"><button type="button" className="button button-secondary" onClick={() => { setStep(3); setConfirmed(false); }} disabled={tx.busy}>Edit agreement</button><button type="button" className="button button-primary" onClick={() => void broadcast()} disabled={!confirmed || !wallet.address || !wallet.networkMatches || !config.configured || tx.busy || tx.record?.stage === "Complete"}>{tx.busy ? "Reconciling transaction..." : `Fund ${draft.bountyGen} GEN and create case`}<span aria-hidden="true">-&gt;</span></button></div>{tx.record?.stage === "Complete" && <Link className="button button-primary" href={`/cases/${encodeURIComponent(draft.caseId)}`}>Open funded case <span aria-hidden="true">-&gt;</span></Link>}</div>}</div>;
}
