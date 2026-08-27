import Link from "next/link";
const steps = [
  ["Fund", "Lock the terms."],
  ["Bind evidence", "Fix the repository and commit."],
  ["Adjudicate", "Interpret the bounded requirement."],
  ["Challenge", "Keep FIXED provisional."],
  ["Finalize", "Wait for irreversible state."],
  ["Settle", "Move the exact bounty."],
] as const;

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-grid">
          <div className="hero-copy-column"><div className="eyebrow"><span className="eyebrow-pulse" /> Funded security remediation</div><p className="hero-index">PATCHBOND / TRUSTED ESCROW</p><h1 id="hero-title">Proof before<br /><em>payout.</em></h1><p className="hero-copy">Fund a security remediation, bind it to exact code, and release the bounty only after authenticated evidence, independent adjudication, and finality.</p><div className="hero-actions"><Link className="button button-primary" href="/cases/new">Create a case <span aria-hidden="true">-&gt;</span></Link><Link className="button button-secondary" href="/verify/stage4-commitgate-20260826d">View verified case <span aria-hidden="true">&#8599;</span></Link></div><div className="hero-footnote"><span className="signal-dot" /> No uploaded proof. No mutable branch. No unilateral payout.</div></div>
          <article className="proof-card" aria-labelledby="proof-title"><div className="proof-card-header"><div><p className="kicker">Live Bradbury proof</p><h2 id="proof-title">A finalized remediation case.</h2></div><span className="proof-state">FINALIZED</span></div><dl className="proof-card-meta"><div><dt>Case</dt><dd className="mono breakable">stage4-commitgate-20260826d</dd></div><div><dt>Repository</dt><dd>GIFTEDLOV/commitgate</dd></div></dl><div className="proof-result"><span className="proof-check" aria-hidden="true">&#10003;</span><div><span className="proof-label">Stored verdict</span><strong>FIXED</strong><span>5 / 5 validators agree</span></div></div><dl className="proof-facts"><div><dt>Bounty</dt><dd>0.01 GEN</dd></div><div><dt>State</dt><dd>FINALIZED_DEVELOPER</dd></div><div><dt>Settlement</dt><dd>Reconciled</dd></div><div><dt>Evidence</dt><dd className="mono">manifest digest</dd></div></dl><Link className="proof-link" href="/verify/stage4-commitgate-20260826d">View public proof <span aria-hidden="true">&#8599;</span></Link></article>
        </div>
      </section>

      <section className="workflow-section" aria-labelledby="process-title"><div className="section-heading"><div><p className="kicker">The PatchBond protocol</p><span className="section-index">FROM TERMS TO CONSEQUENCE</span></div><h2 id="process-title">A security fix becomes payable only after its story is complete.</h2></div><ol className="workflow-rail">{steps.map(([title, body], index) => <li key={title} className={index === 2 ? "workflow-step workflow-step-focus" : "workflow-step"}><span className="step-number">{String(index + 1).padStart(2, "0")}</span><div className="step-connector" aria-hidden="true" /><h3>{title}</h3><p>{body}</p></li>)}</ol></section>

      <section className="trust-section" aria-labelledby="trust-title"><div className="trust-emblem" aria-hidden="true"><span>PB</span><i /></div><div><p className="kicker">The trust boundary</p><h2 id="trust-title">Consensus proves agreement about interpretation.</h2><p>Repository and commit provenance are verified before semantic evaluation. Consensus itself does not authenticate evidence.</p></div><Link className="text-link" href="/verify/stage4-commitgate-20260826d">See the certificate <span aria-hidden="true">&#8599;</span></Link></section>

      <section className="why-section"><div><p className="kicker">Why PatchBond</p><h2>Hash checks can prove what code is. They cannot decide what the code means.</h2></div><div className="why-copy"><p>PatchBond separates the jobs. The contract fixes the terms and authenticates the repository. GenLayer validators independently interpret the bounded remediation request. Finality controls the consequence.</p><div className="principle-list"><span><b>01</b> Evidence is authenticated</span><span><b>02</b> Meaning is independently assessed</span><span><b>03</b> Funds move after finality</span></div></div></section>
    </div>
  );
}
