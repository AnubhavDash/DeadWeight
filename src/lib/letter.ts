/**
 * The letter from the warehouse — and the rule that the model may not state a
 * figure.
 *
 * The artifact is a reply the donor never gets in real life: the receiving end
 * of the consignment, writing back to say what happened to it. A language model
 * writes the prose because prose is what it is good at. It does not write the
 * numbers, and the design here makes that a property of the code rather than a
 * promise in a prompt:
 *
 *  1. The prompt it is given contains **no digits at all** — not the declared
 *     value, not the weight, not the item labels (several of ours carry a size).
 *     It is told the shape of the outcome in words and given placeholder tokens.
 *  2. Every figure arrives afterwards, by substituting `{{token}}` with a string
 *     the engine formatted.
 *  3. `normalize()` refuses the entire draft if a digit — or a word that could
 *     restate a quantity, like `half` or `twice` — appears anywhere outside a
 *     placeholder. There is no repair step and no partial acceptance: a draft
 *     that invents one number has shown it will invent another.
 *
 * A refused draft is not a failure of the feature. The deterministic letter
 * below is written in the same tokens, substituted by the same function, and
 * ships whether or not an API key exists.
 */

import { CRISIS } from "@/data/crisis";
import { CATALOG_BY_ID } from "@/data/catalog";
import { formatPercent, formatUsd, negate } from "@/lib/money";
import { VERDICT_LABEL, type Manifest, type PricedManifest } from "@/lib/logistics";

/**
 * The vocabulary. A token whose value would be empty for a given manifest —
 * `owed` when the consignment did not arrive owing anything, `prohibited` when
 * nothing on it was banned — is a token the draft may not use, and using it is
 * a refusal rather than a blank in the prose.
 */
export const LETTER_TOKENS = [
  "declared",
  "net",
  "owed",
  "efficiency",
  "weight",
  "unusable",
  "cash",
  "shares",
  "verdict",
  "route",
  "reading",
  "items",
  "prohibited",
  "appeal",
  "people",
] as const;

export type LetterToken = (typeof LETTER_TOKENS)[number];

/** Every token, rendered by the engine. Empty string means "not applicable". */
export type LetterFigures = Readonly<Record<LetterToken, string>>;

/** Why a draft was thrown away. Shown to the reader; never silently swallowed. */
export type Refusal =
  | "digits" // stated a figure of its own
  | "words" // stated a quantity in words
  | "token" // used a placeholder that does not exist or does not apply
  | "empty"
  | "long"
  | "unavailable" // no key, or the endpoint refused every model in the chain
  | "blocked"; // the model's own safety filter

export type LetterSource = "engine" | (string & {});

export interface Letter {
  readonly letter: string;
  /** `engine`, or `gemini-3.8-flash` — whichever wrote the prose that survived. */
  readonly source: LetterSource;
  readonly refused?: Refusal;
}

/* --- what the engine renders into the tokens ---------------------------- */

const ROUTE: Record<PricedManifest["mode"], string> = {
  air: "air freight",
  road: "road freight",
  sea: "sea freight and road",
};

const READING: Record<PricedManifest["options"]["bias"], string> = {
  generous: "kindest",
  midpoint: "midpoint",
  harsh: "harshest",
};

/** Lowercase the first character only: labels are sentence-case, prose is not. */
function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** What a line is worth as declared. Used only to order the list. */
function declaredValueOf(line: Manifest["lines"][number]): number {
  const item = CATALOG_BY_ID[line.itemId];
  return (line.declaredUnitUsd ?? item?.declaredUsd ?? 0) * line.quantity;
}

/** How many labels the letter names before it stops listing. */
const ITEMS_NAMED = 3;

/**
 * The consignment's contents, largest by declared value first. Joined with
 * semicolons because several catalogue labels carry a comma of their own, and
 * `rice, 25 kg sack, bottled water, 1 litre` is a list of four things.
 */
function itemList(manifest: Manifest): string {
  const items = manifest.lines
    .filter((line) => line.quantity > 0)
    .slice()
    .sort((a, b) => declaredValueOf(b) - declaredValueOf(a) || a.itemId.localeCompare(b.itemId))
    .map((line) => CATALOG_BY_ID[line.itemId])
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  if (items.length === 0) return "";
  const named = items.slice(0, ITEMS_NAMED).map((item) => lower(item.label));
  const rest = items.length - named.length;
  const list = named.join("; ");
  return rest === 0 ? list : `${list}; and ${rest} more line${rest === 1 ? "" : "s"}`;
}

/** `0.6 people's share of the appeal budget`, from the displacement figure. */
function shareOf(personShares: number): string {
  if (personShares < 0.05) return "";
  return `${personShares.toFixed(1)} people's share of the appeal budget`;
}

/** `$49.6 million`, from the appeal's own total. Never hardcoded here. */
function appealSize(): string {
  return `$${(CRISIS.appeal.usd / 1_000_000).toFixed(1)} million`;
}

/** `1,010.8 kg`. Separated, because a consignment can run to five figures. */
function kg(value: number): string {
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
}

/**
 * Every token, rendered. This is the only place a figure becomes a string for
 * the letter, and every string in it was produced by the engine or read from a
 * dated source — never by the model.
 */
export function figuresFor(manifest: Manifest, result: PricedManifest): LetterFigures {
  return {
    declared: formatUsd(result.declared),
    net: formatUsd(result.net),
    owed: result.net < 0 ? formatUsd(negate(result.net)) : "",
    efficiency: formatPercent(result.efficiency),
    weight: kg(result.grossWeightKg),
    unusable: result.unusableWeightKg >= 0.05 ? kg(result.unusableWeightKg) : "",
    cash: formatUsd(result.cash.delivered),
    shares: shareOf(result.displacement.personShares),
    verdict: VERDICT_LABEL[result.verdict],
    route: ROUTE[result.mode],
    reading: READING[result.options.bias],
    items: itemList(manifest),
    prohibited: result.prohibitions.map((notice) => lower(notice.label)).join("; "),
    appeal: appealSize(),
    people: CRISIS.appeal.people.toLocaleString("en-US"),
  };
}

/* --- the clamp ---------------------------------------------------------- */

const PLACEHOLDER = /\{\{\s*([a-z]+)\s*\}\}/g;

/**
 * Words that restate a quantity without using a digit. `two` and `one` are not
 * here on purpose — "one more thing" is prose, and no figure in this ledger is
 * expressible as a small counting number. Fractions and multipliers are: a
 * model that writes "lost half its value" has asserted arithmetic.
 */
const QUANTITY_WORDS =
  /\b(half|halves|third|thirds|quarter|quarters|fifth|fifths|double|doubled|triple|tripled|twice|thrice|tenfold|dozen|dozens|hundred|hundreds|thousand|thousands|million|millions|billion|billions|percent|per cent|percentage)\b/i;

/** A runaway draft. The letter is meant to be read on a phone. */
const MAX_LETTER_CHARS = 2600;

/** Fenced code blocks, which some models wrap prose in unbidden. */
const FENCE = /^\s*```[a-z]*\n([\s\S]*?)\n?```\s*$/;

/** Replace every `{{token}}` with what the engine rendered for it. */
export function substitute(text: string, figures: LetterFigures): string {
  return text.replace(PLACEHOLDER, (whole, name: string) =>
    name in figures ? figures[name as LetterToken] : whole,
  );
}

/**
 * Accept a draft only if every number in it will be one we wrote. Returns the
 * finished letter, or the reason the draft was thrown away — never a repaired
 * version of it, because a draft that invented one figure has demonstrated it
 * will invent another somewhere a regex cannot see.
 */
export function normalize(
  draft: string,
  figures: LetterFigures,
): { readonly text: string; readonly refused?: Refusal } {
  const unfenced = draft.trim().replace(FENCE, "$1").trim();
  if (unfenced.length === 0) return { text: "", refused: "empty" };
  if (unfenced.length > MAX_LETTER_CHARS) return { text: "", refused: "long" };

  for (const [, name] of unfenced.matchAll(PLACEHOLDER)) {
    // Unknown token, or one this manifest has no value for: either way the
    // sentence around it was written about something that is not the case.
    if (!(name in figures) || figures[name as LetterToken].length === 0) {
      return { text: "", refused: "token" };
    }
  }

  const prose = unfenced.replace(PLACEHOLDER, "");
  if (/\d/.test(prose)) return { text: "", refused: "digits" };
  if (QUANTITY_WORDS.test(prose)) return { text: "", refused: "words" };

  return { text: substitute(unfenced, figures) };
}

/* --- the prompt --------------------------------------------------------- */

/** What each token will say, in words. Digit-free, like the whole prompt. */
const TOKEN_BRIEF: Record<LetterToken, string> = {
  declared: "what the donor declared the goods were worth, as a dollar amount",
  net: "what the consignment was worth once it was here, net of every cost",
  owed: "how much it arrived owing, as a dollar amount",
  efficiency: "the share of the declared value that survived the journey, as a percentage",
  weight: "the gross weight that came off the aircraft or the truck",
  unusable: "the weight of what arrived that could not be put into a distribution",
  cash: "what the same declared amount delivers here when it is sent as cash instead",
  shares: "what handling this consignment consumed, in the appeal's own budget per person",
  verdict: "the one-word verdict the ledger reached",
  route: "how it travelled",
  reading: "which end of every sourced cost range these figures were read at",
  items: "the contents, as a semicolon-separated list of the largest lines",
  prohibited: "the items on it that guidance says must not be donated at all",
  appeal: "the size of the flash appeal",
  people: "how many people the appeal is for",
};

const OUTCOME: Record<PricedManifest["verdict"], string> = {
  LANDS:
    "It delivered most of what the donor declared. This is a consignment worth sending and you should say so plainly, without gushing.",
  BURDENS:
    "It delivered real value, but most of what the donor gave was consumed getting it here. Nobody did anything wrong; the arithmetic is simply poor.",
  BECOMES_ASH:
    "It arrived owing money: getting it here, sorting it and disposing of what nobody could use cost more than everything in it was worth. Say this without cruelty and without softening it.",
};

const SYSTEM = [
  "You are the logistics officer at a relief warehouse on the Kathmandu ring road, in the response to the glacial flood in Rasuwa. You are writing back to a private donor whose consignment you have just checked in against the manifest they sent with it. You are tired, precise and not unkind. You are not a fundraiser and you are not scolding anybody. You are the one person who knows what actually happened to their pallet, and you think they are owed it.",
  "Absolute rules:",
  "- Never write a number. Not as digits, not spelled out, not as a fraction, a percentage, a multiple or a comparison like `half` or `twice`. You have not been told any of the figures and you cannot guess them: they are inserted after you finish, by the system that computed them. A single number of your own and the entire letter is thrown away unread.",
  "- State a figure only by placing one of the tokens listed below, written exactly as given, braces included. Never invent a token and never use one that is not on the list — the list holds only the tokens that apply to this consignment.",
  "- Do not thank them twice. Do not use the words `generous`, `generosity` or `kind`. Do not apologise. Do not tell them to stop giving, and never suggest their intention was bad.",
  "- British spelling. Plain declarative sentences. No headings, no lists, no markdown, no subject line, no greeting other than a name you do not know — so begin with the consignment, not with `Dear`.",
  "- Three short paragraphs, then a signature line beginning with an em dash and naming the warehouse rather than a person. A reader on a phone should get to the end of it.",
  "Token use looks like this — the shape, not the sentence: `The pallet came in by {{route}}, {{weight}} gross. On the manifest: {{items}}.` Item labels carry commas of their own, so put `{{items}}` at the end of its sentence, never mid-clause.",
].join("\n");

export interface Prompt {
  readonly system: string;
  readonly user: string;
}

/**
 * The brief, in words. It contains no digits anywhere — not in the facts, not in
 * the token descriptions, not in the item labels, which is why a digit in the
 * reply is proof the model invented it rather than read it.
 */
export function buildPrompt(result: PricedManifest, figures: LetterFigures): Prompt {
  const facts: string[] = [
    OUTCOME[result.verdict],
    `It came by ${figures.route}.`,
    `Every cost was read at the ${figures.reading} end of the sourced ranges, so these figures are the ${result.options.bias === "harsh" ? "least" : "most"} flattering the sources permit.`,
  ];

  if (figures.unusable.length > 0) {
    facts.push("Some of what arrived could not be put into a distribution at all.");
  }
  if (!result.verdictStable) {
    facts.push(
      "The verdict is not robust: the kindest and harshest readings of the same sources disagree about it. Do not claim certainty you have not got — one clause, no hedging beyond it.",
    );
  }
  for (const notice of result.prohibitions) {
    facts.push(
      `The consignment included something guidance says must never be donated at all. The reason, which you may put in your own words: ${notice.reason} Give this its own sentences; it matters more than the arithmetic.`,
    );
  }
  facts.push(
    `The flash appeal for this response opens its own priority list with ${CRISIS.appeal.priorities[0]}, ahead of ${CRISIS.appeal.priorities.slice(1).join(", ")}.`,
  );

  const tokens = LETTER_TOKENS.filter((token) => figures[token].length > 0).map(
    (token) => `{{${token}}} — ${TOKEN_BRIEF[token]}`,
  );

  return {
    system: SYSTEM,
    user: [
      "The consignment has been checked in. What is known, in words:",
      facts.map((fact) => `- ${fact}`).join("\n"),
      "",
      "Tokens available for this consignment — these and no others:",
      tokens.join("\n"),
      "",
      "Write the reply now. First paragraph: it arrived and was checked in, what was in it, how it travelled, how much of it there was. Second paragraph: what the arithmetic came to and what consumed the difference. Third paragraph: what the same declared amount delivers as cash, the size of the appeal and who it is for, and the fact that cash is the first line of the response's own list. Then the signature.",
    ].join("\n"),
  };
}

/* --- the letter that ships without a key -------------------------------- */

const OPENING =
  "Your consignment reached the warehouse, and somebody here checked it in against the manifest that came with it: {{weight}} gross, in by {{route}}. On the manifest: {{items}}. This is what it came to. I would rather you heard it from the people who unpacked it.";

const PROHIBITED =
  "One thing separately, because it is not an arithmetic problem. Nothing on this part of the manifest can be accepted here at all: {{prohibited}}. Not sorted, not stored, not passed to anybody — inventoried and then destroyed as waste, at our cost, under the guidance every agency in this response works to. That is not a preference of ours. It is the rule, and it exists because of what happens when it is broken.";

const CLOSING =
  "The same {{declared}} sent as cash delivers {{cash}} here, because we buy in the region, pay nothing to fly it, and buy the thing the list says we are short of. The appeal is {{appeal}} for {{people}} people, and its own first line is direct cash assistance. Nobody here is asking you for anything; this is only the accounting of what you already sent.";

const SIGNATURE = "— Receiving, Kathmandu";

/**
 * The letter when there is no key, or when the model wrote a figure and had its
 * draft thrown away. Written in the same tokens and finished by the same
 * substitution, so it is subject to the same clamp rather than exempt from it.
 */
export function deterministicLetter(result: PricedManifest, figures: LetterFigures): string {
  const wrote = figures.unusable.length > 0;
  // A light consignment can consume less than a tenth of one person's share, in
  // which case the engine renders nothing and the sentence must not be written.
  const displaced = figures.shares.length > 0;
  const middle =
    result.verdict === "LANDS"
      ? `{{declared}} of declared goods delivered {{net}} of usable value here: {{efficiency}} of what you gave, at the {{reading}} reading of our own cost figures. ${
          wrote
            ? "We wrote off {{unusable}} that arrived in no state to hand to anybody, and the rest went out."
            : "Nothing had to be written off."
        } The ledger calls that {{verdict}}, and it is rarer than you would think.`
      : result.verdict === "BURDENS"
        ? `{{declared}} of declared goods delivered {{net}} here: {{efficiency}} of what you gave, at the {{reading}} reading of our own cost figures. Freight took the largest share, then sorting, ${
            wrote ? "then the {{unusable}} we could not put into anybody's hands, " : ""
          }then storage while it waited for a truck up the valley.${
            displaced ? " Handling it consumed {{shares}}." : ""
          } Nobody here is ungrateful and nothing was wasted on purpose: the goods flew, and flying them cost most of what they were worth.`
        : `It arrived owing us {{owed}}. {{declared}} of declared goods came in, and by the time we had paid the freight, sorted it, ${
            wrote ? "disposed of the {{unusable}} that could not be given to anyone, " : ""
          }and stored what was left, the consignment was worth {{net}} — {{efficiency}} of what you gave, at the {{reading}} reading of our own figures.${
            displaced
              ? " Handling it consumed {{shares}}: staff hours and truck space that were budgeted for somebody in Rasuwa."
              : ""
          }`;

  const paragraphs = [OPENING, middle];
  if (figures.prohibited.length > 0) paragraphs.push(PROHIBITED);
  paragraphs.push(CLOSING, SIGNATURE);
  return paragraphs.join("\n\n");
}

/**
 * The whole fallback path, for the route and for tests: the engine's own letter,
 * finished. Never throws, never needs a network, never states a figure the
 * engine did not compute.
 */
export function engineLetter(manifest: Manifest, result: PricedManifest): string {
  const figures = figuresFor(manifest, result);
  return substitute(deterministicLetter(result, figures), figures);
}
