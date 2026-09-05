// The chain layer has one job that matters: hand the program figures it will
// accept. `commit_pledge` re-derives the verdict from the declared and net cents
// and rejects a mismatch, so a bug in this mapping does not produce a wrong
// ledger entry — it produces a wasted signature and a confused donor. These
// tests re-implement the program's check in exact integer arithmetic and run it
// over the whole catalogue, which is the only way to know that never happens.

import { describe, expect, it } from "vitest";

import { PublicKey } from "@solana/web3.js";

import { CATALOG } from "@/data/catalog";
import type { Bias } from "@/data/rates";
import { price, type Manifest, type Mode, type Verdict } from "@/lib/logistics";
import { DeadweightErrorCode } from "@/lib/solana/deadweight-errors";
import {
  MAX_CHAIN_LINES,
  PROGRAM_ID,
  canonicalManifest,
  chainBias,
  chainLines,
  chainMode,
  chainVerdict,
  biasFromChain,
  explainError,
  isTruncated,
  manifestHash,
  modeFromChain,
  pledgeArgsFor,
  pledgePda,
  registryPda,
  u64le,
  verdictFromChain,
} from "@/lib/solana/program";

const MODES: readonly Mode[] = ["air", "road", "sea"];
const BIASES: readonly Bias[] = ["generous", "midpoint", "harsh"];
const VERDICTS: readonly Verdict[] = ["LANDS", "BURDENS", "BECOMES_ASH"];

function manifest(lines: Manifest["lines"], mode: Mode = "air"): Manifest {
  return { lines, mode };
}

/**
 * `commit_pledge`, transcribed. `LANDS_THRESHOLD_PERCENT` is 60 and the program
 * widens to i128 before multiplying, so this uses bigint and no division — if
 * this and the engine ever disagree, the program refuses the entry.
 */
function derivedOnChain(declaredCents: bigint, netCents: bigint): Verdict {
  if (netCents < 0n) return "BECOMES_ASH";
  return netCents * 100n >= declaredCents * 60n ? "LANDS" : "BURDENS";
}

describe("addresses", () => {
  it("takes the program id from the IDL the build wrote", () => {
    expect(PROGRAM_ID.toBase58()).toBe("DeadwBH8o2uqPTpdA5LDHmz6i7dv8LGtFFtmytKyxZ5F");
  });

  it("writes a u64 seed as eight little-endian bytes", () => {
    expect(Array.from(u64le(0))).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(u64le(1))).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(u64le(256))).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(u64le(2n ** 64n - 1n))).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
  });

  it("derives the registry from the seed the program uses", () => {
    const expected = PublicKey.findProgramAddressSync(
      [Buffer.from("registry")],
      PROGRAM_ID,
    )[0];
    expect(registryPda().equals(expected)).toBe(true);
  });

  it("gives every donor and index its own pledge address", () => {
    const donor = PublicKey.unique();
    const other = PublicKey.unique();

    const expected = PublicKey.findProgramAddressSync(
      [Buffer.from("pledge"), donor.toBuffer(), Buffer.from(u64le(3))],
      PROGRAM_ID,
    )[0];
    expect(pledgePda(donor, 3).equals(expected)).toBe(true);

    expect(pledgePda(donor, 0).equals(pledgePda(donor, 1))).toBe(false);
    expect(pledgePda(donor, 0).equals(pledgePda(other, 0))).toBe(false);
    // A number and a bigint index are the same seed.
    expect(pledgePda(donor, 7).equals(pledgePda(donor, 7n))).toBe(true);
  });
});

describe("the enums survive the round trip", () => {
  it("maps every mode, and lands the sea leg on seaPlusRoad", () => {
    for (const mode of MODES) {
      expect(modeFromChain(chainMode(mode))).toBe(mode);
    }
    // Nepal is landlocked; there is no port to deliver to.
    expect(chainMode("sea")).toEqual({ seaPlusRoad: {} });
  });

  it("maps every bias", () => {
    for (const bias of BIASES) {
      expect(biasFromChain(chainBias(bias))).toBe(bias);
    }
  });

  it("maps every verdict", () => {
    for (const verdict of VERDICTS) {
      expect(verdictFromChain(chainVerdict(verdict))).toBe(verdict);
    }
    expect(chainVerdict("BECOMES_ASH")).toEqual({ becomesAsh: {} });
  });
});

describe("the line list the account will hold", () => {
  const long: Manifest["lines"] = CATALOG.slice(0, MAX_CHAIN_LINES + 4).map((item) => ({
    itemId: item.id,
    quantity: 10,
  }));

  it("passes a short manifest through untouched", () => {
    const lines = [
      { itemId: "wool-blanket", quantity: 2 },
      { itemId: "solar-lamp", quantity: 1 },
    ];
    expect(chainLines(manifest(lines))).toHaveLength(2);
    expect(isTruncated(manifest(lines))).toBe(false);
  });

  it("drops the lines a donor zeroed out", () => {
    const lines = [
      { itemId: "wool-blanket", quantity: 0 },
      { itemId: "solar-lamp", quantity: 1 },
    ];
    expect(chainLines(manifest(lines))).toEqual([{ itemId: "solar-lamp", quantity: 1 }]);
    expect(isTruncated(manifest(lines))).toBe(false);
  });

  it("keeps the eight largest by declared value when it has to truncate", () => {
    expect(long.length).toBeGreaterThan(MAX_CHAIN_LINES);
    const kept = chainLines(manifest(long));

    expect(kept).toHaveLength(MAX_CHAIN_LINES);
    expect(isTruncated(manifest(long))).toBe(true);

    const declaredOf = (itemId: string) =>
      CATALOG.find((item) => item.id === itemId)!.declaredUsd * 10;
    const values = kept.map((line) => declaredOf(line.itemId));
    expect([...values].sort((a, b) => b - a)).toEqual(values);

    const dropped = long
      .filter((line) => !kept.some((k) => k.itemId === line.itemId))
      .map((line) => declaredOf(line.itemId));
    for (const value of dropped) {
      expect(value).toBeLessThanOrEqual(Math.min(...values));
    }
  });

  it("breaks a tie on id so the same manifest always truncates the same way", () => {
    const tied: Manifest["lines"] = ["b", "a", "c"].map((id) => ({
      itemId: id,
      quantity: 1,
      declaredUnitUsd: 5,
    }));
    expect(chainLines(manifest(tied)).map((line) => line.itemId)).toEqual(["a", "b", "c"]);
  });

  it("respects a donor's own declared price when ranking", () => {
    const lines: Manifest["lines"] = [
      { itemId: "purification-tablets", quantity: 1, declaredUnitUsd: 900 },
      { itemId: "thermal-jacket-new", quantity: 1 },
    ];
    expect(chainLines(manifest(lines))[0].itemId).toBe("purification-tablets");
  });
});

describe("the manifest hash", () => {
  const lines: Manifest["lines"] = [
    { itemId: "solar-lamp", quantity: 3 },
    { itemId: "wool-blanket", quantity: 12 },
  ];

  it("does not care what order the builder happened to be in", () => {
    const forwards = canonicalManifest(manifest(lines), "generous", false);
    const backwards = canonicalManifest(manifest([...lines].reverse()), "generous", false);
    expect(forwards).toBe(backwards);
  });

  it("ignores a line the donor set to zero", () => {
    const withZero = [...lines, { itemId: "rice-sack", quantity: 0 }];
    expect(canonicalManifest(manifest(withZero), "generous", false)).toBe(
      canonicalManifest(manifest(lines), "generous", false),
    );
  });

  it("covers the whole manifest, not the eight lines the account keeps", () => {
    const long: Manifest["lines"] = CATALOG.slice(0, MAX_CHAIN_LINES + 3).map((item) => ({
      itemId: item.id,
      quantity: 1,
    }));
    const canonical = canonicalManifest(manifest(long), "generous", false);
    for (const line of long) {
      expect(canonical).toContain(line.itemId);
    }
  });

  it("changes when anything that was priced changes", async () => {
    const base = await manifestHash(manifest(lines), "generous", false);
    expect(base).toHaveLength(32);
    for (const byte of base) {
      expect(Number.isInteger(byte) && byte >= 0 && byte <= 255).toBe(true);
    }

    expect(await manifestHash(manifest(lines), "generous", false)).toEqual(base);
    expect(await manifestHash(manifest(lines), "harsh", false)).not.toEqual(base);
    expect(await manifestHash(manifest(lines), "generous", true)).not.toEqual(base);
    expect(await manifestHash(manifest(lines, "road"), "generous", false)).not.toEqual(base);
    expect(
      await manifestHash(
        manifest([{ itemId: "solar-lamp", quantity: 4 }, lines[1]]),
        "generous",
        false,
      ),
    ).not.toEqual(base);
  });
});

describe("the payload the program will check", () => {
  it("sends the engine's own figures, in cents", async () => {
    const input = manifest([{ itemId: "bottled-water", quantity: 200 }]);
    const result = price(input, { bias: "generous", valueLocally: false });
    const args = await pledgeArgsFor(input, result);

    expect(args.declaredUsdCents.toString()).toBe(String(result.declared));
    expect(args.netUsdCents.toString()).toBe(String(result.net));
    expect(args.grossWeightGrams.toString()).toBe(String(Math.round(result.grossWeightKg * 1000)));
    expect(args.mode).toEqual(chainMode(result.mode));
    expect(args.bias).toEqual(chainBias("generous"));
    expect(args.verdict).toEqual(chainVerdict(result.verdict));
    expect(args.manifestHash).toEqual(await manifestHash(input, "generous", false));

    // The case the project exists for: this one costs more to land than it delivers.
    expect(result.net).toBeLessThan(0);
    expect(args.verdict).toEqual({ becomesAsh: {} });
  });

  it("never sends a verdict the program would re-derive differently", async () => {
    for (const item of CATALOG) {
      for (const mode of MODES) {
        for (const bias of BIASES) {
          for (const valueLocally of [false, true]) {
            const input = manifest([{ itemId: item.id, quantity: 25 }], mode);
            const result = price(input, { bias, valueLocally });
            const args = await pledgeArgsFor(input, result);

            const derived = derivedOnChain(
              BigInt(args.declaredUsdCents.toString()),
              BigInt(args.netUsdCents.toString()),
            );
            expect(
              args.verdict,
              `${item.id} ${mode} ${bias}${valueLocally ? " local" : ""}: engine said ${
                result.verdict
              }, the program derives ${derived}`,
            ).toEqual(chainVerdict(derived));
          }
        }
      }
    }
  });

  it("agrees with the program on a manifest sitting exactly on the threshold", () => {
    // 60% inclusive, and one cent under it is not close enough.
    expect(derivedOnChain(10_000n, 6_000n)).toBe("LANDS");
    expect(derivedOnChain(10_000n, 5_999n)).toBe("BURDENS");
    expect(derivedOnChain(10_000n, -1n)).toBe("BECOMES_ASH");
  });

  it("holds up on a mixed pallet long enough to be truncated", async () => {
    const lines: Manifest["lines"] = CATALOG.slice(0, MAX_CHAIN_LINES + 5).map((item) => ({
      itemId: item.id,
      quantity: 4,
    }));
    const input = manifest(lines);
    const result = price(input, { bias: "midpoint", valueLocally: false });
    const args = await pledgeArgsFor(input, result);

    expect(args.lines).toHaveLength(MAX_CHAIN_LINES);
    expect(
      derivedOnChain(BigInt(args.declaredUsdCents.toString()), BigInt(args.netUsdCents.toString())),
    ).toBe(result.verdict);
    // The account holds a sample of the lines; the hash still covers all of them.
    expect(args.manifestHash).toEqual(await manifestHash(input, "midpoint", false));
  });

  it("keeps every item id inside what the account can store", async () => {
    const input = manifest(CATALOG.map((item) => ({ itemId: item.id, quantity: 1 })));
    const result = price(input, { bias: "generous", valueLocally: false });
    const args = await pledgeArgsFor(input, result);

    for (const line of args.lines) {
      expect(line.itemId.length, line.itemId).toBeLessThanOrEqual(32);
      expect(line.itemId.length, line.itemId).toBeGreaterThan(0);
      expect(line.quantity, line.itemId).toBeGreaterThan(0);
    }
  });
});

describe("errors a donor can act on", () => {
  it("reads the code out of an Anchor error object", () => {
    const error = { error: { errorCode: { number: DeadweightErrorCode.IndexOutOfOrder } } };
    expect(explainError(error)).toContain("next number");
  });

  it("reads the code out of a raw log line", () => {
    const error = new Error(
      "Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1777",
    );
    expect(DeadweightErrorCode.VerdictDoesNotFollow).toBe(0x1777);
    expect(explainError(error)).toContain("re-derived");
  });

  it("says plainly when the donor cancelled", () => {
    expect(explainError(new Error("User rejected the request."))).toBe(
      "You cancelled the signature.",
    );
  });

  it("points an empty wallet at the faucet", () => {
    expect(explainError(new Error("Attempt to debit an account but found no record of a prior credit."))).toBeTruthy();
    expect(explainError(new Error("insufficient lamports 0, need 1113600"))).toContain("devnet SOL");
  });

  it("falls back to the message rather than a hex code", () => {
    expect(explainError(new Error("Blockhash not found"))).toBe("Blockhash not found");
    expect(explainError(undefined)).toBeTruthy();
  });
});
