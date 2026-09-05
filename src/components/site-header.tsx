"use client";

/**
 * A thin bar, fixed to nothing, carrying a mark and four destinations.
 *
 * The mark is the hero's crate with everything that cannot survive 28px taken
 * out of it: the slats go, the three painted faces go, and what is left is the
 * isometric wireframe plus the sonar stencil block, whose coordinates are lifted
 * straight out of `public/crate.svg` so the thing in the corner and the thing in
 * the particle cloud are provably the same box. It is `aria-hidden` and the link
 * carries an explicit name, because the wordmark is split across two spans for
 * colour and a split accessible name is not worth risking.
 *
 * The two type sizes are relative measurements, not absolute ones. The bar has
 * to outrank the prose it sits above: the wordmark must not measure what a
 * paragraph measures, and the links have to read as somewhere to go rather than
 * as more text to read. Both were flattened once by a change that raised body
 * prose without touching this file — nothing here got smaller, the page simply
 * grew up to meet it. So if the body scale moves again, these move with it. The
 * ratios to hold are roughly 2x for the wordmark and a step above for the links.
 *
 * Alignment is centred rather than baselined, which is a reversal. Baselines
 * were right while every item in the row was plain text at two sizes; they are
 * wrong now that the row holds a square mark and a bordered box, because a
 * baseline-aligned row sizes those two off their bottom edges and leaves them
 * riding high — the same failure that put the appeal list's numbers above their
 * own words. Centring is what a mixed row of boxes wants.
 *
 * `py-2 -my-2` gives the text links the rest of the 24px a thumb needs without
 * changing where they sit; the Give box gets there on real padding instead,
 * since its border has to enclose something. At 382px the four destinations sit
 * in a 2x2 grid under the wordmark — one dominant name, four full-height
 * targets, and two rows that start at the same two x positions rather than
 * wherever the wrap happened to fall.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * The consignment, reduced to what reads at 28px. The viewBox is the crate's own
 * coordinate space padded by 16 units a side, which is what keeps a mitred join
 * at the top and bottom vertices from clipping against the edge.
 */
function CrateMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="66 70 380 384"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
      className={className}
    >
      {/* Silhouette, then the three edges meeting at the near corner. */}
      <path
        d="M256 86 430 176 430 348 256 438 82 348 82 176Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={18}
      />
      <path
        d="M82 176 256 266 430 176M256 266 256 438"
        fill="none"
        stroke="currentColor"
        strokeWidth={18}
      />
      {/* The stencil block — in this app, the one place a marking colour goes. */}
      <polygon points="104,199 168,232 168,262 104,229" className="fill-sonar" />
    </svg>
  );
}

const PAGES = [
  { href: "/", label: "The ledger" },
  { href: "/notary", label: "Notary" },
  { href: "/sources", label: "Sources" },
] as const;

const LINK =
  "relative -my-2 justify-self-start py-2 text-base uppercase tracking-[0.16em] transition-colors";

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3.5 sm:px-8">
        <Link
          href="/"
          aria-label="Deadweight"
          className="group -my-2 flex items-center gap-3.5 py-2"
        >
          <CrateMark className="size-7 shrink-0 text-paper/60 transition-colors group-hover:text-paper" />
          <span className="display text-3xl uppercase tracking-[0.22em] text-paper">
            Dead
            <span className="text-paper/55 transition-colors group-hover:text-paper">weight</span>
          </span>
        </Link>

        <nav
          aria-label="Site"
          // The wordmark takes 311 of the 342px a 382px phone has, so the four
          // destinations always land on their own line or two. Wrapping them left
          // each row starting at a different x; a 2x2 grid puts the second row
          // under the first, which is the difference between a header that looks
          // laid out and one that looks overflowed. From `sm` up the whole nav
          // fits on one line and the grid is dropped.
          className="grid w-full grid-cols-2 items-center gap-x-5 gap-y-2 sm:flex sm:w-auto sm:flex-wrap"
        >
          {PAGES.map((page) => {
            const active = pathname === page.href;
            return (
              <Link
                key={page.href}
                href={page.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  LINK,
                  active
                    ? "text-paper after:absolute after:inset-x-0 after:bottom-1 after:h-px after:bg-sonar"
                    : "text-meltwater hover:text-sonar",
                )}
              >
                {page.label}
              </Link>
            );
          })}
          <a
            href="https://nepal.un.org/en"
            target="_blank"
            rel="noreferrer noopener"
            className="justify-self-start border border-sonar/45 px-3 py-1.5 text-base uppercase tracking-[0.16em] text-sonar transition-colors hover:border-sonar hover:bg-sonar/10"
          >
            Give <span aria-hidden="true">→</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
