"use client";

import { WalletProvider } from "./wallet";
import { PendingTransactionRecovery } from "./pending-transaction-recovery";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <PendingTransactionRecovery />
      {children}
    </WalletProvider>
  );
}
