"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { validateCaseId } from "@/lib/validation";

export function CaseLookup({ verify = false }: { verify?: boolean }) {
  const [caseId, setCaseId] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateCaseId(caseId)) { setError("Enter the exact lowercase PatchBond case ID."); return; }
    router.push(`${verify ? "/verify" : "/cases"}/${encodeURIComponent(caseId)}`);
  };
  return (
    <form className="lookup" onSubmit={submit} noValidate>
      <label htmlFor={verify ? "verify-case-id" : "developer-case-id"}>Case ID</label>
      <div className="lookup-row">
        <input id={verify ? "verify-case-id" : "developer-case-id"} value={caseId} onChange={(event) => { setCaseId(event.target.value); setError(""); }} placeholder="openssl-cve-2026" autoComplete="off" />
        <button className="button button-primary" type="submit">{verify ? "Verify case" : "Open case"} <span aria-hidden="true">→</span></button>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </form>
  );
}
