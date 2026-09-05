"use client";

/**
 * Notarising a verdict on devnet.
 *
 * This is a demonstration and it moves no value. It writes one account saying
 * what a manifest was priced at, and the program re-derives the verdict from the
 * declared and net figures before it accepts the entry — so what lands on the
 * chain is a number this app cannot flatter. Real money goes to the appeals
 * listed in the footer, not through here.
 *
 * Everything numeric comes from the `PricedManifest` the engine produced. This
 * component formats and sends; it computes nothing.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnchorProvider, Program } from "@anchor-lang/core";
import { SystemProgram } from "@solana/web3.js";
import { useAnchorWallet, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

import { VERDICT_LABEL, type Manifest, type PricedManifest } from "@/lib/logistics";
import { formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";
import { DeadweightErrorCode } from "@/lib/solana/deadweight-errors";
import type { Deadweight } from "@/lib/solana/deadweight-idl";
import {
  IDL,
  MAX_CHAIN_LINES,
  canonicalManifest,
  explainError,
  explorerUrl,
  isTruncated,
  manifestHash,
  pledgeArgsFor,
  pledgePda,
  programErrorCode,
  registryPda,
} from "@/lib/solana/program";

type Stage = "idle" | "preparing" | "signing";

interface Receipt {
  readonly signature: string;
  readonly pledge: string;
  readonly index: number;
}

/**
 * A receipt or an error belongs to the manifest that produced it, so both carry
 * the canonical form of that manifest and are shown only while it still matches.
 * Edit anything the engine priced and the old outcome stops being displayed
 * without an effect having to reach in and clear it.
 */
interface Outcome {
  readonly canonical: string;
  readonly receipt?: Receipt;
  readonly error?: string;
}

const HEADING = "display text-[11px] uppercase tracking-[0.2em] text-meltwater";

const BUTTON =
  "w-full border px-4 py-3 text-[11px] uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-40";

/** `DeadwBH8…yxZ5F`, for an address that has to be readable at 382px. */
function short(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function hex(bytes: number[], count: number): string {
  return bytes
    .slice(0, count)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function NotarisePanel({
  manifest,
  result,
}: {
  manifest: Manifest;
  result: PricedManifest;
}) {
  const { connection } = useConnection();
  const { connected, connecting, disconnect, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const wallet = useAnchorWallet();

  const [stage, setStage] = useState<Stage>("idle");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [digest, setDigest] = useState<{ canonical: string; hex: string } | null>(null);

  const empty = result.declared === 0;
  const truncated = isTruncated(manifest);
  const lineCount = manifest.lines.filter((line) => line.quantity > 0).length;

  const { bias, valueLocally } = result.options;

  // The manifest's identity, derived synchronously from the same canonical form
  // the hash is taken over. Anything tagged with a different one is stale.
  const canonical = useMemo(
    () => canonicalManifest(manifest, bias, valueLocally),
    [manifest, bias, valueLocally],
  );

  const shown = outcome?.canonical === canonical ? outcome : null;

  const program = useMemo(() => {
    if (!wallet) return null;
    const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
    return new Program<Deadweight>(IDL, provider);
  }, [connection, wallet]);

  // The hash shown before signing is the hash that gets sent — same function,
  // same inputs. SHA-256 is async, so it arrives a tick after the figures do.
  useEffect(() => {
    if (empty) return;
    let live = true;
    void manifestHash(manifest, bias, valueLocally).then((bytes) => {
      if (live) setDigest({ canonical, hex: hex(bytes, 6) });
    });
    return () => {
      live = false;
    };
  }, [canonical, manifest, bias, valueLocally, empty]);

  const digestHex = digest?.canonical === canonical ? digest.hex : null;

  const notarise = useCallback(async () => {
    if (!program || !publicKey || empty) return;

    setOutcome(null);
    setStage("preparing");

    // One read of the registry, one signature. `index` has to equal the
    // registry's current count — that is what makes the ledger append-only — so
    // the count is read as late as possible and the whole attempt is repeatable.
    const attempt = async (): Promise<Receipt> => {
      const registry = registryPda();
      const state = await program.account.registry.fetchNullable(registry);
      if (!state) {
        throw new Error(
          "The notary is not open on devnet yet — the registry account does not exist. Nothing was signed.",
        );
      }

      const index = state.pledgeCount;
      const pledge = pledgePda(publicKey, BigInt(index.toString()));
      const args = await pledgeArgsFor(manifest, result);

      setStage("signing");
      const signature = await program.methods
        .commitPledge(index, args)
        .accountsPartial({
          registry,
          pledge,
          donor: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return { signature, pledge: pledge.toBase58(), index: index.toNumber() };
    };

    try {
      let next: Receipt;
      try {
        next = await attempt();
      } catch (raced) {
        // Someone took the number between the read and the send. That is the
        // sequence working, not a failure, so try once for the next one.
        if (programErrorCode(raced) !== DeadweightErrorCode.IndexOutOfOrder) throw raced;
        setStage("preparing");
        next = await attempt();
      }
      setOutcome({ canonical, receipt: next });
    } catch (thrown) {
      setOutcome({ canonical, error: explainError(thrown) });
    } finally {
      setStage("idle");
    }
  }, [program, publicKey, empty, manifest, result, canonical]);

  const busy = stage !== "idle";

  return (
    <section aria-label="Notarise this verdict on devnet" className="hairline mt-8 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <p className={HEADING}>Notarise the verdict</p>
        <span className="border border-crimson/40 px-1.5 py-px text-[10px] uppercase tracking-[0.16em] text-crimson">
          devnet demonstration
        </span>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-meltwater">
        This writes the figures above to a Solana devnet account and{" "}
        <span className="text-paper/85">moves no money</span>. It is not a donation channel and it
        never becomes one — the appeals in the footer take real money directly. What it demonstrates
        is a verdict nobody can quietly restate: the program re-derives{" "}
        <span className="text-paper/85">{VERDICT_LABEL[result.verdict].toLowerCase()}</span> from the
        declared and delivered figures itself, and refuses the entry if the label sent with them
        disagrees.
      </p>

      <dl className="ledger mt-4 space-y-1.5 border border-rule px-3 py-3 text-[11px]">
        <Field label="declared" value={formatUsd(result.declared)} />
        <Field
          label="delivered, net"
          value={formatUsd(result.net)}
          tone={result.net < 0 ? "text-crimson" : undefined}
        />
        <Field label="verdict" value={VERDICT_LABEL[result.verdict]} />
        <Field label="gross weight" value={`${result.grossWeightKg.toFixed(1)} kg`} />
        <Field label="reading" value={result.options.bias} />
        <Field label="manifest sha-256" value={digestHex ? `${digestHex}…` : "—"} />
        <Field
          label="lines stored"
          value={
            truncated ? `${MAX_CHAIN_LINES} of ${lineCount}` : `${lineCount} of ${lineCount}`
          }
        />
      </dl>

      {truncated ? (
        <p className="mt-2 text-[11px] leading-relaxed text-meltwater">
          The account holds {MAX_CHAIN_LINES} lines, so it stores the {MAX_CHAIN_LINES} largest by
          declared value. Every figure above is computed over all {lineCount}, and the hash covers
          all {lineCount} — the stored list is a sample, the arithmetic is not.
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {!connected ? (
          <button
            type="button"
            onClick={() => setVisible(true)}
            disabled={connecting || empty}
            className={cn(BUTTON, "border-sonar/50 text-sonar hover:bg-sonar/10")}
          >
            {connecting ? "connecting…" : "connect a devnet wallet"}
          </button>
        ) : (
          <button
            type="button"
            onClick={notarise}
            disabled={busy || empty || !program}
            className={cn(BUTTON, "border-sonar/50 text-sonar hover:bg-sonar/10")}
          >
            {stage === "preparing"
              ? "reading the registry…"
              : stage === "signing"
                ? "waiting for your signature…"
                : shown?.receipt
                  ? "notarised — sign another"
                  : "notarise on devnet"}
          </button>
        )}

        {empty ? (
          <p className="text-[11px] leading-relaxed text-meltwater">
            Put something on the manifest first. The program refuses an empty one.
          </p>
        ) : null}

        {connected && publicKey ? (
          <p className="ledger flex flex-wrap items-baseline justify-between gap-x-3 text-[10px] text-meltwater">
            <span>{short(publicKey.toBase58())} · devnet</span>
            <button type="button" onClick={() => void disconnect()} className="hover:text-crimson">
              disconnect
            </button>
          </p>
        ) : null}
      </div>

      {shown?.error ? (
        <p className="mt-3 border border-crimson/40 bg-crimson/5 px-3 py-2 text-xs leading-relaxed text-paper/90">
          {shown.error}
        </p>
      ) : null}

      {shown?.receipt ? (
        <div className="mt-3 border border-sonar/40 bg-sonar/5 px-3 py-3">
          <p className="display text-[10px] uppercase tracking-[0.18em] text-sonar">
            entry #{shown.receipt.index} on the devnet ledger
          </p>
          <p className="ledger mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <a
              href={explorerUrl(`tx/${shown.receipt.signature}`)}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sonar underline decoration-rule underline-offset-2 hover:decoration-sonar"
            >
              transaction {short(shown.receipt.signature)}
            </a>
            <a
              href={explorerUrl(`address/${shown.receipt.pledge}`)}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sonar underline decoration-rule underline-offset-2 hover:decoration-sonar"
            >
              account {short(shown.receipt.pledge)}
            </a>
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-meltwater">
            It is on the public ledger now, alongside everyone else&rsquo;s —{" "}
            <Link
              href="/notary"
              className="text-sonar underline decoration-rule underline-offset-2 hover:decoration-sonar"
            >
              the notary
            </Link>{" "}
            lists every entry. Editing the manifest above starts a new entry rather than changing
            this one.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="uppercase tracking-[0.12em] text-meltwater">{label}</dt>
      <dd className={cn("tabular-nums text-paper/90", tone)}>{value}</dd>
    </div>
  );
}
