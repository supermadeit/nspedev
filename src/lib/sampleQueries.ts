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

  return out
}
