/**
 * The ledger, rendered. Pure presentation: it receives a `PricedManifest` and
 * displays it. Every line that came from a rate cell carries a `<details>` with
 * the source, the date, the arithmetic and — where the publisher blocked
 * automated retrieval — the admission that the figure came from a search
 * snippet. Native disclosure elements, so this works with JavaScript throttled
 * and with no WebGL at all.
 */

import { citation, citationLabel, type CitationId } from "@/data/citations";
import type { Cell } from "@/data/rates";
import { VERDICT_LABEL, type LedgerLine, type PricedManifest } from "@/lib/logistics";
import { formatPercent, formatUsd } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Leader } from "@/components/leader";

function CellNote({ cell, assumption }: { cell?: Cell; assumption?: boolean }) {
  if (!cell) return null;
  const source = citation(cell.source);
  const flagged = assumption ?? cell.assumption === true;

  return (
    <details className="group mt-1.5">
      {/* A thumb below `lg`, a cursor above it. The 13px label renders in a 19px
          line box, which is under the 24px target floor — but there are seven of
          these in the ledger, and paying 13px each on the desktop rail would add
          ~90px to a table that has to stay inside a laptop viewport while it is
          sticky. The floor only matters where the tapping happens. */}
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 text-2xs uppercase tracking-[0.16em] text-meltwater transition-colors hover:text-sonar lg:min-h-0">
        <span className="group-open:hidden">source</span>
        <span className="hidden group-open:inline">hide</span>
        {flagged ? (
          <span className="border border-crimson/40 px-1 py-px text-crimson">assumption</span>
        ) : null}
      </summary>
      <div className="mt-2 space-y-1.5 border-l border-rule pl-3 text-sm leading-relaxed text-meltwater">
        <p>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sonar underline decoration-rule underline-offset-2 hover:decoration-sonar"
          >
            {source.title}
          </a>{" "}
          — {source.publisher}, {source.published}
        </p>
        <p className="ledger text-xs">
          {cell.low === cell.high ? cell.low : `${cell.low}–${cell.high}`} {cell.unit} · as of{" "}
          {cell.asOf} · {cell.confidence} confidence
        </p>
        {cell.derivation ? <p className="ledger text-xs">{cell.derivation}</p> : null}
        {source.quote ? <p className="text-paper/70">“{source.quote}”</p> : null}
        {cell.note ? <p>{cell.note}</p> : null}
        {source.retrieval === "snippet" ? (
          <p className="text-crimson/90">
            Quoted from a search result: this publisher blocks automated retrieval, so the full text
            was not read. Listed as unverified on the sources page.
          </p>
        ) : null}
      </div>
    </details>
  );
}

function Row({ line }: { line: LedgerLine }) {
  const total = line.kind === "total";
  const heading = line.kind === "declared" || total;

  return (
    <li className={cn("py-3", total && "hairline mt-1 pt-4")}>
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            heading
              ? "display text-sm uppercase tracking-[0.18em] text-paper"
              : "text-sm text-paper/85",
          )}
        >
          {line.label}
        </span>
        {/*
          No leader on the total, which is both the convention and a measured
          necessity. A printed ledger rules a total off above and leaves the line
          itself clear — the `hairline` does that job here — and dot-leading the
          biggest figure on the page only adds noise to it. The measurement: at
          382px `NET VALUE DELIVERED` against a `text-xl` figure has about 210px
          for a label that wants 211, so reserving even the leader's 8px floor
          breaks the longest label in the ledger across two lines. Every row above
          the hairline has slack to spare; this one has none.
        */}
        {total ? null : <Leader />}
        <span
          className={cn(
            "ledger ml-auto shrink-0 tabular-nums",
            total ? "text-xl" : "text-sm",
            line.amount < 0 ? "text-crimson" : "text-paper",
          )}
        >
          {formatUsd(line.amount)}
        </span>
      </div>
      {line.detail ? (
        <p className="ledger mt-1 text-sm leading-relaxed text-meltwater">{line.detail}</p>
      ) : null}
      <CellNote cell={line.cell} assumption={line.assumption} />
    </li>
  );
}

/**
 * One verdict, one colour, wherever it is printed. The border class is inert on
 * anything that does not set a border width, which is what lets `<VerdictDock />`
 * reuse this map for a bare span instead of keeping a second copy.
 */
export const VERDICT_TONE: Record<string, string> = {
  LANDS: "text-sonar border-sonar/40",
  BURDENS: "text-paper border-rule",
  BECOMES_ASH: "text-crimson border-crimson/40",
};

export function LedgerTable({ result }: { result: PricedManifest }) {
  const empty = result.declared === 0;

  return (
    <section aria-label="Delivered value ledger" className="w-full">
      {result.prohibitions.map((notice) => (
        <div
          key={notice.itemId}
          className="mb-5 border border-crimson/40 bg-crimson/5 p-4 text-sm leading-relaxed text-paper/90"
        >
          <p className="display mb-2 text-xs uppercase tracking-[0.18em] text-crimson">
            do not send · {notice.label}
          </p>
          <p>{notice.reason}</p>
          <p className="mt-2 text-xs text-meltwater">
            {notice.sources.map((id, index) => (
              <span key={id}>
                {index > 0 ? " · " : ""}
                <a
                  href={citation(id as CitationId).url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline decoration-rule underline-offset-2 hover:text-sonar"
                >
                  {citationLabel(id as CitationId)}
                </a>
              </span>
            ))}
          </p>
        </div>
      ))}

      <ul className="divide-y divide-rule/60">
        {result.lines.map((line) => (
          <Row key={line.id} line={line} />
        ))}
      </ul>

      {empty ? (
        <p className="mt-6 text-sm text-meltwater">
          Nothing on the manifest yet. Add an item and every line above is priced from the sources.
        </p>
      ) : (
        <div className="mt-6 space-y-5">
          <div
            className={cn(
              "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border px-4 py-3",
              VERDICT_TONE[result.verdict],
            )}
          >
            <span className="display text-2xl uppercase tracking-[0.1em]">
              {VERDICT_LABEL[result.verdict]}
            </span>
            <span className="ledger text-xs text-meltwater">
              {formatPercent(result.efficiency)} of declared value delivered
            </span>
          </div>

          <p className="text-sm leading-relaxed text-meltwater">
            Priced three times from the same table. Kindest reading{" "}
            <span className="ledger text-paper/80">{formatUsd(result.band.high)}</span>, harshest{" "}
            <span className="ledger text-paper/80">{formatUsd(result.band.low)}</span>.{" "}
            {result.verdictStable
              ? "The verdict holds across that whole range."
              : `The verdict does not hold: ${VERDICT_LABEL[result.verdictHigh]} at best, ${VERDICT_LABEL[result.verdictLow]} at worst. Which one is true depends on the freight rate this consignment actually gets and on whether anyone collects it.`}
          </p>

          <div className="hairline space-y-1 pt-4">
            <p className="text-sm leading-relaxed text-paper/85">
              The same {formatUsd(result.declared)} given as cash:{" "}
              <span className="ledger text-sonar">{formatUsd(result.cash.delivered)}</span> reaching
              affected people
              {result.cash.multiple === null
                ? ". This consignment delivers nothing to compare it against."
                : result.cash.multiple >= 1
                  ? ` — ${result.cash.multiple.toFixed(1)}× what this consignment delivers.`
                  : " — less than this consignment delivers. Sending these goods is the better call."}
            </p>
            <CellNote cell={result.cash.cell} />
          </div>

          <div className="space-y-1">
            <p className="text-sm leading-relaxed text-paper/85">
              Handling these goods consumes the response&rsquo;s own budget for{" "}
              <span className="ledger text-crimson">
                {result.displacement.personShares.toFixed(1)}
              </span>{" "}
              people.
            </p>
            <CellNote cell={result.displacement.cell} />
          </div>

          {result.usesAssumptions ? (
            <p className="text-sm leading-relaxed text-meltwater">
              Lines tagged <span className="text-crimson">assumption</span> are reasoned from
              guidance rather than quoted from a source. They are marked everywhere they appear, and
              the sources page lists every one of them.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
