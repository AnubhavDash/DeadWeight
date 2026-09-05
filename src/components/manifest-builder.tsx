"use client";

/**
 * The manifest builder. Holds the only mutable state in the app — what you
 * propose to send, how it travels, and which end of the sourced ranges to read —
 * and re-prices on every keystroke by calling the same pure `price()` the server
 * and the Anchor program use. Nothing here computes a figure of its own.
 */

import { useMemo, useState } from "react";

import { CATALOG, type CatalogItem, type ItemClass } from "@/data/catalog";
import type { Bias } from "@/data/rates";
import { price, type Manifest, type Mode } from "@/lib/logistics";
import { cn } from "@/lib/utils";

import { LedgerTable } from "./ledger-table";
import { Notary } from "./solana/notary";

type Quantities = Record<string, number>;

interface Preset {
  readonly id: string;
  readonly label: string;
  readonly note: string;
  readonly mode: Mode;
  readonly lines: Quantities;
}

const PRESETS: readonly Preset[] = [
  {
    id: "garage",
    label: "The box in the garage",
    note: "Winter coats, shoes and toys, out of a wardrobe and into a crate.",
    mode: "air",
    lines: { "used-winter-jacket": 15, "used-shoes": 25, "soft-toy": 60 },
  },
  {
    id: "water",
    label: "A pallet of bottled water",
    note: "Two hundred litres, sent because water is the obvious thing to send.",
    mode: "air",
    lines: { "bottled-water": 200 },
  },
  {
    id: "appeal",
    label: "What the appeal asked for",
    note: "Purification and portable solar. Both named in the appeal, both light.",
    mode: "air",
    lines: { "purification-tablets": 500, "solar-lamp": 100 },
  },
  {
    id: "cabinet",
    label: "Formula and the medicine cabinet",
    note: "Sent out of real care. Guidance refuses both, and the reason matters.",
    mode: "air",
    lines: { "infant-formula": 24, "assorted-medicines": 10 },
  },
];

const GROUPS: readonly { readonly itemClass: ItemClass; readonly heading: string }[] = [
  { itemClass: "requested", heading: "Named in the flash appeal" },
  { itemClass: "unsolicited", heading: "Not asked for" },
  { itemClass: "used-clothing", heading: "Out of a wardrobe" },
  { itemClass: "prohibited", heading: "Guidance says never" },
];

const MODES: readonly { readonly mode: Mode; readonly label: string; readonly note: string }[] = [
  { mode: "air", label: "Air", note: "Days. The only route into the cut-off districts." },
  { mode: "road", label: "Road", note: "Weeks, over the Birgunj–Raxaul crossing." },
  { mode: "sea", label: "Sea + road", note: "Months. Nepal is landlocked; the ocean stops at Kolkata." },
];

const READINGS: readonly { readonly bias: Bias; readonly label: string; readonly note: string }[] = [
  { bias: "generous", label: "Kindest", note: "Every cost at the low end of its range, every usefulness at the high end, storage at zero. The default." },
  { bias: "midpoint", label: "Midpoint", note: "The middle of every sourced range." },
  { bias: "harsh", label: "Harshest", note: "Costs high, usefulness low, and the consignment sits uncollected for the twelve months it sat in Vanuatu." },
];

/** A step size that matches how the thing is actually sent. */
function stepFor(item: CatalogItem): number {
  if (item.declaredUsd <= 2) return 50;
  if (item.unitWeightKg >= 20) return 1;
  return 5;
}

const STEPPER =
  "flex size-8 shrink-0 items-center justify-center border border-rule text-meltwater transition-colors hover:border-sonar hover:text-sonar disabled:opacity-30 disabled:hover:border-rule disabled:hover:text-meltwater";

function ItemRow({
  item,
  quantity,
  onChange,
}: {
  item: CatalogItem;
  quantity: number;
  onChange: (next: number) => void;
}) {
  const step = stepFor(item);
  const active = quantity > 0;

  return (
    <li className={cn("px-3 py-3 transition-colors", active && "bg-rule/25")}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-[10rem] flex-1">
          <label htmlFor={`qty-${item.id}`} className={cn("block text-sm", active ? "text-paper" : "text-paper/80")}>
            {item.label}
          </label>
          <p className="ledger mt-0.5 text-[11px] text-meltwater">
            {item.unitWeightKg} kg · ${item.declaredUsd.toFixed(2)} per {item.unit}
            {item.onAppeal ? <span className="ml-2 text-sonar">on the appeal</span> : null}
            {item.prohibited ? <span className="ml-2 text-crimson">prohibited</span> : null}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className={STEPPER}
            disabled={quantity === 0}
            aria-label={`Fewer ${item.label}`}
            onClick={() => onChange(Math.max(0, quantity - step))}
          >
            −
          </button>
          <input
            id={`qty-${item.id}`}
            type="number"
            inputMode="numeric"
            min={0}
            step={step}
            value={quantity === 0 ? "" : quantity}
            placeholder="0"
            onChange={(event) => onChange(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
            className="ledger h-8 w-16 border border-rule bg-transparent px-2 text-center text-sm text-paper focus:border-sonar focus:outline-none"
          />
          <button
            type="button"
            className={STEPPER}
            aria-label={`More ${item.label}`}
            onClick={() => onChange(quantity + step)}
          >
            +
          </button>
        </div>
      </div>

      {item.note ? (
        <details className="group mt-2">
          <summary className="w-fit cursor-pointer list-none text-[10px] uppercase tracking-[0.16em] text-meltwater hover:text-sonar">
            <span className="group-open:hidden">why this matters</span>
            <span className="hidden group-open:inline">hide</span>
          </summary>
          <p className="mt-1.5 border-l border-rule pl-3 text-xs leading-relaxed text-meltwater">
            {item.note}
          </p>
        </details>
      ) : null}
    </li>
  );
}

const LEGEND = "display mb-3 text-[11px] uppercase tracking-[0.2em] text-meltwater";

export function ManifestBuilder() {
  const [quantities, setQuantities] = useState<Quantities>(PRESETS[0].lines);
  const [mode, setMode] = useState<Mode>(PRESETS[0].mode);
  const [bias, setBias] = useState<Bias>("generous");
  const [valueLocally, setValueLocally] = useState(false);

  const manifest = useMemo<Manifest>(
    () => ({
      lines: Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity })),
      mode,
    }),
    [quantities, mode],
  );

  const result = useMemo(
    () => price(manifest, { bias, valueLocally }),
    [manifest, bias, valueLocally],
  );

  const setQuantity = (itemId: string, next: number) =>
    setQuantities((current) => ({ ...current, [itemId]: next }));

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-14">
      <div>
        <fieldset className="mb-8">
          <legend className={LEGEND}>Start from a real one</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRESETS.map((preset) => {
              const active =
                preset.mode === mode &&
                Object.entries(preset.lines).every(([id, qty]) => quantities[id] === qty) &&
                Object.entries(quantities).every(
                  ([id, qty]) => qty === 0 || preset.lines[id] === qty,
                );
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setQuantities(preset.lines);
                    setMode(preset.mode);
                  }}
                  className={cn(
                    "border p-3 text-left transition-colors",
                    active
                      ? "border-sonar/60 bg-sonar/5"
                      : "border-rule hover:border-meltwater/60 hover:bg-rule/20",
                  )}
                >
                  <span className={cn("block text-sm", active ? "text-sonar" : "text-paper/90")}>
                    {preset.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-meltwater">
                    {preset.note}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mb-8">
          <legend className={LEGEND}>The manifest</legend>
          <div className="border border-rule">
            {GROUPS.map((group) => (
              <div key={group.itemClass}>
                <p className="border-b border-rule bg-rule/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-meltwater">
                  {group.heading}
                </p>
                <ul className="divide-y divide-rule/60">
                  {CATALOG.filter((item) => item.itemClass === group.itemClass).map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      quantity={quantities[item.id] ?? 0}
                      onChange={(next) => setQuantity(item.id, next)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setQuantities({})}
            className="mt-3 text-[10px] uppercase tracking-[0.16em] text-meltwater hover:text-crimson"
          >
            clear the manifest
          </button>
        </fieldset>

        <div className="grid gap-8 sm:grid-cols-2">
          <fieldset>
            <legend className={LEGEND}>How it travels</legend>
            <Segmented name="Freight mode" value={mode} onChange={setMode} options={MODE_OPTIONS} />
            <p className="mt-2 text-xs leading-relaxed text-meltwater">
              {MODES.find((entry) => entry.mode === mode)?.note}
            </p>
          </fieldset>

          <fieldset>
            <legend className={LEGEND}>Which reading of the sources</legend>
            <Segmented name="Reading" value={bias} onChange={setBias} options={READING_OPTIONS} />
            <p className="mt-2 text-xs leading-relaxed text-meltwater">
              {READINGS.find((entry) => entry.bias === bias)?.note}
            </p>
          </fieldset>
        </div>

        <label className="mt-6 flex cursor-pointer items-start gap-3 text-xs leading-relaxed text-meltwater">
          <input
            type="checkbox"
            checked={valueLocally}
            onChange={(event) => setValueLocally(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--sonar)]"
          />
          <span>
            Value the usable share at what the same goods cost in the region, not at what the donor
            paid. <span className="text-crimson">Off by default:</span> those in-region prices are
            assumptions, and the headline verdict is kept to sourced figures.
          </span>
        </label>
      </div>

      <div className="lg:sticky lg:top-8">
        <LedgerTable result={result} />
        <Notary manifest={manifest} result={result} />
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  name,
}: {
  options: readonly { readonly value: T; readonly label: string }[];
  value: T;
  onChange: (next: T) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex border border-rule">
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 px-1 py-2 text-[11px] uppercase tracking-[0.1em] transition-colors",
            index > 0 && "border-l border-rule",
            option.value === value
              ? "bg-sonar/10 text-sonar"
              : "text-meltwater hover:bg-rule/30 hover:text-paper",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const MODE_OPTIONS = MODES.map((entry) => ({ value: entry.mode, label: entry.label }));
const READING_OPTIONS = READINGS.map((entry) => ({ value: entry.bias, label: entry.label }));
