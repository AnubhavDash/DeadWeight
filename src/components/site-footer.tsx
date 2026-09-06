/**
 * The footer carries the three things that must appear on every page of this
 * site: that the app takes no money, that the chain layer is a devnet
 * demonstration and not a donation channel, and the canvas-ui attribution.
 *
 * The attribution is one line rather than a column, because the full licence
 * story — MIT + Commons Clause, © 2026 David Haz, the notice retained in every
 * vendored file — is told in the README and in the header of each copied
 * component, which is where a licence is actually checked. The footer names the
 * library and its author and gets out of the way.
 */

import Link from "next/link";

const LINK = "text-paper/80 underline decoration-rule underline-offset-2 hover:text-sonar";

export function SiteFooter() {
  return (
    <footer className="hairline mt-24 px-5 py-10 text-sm leading-relaxed text-meltwater sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="display text-base uppercase tracking-[0.2em] text-paper">Deadweight</p>
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
            <p className="display text-base uppercase tracking-[0.2em] text-paper">
              This app takes no donations
            </p>
            <p>
              Nothing here accepts money. Every giving link points off-site to the response&rsquo;s
              own appeal or to an agency running it. The Solana layer notarises a verdict on{" "}
              <span className="text-paper">devnet</span> — a demonstration of a public,
              tamper-evident ledger of what a consignment was priced at, and every entry it holds is
              listed on{" "}
              <Link href="/notary" className={LINK}>
                the notary page
              </Link>
              . It moves no value and is not a donation channel.
            </p>
          </div>
        </div>

        {/*
          Builder first, library second. Written the other way round — "canvas-ui
          by David Haz, by an0n99x" — the two `by`s land side by side and the
          sentence can be read as though one name were the other's, which is the
          one thing an attribution line must not do.
        */}
        <p className="hairline mt-8 pt-5">
          Made by{" "}
          <a
            href="https://dev.to/an0n99x"
            target="_blank"
            rel="noreferrer noopener"
            className={LINK}
          >
            an0n99x
          </a>{" "}
          with ❤️ and{" "}
          <a
            href="https://github.com/DavidHDev/canvas-ui"
            target="_blank"
            rel="noreferrer noopener"
            className={LINK}
          >
            canvas-ui
          </a>{" "}
          by David Haz.
        </p>
      </div>
    </footer>
  );
}
