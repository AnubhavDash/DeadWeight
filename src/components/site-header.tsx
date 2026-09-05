/**
 * A thin bar, fixed to nothing. The wordmark doubles as the statement of what
 * the site does, so a reader who arrives on /sources still knows.
 *
 * These two sizes are relative measurements, not absolute ones, and that is the
 * whole point of this comment. The bar has to outrank the prose it sits above:
 * the wordmark is the name of the thing and must not measure what a paragraph
 * measures, and the links have to read as somewhere to go rather than as more
 * text to read. Both were flattened once already by a change that raised body
 * prose without touching this file — nothing here got smaller, the page simply
 * grew up to meet it. So if the body scale moves again, these move with it. The
 * ratios to hold are roughly 2x for the wordmark and a step above for the links.
 *
 * The links are set in small caps, which at this size gives a line box taller
 * than the 24px a thumb needs on its own; `py-2 -my-2` adds the rest of the hit
 * area without moving anything off the baseline the bar is aligned to. At 382px
 * the nav wraps under the wordmark, which is the correct outcome — one dominant
 * name, four full-height targets.
 */

import Link from "next/link";

const LINK =
  "-my-2 py-2 text-base uppercase tracking-[0.16em] text-meltwater transition-colors hover:text-sonar";

export function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-5 py-3.5 sm:px-8">
        <Link
          href="/"
          className="-my-2 display py-2 text-3xl uppercase tracking-[0.22em] text-paper"
        >
          Deadweight
        </Link>
        <nav aria-label="Site" className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <Link href="/" className={LINK}>
            The ledger
          </Link>
          <Link href="/notary" className={LINK}>
            Notary
          </Link>
          <Link href="/sources" className={LINK}>
            Sources
          </Link>
          <a href="https://nepal.un.org/en" target="_blank" rel="noreferrer noopener" className={LINK}>
            Give →
          </a>
        </nav>
      </div>
    </header>
  );
}
