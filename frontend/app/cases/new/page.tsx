import { CreateCaseForm } from "@/components/create-case-form";

export default function NewCasePage() {
  return <div className="page-shell app-page create-page">
    <header className="app-page-header">
      <div><p className="kicker">Client workspace</p><h1>Fund a security fix</h1><p>Build an immutable remediation agreement. Nothing is broadcast until you review the complete case.</p></div>
      <div className="page-context"><span className="status-dot" /> Bradbury / client write</div>
    </header>
    <CreateCaseForm />
  </div>;
}
