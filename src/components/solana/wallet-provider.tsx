"use client";

/**
 * The wallet context, kept as small as it can be.
 *
 * Devnet only. This is loaded lazily by the one panel that needs it, so a reader
 * who never notarises anything never downloads a wallet adapter, and the page
 * still prices a manifest with the whole of this subtree absent.
 *
 * `autoConnect` is off deliberately: most of this site is something you read,
 * and a page that reaches for your wallet on load has misunderstood that. The
 * wallet list is empty because every current wallet registers itself through the
 * Wallet Standard — the adapter finds what is installed without us naming it.
 */

import { type ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

import type { Manifest, PricedManifest } from "@/lib/logistics";
import { RPC_ENDPOINT } from "@/lib/solana/program";

import { NotarisePanel } from "./notarise-panel";

import "@solana/wallet-adapter-react-ui/styles.css";

export function SolanaProviders({ children }: { children: ReactNode }) {
  const config = useMemo(() => ({ commitment: "confirmed" as const }), []);

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT} config={config}>
      <WalletProvider wallets={[]} autoConnect={false}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

/**
 * The panel with its context around it. This is what `notary.tsx` loads lazily,
 * so the whole adapter stack stays out of the first paint.
 */
export function NotaryStack(props: { manifest: Manifest; result: PricedManifest }) {
  return (
    <SolanaProviders>
      <NotarisePanel {...props} />
    </SolanaProviders>
  );
}
