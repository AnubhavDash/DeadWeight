---
title: "Deadweight: price your generosity before you ship it"
published: false
tags: weekendchallenge, solana, ai, nextjs
cover_image: https://raw.githubusercontent.com/AnubhavDash/DeadWeight/main/docs/hero.png
description: A deterministic ledger that prices a donated coat's whole journey in USD, then spends the same money on what the response actually asked for — and lets no language model touch a single figure.
---

*Built for the [DEV Weekend Challenge: Generosity Edition](https://dev.to/challenges).*

**Live:** https://deadweight-jet.vercel.app
**Repo:** https://github.com/AnubhavDash/DeadWeight

---

## The coat

Someone in Rasuwa needs a coat. You have a coat. The arithmetic looks finished.

It isn't. Between your hands and theirs sit an air waybill, a customs broker, a
sorting line paid by the hour, a warehouse in a country whose warehouses are
already full, and — often enough — an incinerator. Every one of those steps has a
published rate. None of them appear on the box.

This has a name in the humanitarian sector. They call the arrival of unrequested
goods **the second disaster**, and they have been asking people to stop for forty
years. The Logistics Cluster writes guidance about it. OCHA writes guidance about
it. The IFRC's disaster-law reviews keep finding the same story: after Cyclone
Pam, unsolicited donations sat in Vanuatu for twelve months. Airlink has put a
number on the share of donated goods that is simply inappropriate for the
response receiving it.

And still the boxes come, because the impulse behind them is *correct*. Someone
is cold and you have a coat. There is nothing wrong with that instinct. What's
wrong is that nobody ever shows you the invoice.

So I built the invoice.

## What it is

[Deadweight](https://deadweight-jet.vercel.app) is a ledger for the gap between
giving something and it arriving.

You build a consignment on a manifest — winter jackets out of a wardrobe, bottled
water by the litre, used shoes, soft toys, the medicine cabinet. You pick a route:
air (days, and the only way into the cut-off districts), road over the
Birgunj–Raxaul crossing (weeks), or sea and road (months, because Nepal is
landlocked and the ocean stops at Kolkata).

Then it prices the whole journey in USD, line by line, and every line opens:

```
DECLARED VALUE                                        $2,800.00
3 line items

unusable used clothing                              -$1,615.00
  15% of this class arrives usable        SOURCE  [ASSUMPTION]

not needed or not appropriate                         -$540.00
  40% of this class arrives usable        SOURCE  [ASSUMPTION]

air freight DEL→KTM                                    -$84.00
  56.0 kg × $1.50/kg                     SOURCE

sorting labour                                          -$0.31
  0.4 h × $0.70/h local wage             SOURCE  [ASSUMPTION]

disposal                                                -$4.14
  43.1 kg unusable × $0.096/kg           SOURCE  [ASSUMPTION]

NET VALUE DELIVERED                                     $556.55

  BURDENS — 20% of declared value delivered
```

Every row shows the rate, the range it came from, the publisher, the date, and
the multiplication. The verdict is `LANDS`, `BURDENS`, or `BECOMES ASH`.

![The real ledger in the browser: declared value $2,800.00 at the top, five expandable subtractions, and a net delivered value of $556.55 under a BURDENS verdict](https://raw.githubusercontent.com/AnubhavDash/DeadWeight/main/docs/ledger.png)

Two things about that table matter more than the verdict.

**It reads every source at its kindest end by default.** Costs low, usefulness
high, storage at zero. A donor who doesn't like the answer can't accuse the table
of stacking the deck, because it already stacked it in their favour. (You can flip
it to midpoint, or to harshest, and watch $556.55 delivered become $339.73 *lost*.)

**It says out loud which of its own cells are assumptions.** Four of the fourteen
rate cells are reasoned from guidance rather than quoted from a source, and each
one is tagged `ASSUMPTION` everywhere it appears, with its range, publisher, date
and low confidence. A project that prices other people's generosity does not get
to hide its own soft spots.

## The half that makes it not a lecture

A tool that only tells you your coat was a mistake is a tool nobody uses twice.
The question the ledger provokes is *then what should I send?* — and if the app
can't answer that, the whole thing is a sermon.

So it answers it by computation. It takes your own declared total, spends it on
something the flash appeal actually named, and runs **that** counterfactual
manifest through the same engine, at the same freight mode, at the same reading of
the sources:

> **1,866 × Water purification tablets (strip of 10)** — LANDS
> $2,799.00 declared · $2,630.87 delivered · 94% of it
> **+$2,074.32 more reaches the response** than the manifest above, for the money
> already being spent.

![The same money, sent differently: a card for 1,866 water purification tablets marked LANDS, with its own declared, delivered and percentage figures](https://raw.githubusercontent.com/AnubhavDash/DeadWeight/main/docs/instead.png)

No new conversion table is introduced. Nothing is quoted that wasn't already
quoted. The comparison is the engine disagreeing with itself about two ways to
spend one sum of money, which is a claim you can check line by line on both sides.

And when nothing on the appeal's list beats what you've already put on the
manifest, the panel says so and offers nothing. It never manufactures an
improvement to have something to say.

## The rule the codebase exists to enforce

Here's the part I actually care about as an engineer.

**One deterministic function owns every number, and no model is ever allowed to
produce one.**

`price()` is pure. Same manifest, same mode, same reading, same answer, in integer
US cents — the money type is branded (`type Cents = number & { … }`) so that
writing `a - b` on two amounts fails to compile and you have to go through
`addCents(a, negate(b))` on purpose. It is the only thing in the repository that
does arithmetic on money. The browser calls it. The route handlers call it. The
on-chain program re-derives its verdict from the same rule.

The language model's job is narration, and the guarantee that it *stays*
narration is structural rather than hopeful.

**The prompt sent to Gemini contains no digits at all.** Not one. The consignment
is described to it in words — the route, the shape of the outcome, whether
anything on it was prohibited — and every figure is handed over as a vocabulary
of fifteen placeholder tokens instead of a value:

```
{{declared}} {{net}} {{owed}} {{efficiency}} {{weight}} {{unusable}}
{{cash}} {{shares}} {{verdict}} {{route}} {{reading}} {{items}}
{{prohibited}} {{appeal}} {{people}}
```

The model may state a figure only by placing one of those, written exactly as
given. It never learns what any of them are worth. Substitution happens
afterwards, in one function, from the engine's own output.

Then `normalize()` reads the draft back and **throws the entire thing away** if:

- a digit appears anywhere outside a placeholder — `digits`
- a quantity is stated in words: "twenty per cent", "a third", "half" — `words`
- it used a token that doesn't exist, or one that doesn't apply to this
  particular consignment — `token`
- it came back empty, or over length
- the model's own safety filter blocked the brief

No repair step, no partial acceptance. A repair step is a negotiation, and the
point is that this isn't negotiable.

And a refused draft isn't a broken feature. The deterministic letter is written
in the *same fifteen tokens* and finished by the *same substitution function*, so
when the model is unavailable, or slow, or numeric, what you read is the engine's
own prose and the byline changes from a model id to `engine`. The feature
degrades to the truth instead of to an error toast.

## Google AI — the letter from the warehouse

The narration isn't a summary bolted on top. It's a letter, written in the voice
of the person who unpacked your consignment, writing back to tell you what
happened to it. That's a thing a language model is genuinely good at and an
engine is not: tone, restraint, the decision not to gloat.

The route handler walks a chain — `gemini-3.8-flash`, then `gemini-3.7-flash`,
then `gemini-3.5-flash`, overridable with `GEMINI_MODELS` so a retired model id is
a config change rather than a deploy. Sixteen seconds per model, and it moves down
the chain on a timeout, an error, a blocked brief, *or a draft that failed the
clamp*. A model that keeps inventing numbers simply loses its turn.

That chain isn't defensive theatre — it earned its keep the first time I pointed a
real key at it. `gemini-2.5-flash` sat at the tail until it started answering
**404, "no longer available to new users"** while still being listed by
`GET /v1beta/models`: being listed is not being callable. And `gemini-3.8-flash`,
the newest and the one at the head, answers **503, "experiencing high demand"** on
most attempts right now. So on a live run the letter you read is written by the
middle of the chain, the log records both misses by name, and the reader is never
shown a spinner that ends in nothing. Every figure in the model's letter came back
byte-identical to the engine's — same dollars, same percentage, same kilograms —
because the model never had any of them to get wrong.

The prohibited-items paragraph gets handled separately, because it isn't an
arithmetic problem. Donated infant formula and part-used medicine out of a home
cabinet can't be accepted at all — not sorted, not stored, not passed to anybody.
The letter says so in the words the agencies use, and the ledger doesn't hand
them a gentler verdict for being well meant.

## ElevenLabs — and not becoming somebody's free TTS proxy

The letter is meant to be *heard*. Read aloud, "$556.55 of $2,800.00 arrived"
lands somewhere a table doesn't.

`eleven_multilingual_v2`, chosen deliberately over the faster models because the
docs are clear that the low-latency ones are less reliable at normalising written
amounts, and every sentence in this letter has an amount in it. If
`ELEVENLABS_VOICE_ID` isn't set the handler asks the account for its first voice
and uses that, re-checked per request, because a voice can disappear from an
account between two calls.

The voice model is handed **finished prose**. It is given no figures to reason
about and no arithmetic to do. Nothing numeric can reach your ears that `price()`
didn't compute.

There's an obvious hole in shipping a public text-to-speech endpoint, so it's
closed: `/api/letter` returns an HMAC-SHA256 seal alongside the letter, and
`/api/narrate` will only speak text whose seal verifies (`timingSafeEqual`, not
`===`). Send it your own paragraph and it quietly reads *this build's* letter
instead — dropped in silence rather than refused, because a seal issued by
another process isn't the caller's fault. Set `LETTER_SECRET` and the seal
survives a redeploy; leave it unset and each process mints a random 32 bytes at
boot. `src/lib/seal.ts` is honest in its own comments about what that does and
doesn't guarantee: it's a brake on casual abuse, not an authentication system.

No key? The browser's own `speechSynthesis` reads it. The button never lies about
whether there's a voice behind it.

## Solana — a notary, and the honest reason for it

I'll say the unfashionable part first: nothing in this app needs a blockchain, and
I refuse to pretend otherwise. There's no token, no treasury, no yield, no
"transparent donation rails". **The app collects no money at all** — every giving
link leaves the site for the UN flash appeal, Nepal Red Cross, Direct Relief or
UNICEF.

What a public ledger *is* honestly good at here is one narrow thing: a decision
that can't be quietly revised afterwards. If you price your consignment, read the
verdict, and commit it, that record is the thing you can't later claim you never
saw. So the program is a notary and nothing else.

An Anchor program with two instructions and deliberately no third:

```rust
initialize_registry   // one PDA, running totals
commit_pledge         // hash, declared, net, verdict — and it checks your work
```

`commit_pledge` **re-derives the verdict on-chain from the same rule the engine
uses**, out of the declared and net cents you handed it, and rejects the write if
the two disagree. You cannot notarise a flattering verdict against unflattering
figures. There is no `withdraw`, no treasury account and no lamport path out of
the program, because the app takes no donations and the chain should make that
structural rather than promised.

What gets stored is a SHA-256 of a canonical manifest string — version, freight
mode, bias, valuation flag, and the lines sorted by item id — so the same
consignment always hashes the same way and a different one never collides. Only
the top eight lines by declared value go on chain; when a manifest is longer than
that, the UI says it was truncated rather than letting you believe the whole thing
is up there.

**It's deployed and it holds real entries.** Devnet, labelled as a demonstration
everywhere it appears in the UI, never presented as a live donation channel:

| | |
| --- | --- |
| Program | [`DeadwBH8o2uqPTpdA5LDHmz6i7dv8LGtFFtmytKyxZ5F`](https://explorer.solana.com/address/DeadwBH8o2uqPTpdA5LDHmz6i7dv8LGtFFtmytKyxZ5F?cluster=devnet) |
| Registry PDA | [`ModqnUh86aLw2rBjuhAvm75RBL1pHEePopQHuWoCr7H`](https://explorer.solana.com/address/ModqnUh86aLw2rBjuhAvm75RBL1pHEePopQHuWoCr7H?cluster=devnet) |
| Pledge #1 | [`Fs6TUfK6Mbviyo7xrsx7PFximYMdkVxqeUA4P6ZeSem6`](https://explorer.solana.com/address/Fs6TUfK6Mbviyo7xrsx7PFximYMdkVxqeUA4P6ZeSem6?cluster=devnet) |

The IDL is uploaded on-chain as well as committed, so an explorer decodes those
accounts without being handed a schema. The figures in them came out of `price()`
and `pledgeArgsFor()` directly — I refused to type them by hand even once — and
the program accepted them only because its own re-derivation agreed.

![The notary page reading the live devnet registry: 2 entries, $5,600.00 declared, $1,113.10 delivered net, with the program and registry addresses printed above](https://raw.githubusercontent.com/AnubhavDash/DeadWeight/main/docs/notary.png)

And I got to test the permanence on myself, which I didn't plan. My first pledge
reconstructed the manifest from an earlier draft of this post: 25 jackets, 10
shoes, 60 toys. The app's actual default preset is 15 / 25 / 60 — the *other*
integer solution to the same two equations, so identical declared total,
identical 56.0 kg, identical $556.55, identical verdict, and a **different
canonical hash**. Entry #0 is therefore a perfectly valid record of a consignment
that isn't the one the app ships. There is no close instruction. It's still there,
and it will be there for as long as devnet is. Entry #1 is the default preset, so
that hash is the one you can reproduce by loading the page — but I'm not deleting
the first one, because a notary you can tidy up isn't a notary.

**One build note, in case it saves somebody an evening.** Anchor 1.2.0 defaults to
`--arch v3`, and the SBPFv3 ELF that platform-tools v1.57 emits is rejected by
litesvm 0.10's loader with a flat `InvalidAccountData`. Twelve Rust tests that
pass under `--arch v0` don't run at all without it:

```bash
anchor build --arch v0
cargo test --manifest-path programs/deadweight/Cargo.toml   # 12 tests, LiteSVM
```

Second one: this project sets `legacy-peer-deps=true` in `.npmrc` (more on why
below), and that flag applies to `npx` runs from the same directory — which is how
`anchor idl init` came to die on a missing `@solana/kit`. `npm_config_legacy_peer_deps=false`
in front of it, and the IDL uploaded fine.

## What I refused to build

**The death toll.** In the days after the event, published figures ran 160 → 359
→ 538 → 579 → over 1,250, with thousands missing, depending on the source and the
hour. A number that moves like that gets fetched live with its timestamp and its
attribution, or it does not get shown. The live route would have been the
ReliefWeb API, which since **1 November 2025** requires a pre-approved `appname`
and answers everything else with `403 AccessDeniedHttpException` — I verified that
during the build. So the fetch isn't in the shipped app and neither is the number.
Hardcoding a toll into a project whose entire argument is *don't hardcode moving
numbers* would have been the exact failure I'm writing about.

**Dollars converted into blankets on the ground.** The tempting version of "send
this instead" says "$2,800 buys 400 blankets in Kathmandu". I have no defensible
source for that, so it doesn't exist. Both sides of the comparison are priced at
the same donor-country retail figures the catalogue already quotes, which means
the two ledgers rest on the same *kind* of number and the difference between them
is the freight and the sorting and the disposal — which is the actual claim.

**Any way to give Deadweight money.** No payment path in the codebase. Not
disabled — absent.

**A green audit badge I hadn't earned.** GitHub reported eight advisories on the
default branch: 1 critical, 4 high, 2 moderate, 1 low. Six are gone — a `vitest`
patch bump for the critical, `overrides` pinning `toml` to 4.3.0 and `uuid` to
11.1.1, and **React Native uninstalled entirely**, which took metro and 69 packages
with it and removed two unpatchable `image-size` DoS advisories that had no fix to
install. (`@solana-mobile/wallet-adapter-mobile` declares `react-native` as a
non-optional peer, npm dutifully installs it, and nothing in a web app ever
resolves the `index.native.js` that needs it. Hence `legacy-peer-deps=true`, with
the reasoning written out in `.npmrc`.)

Two stay, and here is why. `stream-json` 1.9.1 under `jayson` is a
moderate O(depth²) parser DoS. It can't be bumped — the patched line is pure ESM
whose `exports` map doesn't answer `jayson`'s
`require('stream-json/streamers/StreamValues')` — and it can't be reached, because
the vulnerable filters live in `jayson`'s TCP and TLS transports and
`@solana/web3.js` requires exactly one entry point, `jayson/lib/client/browser`,
which contains no stream parser at all.

The eighth isn't a JavaScript package, which is the part worth passing on:
**Dependabot reads `Cargo.lock` too, and `npm audit` structurally cannot see it.**
That one is `rand` 0.7.3, unsound only under a custom `log` logger that reseeds the
thread-local generator mid-call. There's no custom logger here, it reaches the tree
on a dev edge only — `litesvm` → `agave-syscalls` → `libsecp256k1` → `rand` — so
`cargo tree -e normal` doesn't contain it at any version, and it can't be moved
anyway, because `libsecp256k1` 0.6.0 asks for `rand = "^0.7"` and the fix is 0.8.6.
Documented beats dismissed.

## It works with the GPU switched off, and at 382px

The crate in the header is a particle cloud sampled out of an SVG — canvas-ui's
`ParticleObject`, driven through its imperative API — and it's the only WebGL in
the app. It's gated three ways: three.js is imported inside an effect so it never
enters the first load, the context is probed before anything mounts, and
`prefers-reduced-motion: reduce` skips it outright. All three failure paths paint
the same crate as a still image, and the no-WebGL and reduced-motion paths render
byte-identical screenshots — I checked that headlessly rather than assuming it.

![The same crate twice, side by side: the WebGL particle cloud on the left, the still SVG fallback under prefers-reduced-motion on the right](https://raw.githubusercontent.com/AnubhavDash/DeadWeight/main/docs/gpu-off.png)

The crate is `aria-hidden` and carries no figure. Every number on the page
survives its absence, which is the only accessibility promise worth making about a
decorative canvas.

Checked on Android at 382px wide, where the headline stays above the fold and the
full-width canvas doesn't swallow a vertical drag. Crimson appears in exactly two
places in the whole design system — negative numbers, and the `BECOMES ASH`
verdict. Never decorative. When a ledger line goes red it's because money left.

## Stack

Next.js 16 App Router with Turbopack, React 19, TypeScript in strict mode,
Tailwind v4, shadcn, [canvas-ui](https://github.com/DavidHDev/canvas-ui) and React
Bits for the visual layer, Anchor on Solana devnet, Gemini and ElevenLabs behind
route handlers, Vercel. Two route handlers in the entire app; every key is read
server-side and none is ever shipped to the browser.

**206 tests** — 194 in TypeScript across 8 files, 12 in Rust against the program
under LiteSVM. Most of them exist to hold the engine still: the pricing rule, the
branded-cents arithmetic, the prohibited-item paths, the `normalize()` refusal,
the HMAC seal, and the "send this instead" ranking.

## Credits

**[canvas-ui](https://github.com/DavidHDev/canvas-ui) — © 2026 David Haz, MIT +
Commons Clause.** `ParticleObject` is used here under that licence; the copyright
notice is retained in the component file and the credit is in the site footer and
the README as well as here. The components aren't redistributed as a library from
my repo. [DavidHDev](https://github.com/DavidHDev) builds the nicest visual
primitives on the web right now and it isn't close.

Twenty-five sources, each cited in the UI with its own date, its publisher, a link
that opens off-site, and a grading of how honestly I came by it — `primary` if I
fetched and read the document, `secondary` if a named third party reports the
figure, `snippet` if the host refused automated retrieval and the quote came from a
search index unread in context. That last grade exists because I'd rather show you
weak evidence labelled weak than launder it.

## The coat, again

The response to the 26 August debris flow got a **US$49.6 million flash appeal for
84,000 people** on 4 September 2026. I didn't decide what that response needs, and
neither did my engine. The appeal's own priority list opens with **direct cash
assistance**. That ordering is the whole argument of this project and it isn't
mine — it's theirs. All Deadweight does is show you the arithmetic that makes it
true, in the one currency where it can't hide, with a source and a date under every
row.

So: keep the instinct. Someone is cold and you have a coat, and that impulse is
the only reason any of this machinery exists to be criticised. Just send the thing
that arrives.

Nothing in this app takes your money. When you're ready, give to the same four
places it points at — the [UN Nepal flash appeal](https://nepal.un.org/en),
the [Nepal Red Cross Society](https://nrcs.org/), [Direct
Relief](https://www.directrelief.org/), or [UNICEF
Nepal](https://www.unicef.org/nepal/).

**Live:** https://deadweight-jet.vercel.app
**Repo:** https://github.com/AnubhavDash/DeadWeight

*Built for the DEV Weekend Challenge: Generosity Edition. Categories: Solana,
Google AI, ElevenLabs. Price your generosity before you ship it.*







