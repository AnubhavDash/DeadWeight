"use client";

/**
 * The verdict, docked to the bottom of a phone.
 *
 * On a wide screen the ledger sits in a sticky right-hand rail, so every `+` and
 * `−` in the picker moves a number the reader can see. Below the `lg` breakpoint
 * that rail unstacks and lands *under* the picker — at 382px the catalogue is
 * some 3,200px tall, which puts the figure being changed about a screen and a
 * half below the control changing it. Tapping `+` then looks like it does
 * nothing, which is the single worst thing this page could do on a phone, since
 * the whole argument is that the number moves.
 *
 * So on small screens the net figure follows the reader down the picker instead.
 * It appears only while the picker is on screen and the real ledger is not —
 * there is no reason to shadow a table the reader is already looking at — and
 * tapping it jumps to that table.
 *
 * It is `aria-hidden` and untabbable on purpose: every figure in it is a
 * duplicate of one a few hundred pixels further down the same document, and the
 * jump it offers is a scroll a screen reader does not need. It is an affordance
 * for a thumb, not a second copy of the ledger.
 */

import { VERDICT_LABEL, type PricedManifest } from "@/lib/logistics";
import { formatPercent, formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

import { VERDICT_TONE } from "./ledger-table";

export function VerdictDock({
  result,
  shown,
  onJump,
}: {
  result: PricedManifest;
  shown: boolean;
  onJump: () => void;
}) {
  const empty = result.declared === 0;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-silt/95 backdrop-blur-sm transition-transform duration-300 lg:hidden",
        shown ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={onJump}
        className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-2.5 text-left sm:px-8"
      >
        {empty ? (
          <span className="text-sm text-meltwater">Nothing on the manifest.</span>
        ) : (
          <>
            <span className="min-w-0">
              <span className="block text-2xs uppercase tracking-[0.16em] text-meltwater">
                Net value delivered
              </span>
              <span className="ledger block text-xl text-paper">{formatUsd(result.net)}</span>
            </span>
            <span className="shrink-0 text-right">
              <span
                className={cn(
                  "block text-2xs uppercase tracking-[0.16em]",
                  VERDICT_TONE[result.verdict],
                )}
              >
                {VERDICT_LABEL[result.verdict]}
              </span>
              <span className="ledger block text-2xs text-sonar">
                {formatPercent(result.efficiency)} · the ledger ↓
              </span>
            </span>
          </>
        )}
      </button>
    </div>
  );
}
