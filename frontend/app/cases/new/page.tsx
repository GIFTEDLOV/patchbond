import { CreateCaseForm } from "@/components/create-case-form";

export default function NewCasePage() {
  return <div className="page-shell"><header className="page-intro"><p className="kicker">Client workflow</p><h1>Fund a security fix.</h1><p>Bind a GEN bounty to exact, immutable remediation terms. PatchBond—not this page—will authenticate repository evidence and decide entitlement.</p></header><CreateCaseForm /></div>;
}
