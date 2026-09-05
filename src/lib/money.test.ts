import { describe, expect, it } from "vitest";

import {
  ZERO,
  addCents,
  cents,
  formatPercent,
  formatUsd,
  formatUsdWhole,
  negate,
  scaleCents,
  toCents,
  usd,
} from "@/lib/money";

describe("cents are exact or they are an error", () => {
  it("accepts an integer and refuses anything else", () => {
    expect(cents(1234)).toBe(1234);
    expect(cents(-1234)).toBe(-1234);
    expect(() => cents(12.34)).toThrow(TypeError);
    expect(() => cents(Number.NaN)).toThrow(TypeError);
  });

  it("refuses to round something that is not a number", () => {
    expect(() => toCents(Number.NaN)).toThrow(RangeError);
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("rounds half away from zero, in both directions", () => {
    expect(toCents(0.5)).toBe(1);
    expect(toCents(1.5)).toBe(2);
    expect(toCents(2.5)).toBe(3);
    expect(toCents(-0.5)).toBe(-1);
    expect(toCents(-2.5)).toBe(-3);
    expect(toCents(1.4999)).toBe(1);
  });

  it("is symmetric about zero, so a cost and its refund cancel", () => {
    for (const value of [0.5, 2.5, 7.5, 12.345, 1e6 + 0.5]) {
      expect(toCents(value)).toBe(-toCents(-value));
    }
  });

  it("converts authored dollars to cents", () => {
    expect(usd(1.5)).toBe(150);
    expect(usd(0.07)).toBe(7);
    expect(usd(19.99)).toBe(1999);
    expect(usd(590.48)).toBe(59048);
    expect(usd(-3.5)).toBe(-350);
    expect(usd(0)).toBe(ZERO);
  });
});

describe("a column of cents adds up", () => {
  it("sums to the same total in any order", () => {
    const column = [usd(7.5), usd(-315), usd(1.18), usd(-12.1), ZERO];
    const forwards = addCents(...column);
    const backwards = addCents(...[...column].reverse());
    expect(forwards).toBe(backwards);
    expect(forwards).toBe(-31842);
  });

  it("treats an empty column as zero, not as undefined", () => {
    expect(addCents()).toBe(ZERO);
  });

  it("negates without producing a signed zero the formatter would show", () => {
    expect(negate(usd(12.34))).toBe(-1234);
    expect(negate(negate(usd(12.34)))).toBe(1234);
    expect(formatUsd(negate(ZERO))).toBe("$0.00");
  });

  it("rounds a scaled amount once, at the end", () => {
    expect(scaleCents(cents(333), 1 / 3)).toBe(111);
    expect(scaleCents(cents(100), 0.155)).toBe(16);
    expect(scaleCents(cents(-100), 0.155)).toBe(-16);
  });
});

describe("the ledger reads the way it is meant to", () => {
  it("groups thousands and keeps two decimals in a column", () => {
    expect(formatUsd(cents(123456))).toBe("$1,234.56");
    expect(formatUsd(cents(-123456))).toBe("-$1,234.56");
    expect(formatUsd(cents(123456), { sign: true })).toBe("+$1,234.56");
    expect(formatUsd(cents(-123456), { sign: true })).toBe("-$1,234.56");
    expect(formatUsd(cents(5))).toBe("$0.05");
    expect(formatUsd(ZERO)).toBe("$0.00");
  });

  it("drops the cents from a headline figure", () => {
    expect(formatUsdWhole(cents(123456))).toBe("$1,235");
    expect(formatUsdWhole(cents(-123456))).toBe("-$1,235");
    expect(formatUsdWhole(ZERO)).toBe("$0");
  });

  it("prints a fraction as a percentage", () => {
    expect(formatPercent(0.94)).toBe("94%");
    expect(formatPercent(0.9399, 1)).toBe("94.0%");
    expect(formatPercent(-0.258)).toBe("-26%");
  });
});
