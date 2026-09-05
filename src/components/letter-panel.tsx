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
 */

import { useCallback, useMemo, useState } from "react";

import type { Bias } from "@/data/rates";
import type { Refusal } from "@/lib/letter";
import type { Manifest } from "@/lib/logistics";
import { cn } from "@/lib/utils";

interface Reply {
  readonly letter: string;
  readonly source: string;
  readonly refused?: Refusal;
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

  const identity = useMemo(
    () => identityOf(manifest, bias, valueLocally),
    [manifest, bias, valueLocally],
  );
  const shown = outcome?.identity === identity ? outcome : null;
  const empty = !manifest.lines.some((line) => line.quantity > 0);

  const ask = useCallback(async () => {
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
              reply: { letter: body.letter, source: body.source ?? "engine", refused: body.refused },
            }
          : { identity, error: "The warehouse answered with nothing at all." },
      );
    } catch {
      setOutcome({ identity, error: "That request never left the building. Check the connection." });
    } finally {
      setPending(false);
    }
  }, [manifest, bias, valueLocally, identity]);

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
            <p className="mt-4 border-t border-rule pt-3 text-[11px] leading-relaxed text-meltwater">
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
