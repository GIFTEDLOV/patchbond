import { CaseLookup } from "@/components/case-lookup";
import { LiveContractNotice } from "@/components/live-contract-notice";
import { WalletControl } from "@/components/wallet";

export default function DeveloperPage() {
  return <div className="page-shell app-page developer-page">
    <header className="app-page-header compact-header">
      <div><p className="kicker">Developer workspace</p><h1>Open a PatchBond case</h1><p>Review the immutable remediation brief and submit one exact commit SHA.</p></div>
      <div className="page-context">READ CASE / WRITE WITH WALLET</div>
    </header>
    <div className="developer-grid">
      <section className="developer-entry">
        <div className="module-header"><div><p className="kicker">Case access</p><h2>Find your remediation brief</h2></div><span className="section-index">01</span></div>
        <CaseLookup />
        <div className="developer-wallet"><WalletControl /><LiveContractNotice /></div>
      </section>
      <aside className="developer-aside"><p className="kicker">Workflow</p><h2>Three checks before a patch.</h2><ol><li><b>01</b><span>Review immutable terms and the base commit.</span></li><li><b>02</b><span>Accept the case with the named developer wallet.</span></li><li><b>03</b><span>Submit the final, exact 40-character commit SHA.</span></li></ol><p className="aside-footnote">No assigned-case index is assumed. Open a known case ID to read its authoritative state.</p></aside>
    </div>
  </div>;
}
