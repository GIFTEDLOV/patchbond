import Link from "next/link";
import { LiveContractNotice } from "@/components/live-contract-notice";

const steps = [
  ["01", "Fund", "Lock a bounty to one repository, base commit, developer, and remediation brief."],
  ["02", "Patch", "The developer accepts the terms and submits one exact commit SHA."],
  ["03", "Verify", "Validators retrieve the same commit-pinned source and assess the fix."],
  ["04", "Challenge", "A client can challenge a provisional FIXED result with bound evidence."],
  ["05", "Settle", "Only finality and verified stored state can authorize the bounty."],
] as const;

export default function HomePage() {
  return (
    <div className="home-page">
      <div className="home-alert"><LiveContractNotice /></div>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-grid">
          <div className="hero-copy-column">
            <div className="eyebrow"><span className="eyebrow-pulse" /> Funded security remediation</div>
            <p className="hero-index">PATCHBOND / 01</p>
            <h1 id="hero-title">Proof before<br /><em>payout.</em></h1>
            <p className="hero-copy">Fund a security fix, bind it to exact code evidence, and release the bounty only when independent adjudication reaches finality.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/cases/new">Create a PatchBond <span aria-hidden="true">-&gt;</span></Link>
              <Link className="button button-secondary" href="/developer">Find a case <span aria-hidden="true">&#8599;</span></Link>
            </div>
            <div className="hero-footnote"><span className="signal-dot" /> No uploaded proof. No mutable branch. No unilateral payout.</div>
          </div>
          <div className="hero-visual" aria-label="Conceptual PatchBond evidence to settlement sequence">
            <div className="hero-visual-top"><span>PROOF SYSTEM / FLOW</span><span className="mono">TRUST MODEL</span></div>
            <div className="evidence-console">
              <div className="console-header"><span className="console-lock" aria-hidden="true">&#8982;</span><span>Evidence ledger</span><span className="console-check">VERIFIED</span></div>
              <div className="console-repo"><span className="repo-icon" aria-hidden="true">&#8984;</span><div><strong>repository / commit</strong><span>bound before work begins</span></div><b>01</b></div>
              <div className="console-line"><i /><span>base revision</span><code>bound / exact</code></div>
              <div className="console-line"><i /><span>review scope</span><code>declared / bounded</code></div>
              <div className="console-line console-line-accent"><i /><span>evidence manifest</span><code>derived / recorded</code></div>
              <div className="console-divider" />
              <div className="console-consensus"><div className="consensus-orb">&#10003;</div><div><strong>Independent interpretation</strong><span>agreement is not authentication</span></div><span className="consensus-count">recorded</span></div>
            </div>
            <div className="hero-visual-footer"><span><i className="signal-dot" /> FINALITY GATE</span><strong>consequence follows proof</strong></div>
          </div>
        </div>
        <div className="trust-rail"><span>Immutable terms</span><i /><span>Commit-pinned evidence</span><i /><span>Independent review</span><i /><span>Finalized settlement</span></div>
      </section>

      <section className="workflow-section" aria-labelledby="process-title">
        <div className="section-heading"><div><p className="kicker">The PatchBond protocol</p><span className="section-index">01 - 05</span></div><h2 id="process-title">A security fix becomes payable only after its story is complete.</h2></div>
        <ol className="workflow-rail">
          {steps.map(([number, title, body], index) => <li key={number} className={index === 2 ? "workflow-step workflow-step-focus" : "workflow-step"}><span className="step-number">{number}</span><div className="step-connector" aria-hidden="true" /><h3>{title}</h3><p>{body}</p></li>)}
        </ol>
      </section>

      <section className="trust-section" aria-labelledby="trust-title">
        <div className="trust-emblem" aria-hidden="true"><span>PB</span><i /></div>
        <div><p className="kicker">The trust boundary</p><h2 id="trust-title">Consensus proves agreement about interpretation.</h2><p>Repository and commit provenance are verified before semantic evaluation. Consensus itself does not authenticate evidence.</p></div>
        <Link className="text-link" href="/verify/stage4-commitgate-20260826d">See a verified case <span aria-hidden="true">&#8599;</span></Link>
      </section>

      <section className="why-section"><div><p className="kicker">Why PatchBond</p><h2>Hash checks can prove what code is. They cannot decide what the code means.</h2></div><div className="why-copy"><p>PatchBond separates the jobs. The contract fixes the terms and authenticates the repository. GenLayer validators independently interpret the bounded remediation request. Finality controls the consequence.</p><div className="principle-list"><span><b>01</b> Evidence is authenticated</span><span><b>02</b> Meaning is independently assessed</span><span><b>03</b> Funds move after finality</span></div></div></section>
    </div>
  );
}
