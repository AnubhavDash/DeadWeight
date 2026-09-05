/**
 * `POST /api/letter` — the reply from the warehouse.
 *
 * The client posts a **manifest**, never a figure. This route prices it with the
 * same engine the page uses, builds a digit-free brief, asks Gemini for prose,
 * and then throws the draft away unless every number in it is one we inserted
 * ourselves. See `@/lib/letter` for the clamp; this file is the plumbing around
 * it: validation, the model chain, and a rate limit.
 *
 * Two things worth saying out loud. It is a public unauthenticated endpoint that
 * spends money at a paid API, so the body is validated strictly and each caller
 * is capped. And it works with no `GEMINI_API_KEY` at all — the engine's own
 * letter is not a stub, it is the same letter the model is asked to write, so
 * the feature ships whether or not a key exists.
 */

import {
  buildPrompt,
  deterministicLetter,
  figuresFor,
  normalize,
  substitute,
  type Letter,
  type LetterFigures,
  type Prompt,
  type Refusal,
} from "@/lib/letter";
import {
  DEFAULT_OPTIONS,
  price,
  unknownItems,
  type Manifest,
  type Mode,
} from "@/lib/logistics";
import type { Bias } from "@/data/rates";

export const runtime = "nodejs";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Newest first, with a model from the previous generation at the tail. The chain
 * is overridable by `GEMINI_MODELS` so a retired id is a config change rather
 * than a deploy, which is the failure mode these ids actually have.
 */
const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-2.5-flash"] as const;

/** No thinking configuration is sent: the field moved with the Interactions API
 * and an unknown key is a 400 that would take the whole chain down with it. The
 * output budget is set wide enough that a thinking model still has room for the
 * letter, and a truncated candidate is treated as a miss and passed over. */
const MAX_OUTPUT_TOKENS = 2048;

const PER_MODEL_TIMEOUT_MS = 12_000;
const TOTAL_BUDGET_MS = 26_000;

/* --- limits ------------------------------------------------------------- */

const MAX_LINES = 40;
const MAX_QUANTITY = 100_000;
const MAX_UNIT_USD = 1_000_000;

const MODES: readonly Mode[] = ["air", "road", "sea"];
const BIASES: readonly Bias[] = ["generous", "midpoint", "harsh"];

/* --- the rate limit ----------------------------------------------------- */

/**
 * Per instance, in memory, and deliberately so: a serverless deployment may run
 * several of these, which makes the real ceiling a multiple of this one. It is a
 * brake on a script pointed at the endpoint, not a quota system. Anything
 * stricter wants a shared store, and that is not a dependency this project is
 * taking on for a demonstration.
 */
const WINDOW_MS = 10 * 60_000;
const PER_WINDOW = 12;
const MAX_TRACKED = 5000;

const callers = new Map<string, { count: number; resetAt: number }>();

function allow(caller: string, now: number): { ok: true } | { ok: false; retryAfter: number } {
  if (callers.size > MAX_TRACKED) {
    for (const [key, seen] of callers) if (seen.resetAt <= now) callers.delete(key);
  }

  const seen = callers.get(caller);
  if (!seen || seen.resetAt <= now) {
    callers.set(caller, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true };
  }
  if (seen.count >= PER_WINDOW) {
    return { ok: false, retryAfter: Math.ceil((seen.resetAt - now) / 1000) };
  }
  seen.count += 1;
  return { ok: true };
}

/** The first hop of `x-forwarded-for`, which is the one the platform sets. */
function callerOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : (request.headers.get("x-real-ip") ?? "unknown");
}

/* --- what a caller may send --------------------------------------------- */

interface Ask {
  readonly manifest: Manifest;
  readonly bias: Bias;
  readonly valueLocally: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

/**
 * Strict on purpose. The manifest is the only thing the client is trusted with,
 * and everything numeric on the response is derived from it here, so a body that
 * is not exactly what it claims to be is refused rather than coerced.
 */
function parse(body: unknown): { readonly ask: Ask } | { readonly error: string } {
  if (!isRecord(body)) return { error: "Expected a JSON object." };

  const { lines, mode, bias, valueLocally } = body;
  if (!Array.isArray(lines)) return { error: "`lines` must be an array." };
  if (lines.length > MAX_LINES) {
    return { error: `A manifest may hold at most ${MAX_LINES} lines.` };
  }
  if (!oneOf(MODES, mode)) return { error: "`mode` must be air, road or sea." };
  if (bias !== undefined && !oneOf(BIASES, bias)) {
    return { error: "`bias` must be generous, midpoint or harsh." };
  }
  if (valueLocally !== undefined && typeof valueLocally !== "boolean") {
    return { error: "`valueLocally` must be true or false." };
  }

  const parsed: Manifest["lines"][number][] = [];
  for (const line of lines) {
    if (!isRecord(line)) return { error: "Every line must be an object." };
    const { itemId, quantity, declaredUnitUsd } = line;
    if (typeof itemId !== "string" || itemId.length === 0 || itemId.length > 64) {
      return { error: "Every line needs an `itemId`." };
    }
    if (
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > MAX_QUANTITY
    ) {
      return { error: `\`quantity\` must be a whole number from zero to ${MAX_QUANTITY}.` };
    }
    if (
      declaredUnitUsd !== undefined &&
      (typeof declaredUnitUsd !== "number" ||
        !Number.isFinite(declaredUnitUsd) ||
        declaredUnitUsd < 0 ||
        declaredUnitUsd > MAX_UNIT_USD)
    ) {
      return { error: "`declaredUnitUsd` must be an amount in dollars." };
    }
    parsed.push(
      declaredUnitUsd === undefined
        ? { itemId, quantity }
        : { itemId, quantity, declaredUnitUsd },
    );
  }

  const manifest: Manifest = { lines: parsed, mode };
  const unknown = unknownItems(manifest);
  if (unknown.length > 0) {
    return { error: `This build does not know these items: ${unknown.join(", ")}.` };
  }
  if (!parsed.some((line) => line.quantity > 0)) {
    return { error: "The manifest is empty. There is nothing to write about." };
  }

  return {
    ask: {
      manifest,
      bias: bias ?? DEFAULT_OPTIONS.bias,
      valueLocally: valueLocally === true,
    },
  };
}

/* --- one call to one model ---------------------------------------------- */

/** Only the fields this route reads. The rest of the envelope is ignored. */
interface GeminiReply {
  readonly candidates?: readonly {
    readonly content?: { readonly parts?: readonly { readonly text?: string }[] };
    readonly finishReason?: string;
  }[];
  readonly promptFeedback?: { readonly blockReason?: string };
}

/** A draft, or the reason there is not one. No text and no refusal is a miss. */
interface Candidate {
  readonly text?: string;
  readonly refused?: Refusal;
}

/** `STOP` is the only finish this route can use a candidate from. */
const BLOCKED_FINISHES = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII"]);

function modelChain(): readonly string[] {
  const configured = process.env.GEMINI_MODELS?.split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  return configured && configured.length > 0 ? configured : DEFAULT_MODELS;
}

/**
 * One `generateContent`. Errors are logged with the model and the status and
 * never with the key, and every unusable answer comes back as a miss so the
 * caller can move down the chain instead of handling a throw per model.
 */
async function ask(
  model: string,
  key: string,
  prompt: Prompt,
  signal: AbortSignal,
): Promise<Candidate> {
  const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt.system }] },
      contents: [{ role: "user", parts: [{ text: prompt.user }] }],
      generationConfig: { temperature: 1, maxOutputTokens: MAX_OUTPUT_TOKENS },
    }),
  });

  if (!response.ok) {
    console.error(`letter: ${model} answered ${response.status} ${response.statusText}`);
    return {};
  }

  const reply = (await response.json()) as GeminiReply;

  const blocked = reply.promptFeedback?.blockReason;
  if (blocked !== undefined) {
    console.error(`letter: ${model} blocked the brief (${blocked})`);
    return { refused: "blocked" };
  }

  const candidate = reply.candidates?.[0];
  const finish = candidate?.finishReason;
  if (finish !== undefined && BLOCKED_FINISHES.has(finish)) {
    console.error(`letter: ${model} stopped on ${finish}`);
    return { refused: "blocked" };
  }
  // `MAX_TOKENS` on a thinking model means the letter itself never got written.
  // A truncated draft is not a draft, so it is a miss rather than a refusal.
  if (!candidate || (finish !== undefined && finish !== "STOP")) {
    console.error(`letter: ${model} returned no usable candidate (${finish ?? "none"})`);
    return {};
  }

  const text = (candidate.content?.parts ?? []).map((part) => part.text ?? "").join("");
  return text.trim().length > 0 ? { text } : {};
}

/* --- the chain ---------------------------------------------------------- */

type Written =
  | { readonly letter: string; readonly source: string }
  | { readonly refused: Refusal };

/**
 * Walk the chain until a draft survives the clamp. A model that errors, times
 * out or states a figure of its own is passed over rather than retried: the next
 * id in the chain is a better bet than the same id a second time. The whole walk
 * is bounded, because something has to answer the request.
 */
async function fromGemini(prompt: Prompt, figures: LetterFigures, key: string): Promise<Written> {
  const started = Date.now();
  let refused: Refusal = "unavailable";

  for (const model of modelChain()) {
    const remaining = TOTAL_BUDGET_MS - (Date.now() - started);
    if (remaining < 2_000) break;

    let candidate: Candidate;
    try {
      const signal = AbortSignal.timeout(Math.min(PER_MODEL_TIMEOUT_MS, remaining));
      candidate = await ask(model, key, prompt, signal);
    } catch (thrown) {
      console.error(`letter: ${model} failed —`, thrown instanceof Error ? thrown.message : thrown);
      continue;
    }

    if (candidate.refused !== undefined) {
      refused = candidate.refused;
      continue;
    }
    if (candidate.text === undefined) continue;

    const checked = normalize(candidate.text, figures);
    if (checked.refused === undefined) return { letter: checked.text, source: model };

    // It wrote a number, or reached for a token that does not apply. That is the
    // interesting failure, so it is logged by kind and shown to the reader.
    console.error(`letter: ${model} draft thrown away (${checked.refused})`);
    refused = checked.refused;
  }

  return { refused };
}

/* --- the handler -------------------------------------------------------- */

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
}

export async function POST(request: Request): Promise<Response> {
  const gate = allow(callerOf(request), Date.now());
  if (!gate.ok) {
    return json({ error: "That is a lot of letters. Give the warehouse a minute." }, 429, {
      "retry-after": String(gate.retryAfter),
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "The body must be JSON." }, 400);
  }

  const parsed = parse(body);
  if ("error" in parsed) return json({ error: parsed.error }, 400);

  // Priced here, from the manifest, by the same function the page calls. Nothing
  // numeric the client sent is echoed back and nothing it sent is trusted.
  const { manifest, bias, valueLocally } = parsed.ask;
  const result = price(manifest, { bias, valueLocally });
  const figures = figuresFor(manifest, result);
  const engine = () => substitute(deterministicLetter(result, figures), figures);

  const key = process.env.GEMINI_API_KEY?.trim();
  if (key === undefined || key.length === 0) {
    return json({ letter: engine(), source: "engine", refused: "unavailable" } satisfies Letter);
  }

  const written = await fromGemini(buildPrompt(result, figures), figures, key);
  return json(
    "letter" in written
      ? ({ letter: written.letter, source: written.source } satisfies Letter)
      : ({ letter: engine(), source: "engine", refused: written.refused } satisfies Letter),
  );
}
