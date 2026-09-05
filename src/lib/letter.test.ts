import { describe, expect, it } from "vitest";

import { CATALOG } from "@/data/catalog";
import type { Bias } from "@/data/rates";
import { price, type Manifest, type Mode } from "@/lib/logistics";
import {
  LETTER_TOKENS,
  buildPrompt,
  deterministicLetter,
  engineLetter,
  figuresFor,
  normalize,
  substitute,
  type LetterFigures,
} from "@/lib/letter";

function manifest(lines: Manifest["lines"], mode: Mode = "air"): Manifest {
  return { lines, mode };
}

/** One manifest of every shape the letter has a branch for. */
const CASES: readonly { readonly name: string; readonly manifest: Manifest }[] = [
  { name: "lands", manifest: manifest([{ itemId: "purification-tablets", quantity: 500 }]) },
  { name: "burdens", manifest: manifest([{ itemId: "used-winter-jacket", quantity: 15 }]) },
  { name: "becomes ash", manifest: manifest([{ itemId: "bottled-water", quantity: 200 }]) },
  { name: "prohibited", manifest: manifest([{ itemId: "infant-formula", quantity: 24 }]) },
  {
    name: "prohibited and heavy",
    manifest: manifest([
      { itemId: "assorted-medicines", quantity: 10 },
      { itemId: "rice-sack", quantity: 40 },
    ]),
  },
  {
    name: "long mixed pallet",
    manifest: manifest(
      CATALOG.map((item, index) => ({ itemId: item.id, quantity: index + 1 })),
      "sea",
    ),
  },
  { name: "single line by road", manifest: manifest([{ itemId: "wool-blanket", quantity: 100 }], "road") },
  { name: "priced by hand", manifest: manifest([{ itemId: "soft-toy", quantity: 60, declaredUnitUsd: 40 }]) },
];

const BIASES: readonly Bias[] = ["generous", "midpoint", "harsh"];

/** Every case at every reading — the letter changes shape with the verdict. */
const EVERY_CASE = CASES.flatMap(({ name, manifest: input }) =>
  BIASES.map((bias) => ({
    name: `${name} (${bias})`,
    manifest: input,
    result: price(input, { bias }),
  })),
);

describe("the prompt cannot leak a figure", () => {
  it("contains no digit anywhere, for any manifest at any reading", () => {
    for (const { name, manifest: input, result } of EVERY_CASE) {
      const { system, user } = buildPrompt(result, figuresFor(input, result));
      expect(system, name).not.toMatch(/\d/);
      expect(user, name).not.toMatch(/\d/);
    }
  });

  it("offers only tokens this manifest has a value for", () => {
    for (const { name, manifest: input, result } of EVERY_CASE) {
      const figures = figuresFor(input, result);
      const { user } = buildPrompt(result, figures);
      for (const token of LETTER_TOKENS) {
        const offered = user.includes(`{{${token}}}`);
        expect(offered, `${name}: ${token}`).toBe(figures[token].length > 0);
      }
    }
  });

  it("puts the prohibition reason in the brief when guidance bans something", () => {
    const input = manifest([{ itemId: "infant-formula", quantity: 24 }]);
    const result = price(input);
    const { user } = buildPrompt(result, figuresFor(input, result));
    expect(user).toContain("breast-milk substitutes");
    expect(user).toContain("must never be donated");
  });
});

const FIGURES: LetterFigures = Object.freeze({
  declared: "$1,000.00",
  net: "-$232.28",
  owed: "$232.28",
  efficiency: "-97%",
  weight: "218.0 kg",
  unusable: "44.0 kg",
  cash: "$800.00",
  shares: "0.6 people's share of the appeal budget",
  verdict: "BECOMES ASH",
  route: "air freight",
  reading: "kindest",
  items: "bottled water, 1 litre",
  prohibited: "",
  appeal: "$49.6 million",
  people: "84,000",
});

describe("normalize throws away any draft that states a figure", () => {
  it("accepts prose whose only numbers are placeholders", () => {
    const draft = "Your pallet — {{items}} — came in by {{route}}, {{weight}} gross.";
    const { text, refused } = normalize(draft, FIGURES);
    expect(refused).toBeUndefined();
    expect(text).toBe("Your pallet — bottled water, 1 litre — came in by air freight, 218.0 kg gross.");
  });

  it.each([
    ["a dollar amount", "It delivered $1,204 of value."],
    ["a bare number", "We wrote off 40 kg of it."],
    ["a percentage", "Only 12% survived."],
    ["a year", "The appeal opened in 2026."],
  ])("refuses %s", (_label, draft) => {
    expect(normalize(draft, FIGURES)).toEqual({ text: "", refused: "digits" });
  });

  it.each([
    ["a fraction", "It lost half its value in the air."],
    ["a multiple", "Cash delivers twice what this did."],
    ["a scale word", "The appeal runs to millions."],
    ["a percentage in words", "Barely any percentage of it survived."],
  ])("refuses %s stated in words", (_label, draft) => {
    expect(normalize(draft, FIGURES)).toEqual({ text: "", refused: "words" });
  });

  it("refuses a token it was never given", () => {
    expect(normalize("It cost {{total}} to bring in.", FIGURES)).toEqual({
      text: "",
      refused: "token",
    });
  });

  it("refuses a token that does not apply to this consignment", () => {
    // `prohibited` is empty here: nothing on the manifest was banned, so a
    // sentence built around it is a sentence about something that is not true.
    expect(normalize("We destroyed the {{prohibited}}.", FIGURES)).toEqual({
      text: "",
      refused: "token",
    });
  });

  it("refuses an empty draft and a runaway one", () => {
    expect(normalize("   \n  ", FIGURES).refused).toBe("empty");
    expect(normalize("word ".repeat(1000), FIGURES).refused).toBe("long");
  });

  it("unwraps a fenced draft rather than refusing it", () => {
    const { text, refused } = normalize("```\nIt came by {{route}}.\n```", FIGURES);
    expect(refused).toBeUndefined();
    expect(text).toBe("It came by air freight.");
  });

  it("leaves an unknown placeholder alone when substituting directly", () => {
    expect(substitute("{{route}} and {{nonsense}}", FIGURES)).toBe("air freight and {{nonsense}}");
  });
});

/** Every engine-rendered figure removed, so any digit left was invented. */
function withoutFigures(letter: string, figures: LetterFigures): string {
  return Object.values(figures)
    .filter((value) => value.length > 0)
    .reduce((text, value) => text.split(value).join(""), letter);
}

describe("the letter that ships without a key", () => {
  it("passes the same clamp a model's draft has to pass", () => {
    for (const { name, manifest: input, result } of EVERY_CASE) {
      const figures = figuresFor(input, result);
      const checked = normalize(deterministicLetter(result, figures), figures);
      expect(checked.refused, name).toBeUndefined();
      expect(checked.text, name).toBe(engineLetter(input, result));
    }
  });

  it("states no number the engine did not compute", () => {
    for (const { name, manifest: input, result } of EVERY_CASE) {
      const figures = figuresFor(input, result);
      expect(withoutFigures(engineLetter(input, result), figures), name).not.toMatch(/\d/);
    }
  });

  it("reads as a letter: three or four paragraphs, signed, short enough for a phone", () => {
    for (const { name, manifest: input, result } of EVERY_CASE) {
      const letter = engineLetter(input, result);
      expect(letter.split("\n\n").length, name).toBeGreaterThanOrEqual(4);
      expect(letter.trimEnd().endsWith("— Receiving, Kathmandu"), name).toBe(true);
      expect(letter.length, name).toBeLessThan(2600);
    }
  });

  it("says the consignment arrived owing money only when it did", () => {
    for (const { name, manifest: input, result } of EVERY_CASE) {
      const letter = engineLetter(input, result);
      expect(letter.includes("arrived owing us"), name).toBe(result.verdict === "BECOMES_ASH");
    }
  });

  it("gives the prohibition its own paragraph, and only when there is one", () => {
    for (const { name, manifest: input, result } of EVERY_CASE) {
      const letter = engineLetter(input, result);
      expect(letter.includes("can be accepted here at all"), name).toBe(
        result.prohibitions.length > 0,
      );
    }
  });

  it("never tells the donor to stop giving", () => {
    for (const { name, manifest: input, result } of EVERY_CASE) {
      const letter = engineLetter(input, result).toLowerCase();
      for (const phrase of ["do not send", "don't send", "stop sending", "wasted your money"]) {
        expect(letter.includes(phrase), `${name}: ${phrase}`).toBe(false);
      }
    }
  });
});

describe("figuresFor renders only what applies", () => {
  it("fills owed exactly when the consignment arrived owing", () => {
    for (const { name, manifest: input, result } of EVERY_CASE) {
      const figures = figuresFor(input, result);
      expect(figures.owed.length > 0, name).toBe(result.net < 0);
    }
  });

  it("leaves prohibited empty when nothing on the manifest is banned", () => {
    const clean = manifest([{ itemId: "purification-tablets", quantity: 500 }]);
    const figures = figuresFor(clean, price(clean));
    expect(figures.prohibited).toBe("");
    expect(figures.declared).toBe("$750.00");
    // Even goods the appeal asked for lose a share in transit, so this one is
    // set: an empty `unusable` means the engine found nothing to write off.
    expect(figures.unusable).toBe("0.3 kg");
  });

  it("renders shares only when handling cost a measurable part of one", () => {
    for (const { name, manifest: input, result } of EVERY_CASE) {
      const figures = figuresFor(input, result);
      expect(figures.shares.length > 0, name).toBe(result.displacement.personShares >= 0.05);
    }
  });

  it("names the largest lines first and counts the rest", () => {
    const input = manifest([
      { itemId: "soft-toy", quantity: 1 },
      { itemId: "rice-sack", quantity: 40 },
      { itemId: "solar-lamp", quantity: 100 },
      { itemId: "used-shoes", quantity: 2 },
      { itemId: "wool-blanket", quantity: 50 },
    ]);
    const figures = figuresFor(input, price(input));
    expect(figures.items).toBe("portable solar lamp; wool blanket; rice, 25 kg sack; and 2 more lines");
  });

  it("reads the appeal's size and target from the sourced record", () => {
    const input = manifest([{ itemId: "wool-blanket", quantity: 1 }]);
    const figures = figuresFor(input, price(input));
    expect(figures.appeal).toBe("$49.6 million");
    expect(figures.people).toBe("84,000");
  });
});
