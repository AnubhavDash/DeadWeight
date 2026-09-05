/**
 * The seal on a letter.
 *
 * `/api/narrate` reads a letter aloud, and a public endpoint that reads *posted*
 * text aloud is a text-to-speech proxy paid for by whoever owns the key. So
 * `/api/letter` seals every letter it emits, and the narration endpoint speaks
 * the caller's text only when the seal matches it. An unsealed letter is not
 * refused — the narration falls back to the letter the engine computes from the
 * same manifest, which is the identical letter in every case that is not an
 * attack, so a legitimate caller never sees an error they cannot act on.
 *
 * What this is and is not. Set `LETTER_SECRET` and the seal survives a redeploy
 * and verifies across every instance. Left unset, the key is random per process:
 * a seal issued by one lambda will not verify at another, and that caller
 * quietly gets the engine's letter narrated instead of the model's. Said plainly,
 * because it is the sort of thing that gets overclaimed — without
 * `LETTER_SECRET` this is a brake on casual abuse of the endpoint, not a
 * security boundary.
 *
 * Neither mode can put a figure into the audio that the engine did not write.
 * That guarantee does not rest on the seal at all: it rests on the unsealed path
 * narrating our own letter rather than the caller's text.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** The per-process key, made once and only if it is needed. */
let ephemeral: Buffer | undefined;

/** Read on every call, so setting the secret does not require a cold start. */
function key(): Buffer {
  const configured = process.env.LETTER_SECRET?.trim();
  if (configured !== undefined && configured.length > 0) return Buffer.from(configured, "utf8");
  ephemeral ??= randomBytes(32);
  return ephemeral;
}

/** The seal for exactly this text. Base64url, so it survives a JSON body. */
export function seal(letter: string): string {
  return createHmac("sha256", key()).update(letter, "utf8").digest("base64url");
}

/**
 * Whether this seal is one we issued for this letter. The seal covers the text
 * and nothing else — not the manifest that produced it — because the question it
 * answers is only ever "did this build write these words".
 */
export function sealed(letter: string, offered: unknown): boolean {
  if (typeof offered !== "string" || offered.length === 0) return false;
  const ours = Buffer.from(seal(letter), "utf8");
  const theirs = Buffer.from(offered, "utf8");
  // `timingSafeEqual` throws on a length mismatch, which is itself a mismatch.
  return ours.length === theirs.length && timingSafeEqual(ours, theirs);
}
