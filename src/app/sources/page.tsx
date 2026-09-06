/**
 * The sources page. The whole rate table, printed, with every cell's range,
 * date, confidence, derivation and source — plus the two lists this project
 * would rather not have to publish: the cells that are reasoned instead of
 * sourced, and the citations whose text a publisher would not let us retrieve.
 *
 * Cells are named here exactly as the engine names them, so a reader checking
 * the arithmetic can grep for the identifier and find the code that uses it.
 */

import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { CITATIONS, UNVERIFIED, citation, type CitationId } from "@/data/citations";
import { CATALOG } from "@/data/catalog";
import { RATE_CELLS, assumptionCells, type Cell, type RateCellName } from "@/data/rates";

export const metadata: Metadata = {
  title: "Sources",
  description:
    "Every rate, fraction and crisis figure in Deadweight, with its source, its date, its confidence and the arithmetic performed on it — including the cells that are assumptions and the citations that could not be retrieved.",
};

const SECTION = "mx-auto w-full max-w-5xl px-5 sm:px-8";
const EYEBROW = "display text-xs uppercase tracking-[0.2em] text-meltwater";
const CELL_NAMES = Object.keys(RATE_CELLS) as RateCellName[];
const CITATION_IDS = Object.keys(CITATIONS) as CitationId[];

const RETRIEVAL_NOTE: Record<"primary" | "secondary" | "snippet", string> = {
  primary: "document fetched and read",
  secondary: "a named third party reports the figure from a study",
  snippet: "document could not be read — quote reached us second-hand",
};

/** The three kinds of cell, in the order of how much they can be trusted. */
const CATEGORIES: readonly {
  readonly term: string;
  readonly tone: string;
  readonly gloss: string;
}[] = [
  {
    term: "Quoted",
    tone: "text-paper",
    gloss: "the sentence the number came out of is printed underneath it.",
  },
  {
    term: "Derived",
    tone: "text-paper",
    gloss: "the arithmetic performed on the source is written out so you can repeat it.",
  },
  {
    term: "Assumption",
    tone: "text-crimson",
    gloss:
      "reasoned from guidance rather than taken from a source, and flagged as such everywhere it appears, including on the ledger line that uses it.",
  },
];

function range(cell: Cell): string {
  return cell.low === cell.high ? `${cell.low}` : `${cell.low}–${cell.high}`;
}

function RateRow({ name }: { name: RateCellName }) {
  const cell: Cell = RATE_CELLS[name];
  const source = citation(cell.source);

  return (
    <li className="py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="ledger text-sm text-paper">{name}</p>
        <p className="ledger shrink-0 text-sm text-sonar">
          {range(cell)} <span className="text-meltwater">{cell.unit}</span>
        </p>
      </div>
      <p className="ledger mt-1 text-xs text-meltwater">
        as of {cell.asOf} · {cell.confidence} confidence
        {cell.assumption ? (
          <span className="ml-2 border border-crimson/40 px-1 py-px text-2xs uppercase tracking-[0.16em] text-crimson">
            assumption
          </span>
        ) : null}
      </p>
      {cell.derivation ? (
        <p className="ledger mt-2 text-sm leading-relaxed text-paper/70">{cell.derivation}</p>
      ) : null}
      {cell.note ? (
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-meltwater">{cell.note}</p>
      ) : null}
      <p className="mt-2 text-xs text-meltwater">
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-sonar underline decoration-rule underline-offset-2 hover:decoration-sonar"
        >
          {source.title}
        </a>{" "}
        — {source.publisher}, {source.published}
        {source.retrieval === "snippet" ? (
          <span className="text-crimson/90"> · unverified</span>
        ) : null}
      </p>
      {source.quote ? (
        <p className="mt-1.5 max-w-3xl border-l border-rule pl-3 text-sm leading-relaxed text-paper/70">
          “{source.quote}”
        </p>
      ) : null}
    </li>
  );
}

export default function SourcesPage() {
  return (
    <>
      <main className="flex-1 pt-14 sm:pt-20">
        <header className={SECTION}>
          <p className={EYEBROW}>Deadweight · the whole table</p>
          <h1 className="mt-5 text-4xl leading-[1.05] sm:text-5xl">Show your work.</h1>
          <div className="mt-6 max-w-2xl space-y-4 text-sm leading-relaxed text-paper/85">
            <p>
              Nothing numeric exists in this codebase without an entry on this page. Each cell below
              is a range, not a point estimate, because the honest ranges are wide — a single air
              freight figure quoted to the cent would be a lie of precision, and sloppy arithmetic is
              the thing this project is about.
            </p>
            <p className="text-meltwater">
              Every cell falls into exactly one of three categories, and there is no fourth.
            </p>
            {/*
              A three-term taxonomy set as one paragraph made the reader find the
              terms inside the prose, which is backwards — the terms are the point
              and the sentences are the gloss. At 382px it was also four solid
              lines of grey with the category names buried mid-line. As a
              description list each term is a label again: stacked on a phone, and
              from `sm` up the glosses align down a single left edge so the three
              can be compared at a glance. `items-baseline` because the term is set
              a step down from the sentence beside it, and stretch alignment would
              leave the smaller one riding high.
            */}
            <dl className="space-y-3 border-l border-rule pl-4">
              {CATEGORIES.map((category) => (
                <div
                  key={category.term}
                  className="grid gap-x-4 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-baseline"
                >
                  <dt
                    className={`display text-2xs uppercase tracking-[0.16em] ${category.tone}`}
                  >
                    {category.term}
                  </dt>
                  <dd className="text-meltwater">{category.gloss}</dd>
                </div>
              ))}
            </dl>
            <p className="text-meltwater">
              The engine reads costs at the low end of each range and usefulness at the high end by
              default, so every verdict on the front page is the best case these sources permit.
              Rigging the numbers toward the argument would make the exercise worthless.
            </p>
          </div>
        </header>

        <section className={`${SECTION} mt-16`} aria-labelledby="rates">
          <h2 id="rates" className="display text-2xl uppercase tracking-[0.14em] text-paper">
            The rate table
          </h2>
          <p className="mt-2 text-sm text-meltwater">
            {CELL_NAMES.length} cells. Named as the engine names them, so you can grep for one and
            find the code that uses it.
          </p>
          <ul className="mt-4 divide-y divide-rule/60 border-y border-rule">
            {CELL_NAMES.map((name) => (
              <RateRow key={name} name={name} />
            ))}
          </ul>
        </section>

        <section className={`${SECTION} mt-16`} aria-labelledby="assumptions">
          <h2 id="assumptions" className="display text-2xl uppercase tracking-[0.14em] text-crimson">
            Every assumption, listed
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-meltwater">
            These cells are reasoned from humanitarian guidance rather than quoted from a published
            figure. They are the weakest part of the table and they are named here so nobody has to
            find them.
          </p>
          <ul className="ledger mt-4 space-y-1 text-sm text-paper/85">
            {assumptionCells().map((name) => (
              <li key={name}>
                {name} <span className="text-meltwater">· {range(RATE_CELLS[name])}</span>{" "}
                <span className="text-meltwater">{RATE_CELLS[name].unit}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-meltwater">
            In-region replacement prices for every catalogue item are assumptions too — the UNICEF
            Supply Catalogue publishes no relief-item unit prices we could read. That is why valuing
            the usable share at local prices is off by default on the front page: the headline
            verdict is kept to sourced figures only.
          </p>
        </section>

        <section className={`${SECTION} mt-16`} aria-labelledby="unverified">
          <h2 id="unverified" className="display text-2xl uppercase tracking-[0.14em] text-paper">
            Sources we could not read
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-meltwater">
            {UNVERIFIED.length} of {CITATION_IDS.length} citations quote text we could not read in
            the document itself — mostly because the host returned 403 to automated retrieval, and in
            one case because the paper is paywalled and the passage reached us second-hand. The quote
            is real either way; we have not seen it in context. Anywhere one of these decides a
            ledger line, the line says so.
          </p>
          <ul className="mt-4 space-y-3">
            {UNVERIFIED.map((id) => (
              <li key={id} className="border-l border-crimson/40 pl-3">
                <a
                  href={citation(id).url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sm text-sonar underline decoration-rule underline-offset-2 hover:decoration-sonar"
                >
                  {citation(id).title}
                </a>
                <p className="ledger text-xs text-meltwater">
                  {citation(id).publisher}, {citation(id).published} · {id}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${SECTION} mt-16`} aria-labelledby="catalogue">
          <h2 id="catalogue" className="display text-2xl uppercase tracking-[0.14em] text-paper">
            The catalogue
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-meltwater">
            Declared value is what a donor in a high-income country would say the item is worth —
            retail, or the replacement cost of a used item. Weight is what decides the freight bill,
            and weight is what decides most verdicts.
          </p>
          <ul className="mt-4 divide-y divide-rule/60 border-y border-rule">
            {CATALOG.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-6 py-3">
                <div className="min-w-[12rem] flex-1">
                  <p className="text-sm text-paper/90">
                    {item.label}
                    {item.prohibited ? (
                      <span className="ml-2 text-2xs uppercase tracking-[0.16em] text-crimson">
                        do not send
                      </span>
                    ) : null}
                  </p>
                  <p className="ledger text-xs text-meltwater">
                    {item.id} · {item.itemClass}
                  </p>
                </div>
                <p className="ledger shrink-0 text-sm text-paper/80">
                  {item.unitWeightKg} kg · ${item.declaredUsd.toFixed(2)}
                  <span className="text-meltwater"> / {item.unit}</span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className={`${SECTION} mt-16`} aria-labelledby="registry">
          <h2 id="registry" className="display text-2xl uppercase tracking-[0.14em] text-paper">
            Every citation
          </h2>
          <ul className="mt-4 space-y-4">
            {CITATION_IDS.map((id) => {
              const source = citation(id);
              return (
                <li key={id} className="border-l border-rule pl-3">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sm text-sonar underline decoration-rule underline-offset-2 hover:decoration-sonar"
                  >
                    {source.title}
                  </a>
                  <p className="ledger text-xs text-meltwater">
                    {source.publisher}, {source.published} ·{" "}
                    <span className={source.retrieval === "snippet" ? "text-crimson/90" : undefined}>
                      {RETRIEVAL_NOTE[source.retrieval]}
                    </span>
                  </p>
                  {source.quote ? (
                    <p className="mt-1 max-w-3xl text-sm leading-relaxed text-paper/70">
                      “{source.quote}”
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <p className={`${SECTION} mt-16 max-w-3xl text-sm leading-relaxed text-meltwater`}>
          Found an error? That is the point of printing this. The figures move, the guidance is
          revised, and a rate table published in September 2026 will be wrong by next year — the
          dates are on every cell so you can see how stale a number is before you trust it.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
