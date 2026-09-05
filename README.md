# Deadweight

**Price your generosity before you ship it.**

Someone in the affected districts of Rasuwa needs a coat. You have a coat. The
arithmetic looks finished, and it is not: between your hands and theirs sit an
air waybill, a customs broker, a sorting line paid by the hour, a warehouse in
a country whose warehouses are already full, and — often enough — an
incinerator. Every one of those steps has a published rate. None of them appear
on the box.

Deadweight is a ledger for that gap. You put a consignment on a manifest; it
prices the whole journey in USD, line by line, at the kindest end of every
sourced range, and tells you what actually arrives. Then it does the more
useful half: it spends your same declared total on something the response
actually asked for, prices *that* the same way, and shows you the difference.

Nothing here says don't give. It says give the thing that arrives.

Built for the **DEV Weekend Challenge: Generosity Edition** (`#weekendchallenge`),
set against the response to the glacier-linked debris flow that came down the
Bhotekoshi and Trishuli on **26 August 2026**, and the **US$49.6 million flash
appeal** the UN and partners launched for 84,000 people on 4 September 2026.
Cash assistance is first on that appeal's own priority list. That ordering is
the whole argument of this project, and it is not ours — it is the response's.

**Live:** [deadweight.vercel.app](https://deadweight.vercel.app) · **Tag:**
`#weekendchallenge` · **Prize technologies:** Solana, Google AI (Gemini),
ElevenLabs

---

## The rule the codebase is built to enforce

**One deterministic function owns every number, and no model is ever allowed to
produce one.**

`price()` in `src/lib/logistics.ts` is pure: same manifest, same freight mode,
same reading of the sources, same answer, in integer US cents. It is the only
thing in the repository that does arithmetic on money. The browser calls it, the
route handlers call it, and the Anchor program re-derives its verdict from the
same rule before it will record one.

The language model's job is narration, and the guarantee that it stays narration
is structural rather than hopeful:

- The prompt sent to Gemini **contains no digits at all**.
- The model may state a figure only by emitting a `{{token}}` placeholder.
- `normalize()` then discards the **entire draft** if a digit or a quantity word
  appears anywhere outside a placeholder. There is no repair step, because a
  repair step is a negotiation, and the point is that this is not negotiable.
- The same guarantee extends to the audio: ElevenLabs is handed finished prose.
  No figure can reach your ears that the engine did not compute.

If the model is unavailable, or says something numeric, the letter you read is
the engine's own prose. The feature degrades to the truth rather than to a
placeholder.

---

## What it actually does

**The manifest.** Pick items from a catalogue of the things people really send —
used winter jackets out of a wardrobe, bottled water by the litre, used shoes,
soft toys, assorted medicines from a home cabinet — alongside the things the
appeal actually named, and set quantities. Choose air or sea. Choose whether to
read every sourced range at the end that favours you, or the end that doesn't.

**The ledger.** Every line opens. Freight, handling, customs brokerage, inland
transport, sorting labour, storage in a congested pipeline, disposal of what
cannot be used — each with the rate it used, the range that rate came from, the
publisher, the date, and the multiplication. Where a publisher blocked automated
retrieval, the row says so instead of guessing.

**The verdict.** `LANDS`, `BURDENS`, or `BECOMES ASH`, from the ratio of what
arrives to what you declared. Two items on the catalogue are prohibited outright —
donated infant formula, and part-used or short-dated medicines out of a home
cabinet — and they do not get a gentler verdict for being well meant. Each says
why, in the words of the agencies that ask people not to send them.

**Send this instead.** The constructive half. It takes your declared total,
spends it on something the appeal named, and runs *that* through the same
engine at the same freight mode and the same bias. Nothing new is priced and no
new conversion table is introduced — the comparison is the engine disagreeing
with itself about two ways to spend one sum of money, which is a claim you can
check line by line on both sides. When nothing beats what you have already put
on the manifest, the panel says so and offers nothing.

**The letter.** A short narration of your own ledger, written by Gemini under
the constraint above, speakable by ElevenLabs, and sealed so the audio endpoint
cannot be turned into somebody else's text-to-speech proxy.

**The notary.** Optional, devnet, and labelled as a demonstration everywhere it
appears — see below.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

**No environment variable is required.** Every key is optional and every feature
that wants one degrades honestly without it: with no `GEMINI_API_KEY` the letter
is the engine's own prose, with no `ELEVENLABS_API_KEY` the narration falls back
to the browser's own speech synthesis, with no `LETTER_SECRET` the seal uses a
per-process random key. Copy `.env.example` to `.env.local` if you have keys.
Every key is read in a route handler and **none is ever sent to the browser**.

```bash
npm run typecheck    # tsc --noEmit, strict
npm run lint         # eslint src
npm test             # vitest
npm run build
```

Built and verified on Node v24.20.0 with Next.js 16.3.4 (App Router, Turbopack),
React 19, Tailwind v4 and TypeScript in strict mode.

**Tests: 206.** 194 TypeScript tests across 8 files, and 12 Rust tests against
the Anchor program under LiteSVM. Most of them exist to hold the engine still:
the pricing rule, the branded-cents arithmetic, the prohibited-item paths, the
`normalize()` refusal, the HMAC seal, and the "send this instead" ranking.

---

## Where the numbers come from

Twenty-five sources, each cited in the UI with its own date and a link that opens
off-site: the UN's Nepal flash appeal, the World Bank on air freight, the IRC on
the 2026 freight spike and on cost-efficiency, Airlink, OCHA and the Logistics
Cluster on unsolicited goods, IFRC Disaster Law's Vanuatu review, USAID's CIDI
calculator, the US State Department's "Cash is Best", CALP, DFID, ALNAP, UNHCR,
UNICEF and CDC on infant formula, WRAP and NIST on textile reuse, and Nepal's
2025 minimum wage. The ledger footnotes itself; nothing in the prose on the page
is a number typed by hand.

The rate table holds **14 cells**. Each one is a range, not a point, with a
publisher, a date and a confidence. The engine's default bias is `generous`: it
reads every range at whichever end flatters the donation — costs at their low
end, usable fractions at their high end — so a bad verdict is one you cannot
argue your way out of. Flip the bias and watch the ledger get worse.

**Four of the fourteen are assumptions, and the code says so in the same words:**

| Cell | Range | Source | Dated | Confidence |
| --- | --- | --- | --- | --- |
| `SORTING_HOURS_PER_TONNE` | 8–40 hours/tonne | Logistics Cluster, unsolicited donations | 2021 | low |
| `DISPOSAL_PER_KG` | $0.096–0.30 /kg | NH DES, textile disposal | 2020-01 | low |
| `CONGESTED_STORAGE_MONTHS` | 0–12 months | IFRC Disaster Law, Vanuatu review | 2020 | low |
| `USABLE_REQUESTED` | 0.85–0.95 usable fraction | UN Nepal flash appeal | 2026-09-04 | low |

`assumptionCells()` returns exactly that list, the UI reads it from there, and
the ledger marks the affected rows. A project that prices other people's
generosity does not get to hide its own soft spots.

---

## What is deliberately missing

**The death and missing toll.** Within days of the event, published figures ran
160 → 359 → 538 → 579 → over 1,250, with thousands missing, depending on the
source and the hour. A number that moves like that gets fetched live with its
timestamp and its attribution, or it does not get shown. The live route would
have been the ReliefWeb API, which since **1 November 2025** requires a
pre-approved `appname` and returns `403 AccessDeniedHttpException` to everything
else — verified during this build. So the fetch is not in the shipped app, and
neither is the number. Hardcoding it would have been the exact failure this
project is about.

**Dollars converted into blankets in the region.** The comparison never claims
"$X buys N blankets in Kathmandu". Both sides of it are priced at the same
donor-country retail figures the catalogue already quotes, so the two ledgers
rest on the same kind of number. The reasoning is written out above
`APPEAL_USD_PER_PERSON` in `src/data/rates.ts`.

**Any way to give Deadweight money.** There is no payment path in the codebase.
Every giving link leaves the site for the flash appeal, Nepal Red Cross, Direct
Relief or UNICEF.

---

## The notary — Solana devnet, as a demonstration

`DeadwBH8o2uqPTpdA5LDHmz6i7dv8LGtFFtmytKyxZ5F`

An Anchor program with two instructions and no third one. `initialize_registry`
opens a single PDA that keeps running totals. `commit_pledge` records one
decision: the manifest's hash, its declared total, its delivered net, and the
verdict — and it **re-derives that verdict on-chain from the same rule the
engine uses** and rejects the write if the two disagree. There is no `withdraw`
instruction, no treasury, and no lamport path out of the program, because the
app takes no donations and the chain should make that structural rather than
promised.

Devnet only, and labelled as a demonstration wherever it appears in the UI. What
it is for is the one thing a public ledger is honestly good at here: a
donation decision that cannot be quietly revised afterwards. `public-ledger.tsx`
reads the registry with `fetchNullable`, so when the registry does not exist the
panel says exactly that instead of rendering an empty table.

**Building it — the `--arch v0` note.** Anchor 1.2.0 defaults to `--arch v3`, and
the SBPFv3 ELF that platform-tools v1.57 produces is rejected by litesvm 0.10's
loader with `InvalidAccountData`. So the build is pinned:

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
anchor build --arch v0
cargo test --manifest-path programs/deadweight/Cargo.toml   # 12 tests, LiteSVM
```

Verified against Anchor 1.2.0 and Agave 4.2.2. Drop `--arch v0` and the Rust
tests will not run.

---

## It works with the GPU switched off

The header's crate is a particle cloud sampled out of an SVG, and it is the only
WebGL in the app. It is gated three ways: three.js is imported inside an effect
so it never enters the first load, the context is probed before anything mounts,
and `prefers-reduced-motion: reduce` skips it outright. In all three failure
cases the same crate is painted as a still image. Verified headlessly — the
no-WebGL path and the reduced-motion path render byte-identical screenshots — and
checked on Android at **382px** wide, where the headline stays above the fold and
the full-width canvas does not swallow a vertical drag.

The crate is decorative and marked `aria-hidden`. It carries no figure. Every
number on the page survives its absence.

---

## Credits

**[canvas-ui](https://github.com/DavidHDev/canvas-ui) — © 2026 David Haz, MIT +
Commons Clause.** `ParticleObject` is used here, driven through its imperative
API. The copyright notice is retained in the component file, the credit is in the
site footer as well as here, and the components are not redistributed as a
library from this repository.

Rates, ranges and humanitarian figures belong to their publishers and are cited
in the UI with dates and links: UN OCHA, IFRC, the Logistics Cluster, USAID,
the US State Department, the IRC, Airlink, CALP, DFID, ALNAP, UNHCR, UNICEF, CDC,
WRAP, NIST, the World Bank and the others listed in `src/data/citations.ts`.

Gemini writes the letter. ElevenLabs reads it. Neither is allowed to produce a
number.

---

## Provenance

The whole repository was started and finished inside the challenge window —
first commit `ff2b215`, **2026-09-05 13:31 UTC**. Nothing in it predates the
challenge.

## Post-submission changes

*None.* Anything committed after the submission deadline will be listed here,
with what changed and why.
