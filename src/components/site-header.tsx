/**
 * A thin bar, fixed to nothing. The wordmark doubles as the statement of what
 * the site does, so a reader who arrives on /sources still knows.
 *
 * The links are set in 11px small caps, which on a phone is a 17px-tall target —
 * under the 24px a thumb needs. `py-1.5 -my-1.5` buys the height back inside the
 * hit area without moving anything on the baseline the bar is aligned to.
 */

import Link from "next/link";

const LINK =
  "-my-1.5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-meltwater transition-colors hover:text-sonar";

export function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-5 py-3.5 sm:px-8">
        <Link
          href="/"
          className="-my-1.5 display py-1.5 text-sm uppercase tracking-[0.22em] text-paper"
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
