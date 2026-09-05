/**
 * What to send instead.
 *
 * The ledger's job is to say what a consignment is worth on arrival. This
 * module's job is to answer the question that follows, and it is the more
 * important one: *then what should I send?* Without an answer the whole app
 * reads as a lecture, and a lecture is not a use for anyone's generosity.
 *
 * The answer is computed, not written. Take the donor's own declared total,
 * spend it instead on one of the items the flash appeal actually named, and put
 * that counterfactual manifest through the same engine, at the same freight mode
 * and the same bias. Nothing new is priced and no new figure is introduced: the
 * comparison is the engine disagreeing with itself about two ways to spend the
 * same money, which is a claim a reader can check line by line in both ledgers.
 *
 * Note what this deliberately does *not* do. It does not convert dollars into
 * blankets or litres of water in the region — see the note above
 * `APPEAL_USD_PER_PERSON`, which explains why that conversion is not in this
 * codebase. An alternative is bought at the same donor-country retail price the
 * catalogue quotes for everything else, so both sides of the comparison rest on
 * the same kind of figure.
 */

import { CATALOG, type CatalogItem } from "@/data/catalog";
import { price, type EngineOptions, type Manifest, type PricedManifest } from "@/lib/logistics";
import { addCents, negate, type Cents } from "@/lib/money";

/** How many alternatives the UI has room to argue for. */
const KEEP = 3;

export interface Alternative {
  readonly item: CatalogItem;
  /** Whole units the donor's declared total buys at the catalogue's price. */
  readonly quantity: number;
  /** The counterfactual, priced by the same engine at the same settings. */
  readonly result: PricedManifest;
  /**
   * Net delivered by this instead of by the manifest as proposed. Positive means
   * the swap is worth making, which is the only case this module reports.
   */
  readonly gain: Cents;
}

/**
 * The appeal's own list, best first, for a manifest already priced.
 *
 * `proposed` must be the result of pricing `manifest` at `options` — it is
 * passed in rather than recomputed so the comparison is against the exact ledger
 * on screen. Items already on the manifest are skipped: telling a donor to send
 * the thing they are sending is not advice. An item too expensive to buy even
 * one of is skipped too, because a quantity of zero prices out at nothing and
 * would rank first for the wrong reason.
 *
 * Only alternatives that actually beat the proposal are returned, so a good
 * consignment produces an empty list rather than a manufactured improvement.
 */
export function alternatives(
  manifest: Manifest,
  proposed: PricedManifest,
  options: Partial<EngineOptions> = {},
): readonly Alternative[] {
  const declaredUsd = proposed.declared / 100;
  if (declaredUsd <= 0) return [];

  const already = new Set(manifest.lines.map((line) => line.itemId));

  const priced: Alternative[] = [];
  for (const item of CATALOG) {
    if (!item.onAppeal || item.prohibited !== undefined) continue;
    if (already.has(item.id)) continue;

    const quantity = Math.floor(declaredUsd / item.declaredUsd);
    if (quantity < 1) continue;

    const result = price({ lines: [{ itemId: item.id, quantity }], mode: manifest.mode }, options);
    const gain = addCents(result.net, negate(proposed.net));
    if (gain <= 0) continue;

    priced.push({ item, quantity, result, gain });
  }

  // Best first, and by weight when two land the same amount — the lighter one is
  // the better advice, because freight is the cost the donor never sees coming.
  priced.sort((a, b) => b.gain - a.gain || a.item.unitWeightKg - b.item.unitWeightKg);
  return priced.slice(0, KEEP);
}
