"use client";

/**
 * Then what should I send?
 *
 * The ledger above answers what a consignment is worth on arrival, and on its own
 * that reads as a lecture. This panel is the other half: the same declared money,
 * spent instead on something the flash appeal actually named, priced by the same
 * engine at the same freight mode and the same reading of the sources.
 *
 * Nothing here is advice a model wrote or a table someone tuned. Each row is a
 * counterfactual ledger — `@/lib/instead` explains the ranking — and the button
 * puts it on the manifest so the whole page re-prices and the reader can check
 * the claim line by line. When nothing beats what is already on the manifest, the
 * panel says so and offers nothing, which is the case a donation should aim for.
 */

import { useMemo } from "react";

import type { Bias } from "@/data/rates";
import { alternatives } from "@/lib/instead";
import { VERDICT_LABEL, type Manifest, type PricedManifest } from "@/lib/logistics";
import { formatPercent, formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";

const VERDICT_TONE: Record<string, string> = {
  LANDS: "text-sonar",
  BURDENS: "text-paper",
  BECOMES_ASH: "text-crimson",
};

export function InsteadPanel({
  manifest,
  result,
  bias,
  valueLocally,
  onAdopt,
}: {
  manifest: Manifest;
  result: PricedManifest;
  bias: Bias;
  valueLocally: boolean;
  /** Replace the manifest with this instead, at the mode already chosen. */
  onAdopt: (itemId: string, quantity: number) => void;
}) {
  const options = useMemo(() => ({ bias, valueLocally }), [bias, valueLocally]);
  const found = useMemo(
    () => alternatives(manifest, result, options),
    [manifest, result, options],
  );

  // Nothing declared yet: the ledger is already saying to put something on the
  // manifest, and a second empty panel under it would only be noise.
  if (result.declared === 0) return null;

  return (
    <section aria-label="What the same money sends instead" className="hairline mt-8 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p className="display text-xs uppercase tracking-[0.2em] text-meltwater">
          The same money, sent differently
        </p>
        <span className="border border-sonar/40 px-1.5 py-px text-2xs uppercase tracking-[0.16em] text-sonar">
          priced, not recommended
        </span>
      </div>

      {found.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-meltwater">
          Nothing on the appeal&rsquo;s list delivers more than what you have already put on the
          manifest. That is the answer a consignment wants: there is no better version of this to
          suggest, so this build does not invent one.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-meltwater">
            Your{" "}
            <span className="ledger text-paper/85">{formatUsd(result.declared)}</span> spent instead
            on something the flash appeal named, in whole units, flown the same way and priced by the
            same engine at the same reading. Put one on the manifest and every figure above is
            recomputed from the sources.
          </p>

          <ul className="mt-4 space-y-2">
            {found.map((option) => (
              <li key={option.item.id} className="border border-rule p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm text-paper/90">
                    <span className="ledger text-paper">
                      {option.quantity.toLocaleString("en-US")}
                    </span>{" "}
                    × {option.item.label}
                  </p>
                  <p
                    className={cn(
                      "display shrink-0 text-xs uppercase tracking-[0.16em]",
                      VERDICT_TONE[option.result.verdict],
                    )}
                  >
                    {VERDICT_LABEL[option.result.verdict]}
                  </p>
                </div>

                <p className="ledger mt-1.5 text-sm leading-relaxed text-meltwater">
                  {formatUsd(option.result.declared)} declared ·{" "}
                  <span className="text-paper/85">{formatUsd(option.result.net)}</span> delivered ·{" "}
                  {formatPercent(option.result.efficiency)} of it
                </p>
                <p className="mt-1 text-sm leading-relaxed text-paper/85">
                  <span className="ledger text-sonar">+{formatUsd(option.gain)}</span> more reaches
                  the response than the manifest above, for the money already being spent.
                </p>

                <button
                  type="button"
                  onClick={() => onAdopt(option.item.id, option.quantity)}
                  className="mt-3 border border-rule px-3 py-1.5 text-2xs uppercase tracking-[0.16em] text-meltwater transition-colors hover:border-sonar hover:text-sonar"
                >
                  put this on the manifest
                </button>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-sm leading-relaxed text-meltwater">
            Cash is first on the appeal&rsquo;s own priority list, and none of these beat it — the
            links at the foot of this page are where it goes. What is above is the best of the things
            that come in a box.
          </p>
        </>
      )}
    </section>
  );
}
