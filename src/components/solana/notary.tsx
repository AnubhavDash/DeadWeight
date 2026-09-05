"use client";

/**
 * The notary, loaded only when someone scrolls to it.
 *
 * The wallet adapters and Anchor's client are a large download for a page whose
 * point is the arithmetic above them, and nothing here is needed to price a
 * manifest — so this is `ssr: false` and lazy, and the page is complete without
 * it. The placeholder holds the space so the ledger does not jump when it lands.
 */

import dynamic from "next/dynamic";

import type { Manifest, PricedManifest } from "@/lib/logistics";

const Placeholder = () => (
  <section className="hairline mt-8 pt-6" aria-hidden>
    <p className="display text-xs uppercase tracking-[0.2em] text-meltwater">
      Notarise the verdict
    </p>
    <p className="mt-3 text-xs leading-relaxed text-meltwater">Loading the devnet notary…</p>
  </section>
);

const NotaryStack = dynamic(
  () => import("./wallet-provider").then((module) => module.NotaryStack),
  { ssr: false, loading: Placeholder },
);

export function Notary(props: { manifest: Manifest; result: PricedManifest }) {
  return <NotaryStack {...props} />;
}
