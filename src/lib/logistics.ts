/**
 * The deterministic logistics engine.
 *
 * This module owns every number in the application. It is pure: no I/O, no
 * clock, no randomness, no network. The same manifest and the same options
 * always produce the same ledger, which is what makes it safe to hand the
 * result to a language model for narration and to a Solana program for
 * notarisation — both of them receive a figure they cannot influence.
 *
 * The arithmetic, in order:
 *
 *   declared value      what the donor believes they are giving
 *   − not usable        the share that cannot be used, per the sources
 *   − freight           gross weight × per-kg rate for the chosen mode
 *   − sorting           gross weight × hours per tonne × local wage
 *   − disposal          unusable weight × per-kg disposal
 *   − storage           only under the harsh reading; see CONGESTED_STORAGE
 *   = net value delivered
 *
 * Efficiency is net ÷ declared. LANDS at 60% or better, BURDENS from 0 up to
 * 60%, BECOMES ASH below zero. Every ledger is computed three times — generous,
 * midpoint, harsh — so the result carries a band and can say honestly when the
 * verdict depends on which end of a sourced range you land on.
 */

import {
  CATALOG_BY_ID,
  usableCellFor,
  type CatalogItem,
  type ItemClass,
} from "@/data/catalog";
import {
  AIR_FREIGHT_PER_KG,
  APPEAL_USD_PER_PERSON,
  CASH_PASS_THROUGH,
  CONGESTED_STORAGE_MONTHS,
  DISPOSAL_PER_KG,
  ROAD_FREIGHT_PER_KG,
  SEA_PLUS_ROAD_PER_KG,
  SORTING_HOURS_PER_TONNE,
  SORTING_WAGE_PER_HOUR,
  STORAGE_PER_KG_MONTH,
  benefitOf,
  costOf,
  type Bias,
  type Cell,
} from "@/data/rates";
import {
  addCents,
  formatUsd,
  negate,
  usd,
  ZERO,
  type Cents,
} from "@/lib/money";

export type Mode = "air" | "road" | "sea";

/** The three verdicts. Mirrors the `Verdict` enum in the Anchor program. */
export type Verdict = "LANDS" | "BURDENS" | "BECOMES_ASH";

export const LANDS_THRESHOLD = 0.6;

export interface ManifestLine {
  readonly itemId: string;
  readonly quantity: number;
  /** Overrides the catalogue's nominal retail price, in whole USD. */
  readonly declaredUnitUsd?: number;
}

export interface Manifest {
  readonly lines: readonly ManifestLine[];
  readonly mode: Mode;
}

export interface EngineOptions {
  /** Which end of every sourced range to use. Defaults to `generous`. */
  readonly bias: Bias;
  /**
   * Value the usable share at its in-region replacement cost instead of the
   * donor's retail price. Off by default: those prices are assumptions, and the
   * headline verdict is kept to sourced and derived figures only.
   */
  readonly valueLocally: boolean;
}

export const DEFAULT_OPTIONS: EngineOptions = {
  bias: "generous",
  valueLocally: false,
};

export type LineKind = "declared" | "adjustment" | "cost" | "total";

export interface LedgerLine {
  readonly id: string;
  readonly label: string;
  /** The workings, e.g. `20.0 kg × $1.50/kg`. */
  readonly detail?: string;
  /** Signed: adjustments and costs are negative. */
  readonly amount: Cents;
  readonly kind: LineKind;
  /** The rate cell behind the figure, for the expandable citation. */
  readonly cell?: Cell;
  readonly assumption: boolean;
}

export interface CashComparison {
  /** Dollars reaching affected people if the same money were given as cash. */
  readonly delivered: Cents;
  readonly cell: Cell;
  /**
   * How many times more the cash route delivers. Null when the manifest
   * delivers nothing, because a multiple of zero says less than the plain fact.
   */
  readonly multiple: number | null;
}

export interface Displacement {
  readonly grossWeightKg: number;
  /** Costs consumed, expressed in the appeal's own budget per person. */
  readonly personShares: number;
  readonly cell: Cell;
}

export interface ProhibitionNotice {
  readonly itemId: string;
  readonly label: string;
  readonly reason: string;
  readonly sources: readonly string[];
}

export interface Ledger {
  readonly declared: Cents;
  readonly landed: Cents;
  /** Total of every cost line, negative. */
  readonly costs: Cents;
  readonly net: Cents;
  readonly lines: readonly LedgerLine[];
  readonly grossWeightKg: number;
  readonly unusableWeightKg: number;
  /** net ÷ declared. Zero when nothing was declared. */
  readonly efficiency: number;
  readonly verdict: Verdict;
  readonly cash: CashComparison;
  readonly displacement: Displacement;
  /** Items that guidance says must not be donated at all. */
  readonly prohibitions: readonly ProhibitionNotice[];
  readonly mode: Mode;
  readonly options: EngineOptions;
}

export interface PricedManifest extends Ledger {
  /** Net under the kindest and harshest readings the sources permit. */
  readonly band: { readonly low: Cents; readonly high: Cents };
  /** False when the generous and harsh readings disagree about the verdict. */
  readonly verdictStable: boolean;
  readonly verdictLow: Verdict;
  readonly verdictHigh: Verdict;
  /** True when any figure used was an assumption rather than a source. */
  readonly usesAssumptions: boolean;
}

function freightCell(mode: Mode): Cell {
  switch (mode) {
    case "air":
      return AIR_FREIGHT_PER_KG;
    case "road":
      return ROAD_FREIGHT_PER_KG;
    case "sea":
      return SEA_PLUS_ROAD_PER_KG;
  }
}

const MODE_LABEL: Record<Mode, string> = {
  air: "air freight",
  road: "road freight",
  sea: "sea + road freight",
};

const MODE_ROUTE: Record<Mode, string> = {
  air: "DEL→KTM",
  road: "DEL→KTM overland",
  sea: "via Kolkata–Birgunj",
};

export function verdictFor(efficiency: number, net: Cents): Verdict {
  if (net < 0) return "BECOMES_ASH";
  return efficiency >= LANDS_THRESHOLD ? "LANDS" : "BURDENS";
}

/** `$1.50/kg`, for the workings printed beside a cost line. */
function rate(value: number, unit: string): string {
  const digits = value < 0.1 ? 3 : 2;
  return `$${value.toFixed(digits)}/${unit}`;
}

function kg(value: number): string {
  return `${value.toFixed(1)} kg`;
}

const CLASS_LABEL: Record<ItemClass, string> = {
  requested: "not usable on arrival",
  unsolicited: "not needed or not appropriate",
  "used-clothing": "unusable used clothing",
  prohibited: "cannot be distributed at all",
};

interface ResolvedLine {
  readonly item: CatalogItem;
  readonly quantity: number;
  readonly unitUsd: number;
  readonly valueUnitUsd: number;
  readonly weightKg: number;
  readonly usableFraction: number;
}

function resolve(
  manifest: Manifest,
  options: EngineOptions,
): { lines: ResolvedLine[]; unknown: string[] } {
  const lines: ResolvedLine[] = [];
  const unknown: string[] = [];

  for (const line of manifest.lines) {
    const item = CATALOG_BY_ID[line.itemId];
    if (!item) {
      unknown.push(line.itemId);
      continue;
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) continue;

    const quantity = Math.floor(line.quantity);
    const unitUsd = line.declaredUnitUsd ?? item.declaredUsd;
    const usableFraction = item.prohibited
      ? 0
      : benefitOf(usableCellFor(item.itemClass), options.bias);

    lines.push({
      item,
      quantity,
      unitUsd,
      valueUnitUsd: options.valueLocally
        ? benefitOf(item.localReplacement, options.bias)
        : unitUsd,
      weightKg: item.unitWeightKg * quantity,
      usableFraction,
    });
  }

  return { lines, unknown };
}

/** One pass of the arithmetic at a fixed bias. Pure. */
function priceOnce(manifest: Manifest, options: EngineOptions): Ledger {
  const { lines: resolved } = resolve(manifest, options);
  const { bias } = options;

  let declaredUsd = 0;
  let valuedUsd = 0;
  let landedUsd = 0;
  let grossWeightKg = 0;
  let usableWeightKg = 0;

  /** Value lost to unusability, grouped by item class so each keeps its cell. */
  const lostByClass = new Map<ItemClass, number>();
  const prohibitions: ProhibitionNotice[] = [];

  for (const line of resolved) {
    const { item, quantity, unitUsd, valueUnitUsd, weightKg, usableFraction } = line;

    declaredUsd += unitUsd * quantity;
    valuedUsd += valueUnitUsd * quantity;
    landedUsd += valueUnitUsd * quantity * usableFraction;
    grossWeightKg += weightKg;
    usableWeightKg += weightKg * usableFraction;

    const lost = valueUnitUsd * quantity * (1 - usableFraction);
    lostByClass.set(item.itemClass, (lostByClass.get(item.itemClass) ?? 0) + lost);

    if (item.prohibited) {
      prohibitions.push({
        itemId: item.id,
        label: item.label,
        reason: item.prohibited.reason,
        sources: item.prohibited.sources,
      });
    }
  }

  const unusableWeightKg = Math.max(0, grossWeightKg - usableWeightKg);
  const declared = usd(declaredUsd);
  const ledgerLines: LedgerLine[] = [
    {
      id: "declared",
      label: "DECLARED VALUE",
      detail: resolved.length === 1 ? undefined : `${resolved.length} line items`,
      amount: declared,
      kind: "declared",
      assumption: false,
    },
  ];

  if (options.valueLocally && Math.abs(valuedUsd - declaredUsd) >= 0.005) {
    ledgerLines.push({
      id: "local-value",
      label: "valued at in-region prices",
      detail: "what the same goods cost where they are going",
      amount: usd(valuedUsd - declaredUsd),
      kind: "adjustment",
      cell: resolved[0]?.item.localReplacement,
      assumption: true,
    });
  }

  for (const [itemClass, lostUsd] of lostByClass) {
    if (lostUsd < 0.005) continue;
    const cell = itemClass === "prohibited" ? undefined : usableCellFor(itemClass);
    const fraction = cell ? benefitOf(cell, bias) : 0;
    ledgerLines.push({
      id: `unusable-${itemClass}`,
      label: CLASS_LABEL[itemClass],
      detail:
        itemClass === "prohibited"
          ? "guidance prohibits the donation outright"
          : `${Math.round(fraction * 100)}% of this class arrives usable`,
      amount: negate(usd(lostUsd)),
      kind: "adjustment",
      cell,
      assumption: cell?.assumption ?? true,
    });
  }

  const landed = usd(landedUsd);

  const freight = freightCell(manifest.mode);
  const freightRate = costOf(freight, bias);
  const freightCost = usd(grossWeightKg * freightRate);
  if (freightCost !== ZERO) {
    ledgerLines.push({
      id: "freight",
      label: `${MODE_LABEL[manifest.mode]}  ${MODE_ROUTE[manifest.mode]}`,
      detail: `${kg(grossWeightKg)} × ${rate(freightRate, "kg")}`,
      amount: negate(freightCost),
      kind: "cost",
      cell: freight,
      assumption: false,
    });
  }

  const hoursPerTonne = costOf(SORTING_HOURS_PER_TONNE, bias);
  const wage = costOf(SORTING_WAGE_PER_HOUR, bias);
  const sortingHours = (grossWeightKg / 1000) * hoursPerTonne;
  const sortingCost = usd(sortingHours * wage);
  if (sortingCost !== ZERO) {
    ledgerLines.push({
      id: "sorting",
      label: "sorting labour",
      detail: `${sortingHours.toFixed(1)} h × ${rate(wage, "h")} local wage`,
      amount: negate(sortingCost),
      kind: "cost",
      cell: SORTING_HOURS_PER_TONNE,
      assumption: true,
    });
  }

  const disposalRate = costOf(DISPOSAL_PER_KG, bias);
  const disposalCost = usd(unusableWeightKg * disposalRate);
  if (disposalCost !== ZERO) {
    ledgerLines.push({
      id: "disposal",
      label: "disposal",
      detail: `${kg(unusableWeightKg)} unusable × ${rate(disposalRate, "kg")}`,
      amount: negate(disposalCost),
      kind: "cost",
      cell: DISPOSAL_PER_KG,
      assumption: true,
    });
  }

  const storageMonths = costOf(CONGESTED_STORAGE_MONTHS, bias);
  const storageRate = costOf(STORAGE_PER_KG_MONTH, bias);
  const storageCost = usd(grossWeightKg * storageRate * storageMonths);
  if (storageCost !== ZERO) {
    ledgerLines.push({
      id: "storage",
      label: "storage while uncollected",
      detail: `${kg(grossWeightKg)} × ${rate(storageRate, "kg/mo")} × ${storageMonths} mo`,
      amount: negate(storageCost),
      kind: "cost",
      cell: STORAGE_PER_KG_MONTH,
      assumption: true,
    });
  }

  const costs = negate(addCents(freightCost, sortingCost, disposalCost, storageCost));
  const net = addCents(landed, costs);
  const efficiency = declared === 0 ? 0 : net / declared;

  ledgerLines.push({
    id: "net",
    label: "NET VALUE DELIVERED",
    amount: net,
    kind: "total",
    assumption: false,
  });

  const passThrough = benefitOf(CASH_PASS_THROUGH, bias);
  const cashDelivered = usd(declaredUsd * passThrough);
  const cash: CashComparison = {
    delivered: cashDelivered,
    cell: CASH_PASS_THROUGH,
    multiple: net > 0 ? cashDelivered / net : null,
  };

  const costsUsd = -costs / 100;
  const displacement: Displacement = {
    grossWeightKg,
    personShares: costsUsd / APPEAL_USD_PER_PERSON.low,
    cell: APPEAL_USD_PER_PERSON,
  };

  return {
    declared,
    landed,
    costs,
    net,
    lines: ledgerLines,
    grossWeightKg,
    unusableWeightKg,
    efficiency,
    verdict: verdictFor(efficiency, net),
    cash,
    displacement,
    prohibitions,
    mode: manifest.mode,
    options,
  };
}

/**
 * Price a manifest. Runs the arithmetic at the requested bias for the headline
 * and at both extremes for the band, so the result can say when the verdict is
 * not robust to the width of the sourced ranges.
 */
export function price(
  manifest: Manifest,
  overrides?: Partial<EngineOptions>,
): PricedManifest {
  const options: EngineOptions = { ...DEFAULT_OPTIONS, ...overrides };
  const headline = priceOnce(manifest, options);
  const generous =
    options.bias === "generous" ? headline : priceOnce(manifest, { ...options, bias: "generous" });
  const harsh =
    options.bias === "harsh" ? headline : priceOnce(manifest, { ...options, bias: "harsh" });

  return {
    ...headline,
    band: { low: harsh.net, high: generous.net },
    verdictStable: harsh.verdict === generous.verdict,
    verdictLow: harsh.verdict,
    verdictHigh: generous.verdict,
    usesAssumptions: headline.lines.some((line) => line.assumption),
  };
}

/** Catalogue ids in the manifest that this build does not know about. */
export function unknownItems(manifest: Manifest): string[] {
  return manifest.lines
    .map((line) => line.itemId)
    .filter((id) => !(id in CATALOG_BY_ID));
}

/** The one-word verdict, for the chain and for the headline. */
export const VERDICT_LABEL: Record<Verdict, string> = {
  LANDS: "LANDS",
  BURDENS: "BURDENS",
  BECOMES_ASH: "BECOMES ASH",
};

/**
 * A single sentence of plain fact about the outcome, computed here so the
 * language model is never the thing that decides what the number means.
 */
export function summarise(result: PricedManifest): string {
  const { net, declared, cash } = result;
  const delivered = formatUsd(net);
  const given = formatUsd(declared);
  if (net < 0) {
    return `${given} of goods arrives owing ${formatUsd(negate(net))}. The same ${given} as cash delivers ${formatUsd(cash.delivered)}.`;
  }
  if (result.verdict === "BURDENS") {
    return `${given} of goods delivers ${delivered}. The same ${given} as cash delivers ${formatUsd(cash.delivered)}.`;
  }
  return `${given} of goods delivers ${delivered} — this consignment is worth sending.`;
}
