/**
 * What a caller may post, and how often.
 *
 * Both public endpoints — the letter and the narration — take the same body: a
 * manifest and which end of the sourced ranges to read it at, never a figure.
 * The validator lives here rather than in either route, because two endpoints
 * that disagree about what they accept is a bug waiting to happen.
 *
 * The strictness is the point. The manifest is the only thing a caller is
 * trusted with, and every number on either response is derived from it on the
 * server, so a body that is not exactly what it claims to be is refused rather
 * than coerced into something priceable.
 */

import type { Bias } from "@/data/rates";
import { DEFAULT_OPTIONS, unknownItems, type Manifest, type Mode } from "@/lib/logistics";

/** More lines than the form can produce, so a longer one is not a real caller. */
const MAX_LINES = 40;
const MAX_QUANTITY = 100_000;
const MAX_UNIT_USD = 1_000_000;

const MODES: readonly Mode[] = ["air", "road", "sea"];
const BIASES: readonly Bias[] = ["generous", "midpoint", "harsh"];

export interface Ask {
  readonly manifest: Manifest;
  readonly bias: Bias;
  readonly valueLocally: boolean;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(allowed: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

/**
 * The posted body, or the reason it cannot be priced. Sync and pure: the routes
 * read the request, this decides whether there is a consignment in it.
 */
export function parse(body: unknown): { readonly ask: Ask } | { readonly error: string } {
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
      declaredUnitUsd === undefined ? { itemId, quantity } : { itemId, quantity, declaredUnitUsd },
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
    ask: { manifest, bias: bias ?? DEFAULT_OPTIONS.bias, valueLocally: valueLocally === true },
  };
}

/* --- how often ---------------------------------------------------------- */

export type Gate = { readonly ok: true } | { readonly ok: false; readonly retryAfter: number };

/** Stop tracking callers once the map is larger than any real traffic pattern. */
const MAX_TRACKED = 5000;

/**
 * A per-caller brake, one map per endpoint so the expensive one can be tighter
 * than the cheap one.
 *
 * Per instance and in memory, deliberately: a serverless deployment may run
 * several of these, which makes the real ceiling a multiple of the number given
 * here. It is a brake on a script pointed at the endpoint, not a quota system.
 * Anything stricter wants a shared store, and that is not a dependency this
 * project takes on for a demonstration.
 */
export function limiter({
  perWindow,
  windowMs,
}: {
  readonly perWindow: number;
  readonly windowMs: number;
}): (caller: string, now: number) => Gate {
  const callers = new Map<string, { count: number; resetAt: number }>();

  return function allow(caller, now) {
    if (callers.size > MAX_TRACKED) {
      for (const [key, seen] of callers) if (seen.resetAt <= now) callers.delete(key);
    }

    const seen = callers.get(caller);
    if (!seen || seen.resetAt <= now) {
      callers.set(caller, { count: 1, resetAt: now + windowMs });
      return { ok: true };
    }
    if (seen.count >= perWindow) {
      return { ok: false, retryAfter: Math.ceil((seen.resetAt - now) / 1000) };
    }
    seen.count += 1;
    return { ok: true };
  };
}

/** The first hop of `x-forwarded-for`, which is the one the platform sets. */
export function callerOf(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : (request.headers.get("x-real-ip") ?? "unknown");
}

/**
 * Every reply from either endpoint that is not audio. Never cached: the figures
 * in it belong to one manifest, and a stale letter is a letter about somebody
 * else's consignment.
 */
export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}
