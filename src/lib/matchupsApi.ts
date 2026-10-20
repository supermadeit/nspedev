// Static, precomputed matchup files (owner ask, 2026-10-26 — the live
// GET /matchup/{sport}/{a}/{b} click-through kept failing: NFL's version
// walks play-by-play per request and 504s behind the proxy after ~30s, NBA
// is slow enough (7-8s) to feel broken). Confirmed live 2026-10-19 (deploy
// 4c31c53) — curled real files for both NHL (has `starters`) and NFL
// (`starters: null`, confirming the null-safety) before wiring this up.
//
// One file per slate game, regenerated daily (same-day NHL/NBA/MLB files
// also refresh every 30 min as the starters feed updates). A 404 means the
// game isn't on a precomputed slate (not today/this week, or off the beaten
// path) — callers should fall back to the old live /matchup route for that
// one game, not treat it as a real error.
import {
  type MatchupInsightPayload,
  type MatchupTeamRecord,
  extractMatchupInsightPayload,
} from '@/lib/nspe-payloads'
import { API_BASE_CANDIDATES, joinUrl } from '@/lib/nspe-api'

export interface MatchupAllowsHighlight {
  key: string
  label: string
  pct: number
  count: number
  games: number
  rank: number
  of: number
  text: string
}

export interface MatchupStarterNote {
  text: string
  source: string
  source_url: string
}

export interface MatchupStarterInfo {
  goalie: string
  goalie_key: string
  status: 'unconfirmed' | 'likely' | 'confirmed'
  as_of: string
  opponent: string
  home: boolean
  game_id: string
  note?: MatchupStarterNote | null
}

// Extends the existing live-/matchup payload shape (engine/query/
// team_record/meetings/team_a/team_b) with the new precomputed blocks.
// team_a = away, team_b = home (same convention the live route already
// uses when called as /matchup/{AWAY}/{HOME} — confirmed by backend).
export interface MatchupGameFile extends MatchupInsightPayload {
  away: string
  home: string
  date: string
  generated_at: string
  summary: { team_a: string; team_b: string }
  allows_highlight: { team_a: MatchupAllowsHighlight | null; team_b: MatchupAllowsHighlight | null }
  // NHL only — absent/null on every other sport's file.
  starters?: Record<string, MatchupStarterInfo> | null
}

export class MatchupNotFoundError extends Error {
  constructor() {
    super('No precomputed matchup file for this game.')
  }
}

function isMatchupGameFile(v: unknown): v is MatchupGameFile {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return (
    typeof r.away === 'string' &&
    typeof r.home === 'string' &&
    !!r.summary &&
    typeof r.summary === 'object' &&
    !!extractMatchupInsightPayload(v)
  )
}

/** One precomputed matchup file. Throws MatchupNotFoundError on a 404 (not
 * on the precomputed slate — callers fall back to the live /matchup route),
 * a plain Error otherwise. */
export async function fetchMatchupGame(sport: string, dateIso: string, away: string, home: string): Promise<MatchupGameFile> {
  const urls = API_BASE_CANDIDATES.map((base) =>
    joinUrl(base, `/matchups/${sport}/${dateIso}/${away.toUpperCase()}/${home.toUpperCase()}`),
  )
  let lastErr: unknown = null
  let sawNotFound = false
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (res.status === 404) { sawNotFound = true; continue }
      if (!res.ok) { lastErr = new Error(`${url} -> HTTP ${res.status}`); continue }
      const data: unknown = await res.json()
      const extracted = extractMatchupInsightPayload(data)
      if (extracted && isMatchupGameFile(data)) return data as MatchupGameFile
      lastErr = new Error('Unrecognized matchup-file response shape.')
    } catch (err) {
      lastErr = err
    }
  }
  if (sawNotFound && !lastErr) throw new MatchupNotFoundError()
  throw lastErr ?? new MatchupNotFoundError()
}

export type { MatchupTeamRecord }
