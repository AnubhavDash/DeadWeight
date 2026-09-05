/**
 * The notary's public record.
 *
 * A separate page from the ledger on purpose: the front page is arithmetic you
 * can check without trusting anyone, and this is the same arithmetic after
 * somebody chose to publish it where they cannot quietly restate it. Devnet, and
 * a notary rather than a channel — every entry below moved no money.
 *
 * The shell is static. The entries are fetched in the browser, so building or
 * deploying this site never depends on the program being up.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { PublicLedger } from "@/components/solana/public-ledger";

export const metadata: Metadata = {
  title: "The notary",
  description:
    "Every verdict notarised on the Deadweight devnet ledger: what a consignment was declared at, what it delivered net of freight, and the label the program re-derived for itself before it accepted the entry.",
};

const SECTION = "mx-auto w-full max-w-5xl px-5 sm:px-8";

export default function NotaryPage() {
  return (
    <>
      <main className="flex-1 pt-14 sm:pt-20">
        <header className={SECTION}>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <p className="display text-[11px] uppercase tracking-[0.2em] text-meltwater">
              Deadweight · the notary
            </p>
            <span className="border border-crimson/40 px-1.5 py-px text-[10px] uppercase tracking-[0.16em] text-crimson">
              devnet demonstration
            </span>
          </div>
          <h1 className="mt-5 text-4xl leading-[1.05] sm:text-5xl">
            Verdicts nobody can restate.
          </h1>
          <div className="mt-6 max-w-2xl space-y-4 text-sm leading-relaxed text-paper/85">
            <p>
              A price you can edit afterwards is a press release. Every entry here was written by a
              program that re-derived the verdict from the declared and delivered figures itself and
              refused the entry when the label sent with it disagreed — so a consignment recorded as
              landing is one the chain agreed lands, and the app that submitted it had no way to
              flatter the number.
            </p>
            <p className="text-meltwater">
              This is a <span className="text-crimson">devnet demonstration</span> and it moves no
              value. It is not a donation channel and it never becomes one: the appeals in the footer
              take real money directly, and nothing on this site accepts any. What is being
              demonstrated is the record, not a transfer.
            </p>
            <p className="text-meltwater">
              Price a manifest on{" "}
              <Link
                href="/"
                className="text-paper/80 underline decoration-rule underline-offset-2 hover:text-sonar"
              >
                the ledger
              </Link>{" "}
              and you can add one yourself with a devnet wallet. The rates every figure comes from
              are printed, dated and sourced on{" "}
              <Link
                href="/sources"
                className="text-paper/80 underline decoration-rule underline-offset-2 hover:text-sonar"
              >
                the sources page
              </Link>
              .
            </p>
          </div>
        </header>

        <section className={`${SECTION} mt-14`} aria-label="Notarised verdicts">
          <PublicLedger />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
