"use client";

import { useCallback, useState } from "react";
import type { CalldataEncodable } from "genlayer-js/types";
import type { ExpectedTransition, PendingTransaction } from "@/lib/transactions";
import type { WriteMethod } from "@/lib/contract-api";
import { getPublicConfig } from "@/lib/config";
import { broadcastOnce } from "@/lib/transactions";
import { getTransaction, readCase, waitForFinalized, writeContract } from "@/lib/genlayer-client";
import { useWallet } from "@/components/wallet";
import { classifyError, type ClassifiedFailure } from "@/lib/failure-taxonomy";

interface RunWriteOptions {
  method: WriteMethod;
  caseId: string;
  args: CalldataEncodable[];
  value?: bigint;
  expected: ExpectedTransition;
  precondition(): Promise<void>;
}

export function useCaseWrite() {
  const wallet = useWallet();
  const [record, setRecord] = useState<PendingTransaction | null>(null);
  const [failure, setFailure] = useState<ClassifiedFailure | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (options: RunWriteOptions) => {
    setFailure(null);
    setBusy(true);
    try {
      const config = getPublicConfig();
      if (!config.contractAddress) throw new Error(config.configurationError ?? "Live contract not deployed yet");
      if (!wallet.address || !wallet.provider) throw new Error("Connect your wallet before continuing");
      if (!wallet.networkMatches) throw new Error(`Switch your wallet to chain ${config.chainId}`);
      const result = await broadcastOnce(window.localStorage, {
        network: config.network,
        contractAddress: config.contractAddress,
        method: options.method,
        caseId: options.caseId,
        expected: options.expected,
      }, {
        precondition: options.precondition,
        broadcast: () => writeContract(wallet.address!, wallet.provider!, options.method, options.args, options.value ?? 0n),
        waitForFinalized,
        getTransaction,
        readCase,
      });
      setRecord(result);
      if (result.failure) setFailure(result.failure);
      return result;
    } catch (caught) {
      setFailure(classifyError(caught));
      throw caught;
    } finally { setBusy(false); }
  }, [wallet.address, wallet.provider, wallet.networkMatches]);

  return { run, record, failure, busy };
}
