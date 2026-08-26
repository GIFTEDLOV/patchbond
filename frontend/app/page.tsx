import Link from "next/link";
import { LiveContractNotice } from "@/components/live-contract-notice";

const steps = [
  ["01", "Fund the exact fix", "Lock a GEN bounty to one repository, base commit, developer, and remediation brief."],
  ["02", "Submit one exact patch", "The developer accepts the terms and submits a lowercase 40-character commit SHA."],
  ["03", "Review authenticated code", "Independent validators retrieve the same commit-pinned source and assess the fix."],
  ["04", "Challenge, then settle", "Approved fixes enter a challenge window before developer payment is authorized."],
] as const;

export default function HomePage() {
  return (
    <>
      <LiveContractNotice />
      <section className="hero">
        <div className="eyebrow"><span /> Funded remediation, verifiable end to end</div>
        <h1>Security fixes deserve<br /><em>proof before payout.</em></h1>
        <p className="hero-copy">
          Security remediation escrow backed by authenticated code evidence and independent GenLayer adjudication.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/cases/new">Create a PatchBond <span aria-hidden="true">→</span></Link>
          <Link className="button button-secondary" href="/developer">Find a case</Link>
        </div>
        <div className="signal-line" aria-label="PatchBond trust sequence">
          <span>Immutable terms</span><i />
          <span>Commit-pinned evidence</span><i />
          <span>Independent review</span><i />
          <span>Finalized settlement</span>
        </div>
      </section>

      <section className="process" aria-labelledby="process-title">
        <div className="section-heading">
          <p className="kicker">How PatchBond works</p>
          <h2 id="process-title">A straight line from vulnerability to verified remediation.</h2>
        </div>
        <ol className="steps">
          {steps.map(([number, title, body]) => (
            <li key={number}>
              <span className="step-number">{number}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="why">
        <div>
          <p className="kicker">Why GenLayer</p>
          <h2>Code meaning cannot fit inside a conventional oracle.</h2>
        </div>
        <p>
          Traditional smart contracts can verify hashes and move funds, but cannot interpret whether an exact code patch materially satisfies a natural-language security remediation requirement. GenLayer makes that bounded interpretation independently reviewable—after PatchBond authenticates the evidence.
        </p>
      </section>
    </>
  );
}
