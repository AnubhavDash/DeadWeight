/**
 * What to send instead — the contract.
 *
 * Two things matter here and they pull in opposite directions. The advice has to
 * be useful, so a wasteful consignment must produce alternatives ranked by how
 * much more they deliver. And it has to be honest, so a consignment that is
 * already the right thing must produce *nothing* rather than a manufactured
 * improvement. The rest is arithmetic that has to stay the engine's: an
 * alternative is priced by `price()` at the caller's own mode and bias, never by
 * a second calculation living in this module.
 */

import { describe, expect, it } from "vitest";

import { CATALOG_BY_ID } from "@/data/catalog";
import { alternatives } from "@/lib/instead";
import { price, type Manifest } from "@/lib/logistics";

/** 400 used winter jackets by air: the case the whole app exists to price. */
const CLOTHING: Manifest = {
  lines: [{ itemId: "used-winter-jacket", quantity: 400 }],
  mode: "air",
};

/** Weightless, named in the appeal, and already the best thing on the list. */
const TABLETS: Manifest = {
  lines: [{ itemId: "purification-tablets", quantity: 1_000 }],
  mode: "air",
};

function suggest(manifest: Manifest, options: Parameters<typeof price>[1] = {}) {
  return alternatives(manifest, price(manifest, options), options);
}

describe("what it suggests", () => {
  it("answers a wasteful consignment with things the appeal asked for", () => {
    const found = suggest(CLOTHING);

    expect(found.length).toBeGreaterThan(0);
    for (const option of found) {
      expect(option.item.onAppeal).toBe(true);
      expect(option.item.prohibited).toBeUndefined();
    }
  });

  it("ranks by how much more actually gets delivered", () => {
    const found = suggest(CLOTHING);
    const gains = found.map((option) => option.gain);
    expect([...gains].sort((a, b) => b - a)).toEqual(gains);
  });

  it("only offers alternatives that beat what was proposed", () => {
    const proposed = price(CLOTHING);
    for (const option of suggest(CLOTHING)) {
      expect(option.result.net).toBeGreaterThan(proposed.net);
      expect(option.gain).toBe(option.result.net - proposed.net);
    }
  });

  it("says nothing when the consignment is already the right thing", () => {
    // The honest empty case. Purification tablets at the top of the appeal's own
    // list cannot be improved on, so no advice is offered.
    expect(suggest(TABLETS)).toEqual([]);
  });

  it("never suggests an item the donor is already sending", () => {
    const manifest: Manifest = {
      lines: [
        { itemId: "used-winter-jacket", quantity: 400 },
        { itemId: "wool-blanket", quantity: 1 },
      ],
      mode: "air",
    };
    const ids = suggest(manifest).map((option) => option.item.id);
    expect(ids).not.toContain("wool-blanket");
    expect(ids.length).toBeGreaterThan(0);
  });

  it("keeps the list short enough to read", () => {
    expect(suggest(CLOTHING).length).toBeLessThanOrEqual(3);
  });
});

describe("the arithmetic behind a suggestion", () => {
  it("spends the declared total, in whole units, at the catalogue's price", () => {
    const proposed = price(CLOTHING);
    for (const option of suggest(CLOTHING)) {
      const affordable = Math.floor(proposed.declared / 100 / option.item.declaredUsd);
      expect(option.quantity).toBe(affordable);
      expect(option.quantity).toBeGreaterThanOrEqual(1);
    }
  });

  it("prices the counterfactual with the same engine, mode and bias", () => {
    for (const option of suggest(CLOTHING, { bias: "harsh" })) {
      const again = price(
        { lines: [{ itemId: option.item.id, quantity: option.quantity }], mode: "air" },
        { bias: "harsh" },
      );
      expect(option.result).toEqual(again);
      expect(option.result.mode).toBe("air");
      expect(option.result.options.bias).toBe("harsh");
    }
  });

  it("holds up under the harshest reading the sources allow", () => {
    // The claim has to survive the reading least flattering to it, or it is only
    // an artefact of the default bias.
    expect(suggest(CLOTHING, { bias: "harsh" }).length).toBeGreaterThan(0);
  });

  it("skips an item the declared total cannot buy even one of", () => {
    // $28 of anything buys no $45 jacket, so that option cannot appear.
    const manifest: Manifest = { lines: [{ itemId: "soft-toy", quantity: 2 }], mode: "air" };
    const ids = suggest(manifest).map((option) => option.item.id);
    expect(CATALOG_BY_ID["thermal-jacket-new"]!.declaredUsd).toBe(45);
    expect(ids).not.toContain("thermal-jacket-new");
  });
});

describe("what it refuses to invent", () => {
  it("offers nothing for an empty manifest", () => {
    expect(suggest({ lines: [], mode: "air" })).toEqual([]);
    expect(suggest({ lines: [{ itemId: "wool-blanket", quantity: 0 }], mode: "air" })).toEqual([]);
  });

  it("offers nothing when the declared value is zero", () => {
    const manifest: Manifest = {
      lines: [{ itemId: "soft-toy", quantity: 10, declaredUnitUsd: 0 }],
      mode: "air",
    };
    expect(suggest(manifest)).toEqual([]);
  });

  it("ignores an item this build does not have", () => {
    const manifest: Manifest = { lines: [{ itemId: "gold-bar", quantity: 5 }], mode: "air" };
    expect(suggest(manifest)).toEqual([]);
  });
});
