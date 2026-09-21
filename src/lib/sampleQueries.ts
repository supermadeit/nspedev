// {sample-queries} and predictive syntax text both read from
// predictiveCommands.ts (the hand-curated catalog) via buildSampleQueries()
// below — this file now just applies the moat/season reordering on top of
// that catalog. See predictiveCommands.ts for the actual command list and
// why it isn't derived from curatedDefaults.ts (the mobile calculator's own
// auto-default table, unrelated and untouched).
import { PREDICTIVE_COMMANDS } from './predictiveCommands'

export type { SampleQuery } from './predictiveCommands'
import type { SampleQuery } from './predictiveCommands'

// Where 'middle'-placed entries land: the middle of the predictive dropdown's
// 50-row cap (see searchSyntax's limit), so they're visible on a broad query
// like bare "nspe" but never the first thing shown.
const MIDDLE_INDEX = 25

export function buildSampleQueries(): SampleQuery[] {
  const ordered = promoteMoatCommands(PREDICTIVE_COMMANDS.filter((q) => q.placement !== 'middle'))
  const middle = PREDICTIVE_COMMANDS.filter((q) => q.placement === 'middle')
  ordered.splice(Math.min(MIDDLE_INDEX, ordered.length), 0, ...middle)
  return ordered
}

// -ov, -long, q1/1h scope, etc. are the differentiated commands meant to be
// the product's moat — surfaced first so they show up inside the predictive
// dropdown's capped result count even on a broad/early query like the bare
// "nspe" prefix, rather than being crowded out by however many plain trend
// entries happen to exist. Reorders, doesn't filter — nothing is hidden, a
// specific enough query (e.g. "mlb -hits") still finds the traditional
// commands via prefix match regardless of this ordering.
//
// Within each of those two buckets, NFL/MLB additionally rank ahead of every
// other sport — it's currently NFL/MLB season, NBA/NHL aren't. This is a
// soft, temporary priority, not a hard exclusion: NBA/NHL entries still
// appear, just lower in the list — a specific enough query still finds them
// via prefix match regardless of this ordering, same as the moat/rest split
// above. Revisit once more than one sport is actually in season.
function seasonPriority(command: string): number {
  return /^nspe (nfl|mlb)\b/i.test(command) ? 0 : 1
}

// Stable sort by seasonPriority alone — Array.prototype.sort is spec-stable
// in modern JS, but spelling out the index tiebreaker keeps that guarantee
// explicit rather than implicit, since preserving each bucket's original
// relative order (not just "nfl/mlb somewhere near the top") is the whole
// point here.
function bySeasonPriority(queries: SampleQuery[]): SampleQuery[] {
  return queries
    .map((q, i) => ({ q, i }))
    .sort((a, b) => seasonPriority(a.q.command) - seasonPriority(b.q.command) || a.i - b.i)
    .map(({ q }) => q)
}

function promoteMoatCommands(queries: SampleQuery[]): SampleQuery[] {
  const isMoat = (q: SampleQuery) => /-ov\b|\blong\b|\b1h\b|\bq1\b/i.test(q.command)
  const moat = bySeasonPriority(queries.filter(isMoat))
  const rest = bySeasonPriority(queries.filter((q) => !isMoat(q)))
  return [...moat, ...rest]
}
