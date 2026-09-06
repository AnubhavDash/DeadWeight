/**
 * The rule between a label and its figure.
 *
 * Every label→figure row on this site is label-left, figure-right, which means
 * the space between them is decided by how long the label happens to be.
 * Measured in the 432px right rail before this existed: 129px of nothing after
 * `not needed or not appropriate`, 312px after `disposal`. Seven rows, seven
 * different voids, and the eye reads that as nothing lining up even though every
 * figure is flush right. The notary's cards were worse — 192px to 322px inside a
 * 451px row. A leader is what a printed ledger puts there. It costs one pixel of
 * `--rule` and it ties each label to its own number instead of asking the reader
 * to trace across the gap.
 *
 * `aria-hidden`, because it is a ruled line and not content: a screen reader gets
 * the label and the figure with nothing between them, which is the reading the
 * leader exists to reproduce for everyone else.
 *
 * It runs at every width, the phone included. That was worth measuring rather
 * than assuming: at 382px the front page's seven ledger rows still leave between
 * 39px and 222px empty, so the void is not a desktop luxury and gating the rule
 * at `sm` would have left the narrowest column with the worst version of the
 * problem. `min-w-2` is the floor — under about eight pixels a rule reads as a
 * dash.
 *
 * Its own file rather than a second export from `ledger-table.tsx`, so that
 * importing it into `/notary` does not drag the citations registry and the whole
 * ledger into that page's bundle for the sake of one span.
 *
 * Belongs in a row that is `flex items-baseline`, between the label and a figure
 * marked `shrink-0`: a zero-height span aligns its bottom margin edge to the
 * text baseline, which is exactly where a leader goes.
 */
export function Leader() {
  return <span aria-hidden="true" className="h-px min-w-2 flex-1 bg-rule/70" />;
}
