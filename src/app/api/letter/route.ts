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
 * is capped — both in `@/lib/ask`, shared with the narration endpoint so the two
 * cannot drift apart about what they accept. And it works with no
 * `GEMINI_API_KEY` at all: the engine's own letter is not a stub, it is the same
 * letter the model is asked to write, so the feature ships whether or not a key
 * exists.
 *
 * Every reply carries a seal over the letter it contains, which is what lets
 * `/api/narrate` read that letter aloud without becoming a speech proxy for
 * arbitrary posted text. See `@/lib/seal`.
 */

import { callerOf, json, limiter, parse } from "@/lib/ask";
import {
  buildPrompt,
  deterministicLetter,
  figuresFor,
  normalize,
  substitute,
  type Letter,
  type LetterFigures,
  type LetterSource,
  type Prompt,
  type Refusal,
} from "@/lib/letter";
import { price } from "@/lib/logistics";
import { seal } from "@/lib/seal";

export const runtime = "nodejs";

/** The chain below may spend most of half a minute before it gives up. */
export const maxDuration = 45;

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

/** A dozen letters per caller per ten minutes. `limiter` says what that means. */
const allow = limiter({ perWindow: 12, windowMs: 10 * 60_000 });

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

/**
 * What goes on the wire. `Letter` plus the seal, which is not part of the letter
 * itself — it is what `/api/narrate` needs in order to read these exact words
 * aloud rather than the ones a caller made up.
 */
type Reply = Letter & { readonly seal: string };

function reply(letter: string, source: LetterSource, refused?: Refusal): Response {
  // `refused: undefined` is dropped by `JSON.stringify`, so a letter nobody
  // refused carries no such field rather than a null one.
  return json({ letter, source, refused, seal: seal(letter) } satisfies Reply);
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
  if (key === undefined || key.length === 0) return reply(engine(), "engine", "unavailable");

  const written = await fromGemini(buildPrompt(result, figures), figures, key);
  return "letter" in written
    ? reply(written.letter, written.source)
    : reply(engine(), "engine", written.refused);
}
