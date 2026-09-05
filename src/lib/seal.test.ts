/**
 * The seal. It exists so `/api/narrate` can read a letter aloud without becoming
 * a speech proxy for whatever a caller posts, so what matters here is narrow: a
 * seal must verify for its own text and for nothing else, and a malformed offer
 * must be a `false` rather than a throw — `timingSafeEqual` rejects a length
 * mismatch by raising, and an endpoint that raises on a bad input is a way in.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { seal, sealed } from "@/lib/seal";

const LETTER = "Your consignment reached the warehouse.\n\n— Receiving, Kathmandu";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the seal", () => {
  it("verifies for the text it was made for", () => {
    expect(sealed(LETTER, seal(LETTER))).toBe(true);
  });

  it("does not verify for any other text", () => {
    expect(sealed("We burned it all.", seal(LETTER))).toBe(false);
  });

  it("does not verify a letter with one character changed", () => {
    expect(sealed(`${LETTER}.`, seal(LETTER))).toBe(false);
  });

  it.each([
    ["nothing offered", undefined],
    ["an empty string", ""],
    ["a number", 1234],
    ["an object", { seal: "no" }],
    ["a string of the wrong length", "short"],
    ["a longer string", `${"x".repeat(200)}`],
  ])("refuses %s without throwing", (_label, offered) => {
    expect(sealed(LETTER, offered)).toBe(false);
  });

  it("is url-safe, so it survives a JSON body and a query string", () => {
    expect(seal(LETTER)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is stable for the same text under a configured secret", () => {
    vi.stubEnv("LETTER_SECRET", "a shared secret");
    expect(seal(LETTER)).toBe(seal(LETTER));
  });

  it("changes with the secret, so one deployment cannot seal for another", () => {
    vi.stubEnv("LETTER_SECRET", "one secret");
    const first = seal(LETTER);
    vi.stubEnv("LETTER_SECRET", "a different secret");
    expect(seal(LETTER)).not.toBe(first);
    expect(sealed(LETTER, first)).toBe(false);
  });

  it("still seals with no secret configured, per process", () => {
    // The unconfigured mode. A seal is issued and verifies here; across two
    // instances it will not, and the narration falls back to the engine's letter.
    expect(sealed(LETTER, seal(LETTER))).toBe(true);
  });
});
