/**
 * The rate table.
 *
 * Every cell is a range with a source, a date and a confidence. Where a figure
 * is arithmetic performed on a source rather than quoted from it, `derivation`
 * records the arithmetic so a reader can repeat it. Where a figure is reasoned
 * rather than sourced, `assumption: true` says so out loud, and the UI marks
 * that line differently. There is no fourth category: nothing here is invented
 * and left unmarked.
 *
 * Two structural decisions worth stating.
 *
 * The ranges are wide because the honest ranges are wide. A single air freight
 * number quoted to the cent would be a lie of precision, and the app's whole
 * argument is that the sloppy arithmetic is the problem.
 *
 * The engine's default bias is `generous`: costs are taken at the low end of
 * their range and usefulness at the high end, so every verdict is the best case
 * the sources permit. When a manifest still comes out negative under the most
 * charitable reading available, the conclusion is hard to argue with. Rigging
 * the numbers toward the thesis would make the whole exercise worthless.
 */

import type { CitationId } from "./citations";

export type Confidence = "high" | "medium" | "low";

export interface Cell {
  readonly low: number;
  readonly high: number;
  /** Human-readable unit, printed beside the figure. */
  readonly unit: string;
  readonly source: CitationId;
  /** ISO date or `YYYY-MM` the figure is valid as of. */
  readonly asOf: string;
  readonly confidence: Confidence;
  /** Arithmetic applied to the source, written out for checking. */
  readonly derivation?: string;
  /** True when the figure is reasoned from guidance, not quoted from a source. */
  readonly assumption?: boolean;
  readonly note?: string;
}

/** Which end of every range to use. See the note on `generous` above. */
export type Bias = "generous" | "midpoint" | "harsh";

/** Resolve a cell to a single number for a cost line (low = kindest). */
export function costOf(cell: Cell, bias: Bias): number {
  if (bias === "generous") return cell.low;
  if (bias === "harsh") return cell.high;
  return (cell.low + cell.high) / 2;
}

/** Resolve a cell to a single number for a benefit line (high = kindest). */
export function benefitOf(cell: Cell, bias: Bias): number {
  if (bias === "generous") return cell.high;
  if (bias === "harsh") return cell.low;
  return (cell.low + cell.high) / 2;
}

/* ---------------------------------------------------------------------------
   Freight

   Nepal is landlocked. Nothing arrives by sea; a sea leg ends at Kolkata and
   becomes a road leg over the Birgunj–Raxaul border, so surface freight is
   priced as road. After 26 August 2026 the Rasuwa road corridor was cut, which
   is why air is the realistic mode for the affected districts and why the air
   rate is the one that decides most manifests.
   --------------------------------------------------------------------------- */

export const AIR_FREIGHT_PER_KG: Cell = {
  low: 1.5,
  high: 4.5,
  unit: "USD/kg",
  source: "worldbank-airfreight-2009",
  asOf: "2009-08",
  confidence: "low",
  note:
    "The most recent authoritative published range we could source, and it is from 2009 — treat it as a floor. The IRC reported air freight up 40–62% year-on-year in 2026. We do not apply that as a multiplier, because it was measured in a different corridor; the effect is that this app understates freight cost.",
};

export const ROAD_FREIGHT_PER_KG: Cell = {
  low: 0.3,
  high: 1.125,
  unit: "USD/kg",
  source: "worldbank-airfreight-2009",
  asOf: "2009-08",
  confidence: "low",
  derivation:
    "Air freight is 4–5× road. Low = $1.50 ÷ 5 = $0.30; high = $4.50 ÷ 4 = $1.125.",
  note: "Delhi or Kolkata to Kathmandu overland, via the Birgunj–Raxaul crossing.",
};

export const SEA_PLUS_ROAD_PER_KG: Cell = {
  low: 0.09375,
  high: 0.375,
  unit: "USD/kg",
  source: "worldbank-airfreight-2009",
  asOf: "2009-08",
  confidence: "low",
  derivation:
    "Air freight is 12–16× sea. Low = $1.50 ÷ 16 = $0.09375; high = $4.50 ÷ 12 = $0.375.",
  note:
    "Sea alone cannot reach Nepal. This is the ocean leg only; a road leg from Kolkata is added on top, and the combined transit is measured in months, not days.",
};

/* ---------------------------------------------------------------------------
   Labour

   Someone has to open every box. Unsorted mixed goods have to be unpacked,
   inspected, categorised, repacked and either warehoused or destroyed, and that
   labour is paid for out of the same response budget as the aid. The wage below
   is Nepal's statutory minimum, converted at a dated rate, because the people
   doing the sorting are hired locally.
   --------------------------------------------------------------------------- */

/**
 * NPR per USD. This is a moving number and is therefore not a rate — it is a
 * dated snapshot, kept in one place so it can be replaced without touching any
 * other figure. Displayed conversions widen the band to absorb its drift.
 */
export const NPR_PER_USD: Cell = {
  low: 130,
  high: 145,
  unit: "NPR/USD",
  source: "nepal-minimum-wage-2025",
  asOf: "2025-07-17",
  confidence: "low",
  derivation:
    "The source states NPR 19,550/month ≈ USD 146, implying NPR 133.9 per USD on 17 Jul 2025. The band is widened to 130–145 to absorb drift between that date and now.",
  note: "An exchange rate is not a fact about the world that stays still. Refresh before quoting.",
};

export const SORTING_WAGE_PER_HOUR: Cell = {
  low: 0.7,
  high: 1.05,
  unit: "USD/hour",
  source: "nepal-minimum-wage-2025",
  asOf: "2025-07-17",
  confidence: "medium",
  derivation:
    "NPR 19,550/month ÷ 208.7 h (8 h/day × 6 days/week × 4.348 weeks) = NPR 93.7/h. At NPR 133.9/USD that is USD 0.70/h. High end adds the 50% premium the sources report for semi-skilled work.",
  note: "Nepal's statutory minimum wage, basic plus dearness allowance, as notified under the Labour Act 2074.",
};

export const SORTING_HOURS_PER_TONNE: Cell = {
  low: 8,
  high: 40,
  unit: "hours/tonne",
  source: "logcluster-unsolicited",
  asOf: "2021",
  confidence: "low",
  assumption: true,
  note:
    "No published hours-per-tonne figure was found for triaging unsolicited mixed goods, so this is an explicit assumption, not a citation. The low end assumes palletised uniform cartons; the high end assumes loose mixed clothing that must be opened, sorted and repacked by hand. Marked as an assumption in the UI wherever it appears.",
};

/* ---------------------------------------------------------------------------
   What happens to the part nobody wanted

   Two costs, and the second one is the one nobody budgets for. Goods that
   cannot be used still have to be stored, and then they have to be destroyed.
   The Vanuatu figure below is the clearest published example of both, and it is
   arithmetic anyone can repeat.
   --------------------------------------------------------------------------- */

export const DISPOSAL_PER_KG: Cell = {
  low: 0.096,
  high: 0.3,
  unit: "USD/kg",
  source: "nh-des-textile-disposal",
  asOf: "2020-01",
  confidence: "low",
  derivation: "$96 per ton ÷ 1,000 kg = $0.096/kg.",
  assumption: true,
  note:
    "The low end is a documented US municipal tipping fee, used as a proxy. The high end is an assumption: the flood-affected districts have no formal landfill capacity, so unusable goods must be trucked back out over a damaged road network before they can be disposed of at all, which costs more than a tipping fee, not less.",
};

export const STORAGE_PER_KG_MONTH: Cell = {
  low: 0.379,
  high: 0.379,
  unit: "USD/kg/month",
  source: "ifrc-disasterlaw-vanuatu",
  asOf: "2020",
  confidence: "medium",
  derivation:
    "$2,000,000 ÷ (20 containers × 22,000 kg) ÷ 12 months = $0.379/kg/month.",
  note:
    "A floor, not an estimate. The source says containers held 'up to' 22 tons, so the denominator is a maximum and the true rate per kilogram is higher. Charged only while goods sit undelivered.",
};

export const CONGESTED_STORAGE_MONTHS: Cell = {
  low: 0,
  high: 12,
  unit: "months",
  source: "ifrc-disasterlaw-vanuatu",
  asOf: "2020",
  confidence: "low",
  assumption: true,
  note:
    "Zero at the generous end: assume the consignment is collected immediately. Twelve at the harsh end, which is what actually happened in Vanuatu. Storage is therefore invisible in the default reading and appears only when the harsh reading is requested.",
};

/* ---------------------------------------------------------------------------
   How much of an unsolicited consignment is wanted

   Two independent sources bracket this, which is why it is the one fraction in
   the table with real support at both ends. Airlink puts the share of arriving
   goods that are not needed or not appropriate at 60%, implying 40% usable.
   Corbett, Pedraza-Martinez and Van Wassenhove put the share that is high
   priority at 10%. So: somewhere between a tenth and two fifths.
   --------------------------------------------------------------------------- */

export const USABLE_UNSOLICITED: Cell = {
  low: 0.1,
  high: 0.4,
  unit: "fraction",
  source: "airlink-inappropriate-60",
  asOf: "2023",
  confidence: "medium",
  derivation:
    "High = 1 − 0.60 (Airlink: 60% of goods arriving are not needed or appropriate). Low = 0.10 (Corbett et al., Production and Operations Management 2022: about 10% of unsolicited donations are high priority).",
};

export const USABLE_USED_CLOTHING: Cell = {
  low: 0.05,
  high: 0.15,
  unit: "fraction",
  source: "nist-textile-reuse",
  asOf: "2022-05",
  confidence: "low",
  derivation: "High = 0.15 (NIST: only about 15% of used textiles get reused or recycled).",
  note:
    "A US domestic reuse rate used as a proxy for a disaster consignment, which is a stretch in the donation's favour: sorted commercial textile streams recover more than a mixed emergency donation does, not less.",
};

export const USABLE_REQUESTED: Cell = {
  low: 0.85,
  high: 0.95,
  unit: "fraction",
  source: "un-nepal-flash-appeal-2026",
  asOf: "2026-09-04",
  confidence: "low",
  assumption: true,
  note:
    "The case the guidance actually recommends: an item named on the appeal, new, procured to specification and correctly packed. No source puts a number on how much of that lands, so this is an assumption. It exists because this app has to be able to say yes.",
};

export const CASH_PASS_THROUGH: Cell = {
  low: 0.8,
  high: 0.8,
  unit: "fraction",
  source: "calp-frld-2025",
  asOf: "2025-03",
  confidence: "medium",
  note:
    "80 cents of every dollar reaching the affected person. Reported for loss-and-damage funding rather than emergency cash specifically, so it is the closest defensible figure rather than an exact one.",
};

/* ---------------------------------------------------------------------------
   The yardstick

   To say a loss matters you have to say what it is a loss of. Rather than invent
   a conversion into blankets or litres, the app measures displacement against
   the response's own published budget per person, which is one division anyone
   can check.
   --------------------------------------------------------------------------- */

export const APPEAL_USD_PER_PERSON: Cell = {
  low: 590.48,
  high: 590.48,
  unit: "USD/person",
  source: "un-nepal-flash-appeal-2026",
  asOf: "2026-09-04",
  confidence: "high",
  derivation: "US$49,600,000 ÷ 84,000 people = $590.48 per person for the full appeal.",
  note:
    "The whole appeal divided by the whole target caseload — shelter, water, health, food and cash together, not a cash transfer value. It is the response's own arithmetic, used here only as a yardstick.",
};

/* ---------------------------------------------------------------------------
   Registry

   Every cell above, enumerable, so the /sources page can list the entire table
   without a human keeping a second copy of it in sync.
   --------------------------------------------------------------------------- */

export const RATE_CELLS = {
  AIR_FREIGHT_PER_KG,
  ROAD_FREIGHT_PER_KG,
  SEA_PLUS_ROAD_PER_KG,
  NPR_PER_USD,
  SORTING_WAGE_PER_HOUR,
  SORTING_HOURS_PER_TONNE,
  DISPOSAL_PER_KG,
  STORAGE_PER_KG_MONTH,
  CONGESTED_STORAGE_MONTHS,
  USABLE_UNSOLICITED,
  USABLE_USED_CLOTHING,
  USABLE_REQUESTED,
  CASH_PASS_THROUGH,
  APPEAL_USD_PER_PERSON,
} as const satisfies Record<string, Cell>;

export type RateCellName = keyof typeof RATE_CELLS;

/** The cells that are reasoned rather than sourced. Printed in the README. */
export function assumptionCells(): RateCellName[] {
  return (Object.keys(RATE_CELLS) as RateCellName[]).filter(
    (name) => RATE_CELLS[name].assumption === true,
  );
}
