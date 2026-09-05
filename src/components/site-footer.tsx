/**
 * The footer carries the three things that must appear on every page of this
 * site: that the app takes no money, that the chain layer is a devnet
 * demonstration and not a donation channel, and the canvas-ui attribution.
 */

import Link from "next/link";

const LINK = "text-paper/80 underline decoration-rule underline-offset-2 hover:text-sonar";

export function SiteFooter() {
  return (
    <footer className="hairline mt-24 px-5 py-10 text-xs leading-relaxed text-meltwater sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <p className="display text-[11px] uppercase tracking-[0.2em] text-paper">Deadweight</p>
          <p>
            Every figure on this site is produced by one deterministic pricing function and traced
            to a dated source. The{" "}
            <Link href="/sources" className={LINK}>
              sources page
            </Link>{" "}
            lists the whole rate table, including the cells that are assumptions and the ones
            quoted from a search result rather than read in context.
          </p>
        </div>

        <div className="space-y-2">
          <p className="display text-[11px] uppercase tracking-[0.2em] text-paper">
            This app takes no donations
          </p>
          <p>
            Nothing here accepts money. Every giving link points off-site to the response&rsquo;s
            own appeal or to an agency running it. The Solana layer notarises a verdict on{" "}
            <span className="text-crimson">devnet</span> — a demonstration of a public,
            tamper-evident ledger of what a consignment was priced at. It moves no value and is not
            a donation channel.
          </p>
        </div>

        <div className="space-y-2">
          <p className="display text-[11px] uppercase tracking-[0.2em] text-paper">Credits</p>
          <p>
            Visual components from{" "}
            <a
              href="https://github.com/DavidHDev/canvas-ui"
              target="_blank"
              rel="noreferrer noopener"
              className={LINK}
            >
              canvas-ui
            </a>{" "}
            by David Haz (DavidHDev) — MIT + Commons Clause, © 2026 David Haz. Used under licence
            with the copyright notice retained in every vendored file.
          </p>
          <p>
            Built for the DEV Weekend Challenge: Generosity Edition by{" "}
            <a
              href="https://dev.to/an0n99x"
              target="_blank"
              rel="noreferrer noopener"
              className={LINK}
            >
              an0n99x
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
