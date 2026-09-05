/**
 * `POST /api/narrate` — the letter, read aloud.
 *
 * ElevenLabs speaks it. What it is given is *not* simply the caller's text: an
 * open endpoint that reads posted text aloud is a text-to-speech proxy funded by
 * whoever owns the key. So a caller may offer a letter, and it is spoken only if
 * it carries the seal `/api/letter` issued alongside it. An unsealed letter is
 * dropped without complaint and this route narrates the letter the engine writes
 * from the same manifest — the identical words in every case that is not an
 * attack. `@/lib/seal` is honest about what that does and does not guarantee.
 *
 * The consequence worth stating, because it is the whole thesis of this project:
 * no figure can reach the audio that the deterministic engine did not compute.
 * The voice model is handed finished prose. It is given no numbers to reason
 * about and no opportunity to write one.
 *
 * With no `ELEVENLABS_API_KEY` the route answers 503 in JSON and the panel reads
 * the letter with the browser's own speech synthesis instead, so a build with no
 * keys at all can still be listened to.
 */

import { callerOf, isRecord, json, limiter, parse } from "@/lib/ask";
import { engineLetter } from "@/lib/letter";
import { price } from "@/lib/logistics";
import { sealed } from "@/lib/seal";

export const runtime = "nodejs";

/** Synthesis of a letter-length passage is slower than the platform default. */
export const maxDuration = 45;

const API = "https://api.elevenlabs.io";

/**
 * `eleven_multilingual_v2` on purpose, not one of the faster models: the docs
 * call it the most stable on long-form generations and the better of them at
 * normalising numbers, and this passage is long-form prose full of dollar
 * amounts. Overridable, because a model id is the thing that gets retired.
 */
const DEFAULT_MODEL = "eleven_multilingual_v2";

/** Full sample rate at half the default bitrate: a spoken letter, not music. */
const OUTPUT_FORMAT = "mp3_44100_64";

const TIMEOUT_MS = 40_000;

/** Longer than `MAX_LETTER_CHARS` can produce, so a longer offer is not ours. */
const MAX_OFFERED_CHARS = 4_000;

/** Audio costs more per call than prose does, so the brake is tighter. */
const allow = limiter({ perWindow: 6, windowMs: 10 * 60_000 });

/* --- which voice -------------------------------------------------------- */

interface VoiceList {
  readonly voices?: readonly { readonly voice_id?: string }[];
}

/**
 * `ELEVENLABS_VOICE_ID` when it is set, and otherwise whatever voice the account
 * lists first. Asking costs a round trip on every narration, which is why the
 * env var is the documented way — but a build with only a key in it works, and
 * that matters more here than the latency does. Nothing is cached across
 * requests: a voice can be removed from an account between two of them.
 */
async function voiceOf(key: string, signal: AbortSignal): Promise<string | undefined> {
  const configured = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (configured !== undefined && configured.length > 0) return configured;

  const response = await fetch(`${API}/v2/voices?page_size=1`, {
    signal,
    headers: { "xi-api-key": key },
  });
  if (!response.ok) {
    console.error(`narrate: /v2/voices answered ${response.status} ${response.statusText}`);
    return undefined;
  }

  const list = (await response.json()) as VoiceList;
  const first = list.voices?.[0]?.voice_id;
  if (first === undefined || first.length === 0) {
    console.error("narrate: this account lists no voices");
    return undefined;
  }
  return first;
}

/* --- one call to the voice ---------------------------------------------- */

/** The finished MP3, or nothing at all — in which case the browser reads it. */
async function speak(
  text: string,
  key: string,
  voice: string,
  signal: AbortSignal,
): Promise<ArrayBuffer | undefined> {
  const response = await fetch(
    `${API}/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=${OUTPUT_FORMAT}`,
    {
      method: "POST",
      signal,
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL_ID?.trim() || DEFAULT_MODEL,
        // `auto` rather than `on`. Normalisation is what turns `$1,204.50` into
        // spoken dollars, and asking for it explicitly is plan-restricted on the
        // faster models — so an override to one of those would start failing.
        apply_text_normalization: "auto",
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.75,
          style: 0,
          speed: 0.95,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    console.error(`narrate: synthesis answered ${response.status} ${response.statusText}`);
    return undefined;
  }

  const audio = await response.arrayBuffer();
  return audio.byteLength > 0 ? audio : undefined;
}

/* --- the handler -------------------------------------------------------- */

/**
 * The words that get spoken: the caller's letter when it carries our seal, and
 * otherwise the one this build writes from the manifest. An unsealed offer is
 * dropped in silence rather than refused, because a seal issued by a different
 * instance belongs to a legitimate caller and a loop of conflicts is no use to
 * them. They get the engine's letter, which is what they came for anyway.
 */
function spoken(body: unknown, engine: string): string {
  if (!isRecord(body)) return engine;
  const offered = body.letter;
  if (typeof offered !== "string" || offered.length === 0) return engine;
  if (offered.length > MAX_OFFERED_CHARS) return engine;
  return sealed(offered, body.seal) ? offered : engine;
}

export async function POST(request: Request): Promise<Response> {
  const gate = allow(callerOf(request), Date.now());
  if (!gate.ok) {
    return json({ error: "That is a lot of listening. Give the warehouse a minute." }, 429, {
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

  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (key === undefined || key.length === 0) {
    return json({ error: "This build has no voice of its own." }, 503);
  }

  // Priced and written here from the manifest, exactly as `/api/letter` does it,
  // so the fallback text is never something a caller supplied.
  const { manifest, bias, valueLocally } = parsed.ask;
  const text = spoken(body, engineLetter(manifest, price(manifest, { bias, valueLocally })));

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let audio: ArrayBuffer | undefined;
  try {
    const voice = await voiceOf(key, signal);
    audio = voice === undefined ? undefined : await speak(text, key, voice, signal);
  } catch (thrown) {
    console.error("narrate: failed —", thrown instanceof Error ? thrown.message : thrown);
  }

  if (audio === undefined) {
    return json({ error: "The voice did not answer. Your browser can read it instead." }, 502);
  }

  return new Response(audio, {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      "content-length": String(audio.byteLength),
      "cache-control": "no-store",
    },
  });
}
