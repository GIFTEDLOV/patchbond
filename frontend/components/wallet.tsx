"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Address } from "@/lib/contract-api";
import { configuredChainId, isWalletAddress, requestWallet, type BrowserEthereumProvider } from "@/lib/genlayer-client";
import { shortHash } from "@/lib/format";

interface WalletState {
  address: Address | null;
  provider: BrowserEthereumProvider | null;
  chainId: number | null;
  networkMatches: boolean;
  connecting: boolean;
  error: string | null;
  connect(): Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [provider, setProvider] = useState<BrowserEthereumProvider | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const result = await requestWallet();
      setAddress(result.address);
      setProvider(result.provider);
      setChainId(result.chainId);
      if (result.chainId !== configuredChainId()) setError(`Switch your wallet to Bradbury (chain ${configuredChainId()}).`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Wallet connection failed");
    } finally { setConnecting(false); }
  }, []);

  useEffect(() => {
    if (!provider?.on) return;
    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0];
      if (!Array.isArray(accounts) || !isWalletAddress(accounts[0])) {
        setAddress(null);
        setError("Wallet returned no valid account");
        return;
      }
      setAddress(accounts[0]);
      setError(null);
    };
    const handleChainChanged = (...args: unknown[]) => {
      const rawChain = args[0];
      const nextChainId = typeof rawChain === "string" ? Number.parseInt(rawChain, 16) : Number(rawChain);
      setChainId(Number.isSafeInteger(nextChainId) && nextChainId > 0 ? nextChainId : null);
      if (nextChainId !== configuredChainId()) setError(`Switch your wallet to Bradbury (chain ${configuredChainId()}).`);
      else setError(null);
    };
    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [provider]);

  const value = useMemo<WalletState>(() => ({
    address,
    provider,
    chainId,
    networkMatches: chainId === configuredChainId(),
    connecting,
    error,
    connect,
  }), [address, provider, chainId, connecting, error, connect]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used inside WalletProvider");
  return value;
}

export function WalletControl() {
  const wallet = useWallet();
  return (
    <div className="wallet-control">
      {wallet.address ? (
        <span className={wallet.networkMatches ? "wallet-chip" : "wallet-chip wallet-wrong"}>
          <span className="status-dot" /> {shortHash(wallet.address)} · {wallet.networkMatches ? "Bradbury" : "Wrong network"}
        </span>
      ) : (
        <button className="button button-secondary" type="button" onClick={() => void wallet.connect()} disabled={wallet.connecting}>
          {wallet.connecting ? "Waiting for wallet" : "Connect wallet"}
        </button>
      )}
      {wallet.error && <p className="inline-error" role="alert">{wallet.error}</p>}
    </div>
  );
}
