import { describe, expect, it } from "vitest";

import { CITATIONS, type CitationId } from "@/data/citations";
import { CATALOG, usableCellFor } from "@/data/catalog";
import {
  AIR_FREIGHT_PER_KG,
  APPEAL_USD_PER_PERSON,
  DISPOSAL_PER_KG,
  RATE_CELLS,
  ROAD_FREIGHT_PER_KG,
  SEA_PLUS_ROAD_PER_KG,
  STORAGE_PER_KG_MONTH,
  type RateCellName,
} from "@/data/rates";
import { CRISIS } from "@/data/crisis";
import { addCents, usd } from "@/lib/money";
import { price, summarise, unknownItems, type Manifest, type Mode } from "@/lib/logistics";

const cellNames = Object.keys(RATE_CELLS) as RateCellName[];

function manifest(lines: Manifest["lines"], mode: Mode = "air"): Manifest {
  return { lines, mode };
}

describe("the rate table is honest about itself", () => {
  it("gives every cell a citation that exists", () => {
    for (const name of cellNames) {
      expect(CITATIONS[RATE_CELLS[name].source], name).toBeDefined();
    }
  });

  it("keeps every low at or below its high", () => {
    for (const name of cellNames) {
      const cell = RATE_CELLS[name];
      expect(cell.low, name).toBeLessThanOrEqual(cell.high);
    }
  });

  it("accounts for every cell as quoted, derived, or an explicit assumption", () => {
    for (const name of cellNames) {
      const cell = RATE_CELLS[name];
      const accounted =
        Boolean(CITATIONS[cell.source].quote) ||
        cell.derivation !== undefined ||
        cell.assumption === true;
      expect(accounted, `${name} is unquoted, underived and unflagged`).toBe(true);
    }
  });

  it("dates every cell", () => {
    for (const name of cellNames) {
      expect(RATE_CELLS[name].asOf, name).toMatch(/^\d{4}(-\d{2}){0,2}$/);
    }
  });

  it("resolves every citation a catalogue prohibition points at", () => {
    for (const item of CATALOG) {
      for (const id of item.prohibited?.sources ?? []) {
        expect(CITATIONS[id as CitationId], `${item.id} → ${id}`).toBeDefined();
      }
    }
  });
});

/**
 * A derivation string that does not match the number beside it is worse than no
 * derivation at all: it invites a reader to check the arithmetic and then lies
 * to them. These tests re-run each one from the source figure.
 */
describe("the stated derivations are the arithmetic actually used", () => {
  it("derives road freight from air at 4–5×", () => {
    expect(ROAD_FREIGHT_PER_KG.low).toBeCloseTo(AIR_FREIGHT_PER_KG.low / 5, 6);
    expect(ROAD_FREIGHT_PER_KG.high).toBeCloseTo(AIR_FREIGHT_PER_KG.high / 4, 6);
  });

  it("derives the ocean leg from air at 12–16×", () => {
    expect(SEA_PLUS_ROAD_PER_KG.low).toBeCloseTo(AIR_FREIGHT_PER_KG.low / 16, 6);
    expect(SEA_PLUS_ROAD_PER_KG.high).toBeCloseTo(AIR_FREIGHT_PER_KG.high / 12, 6);
  });

  it("derives disposal from the quoted tipping fee per ton", () => {
    expect(DISPOSAL_PER_KG.low).toBeCloseTo(96 / 1000, 6);
  });

  it("derives storage from the Vanuatu containers", () => {
    const perKgMonth = 2_000_000 / (20 * 22_000) / 12;
    expect(STORAGE_PER_KG_MONTH.low).toBeCloseTo(perKgMonth, 3);
    expect(STORAGE_PER_KG_MONTH.high).toBeCloseTo(perKgMonth, 3);
  });

  it("derives the yardstick from the appeal's own figures", () => {
    const perPerson = CRISIS.appeal.usd / CRISIS.appeal.people;
    expect(APPEAL_USD_PER_PERSON.low).toBeCloseTo(perPerson, 2);
    expect(APPEAL_USD_PER_PERSON.high).toBeCloseTo(perPerson, 2);
  });
});

/**
 * The fixtures are the whole dramatic range of the catalogue: a donation that
 * works, one that cannot, one whose verdict flips with the freight rate, and one
 * the guidance refuses outright. The invariants are asserted against all of
 * them, so a later change to the rate table cannot quietly break the arithmetic
 * without a test going red.
 */
describe("the ledger adds up", () => {
  const manifests: Array<[string, Manifest]> = [
    ["one good item", manifest([{ itemId: "purification-tablets", quantity: 500 }])],
    ["used clothing", manifest([{ itemId: "used-winter-jacket", quantity: 15 }])],
    ["bottled water", manifest([{ itemId: "bottled-water", quantity: 200 }])],
    [
      "a mixed pallet",
      manifest([
        { itemId: "wool-blanket", quantity: 40 },
        { itemId: "soft-toy", quantity: 60 },
        { itemId: "rice-sack", quantity: 4 },
        { itemId: "used-shoes", quantity: 25 },
      ]),
    ],
    ["a prohibited item", manifest([{ itemId: "infant-formula", quantity: 24 }])],
    ["overland", manifest([{ itemId: "tarpaulin", quantity: 100 }], "road")],
    ["by sea", manifest([{ itemId: "rice-sack", quantity: 200 }], "sea")],
  ];

  it.each(manifests)("sums every line to the net — %s", (name, subject) => {
    const result = price(subject);
    const sum = addCents(
      ...result.lines.filter((line) => line.kind !== "total").map((line) => line.amount),
    );
    expect(sum, name).toBe(result.net);
  });

  it.each(manifests)("keeps every amount in whole cents — %s", (name, subject) => {
    for (const line of price(subject).lines) {
      expect(Number.isInteger(line.amount), `${name} → ${line.id}`).toBe(true);
    }
  });

  it.each(manifests)("orders the band harsh-low to generous-high — %s", (name, subject) => {
    const result = price(subject);
    expect(result.band.low, name).toBeLessThanOrEqual(result.band.high);
    expect(result.verdictStable, name).toBe(result.verdictLow === result.verdictHigh);
  });

  it.each(manifests)("reaches net from landed plus costs — %s", (name, subject) => {
    const result = price(subject);
    expect(addCents(result.landed, result.costs), name).toBe(result.net);
    expect(result.costs, name).toBeLessThanOrEqual(0);
  });

  it.each(manifests)("is deterministic — %s", (name, subject) => {
    expect(price(subject), name).toEqual(price(subject));
  });

  it("charges no storage under the default generous reading", () => {
    for (const [name, subject] of manifests) {
      const ids = price(subject).lines.map((line) => line.id);
      expect(ids, name).not.toContain("storage");
    }
  });

  it("charges storage once the harsh reading is asked for", () => {
    const ids = price(manifests[1][1], { bias: "harsh" }).lines.map((line) => line.id);
    expect(ids).toContain("storage");
  });
});

/**
 * The verdicts, hand-checked. These are the numbers the landing page will quote,
 * so they are asserted directly rather than inferred: if the table moves enough
 * to change one of them, the copy is wrong and a test should say so.
 */
describe("the verdicts are the ones the sources support", () => {
  it("lands a nearly weightless item the appeal asked for", () => {
    const result = price(manifest([{ itemId: "purification-tablets", quantity: 500 }]));
    expect(result.declared).toBe(usd(750));
    expect(result.grossWeightKg).toBeCloseTo(5, 6);
    expect(result.verdict).toBe("LANDS");
    expect(result.efficiency).toBeGreaterThan(0.9);
    expect(result.verdictStable, "a good donation should land under every reading").toBe(true);
  });

  it("burns bottled water under the kindest reading available", () => {
    const result = price(manifest([{ itemId: "bottled-water", quantity: 200 }]));
    expect(result.verdict).toBe("BECOMES_ASH");
    expect(result.net).toBeLessThan(0);
    expect(result.verdictStable).toBe(true);
    expect(result.cash.multiple, "a multiple of nothing says less than the plain fact").toBeNull();
    expect(result.cash.delivered).toBe(usd(240 * 0.8));
  });

  it("says out loud when the verdict depends on the freight rate", () => {
    const result = price(manifest([{ itemId: "used-winter-jacket", quantity: 15 }]));
    expect(result.declared).toBe(usd(900));
    expect(result.landed).toBe(usd(900 * usableCellFor("used-clothing").high));
    expect(result.verdictHigh).toBe("BURDENS");
    expect(result.verdictLow).toBe("BECOMES_ASH");
    expect(result.verdictStable).toBe(false);
    expect(result.band.low).toBeLessThan(0);
    expect(result.band.high).toBeGreaterThan(0);
  });

  it("delivers nothing from a prohibited item and says why", () => {
    const result = price(manifest([{ itemId: "infant-formula", quantity: 24 }]));
    expect(result.landed).toBe(0);
    expect(result.verdict).toBe("BECOMES_ASH");
    expect(result.prohibitions).toHaveLength(1);
    expect(result.prohibitions[0].sources).toContain("cdc-infant-formula-donations");
    const line = result.lines.find((entry) => entry.id === "unusable-prohibited");
    expect(line, "a prohibition is an engine override, not a rate cell").toBeDefined();
    expect(line?.cell).toBeUndefined();
  });
});

describe("the engine refuses to guess", () => {
  it("names catalogue ids it does not know instead of pricing them", () => {
    const subject = manifest([
      { itemId: "not-a-thing", quantity: 1 },
      { itemId: "wool-blanket", quantity: 10 },
    ]);
    expect(unknownItems(subject)).toEqual(["not-a-thing"]);
    expect(price(subject).declared).toBe(usd(280));
  });

  it("prices an empty manifest as nothing rather than throwing", () => {
    const result = price(manifest([]));
    expect(result.declared).toBe(0);
    expect(result.net).toBe(0);
    expect(result.grossWeightKg).toBe(0);
    expect(result.lines.map((line) => line.id)).toEqual(["declared", "net"]);
  });

  it("drops quantities that are not a positive count", () => {
    const junk = manifest([
      { itemId: "wool-blanket", quantity: 0 },
      { itemId: "wool-blanket", quantity: -5 },
      { itemId: "wool-blanket", quantity: Number.NaN },
    ]);
    expect(price(junk).declared).toBe(0);
    expect(price(manifest([{ itemId: "wool-blanket", quantity: 2.9 }])).declared).toBe(usd(56));
  });

  it("makes the surface route cheaper than the air route it replaces", () => {
    const lines = [{ itemId: "rice-sack", quantity: 200 }];
    const freightFor = (mode: Mode) =>
      price(manifest(lines, mode)).lines.find((line) => line.id === "freight")?.amount ?? 0;
    expect(freightFor("road")).toBeGreaterThan(freightFor("air"));
    expect(freightFor("sea")).toBeGreaterThan(freightFor("road"));
  });

  it("marks the in-region valuation as an assumption when it is switched on", () => {
    const subject = manifest([{ itemId: "used-winter-jacket", quantity: 15 }]);
    expect(price(subject).lines.some((line) => line.id === "local-value")).toBe(false);
    const local = price(subject, { valueLocally: true });
    const line = local.lines.find((entry) => entry.id === "local-value");
    expect(line?.assumption).toBe(true);
    expect(line?.amount).toBe(usd(15 * 30 - 900));
    expect(local.usesAssumptions).toBe(true);
  });

  it("states the outcome in one sentence without the model's help", () => {
    expect(summarise(price(manifest([{ itemId: "purification-tablets", quantity: 500 }])))).toContain(
      "worth sending",
    );
    expect(summarise(price(manifest([{ itemId: "used-winter-jacket", quantity: 15 }])))).toContain(
      "as cash delivers",
    );
  });
});
