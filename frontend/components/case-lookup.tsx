"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateCaseId } from "@/lib/validation";

export function CaseLookup({ verify = false }: { verify?: boolean }) {
  const [caseId, setCaseId] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const inputId = verify ? "verify-case-id" : "developer-case-id";
  const errorId = `${verify ? "verify" : "developer"}-case-error`;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateCaseId(caseId)) { setError("Enter the exact lowercase PatchBond case ID."); return; }
    router.push(`${verify ? "/verify" : "/cases"}/${encodeURIComponent(caseId)}`);
  };
  return (
    <form className="lookup" onSubmit={submit} noValidate>
      <label htmlFor={inputId}>Case ID</label>
      <div className="lookup-row">
        <input id={inputId} value={caseId} onChange={(event) => { setCaseId(event.target.value); setError(""); }} placeholder="openssl-cve-2026" autoComplete="off" aria-describedby={error ? errorId : undefined} />
        <button className="button button-primary" type="submit">{verify ? "Verify case" : "Open case"} <span aria-hidden="true">-&gt;</span></button>
      </div>
      {error && <p id={errorId} className="field-error" role="alert">{error}</p>}
    </form>
  );
}
