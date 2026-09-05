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

Built for the [DEV Weekend Challenge: Generosity Edition](https://dev.to/challenges),
set against the response to the glacier-linked debris flow that came down the
Bhotekoshi and Trishuli on **26 August 2026**, and the **US$49.6 million flash
appeal** the UN and partners launched for 84,000 people on 4 September 2026.
Cash assistance is first on that appeal's own priority list. That ordering is
the whole argument of this project, and it is not ours — it is the response's.

**Live demo:** https://deadweight-jet.vercel.app

**Video walkthrough:** *link goes here on submission*

![The Deadweight header: the headline "Price your generosity before you ship it." beside a crate drawn as a WebGL particle cloud](docs/hero.png)

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
appeal actually named, and set quantities. Choose the route: air (days, and the
only way into the cut-off districts), road over the Birgunj–Raxaul crossing
(weeks), or sea and road (months — Nepal is landlocked and the ocean stops at
Kolkata). Then choose how to read the sources: kindest, midpoint, or harshest.

**The ledger.** Every line opens. Freight, handling, customs brokerage, inland
transport, sorting labour, storage in a congested pipeline, disposal of what
cannot be used — each with the rate it used, the range that rate came from, the
publisher, the date, and the multiplication. Where a publisher blocked automated
retrieval, the row says so instead of guessing.

![The priced ledger for the default manifest: declared value $2,800.00, then subtractions for unusable used clothing, goods not needed or not appropriate, air freight, sorting labour and disposal, ending at a net delivered value of $556.55 and a BURDENS verdict](docs/ledger.png)

*The box in the garage, sent by air: fifteen used winter jackets, twenty-five
pairs of used shoes, sixty soft toys. $2,800.00 declared. $556.55 arrives. Every
subtraction expands into its rate, its range, its publisher and its date.*

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

![The "same money, sent differently" panel: 1,866 water purification tablets, LANDS, $2,799.00 declared and $2,630.87 delivered — 94% — beside a note that this delivers $2,074.32 more than the manifest](docs/instead.png)

*The same $2,800.00, spent on something the appeal asked for and priced by the
same engine at the same freight mode and the same bias.*

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
per-process random key — which holds inside one instance and, across several,
quietly drops the offered letter and speaks the engine's instead, so a deployment
running on more than one instance should set it (`openssl rand -base64 32`; there
is no service to get it from). Copy `.env.example` to `.env.local` if you have
keys — it says where each one comes from and what breaks without it. Every key is
read in a route handler and **none is ever sent to the browser**.

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

Every citation also records **how honestly we came by it** — `primary` (the
document was fetched and read), `secondary` (a named third party reports the
figure), or `snippet` (the host refused automated retrieval, so the quote comes
from a search index and has not been read in context). The UI surfaces that
grading, and `snippet` is treated as the weakest form of evidence there is.

The rate table holds **14 cells**. Each one is a range, not a point, with a
publisher, a date and a confidence. The default reading is the kindest one — every
cost at the low end of its range, every usefulness at the high end, storage at
zero — so a bad verdict is one you cannot argue your way out of. Midpoint takes
the middle of every range. Harshest costs high, usefulness low, and leaves the
consignment uncollected for the twelve months it sat uncollected in Vanuatu.

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

An Anchor program with two instructions and no third one. `initialize_registry`
opens a single PDA that keeps running totals. `commit_pledge` records one
decision: the manifest's hash, its declared total, its delivered net, and the
verdict — and it **re-derives that verdict on-chain from the same rule the
engine uses** and rejects the write if the two disagree. There is no `withdraw`
instruction, no treasury, and no lamport path out of the program, because the
app takes no donations and the chain should make that structural rather than
promised.

**It is live on devnet, and every account below is real:**

| | Address |
| --- | --- |
| Program | [`DeadwBH8o2uqPTpdA5LDHmz6i7dv8LGtFFtmytKyxZ5F`](https://explorer.solana.com/address/DeadwBH8o2uqPTpdA5LDHmz6i7dv8LGtFFtmytKyxZ5F?cluster=devnet) |
| ProgramData | [`DnBQn1c849hgekcH9CoWzCuoNYgfv6k1DtgEQnEDf5VF`](https://explorer.solana.com/address/DnBQn1c849hgekcH9CoWzCuoNYgfv6k1DtgEQnEDf5VF?cluster=devnet) |
| IDL metadata | [`FzwrD5Y7tvKj26xNDyQm4ohh3ZWWw5YTQMM7WRVBsfWh`](https://explorer.solana.com/address/FzwrD5Y7tvKj26xNDyQm4ohh3ZWWw5YTQMM7WRVBsfWh?cluster=devnet) |
| Registry PDA | [`ModqnUh86aLw2rBjuhAvm75RBL1pHEePopQHuWoCr7H`](https://explorer.solana.com/address/ModqnUh86aLw2rBjuhAvm75RBL1pHEePopQHuWoCr7H?cluster=devnet) |
| Pledge #0 | [`CDqfAUTtUq7oQhjca84GUskpA6CuZyvy88FUbji7mBYN`](https://explorer.solana.com/address/CDqfAUTtUq7oQhjca84GUskpA6CuZyvy88FUbji7mBYN?cluster=devnet) |
| Pledge #1 | [`Fs6TUfK6Mbviyo7xrsx7PFximYMdkVxqeUA4P6ZeSem6`](https://explorer.solana.com/address/Fs6TUfK6Mbviyo7xrsx7PFximYMdkVxqeUA4P6ZeSem6?cluster=devnet) |

The IDL is uploaded to the chain as well as committed here, so an explorer can
decode those accounts without being handed a schema.

![The notary page reading the live devnet registry: 2 entries, $5,600.00 declared, $1,113.10 delivered net](docs/notary.png)

*The panel does its own division on what it read off the chain: two entries,
$5,600.00 declared across both, $1,113.10 of it delivered — 20%.*

Both entries hold the same figures because they are two different manifests that
happen to price identically; **#1 is the app's own default preset**, so its hash
is the one you can reproduce by loading the page and pricing what is already on
it. #0 is not, and it stays there — the program has no close instruction and no
way to revise a record, which is the entire point and also means my own first
entry is permanent. Neither figure was typed by hand: both came out of `price()`
and `pledgeArgsFor()` directly, and the program accepted them only because its
own re-derivation agreed.

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

![The same crate twice, side by side: the WebGL particle cloud on the left, the still SVG fallback served under prefers-reduced-motion on the right](docs/gpu-off.png)

*Left: WebGL. Right: the same page under `prefers-reduced-motion: reduce`. The
headline, the figures and every control are identical.*

The crate is decorative and marked `aria-hidden`. It carries no figure. Every
number on the page survives its absence.

---

## Prize categories

Three of the four, and each of them is load-bearing — pulled out, the feature it
carries stops working rather than getting quieter.

| Prize category | What it does here |
| --- | --- |
| **Best Use of Solana** | An Anchor program on devnet, `DeadwBH8o2uqPTpdA5LDHmz6i7dv8LGtFFtmytKyxZ5F`, notarises a verdict — after re-deriving it. `commit_pledge` recomputes the efficiency from the declared and net cents it is handed and **rejects the transaction when the submitted verdict disagrees**, so the chain audits the app instead of printing receipts for it. `/notary` reads the registry and every pledge account back live in the browser; the running totals it prints are the program's own. Devnet only, labelled a demonstration wherever it appears, moving no money — this app collects nothing. |
| **Best Use of Google AI** | Gemini writes the letter to the person who was about to ship the box, and is structurally forbidden from producing a number. The prompt contains no digits at all; a figure reaches the page only through a `{{token}}` placeholder the server fills from the engine afterwards, and `normalize()` discards the **entire** draft if a digit or a quantity word appears anywhere outside one. A fallback chain across three model ids, configurable without a deploy, keeps it standing when one is retired mid-challenge — which happened on 5 September. |
| **Best Use of ElevenLabs** | The letter is read aloud in `eleven_multilingual_v2`, and only prose this build vouches for can be spoken: `/api/letter` returns an HMAC seal with the text, `/api/narrate` verifies it before spending a character, and an unsealed draft is quietly swapped for the deterministic letter the engine writes itself. With no key, or when synthesis fails, the browser's own speech synthesis reads the same words — the panel never goes silent. |

Snowflake is the fourth and it is absent, because there is no warehouse-shaped
problem here to give it: the entire rate table is fourteen cells in a TypeScript
file, and every one of them is printed on `/sources` with its range, its date,
its confidence and the sentence it came out of.

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
