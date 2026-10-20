// {sap.zilla} — POST /lab. A pure historical-count backtest tool: "how often
// has this actually happened," nothing about price (contract confirmed
// live 2026-10-19, see nspe-v2-da). Two modes share this one endpoint:
// typed legs (free, no auth) and a screenshot of a slip (signed in, costs a
// free-question or a credit — the model reads legs out of the image).
import { authHeader } from '@/lib/auth-token'
import { API_BASE_CANDIDATES, joinUrl } from '@/lib/nspe-api'

export interface LabOptions {
  since?: number
  post?: boolean
  season?: boolean
}

export interface LabSplit {
  hits: number
  n: number
}

// A league-wide leg's unit is a PLAYER-GAME population, not a single
// player's history — confirmed live 2026-10-26 (deploy abe7462). The owner
// wants both rates shown/toggleable: the headline player-game rate (top-
// level hits/n/pct on the leg itself) and a per-GAME view using
// at_least_one_complete/both_sides (both measured over complete_games —
// the games where both sides' data is on file).
export interface LabLeagueTopPlayer {
  player: string
  hits: number
  n: number
  pct: number
}

export interface LabLeagueView {
  unit: string
  games: {
    games_on_file: number
    at_least_one: LabSplit
    complete_games: number
    at_least_one_complete: LabSplit
    both_sides: LabSplit
  }
  by_season: Record<string, LabSplit>
  // Top 5 max, each clearing a minimum games-played floor server-side.
  top: LabLeagueTopPlayer[]
  // A count on this payload, not a list (confirmed live) — how many
  // distinct players fed the population.
  players: number
  // Print verbatim on the card — the same "current players only" caveat
  // every other history-window number on this site carries.
  note: string
}

export interface LabLeg {
  text: string
  league: string
  kind: 'player' | 'team' | 'league'
  player: string | null
  team: string | null
  line: string
  hits: number
  n: number
  pct: number
  // Opponent/venue filtering ("vs TEAM" = every meeting, "@TEAM" = only
  // games at that team) and the season/last-10 breakdown — confirmed live
  // 2026-10-19, see nspe-v2-da. opponent/venue are null when the leg didn't
  // use either suffix; splits is always present on player/team legs, an
  // empty object on league legs (confirmed live — no per-player splits
  // concept for a population rate).
  opponent?: string | null
  venue?: string | null
  splits?: { season?: LabSplit; last10?: LabSplit }
  // League-wide legs only (kind === 'league') — confirmed live 2026-10-26.
  league_view?: LabLeagueView
}

export interface LabCluster {
  legs: number[]
  shared_games: number
  hits: number
  pct: number
  method: 'single' | 'measured' | 'independent' | 'mixed'
}

export interface LabJoint {
  // null when every leg is a league leg, or the only legs present can't
  // joint-measure (confirmed live) — a population rate "is not an event on
  // a slip," so it never enters the together line.
  pct: number | null
  method: 'single' | 'measured' | 'independent' | 'mixed' | 'none'
  independent_pct: number | null
  clusters: LabCluster[]
}

export interface LabError {
  leg: string
  error: string
}

export interface LabCard {
  headline: string
  lines: string[]
  together: string
  window: string
}

export interface LabResult {
  ok: boolean
  window: string
  since: number
  post: boolean
  season: boolean
  legs: LabLeg[]
  joint: LabJoint
  errors: LabError[]
  card: LabCard
}

export interface LabImageResult extends LabResult {
  read_from_image: { legs: string[]; unreadable: string[] }
  quota: { kind: 'free'; remaining: number; limit: number } | { kind: 'credits'; remaining: number }
  credits_charged: number
}

// GET /lab/lines — the live picker catalog (stats/defaults/scopes per
// league, NFL team lines, grammar cheat sheet, global options). Confirmed
// live 2026-10-19 (deploy ef0519a); this is the source of truth the picker
// should build from instead of a hardcoded list, same "render from backend
// so it can't drift" pattern as /plans.
export interface LabLineScope {
  key: string
  label: string
}

export interface LabLineStat {
  key: string
  label: string
  default: number
  scopes: LabLineScope[] | null
}

export interface LabLinesCatalog {
  leagues: Record<string, LabLineStat[]>
  team_lines: Record<string, LabLineStat[]>
  team_lines_pending: Record<string, string[]>
  grammar: { player: string; team: string; opponent: string }
  options: { since: number; post: boolean; season: boolean; max_legs: number }
}

export class LabError_ extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function postLab<T>(body: Record<string, unknown>): Promise<T> {
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, '/lab'))
  let lastError: { status: number; message: string } | null = null
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(body),
      })
      if (res.ok) return (await res.json()) as T
      const parsed = await res.json().catch(() => null)
      lastError = { status: res.status, message: parsed?.detail || `HTTP ${res.status}` }
    } catch (err) {
      lastError = { status: 0, message: err instanceof Error ? err.message : 'Network error' }
    }
  }
  throw new LabError_(lastError?.status ?? 0, lastError?.message ?? 'Something went wrong.')
}

/** Typed legs — free, no auth required. Default window bumped 2018 -> 2020
 * (owner ask, 2026-10-26: "the decade, not 2018") — matches GET /lab/lines'
 * own options.since, confirmed live. 2018/2019 are still valid if someone
 * explicitly asks (confirmed live too), just not the default anymore. */
export function runLabLegs(legs: string[], opts: LabOptions = {}): Promise<LabResult> {
  return postLab<LabResult>({ legs, since: opts.since ?? 2020, post: opts.post ?? false, season: opts.season ?? false })
}

/** A screenshot of a slip — needs a signed-in session; spends a free
 * question or a credit (quota/credits_charged come back on the result). */
export function runLabImage(dataUri: string, opts: LabOptions = {}): Promise<LabImageResult> {
  return postLab<LabImageResult>({
    image: dataUri,
    since: opts.since ?? 2020,
    post: opts.post ?? false,
    season: opts.season ?? false,
  })
}

/** The live picker catalog — public, no auth. */
export async function fetchLabLines(): Promise<LabLinesCatalog> {
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, '/lab/lines'))
  let lastError: { status: number; message: string } | null = null
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (res.ok) return (await res.json()) as LabLinesCatalog
      const parsed = await res.json().catch(() => null)
      lastError = { status: res.status, message: parsed?.detail || `HTTP ${res.status}` }
    } catch (err) {
      lastError = { status: 0, message: err instanceof Error ? err.message : 'Network error' }
    }
  }
  throw new LabError_(lastError?.status ?? 0, lastError?.message ?? 'Something went wrong.')
}
