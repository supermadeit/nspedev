// {vs.goalie} — NHL skater-vs-goalie top10 ranking tool. Backend confirmed
// live 2026-10-27 (nspe-v2-da): career-to-date data (not season-to-date like
// the older single-pairing nhl-vs-goalie-pairing engine in nspe-payloads.ts),
// signed-in + Pro gated on all three routes. Shapes below are copied
// verbatim from real TestClient samples backend pulled against the live
// route handlers, not guessed from the prose description that came first.
import { authHeader } from '@/lib/auth-token'
import { API_BASE_CANDIDATES, joinUrl } from '@/lib/nspe-api'

export type VsGoalieSort = 'pts' | 'g' | 'sog'

export interface VsGoalieListing {
  key: string
  name: string
  team: string
}

export interface VsGoalieGoaliesResult {
  count: number
  goalies: VsGoalieListing[]
}

export interface VsGoalieRow {
  name: string
  team: string
  gp: number
  g: number
  a: number
  pts: number
  sog: number
  pts_per_gm: number
}

export interface VsGoalieRankResult {
  direction: 'skaters_vs_goalie' | 'goalies_vs_skater'
  // Name only — no team field for the subject itself (confirmed live), only
  // each row in `rows` carries a team.
  subject: string
  sort: string
  min_gp: number
  top: number
  count: number
  // Present on goalies_vs_skater today; skaters_vs_goalie doesn't have a
  // pre-slice total yet (asked backend to add it for parity — may or may
  // not be there depending on when this ships).
  total?: number
  rows: VsGoalieRow[]
}

export interface VsGoalieGameRow {
  date: string
  opponent: string
  season_type: string
  // One packed string, e.g. "L3-2"/"W4-1" — the SKATER's team result, not
  // split into separate scores.
  result: string
  G: number
  A: number
  PTS: number
  SOG: number
  // decision is the GOALIE's own W/L/OTL for that game, independent of the
  // skater's team result string above — easy to misread as the same thing.
  goalie: { started: boolean; decision: string; saves: number; shots_against: number; goals_against: number }
}

export interface VsGoalieGamesSummary {
  GP: number
  G: number
  A: number
  PTS: number
  SOG: number
  multi_goal_games: number
  goal_games: number
  two_point_games: number
  blank_games: number
  no_shot_games: number
  started: number
}

export interface VsGoalieGamesResult {
  skater: string
  goalie: string
  goalie_team: string
  games: VsGoalieGameRow[]
  summary: VsGoalieGamesSummary
}

// Gate confirmed live 2026-10-27 (nspe-v2-da) — the gate itself is OFF
// until ~10/25 (owner's team.metrics timeline), so any signed-in user gets
// real data until then, but the 402 shape below is the real contract to
// build against now rather than retrofit later:
//   signed out            -> plain 401, no useful JSON body ("sign in")
//   signed in, non-Pro     -> 402 {"detail": {"message": "...", "unlock": "pro"}}
export class VsGoalieError extends Error {
  status: number
  unlock?: string
  constructor(status: number, message: string, unlock?: string) {
    super(message)
    this.status = status
    this.unlock = unlock
  }
}

async function getVsGoalie<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, qs ? `${path}?${qs}` : path))
  let lastError: { status: number; message: string; unlock?: string } | null = null
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { ...authHeader() } })
      if (res.ok) return (await res.json()) as T
      const parsed = await res.json().catch(() => null)
      const detail = parsed?.detail
      const message = typeof detail === 'string' ? detail : detail?.message || `HTTP ${res.status}`
      const unlock = detail && typeof detail === 'object' ? detail.unlock : undefined
      lastError = { status: res.status, message, unlock }
    } catch (err) {
      lastError = { status: 0, message: err instanceof Error ? err.message : 'Network error' }
    }
  }
  throw new VsGoalieError(lastError?.status ?? 0, lastError?.message ?? 'Something went wrong.', lastError?.unlock)
}

/** The full selectable-goalie picker list — structurally excludes retired
 * goalies (the underlying scrape only ever captured currently-rostered
 * ones), so no "retired goalies aren't offered" caveat needs printing. */
export function fetchVsGoalieGoalies(): Promise<VsGoalieGoaliesResult> {
  return getVsGoalie<VsGoalieGoaliesResult>('/nhl/vs-goalie/goalies', {})
}

export function fetchVsGoalieRankForGoalie(
  goalieKey: string,
  sort: VsGoalieSort,
  top: number,
  minGp: number,
): Promise<VsGoalieRankResult> {
  return getVsGoalie<VsGoalieRankResult>('/nhl/vs-goalie/rank', { goalie: goalieKey, sort, top, min_gp: minGp })
}

export function fetchVsGoalieRankForSkater(
  skaterQuery: string,
  sort: VsGoalieSort,
  top: number,
  minGp: number,
): Promise<VsGoalieRankResult> {
  return getVsGoalie<VsGoalieRankResult>('/nhl/vs-goalie/rank', { skater: skaterQuery, sort, top, min_gp: minGp })
}

export function fetchVsGoalieGames(skaterQuery: string, goalieKey: string): Promise<VsGoalieGamesResult> {
  return getVsGoalie<VsGoalieGamesResult>('/nhl/vs-goalie/games', { skater: skaterQuery, goalie: goalieKey })
}
