/**
 * Integer-cent USD arithmetic.
 *
 * Every figure in Deadweight is an integer number of US cents, start to finish.
 * Two reasons, and neither is style:
 *
 *  1. The Anchor program stores `declared_usd_cents: u64` and `net_usd_cents:
 *     i64`. If the browser and the chain disagree by a rounding step, the
 *     public ledger contradicts the page that produced it. Cents are the only
 *     representation both sides can hold exactly.
 *  2. Floating-point dollars accumulate error across a dozen ledger lines, and
 *     a ledger that does not add up is worthless no matter how it looks.
 *
 * Rounding is applied once, at the moment a rate multiplies a quantity, and
 * never again. `Cents` is a branded number so an un-rounded intermediate cannot
 * be passed where a settled amount is expected.
 */

declare const CENTS: unique symbol;

/** An exact integer number of US cents. May be negative: costs are signed. */
export type Cents = number & { readonly [CENTS]: true };

/** Assert an already-integral value is cents. Throws on non-integers. */
export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new TypeError(`cents() requires an integer, received ${value}`);
  }
  return value as Cents;
}

export const ZERO = cents(0);

/**
 * Round a real-valued amount of cents to the nearest cent, half away from
 * zero, so that -0.5 becomes -1 rather than 0. Banker's rounding would bias
 * a long column of costs toward zero, which in this app means flattering the
 * donation. Half-up on the magnitude does not.
 */
export function toCents(value: number): Cents {
  if (!Number.isFinite(value)) {
    throw new RangeError(`toCents() requires a finite number, received ${value}`);
  }
  const rounded = value < 0 ? -Math.round(-value) : Math.round(value);
  return rounded as Cents;
}

/** Dollars (as authored in the rate tables) to cents. */
export function usd(dollars: number): Cents {
  return toCents(dollars * 100);
}

export function addCents(...values: Cents[]): Cents {
  let total = 0;
  for (const value of values) total += value;
  return total as Cents;
}

export function negate(value: Cents): Cents {
  return -value as Cents;
}

/** Multiply cents by a dimensionless factor, rounding once at the end. */
export function scaleCents(value: Cents, factor: number): Cents {
  return toCents(value * factor);
}

/**
 * Format for display: `$1,234.56`, or `-$1,234.56` for a loss. The minus sign
 * leads the currency symbol rather than trailing it, because the ledger is
 * right-aligned and a leading sign keeps the decimal points in a column.
 */
export function formatUsd(value: Cents, options?: { sign?: boolean }): string {
  const negative = value < 0;
  const body = (Math.abs(value) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = negative ? "-" : options?.sign ? "+" : "";
  return `${sign}$${body}`;
}

/** Whole dollars, for headline figures where cents are noise: `$1,235`. */
export function formatUsdWhole(value: Cents): string {
  const negative = value < 0;
  const body = Math.round(Math.abs(value) / 100).toLocaleString("en-US");
  return `${negative ? "-" : ""}$${body}`;
}

/** `42%`, from a 0–1 fraction. Clamped for display only, never for maths. */
export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}
