/**
 * The item catalogue — what a donor can propose to send.
 *
 * A note on what is and is not sourced here. An item's mass and its retail
 * price in a donor country are ordinary product facts, not humanitarian
 * figures: a wool blanket weighs about two kilograms wherever you buy it, and
 * the declared value is whatever the donor paid, which the form lets them
 * change. Those are nominal defaults and are labelled as such.
 *
 * What each item costs to replace *in Nepal* is a humanitarian figure, and we
 * do not have a source for it. Rather than invent thirteen prices, every
 * `localReplacement` cell below is flagged `assumption: true` and the engine
 * leaves that adjustment switched off by default. It appears only when the
 * reader explicitly asks for it, clearly marked. It is the most interesting
 * line in the ledger and the least defensible, and pretending otherwise would
 * undermine everything else in the table.
 *
 * `onAppeal` records whether the item is named in the priority list of the
 * US$49.6m flash appeal of 4 September 2026: direct cash assistance,
 * cold-weather shelter materials, portable solar power units, water
 * purification systems, food aid, emergency mobile clinics. That list is the
 * only thing in this file that decides whether an item can come out ahead.
 */

import type { Cell } from "./rates";
import {
  USABLE_REQUESTED,
  USABLE_UNSOLICITED,
  USABLE_USED_CLOTHING,
} from "./rates";
import type { CitationId } from "./citations";

/** Which usable-fraction cell applies, and how the item is treated. */
export type ItemClass = "requested" | "unsolicited" | "used-clothing" | "prohibited";

export interface Prohibition {
  readonly reason: string;
  readonly sources: readonly CitationId[];
}

export interface CatalogItem {
  readonly id: string;
  readonly label: string;
  /** Singular noun for the unit, e.g. "blanket". */
  readonly unit: string;
  /** Nominal shipping weight per unit in kg, packaging included. */
  readonly unitWeightKg: number;
  /** Nominal donor-country retail price per unit in USD. Editable in the form. */
  readonly declaredUsd: number;
  readonly itemClass: ItemClass;
  /** Named in the flash appeal's priority list. */
  readonly onAppeal: boolean;
  /** What the item costs to buy in-region. Assumption; off by default. */
  readonly localReplacement: Cell;
  readonly prohibited?: Prohibition;
  readonly note?: string;
}

/** The usable-fraction cell for an item's class. */
export function usableCellFor(itemClass: ItemClass): Cell {
  switch (itemClass) {
    case "requested":
      return USABLE_REQUESTED;
    case "used-clothing":
      return USABLE_USED_CLOTHING;
    case "prohibited":
    case "unsolicited":
      return USABLE_UNSOLICITED;
  }
}

/** Shorthand for the local-replacement cells, all of which are assumptions. */
function local(low: number, high: number, note: string): Cell {
  return {
    low,
    high,
    unit: "USD/unit",
    source: "un-nepal-flash-appeal-2026",
    asOf: "2026-09-04",
    confidence: "low",
    assumption: true,
    note: `Assumption, not a sourced price. ${note}`,
  };
}

export const CATALOG: readonly CatalogItem[] = [
  /* --- Things the appeal actually asked for ----------------------------- */

  {
    id: "purification-tablets",
    label: "Water purification tablets (strip of 10)",
    unit: "strip",
    unitWeightKg: 0.01,
    declaredUsd: 1.5,
    itemClass: "requested",
    onAppeal: true,
    localReplacement: local(0.6, 1.2, "Regionally manufactured and widely traded."),
    note:
      "Almost weightless, named in the appeal, and treats hundreds of litres. This is what a good donation looks like on a freight ledger.",
  },
  {
    id: "solar-lamp",
    label: "Portable solar lamp",
    unit: "lamp",
    unitWeightKg: 0.4,
    declaredUsd: 25,
    itemClass: "requested",
    onAppeal: true,
    localReplacement: local(8, 18, "Assembled and sold across South Asia."),
    note: "The appeal names portable solar power units explicitly.",
  },
  {
    id: "tarpaulin",
    label: "Reinforced tarpaulin, 4 × 5 m",
    unit: "sheet",
    unitWeightKg: 4.5,
    declaredUsd: 32,
    itemClass: "requested",
    onAppeal: true,
    localReplacement: local(14, 26, "A standard relief specification item."),
    note: "Cold-weather shelter material, and winter is the reason the appeal is urgent.",
  },
  {
    id: "thermal-jacket-new",
    label: "New insulated jacket, sized and packed",
    unit: "jacket",
    unitWeightKg: 0.9,
    declaredUsd: 45,
    itemClass: "requested",
    onAppeal: true,
    localReplacement: local(15, 30, "Widely manufactured in the region."),
    note: "New, specified and correctly packed is a different object from a bag of coats.",
  },
  {
    id: "sanitary-pads",
    label: "Sanitary pads, pack of 10",
    unit: "pack",
    unitWeightKg: 0.25,
    declaredUsd: 6,
    itemClass: "requested",
    onAppeal: true,
    localReplacement: local(1.5, 3, "Locally manufactured."),
    note: "Over 22,000 children were reported to need water, sanitation and hygiene support.",
  },
  {
    id: "wool-blanket",
    label: "Wool blanket",
    unit: "blanket",
    unitWeightKg: 2,
    declaredUsd: 28,
    itemClass: "requested",
    onAppeal: true,
    localReplacement: local(9, 20, "Produced in Nepal and northern India."),
    note:
      "Cold-weather material, so it counts as requested — but two kilograms of air freight per blanket is what decides it.",
  },

  /* --- Things nobody asked for ------------------------------------------ */

  {
    id: "bottled-water",
    label: "Bottled water, 1 litre",
    unit: "bottle",
    unitWeightKg: 1.05,
    declaredUsd: 1.2,
    itemClass: "unsolicited",
    onAppeal: false,
    localReplacement: local(0.2, 0.5, "Bottled and sold domestically."),
    note:
      "After the 2011 Tōhoku tsunami, 750 tons of donated bottled water went unused. The appeal asks for purification systems, not water — because water is the heaviest possible way to ship the absence of water.",
  },
  {
    id: "rice-sack",
    label: "Rice, 25 kg sack",
    unit: "sack",
    unitWeightKg: 25,
    declaredUsd: 22,
    itemClass: "unsolicited",
    onAppeal: false,
    localReplacement: local(16, 24, "Grown and milled in the region."),
    note:
      "USAID puts in-kind food aid shipped from the United States at four to six months in transit. Nepal's own harvest arrives sooner than that.",
  },
  {
    id: "used-winter-jacket",
    label: "Used winter jacket, from a wardrobe",
    unit: "jacket",
    unitWeightKg: 1.2,
    declaredUsd: 60,
    itemClass: "used-clothing",
    onAppeal: false,
    localReplacement: local(15, 30, "The new equivalent, since a used one has no market."),
    note:
      "The declared value is what it cost new. Nobody in the chain will ever realise that number, and the sorting labour is paid per box regardless of what is in it.",
  },
  {
    id: "used-shoes",
    label: "Used shoes, pair",
    unit: "pair",
    unitWeightKg: 0.8,
    declaredUsd: 40,
    itemClass: "used-clothing",
    onAppeal: false,
    localReplacement: local(8, 20, "The new equivalent."),
    note: "Sizes cannot be matched to a caseload that has not been surveyed for shoe sizes.",
  },
  {
    id: "soft-toy",
    label: "Soft toy",
    unit: "toy",
    unitWeightKg: 0.3,
    declaredUsd: 15,
    itemClass: "unsolicited",
    onAppeal: false,
    localReplacement: local(2, 6, "Locally available."),
    note:
      "The most documented unsolicited donation in the literature. It is sent out of real feeling, and it occupies the same cubic metre of helicopter as a water filter.",
  },

  /* --- Things guidance says must not be donated -------------------------- */

  {
    id: "infant-formula",
    label: "Infant formula, 400 g tin",
    unit: "tin",
    unitWeightKg: 0.45,
    declaredUsd: 18,
    itemClass: "prohibited",
    onAppeal: false,
    localReplacement: local(0, 0, "Not applicable: procurement is controlled, not donated."),
    prohibited: {
      reason:
        "Donated breast-milk substitutes are not to be sought, accepted or distributed in an emergency. Formula prepared with unsafe water kills infants, and its arrival displaces breastfeeding support. Where formula is genuinely needed, only official relief organisations may procure and manage it, under the International Code.",
      sources: ["cdc-infant-formula-donations", "unhcr-bms-sop", "unicef-bms-technical-note"],
    },
    note: "The one item in this catalogue where the ledger is beside the point.",
  },
  {
    id: "assorted-medicines",
    label: "Assorted medicines from a home cabinet",
    unit: "box",
    unitWeightKg: 0.3,
    declaredUsd: 80,
    itemClass: "prohibited",
    onAppeal: false,
    localReplacement: local(0, 0, "Not applicable: procurement is controlled, not donated."),
    prohibited: {
      reason:
        "Unsorted, part-used or short-dated medicines cannot be dispensed. They must be inventoried by a pharmacist, then destroyed as hazardous waste at the responder's cost — the donation converts clinical time into disposal work in the middle of an emergency.",
      sources: ["ocha-unsolicited-goods", "logcluster-unsolicited"],
    },
  },
];

export const CATALOG_BY_ID: Readonly<Record<string, CatalogItem>> = Object.fromEntries(
  CATALOG.map((item) => [item.id, item]),
);

export function catalogItem(id: string): CatalogItem {
  const item = CATALOG_BY_ID[id];
  if (!item) throw new Error(`Unknown catalogue item: ${id}`);
  return item;
}
