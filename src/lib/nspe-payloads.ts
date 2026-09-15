// Payload interfaces, type guards, and unwrappers for every engine App.tsx's
// query dispatch chain understands, plus the generic-path helpers they lean
// on (stat-context detection, match/streak extraction, result normalization).
//
// Moved out of App.tsx mechanically (cut/paste, no logic changes) so this
// query/payload contract can be reused by other UI surfaces without pulling
// in App.tsx's React component tree. The `XView` presentational components
// stay in App.tsx — this file is pure data on `unknown`.

import hitlistData from '@/assets/data/hitlist.json'
import leaderboardData from '@/assets/data/leaderboard.json'
import { type ApiPayload, asNumber, extractEnvelopeFromText } from './nspe-api'

export interface QueryResult {
  player: string
  total: number
  team?: string
  streakDetails?: StreakDetail[]
  matchDetails?: MatchDetail[]
  // Whether the raw row had a per-game match/matches array at all — distinct
  // from matchDetails.length>0, which only reflects entries that could
  // actually be parsed (value + date both resolved). A trend row from an
  // engine shape extractMatchDetails doesn't fully understand yet (e.g. one
  // whose per-match value lives under a field name STAT_FIELDS doesn't map)
  // still has a match array, just an empty matchDetails — display code that
  // decides "trend vs compute" formatting should key off THIS, not
  // matchDetails, so a parsing gap degrades to "no per-game breakdown shown"
  // rather than "this looks like a compute row, drop the met=N formatting."
  hasMatchArray?: boolean
  // The trend window size (e.g. 5 for "-last3/5"), read off the row's
  // window/last field when present. Exists specifically to detect a
  // single-day window (-yst, "yesterday") — met=N is meaningless when there
  // was only ever one possible day to check, so display code should show
  // the one match's value+date directly instead, keyed off windowSize === 1.
  windowSize?: number
}

export interface StreakDetail {
  length: number
  start: string
  end: string
}

export interface MatchDetail {
  value: number
  date: string
  statLabel: string
}

// ---------- H2H ----------

export interface H2hGame {
  date: string
  date_iso?: string
  venue?: string
  opponent?: string
  AB?: number
  R?: number
  H?: number
  '2B'?: number
  '3B'?: number
  HR?: number
  RBI?: number
  BB?: number
  SO?: number
  SB?: number
}

export interface H2hTotals {
  games?: number
  AB?: number
  R?: number
  H?: number
  '2B'?: number
  '3B'?: number
  HR?: number
  RBI?: number
  BB?: number
  SO?: number
  SB?: number
  TB?: number
  AVG?: number
  OBP?: number
  SLG?: number
  OPS?: number
}

export interface H2hStaffPitcherLine {
  pitcher: string
  team?: string
  AB?: number
  H?: number
  '2B'?: number
  '3B'?: number
  HR?: number
  RBI?: number
  BB?: number
  K?: number
  AVG?: number
  OBP?: number
  SLG?: number
  OPS?: number
}

// `-staff` adds this one extra field to an otherwise-normal h2h payload —
// the batter's per-pitcher breakdown against the opposing team's staff.
// Everything else about the payload (query/totals/games) is unchanged, so
// isH2hPayload below deliberately doesn't need to know about this field to
// keep recognizing the payload as h2h-shaped.
export interface H2hStaffBreakdown {
  player: string
  team: string
  pitcher_count: number
  pitchers: H2hStaffPitcherLine[]
  totals: {
    AB?: number
    H?: number
    '2B'?: number
    '3B'?: number
    HR?: number
    RBI?: number
    BB?: number
    K?: number
    TB?: number
    AVG?: number
    OBP?: number
    SLG?: number
    OPS?: number
  }
}

export interface H2hPayload {
  engine: string
  query: {
    player_query?: string
    player_display?: string
    player_team?: string
    opponent_code?: string
    home_away?: string
    source?: string
    year?: number
    last_n?: number | null
    season?: boolean
    window_label?: string
  }
  totals: H2hTotals
  games: H2hGame[]
  staff_breakdown?: H2hStaffBreakdown
}

export function isH2hPayload(payload: unknown): payload is H2hPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  const engine = typeof rec.engine === 'string' ? rec.engine : ''
  // Pitcher h2h has its own dedicated view.
  if (engine === 'mlb-pitch-h2h') return false
  return engine.endsWith('-h2h') && typeof rec.totals === 'object' && Array.isArray(rec.games)
}

// h2h responses may arrive either as a top-level JSON object or wrapped inside
// the standard envelope as `{ output: "<json string>", ... }`. Try both shapes.
export function extractH2hPayload(payload: unknown): H2hPayload | null {
  if (isH2hPayload(payload)) return payload

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const rec = payload as Record<string, unknown>
    if (typeof rec.output === 'string') {
      const inner = extractEnvelopeFromText(rec.output)
      if (inner && isH2hPayload(inner)) return inner
    }
    // Some envelopes nest the structured payload under `data`, `result`, or
    // `query_results_envelope`.
    for (const key of ['data', 'result', 'payload', 'query_results_envelope']) {
      const v = rec[key]
      if (isH2hPayload(v)) return v
    }
  }

  return null
}

// ---------- MLB Pitcher H2H ----------

export interface MlbPitchGame {
  date_display?: string
  date_iso?: string
  opponent_team?: string
  venue?: string
  ip?: string | number
  k?: number
  bb?: number
  hr?: number
  pitches?: number
  vfp?: number | null
  updown_match?: boolean | null
  first_k?: unknown
  first_match?: unknown
}

export interface MlbPitchTotals {
  games?: number
  ip_outs?: number
  k?: number
  bb?: number
  hr?: number
  h?: number
  er?: number
  pitches?: number
  first_pitch_velocities?: number[]
  gb?: number
  fb?: number
  popout?: number
  foul_out?: number
}

export interface MlbPitchRates {
  k_pct?: number
  bb_pct?: number
  hr_pct?: number
  h_pct?: number
  go_pct?: number
  fo_pct?: number
  po_pct?: number
  lo_pct?: number
  foul_out_pct?: number
  dp_pct?: number
  total_contact_outs?: number
  pa?: number
  era?: number
  k9?: number
  bb9?: number
  hr9?: number
  innings?: number
}

export interface MlbFirstPitchSummary {
  avg?: number
  min?: number
  max?: number
  median?: number
  pitch_types?: Record<string, number>
}

export interface MlbPitchUpdown {
  target?: string
  matches?: number
  per_game?: boolean[]
}

export interface MlbPitchH2hPayload {
  engine: 'mlb-pitch-h2h'
  player?: string
  opponent?: string | null
  year_window?: [number, number]
  career?: boolean
  last_n?: number | null
  games: MlbPitchGame[]
  totals?: MlbPitchTotals
  pbp_tally?: Record<string, number>
  out_types?: Record<string, number>
  pitch_type_counts?: Record<string, number>
  rates?: MlbPitchRates
  first_pitch_summary?: MlbFirstPitchSummary
  updown?: MlbPitchUpdown
}

export function isMlbPitchH2hPayload(payload: unknown): payload is MlbPitchH2hPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.engine === 'mlb-pitch-h2h' && Array.isArray(rec.games)
}

export function extractMlbPitchH2hPayload(payload: unknown): MlbPitchH2hPayload | null {
  if (isMlbPitchH2hPayload(payload)) return payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const rec = payload as Record<string, unknown>
    if (typeof rec.output === 'string') {
      const inner = extractEnvelopeFromText(rec.output)
      if (inner && isMlbPitchH2hPayload(inner)) return inner
    }
    for (const key of ['data', 'result', 'payload', 'query_results_envelope']) {
      const v = rec[key]
      if (isMlbPitchH2hPayload(v)) return v
    }
  }
  return null
}

// ---------- MLB Pitcher First-Pitch Velocity (-fpv / -vfp) ----------

export interface MlbPitchFpvGame {
  date_iso?: string
  opponent_team?: string
  home_away?: string
  fpv?: number | null
  pitch_type?: string
  inning?: number
  batter_play?: string
}

export interface MlbPitchFpvSummary {
  avg_fpv?: number
  min_fpv?: number
  max_fpv?: number
  first_pitch_types?: Record<string, number>
  count?: number
}

export interface MlbPitchFpvPayload {
  engine: 'mlb-pitch-fpv'
  player?: string
  window?: string
  generated_at?: string
  games: MlbPitchFpvGame[]
  summary?: MlbPitchFpvSummary
}

export function isMlbPitchFpvPayload(payload: unknown): payload is MlbPitchFpvPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.engine === 'mlb-pitch-fpv' && Array.isArray(rec.games)
}

export function extractMlbPitchFpvPayload(payload: unknown): MlbPitchFpvPayload | null {
  if (isMlbPitchFpvPayload(payload)) return payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const rec = payload as Record<string, unknown>
    if (typeof rec.output === 'string') {
      const inner = extractEnvelopeFromText(rec.output)
      if (inner && isMlbPitchFpvPayload(inner)) return inner
    }
    for (const key of ['data', 'result', 'payload', 'query_results_envelope']) {
      const v = rec[key]
      if (isMlbPitchFpvPayload(v)) return v
    }
  }
  return null
}

// ---------- MLB Batter Team ----------

export interface MlbBatTeamPayload {
  engine: 'mlb-bat-team'
  team?: string
  last_n?: number | null
  year_window?: [number, number]
  career?: boolean
  games?: number
  pbp_tally?: Record<string, number>
  out_types?: Record<string, number>
  rates?: MlbPitchRates
  first_pitch_summary?: MlbFirstPitchSummary
  contributing_pitchers?: { name: string; games: number }[]
}

export function isMlbBatTeamPayload(payload: unknown): payload is MlbBatTeamPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.engine === 'mlb-bat-team' && typeof rec.rates === 'object'
}

export function extractMlbBatTeamPayload(payload: unknown): MlbBatTeamPayload | null {
  if (isMlbBatTeamPayload(payload)) return payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const rec = payload as Record<string, unknown>
    if (typeof rec.output === 'string') {
      const inner = extractEnvelopeFromText(rec.output)
      if (inner && isMlbBatTeamPayload(inner)) return inner
    }
    for (const key of ['data', 'result', 'payload', 'query_results_envelope']) {
      const v = rec[key]
      if (isMlbBatTeamPayload(v)) return v
    }
  }
  return null
}

// ---------- MLB Team Overview (-ov) ----------

export interface MlbTeamOverviewPayload {
  engine: 'mlb-team-overview'
  team?: string
  season?: number
  games_processed?: number
  scheduled_games?: number
  missing_games_count?: number
  missing_game_ids_sample?: string[]
  completeness_pct?: number
  '3down'?: number
  '6down'?: number
  '9down'?: number
  avg_first_baserunner_inning?: number
  team_k_total?: number
  team_bb_total?: number
  out_type_pct?: Record<string, number>
  hits_per_inning_avg?: Record<string, number>
  generated_at?: string
}

export function isMlbTeamOverviewPayload(payload: unknown): payload is MlbTeamOverviewPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.engine === 'mlb-team-overview'
}

export function extractMlbTeamOverviewPayload(payload: unknown): MlbTeamOverviewPayload | null {
  if (isMlbTeamOverviewPayload(payload)) return payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const rec = payload as Record<string, unknown>
    if (typeof rec.output === 'string') {
      const inner = extractEnvelopeFromText(rec.output)
      if (inner && isMlbTeamOverviewPayload(inner)) return inner
    }
    for (const key of ['data', 'result', 'payload', 'query_results_envelope']) {
      const v = rec[key]
      if (isMlbTeamOverviewPayload(v)) return v
    }
  }
  return null
}

// ---------- MLB Batter Report Leaderboard ----------

export interface MlbReportLeaderboardRow {
  player: string
  player_key: string
  team: string
  grade: string
  score: number
  games: number
  rates: Record<string, number>
  last_game: string
}

export interface MlbReportLeaderboardPayload {
  kind: 'mlb_report_leaderboard'
  generated_at: string
  query: { window: number; is_season: boolean; top_n: number }
  rows: MlbReportLeaderboardRow[]
  grade_buckets: Array<{ min: number; grade: string }>
  weights: Record<string, number>
}

export function isMlbReportLeaderboardPayload(payload: unknown): payload is MlbReportLeaderboardPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.kind === 'mlb_report_leaderboard' && Array.isArray(rec.rows)
}

export function extractMlbReportLeaderboardPayload(payload: unknown): MlbReportLeaderboardPayload | null {
  if (isMlbReportLeaderboardPayload(payload)) return payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const rec = payload as Record<string, unknown>
    if (typeof rec.output === 'string') {
      const inner = extractEnvelopeFromText(rec.output)
      if (inner && isMlbReportLeaderboardPayload(inner)) return inner
    }
    for (const key of ['data', 'result', 'payload', 'query_results_envelope']) {
      const v = rec[key]
      if (isMlbReportLeaderboardPayload(v)) return v
    }
  }
  return null
}

// ---------- MLB Player Report ----------

export interface MlbPlayerReportBreakdown {
  label: string
  rate: number
  weight: number
  points: number
}

export interface MlbPlayerReportData {
  eligible: boolean
  games: number
  window: number
  is_season: boolean
  first_game: string
  last_game: string
  totals: Record<string, number>
  rates: Record<string, number>
  breakdown: MlbPlayerReportBreakdown[]
  raw_score: number
  score: number
  grade: string
}

export interface MlbPlayerReportPayload {
  kind: 'mlb_player_report'
  generated_at: string
  query: { selector: string; window: number; is_season: boolean }
  player: string
  player_key: string
  team: string
  report: MlbPlayerReportData
  grade_buckets: Array<{ min: number; grade: string }>
  weights: Record<string, number>
}

export function isMlbPlayerReportPayload(payload: unknown): payload is MlbPlayerReportPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.kind === 'mlb_player_report' && typeof rec.report === 'object'
}

export function extractMlbPlayerReportPayload(payload: unknown): MlbPlayerReportPayload | null {
  if (isMlbPlayerReportPayload(payload)) return payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const rec = payload as Record<string, unknown>
    if (typeof rec.output === 'string') {
      const inner = extractEnvelopeFromText(rec.output)
      if (inner && isMlbPlayerReportPayload(inner)) return inner
    }
    for (const key of ['data', 'result', 'payload', 'query_results_envelope']) {
      const v = rec[key]
      if (isMlbPlayerReportPayload(v)) return v
    }
  }
  return null
}

// ---------------- NFL explosive (long/PBP) types + detection ----------------

export interface NflExplosiveMatch {
  date: string
  date_iso?: string
  yards: number
  opponent?: string
  receiver?: string
  passer?: string
  touchdown?: boolean
  quarter?: number
  play_type?: string
  // legacy grouped shape
  value?: number
  count?: number
  yards_list?: number[]
}

export interface NflExplosiveResult {
  player: string
  team?: string
  position?: string
  // trend (per-game drill-down) shape
  met?: number
  met_count?: number
  matches?: NflExplosiveMatch[]
  last?: number
  threshold?: number
  window?: number
  // compute (season leaderboard) shape
  value?: number   // explosive play count
  games?: number
  yards?: number   // total yards on explosive plays
}

export interface NflExplosivePayload {
  sport: string
  query: string | string[]
  total_results?: number
  results: NflExplosiveResult[]
}

export function isNflExplosivePayload(payload: unknown): payload is NflExplosivePayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const p = payload as Record<string, unknown>
  const queryHasLong =
    (Array.isArray(p.query) && (p.query as string[]).includes('long')) ||
    (typeof p.query === 'string' && p.query.includes('long'))
  return p.sport === 'nfl' && queryHasLong && Array.isArray(p.results)
}

// ---------- Explosive-play overview (single player, distance-bucketed) ----------
// Sport-agnostic on purpose: NFL shipped first (`nfl_overview_long`), MLB/NBA/
// NHL equivalents are expected to follow using the same `-ov` idea. Matched
// by engine SUFFIX (`_overview_long`) rather than an exact per-sport string,
// and every numeric field is read through a short list of plausible names
// rather than one fixed key — same lesson learned from `games_meeting` vs
// `count` (format-hitlist.mjs) and `total_ft` vs `total_yards` (batter HR
// distance vs this engine) showing up as real naming drift across engines
// for the identical underlying concept within this same session. This is
// the one thing that has to stay true for "add a sport, get it for free on
// the frontend" to actually hold: an explicit, matchable tag (the engine
// suffix) plus tolerance for reasonable field-name variation, NOT an exact
// one-shape assumption that breaks the moment a second sport spells a field
// differently. A first-class `unit` field (defaulting to a category-based
// guess when absent) is what lets one view print "64yds" for NFL and
// "450ft" for a future MLB variant without knowing the sport at all.
export interface ExplosiveOverviewBucket {
  range: string
  count: number
  value: number
  avg: number
}

export interface ExplosiveOverviewLongest {
  value: number
  date_iso?: string
  opponent?: string
  quarter?: number
}

export interface ExplosiveOverviewPayload {
  engine: string
  query: {
    player: string
    category: string
    scope?: string | null
    year_window?: [number, number]
  }
  totalPlays: number
  totalValue: number
  avgValue: number
  unit: string
  longest?: ExplosiveOverviewLongest
  buckets: ExplosiveOverviewBucket[]
}

function inferOverviewUnit(engine: string, category: string): string {
  if (engine.toLowerCase().startsWith('mlb')) return 'ft'
  if (category) return 'yds'
  return 'yds'
}

function normalizeExplosiveOverview(raw: Record<string, unknown>): ExplosiveOverviewPayload | null {
  const engine = raw.engine
  if (typeof engine !== 'string' || !/_overview_long$/i.test(engine)) return null
  if (!Array.isArray(raw.buckets)) return null

  const queryRaw = raw.query && typeof raw.query === 'object' && !Array.isArray(raw.query) ? (raw.query as Record<string, unknown>) : {}
  const player = typeof queryRaw.player === 'string' ? queryRaw.player : ''
  const category = typeof queryRaw.category === 'string' ? queryRaw.category : ''
  const unit = typeof raw.unit === 'string' && raw.unit ? raw.unit : inferOverviewUnit(engine, category)

  const longestRaw = raw.longest && typeof raw.longest === 'object' && !Array.isArray(raw.longest) ? (raw.longest as Record<string, unknown>) : null
  const longest: ExplosiveOverviewLongest | undefined = longestRaw
    ? {
        value: asNumber(longestRaw.value ?? longestRaw.yards ?? longestRaw.ft ?? longestRaw.feet ?? longestRaw.distance_feet),
        date_iso: typeof longestRaw.date_iso === 'string' ? longestRaw.date_iso : undefined,
        opponent: typeof longestRaw.opponent === 'string' ? longestRaw.opponent : undefined,
        quarter: typeof longestRaw.quarter === 'number' ? longestRaw.quarter : undefined,
      }
    : undefined

  const buckets: ExplosiveOverviewBucket[] = (raw.buckets as unknown[])
    .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object' && !Array.isArray(b))
    .map((b) => ({
      range: typeof b.range === 'string' ? b.range : '',
      count: asNumber(b.count),
      value: asNumber(b.value ?? b.yards ?? b.ft ?? b.feet),
      avg: asNumber(b.avg),
    }))

  return {
    engine,
    query: {
      player,
      category,
      scope: (queryRaw.scope as string | null | undefined) ?? null,
      year_window: Array.isArray(queryRaw.year_window) ? (queryRaw.year_window as [number, number]) : undefined,
    },
    totalPlays: asNumber(raw.total_plays ?? raw.total_events ?? raw.total_count),
    totalValue: asNumber(raw.total_value ?? raw.total_yards ?? raw.total_ft ?? raw.total_feet),
    avgValue: asNumber(raw.avg_value ?? raw.avg_yards ?? raw.avg_ft ?? raw.avg_feet),
    unit,
    longest,
    buckets,
  }
}

export function extractExplosiveOverviewPayload(payload: unknown): ExplosiveOverviewPayload | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const rec = payload as Record<string, unknown>

  const direct = normalizeExplosiveOverview(rec)
  if (direct) return direct

  if (typeof rec.output === 'string') {
    const inner = extractEnvelopeFromText(rec.output)
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const fromInner = normalizeExplosiveOverview(inner as Record<string, unknown>)
      if (fromInner) return fromInner
    }
  }
  for (const key of ['data', 'result', 'payload', 'query_results_envelope']) {
    const v = rec[key]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const fromNested = normalizeExplosiveOverview(v as Record<string, unknown>)
      if (fromNested) return fromNested
    }
  }

  return null
}

// ---------- MLB Home Run Distance (mlb long) ----------

export interface MlbHrTrendMatch {
  game_id: string
  date: string
  opponent: string
  inning: number
  half: string
  distance_feet: number
  description: string
  team: string
}

export interface MlbHrTrendResult {
  player: string
  team: string
  met_count: number
  window: number
  matches: MlbHrTrendMatch[]
}

export interface MlbHrComputeEvent {
  date: string
  distance_feet: number
  inning: number
  opponent: string
}

export interface MlbHrComputeResult {
  player: string
  team: string
  total_ft: number
  hr_count: number
  games: number
  events: MlbHrComputeEvent[]
}

export interface MlbHrPayload {
  engine: 'mlb_hr_trend' | 'mlb_hr_compute'
  query: Record<string, unknown>
  results: (MlbHrTrendResult | MlbHrComputeResult)[]
}

export function isMlbHrPayload(payload: unknown): payload is MlbHrPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return (rec.engine === 'mlb_hr_trend' || rec.engine === 'mlb_hr_compute') && Array.isArray(rec.results)
}

export function extractMlbHrPayload(payload: unknown): MlbHrPayload | null {
  if (isMlbHrPayload(payload)) return payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const rec = payload as Record<string, unknown>
    if (typeof rec.output === 'string') {
      const inner = extractEnvelopeFromText(rec.output)
      if (inner && isMlbHrPayload(inner)) return inner
    }
    for (const key of ['data', 'result', 'payload', 'query_results_envelope']) {
      const v = rec[key]
      if (isMlbHrPayload(v)) return v
    }
  }
  return null
}

// ---------- MLB First Plate Appearance Trend (mlb first) ----------

export interface MlbFirstPaMatch {
  game_id: string
  date: string
  opponent: string
  inning: number
  half: string
  category: string
  result: string
  distance_feet: number | null
  description: string
  team: string
}

export interface MlbFirstPaTrendResult {
  player: string
  team: string
  met_count: number
  window: number
  matches: MlbFirstPaMatch[]
}

export interface MlbFirstPaTrendPayload {
  engine: 'mlb_first_pa_trend'
  query: Record<string, unknown>
  results: MlbFirstPaTrendResult[]
}

export function isMlbFirstPaTrendPayload(payload: unknown): payload is MlbFirstPaTrendPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.engine === 'mlb_first_pa_trend' && Array.isArray(rec.results)
}

export function extractMlbFirstPaTrendPayload(payload: unknown): MlbFirstPaTrendPayload | null {
  if (isMlbFirstPaTrendPayload(payload)) return payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const rec = payload as Record<string, unknown>
    if (typeof rec.output === 'string') {
      const inner = extractEnvelopeFromText(rec.output)
      if (inner && isMlbFirstPaTrendPayload(inner)) return inner
    }
    for (const key of ['data', 'result', 'payload', 'query_results_envelope']) {
      const v = rec[key]
      if (isMlbFirstPaTrendPayload(v)) return v
    }
  }
  return null
}

// ---------- MLB Team Runs For/Allowed (mlb team) ----------

export interface MlbTeamRunsTrendMatch {
  game_id: string
  date_iso: string
  opponent: string
  runs_for: number
  runs_allowed: number
}

export interface MlbTeamRunsTrendResult {
  team: string
  met_count: number
  window: number
  matches: MlbTeamRunsTrendMatch[]
}

// Shape inferred from the structurally adjacent mlb_team_runs_leaderboard engine —
// the only captured mlb_team_runs_compute example returned an empty results array,
// so this is defensively typed with optional fields rather than verified exactly.
export interface MlbTeamRunsComputeResult {
  team: string
  total?: number
  games?: number
  avg?: number
}

export interface MlbTeamRunsPayload {
  engine: 'mlb_team_runs_trend' | 'mlb_team_runs_compute'
  query: Record<string, unknown>
  results: (MlbTeamRunsTrendResult | MlbTeamRunsComputeResult)[]
}

export function isMlbTeamRunsPayload(payload: unknown): payload is MlbTeamRunsPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return (rec.engine === 'mlb_team_runs_trend' || rec.engine === 'mlb_team_runs_compute') && Array.isArray(rec.results)
}

export function extractMlbTeamRunsPayload(payload: unknown): MlbTeamRunsPayload | null {
  if (isMlbTeamRunsPayload(payload)) return payload
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const rec = payload as Record<string, unknown>
    if (typeof rec.output === 'string') {
      const inner = extractEnvelopeFromText(rec.output)
      if (inner && isMlbTeamRunsPayload(inner)) return inner
    }
    for (const key of ['data', 'result', 'payload', 'query_results_envelope']) {
      const v = rec[key]
      if (isMlbTeamRunsPayload(v)) return v
    }
  }
  return null
}

// ---------------- Generic query-result path (stat context, matches, streaks) ----------------

export interface StatContext {
  sport: string
  stat: string
  // Raw period-prefixed field candidate (e.g. "q1_points") when the query
  // was period-scoped — kept as a fallback lookup key for computeMatchValue,
  // since STAT_FIELDS only maps the *unprefixed* short code to its plain
  // field name, and some period-scoped responses may not include the
  // sport-agnostic `val` field computeMatchValue otherwise prefers.
  periodField?: string
  // Display-unit override, currently NFL-only. NFL's "stat" is really a
  // category (pass/rush/rec) rather than a unit — unlike every other sport,
  // where the stat code itself IS the unit (hits, pts, hr). The backend
  // sometimes echoes that raw category back in query.stat/query.short, which
  // would otherwise leak straight into display labels ("342 rec" instead of
  // "342yds"). Resolved from the literal -yds/-td/-total flag in the query
  // string we sent (always present, regardless of what the backend echoes
  // back) rather than trusting the response — see resolveNflUnitLabel().
  unitLabel?: string
}

// NFL only has two real per-play units: yds or td — every other case (an
// explicit -yds/-total flag, OR no type flag at all, which the backend
// treats as an implicit yards default) reads as yds. Reads the flag
// directly off the query string rather than anything the backend echoes
// back, since that's the one source guaranteed to reflect what was
// actually asked for.
function resolveNflUnitLabel(query: string): string {
  return /-td(?=\d|\s|$)/.test(query) ? 'td' : 'yds'
}

export const STAT_FIELDS: Record<string, Record<string, string | string[]>> = {
  nba: {
    pts: 'points',
    reb: 'rebounds',
    ast: 'assists',
    stl: 'steals',
    blk: 'blocks',
    tpm: 'three_made',
    total: ['points', 'rebounds', 'assists'],
    'pts+ast': ['points', 'assists'],
    'pts+reb': ['points', 'rebounds'],
    'reb+ast': ['rebounds', 'assists'],
    'stl+blk': ['steals', 'blocks'],
  },
  mlb: {
    hits: 'hits',
    hr: 'hr',
    rbi: 'rbi',
    dub: 'doubles',
    trp: 'triples',
    sb: 'sb',
    k: 'k',
    bb: 'bb',
    tb: 'total_bases',
    // Assumed field name (no captured example yet) — matches this table's
    // established "full lowercase word" convention (hits/doubles/triples).
    // Only affects per-match value extraction for -runs; flag/fix if wrong.
    runs: 'runs',
  },
  nhl: {
    g: 'goals',
    a: 'assists',
    pts: 'points',
    sog: 'sog',
    blk: 'blocks',
    pim: 'pim',
  },
  nfl: {
    rush: 'rush_yds',
    pass: 'pass_yds',
    rec: 'rec_yds',
    // Combo stats (the `-total` type: pass+rush for the pass category,
    // rush+rec for rush/rec). Confirmed against a real `combo-trend` engine
    // response: `query.short` is literally "pass+rush"/"rush+rec" (what
    // detectStatContext matches against), and each match object already
    // carries a summed `val` — computeMatchValue checks that first, so this
    // array-sum is a fallback that in practice is never exercised.
    'pass+rush': ['pass_yds', 'rush_yds'],
    'rush+rec': ['rush_yds', 'rec_yds'],
    // Short-flag aliases for the same two combos — "-pr"/"-rr" queries (e.g.
    // "nspe nfl -pr250 -last1/1") come through as a bare token with no
    // preceding category word, unlike -yds/-td which need "pass"/"rush"/
    // "rec" first. The object-form query.short path already resolves via
    // the long-form keys above; these are what the plain token-array/
    // fallback-string path (detectStatContext's bottom scan) needs to match
    // against instead, since "pr"/"rr" aren't substrings of "pass+rush"/
    // "rush+rec".
    pr: ['pass_yds', 'rush_yds'],
    rr: ['rush_yds', 'rec_yds'],
    // "any" = anytime-TD (rush_td + rec_td combined). Unlike the yds combo
    // stats above, the backend doesn't echo a matching query.short/query.stat
    // string for this one (confirmed: `any -td2` came back as a plain query
    // string, not the object form with a `short` field) — detectStatContext
    // only finds it via the token-scan fallback matching the literal "any"
    // token, so this alias has to exist for that scan to have anything to
    // match. Backend precomputes the combined count directly on each match
    // as `_combo_td` — computeMatchValue's match.val fast path doesn't apply
    // here (no `val` field on these match objects), so this field name is
    // actually load-bearing, not a fallback that's never exercised.
    any: '_combo_td',
  },
  cfb: {
    pass: 'pass_yds',
    rush: 'rush_yds',
    rec: 'rec_yds',
  },
}

export const STAT_DISPLAY_LABELS: Record<string, string> = {
  tpm: '3pm',
  total: 'tot',
  tb: 'tb',
  'pass+rush': 'yds',
  'rush+rec': 'yds',
  pr: 'yds',
  rr: 'yds',
}

// Insert a space before any internal capital (e.g. "AaronJudge" -> "Aaron Judge").
// Leaves already-spaced names untouched.
export function normalizeDisplayPlayer(player: string): string {
  const trimmed = player.trim()
  if (!trimmed || trimmed.includes(' ')) return trimmed
  return trimmed.replace(/([a-z])([A-Z])/g, '$1 $2')
}

// Static player → team lookup built from bundled data sources.
// Used as a fallback when live API query results don't include team.
export const PLAYER_TEAM_MAP: Map<string, string> = (() => {
  const map = new Map<string, string>()
  const addEntry = (player: unknown, team: unknown) => {
    if (typeof player === 'string' && typeof team === 'string' && player && team) {
      map.set(player.toLowerCase(), team)
    }
  }
  // Leaderboard rows (streak leaderboard)
  const lb = leaderboardData as unknown as { rows?: Array<{ player: string; team: string }> }
  for (const row of lb?.rows ?? []) addEntry(row.player, row.team)
  // Hitlist entries
  for (const entry of hitlistData as Array<{ player?: string; team?: string }>) {
    addEntry(entry.player, entry.team)
  }
  return map
})()

export function parsePlayerFromNotes(notes: unknown): string | null {
  if (typeof notes !== 'string') {
    return null
  }

  const match = notes.match(/player:([^\s]+)/i)
  if (!match) {
    return null
  }

  const player = match[1].trim()
  return player.length > 0 ? player : null
}

export function parseGamesFromNotes(notes: unknown): number | null {
  if (typeof notes !== 'string') {
    return null
  }

  const match = notes.match(/games:(\d+)/i)
  if (!match) {
    return null
  }

  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

// ".276" style — drop the leading zero on a batting-average-shaped decimal.
// Shared by h2h, {h2h -staff}, and batter profiles so all three format AVG/
// OBP/SLG/OPS identically.
export function formatBattingAvg(n?: number): string {
  return typeof n === 'number' ? n.toFixed(3).replace(/^0+/, '') : '—'
}

export function extractDateToken(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  // ISO form like "2026-05-25" or "2026-05-25T...": normalize to M/D/YY for
  // display. The year suffix matters — a trend/streak window can span a
  // year boundary (e.g. an NFL "2025 season" game in Jan 2026), and M/D
  // alone is ambiguous once results are viewed outside the query context.
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const year = iso[1]
    const month = Number(iso[2])
    const day = Number(iso[3])
    if (Number.isFinite(month) && Number.isFinite(day)) {
      return `${month}/${day}/${year.slice(-2)}`
    }
  }

  const match = value.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/)
  return match ? match[1] : null
}

export function toStreakDetailFromRecord(record: Record<string, unknown>): StreakDetail | null {
  const directStart =
    (typeof record.start === 'string' && record.start) ||
    (typeof record.start_date === 'string' && record.start_date) ||
    (typeof record.first_date === 'string' && record.first_date) ||
    (typeof record.from === 'string' && record.from) ||
    ''

  const directEnd =
    (typeof record.end === 'string' && record.end) ||
    (typeof record.end_date === 'string' && record.end_date) ||
    (typeof record.last_date === 'string' && record.last_date) ||
    (typeof record.to === 'string' && record.to) ||
    ''

  // Accept `matches` (legacy) or `games` (new post-streak shape) as the per-game array.
  const games = Array.isArray(record.matches)
    ? record.matches
    : Array.isArray(record.games)
    ? record.games
    : []
  const firstGameDate =
    games.length > 0
      ? extractDateToken(
          typeof games[0] === 'string'
            ? games[0]
            : (games[0] as Record<string, unknown>)?.date as string ?? '',
        )
      : null
  const lastGameDate =
    games.length > 0
      ? extractDateToken(
          typeof games[games.length - 1] === 'string'
            ? (games[games.length - 1] as string)
            : (games[games.length - 1] as Record<string, unknown>)?.date as string ?? '',
        )
      : null

  const start = extractDateToken(directStart) || firstGameDate || ''
  const end = extractDateToken(directEnd) || lastGameDate || ''

  const length = asNumber(
    record.length ??
      record.streak ??
      record.streak_length ??
      record.games_count ??
      record.count ??
      (games.length > 0 ? games.length : 0),
  )

  if (!length || !start || !end) {
    return null
  }

  return {
    length,
    start,
    end,
  }
}

// Parse string streaks like "8 game streak 5/7 - 5/15" (trend-streak engine output).
export function parseStringStreak(value: string): StreakDetail | null {
  const match = value.match(
    /(\d+)\s*game\s*streak\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*-\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
  )
  if (!match) return null
  const length = Number(match[1])
  if (!Number.isFinite(length) || length <= 0) return null
  return { length, start: match[2], end: match[3] }
}

export function extractStreakDetails(row: Record<string, unknown>): StreakDetail[] {
  const candidates = [
    row.streaks,
    row.streak_details,
    row.streakDetails,
    row.details,
    row.sequences,
    row.runs,
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue
    }

    const parsed = candidate
      .map((item) => {
        if (typeof item === 'string') {
          return parseStringStreak(item)
        }
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null
        }

        return toStreakDetailFromRecord(item as Record<string, unknown>)
      })
      .filter((detail): detail is StreakDetail => detail !== null)

    if (parsed.length > 0) {
      return parsed
    }
  }

  if (Array.isArray(row.matches) && row.matches.length > 0) {
    const start = extractDateToken(String(row.matches[0]))
    const end = extractDateToken(String(row.matches[row.matches.length - 1]))

    if (start && end) {
      return [
        {
          length: row.matches.length,
          start,
          end,
        },
      ]
    }
  }

  return []
}

export function normalizePlayerKey(player: string): string {
  return player.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function parseStreakDetailsFromOutput(output: string): Record<string, StreakDetail[]> {
  const byPlayer: Record<string, StreakDetail[]> = {}
  const lines = output.split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || !/\bstreak\d+/i.test(line) || !/\bmatch:/i.test(line)) {
      continue
    }

    const match = line.match(/^(.+?)\s+streak(\d+)\b.*?\bmatch:\s*(.+)$/i)
    if (!match) {
      continue
    }

    const [, playerRaw, streakLengthRaw, matchListRaw] = match
    const player = playerRaw.trim()
    const streakLength = Number(streakLengthRaw)
    if (!player || !Number.isFinite(streakLength) || streakLength <= 0) {
      continue
    }

    const segments = matchListRaw
      .split(',')
      .map((segment) => segment.trim())
      .filter(Boolean)

    if (segments.length === 0) {
      continue
    }

    const firstDate = extractDateToken(segments[0])
    const lastDate = extractDateToken(segments[segments.length - 1])
    if (!firstDate || !lastDate) {
      continue
    }

    const key = normalizePlayerKey(player)
    if (!byPlayer[key]) {
      byPlayer[key] = []
    }

    byPlayer[key].push({
      length: streakLength,
      start: firstDate,
      end: lastDate,
    })
  }

  return byPlayer
}

export function extractResultArray(payload: ApiPayload): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const record = payload as Record<string, unknown>
  const candidates = [
    record.results,
    record.result,
    record.data,
    (record.data as Record<string, unknown> | undefined)?.results,
    (record.data as Record<string, unknown> | undefined)?.rows,
    (record.data as Record<string, unknown> | undefined)?.items,
    record.hitlist,
    record.items,
    record.rows,
    record.records,
    record.entries,
  ]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate
    }
  }

  return []
}

export function detectStatContext(payload: ApiPayload, fallbackQuery: string): StatContext | null {
  const tokens: string[] = []
  let queryStat = ''

  if (payload && !Array.isArray(payload) && typeof payload === 'object') {
    const rec = payload as Record<string, unknown>
    if (Array.isArray(rec.query)) {
      for (const t of rec.query) if (typeof t === 'string') tokens.push(t)
    } else if (rec.query && typeof rec.query === 'object') {
      // New engines (post-trend, compute, trend-streak, post-streak, combo-*) use an object form.
      const q = rec.query as Record<string, unknown>
      if (typeof q.stat === 'string') queryStat = q.stat.toLowerCase()
      else if (typeof q.short === 'string') queryStat = q.short.toLowerCase()
      else if (Array.isArray(q.stats)) {
        const joined = q.stats.filter((s) => typeof s === 'string').join('+').toLowerCase()
        if (joined) queryStat = joined
      }
    }
  }

  if (tokens.length === 0 && fallbackQuery) {
    for (const t of fallbackQuery.split(/\s+/)) tokens.push(t.replace(/^-/, ''))
  }

  let sport = ''
  if (payload && !Array.isArray(payload) && typeof payload === 'object') {
    const s = (payload as Record<string, unknown>).sport
    if (typeof s === 'string') sport = s.toLowerCase()
  }
  if (!sport) {
    for (const t of tokens) {
      if (STAT_FIELDS[t.toLowerCase()]) {
        sport = t.toLowerCase()
        break
      }
    }
  }
  if (!STAT_FIELDS[sport]) return null

  const unitLabel = sport === 'nfl' ? resolveNflUnitLabel(fallbackQuery) : undefined

  const knownStats = Object.keys(STAT_FIELDS[sport]).sort((a, b) => b.length - a.length)
  if (queryStat && knownStats.includes(queryStat)) {
    return { sport, stat: queryStat, unitLabel }
  }

  // Period-prefixed stats like "q1_points", "1h_points", "p1_goals": strip the
  // prefix and reverse-map the canonical field name back to its short code.
  // Keep the original prefixed string as `periodField` too — STAT_FIELDS
  // only knows the unprefixed field name, but the actual per-match object
  // for a period-scoped query may use the prefixed key, so computeMatchValue
  // needs both candidates to fall back on.
  if (queryStat) {
    const stripped = queryStat.replace(/^(q1|1h|p1|h1|h2|q2|q3|q4)_/, '')
    if (knownStats.includes(stripped)) {
      return { sport, stat: stripped, periodField: queryStat, unitLabel }
    }
    const fields = STAT_FIELDS[sport]
    for (const [short, fld] of Object.entries(fields)) {
      if (typeof fld === 'string' && fld === stripped) {
        return { sport, stat: short, periodField: queryStat, unitLabel }
      }
    }
  }
  // A period token ("1h", "q1", etc.) sitting alongside the stat token in the
  // plain token-array/fallback-string form of the query (as opposed to the
  // underscore-joined "1h_pts" form the object-form branch above already
  // handles) — carry it into periodField too, so a period-scoped query that
  // comes through this path isn't silently missing the one piece of context
  // computeMatchValue needs to find the per-match field if it isn't named
  // plainly. Without this, period-scoped queries reaching this fallback path
  // depended entirely on computeMatchValue's own brute-force prefix scan.
  const periodToken = tokens.find((t) => ['q1', '1h', 'p1', 'h1', 'h2', 'q2', 'q3', 'q4'].includes(t.toLowerCase()))
  for (const tok of tokens) {
    const lower = tok.toLowerCase()
    for (const s of knownStats) {
      if (lower.startsWith(s) && /^[a-z]+/i.test(lower)) {
        return {
          sport,
          stat: s,
          unitLabel,
          periodField: periodToken ? `${periodToken.toLowerCase()}_${s}` : undefined,
        }
      }
    }
  }
  return null
}

export function computeMatchValue(match: Record<string, unknown>, ctx: StatContext): number | null {
  // Several backend engines use a sport-agnostic field for "the stat value
  // for this match" — but not all of them spell it the same way. `val` was
  // the first one seen; `nfl_quarter_trend` (the 1h/q1-scoped trend engine)
  // spells the identical concept `value` instead (confirmed against a real
  // response — every match had `value: 163`-style entries with no `val`,
  // `pass_yds`, or period-prefixed field at all, so extraction silently
  // failed for 100% of rows until this was added). Prefer both over the
  // STAT_FIELDS-based lookup below.
  if (match.val !== undefined) {
    return asNumber(match.val)
  }
  if (match.value !== undefined) {
    return asNumber(match.value)
  }
  const field = STAT_FIELDS[ctx.sport]?.[ctx.stat]
  if (Array.isArray(field)) {
    let sum = 0
    let anyPresent = false
    for (const f of field) {
      if (match[f] !== undefined) anyPresent = true
      sum += asNumber(match[f])
    }
    if (anyPresent) return sum
  } else if (field && match[field] !== undefined) {
    return asNumber(match[field])
  }
  // Period-scoped query (e.g. "q1 -pts") whose match object uses a
  // prefixed field name directly (e.g. "q1_points") rather than the plain
  // one STAT_FIELDS maps to. `periodField` covers the case where
  // detectStatContext saw the prefix in payload.query; if the query came
  // through as a plain token array instead (no object-form query.stat), that
  // never gets set, so also brute-force every known period prefix against
  // the plain field name before giving up — cheap, and only runs once val
  // and the plain field have both already failed.
  if (ctx.periodField && match[ctx.periodField] !== undefined) {
    return asNumber(match[ctx.periodField])
  }
  if (typeof field === 'string') {
    for (const prefix of ['q1', '1h', 'p1', 'h1', 'h2', 'q2', 'q3', 'q4']) {
      const key = `${prefix}_${field}`
      if (match[key] !== undefined) return asNumber(match[key])
    }
  }
  return null
}

export function extractTeamFromRow(row: Record<string, unknown>): string {
  const direct =
    (typeof row.team === 'string' && row.team) ||
    (typeof row.team_abbr === 'string' && row.team_abbr) ||
    (typeof row.teamAbbr === 'string' && row.teamAbbr) ||
    ''
  if (direct) return direct

  const matches = Array.isArray(row.matches) ? row.matches : []
  for (const m of matches) {
    if (m && typeof m === 'object' && !Array.isArray(m)) {
      const t = (m as Record<string, unknown>).team
      if (typeof t === 'string' && t) return t
    }
  }
  return ''
}

export function extractMatchDetails(row: Record<string, unknown>, ctx: StatContext | null): MatchDetail[] {
  if (!ctx) return []
  // Accept both `matches` (legacy) and `match` (new singular form).
  const matches = Array.isArray(row.matches)
    ? row.matches
    : Array.isArray(row.match)
    ? row.match
    : []
  const out: MatchDetail[] = []
  const label = ctx.unitLabel ?? STAT_DISPLAY_LABELS[ctx.stat] ?? ctx.stat

  for (const m of matches) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) continue
    const rec = m as Record<string, unknown>
    const value = computeMatchValue(rec, ctx)
    const dateRaw =
      typeof rec.date_iso === 'string' ? rec.date_iso : typeof rec.date === 'string' ? rec.date : ''
    const date = extractDateToken(dateRaw) ?? ''
    if (value === null || !date) continue
    out.push({ value, date, statLabel: label })
  }
  return out
}

export function normalizeQueryResults(payload: ApiPayload, fallbackQuery = ''): QueryResult[] {
  const statContext = detectStatContext(payload, fallbackQuery)
  let envelope = extractResultArray(payload)
  let outputText = ''

  if (!Array.isArray(payload) && payload && typeof payload === 'object') {
    const payloadOutput = (payload as Record<string, unknown>)?.output
    if (typeof payloadOutput === 'string') {
      outputText = payloadOutput
    }
  }

  if (envelope.length === 0 && !Array.isArray(payload) && typeof payload === 'object') {
    const output = (payload as Record<string, unknown>)?.output
    if (typeof output === 'string') {
      const parsedOutput = extractEnvelopeFromText(output)
      if (parsedOutput) {
        envelope = extractResultArray(parsedOutput)
      }
    }
  }

  const streakDetailsByPlayer = outputText ? parseStreakDetailsFromOutput(outputText) : {}

  return envelope
    .map((item): QueryResult | null => {
      if (Array.isArray(item)) {
        const [playerCandidate, totalCandidate] = item
        if (typeof playerCandidate === 'string' && playerCandidate.trim()) {
          return {
            player: normalizeDisplayPlayer(playerCandidate),
            total: asNumber(totalCandidate),
          }
        }

        return null
      }

      if (!item || typeof item !== 'object') {
        return null
      }

      const row = item as Record<string, unknown>
      const playerFromNotes = parsePlayerFromNotes(row.notes)
      const gamesFromNotes = parseGamesFromNotes(row.notes)
      const matchesCount = Array.isArray(row.matches)
        ? row.matches.length
        : Array.isArray(row.match)
        ? row.match.length
        : null
      const playerCandidateRaw =
        row.player ??
        row.name ??
        row.athlete ??
        row.player_name ??
        row.playerName ??
        row.full_name ??
        row.label ??
        playerFromNotes
      const playerCandidate =
        typeof playerCandidateRaw === 'string'
          ? normalizeDisplayPlayer(playerCandidateRaw)
          : playerCandidateRaw

      const rowStreakDetails = extractStreakDetails(row)
      const outputStreakDetails =
        typeof playerCandidate === 'string' && playerCandidate.trim()
          ? streakDetailsByPlayer[normalizePlayerKey(playerCandidate)] ?? []
          : []
      const streakDetails = rowStreakDetails.length > 0 ? rowStreakDetails : outputStreakDetails
      const matchDetails = extractMatchDetails(row, statContext)
      const team = extractTeamFromRow(row)
      const windowRaw = row.window ?? row.last
      const windowSize = typeof windowRaw === 'number' ? windowRaw : windowRaw != null ? asNumber(windowRaw) : undefined

      const totalCandidate =
        row.total ??
        row.value ??
        row.count ??
        row.met ??
        row.hits ??
        row.stat_total ??
        row.statTotal ??
        row.result ??
        matchesCount ??
        gamesFromNotes

      if (typeof playerCandidate !== 'string' || !playerCandidate.trim()) {
        return null
      }

      return {
        player: playerCandidate,
        total: asNumber(totalCandidate) || streakDetails.length || matchDetails.length,
        team: team || undefined,
        streakDetails: streakDetails.length > 0 ? streakDetails : undefined,
        matchDetails: matchDetails.length > 0 ? matchDetails : undefined,
        hasMatchArray: matchesCount != null,
        windowSize,
      }
    })
    .filter((row): row is QueryResult => row !== null)
}
