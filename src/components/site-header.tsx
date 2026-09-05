/**
 * A thin bar, fixed to nothing. The wordmark doubles as the statement of what
 * the site does, so a reader who arrives on /sources still knows.
 *
 * The wordmark is set two steps above body prose. It is the name of the thing;
 * it should not measure the same as the paragraph underneath it. The links sit
 * at body size in small caps, which on a phone is a 22px-tall target — under the
 * 24px a thumb needs, so `py-2 -my-2` buys the height back inside the hit area
 * without moving anything off the baseline the bar is aligned to.
 */

import Link from "next/link";

const LINK =
  "-my-2 py-2 text-sm uppercase tracking-[0.16em] text-meltwater transition-colors hover:text-sonar";

export function SiteHeader() {
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-5 py-3.5 sm:px-8">
        <Link
          href="/"
          className="-my-2 display py-2 text-2xl uppercase tracking-[0.22em] text-paper"
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
