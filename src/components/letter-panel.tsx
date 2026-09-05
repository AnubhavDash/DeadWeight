"use client";

/**
 * The reply from the warehouse.
 *
 * The panel posts the **manifest** to `/api/letter` and shows what comes back.
 * It sends no figures and computes none: everything numeric in the letter it
 * displays was inserted server-side by the engine, after the model had finished
 * writing, into a draft that was never shown a digit. When a draft states a
 * figure anyway the route throws it away and answers with the letter this build
 * writes itself — so this component's job is to show the prose and be honest
 * about which of the two wrote it.
 *
 * It also reads the letter out. The audio comes from `/api/narrate`, which
 * synthesises the letter it was sent only if that letter carries the seal this
 * build issued with it; anything else and it narrates its own. When there is no
 * voice to be had — no key, or an endpoint that will not answer — the browser's
 * own speech synthesis reads the same words instead, and the panel says which
 * voice you are listening to.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Bias } from "@/data/rates";
import type { Refusal } from "@/lib/letter";
import type { Manifest } from "@/lib/logistics";
import { cn } from "@/lib/utils";

interface Reply {
  readonly letter: string;
  readonly source: string;
  readonly refused?: Refusal;
  /** Proof to `/api/narrate` that these words came from here. */
  readonly seal?: string;
}

/** Why the model's draft is not the one on screen. Told, never hidden. */
const REFUSAL: Record<Refusal, string> = {
  digits:
    "A model wrote a figure of its own, so its draft was thrown away unread — and so was every other model's. What follows is the letter this build writes itself.",
  words:
    "A model restated a quantity in words. Same rule, same outcome: the draft was thrown away, and what follows is the letter this build writes itself.",
  token:
    "A model reached for a figure this consignment does not have. Its draft was thrown away, and what follows is the letter this build writes itself.",
  empty: "No model returned anything usable. What follows is the letter this build writes itself.",
  long:
    "A model wrote past the length a letter gets. What follows is the letter this build writes itself.",
  blocked:
    "The model's own safety filter stopped it writing this one. What follows is the letter this build writes itself.",
  unavailable:
    "No model answered — this build may be running without a key. What follows is the letter this build writes itself, in the same words the model is asked to write.",
};

const HEADING = "display text-[11px] uppercase tracking-[0.2em] text-meltwater";

const BUTTON =
  "w-full border px-4 py-3 text-[11px] uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-40";

/**
 * A letter belongs to the manifest that produced it. Both are tagged with this,
 * so editing anything the engine priced stops the old letter being shown rather
 * than leaving prose on screen that describes a consignment nobody is looking at.
 */
function identityOf(manifest: Manifest, bias: Bias, valueLocally: boolean): string {
  return JSON.stringify({ manifest, bias, valueLocally });
}

interface Outcome {
  readonly identity: string;
  readonly reply?: Reply;
  readonly error?: string;
}

/** Whether anything is being read out, and by what. Both are told, never hidden. */
type Playback = "idle" | "fetching" | "playing";
type Voice = "elevenlabs" | "browser";

export function LetterPanel({
  manifest,
  bias,
  valueLocally,
}: {
  manifest: Manifest;
  bias: Bias;
  valueLocally: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [playback, setPlayback] = useState<Playback>("idle");
  const [voice, setVoice] = useState<Voice | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const audio = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useRef<string | null>(null);

  const identity = useMemo(
    () => identityOf(manifest, bias, valueLocally),
    [manifest, bias, valueLocally],
  );
  const shown = outcome?.identity === identity ? outcome : null;
  const empty = !manifest.lines.some((line) => line.quantity > 0);

  /** Silence, whichever voice was talking, and release the blob behind it. */
  const stop = useCallback(() => {
    audio.current?.pause();
    audio.current = null;
    if (objectUrl.current !== null) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlayback("idle");
  }, []);

  // A letter belongs to one manifest. Editing the manifest stops the reading of
  // the old one rather than leaving a voice describing a consignment nobody is
  // looking at, and leaving the page stops it too.
  useEffect(() => stop, [identity, stop]);

  /** The fallback voice. Same words, no key, no network. */
  const readHere = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) {
      setVoiceError("Nothing here can read it aloud. The letter itself is above.");
      setPlayback("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.onend = () => setPlayback("idle");
    utterance.onerror = () => setPlayback("idle");
    window.speechSynthesis.speak(utterance);
    setVoice("browser");
    setPlayback("playing");
  }, []);

  /**
   * Ask for the audio, and fall back to the browser on anything that is not it.
   * The letter and its seal go up with the manifest: the route reads these exact
   * words only because the seal says they are its own.
   */
  const listen = useCallback(async () => {
    const reply = shown?.reply;
    if (reply === undefined) return;
    if (playback !== "idle") {
      stop();
      return;
    }

    setVoiceError(null);
    setPlayback("fetching");

    let sound: Blob | null = null;
    try {
      const response = await fetch("/api/narrate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: manifest.lines,
          mode: manifest.mode,
          bias,
          valueLocally,
          letter: reply.letter,
          seal: reply.seal,
        }),
      });
      if (response.ok && (response.headers.get("content-type") ?? "").startsWith("audio/")) {
        sound = await response.blob();
      }
    } catch {
      // Offline, or the route never answered. The browser can still read it.
    }

    if (sound !== null) {
      const url = URL.createObjectURL(sound);
      const element = new Audio(url);
      objectUrl.current = url;
      audio.current = element;
      element.onended = stop;
      element.onerror = stop;
      try {
        await element.play();
        setVoice("elevenlabs");
        setPlayback("playing");
        return;
      } catch {
        stop();
      }
    }

    readHere(reply.letter);
  }, [shown, playback, stop, readHere, manifest, bias, valueLocally]);

  const ask = useCallback(async () => {
    stop();
    setVoice(null);
    setVoiceError(null);
    setPending(true);
    setOutcome(null);
    try {
      const response = await fetch("/api/letter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: manifest.lines,
          mode: manifest.mode,
          bias,
          valueLocally,
        }),
      });
      const body = (await response.json()) as Partial<Reply> & { error?: string };

      if (!response.ok) {
        const wait = Number(response.headers.get("retry-after"));
        setOutcome({
          identity,
          error:
            response.status === 429 && Number.isFinite(wait) && wait > 0
              ? `This warehouse is answering other letters. Try again in about ${Math.ceil(wait / 60)} minutes.`
              : (body.error ?? "The warehouse did not answer."),
        });
        return;
      }

      setOutcome(
        typeof body.letter === "string" && body.letter.length > 0
          ? {
              identity,
              // The seal travels with the letter. Without it `/api/narrate` reads
              // its own prose instead of the words on screen — correct, but not
              // the same paragraphs the reader is looking at.
              reply: {
                letter: body.letter,
                source: body.source ?? "engine",
                refused: body.refused,
                seal: body.seal,
              },
            }
          : { identity, error: "The warehouse answered with nothing at all." },
      );
    } catch {
      setOutcome({ identity, error: "That request never left the building. Check the connection." });
    } finally {
      setPending(false);
    }
  }, [manifest, bias, valueLocally, identity, stop]);

  return (
    <section aria-label="The reply from the warehouse" className="hairline mt-8 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p className={HEADING}>The reply from the warehouse</p>
        <span className="border border-sonar/40 px-1.5 py-px text-[10px] uppercase tracking-[0.16em] text-sonar">
          prose by a model, figures by the engine
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-meltwater">
        The receiving end of this consignment, writing back. A language model writes the prose and is
        never shown a single figure — not the declared value, not the weight, not even the item
        labels, several of which carry a size. It marks where a number belongs and{" "}
        <span className="text-paper/85">the engine fills them in afterwards</span>. A draft that
        states a number of its own is thrown away whole, unread, and what you get instead is the
        letter this build writes with no model in the loop.
      </p>

      <button
        type="button"
        onClick={() => void ask()}
        disabled={pending || empty}
        className={cn(BUTTON, "mt-4 border-sonar/50 text-sonar hover:bg-sonar/10")}
      >
        {pending
          ? "the warehouse is writing…"
          : shown?.reply
            ? "ask again"
            : "ask the warehouse to write back"}
      </button>

      {empty ? (
        <p className="mt-2 text-[11px] leading-relaxed text-meltwater">
          Put something on the manifest first. There is nothing to write about yet.
        </p>
      ) : null}

      <div aria-live="polite">
        {shown?.error ? (
          <p className="mt-3 border border-crimson/40 bg-crimson/5 px-3 py-2 text-xs leading-relaxed text-paper/90">
            {shown.error}
          </p>
        ) : null}

        {shown?.reply ? (
          <article className="mt-3 border border-rule bg-rule/10 px-4 py-4">
            <p className="whitespace-pre-line text-[13px] leading-[1.75] text-paper/90">
              {shown.reply.letter}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-rule pt-3">
              <button
                type="button"
                onClick={() => void listen()}
                aria-label={playback === "playing" ? "Stop reading the letter" : "Read the letter aloud"}
                className="border border-rule px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-meltwater transition-colors hover:border-sonar hover:text-sonar"
              >
                {playback === "fetching"
                  ? "finding a voice…"
                  : playback === "playing"
                    ? "stop reading"
                    : "read it aloud"}
              </button>
              {playback === "playing" && voice !== null ? (
                <span className="text-[10px] uppercase tracking-[0.16em] text-meltwater">
                  {voice === "elevenlabs" ? "read by elevenlabs" : "read by your browser"}
                </span>
              ) : null}
            </div>

            {voiceError !== null ? (
              <p className="mt-2 text-[11px] leading-relaxed text-crimson">{voiceError}</p>
            ) : null}

            <p className="mt-3 text-[11px] leading-relaxed text-meltwater">
              {shown.reply.refused ? (
                REFUSAL[shown.reply.refused]
              ) : (
                <>
                  Prose by <span className="ledger text-paper/85">{shown.reply.source}</span>. Every
                  figure in it was substituted in afterwards from the ledger above; the model was
                  never told one.
                </>
              )}
            </p>
          </article>
        ) : null}
      </div>
    </section>
  );
}
