"use client";

import type { PendingTransaction } from "@/lib/transactions";
import { TX_STAGES } from "@/lib/transactions";
import { shortHash } from "@/lib/format";

const FRIENDLY_STAGE: Record<(typeof TX_STAGES)[number], string> = {
  "Waiting for wallet": "Waiting for wallet",
  Broadcasting: "Submitting transaction",
  Submitted: "Transaction submitted",
  "Awaiting consensus": "Validators processing",
  Accepted: "Consensus reached",
  "Awaiting finality": "Waiting for finality",
  Finalized: "Finalized",
  "Verifying execution": "Verifying execution",
  "Verifying case state": "Verifying case state",
  Complete: "State verified",
};

export function TransactionStatusCard({ record, onCheckAgain }: { record: PendingTransaction; onCheckAgain?: () => void }) {
  const current = TX_STAGES.indexOf(record.stage);
  return (
    <section className="tx-card" aria-live="polite">
      <div className="tx-card-top">
        <div>
          <p className="kicker">Transaction lifecycle</p>
          <h3>{FRIENDLY_STAGE[record.stage]}</h3>
        </div>
        <code title={record.txHash}>{shortHash(record.txHash)}</code>
      </div>
      <ol className="tx-progress" aria-label="Transaction progress">
        {TX_STAGES.map((stage, index) => (
          <li key={stage} className={index < current ? "done" : index === current ? "current" : ""} aria-current={index === current ? "step" : undefined}>
            <span aria-hidden="true" />{FRIENDLY_STAGE[stage]}
          </li>
        ))}
      </ol>
      {record.failure && (
        <div className="failure-panel" role="alert">
          <strong>{record.failure.title}</strong>
          <p>{record.failure.message}</p>
          {record.failure.retrySameHash && <p>Use &quot;Check again&quot; to reconcile this same hash. PatchBond will not broadcast a replacement.</p>}
        </div>
      )}
      {record.stage !== "Complete" && onCheckAgain && (
        <button type="button" className="text-button" onClick={onCheckAgain}>Check again - same hash</button>
      )}
    </section>
  );
}
