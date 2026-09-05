/**
 * The narration endpoint's contract. The load-bearing claim is that this is not
 * a text-to-speech proxy: what gets synthesised is either a letter carrying the
 * seal this build issued for it, or the letter this build computes from the
 * manifest — never text a caller made up. The rest is the usual for a public,
 * unauthenticated, paid-API endpoint: strict validation and a cap per caller.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/narrate/route";
import { engineLetter } from "@/lib/letter";
import { price, type Manifest } from "@/lib/logistics";
import { seal } from "@/lib/seal";

const ASH: Manifest = { lines: [{ itemId: "bottled-water", quantity: 200 }], mode: "air" };

/** The letter this build owes for `ASH`, and the seal it would ship with. */
const ENGINE_ASH = engineLetter(ASH, price(ASH, { bias: "generous" }));

const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00]);

interface Sent {
  readonly url: string;
  readonly body?: unknown;
}

let caller = 0;

async function post(
  body: unknown,
  ip = `198.51.100.${(caller += 1)}`,
): Promise<{ status: number; type: string | null; bytes: number; error?: string }> {
  const response = await POST(
    new Request("http://localhost/api/narrate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  const type = response.headers.get("content-type");
  if (type?.startsWith("application/json") === true) {
    const parsed = (await response.json()) as { error?: string };
    return { status: response.status, type, bytes: 0, error: parsed.error };
  }
  return { status: response.status, type, bytes: (await response.arrayBuffer()).byteLength };
}

/**
 * A key, a fixed voice, and a record of every request the route makes. The voice
 * is pinned by default so a case that does not care about discovery does not
 * have to stub the voices endpoint too.
 */
function stubEleven(
  synthesis: () => Response = () => new Response(MP3),
  voices?: () => Response,
): { readonly sent: Sent[] } {
  const sent: Sent[] = [];
  vi.stubEnv("ELEVENLABS_API_KEY", "not-a-real-key");
  if (voices === undefined) vi.stubEnv("ELEVENLABS_VOICE_ID", "voice-under-test");
  // The route logs every upstream refusal on purpose; several cases below drive
  // exactly that, so the noise is suppressed rather than printed as a result.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", (url: unknown, init?: { body?: unknown }) => {
    const address = String(url);
    sent.push({
      url: address,
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    return Promise.resolve(
      address.includes("/v2/voices") ? (voices?.() ?? new Response("{}")) : synthesis(),
    );
  });
  return { sent };
}

/** What the route put on the wire for the synthesis call. */
function synthesised(sent: readonly Sent[]): { text: string; model_id: string } {
  const call = sent.find((entry) => entry.url.includes("/v1/text-to-speech/"));
  expect(call).toBeDefined();
  return call!.body as { text: string; model_id: string };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("without a key", () => {
  it("says it has no voice, so the browser can read the letter instead", async () => {
    const out = await post(ASH);
    expect(out.status).toBe(503);
    expect(out.error?.length ?? 0).toBeGreaterThan(0);
    expect(out.bytes).toBe(0);
  });
});

describe("what the endpoint refuses", () => {
  it.each([
    ["a body that is not JSON", "{nope"],
    ["a body that is not an object", [1, 2]],
    ["a missing manifest", { mode: "air" }],
    ["an unknown mode", { lines: [{ itemId: "rice-sack", quantity: 1 }], mode: "rail" }],
    ["an item this build does not have", { lines: [{ itemId: "gold-bar", quantity: 1 }], mode: "air" }],
    ["a manifest of zeroes", { lines: [{ itemId: "rice-sack", quantity: 0 }], mode: "air" }],
  ])("refuses %s", async (_label, body) => {
    stubEleven();
    const out = await post(body);
    expect(out.status).toBe(400);
    expect(out.error?.length ?? 0).toBeGreaterThan(0);
  });

  it("refuses a bad body before it reaches for a key", async () => {
    // Validation first, so a malformed body cannot cost anything at the API.
    const { sent } = stubEleven();
    await post({ mode: "air" });
    expect(sent).toHaveLength(0);
  });

  it("caps one caller harder than the letter endpoint does", async () => {
    stubEleven();
    const ip = "203.0.113.44";
    for (let call = 1; call <= 6; call += 1) {
      expect((await post(ASH, ip)).status).toBe(200);
    }
    const capped = await post(ASH, ip);
    expect(capped.status).toBe(429);
  });
});

describe("what actually gets spoken", () => {
  it("narrates the engine's letter when nothing is offered", async () => {
    const { sent } = stubEleven();
    const out = await post(ASH);

    expect(out.status).toBe(200);
    expect(out.type).toBe("audio/mpeg");
    expect(out.bytes).toBe(MP3.byteLength);
    expect(synthesised(sent).text).toBe(ENGINE_ASH);
  });

  it("speaks a sealed letter verbatim", async () => {
    // Prose a model wrote, with the engine's figures already substituted in. The
    // seal is the only reason this route will read it out.
    const letter = "It came in by air freight, 210.0 kg gross.\n\n— Receiving, Kathmandu";
    const { sent } = stubEleven();
    const out = await post({ ...ASH, letter, seal: seal(letter) });

    expect(out.status).toBe(200);
    expect(synthesised(sent).text).toBe(letter);
  });

  it("ignores an unsealed letter and narrates its own instead", async () => {
    const { sent } = stubEleven();
    const out = await post({ ...ASH, letter: "Your pallet delivered $9,000,000 of value." });

    // Silently, and with no error: the caller still gets audio, of the truth.
    expect(out.status).toBe(200);
    expect(synthesised(sent).text).toBe(ENGINE_ASH);
  });

  it("ignores a letter whose seal belongs to different words", async () => {
    const { sent } = stubEleven();
    const out = await post({ ...ASH, letter: "We burned it all.", seal: seal("something else") });
    expect(out.status).toBe(200);
    expect(synthesised(sent).text).toBe(ENGINE_ASH);
  });

  it("ignores an offer longer than a letter can be, sealed or not", async () => {
    const long = "a".repeat(4_001);
    const { sent } = stubEleven();
    await post({ ...ASH, letter: long, seal: seal(long) });
    expect(synthesised(sent).text).toBe(ENGINE_ASH);
  });

  it("holds the seal across a restart when a secret is configured", async () => {
    // Without `LETTER_SECRET` the key is per process, which is the multi-instance
    // case: the offer is dropped and the engine's letter is narrated anyway.
    vi.stubEnv("LETTER_SECRET", "a shared secret");
    const letter = "Checked in, and this is what it came to.";
    const { sent } = stubEleven();
    await post({ ...ASH, letter, seal: seal(letter) });
    expect(synthesised(sent).text).toBe(letter);
  });
});

describe("the voice and the upstream", () => {
  it("uses the configured voice and the long-form model", async () => {
    const { sent } = stubEleven();
    await post(ASH);

    const call = sent.find((entry) => entry.url.includes("/v1/text-to-speech/"))!;
    expect(call.url).toContain("/v1/text-to-speech/voice-under-test");
    expect(call.url).toContain("output_format=mp3_44100_64");
    expect(synthesised(sent).model_id).toBe("eleven_multilingual_v2");
  });

  it("honours an override of the model id", async () => {
    vi.stubEnv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5");
    const { sent } = stubEleven();
    await post(ASH);
    expect(synthesised(sent).model_id).toBe("eleven_flash_v2_5");
  });

  it("asks the account for a voice when none is configured", async () => {
    const { sent } = stubEleven(
      () => new Response(MP3),
      () => Response.json({ voices: [{ voice_id: "whatever-they-have" }] }),
    );
    const out = await post(ASH);

    expect(out.status).toBe(200);
    expect(sent[0]!.url).toContain("/v2/voices");
    expect(sent[1]!.url).toContain("/v1/text-to-speech/whatever-they-have");
  });

  it("gives up when the account lists no voice at all", async () => {
    const { sent } = stubEleven(
      () => new Response(MP3),
      () => Response.json({ voices: [] }),
    );
    const out = await post(ASH);

    expect(out.status).toBe(502);
    expect(sent.some((entry) => entry.url.includes("/v1/text-to-speech/"))).toBe(false);
  });

  it("answers 502 when synthesis is refused, so the browser can take over", async () => {
    stubEleven(() => new Response("no", { status: 401 }));
    const out = await post(ASH);
    expect(out.status).toBe(502);
    expect(out.error?.length ?? 0).toBeGreaterThan(0);
  });

  it("answers 502 when synthesis returns an empty body", async () => {
    stubEleven(() => new Response(new Uint8Array()));
    expect((await post(ASH)).status).toBe(502);
  });

  it("answers 502 rather than throwing when the call fails outright", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "not-a-real-key");
    vi.stubEnv("ELEVENLABS_VOICE_ID", "voice-under-test");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", () => Promise.reject(new Error("socket hang up")));
    expect((await post(ASH)).status).toBe(502);
  });

  it("never sends the key in the body or the url", async () => {
    const { sent } = stubEleven();
    await post(ASH);
    for (const entry of sent) {
      expect(entry.url).not.toContain("not-a-real-key");
      expect(JSON.stringify(entry.body ?? null)).not.toContain("not-a-real-key");
    }
  });
});
