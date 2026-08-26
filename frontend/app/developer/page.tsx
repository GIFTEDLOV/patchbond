import { CaseLookup } from "@/components/case-lookup";
import { LiveContractNotice } from "@/components/live-contract-notice";
import { WalletControl } from "@/components/wallet";

export default function DeveloperPage() {
  return <div className="page-shell narrow"><header className="page-intro"><p className="kicker">Developer workspace</p><h1>Find your remediation case.</h1><p>Inspect the client’s immutable terms before accepting. Patch submissions contain only an exact commit SHA; PatchBond retrieves the evidence itself.</p></header><LiveContractNotice /><WalletControl /><CaseLookup /><div className="principle-strip"><strong>No uploaded proof.</strong><span>No arbitrary URLs, screenshots, or mutable branches. Only bound repository commits enter adjudication.</span></div></div>;
}
