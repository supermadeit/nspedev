// Generates the "sample-queries" list shown on both desktop and mobile from
// the SAME curated tables that drive the mobile calculator's auto-default
// pre-fill (curatedDefaults.ts) — not a hand-duplicated list. That way the
// sample list can never drift from the actual pre-fill values: tune a
// threshold in curatedDefaults.ts and this list picks it up automatically,
// which is the whole point (cross-checking curated values against real
// command output). Lives in src/lib (not mobile-calculator/) since it's
// shared cross-platform, same rationale as nspe-api.ts/nspe-payloads.ts.
//
// Command-building logic here mirrors useCalculatorQuery.ts's `builtCommand`
// exactly, restricted to the shapes curated data can produce.
import {
  CURATED_COMPUTE_DEFAULTS,
  CURATED_EXPLOSIVE_TREND_DEFAULTS,
  CURATED_TEAM_COMPUTE_DEFAULTS,
  CURATED_TREND_DEFAULTS,
} from '@/mobile-calculator/state/curatedDefaults'

export interface SampleQuery {
  /** Short scannable label, e.g. "nba trend · pts (1h)". */
  label: string
  command: string
}

function parseTrendKey(sport: string, key: string): { stat: string; period?: '1h' } {
  if (sport === 'nba') {
    const m = key.match(/^(.+)_1h$/)
    if (m) return { stat: m[1], period: '1h' }
  }
  return { stat: key }
}

function parseNflTrendKey(key: string): { stat: string; nflStatType: 'yds' | 'td' | 'total' } | null {
  const m = key.match(/^(.+)_(yds|td|total)$/)
  return m ? { stat: m[1], nflStatType: m[2] as 'yds' | 'td' | 'total' } : null
}

function windowSuffix(window: '-last' | '-season', windowN?: number): string {
  return window === '-season' ? '-season' : `-last${windowN}`
}

export function buildSampleQueries(): SampleQuery[] {
  const out: SampleQuery[] = []

  // NFL 1st-half passing — unshifted to the very front so it wins the
  // "first suggestion for a bare nspe" slot once promoteMoatCommands sorts
  // nfl/mlb ahead of everything else (see below): it's both season-relevant
  // (nfl) and moat-tagged (1h), same as nba's pts_1h below, but nfl/mlb are
  // what's actually in season right now. Not derived from
  // CURATED_TREND_DEFAULTS.nfl like the full-game nfl entries below — that
  // table's per-key parsing (parseNflTrendKey) has no period dimension, and
  // adding one there for a single entry isn't worth the generalization.
  // Threshold is roughly half a full game's 240yd pass default, window
  // pinned to -last1/1 for the same season-start reason as everything else
  // NFL right now.
  out.push({ label: 'nfl trend · pass (1h)', command: 'nspe nfl 1h pass -yds120 -last1/1' })

  for (const [sport, stats] of Object.entries(CURATED_TREND_DEFAULTS)) {
    for (const [key, [threshold, met, last]] of Object.entries(stats)) {
      if (sport === 'nfl') {
        const parsed = parseNflTrendKey(key)
        if (!parsed) continue
        out.push({
          label: `nfl trend · ${parsed.stat} -${parsed.nflStatType}`,
          command: `nspe nfl ${parsed.stat} -${parsed.nflStatType}${threshold} -last${met}/${last}`,
        })
        continue
      }
      const { stat, period } = parseTrendKey(sport, key)
      const parts = ['nspe', sport]
      if (period === '1h') parts.push('1h')
      parts.push(`-${stat}${threshold}`, `-last${met}/${last}`)
      out.push({
        label: `${sport} trend · ${stat}${period ? ` (${period})` : ''}`,
        command: parts.join(' '),
      })
    }
  }

  for (const [sport, stats] of Object.entries(CURATED_COMPUTE_DEFAULTS)) {
    for (const [stat, { min, window, windowN }] of Object.entries(stats)) {
      out.push({
        label: `${sport} compute · ${stat}`,
        command: `nspe ${sport} -${stat} min${min} ${windowSuffix(window, windowN)}`,
      })
    }
  }

  // NFL compute, pinned to -last1 (season just started — a wider -lastN or
  // -season window doesn't have enough games behind it yet, and -last1
  // keeps auto-tracking the most recent game as the season progresses,
  // unlike a -first1 pin which would stay stuck on week 1 forever). Kept as
  // manual entries rather than folded into CURATED_COMPUTE_DEFAULTS/
  // windowSuffix() above since NFL's compute shape (bare category word +
  // "-yds" flag) differs from that loop's "-stat" flag shape. Revisit the
  // window size once NFL has enough games for a wider one to make sense.
  out.push(
    { label: 'nfl compute · pass_yds', command: 'nspe nfl pass -yds min300 -last1' },
    { label: 'nfl compute · rush_yds', command: 'nspe nfl rush -yds min100 -last1' },
  )

  for (const [league, plays] of Object.entries(CURATED_EXPLOSIVE_TREND_DEFAULTS)) {
    for (const [playType, [threshold, met, last]] of Object.entries(plays)) {
      const command =
        league === 'mlb'
          ? `nspe mlb long -hr${threshold} -last${met}/${last}`
          : `nspe nfl long ${playType} -yds${threshold} -last${met}/${last}`
      out.push({ label: `${league} explosive · ${playType}`, command })
    }
  }

  for (const [teamStat, { min, window, windowN }] of Object.entries(CURATED_TEAM_COMPUTE_DEFAULTS)) {
    out.push({
      label: `mlb team compute · ${teamStat}`,
      command: `nspe mlb team -${teamStat} min${min} ${windowSuffix(window, windowN)}`,
    })
  }

  // MLB first plate appearance — no threshold N behind the category flag
  // (batters only get one first PA per game, so there's nothing to
  // threshold), unlike every other trend command here.
  out.push({ label: 'mlb first pa · hit', command: 'nspe mlb first -hit -last1/1' })

  // NFL combo flags (-pr = pass+rush, -rr = rush+rec) — bare flags with no
  // category word in front, unlike -yds/-td which need "pass"/"rush"/"rec"
  // first (see nflComboCode in QueryBuilder.tsx). Thresholds match
  // NFL_COMBO_DEFAULT there so the sample and the builder's own default
  // never drift apart.
  out.push(
    { label: 'nfl trend · pass+rush (-pr)', command: 'nspe nfl -pr250 -last1/1' },
    { label: 'nfl trend · rush+rec (-rr)', command: 'nspe nfl -rr80 -last1/1' },
    { label: 'nfl compute · pass+rush (-pr)', command: 'nspe nfl -pr min250 -last1' },
    { label: 'nfl compute · rush+rec (-rr)', command: 'nspe nfl -rr min80 -last1' },
  )

  // -ov (single-player explosive-play overview, the new bar-chart engine) —
  // confirmed working command shape from the conversation that shipped it.
  // Not derived from curatedDefaults.ts like everything else above since -ov
  // takes a player name, not a stat/threshold — nothing to curate per sport,
  // just the one example.
  out.push({ label: 'nfl explosive · overview (-ov)', command: 'nspe nfl long lamar jackson -ov' })

  return promoteMoatCommands(out)
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
// other sport — it's currently NFL/MLB season, NBA/NHL aren't, and without
// this a bare "nspe" query surfaced an NBA-heavy top-8 almost by accident
// (CURATED_TREND_DEFAULTS just happens to define nba's table first). This
// is a soft, temporary priority, not a hard exclusion: NBA/NHL entries still
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
