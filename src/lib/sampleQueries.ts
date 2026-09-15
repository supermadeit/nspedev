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
function promoteMoatCommands(queries: SampleQuery[]): SampleQuery[] {
  const isMoat = (q: SampleQuery) => /-ov\b|\blong\b|\b1h\b|\bq1\b/i.test(q.command)
  const moat = queries.filter(isMoat)
  const rest = queries.filter((q) => !isMoat(q))
  return [...moat, ...rest]
}
