/**
 * The endpoint's own contract, as opposed to the clamp's — which is tested in
 * `letter.test.ts`. What matters here is the wiring: that the brief this route
 * actually puts on the wire carries no digits, that a draft stating a figure is
 * thrown away by the route and not merely by the library, and that a public
 * unauthenticated endpoint refuses a body it cannot price and caps one caller.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/letter/route";
import { engineLetter } from "@/lib/letter";
import { price, type Manifest } from "@/lib/logistics";

const ASH: Manifest = { lines: [{ itemId: "bottled-water", quantity: 200 }], mode: "air" };

/** The letter this build owes for `ASH` with no model in the loop. */
const ENGINE_ASH = engineLetter(ASH, price(ASH, { bias: "generous" }));

interface Body {
  readonly letter?: string;
  readonly source?: string;
  readonly refused?: string;
  readonly error?: string;
}

// The rate limit is module state, so every case that is not testing it needs a
// caller of its own.
let caller = 0;

async function post(
  body: unknown,
  ip = `198.51.100.${(caller += 1)}`,
): Promise<{ status: number; retryAfter: string | null; body: Body }> {
  const response = await POST(
    new Request("http://localhost/api/letter", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  return {
    status: response.status,
    retryAfter: response.headers.get("retry-after"),
    body: (await response.json()) as Body,
  };
}

/** One reply from every model in the chain, and a record of what was sent. */
function stubGemini(reply: (text: string) => Response, text = ""): { readonly sent: string[] } {
  const sent: string[] = [];
  vi.stubEnv("GEMINI_API_KEY", "not-a-real-key");
  // These cases drive the route's own error paths on purpose; the log lines they
  // produce are the route working, so they are not printed alongside the results.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", (_url: unknown, init: { body?: unknown }) => {
    sent.push(String(init.body));
    return Promise.resolve(reply(text));
  });
  return { sent };
}

function candidate(text: string): Response {
  return Response.json({
    candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the letter ships without a key", () => {
  it("answers with the engine's own letter, uncached, and says so", async () => {
    const { status, body } = await post({ lines: ASH.lines, mode: "air" });
    expect(status).toBe(200);
    expect(body.source).toBe("engine");
    expect(body.refused).toBe("unavailable");
    expect(body.letter).toBe(ENGINE_ASH);
  });

  it("prices the manifest itself rather than trusting anything sent with it", async () => {
    // Figures on the body are not part of the contract and are ignored: the only
    // input is the manifest, and the response is derived from `price()` here.
    const { body } = await post({
      lines: ASH.lines,
      mode: "air",
      declared: 999_999,
      net: 999_999,
      verdict: "LANDS",
    });
    expect(body.letter).toBe(ENGINE_ASH);
  });
});

describe("what the endpoint refuses", () => {
  it.each([
    ["a body that is not JSON", "{nope"],
    ["a body that is not an object", [1, 2]],
    ["a missing manifest", { mode: "air" }],
    ["an unknown mode", { lines: [{ itemId: "rice-sack", quantity: 1 }], mode: "rail" }],
    ["an unknown reading", { lines: [{ itemId: "rice-sack", quantity: 1 }], mode: "air", bias: "kind" }],
    ["an item this build does not have", { lines: [{ itemId: "gold-bar", quantity: 1 }], mode: "air" }],
    ["a fractional quantity", { lines: [{ itemId: "rice-sack", quantity: 1.5 }], mode: "air" }],
    ["a negative quantity", { lines: [{ itemId: "rice-sack", quantity: -3 }], mode: "air" }],
    ["a quantity nobody ships", { lines: [{ itemId: "rice-sack", quantity: 1e9 }], mode: "air" }],
    ["a manifest of zeroes", { lines: [{ itemId: "rice-sack", quantity: 0 }], mode: "air" }],
    ["a price that is not a number", { lines: [{ itemId: "rice-sack", quantity: 1, declaredUnitUsd: Number.NaN }], mode: "air" }],
  ])("refuses %s", async (_label, body) => {
    const out = await post(body);
    expect(out.status).toBe(400);
    expect(out.body.error?.length ?? 0).toBeGreaterThan(0);
    expect(out.body.letter).toBeUndefined();
  });

  it("refuses a manifest longer than the form can produce", async () => {
    const lines = Array.from({ length: 41 }, () => ({ itemId: "rice-sack", quantity: 1 }));
    expect((await post({ lines, mode: "air" })).status).toBe(400);
  });

  it("caps one caller and tells it when to come back", async () => {
    const ip = "203.0.113.9";
    for (let call = 1; call <= 12; call += 1) {
      expect((await post(ASH, ip)).status).toBe(200);
    }
    const capped = await post(ASH, ip);
    expect(capped.status).toBe(429);
    expect(Number(capped.retryAfter)).toBeGreaterThan(0);
  });
});

describe("with a key, the model narrates and nothing more", () => {
  it("sends a brief with no digit anywhere in it", async () => {
    const { sent } = stubGemini(candidate, "It came in by {{route}}, {{weight}} gross.");
    await post(ASH);

    expect(sent.length).toBeGreaterThan(0);
    const wire = JSON.parse(sent[0]!) as {
      systemInstruction: { parts: { text: string }[] };
      contents: { parts: { text: string }[] }[];
    };
    const brief = [
      wire.systemInstruction.parts[0]!.text,
      wire.contents[0]!.parts[0]!.text,
    ].join("\n");
    // The whole guarantee, at the route: a digit in the reply is invented,
    // because there was not one in the question.
    expect(brief).not.toMatch(/\d/);
  });

  it("keeps a draft whose only figures are tokens, and fills them in", async () => {
    stubGemini(candidate, "It came in by {{route}}, {{weight}} gross.\n\n— Receiving, Kathmandu");
    const { body } = await post(ASH);

    expect(body.refused).toBeUndefined();
    expect(body.source).not.toBe("engine");
    expect(body.letter).toBe("It came in by air freight, 210.0 kg gross.\n\n— Receiving, Kathmandu");
  });

  it("throws away a draft that states a figure of its own", async () => {
    const { sent } = stubGemini(candidate, "Your pallet delivered $1,204 of value.");
    const { body } = await post(ASH);

    // Every model in the chain got a turn, and the reader is told what happened.
    expect(sent.length).toBeGreaterThan(1);
    expect(body.source).toBe("engine");
    expect(body.refused).toBe("digits");
    expect(body.letter).toBe(ENGINE_ASH);
  });

  it("throws away a draft that reaches for a token this consignment has no value for", async () => {
    stubGemini(candidate, "We destroyed the {{prohibited}}.");
    const { body } = await post(ASH);
    expect(body.refused).toBe("token");
    expect(body.letter).toBe(ENGINE_ASH);
  });

  it("falls back when the endpoint refuses every model in the chain", async () => {
    stubGemini(() => new Response("upstream is having a day", { status: 503 }));
    const { body } = await post(ASH);
    expect(body.source).toBe("engine");
    expect(body.refused).toBe("unavailable");
  });

  it("reports the model's own filter rather than calling it a refusal of ours", async () => {
    stubGemini(() => Response.json({ promptFeedback: { blockReason: "SAFETY" } }));
    const { body } = await post(ASH);
    expect(body.source).toBe("engine");
    expect(body.refused).toBe("blocked");
  });

  it("passes over a candidate that ran out of room to finish", async () => {
    stubGemini(() =>
      Response.json({ candidates: [{ content: { parts: [] }, finishReason: "MAX_TOKENS" }] }),
    );
    const { body } = await post(ASH);
    expect(body.source).toBe("engine");
    expect(body.refused).toBe("unavailable");
  });
});
