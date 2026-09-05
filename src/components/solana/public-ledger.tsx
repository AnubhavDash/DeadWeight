"use client";

/**
 * The notary's record, read live from devnet in the browser.
 *
 * Nothing on this page is computed here. Every figure was written by the program
 * after it re-derived the verdict from the declared and net cents itself and
 * refused the entry when the label disagreed — so an entry reading LANDS is one
 * the chain agreed lands, and this page could not soften it if it wanted to.
 *
 * The read happens on mount rather than at build time on purpose: a prerendered
 * copy is stale the moment somebody signs, and it would make deploying the site
 * depend on the program being up. The cost is that this list needs JavaScript,
 * which is why it lives here and not in the ledger on the front page.
 */

import { useEffect, useState } from "react";
import type { BN } from "@anchor-lang/core";

import { CATALOG_BY_ID } from "@/data/catalog";
import type { Bias } from "@/data/rates";
import { VERDICT_LABEL, type Mode, type Verdict } from "@/lib/logistics";
import { cents, formatPercent, formatUsd, type Cents } from "@/lib/money";
import {
  MAX_CHAIN_LINES,
  PROGRAM_ID,
  biasFromChain,
  explainError,
  explorerUrl,
  modeFromChain,
  readOnlyProgram,
  registryPda,
  verdictFromChain,
} from "@/lib/solana/program";
import { cn } from "@/lib/utils";

/** One pledge account, flattened into what the page prints. */
interface Entry {
  readonly address: string;
  readonly donor: string;
  readonly index: number;
  readonly declared: Cents;
  readonly net: Cents;
  readonly weightKg: number;
  readonly mode: Mode;
  readonly bias: Bias;
  readonly verdict: Verdict;
  readonly hash: string;
  readonly committedAt: number;
  readonly lines: readonly { readonly itemId: string; readonly quantity: number }[];
}

/** The registry's own running totals, which the program maintains, not us. */
interface Totals {
  readonly count: number;
  readonly declared: Cents;
  readonly net: Cents;
}

type State =
  | { readonly status: "loading" }
  | { readonly status: "closed" }
  | { readonly status: "failed"; readonly message: string }
  | { readonly status: "open"; readonly totals: Totals; readonly entries: readonly Entry[] };

// The same tones the front-page verdict badge uses, so a reader who priced a
// manifest recognises the colour of its entry here.
const VERDICT_TONE: Record<Verdict, string> = {
  LANDS: "text-sonar border-sonar/40",
  BURDENS: "text-paper border-rule",
  BECOMES_ASH: "text-crimson border-crimson/40",
};

const MODE_LABEL: Record<Mode, string> = {
  air: "air freight",
  road: "road freight",
  sea: "sea + road",
};

const BIAS_LABEL: Record<Bias, string> = {
  generous: "kindest",
  midpoint: "midpoint",
  harsh: "harshest",
};

const LINK = "text-sonar underline decoration-rule underline-offset-2 hover:decoration-sonar";

/** Constant for the life of the program, so it is derived once. */
const REGISTRY = registryPda().toBase58();

/** The program stores i64 cents. This widens; it never re-rounds. */
function asCents(value: BN): Cents {
  return cents(Number(value.toString()));
}

function hex(bytes: number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function short(value: string): string {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/** Unix seconds to `2026-08-26 14:02 UTC`. UTC because donors are not local. */
function when(seconds: number): string {
  return `${new Date(seconds * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="uppercase tracking-[0.12em] text-meltwater">{label}</dt>
      <dd className={cn("tabular-nums text-paper/90", tone)}>{value}</dd>
    </div>
  );
}

function EntryCard({ entry }: { entry: Entry }) {
  return (
    <li className="border border-rule px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="ledger text-sm text-paper">entry #{entry.index}</p>
        <span
          className={cn(
            "border px-1.5 py-px text-[10px] uppercase tracking-[0.16em]",
            VERDICT_TONE[entry.verdict],
          )}
        >
          {VERDICT_LABEL[entry.verdict]}
        </span>
      </div>

      <dl className="ledger mt-3 grid gap-x-6 gap-y-1.5 text-[11px] sm:grid-cols-2">
        <Field label="declared" value={formatUsd(entry.declared)} />
        <Field
          label="delivered, net"
          value={formatUsd(entry.net)}
          tone={entry.net < 0 ? "text-crimson" : undefined}
        />
        <Field label="gross weight" value={`${entry.weightKg.toFixed(1)} kg`} />
        <Field label="route" value={MODE_LABEL[entry.mode]} />
        <Field label="reading" value={BIAS_LABEL[entry.bias]} />
        <Field label="notarised" value={when(entry.committedAt)} />
      </dl>

      <details className="group mt-3">
        <summary className="w-fit cursor-pointer list-none text-[10px] uppercase tracking-[0.16em] text-meltwater hover:text-sonar">
          <span className="group-open:hidden">what was on it</span>
          <span className="hidden group-open:inline">hide</span>
        </summary>
        <ul className="ledger mt-2 space-y-0.5 border-l border-rule pl-3 text-[11px] text-paper/80">
          {entry.lines.map((line, index) => (
            <li key={`${index}-${line.itemId}`}>
              {CATALOG_BY_ID[line.itemId]?.label ?? line.itemId}
              <span className="text-meltwater"> ×{line.quantity}</span>
            </li>
          ))}
        </ul>
        <p className="ledger mt-2 break-all border-l border-rule pl-3 text-[10px] text-meltwater">
          sha-256 {entry.hash}
        </p>
      </details>

      <p className="ledger mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
        <a href={explorerUrl(`address/${entry.address}`)} target="_blank" rel="noreferrer noopener" className={LINK}>
          account {short(entry.address)}
        </a>
        <a href={explorerUrl(`address/${entry.donor}`)} target="_blank" rel="noreferrer noopener" className={LINK}>
          donor {short(entry.donor)}
        </a>
      </p>
    </li>
  );
}

/**
 * The whole read, as a plain function of nothing: one registry fetch, one
 * program-accounts fetch, no wallet anywhere. It returns a `State` rather than
 * throwing, because a notary that is not open yet and an endpoint that will not
 * answer are both things to print, not failures to handle.
 */
async function readNotary(): Promise<State> {
  try {
    const program = readOnlyProgram();
    const registry = await program.account.registry.fetchNullable(registryPda());
    if (!registry) return { status: "closed" };

    const accounts = await program.account.pledge.all();
    return {
      status: "open",
      totals: {
        count: registry.pledgeCount.toNumber(),
        declared: asCents(registry.declaredTotalCents),
        net: asCents(registry.netTotalCents),
      },
      entries: accounts
        .map(({ publicKey, account }) => ({
          address: publicKey.toBase58(),
          donor: account.donor.toBase58(),
          index: account.index.toNumber(),
          declared: asCents(account.declaredUsdCents),
          net: asCents(account.netUsdCents),
          weightKg: Number(account.grossWeightGrams.toString()) / 1000,
          mode: modeFromChain(account.mode),
          bias: biasFromChain(account.bias),
          verdict: verdictFromChain(account.verdict),
          hash: hex(account.manifestHash),
          committedAt: account.committedAt.toNumber(),
          lines: account.lines,
        }))
        .sort((a, b) => b.index - a.index),
    };
  } catch (thrown) {
    return { status: "failed", message: explainError(thrown) };
  }
}

export function PublicLedger() {
  const [state, setState] = useState<State>({ status: "loading" });

  // Once, after the first paint. The read is an external system, so the state it
  // produces arrives in the promise's callback rather than in the effect body.
  useEffect(() => {
    let live = true;
    void readNotary().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, []);

  const loading = state.status === "loading";

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p className="ledger text-[11px] text-meltwater">
          program{" "}
          <a
            href={explorerUrl(`address/${PROGRAM_ID.toBase58()}`)}
            target="_blank"
            rel="noreferrer noopener"
            className={LINK}
          >
            {short(PROGRAM_ID.toBase58())}
          </a>{" "}
          · registry{" "}
          <a
            href={explorerUrl(`address/${REGISTRY}`)}
            target="_blank"
            rel="noreferrer noopener"
            className={LINK}
          >
            {short(REGISTRY)}
          </a>{" "}
          · devnet
        </p>
        <button
          type="button"
          onClick={() => {
            setState({ status: "loading" });
            void readNotary().then(setState);
          }}
          disabled={loading}
          className="text-[10px] uppercase tracking-[0.16em] text-meltwater transition-colors hover:text-sonar disabled:opacity-40"
        >
          {loading ? "reading devnet…" : "refresh"}
        </button>
      </div>

      {state.status === "loading" ? (
        <p className="mt-4 text-sm text-meltwater">Reading the notary from devnet…</p>
      ) : null}

      {state.status === "closed" ? (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-meltwater">
          The notary is not open on devnet yet — the registry account does not exist, so there is
          nothing to show. Nothing is missing and nothing was lost; the ledger starts at the first
          signature.
        </p>
      ) : null}

      {state.status === "failed" ? (
        <p className="mt-4 max-w-2xl border border-crimson/40 bg-crimson/5 px-3 py-2 text-sm leading-relaxed text-paper/90">
          Devnet did not answer: {state.message}
        </p>
      ) : null}

      {state.status === "open" ? (
        <Entries totals={state.totals} entries={state.entries} />
      ) : null}
    </div>
  );
}

function Entries({ totals, entries }: { totals: Totals; entries: readonly Entry[] }) {
  if (totals.count === 0) {
    return (
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-meltwater">
        The notary is open and empty. Nobody has notarised a verdict yet.
      </p>
    );
  }

  return (
    <>
      <dl className="ledger mt-4 grid gap-x-6 gap-y-1.5 border border-rule px-3 py-3 text-[11px] sm:grid-cols-3">
        <Field label="entries" value={String(totals.count)} />
        <Field label="declared" value={formatUsd(totals.declared)} />
        <Field
          label="delivered, net"
          value={formatUsd(totals.net)}
          tone={totals.net < 0 ? "text-crimson" : undefined}
        />
      </dl>

      {totals.declared > 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-meltwater">
          {formatUsd(totals.declared)} declared across everything the notary holds,{" "}
          {formatUsd(totals.net)} of it delivered — {formatPercent(totals.net / totals.declared)} of
          what was given. The program keeps those two totals itself; this page only divides them.
        </p>
      ) : null}

      <p className="mt-4 text-[11px] leading-relaxed text-meltwater">
        Each account stores at most {MAX_CHAIN_LINES} lines, the largest by declared value, while
        every figure beside them was computed over the whole manifest and the hash covers all of it.
        A long consignment shows a sample of its contents; none of its arithmetic is missing.
      </p>

      <ul className="mt-3 space-y-3">
        {entries.map((entry) => (
          <EntryCard key={entry.address} entry={entry} />
        ))}
      </ul>

      {entries.length !== totals.count ? (
        <p className="mt-3 text-[11px] leading-relaxed text-meltwater">
          The registry counts {totals.count} entries and this endpoint returned {entries.length}.
          Asking a public RPC for every account of a program is the first thing it throttles — the
          missing entries are still on the chain.
        </p>
      ) : null}
    </>
  );
}
