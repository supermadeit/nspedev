// Thin fetch layer for the live /database endpoints (GET /database/{slug},
// GET /database/index) that replaced the bundled qb-profiles/*.json +
// batter-profiles/*.json glob approach — see PlayerProfilePage.tsx and
// playerSearch.ts, the only two consumers. Tries the same base-URL
// candidates /run already uses (same-origin proxy first when running
// locally, api.nspe.dev otherwise) so this behaves identically to the rest
// of the app's networking.
import { API_BASE_CANDIDATES, joinUrl } from './nspe-api'

// The backend returns the profile already shaped as ProfilePayload, but
// this fetch layer stays untyped on purpose — PlayerProfilePage.tsx does its
// own light runtime shape check before trusting the response, same as every
// other live-payload consumer in this app.
//
// `window` picks the profile window: omitted = the current season (the
// backend default), a season year ("2025"), or "career". Outcomes:
//   ok           -> the payload
//   not-found    -> 404 (unknown player, or — with a window — a season that
//                   isn't on file; `detail` carries the backend's message,
//                   which lists what is on file)
//   bad-window   -> 422 (a window value the backend can't parse)
// Other failures throw, same as before. A 404/422 is definitive, so it stops
// immediately instead of retrying the next candidate base URL.
export type ProfileFetchResult =
  | { status: 'ok'; payload: unknown }
  | { status: 'not-found'; detail: string | null }
  | { status: 'bad-window'; detail: string | null }

function detailText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const d = (body as Record<string, unknown>).detail
  if (typeof d === 'string') return d
  if (d && typeof d === 'object') {
    try {
      return JSON.stringify(d)
    } catch {
      return null
    }
  }
  return null
}

export async function fetchPlayerProfile(slug: string, window?: string | null): Promise<ProfileFetchResult> {
  const query = window ? `?window=${encodeURIComponent(window)}` : ''
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, `/database/${encodeURIComponent(slug)}${query}`))
  let lastError: unknown = null
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (res.ok) return { status: 'ok', payload: await res.json() }
      if (res.status === 404 || res.status === 422) {
        const body = await res.json().catch(() => null)
        return { status: res.status === 404 ? 'not-found' : 'bad-window', detail: detailText(body) }
      }
      lastError = new Error(`${url} -> HTTP ${res.status} ${res.statusText}`)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error('No /database endpoint responded')
}

// Still used by the index fetch below: a 404 there is a definitive "not
// found" too.
//
// Two real bugs fixed here, found live while chasing a "matchups page hangs,
// then fails on localhost" report: no timeout at all (a hung connection sat
// bound only by the browser's own very long default, showing up as a real,
// long-looking hang on production), and no content-type check before
// trusting a 200 — on localhost, the same-origin candidate (see
// shouldUseSameOriginApi) hits Vite's own dev server, which has no real
// backend behind /api and, verified live, answers an unmatched GET with a
// fast `200 text/html` (its SPA fallback serving index.html) rather than a
// 404. `res.ok` alone accepted that as success and never even tried the
// real backend — exactly why these endpoints "don't work on localhost"
// despite being plain fetches to api.nspe.dev with no reason to actually
// behave differently there. (POST requests, like /run's, don't trigger
// Vite's fallback — confirmed live too — which is why /run never hit this.)
const FETCH_TIMEOUT_MS = 10000

function looksLikeJson(res: Response): boolean {
  return (res.headers.get('content-type') || '').toLowerCase().includes('json')
}

async function fetchFirstOk(urls: string[]): Promise<Response | null> {
  let lastError: unknown = null
  for (const url of urls) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (res.status === 404 && looksLikeJson(res)) return null
      if (res.ok && looksLikeJson(res)) return res
      lastError = new Error(`${url} -> HTTP ${res.status} ${res.statusText} (${res.headers.get('content-type') || 'no content-type'})`)
    } catch (err) {
      lastError = err
    } finally {
      window.clearTimeout(timeout)
    }
  }
  throw lastError ?? new Error('No /database endpoint responded')
}

export interface DatabaseIndexEntry {
  name: string
  slug: string
  team: string
  position: string
  sport?: string
}

function isDatabaseIndexEntry(v: unknown): v is DatabaseIndexEntry {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return typeof r.name === 'string' && typeof r.slug === 'string'
}

// Defensive about the wrapper shape (bare array vs `{ entries: [...] }` /
// `{ players: [...] }` / `{ results: [...] }`) since this is a brand-new
// endpoint whose exact response shape hasn't been exercised against yet —
// same "don't assume the one shape you guessed" caution every other
// envelope-parsing function in this app already takes.
export async function fetchPlayerIndex(): Promise<DatabaseIndexEntry[]> {
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, '/database/index'))
  const res = await fetchFirstOk(urls)
  if (!res) return []
  const data: unknown = await res.json()

  const candidate: unknown = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? ((data as Record<string, unknown>).entries ??
        (data as Record<string, unknown>).players ??
        (data as Record<string, unknown>).results ??
        (data as Record<string, unknown>).index)
      : null

  if (!Array.isArray(candidate)) return []
  return candidate.filter(isDatabaseIndexEntry)
}

export interface QbExplosivesData {
  season: number
  players: Array<{
    player_name: string
    team: string
    quarter_yards: { q1: number; q2: number; q3: number; q4: number; '1h': number; '2h': number }
    explosive: {
      '20-29': { count: number; td: number; yards: number }
      '30-39': { count: number; td: number; yards: number }
      '40-49': { count: number; td: number; yards: number }
      '50+': { count: number; td: number; yards: number }
    }
  }>
}

function isQbExplosivesData(value: unknown): value is QbExplosivesData {
  return !!value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).players)
}

// {chart}'s data source — used to be a bundled snapshot manually re-copied
// from data/output/nfl_qb_explosives.json, since the backend had no endpoint
// serving it (see the git history on qb-explosives-2026.json, and
// QbChartsPage.tsx). Backend since added a live, allowlisted route serving
// that exact file (GET /api/data/output/nfl_qb_explosives.json, ETag/
// no-cache) — this is the live fetch that snapshot was always meant to be
// swapped for. Throws on failure; QbChartsPage.tsx has no bundled fallback
// to fall back to anymore, so a genuine outage should surface as an error,
// not silently serve stale numbers.
export async function fetchQbExplosives(): Promise<QbExplosivesData> {
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, '/api/data/output/nfl_qb_explosives.json'))
  const res = await fetchFirstOk(urls)
  if (!res) throw new Error('nfl_qb_explosives.json not found')
  const data: unknown = await res.json()
  if (!isQbExplosivesData(data)) throw new Error('Unrecognized qb-explosives response shape.')
  return data
}

export interface NflPowerRankingsTeam {
  rank: number
  team: string
  power_score: number
  wins: number
  losses: number
  ties: number
  yards_per_play?: number
  point_margin?: number
  turnover_margin?: number
  third_down_pct?: number
  red_zone_pct?: number
  avg_possession_seconds?: number
  [key: string]: string | number | undefined
}

export interface NflPowerRankingsData {
  engine: string
  season: number
  window: string
  generated_at: string
  teams: NflPowerRankingsTeam[]
}

function isNflPowerRankingsData(value: unknown): value is NflPowerRankingsData {
  return !!value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).teams)
}

// The power-rankings page's data source — used to be a metered /run call
// ("nspe nfl team -rankings <season>") re-run live on every single page
// visit, even though the ranking only changes once a day. Backend now
// precomputes this once daily (scrape-room cron) and serves the static
// result free/unauthenticated, same allowlisted-file pattern as
// fetchQbExplosives above — this removes both the credit/guest-quota cost
// AND the repeated compute, since every visitor between refreshes reads the
// same cached file rather than triggering a fresh calculation.
export async function fetchNflPowerRankings(): Promise<NflPowerRankingsData> {
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, '/api/data/output/nfl_power_rankings.json'))
  const res = await fetchFirstOk(urls)
  if (!res) throw new Error('nfl_power_rankings.json not found')
  const data: unknown = await res.json()
  if (!isNflPowerRankingsData(data)) throw new Error('Unrecognized power-rankings response shape.')
  return data
}

// ---------------- multi-sport power rankings / schedule ----------------
// Generalized siblings of fetchNflPowerRankings/the NFL-only types above, for
// the NBA/MLB/NHL rollout — same free/unauthenticated/daily-precomputed file
// serve, just parameterized by sport instead of hardcoded to nfl_*.json.
// NflPowerRankingsData/fetchNflPowerRankings are left exactly as they were
// (WorldCupApp.tsx's only consumer of them) rather than routed through this,
// to avoid touching the already-live, most-visited NFL page while this is
// still new and unexercised.
export type SportKey = 'nfl' | 'nba' | 'mlb' | 'nhl'

export interface SportPowerRankingsRow {
  rank: number
  team: string
  power_score: number
  wins: number
  losses: number
  ties?: number
  otl?: number
  [key: string]: string | number | undefined
}

export interface SportPowerRankingsData {
  engine: string
  season: number
  window: string
  generated_at: string
  teams: SportPowerRankingsRow[]
}

function isSportPowerRankingsData(value: unknown): value is SportPowerRankingsData {
  return !!value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).teams)
}

export async function fetchPowerRankings(sport: SportKey): Promise<SportPowerRankingsData> {
  const filename = `${sport}_power_rankings.json`
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, `/api/data/output/${filename}`))
  const res = await fetchFirstOk(urls)
  if (!res) throw new Error(`${filename} not found`)
  const data: unknown = await res.json()
  if (!isSportPowerRankingsData(data)) throw new Error(`Unrecognized ${sport} power-rankings response shape.`)
  return data
}

// One row per game — the flat, ungrouped schedule/fixture feed confirmed live
// by scrape-room for nba/mlb/nhl (data/output/<sport>_games/<season>.json,
// served via GET /api/data/output/{sport}_games/{season}.json). Deliberately
// flat: these sports have no "week" concept the way NFL does, so grouping
// (by date, by "next 7 days", whatever a page wants) happens client-side.
export interface SportGame {
  game_id: string
  date_iso: string
  start_time_utc: string
  season_type: string
  home_team: string
  away_team: string
  home_team_id?: string
  away_team_id?: string
  home_score: number
  away_score: number
  status: 'scheduled' | 'final' | 'postponed' | 'canceled'
  status_detail?: string | null
  round?: string | null
  series_game?: string | null
  broadcast?: string[]
  // NFL-only — which week of the season this game belongs to. Absent on
  // NBA/MLB/NHL rows, which have no week concept at all.
  week?: number
}

export interface SportScheduleData {
  sport: string
  season: string
  generated: string
  count: number
  games: SportGame[]
}

function isSportScheduleData(value: unknown): value is SportScheduleData {
  return !!value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).games)
}

export async function fetchSportSchedule(sport: SportKey, season: string | number): Promise<SportScheduleData> {
  const filename = `${sport}_games/${season}.json`
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, `/api/data/output/${filename}`))
  const res = await fetchFirstOk(urls)
  if (!res) throw new Error(`${filename} not found`)
  const data: unknown = await res.json()
  if (!isSportScheduleData(data)) throw new Error(`Unrecognized ${sport} schedule response shape.`)
  return data
}

// ---------------- per-player stat-bucket charts (MLB/NBA/NHL) ----------------
// {charts}' NFL page (fetchQbExplosives above) is a per-player, per-quarter
// stat grid with distance-band breakdowns. Per nspe-v2-da's data-availability
// answer (2026-09-30), the same "grid + bands" shape is real for these three
// sports too, precomputed the same allowlisted-static-file way, and — per
// their follow-up, confirmed directly off the live files — the exact same
// envelope as nfl_qb_explosives.json too: {generated_at, season, players}.
// Just a different filename and row shape per sport (see each interface's
// own comment for the exact field set, taken straight from their message).

export interface MlbBatterBucketRow {
  player_name: string
  team: string
  games: number
  buckets: {
    games_2plus_hits: number
    games_3plus_hits: number
    games_2plus_rbi: number
    games_3plus_rbi: number
    total_doubles: number
    total_bases: number
    games_1plus_xbh: number
    games_2plus_xbh: number
  }
}

export interface MlbBatterBucketsData {
  season: number
  generated_at: string
  players: MlbBatterBucketRow[]
}

function isMlbBatterBucketsData(v: unknown): v is MlbBatterBucketsData {
  return !!v && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).players)
}

export async function fetchMlbBatterBuckets(): Promise<MlbBatterBucketsData> {
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, '/api/data/output/mlb_batter_buckets.json'))
  const res = await fetchFirstOk(urls)
  if (!res) throw new Error('mlb_batter_buckets.json not found')
  const data: unknown = await res.json()
  if (!isMlbBatterBucketsData(data)) throw new Error('Unrecognized mlb-batter-buckets response shape.')
  return data
}

export interface NbaScoringBucketRow {
  player_name: string
  team: string
  games: number
  // Nullable per-field: reported 2026-09-30 that most players (373/470) come
  // back with a literal 0 across every quarter/half/OT despite real minutes
  // played (Deni Avdija, Jay Huff, ...) — per-quarter scoring apparently
  // isn't tracked for most of the league yet. Backend may start sending
  // `null` instead of a false 0 once that's sorted out (see the message to
  // nspe-v2-da this was flagged in) — typed nullable now so the chart's
  // "—" / sort-to-bottom handling is ready whenever that ships, with no
  // second round-trip needed.
  quarter_points: {
    q1: number | null
    q2: number | null
    q3: number | null
    q4: number | null
    '1h': number | null
    '2h': number | null
    ot: number | null
  }
  bands: {
    points: Record<string, number>
    rebounds: Record<string, number>
    assists: Record<string, number>
    total_pra: Record<string, number>
  }
  defense: { steals_total: number; blocks_total: number; stocks_total: number }
}

export interface NbaScoringBucketsData {
  season: number
  generated_at: string
  players: NbaScoringBucketRow[]
}

function isNbaScoringBucketsData(v: unknown): v is NbaScoringBucketsData {
  return !!v && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).players)
}

export async function fetchNbaScoringBuckets(): Promise<NbaScoringBucketsData> {
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, '/api/data/output/nba_scoring_buckets.json'))
  const res = await fetchFirstOk(urls)
  if (!res) throw new Error('nba_scoring_buckets.json not found')
  const data: unknown = await res.json()
  if (!isNbaScoringBucketsData(data)) throw new Error('Unrecognized nba-scoring-buckets response shape.')
  return data
}

export interface NhlScoringBucketRow {
  player_name: string
  team: string
  position: string
  games: number
  bands: {
    goals: Record<string, number>
    points: Record<string, number>
    assists: Record<string, number>
    sog: Record<string, number>
  }
  totals: { goals: number; assists: number; points: number; sog: number; pim: number }
}

export interface NhlScoringBucketsData {
  season: number
  generated_at: string
  players: NhlScoringBucketRow[]
}

function isNhlScoringBucketsData(v: unknown): v is NhlScoringBucketsData {
  return !!v && typeof v === 'object' && Array.isArray((v as Record<string, unknown>).players)
}

export async function fetchNhlScoringBuckets(): Promise<NhlScoringBucketsData> {
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, '/api/data/output/nhl_scoring_buckets.json'))
  const res = await fetchFirstOk(urls)
  if (!res) throw new Error('nhl_scoring_buckets.json not found')
  const data: unknown = await res.json()
  if (!isNhlScoringBucketsData(data)) throw new Error('Unrecognized nhl-scoring-buckets response shape.')
  return data
}
