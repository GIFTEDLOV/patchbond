"use client";

import { useCallback, useEffect, useState } from "react";
import { getPublicConfig } from "@/lib/config";
import { getTransaction, readCase, waitForFinalized } from "@/lib/genlayer-client";
import { reconcileSameHash, unresolvedTransactions, type PendingTransaction } from "@/lib/transactions";
import { TransactionStatusCard } from "./transaction-status";

export function PendingTransactionRecovery() {
  const [records, setRecords] = useState<PendingTransaction[]>([]);
  const [open, setOpen] = useState(false);
  const config = getPublicConfig();

  const refresh = useCallback(() => {
    if (typeof window === "undefined") return;
    setRecords(unresolvedTransactions(window.localStorage));
  }, []);

  const check = useCallback(async (record: PendingTransaction) => {
    if (!config.configured || record.contractAddress.toLowerCase() !== config.contractAddress?.toLowerCase()) return;
    await reconcileSameHash(window.localStorage, record, { waitForFinalized, getTransaction, readCase });
    refresh();
  }, [config.configured, config.contractAddress, refresh]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refresh();
      const pending = unresolvedTransactions(window.localStorage);
      if (pending.length) {
        setOpen(true);
        for (const record of pending) void check(record);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [check, refresh]);

  if (!records.length) return null;
  return (
    <aside className="recovery-drawer" aria-label="Pending transactions">
      <button type="button" className="recovery-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {records.length} pending transaction{records.length === 1 ? "" : "s"}
      </button>
      {open && <div className="recovery-list">{records.map((record) => <TransactionStatusCard key={record.txHash} record={record} onCheckAgain={() => void check(record)} />)}</div>}
    </aside>
  );
}
