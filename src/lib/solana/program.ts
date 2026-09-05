// The chain layer: program id, PDAs, and the mapping from a priced manifest to
// the one instruction the notary accepts.
//
// Devnet only, and a notary rather than a channel — `commit_pledge` writes down
// what a manifest was priced at and moves no value. See `programs/deadweight`.
//
// The program re-derives the verdict from the declared and net figures and
// rejects the instruction when it disagrees with the one sent, so this file
// cannot post a flattering label even if it wanted to. Keeping the whole mapping
// in one place is what makes that check meaningful: every number the chain sees
// comes out of `price()`, in the same integer cents the engine works in.

import { BN, Program, type Provider } from "@anchor-lang/core";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import type { Bias } from "@/data/rates";
import { CATALOG_BY_ID } from "@/data/catalog";
import type { Manifest, Mode, PricedManifest, Verdict } from "@/lib/logistics";
import { DeadweightErrorCode } from "./deadweight-errors";
import type { Deadweight } from "./deadweight-idl";
import rawIdl from "./deadweight.idl.json";

/**
 * The IDL, typed. A JSON import widens every string to `string`, so handing the
 * generated shape to Anchor needs the cast; it is the same file `anchor build`
 * wrote, so the widening is the only thing being undone here.
 */
export const IDL = rawIdl as unknown as Deadweight;

export const PROGRAM_ID = new PublicKey(IDL.address);

/** Devnet, always. There is no mainnet deployment and there is not meant to be. */
export const CLUSTER = "devnet";

/**
 * Public devnet RPC unless overridden. Anything `NEXT_PUBLIC_` is shipped to the
 * browser, so this override must never carry an API key — point it at a plain
 * endpoint, or leave it unset.
 */
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC ?? clusterApiUrl("devnet");

export function explorerUrl(path: string): string {
  return `https://explorer.solana.com/${path}?cluster=${CLUSTER}`;
}

/* ---------------------------------------------------------------------------
   Addresses
   --------------------------------------------------------------------------- */

const encoder = new TextEncoder();
const REGISTRY_SEED = encoder.encode("registry");
const PLEDGE_SEED = encoder.encode("pledge");

/** A u64 as the eight little-endian bytes the pledge seed is built from. */
export function u64le(value: number | bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
  return bytes;
}

export function registryPda(): PublicKey {
  return PublicKey.findProgramAddressSync([REGISTRY_SEED], PROGRAM_ID)[0];
}

export function pledgePda(donor: PublicKey, index: number | bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [PLEDGE_SEED, donor.toBytes(), u64le(index)],
    PROGRAM_ID,
  )[0];
}

/** Reads need a connection and nothing else — no wallet, no signing. */
export function readOnlyProgram(): Program<Deadweight> {
  const connection = new Connection(RPC_ENDPOINT, "confirmed");
  return new Program<Deadweight>(IDL, { connection } satisfies Provider);
}

/* ---------------------------------------------------------------------------
   Enums, both directions
   --------------------------------------------------------------------------- */

/** Anchor spells a unit enum variant as a one-key object. */
type Unit = Record<string, never>;

export type ChainMode = { air: Unit } | { road: Unit } | { seaPlusRoad: Unit };
export type ChainBias = { generous: Unit } | { midpoint: Unit } | { harsh: Unit };
export type ChainVerdict = { lands: Unit } | { burdens: Unit } | { becomesAsh: Unit };

export function chainMode(mode: Mode): ChainMode {
  switch (mode) {
    case "air":
      return { air: {} };
    case "road":
      return { road: {} };
    // Nepal is landlocked: the sea leg ends at Kolkata and the rest is road.
    case "sea":
      return { seaPlusRoad: {} };
  }
}

export function modeFromChain(value: ChainMode): Mode {
  if ("air" in value) return "air";
  if ("road" in value) return "road";
  return "sea";
}

export function chainBias(bias: Bias): ChainBias {
  switch (bias) {
    case "generous":
      return { generous: {} };
    case "midpoint":
      return { midpoint: {} };
    case "harsh":
      return { harsh: {} };
  }
}

export function biasFromChain(value: ChainBias): Bias {
  if ("generous" in value) return "generous";
  if ("midpoint" in value) return "midpoint";
  return "harsh";
}

export function chainVerdict(verdict: Verdict): ChainVerdict {
  switch (verdict) {
    case "LANDS":
      return { lands: {} };
    case "BURDENS":
      return { burdens: {} };
    case "BECOMES_ASH":
      return { becomesAsh: {} };
  }
}

export function verdictFromChain(value: ChainVerdict): Verdict {
  if ("lands" in value) return "LANDS";
  if ("burdens" in value) return "BURDENS";
  return "BECOMES_ASH";
}

/* ---------------------------------------------------------------------------
   The instruction payload
   --------------------------------------------------------------------------- */

/** `MAX_LINES` in the program. The account is fixed-size so the rent is knowable. */
export const MAX_CHAIN_LINES = 8;

export interface ChainLine {
  readonly itemId: string;
  readonly quantity: number;
}

export interface PledgeArgs {
  readonly declaredUsdCents: BN;
  readonly netUsdCents: BN;
  readonly grossWeightGrams: BN;
  readonly mode: ChainMode;
  readonly bias: ChainBias;
  readonly verdict: ChainVerdict;
  readonly manifestHash: number[];
  readonly lines: ChainLine[];
}

/** What a line is worth as declared, used only to decide what to truncate. */
function declaredValueOf(line: Manifest["lines"][number]): number {
  const unit = line.declaredUnitUsd ?? CATALOG_BY_ID[line.itemId]?.declaredUsd ?? 0;
  return unit * line.quantity;
}

/**
 * The lines as the account will hold them: the largest by declared value first,
 * truncated to eight. Truncation loses nothing that matters to the verdict —
 * every figure on the account is computed over the whole manifest, and
 * `manifestHash` covers all of it — but it does mean the line list on a long
 * manifest is a sample rather than the whole thing, which the UI says out loud.
 */
export function chainLines(manifest: Manifest): ChainLine[] {
  return manifest.lines
    .filter((line) => line.quantity > 0)
    .slice()
    .sort((a, b) => declaredValueOf(b) - declaredValueOf(a) || a.itemId.localeCompare(b.itemId))
    .slice(0, MAX_CHAIN_LINES)
    .map((line) => ({ itemId: line.itemId, quantity: line.quantity }));
}

/** True when the account will hold fewer lines than the donor actually priced. */
export function isTruncated(manifest: Manifest): boolean {
  return manifest.lines.filter((line) => line.quantity > 0).length > MAX_CHAIN_LINES;
}

/**
 * The manifest as one canonical string, so an off-chain manifest can be proved
 * to be the one that was priced. Lines are sorted by id and quantities are
 * integers, so the same manifest built in a different order hashes the same.
 * Kept deliberately boring: anyone can re-serialise this and re-run the SHA-256.
 */
export function canonicalManifest(manifest: Manifest, bias: Bias, valueLocally: boolean): string {
  const lines = manifest.lines
    .filter((line) => line.quantity > 0)
    .slice()
    .sort((a, b) => a.itemId.localeCompare(b.itemId))
    .map((line) => [line.itemId, line.quantity, line.declaredUnitUsd ?? null]);

  return JSON.stringify({ v: 1, mode: manifest.mode, bias, valueLocally, lines });
}

/** SHA-256 of `canonicalManifest`, as the 32 bytes the instruction wants. */
export async function manifestHash(
  manifest: Manifest,
  bias: Bias,
  valueLocally: boolean,
): Promise<number[]> {
  const canonical = canonicalManifest(manifest, bias, valueLocally);
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(canonical));
  return Array.from(new Uint8Array(digest));
}

/**
 * The whole payload. Every number is taken from the engine's result rather than
 * recomputed, and the program checks the verdict against the two figures it is
 * handed, so a mismatch here is rejected on-chain instead of published.
 */
export async function pledgeArgsFor(
  manifest: Manifest,
  result: PricedManifest,
): Promise<PledgeArgs> {
  return {
    declaredUsdCents: new BN(result.declared),
    netUsdCents: new BN(result.net),
    grossWeightGrams: new BN(Math.round(result.grossWeightKg * 1000)),
    mode: chainMode(result.mode),
    bias: chainBias(result.options.bias),
    verdict: chainVerdict(result.verdict),
    manifestHash: await manifestHash(manifest, result.options.bias, result.options.valueLocally),
    lines: chainLines(manifest),
  };
}

/* ---------------------------------------------------------------------------
   Errors
   --------------------------------------------------------------------------- */

const ERROR_MESSAGE: Readonly<Record<number, string>> = {
  [DeadweightErrorCode.IndexOutOfOrder]:
    "Someone else notarised a pledge a moment before you. Try again — the ledger is a strict sequence, so your entry takes the next number.",
  [DeadweightErrorCode.EmptyManifest]: "There is nothing on the manifest to notarise.",
  [DeadweightErrorCode.TooManyLines]: "Too many lines for one pledge account.",
  [DeadweightErrorCode.EmptyItemId]: "A manifest line arrived without a catalogue id.",
  [DeadweightErrorCode.ItemIdTooLong]: "A catalogue id is longer than the account can store.",
  [DeadweightErrorCode.ZeroQuantity]: "A manifest line arrived with no quantity.",
  [DeadweightErrorCode.DeclaredNotPositive]: "Declared value has to be positive.",
  [DeadweightErrorCode.VerdictDoesNotFollow]:
    "The program re-derived the verdict from the declared and net figures and got a different answer, so it refused the entry. That check is the point of it.",
  [DeadweightErrorCode.ArithmeticOverflow]: "The registry totals overflowed.",
};

/** The custom program error code in a thrown transaction error, if there is one. */
export function programErrorCode(error: unknown): number | undefined {
  const source = error as { error?: { errorCode?: { number?: number } } } | undefined;
  const structured = source?.error?.errorCode?.number;
  if (typeof structured === "number") return structured;

  const hex = /custom program error: (0x[0-9a-f]+)/i.exec(String(error));
  return hex ? Number.parseInt(hex[1], 16) : undefined;
}

/** A sentence a donor can act on, rather than a hex code. */
export function explainError(error: unknown): string {
  const code = programErrorCode(error);
  if (code !== undefined && code in ERROR_MESSAGE) return ERROR_MESSAGE[code];

  const message = error instanceof Error ? error.message : String(error);
  if (/user rejected|request rejected/i.test(message)) return "You cancelled the signature.";
  if (/insufficient|0x1\b/i.test(message)) {
    return "Not enough devnet SOL to pay the rent on a new pledge account. Airdrop some and try again.";
  }
  return message || "The transaction failed.";
}
