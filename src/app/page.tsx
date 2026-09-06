/**
 * The landing page. Everything numeric on it comes either from `data/crisis.ts`
 * (figures that do not move, each dated and sourced) or from the pricing engine
 * by way of `<ManifestBuilder />`. No figure is written into this prose, so the
 * copy cannot drift away from the table it describes.
 */

import { CrateObject } from "@/components/crate-object";
import { ManifestBuilder } from "@/components/manifest-builder";
import { SiteFooter } from "@/components/site-footer";
import { citation, citationLabel, type CitationId } from "@/data/citations";
import { APPEALS, CRISIS, type CrisisFact } from "@/data/crisis";
import { APPEAL_USD_PER_PERSON } from "@/data/rates";
import { formatUsdWhole, usd } from "@/lib/money";

function Source({ id }: { id: CitationId }) {
  return (
    <a
      href={citation(id).url}
      target="_blank"
      rel="noreferrer noopener"
      className="underline decoration-rule underline-offset-2 hover:text-sonar"
    >
      {citationLabel(id)}
    </a>
  );
}

function Fact({ label, fact }: { label: string; fact: CrisisFact }) {
  return (
    <div className="border-l border-rule pl-3">
      <p className="text-2xs uppercase tracking-[0.16em] text-meltwater">{label}</p>
      <p className="mt-1 text-sm text-paper/90">{fact.value}</p>
      <p className="ledger mt-1 text-2xs text-meltwater">
        as of {fact.asOf} · <Source id={fact.source} />
      </p>
    </div>
  );
}

const SECTION = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const EYEBROW = "display text-xs uppercase tracking-[0.2em] text-meltwater";

export default function Home() {
  return (
    <>
      <main className="flex-1 pt-14 sm:pt-20">
        <header className={SECTION}>
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,21rem)] lg:gap-12">
            <div>
              <p className={EYEBROW}>
                {CRISIS.name} · {CRISIS.locus}
              </p>
              <h1 className="mt-5 max-w-4xl text-4xl leading-[1.05] sm:text-6xl lg:text-7xl">
                Price your generosity
                <br />
                before you ship it.
              </h1>
              <div className="mt-7 max-w-2xl space-y-4 text-base leading-relaxed text-paper/85">
                <p>
                  This is a tool for protecting generosity from being wasted. The impulse to put
                  something in a box and send it is the right impulse. What is in the box is the part
                  nobody prices — so this page prices it, in USD, against the response that is
                  actually running in Nepal right now.
                </p>
                <p className="text-meltwater">
                  A donated coat has to be flown, cleared, sorted, warehoused and — often enough —
                  burned. Every one of those steps has a published rate. Put a consignment on the
                  manifest below and the ledger works it the way a logistics officer would: at the
                  kindest end of every sourced range, so a bad verdict is one you cannot argue with.
                  Then it tells you what the same money delivers as cash.
                </p>
                <p className="border-l-2 border-sonar/50 pl-4 text-paper">
                  Nothing here says don&rsquo;t give. It says give the thing that arrives.
                </p>
              </div>
            </div>

            {/* Second on a phone, deliberately: the headline is what has to be
                above the fold, not the decoration. */}
            <div>
              <CrateObject className="h-56 w-full sm:h-72 lg:h-80" />
              <p className="mt-2 text-center text-2xs uppercase tracking-[0.16em] text-meltwater">
                the box, before anyone weighs it
              </p>
            </div>
          </div>
        </header>

        <section className={`${SECTION} mt-16 sm:mt-20`} aria-labelledby="response">
          {/*
            The one label on the site long enough that its own tracking breaks it.
            At 0.2em this measures 357px and a 382px phone offers 342, so it wrapped
            15px short and left the word "into" alone on a second line — a heading
            reading as a sentence that ran out of room. 0.14em brings it to 325px,
            which is one line with 17px to spare, and `sm:` restores the full
            tracking the moment there is width for it. The hero eyebrow above keeps
            0.2em: it needs 457px and cannot be made to fit at any tracking, so it
            wraps at a `·` on purpose.
          */}
          <h2
            id="response"
            className="display text-xs uppercase tracking-[0.14em] text-meltwater sm:tracking-[0.2em]"
          >
            The response you would be sending into
          </h2>
          <div className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Districts hit" fact={CRISIS.districts} />
            <Fact label="People affected" fact={CRISIS.peopleAffected} />
            <Fact label="Children affected" fact={CRISIS.childrenAffected} />
            <Fact label="Children needing clean water" fact={CRISIS.childrenNeedingWash} />
          </div>

          <div className="mt-10 grid gap-8 border border-rule p-5 sm:p-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <div>
              <p className="text-2xs uppercase tracking-[0.16em] text-meltwater">
                The flash appeal
              </p>
              <p className="ledger mt-2 text-3xl text-paper">
                {formatUsdWhole(usd(CRISIS.appeal.usd))}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-meltwater">
                for {CRISIS.appeal.people.toLocaleString("en-US")} people, launched{" "}
                {CRISIS.appeal.launched}. That is{" "}
                <span className="ledger text-paper/90">
                  {formatUsdWhole(usd(APPEAL_USD_PER_PERSON.low))}
                </span>{" "}
                a person for the whole response — the yardstick the ledger measures your consignment
                against. <Source id={CRISIS.appeal.source} />
              </p>
            </div>
            <div>
              <p className="text-2xs uppercase tracking-[0.16em] text-meltwater">
                What the appeal asked for, in the order it asked
              </p>
              {/*
                The order is the argument, so the numbers are set in the ledger
                face a step down from the words. `items-baseline` is what keeps
                them sitting on the same line as those words: at two different
                sizes in a flex row, stretch alignment would top-align both
                boxes and leave the smaller number riding high. Nothing here is
                coloured to single out cash — sonar means "you can click this"
                everywhere else on the site, and 01 is not a link. The position
                and the sentence underneath already say it.
              */}
              <ol className="mt-3 grid gap-y-1.5 sm:grid-cols-2">
                {CRISIS.appeal.priorities.map((priority, index) => (
                  <li key={priority} className="flex items-baseline gap-2.5 text-sm">
                    <span className="ledger text-xs text-meltwater">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-paper/85">{priority}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-sm leading-relaxed text-meltwater">
                Cash is first. That ordering is the most important fact on this page: the
                response&rsquo;s own priority list opens with the thing donors are least inclined to
                send.
              </p>
            </div>
          </div>

          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-meltwater">
            <span className="text-paper">The death and missing toll is not printed here.</span>{" "}
            Within days of the event, published figures ran 160 → 359 → 538 → 579 → over 1,250, with
            thousands missing, depending on the source and the hour. A number that behaves like that
            gets fetched live with its timestamp and its attribution, or it does not get shown. The
            live route would be ReliefWeb, which since November 2025 requires a pre-approved app
            name and refuses everything else — so this build cannot fetch it, and therefore does not
            show it. Hardcoding it would be the exact failure this project is about.
          </p>
        </section>

        <section className={`${SECTION} mt-20 sm:mt-24`} aria-labelledby="ledger">
          <h2 id="ledger" className="display text-2xl uppercase tracking-[0.14em] text-paper">
            The manifest
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-meltwater">
            Build a consignment. Every line of the ledger opens to show the rate it used, the source
            it came from, the date, and the arithmetic. Where a publisher blocked automated
            retrieval, it says so.
          </p>
          <div className="mt-10">
            <ManifestBuilder />
          </div>
        </section>

        <section className={`${SECTION} mt-24`} aria-labelledby="instead">
          <h2 id="instead" className="display text-2xl uppercase tracking-[0.14em] text-paper">
            Where to send it instead
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-meltwater">
            Deadweight accepts nothing. Every link below goes off this site to a page that can take
            a donation — not to an organisation&rsquo;s homepage — and each of them can buy in the
            region what a container of goods spends its whole value trying to get there. They are in
            order: the further up, the more of the dollar is spent inside Nepal by someone who was
            already there.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {APPEALS.map((appeal) => (
              <li key={appeal.url}>
                <a
                  href={appeal.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block h-full border border-rule p-4 transition-colors hover:border-sonar/60 hover:bg-sonar/5"
                >
                  <span className="block text-sm text-paper">{appeal.name}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-meltwater">
                    {appeal.note}
                  </span>
                  {/* Plain text, not a link: the tile is already the anchor, and
                      an anchor inside an anchor is not valid HTML. The sources
                      page carries the clickable version of every one of these. */}
                  {appeal.source ? (
                    <span className="ledger mt-1.5 block text-2xs text-meltwater/80">
                      {citationLabel(appeal.source)}
                    </span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-meltwater">
            Longer lists exist, and the six above are not the whole response. The World Food
            Programme, the WHO, Catholic Relief Services, Save the Children, World Vision and Plan
            International are all reported to be running one.{" "}
            <span className="text-paper">They are named here rather than linked above</span> because
            we have not opened and checked a giving page for each of them, and a list of places to
            send money should not imply more checking than it has had.{" "}
            <Source id="nyt-nepal-donate-2026" />
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
