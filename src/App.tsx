import { useState, useEffect, useRef } from 'react'
import hitlistData from '@/assets/data/hitlist.json'
import leaderboardData from '@/assets/data/leaderboard.json'
import madeitLogo from '@/assets/images/madeit-tech-logo-v2.jpeg'
import { useIsMobile } from '@/hooks/use-mobile'
import { QueryBuilder } from '@/components/QueryBuilder'
import { QueryBuilderTutorial } from '@/components/QueryBuilderTutorial'

function joinUrl(base: string, endpoint: string): string {
  if (!base) {
    return endpoint
  }

  return `${base.replace(/\/$/, '')}${endpoint}`
}

function uniqueNonEmpty(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const value of values) {
    if (!value) {
      continue
    }

    const normalized = value.trim().replace(/\/$/, '')
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    out.push(normalized)
  }

  return out
}

function shouldUseSameOriginApi(): boolean {
  const forced = String(import.meta.env.VITE_USE_SAME_ORIGIN_API || '').toLowerCase()
  if (forced === 'true') {
    return true
  }

  if (forced === 'false') {
    return false
  }

  const host = window.location.hostname.toLowerCase()
  return host === 'localhost' || host === '127.0.0.1'
}

function buildApiBaseCandidates(): string[] {
  const sameOriginApi = shouldUseSameOriginApi() ? `${window.location.origin}/api` : null

  return uniqueNonEmpty([
    (window as any).NSPE_API_BASE,
    import.meta.env.VITE_NSPE_API_BASE,
    sameOriginApi,
    'https://api.nspe.dev',
  ])
}

function buildRunEndpoints(bases: string[]): string[] {
  return bases.map((base) => joinUrl(base, '/run'))
}

const API_BASE_CANDIDATES = buildApiBaseCandidates()
const CONFIGURED_API_BASE = API_BASE_CANDIDATES[0] || 'https://api.nspe.dev'
const RUN_ENDPOINTS = buildRunEndpoints(API_BASE_CANDIDATES)

async function fetchFirstSuccessful(
  urls: string[],
  init: RequestInit,
  timeoutMs: number,
): Promise<{ response: Response; url: string }> {
  const failures: string[] = []

  for (const url of urls) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      })

      if (!response.ok) {
        failures.push(`${url} -> HTTP ${response.status} ${response.statusText}`.trim())
        continue
      }

      return { response, url }
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error'
      const onlineState = navigator.onLine ? 'online' : 'offline'
      failures.push(`${url} -> ${reason} (browser ${onlineState})`)
    } finally {
      window.clearTimeout(timeout)
    }
  }

  throw new Error(`No API endpoint responded successfully. Attempts: ${failures.join(' | ')}`)
}

const STARFIELD_CHARS = ['$', '*', '+', '⋇', '𝛯', '☼', '➲','✦','⚛︎','⚇']

const TERMINAL_COLORS = [
  'oklch(0.95 0 0)',
  'oklch(0.85 0.15 195)',
  'oklch(0.75 0.15 145)',
  'oklch(0.65 0.15 250)',
]

const PLACEHOLDER_TEXTS = [
  'What do you need to know?',
  'Search stats like the pros',
  '{SPORTS}{WORLD} IS YOURS',
]

const COMMAND_EXAMPLES = [
  {
    command: 'nba -pts30 -last3/5',
    description: 'Players with 30+ points in 3 of their last 5 games',
  },
  {
    command: 'nhl -pts min100 -season',
    description: 'Skaters with 100+ points this season',
  },
  {
    command: 'nba -ast10 -last7/10',
    description: 'Players with 10+ assists in 7 of their last 10 games',
  },
  {
    command: 'mlb -dub -last3/5',
    description: 'Batters with a double in 3 of their last 5 games',
  },
  {
    command: 'nba -pts min1500 -season',
    description: 'Players with 1500+ points this season',
  },
  {
    command: 'nba -reb min100 -last10',
    description: 'Players with 100+ rebounds in their last 10 games',
  },
]

const SAMPLE_COMMANDS: Array<{ label: string; command: string; comingSoon?: boolean }> = [
  { label: 'nspe nba post -pts/-ast350 -last10', command: 'nspe nba post -pts/-ast350 -last10' },
  { label: 'nspe nba post 1h -pts15 -last3/5', command: 'nspe nba post 1h -pts15 -last3/5' },
  { label: 'nspe nba post q1 -tpm2 -last2/5', command: 'nspe nba post q1 -tpm2 -last2/5' },
  { label: 'nspe nba -ast8 -last8/10', command: 'nspe nba -ast8 -last8/10' },
  { label: 'nspe nba -pts30 -streak5', command: 'nspe nba -pts30 -streak5' },
  { label: 'nspe nhl post -g1 -last3/5', command: 'nspe nhl post -g1 -last3/5' },
  { label: 'nspe nhl post p1 -pts1 -last3/5', command: 'nspe nhl post p1 -pts1 -last3/5' },
  { label: 'nspe nhl -pts min80 -season', command: 'nspe nhl -pts min80 -season' },
  { label: 'nspe mlb -hits2 -last3/5', command: 'nspe mlb -hits2 -last3/5' },
  { label: 'nspe mlb -hr -streak3', command: 'nspe mlb -hr -streak3' },
  { label: 'nspe mlb -tb2 -last3/5', command: 'nspe mlb -tb2 -last3/5' },
  { label: 'nspe mlb -tb min20 -last10', command: 'nspe mlb -tb min20 -last10' },
  { label: 'nspe mlb -tb2 -streak5', command: 'nspe mlb -tb2 -streak5' },
  { label: 'nspe mlb shohei ohtani vs SF', command: 'nspe mlb shohei ohtani vs SF' },
  { label: 'nspe mlb pitch wheeler -vfp', command: 'nspe mlb pitch wheeler -vfp' },
  { label: 'nspe mlb pitch skenes -outs', command: 'nspe mlb pitch skenes -outs' },
  { label: 'nspe mlb pitch gavin -3down', command: 'nspe mlb pitch gavin -3down' },
  { label: 'nspe mlb bat LAD -outs -season', command: 'nspe mlb bat LAD -outs -season' },
  { label: 'nspe mlb LAD -ov -season', command: 'nspe mlb LAD -ov -season' },
  { label: 'nspe mlb -report', command: 'nspe mlb -report' },
  { label: 'nspe mlb -report -last5', command: 'nspe mlb -report -last5' },
  { label: 'nspe mlb DH -report -season', command: 'nspe mlb DH -report -season' },
  { label: 'nspe mlb juan soto -report -last20', command: 'nspe mlb juan soto -report -last20' },
  { label: 'nspe nfl long pass -yds30 -last2/5', command: 'nspe nfl long pass -yds30 -last2/5' },
  { label: 'nspe nfl long rush -yds20 -last3/5', command: 'nspe nfl long rush -yds20 -last3/5' },
  { label: 'nspe nfl long rec -yds40 -last3/5', command: 'nspe nfl long rec -yds40 -last3/5' },
  { label: 'nspe nfl rush -yds100 -last3/5', command: 'nspe nfl rush -yds100 -last3/5' },
  { label: 'nspe nfl pass -yds250 -last2/5', command: 'nspe nfl pass -yds250 -last2/5' },
  { label: 'nspe nfl -rush min800 -season', command: 'nspe nfl -rush min800 -season' },
  { label: 'nspe nfl -rec min1000 -season', command: 'nspe nfl -rec min1000 -season' },
]

interface QueryResult {
  player: string
  total: number
  team?: string
  streakDetails?: StreakDetail[]
  matchDetails?: MatchDetail[]
}

interface StreakDetail {
  length: number
  start: string
  end: string
}

interface MatchDetail {
  value: number
  date: string
  statLabel: string
}

interface H2hGame {
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

interface H2hTotals {
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

interface H2hPayload {
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
}

function isH2hPayload(payload: unknown): payload is H2hPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  const engine = typeof rec.engine === 'string' ? rec.engine : ''
  // Pitcher h2h has its own dedicated view.
  if (engine === 'mlb-pitch-h2h') return false
  return engine.endsWith('-h2h') && typeof rec.totals === 'object' && Array.isArray(rec.games)
}

// h2h responses may arrive either as a top-level JSON object or wrapped inside
// the standard envelope as `{ output: "<json string>", ... }`. Try both shapes.
function extractH2hPayload(payload: unknown): H2hPayload | null {
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

interface MlbPitchGame {
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

interface MlbPitchTotals {
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

interface MlbPitchRates {
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

interface MlbFirstPitchSummary {
  avg?: number
  min?: number
  max?: number
  median?: number
  pitch_types?: Record<string, number>
}

interface MlbPitchUpdown {
  target?: string
  matches?: number
  per_game?: boolean[]
}

interface MlbPitchH2hPayload {
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

function isMlbPitchH2hPayload(payload: unknown): payload is MlbPitchH2hPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.engine === 'mlb-pitch-h2h' && Array.isArray(rec.games)
}

function extractMlbPitchH2hPayload(payload: unknown): MlbPitchH2hPayload | null {
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

interface MlbPitchFpvGame {
  date_iso?: string
  opponent_team?: string
  home_away?: string
  fpv?: number | null
  pitch_type?: string
  inning?: number
  batter_play?: string
}

interface MlbPitchFpvSummary {
  avg_fpv?: number
  min_fpv?: number
  max_fpv?: number
  first_pitch_types?: Record<string, number>
  count?: number
}

interface MlbPitchFpvPayload {
  engine: 'mlb-pitch-fpv'
  player?: string
  window?: string
  generated_at?: string
  games: MlbPitchFpvGame[]
  summary?: MlbPitchFpvSummary
}

function isMlbPitchFpvPayload(payload: unknown): payload is MlbPitchFpvPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.engine === 'mlb-pitch-fpv' && Array.isArray(rec.games)
}

function extractMlbPitchFpvPayload(payload: unknown): MlbPitchFpvPayload | null {
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

interface MlbBatTeamPayload {
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

function isMlbBatTeamPayload(payload: unknown): payload is MlbBatTeamPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.engine === 'mlb-bat-team' && typeof rec.rates === 'object'
}

function extractMlbBatTeamPayload(payload: unknown): MlbBatTeamPayload | null {
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

interface MlbTeamOverviewPayload {
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

function isMlbTeamOverviewPayload(payload: unknown): payload is MlbTeamOverviewPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.engine === 'mlb-team-overview'
}

function extractMlbTeamOverviewPayload(payload: unknown): MlbTeamOverviewPayload | null {
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

interface MlbReportLeaderboardRow {
  player: string
  player_key: string
  team: string
  grade: string
  score: number
  games: number
  rates: Record<string, number>
  last_game: string
}

interface MlbReportLeaderboardPayload {
  kind: 'mlb_report_leaderboard'
  generated_at: string
  query: { window: number; is_season: boolean; top_n: number }
  rows: MlbReportLeaderboardRow[]
  grade_buckets: Array<{ min: number; grade: string }>
  weights: Record<string, number>
}

function isMlbReportLeaderboardPayload(payload: unknown): payload is MlbReportLeaderboardPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.kind === 'mlb_report_leaderboard' && Array.isArray(rec.rows)
}

function extractMlbReportLeaderboardPayload(payload: unknown): MlbReportLeaderboardPayload | null {
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

interface MlbPlayerReportBreakdown {
  label: string
  rate: number
  weight: number
  points: number
}

interface MlbPlayerReportData {
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

interface MlbPlayerReportPayload {
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

function isMlbPlayerReportPayload(payload: unknown): payload is MlbPlayerReportPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.kind === 'mlb_player_report' && typeof rec.report === 'object'
}

function extractMlbPlayerReportPayload(payload: unknown): MlbPlayerReportPayload | null {
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

interface NflExplosiveMatch {
  date: string
  value: number
  count: number
  yards: number[]
}

interface NflExplosiveResult {
  player: string
  met: number
  matches: NflExplosiveMatch[]
  last: number
  threshold: number
  team?: string
}

interface NflExplosivePayload {
  sport: string
  query: string[]
  results: NflExplosiveResult[]
}

function isNflExplosivePayload(payload: unknown): payload is NflExplosivePayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const p = payload as Record<string, unknown>
  // Catch both intentional 'long' explosive queries AND non-long queries that
  // the backend still routes to the explosive/PBP handler (array query format).
  return (
    p.sport === 'nfl' &&
    Array.isArray(p.query) &&
    Array.isArray(p.results)
  )
}

interface StatContext {
  sport: string
  stat: string
}

const STAT_FIELDS: Record<string, Record<string, string | string[]>> = {
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
  },
}

const STAT_DISPLAY_LABELS: Record<string, string> = {
  tpm: '3pm',
  total: 'tot',
  tb: 'tb',
}

// Insert a space before any internal capital (e.g. "AaronJudge" -> "Aaron Judge").
// Leaves already-spaced names untouched.
function normalizeDisplayPlayer(player: string): string {
  const trimmed = player.trim()
  if (!trimmed || trimmed.includes(' ')) return trimmed
  return trimmed.replace(/([a-z])([A-Z])/g, '$1 $2')
}

// Static player → team lookup built from bundled data sources.
// Used as a fallback when live API query results don't include team.
const PLAYER_TEAM_MAP: Map<string, string> = (() => {
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

type ApiPayload = Record<string, unknown> | unknown[]

interface Star {
  char: string
  x: number
  y: number
  color: string
  opacity: number
}

interface HitlistEntry {
  player?: string
  team?: string
  stat?: string
  values?: number[]
  threshold?: number
  window?: string
  hit_dates?: string[]
  games_meeting?: number
  window_games?: number
  raw?: string
}

const STAT_LABELS: Record<string, string> = {
  tpm: '3pm',
  reb: 'reb',
  stl: 'stl',
  ast: 'ast',
}

interface GlossaryEntry {
  term: string
  meaning: string
}

const GLOSSARY_STATS: { sport: string; entries: GlossaryEntry[] }[] = [
  {
    sport: 'nba',
    entries: [
      { term: 'pts', meaning: 'Points' },
      { term: 'reb', meaning: 'Rebounds' },
      { term: 'ast', meaning: 'Assists' },
      { term: 'stl', meaning: 'Steals' },
      { term: 'blk', meaning: 'Blocks' },
      { term: 'tpm / 3pm', meaning: 'Three-Pointers Made' },
      { term: 'pts+ast', meaning: 'Points + Assists combined' },
      { term: 'pts+reb', meaning: 'Points + Rebounds combined' },
      { term: 'reb+ast', meaning: 'Rebounds + Assists combined' },
      { term: 'total', meaning: 'Points + Rebounds + Assists' },
      { term: 'q1 / q2 / q3 / q4', meaning: 'By quarter (e.g. q1 -pts10)' },
      { term: '1h', meaning: 'First half' },
    ],
  },
  {
    sport: 'nhl',
    entries: [
      { term: 'g', meaning: 'Goals' },
      { term: 'a', meaning: 'Assists' },
      { term: 'pts', meaning: 'Points (Goals + Assists)' },
      { term: 'sog', meaning: 'Shots On Goal' },
      { term: 'blk', meaning: 'Blocks' },
      { term: 'pim', meaning: 'Penalty Minutes' },
      { term: 'p1 / p2 / p3', meaning: 'By period' },
    ],
  },
  {
    sport: 'mlb',
    entries: [
      { term: 'hits', meaning: 'Hits' },
      { term: 'hr', meaning: 'Home Runs' },
      { term: 'rbi', meaning: 'Runs Batted In' },
      { term: 'dub', meaning: 'Doubles (2B)' },
      { term: 'trp', meaning: 'Triples (3B)' },
      { term: 'tb', meaning: 'Total Bases' },
      { term: 'sb', meaning: 'Stolen Bases' },
      { term: 'k', meaning: 'Strikeouts' },
      { term: 'bb', meaning: 'Walks (Base on Balls)' },
    ],
  },
]

const GLOSSARY_QUERY: GlossaryEntry[] = [
  { term: '-statN', meaning: 'Per-game threshold (e.g. -pts30 = 30+ points in a game)' },
  { term: '-stat minN', meaning: 'Season/window total (e.g. -pts min1500)' },
  { term: '-lastN', meaning: 'Look back across the player\'s last N games' },
  { term: '-lastM/N', meaning: 'M of the last N games meeting the threshold' },
  { term: '-streakN', meaning: 'Active streak of N+ consecutive games meeting the threshold' },
  { term: '-season', meaning: 'Use the full current season window' },
  { term: 'post', meaning: 'Postseason / playoff scope' },
]

const GLOSSARY_LEADERBOARD: GlossaryEntry[] = [
  { term: 'Rank', meaning: 'Position in the top list (sorted by Score)' },
  { term: 'Player / Team', meaning: 'Player name and team abbreviation' },
  { term: 'Label(N)', meaning: 'Active streak type with (N) = number of games the streak is currently on' },
  { term: '★', meaning: 'Top 3 indicator' },
  { term: 'Score', meaning: 'Composite ranking value combining streak length, type weight, and recent form' },
]

const GLOSSARY_STREAK_LABELS: GlossaryEntry[] = [
  { term: 'HR', meaning: 'Home Run streak — HR in each game' },
  { term: '2TB', meaning: '2+ Total Bases in each game' },
  { term: 'Hit', meaning: 'Hit streak — at least one hit each game' },
  { term: '2H', meaning: '2+ Hits in each game' },
  { term: 'OB', meaning: 'On-Base streak — reached base each game' },
  { term: '2R', meaning: '2+ Runs scored in each game' },
  { term: '2RBI', meaning: '2+ RBI in each game' },
]

function formatTickerEntry(entry: HitlistEntry): string {
  if (entry.raw) {
    return entry.raw
  }

  const statLabel = entry.stat ? (STAT_LABELS[entry.stat] || entry.stat) : ''

  // MLB-leaderboard style: team + player + {Nstat MG <window>}
  if (entry.team && typeof entry.games_meeting === 'number') {
    const windowSuffix =
      typeof entry.window_games === 'number' ? `L${entry.window_games}` : 'season'
    const tag = `{${entry.threshold ?? ''}${statLabel} ${entry.games_meeting}G ${windowSuffix}}`
    return `${entry.team} ${entry.player ?? ''} ${tag}`.trim()
  }

  // Legacy per-player rolling entries
  const windowPart = entry.window ? ` last${entry.window}` : ''
  const header = `{${statLabel}${entry.threshold ?? ''}${windowPart}}`
  const dates = entry.hit_dates ?? []
  const values = entry.values ?? []
  const pairs = dates.map((date, i) => {
    const value = values[i]
    return `"${date}" {${value ?? ''}}`
  })

  return `${entry.player ?? ''} ${header} ${pairs.join(', ')}`.trim()
}

interface LeaderboardRow {
  player: string
  team: string
  streak_type: string
  streak_label: string
  streak_length: number
  streak_active: boolean
  avg: number
  hits: number
  at_bats: number
  score: number
}

interface LeaderboardPayload {
  kind: string
  generated_at: string
  thresholds?: Record<string, number>
  rows: LeaderboardRow[]
}

function formatLeaderboardDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function leaderboardSportLabel(kind: string): string {
  const m = /^([a-z]+)_leaderboard$/i.exec(kind)
  return m ? m[1].toLowerCase() : kind
}

function normalizeLeaderboardPlayer(name: string): string {
  if (!name) return ''
  if (name.includes(' ')) return name
  return name.replace(/([a-z])([A-Z])/g, '$1 $2')
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

function parsePlayerFromNotes(notes: unknown): string | null {
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

function parseGamesFromNotes(notes: unknown): number | null {
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

function extractDateToken(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  // ISO form like "2026-05-25" or "2026-05-25T...": normalize to M/D for display.
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const month = Number(iso[2])
    const day = Number(iso[3])
    if (Number.isFinite(month) && Number.isFinite(day)) {
      return `${month}/${day}`
    }
  }

  const match = value.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/)
  return match ? match[1] : null
}

function toStreakDetailFromRecord(record: Record<string, unknown>): StreakDetail | null {
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
function parseStringStreak(value: string): StreakDetail | null {
  const match = value.match(
    /(\d+)\s*game\s*streak\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*-\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
  )
  if (!match) return null
  const length = Number(match[1])
  if (!Number.isFinite(length) || length <= 0) return null
  return { length, start: match[2], end: match[3] }
}

function extractStreakDetails(row: Record<string, unknown>): StreakDetail[] {
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

function normalizePlayerKey(player: string): string {
  return player.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseStreakDetailsFromOutput(output: string): Record<string, StreakDetail[]> {
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

function extractResultArray(payload: ApiPayload): unknown[] {
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

function detectStatContext(payload: ApiPayload, fallbackQuery: string): StatContext | null {
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

  const knownStats = Object.keys(STAT_FIELDS[sport]).sort((a, b) => b.length - a.length)
  if (queryStat && knownStats.includes(queryStat)) {
    return { sport, stat: queryStat }
  }

  // Period-prefixed stats like "q1_points", "1h_points", "p1_goals": strip the
  // prefix and reverse-map the canonical field name back to its short code.
  if (queryStat) {
    const stripped = queryStat.replace(/^(q1|1h|p1|h1|h2|q2|q3|q4)_/, '')
    if (knownStats.includes(stripped)) {
      return { sport, stat: stripped }
    }
    const fields = STAT_FIELDS[sport]
    for (const [short, fld] of Object.entries(fields)) {
      if (typeof fld === 'string' && fld === stripped) {
        return { sport, stat: short }
      }
    }
  }
  for (const tok of tokens) {
    const lower = tok.toLowerCase()
    for (const s of knownStats) {
      if (lower.startsWith(s) && /^[a-z]+/i.test(lower)) {
        return { sport, stat: s }
      }
    }
  }
  return null
}

function computeMatchValue(match: Record<string, unknown>, ctx: StatContext): number | null {
  // New backend shape uses a sport-agnostic `val` field; prefer it when present.
  if (match.val !== undefined) {
    return asNumber(match.val)
  }
  const field = STAT_FIELDS[ctx.sport]?.[ctx.stat]
  if (!field) return null
  if (Array.isArray(field)) {
    let sum = 0
    let anyPresent = false
    for (const f of field) {
      if (match[f] !== undefined) anyPresent = true
      sum += asNumber(match[f])
    }
    return anyPresent ? sum : null
  }
  if (match[field] === undefined) return null
  return asNumber(match[field])
}

function extractTeamFromRow(row: Record<string, unknown>): string {
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

function extractMatchDetails(row: Record<string, unknown>, ctx: StatContext | null): MatchDetail[] {
  if (!ctx) return []
  // Accept both `matches` (legacy) and `match` (new singular form).
  const matches = Array.isArray(row.matches)
    ? row.matches
    : Array.isArray(row.match)
    ? row.match
    : []
  const out: MatchDetail[] = []
  const label = STAT_DISPLAY_LABELS[ctx.stat] ?? ctx.stat

  for (const m of matches) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) continue
    const rec = m as Record<string, unknown>
    const value = computeMatchValue(rec, ctx)
    const dateRaw = typeof rec.date === 'string' ? rec.date : ''
    const date = extractDateToken(dateRaw) ?? ''
    if (value === null || !date) continue
    out.push({ value, date, statLabel: label })
  }
  return out
}

function normalizeQueryResults(payload: ApiPayload, fallbackQuery = ''): QueryResult[] {
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
    .map((item) => {
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
      }
    })
    .filter((row): row is QueryResult => row !== null)
}

function sanitizeQueryForApi(query: string): string {
  return query.trim().replace(/^nspe\s+/i, '')
}

function getPayloadError(payload: ApiPayload): string | null {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>
  const exitCode = asNumber(record.exit_code)
  const output = typeof record.output === 'string' ? record.output.trim() : ''

  if (exitCode !== 0 && output) {
    return output
  }

  return null
}

function formatQueryError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Load failed: request timed out while waiting for backend response.'
  }

  if (error instanceof TypeError) {
    return `Load failed: browser could not complete network request to ${CONFIGURED_API_BASE} (possible CORS, DNS, SSL, WAF, extension, or mixed-content policy issue).`
  }

  if (error instanceof Error) {
    if (error.message.startsWith('No API endpoint responded successfully.')) {
      return `${error.message} Check browser DevTools Network/Console for blocked-request details from ${window.location.origin}.`
    }

    return error.message
  }

  return 'Unknown query error'
}

function extractEnvelopeFromText(text: string): ApiPayload | null {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && (typeof parsed === 'object' || Array.isArray(parsed))) {
      return parsed as ApiPayload
    }
  } catch {
    // Continue with line-by-line extraction.
  }

  const lines = trimmed.split(/\r?\n/)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim()
    if (!line || (!line.startsWith('{') && !line.startsWith('['))) {
      continue
    }

    try {
      const parsed = JSON.parse(line)
      if (parsed && (typeof parsed === 'object' || Array.isArray(parsed))) {
        return parsed as ApiPayload
      }
    } catch {
      // Not valid JSON on this line; continue scanning upward.
    }
  }

  return null
}

async function parseApiPayload(response: Response): Promise<ApiPayload> {
  const fallbackResponse = response.clone()

  try {
    return await response.json()
  } catch {
    const textPayload = await fallbackResponse.text()
    const parsedOutput = extractEnvelopeFromText(textPayload)

    if (parsedOutput) {
      if (Array.isArray(parsedOutput)) {
        return parsedOutput
      }

      return {
        ...parsedOutput,
        output: textPayload,
      }
    }

    return { results: [] as unknown[], output: textPayload }
  }
}

// ---------------- NFL explosive view ----------------

function NflExplosiveView({ payload }: { payload: NflExplosivePayload }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const results = payload.results
  const isLongQuery = (payload.query as string[]).includes('long')

  // Detect threshold=0 responses: backend routed a non-long query to the
  // explosive/PBP handler. These results are meaningless (all players
  // "appeared" in plays with 0 yards). Show an error instead.
  const firstThreshold = results[0]?.threshold ?? -1
  if (!isLongQuery && firstThreshold === 0) {
    return (
      <div className="text-center py-8 font-mono text-[13px] space-y-2" style={{ color: 'oklch(0.70 0 0)' }}>
        <div>query format not supported via api</div>
        <div className="text-[11px]" style={{ color: 'oklch(0.50 0 0)' }}>
          per-game nfl trend queries require a different backend route.
          use explosive mode ({'{'}nfl long pass/rush/rec{'}'}) for play-by-play queries.
        </div>
      </div>
    )
  }

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <div className="space-y-0">
      {results.map((r, i) => {
        const isOpen = expanded.has(i)
        return (
          <div key={i} className="py-2 border-b" style={{ borderColor: 'oklch(0.22 0 0)' }}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[13px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
                {r.team && (
                  <>
                    <span style={{ color: 'oklch(0.70 0.10 195)' }}>{r.team}</span>
                    <span style={{ color: 'oklch(0.55 0 0)' }}>{' — '}</span>
                  </>
                )}
                {normalizeDisplayPlayer(r.player)}
              </span>
              <button
                type="button"
                onClick={() => toggle(i)}
                className="font-mono font-bold text-[13px] ml-4 shrink-0 px-2 py-0.5 rounded border"
                style={{
                  backgroundColor: isOpen ? 'oklch(0.27 0.03 145)' : 'oklch(0.22 0 0)',
                  color: 'oklch(0.85 0.15 145)',
                  borderColor: 'oklch(0.35 0 0)',
                  cursor: 'pointer',
                }}
              >
                {r.met}
              </button>
            </div>
            {isOpen && (
              <div className="mt-2 space-y-1 pl-2">
                {r.matches.map((m, j) => (
                  <div key={j} className="font-mono text-[12px]" style={{ color: 'oklch(0.76 0 0)' }}>
                    <span style={{ color: 'oklch(0.60 0 0)' }}>{m.date}</span>
                    <span style={{ color: 'oklch(0.45 0 0)' }}>{' · '}</span>
                    <span style={{ color: 'oklch(0.85 0.15 145)' }}>
                      {m.yards.join(', ')}yds
                    </span>
                    {m.count > 1 && (
                      <span style={{ color: 'oklch(0.50 0 0)' }}> ({m.count} plays)</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function H2hView({ payload }: { payload: H2hPayload }) {
  const q = payload.query ?? {}
  const t = payload.totals ?? {}
  const games = payload.games ?? []

  const playerLabel = q.player_display || q.player_query || 'player'
  const playerTeam = q.player_team || ''
  const opponent = q.opponent_code || ''
  const venueLabel =
    q.home_away === 'home' ? '@ home' : q.home_away === 'away' ? 'on the road' : 'home & away'
  const windowLabel = q.window_label || (q.year ? `(${q.year})` : '')

  const formatAvg = (n?: number) => (typeof n === 'number' ? n.toFixed(3).replace(/^0+/, '') : '—')

  const slashLine: { label: string; value: string }[] = [
    { label: 'AVG', value: formatAvg(t.AVG) },
    { label: 'OBP', value: formatAvg(t.OBP) },
    { label: 'SLG', value: formatAvg(t.SLG) },
    { label: 'OPS', value: formatAvg(t.OPS) },
  ]

  const counting: { label: string; value: number }[] = [
    { label: 'G', value: t.games ?? 0 },
    { label: 'AB', value: t.AB ?? 0 },
    { label: 'H', value: t.H ?? 0 },
    { label: 'R', value: t.R ?? 0 },
    { label: 'HR', value: t.HR ?? 0 },
    { label: 'RBI', value: t.RBI ?? 0 },
    { label: 'TB', value: t.TB ?? 0 },
    { label: '2B', value: t['2B'] ?? 0 },
    { label: '3B', value: t['3B'] ?? 0 },
    { label: 'BB', value: t.BB ?? 0 },
    { label: 'SO', value: t.SO ?? 0 },
    { label: 'SB', value: t.SB ?? 0 },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="font-mono text-[13px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
        {playerTeam ? (
          <>
            <span style={{ color: 'oklch(0.70 0.10 195)' }}>{playerTeam}</span>
            <span style={{ color: 'oklch(0.55 0 0)' }}>{' — '}</span>
          </>
        ) : null}
        <span>{playerLabel}</span>
        <span style={{ color: 'oklch(0.55 0 0)' }}> vs </span>
        <span style={{ color: 'oklch(0.70 0.10 195)' }}>{opponent || '—'}</span>
        <span style={{ color: 'oklch(0.55 0 0)' }}>{` · ${venueLabel}${windowLabel ? ` · ${windowLabel}` : ''}`}</span>
      </div>

      {/* Totals card */}
      <div
        className="rounded p-3"
        style={{ backgroundColor: 'oklch(0.18 0 0)', border: '1px solid oklch(0.28 0 0)' }}
      >
        <div className="grid grid-cols-4 gap-2 mb-3">
          {slashLine.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.55 0 0)' }}>
                {s.label}
              </span>
              <span className="font-mono font-bold text-[15px]" style={{ color: 'oklch(0.85 0.15 145)' }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-2">
          {counting.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.48 0 0)' }}>
                {s.label}
              </span>
              <span className="font-mono text-[13px]" style={{ color: 'oklch(0.88 0 0)' }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Game log */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'oklch(0.48 0 0)' }}>
          game log
        </div>
        {games.length === 0 ? (
          <div className="text-center py-4 font-mono text-[12px]" style={{ color: 'oklch(0.70 0 0)' }}>
            No games found in window
          </div>
        ) : (
          <div className="space-y-1.5">
            {games.map((g, i) => {
              const venuePrefix = g.venue === 'away' ? '@' : g.venue === 'home' ? 'vs' : ''
              const opp = g.opponent ?? ''
              const matchup = [venuePrefix, opp].filter(Boolean).join(' ')
              const line = [
                `${g.AB ?? 0} AB`,
                `${g.H ?? 0} H`,
                ...(g.HR ? [`${g.HR} HR`] : []),
                ...(g.RBI ? [`${g.RBI} RBI`] : []),
                ...(g.R ? [`${g.R} R`] : []),
                ...(g['2B'] ? [`${g['2B']} 2B`] : []),
                ...(g['3B'] ? [`${g['3B']} 3B`] : []),
                ...(g.BB ? [`${g.BB} BB`] : []),
                ...(g.SO ? [`${g.SO} SO`] : []),
                ...(g.SB ? [`${g.SB} SB`] : []),
              ].join(', ')
              return (
                <div
                  key={`${g.date_iso ?? g.date}-${i}`}
                  className="flex items-baseline justify-between py-1.5 border-b font-mono text-[12px]"
                  style={{ borderColor: 'oklch(0.22 0 0)' }}
                >
                  <span style={{ color: 'oklch(0.76 0 0)' }}>
                    <span style={{ color: 'oklch(0.55 0 0)' }}>{g.date}</span>
                    {matchup ? (
                      <>
                        <span style={{ color: 'oklch(0.40 0 0)' }}>{'  '}</span>
                        <span style={{ color: 'oklch(0.70 0.10 195)' }}>{matchup}</span>
                      </>
                    ) : null}
                  </span>
                  <span style={{ color: 'oklch(0.85 0.15 145)' }}>{line}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function formatIpFromOuts(outs?: number): string {
  if (typeof outs !== 'number' || outs <= 0) return '0.0'
  const whole = Math.floor(outs / 3)
  const rem = outs % 3
  return `${whole}.${rem}`
}

const PITCH_STAT_PILL = 'oklch(0.18 0 0)'
const PITCH_LABEL = 'oklch(0.55 0 0)'
const PITCH_VALUE = 'oklch(0.88 0 0)'
const PITCH_ACCENT = 'oklch(0.85 0.15 195)'
const PITCH_GREEN = 'oklch(0.85 0.15 145)'
const PITCH_BORDER = 'oklch(0.28 0 0)'

function StatBox({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-1.5 rounded" style={{ backgroundColor: PITCH_STAT_PILL, border: `1px solid ${PITCH_BORDER}` }}>
      <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: PITCH_LABEL }}>{label}</span>
      <span className="font-mono font-bold text-[13px]" style={{ color: accent ?? PITCH_VALUE }}>{value}</span>
    </div>
  )
}

const OUT_TYPE_LABELS: Array<[keyof Record<string, number>, string]> = [
  ['GO', 'Ground out'],
  ['FO', 'Fly out'],
  ['LO', 'Line out'],
  ['PO', 'Pop out'],
  ['FOUL_OUT', 'Foul out'],
  ['DP', 'Double play'],
  ['SAC_FLY', 'Sac fly'],
  ['SAC_BUNT', 'Sac bunt'],
  ['BUNT_OUT', 'Bunt out'],
  ['FORCE_OUT', 'Force out'],
  ['CS', 'Caught stealing'],
  ['PICKOFF', 'Pickoff'],
  ['TP', 'Triple play'],
  ['OTHER_OUT', 'Other'],
]

function OutTypeGrid({ outTypes, totalOuts }: { outTypes: Record<string, number>; totalOuts: number }) {
  const rows = OUT_TYPE_LABELS
    .map(([key, label]) => ({ key: key as string, label, value: outTypes[key as string] ?? 0 }))
    .filter((r) => r.value > 0)
  if (rows.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[12px]">
      {rows.map((r) => {
        const pct = totalOuts > 0 ? (r.value / totalOuts) * 100 : 0
        return (
          <div key={r.key} className="flex items-baseline justify-between">
            <span style={{ color: PITCH_VALUE }}>{r.label}</span>
            <span style={{ color: PITCH_LABEL }}>
              <span style={{ color: PITCH_VALUE }}>{r.value}</span>
              {totalOuts > 0 ? ` (${pct.toFixed(1)}%)` : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function PitchArsenalBars({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
  const total = entries.reduce((sum, [, v]) => sum + (v as number), 0)
  if (total === 0) return null
  const max = entries[0][1] as number
  return (
    <div className="space-y-1 font-mono text-[12px]">
      {entries.map(([name, count]) => {
        const pct = (count / total) * 100
        const widthPct = (count / max) * 100
        return (
          <div key={name} className="flex items-center gap-2">
            <span className="w-[120px] shrink-0" style={{ color: PITCH_VALUE }}>{name}</span>
            <span className="w-[34px] text-right tabular-nums" style={{ color: PITCH_LABEL }}>{count}</span>
            <span className="w-[52px] text-right tabular-nums" style={{ color: PITCH_LABEL }}>{pct.toFixed(1)}%</span>
            <div className="flex-1 h-[8px] rounded-sm" style={{ backgroundColor: 'oklch(0.16 0 0)' }}>
              <div className="h-full rounded-sm" style={{ width: `${widthPct}%`, backgroundColor: PITCH_ACCENT }} />
            </div>
          </div>
        )
      })}
      <div className="text-[10px] mt-1" style={{ color: PITCH_LABEL }}>{total} pitches total</div>
    </div>
  )
}

function MlbPitchH2hView({ payload, query }: { payload: MlbPitchH2hPayload; query?: string }) {
  const games = payload.games ?? []
  const totals = payload.totals ?? {}
  const rates = payload.rates ?? {}
  const out_types = payload.out_types ?? {}
  const pbp = payload.pbp_tally ?? {}
  const arsenal = payload.pitch_type_counts ?? {}
  const fp = payload.first_pitch_summary ?? {}
  const updown = payload.updown
  const hasUpdown = !!updown && typeof updown.target === 'string'
  const isOutsMode = !hasUpdown && typeof query === 'string' && /(?:^|\s)-outs(?:\s|$)/i.test(query)
  const mode: 'overview' | 'outs' | 'down' = hasUpdown ? 'down' : isOutsMode ? 'outs' : 'overview'

  const playerLabel = payload.player || 'pitcher'
  const opponent = payload.opponent || 'ALL'
  const yw = payload.year_window
  const yearLabel = yw ? (yw[0] === yw[1] ? `${yw[0]}` : `${yw[0]}–${yw[1]}`) : payload.career ? 'career' : ''

  const ip = formatIpFromOuts(totals.ip_outs)
  const totalOuts = rates.total_contact_outs ?? 0

  const header = (
    <div className="font-mono text-[13px]" style={{ color: PITCH_ACCENT }}>
      <span>{playerLabel}</span>
      <span style={{ color: PITCH_LABEL }}> vs </span>
      <span style={{ color: 'oklch(0.70 0.10 195)' }}>{opponent}</span>
      <span style={{ color: PITCH_LABEL }}>{` · ${games.length} game${games.length === 1 ? '' : 's'}${yearLabel ? ` · ${yearLabel}` : ''}${mode === 'outs' ? ' · contact outs' : mode === 'down' ? ` · ${updown!.target ?? 'updown'}` : ''}`}</span>
    </div>
  )

  if (mode === 'down') {
    const matches = typeof updown!.matches === 'number' ? updown!.matches : 0
    const total = updown!.per_game?.length ?? games.length
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
            {`${updown!.target ?? ''} match`}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <StatBox label="matches" value={matches} accent={PITCH_GREEN} />
            <StatBox label="games" value={total} />
            <StatBox label="hit %" value={total > 0 ? `${((matches / total) * 100).toFixed(1)}%` : '—'} accent={PITCH_ACCENT} />
            <StatBox label="miss" value={total - matches} />
          </div>
          {Array.isArray(updown!.per_game) && updown!.per_game.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {updown!.per_game.map((hit, i) => (
                <span
                  key={i}
                  className="inline-block w-[10px] h-[10px] rounded-sm"
                  style={{ backgroundColor: hit ? PITCH_GREEN : 'oklch(0.22 0 0)' }}
                  title={hit ? 'match' : 'miss'}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'outs') {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.18 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
            rate overview
          </div>
          <div className="grid grid-cols-4 gap-2">
            <StatBox label="K%" value={typeof rates.k_pct === 'number' ? rates.k_pct.toFixed(1) : '—'} accent={PITCH_GREEN} />
            <StatBox label="BB%" value={typeof rates.bb_pct === 'number' ? rates.bb_pct.toFixed(1) : '—'} />
            <StatBox label="HR%" value={typeof rates.hr_pct === 'number' ? rates.hr_pct.toFixed(1) : '—'} />
            <StatBox label="H%" value={typeof rates.h_pct === 'number' ? rates.h_pct.toFixed(1) : '—'} />
          </div>
        </div>
        {Object.keys(out_types).length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              contact outs {totalOuts > 0 ? `({${totalOuts}} total)` : ''}
            </div>
            <OutTypeGrid outTypes={out_types} totalOuts={totalOuts} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {header}

      {/* Totals */}
      <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.18 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
        <div className="grid grid-cols-4 gap-2 mb-2">
          <StatBox label="G" value={totals.games ?? games.length} />
          <StatBox label="IP" value={ip} />
          <StatBox label="K" value={totals.k ?? 0} accent={PITCH_GREEN} />
          <StatBox label="ERA" value={typeof rates.era === 'number' ? rates.era.toFixed(2) : '—'} accent={PITCH_GREEN} />
          <StatBox label="BB" value={totals.bb ?? 0} />
          <StatBox label="HR" value={totals.hr ?? 0} />
          <StatBox label="H" value={totals.h ?? 0} />
          <StatBox label="P" value={totals.pitches ?? 0} />
          <StatBox label="K/9" value={typeof rates.k9 === 'number' ? rates.k9.toFixed(2) : '—'} />
          <StatBox label="BB/9" value={typeof rates.bb9 === 'number' ? rates.bb9.toFixed(2) : '—'} />
          <StatBox label="HR/9" value={typeof rates.hr9 === 'number' ? rates.hr9.toFixed(2) : '—'} />
          <StatBox label="PA" value={rates.pa ?? 0} />
        </div>
        <div className="grid grid-cols-4 gap-2 font-mono text-[11px]" style={{ color: PITCH_LABEL }}>
          <div className="flex items-baseline gap-1.5"><span>K%</span><span style={{ color: PITCH_VALUE }}>{rates.k_pct?.toFixed(1) ?? '—'}</span></div>
          <div className="flex items-baseline gap-1.5"><span>BB%</span><span style={{ color: PITCH_VALUE }}>{rates.bb_pct?.toFixed(1) ?? '—'}</span></div>
          <div className="flex items-baseline gap-1.5"><span>HR%</span><span style={{ color: PITCH_VALUE }}>{rates.hr_pct?.toFixed(1) ?? '—'}</span></div>
          <div className="flex items-baseline gap-1.5"><span>H%</span><span style={{ color: PITCH_VALUE }}>{rates.h_pct?.toFixed(1) ?? '—'}</span></div>
        </div>
      </div>

      {/* Out types + Arsenal side-by-side on wide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.keys(out_types).length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              out types {totalOuts > 0 ? `({${totalOuts}} contact outs)` : ''}
            </div>
            <OutTypeGrid outTypes={out_types} totalOuts={totalOuts} />
          </div>
        )}
        {Object.keys(arsenal).length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              pitch arsenal
            </div>
            <PitchArsenalBars counts={arsenal} />
          </div>
        )}
      </div>

      {/* PBP + first-pitch */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.keys(pbp).length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              plate appearances
            </div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1 font-mono text-[12px]">
              {(['K', 'BB', 'H', 'HR', 'HBP', 'OUT', 'FC', 'ROE', 'OTHER'] as const).map((k) => (
                pbp[k] ? (
                  <div key={k} className="flex items-baseline justify-between">
                    <span style={{ color: PITCH_VALUE }}>{k}</span>
                    <span style={{ color: PITCH_VALUE }}>{pbp[k]}</span>
                  </div>
                ) : null
              ))}
            </div>
          </div>
        )}
        {(typeof fp.avg === 'number' || typeof fp.median === 'number') && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              first pitch
            </div>
            <div className="grid grid-cols-4 gap-2 font-mono text-[12px]">
              <StatBox label="avg" value={typeof fp.avg === 'number' ? fp.avg.toFixed(1) : '—'} accent={PITCH_ACCENT} />
              <StatBox label="med" value={typeof fp.median === 'number' ? fp.median.toFixed(1) : '—'} />
              <StatBox label="min" value={typeof fp.min === 'number' ? fp.min.toFixed(0) : '—'} />
              <StatBox label="max" value={typeof fp.max === 'number' ? fp.max.toFixed(0) : '—'} />
            </div>
            {fp.pitch_types && Object.keys(fp.pitch_types).length > 0 && (
              <div className="mt-2 font-mono text-[11px]" style={{ color: PITCH_LABEL }}>
                {Object.entries(fp.pitch_types).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Game log */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
          game log
        </div>
        {games.length === 0 ? (
          <div className="text-center py-3 font-mono text-[12px]" style={{ color: PITCH_VALUE }}>No games found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[12px] border-collapse">
              <thead>
                <tr style={{ color: PITCH_LABEL, borderBottom: `1px solid ${PITCH_BORDER}` }}>
                  <th className="text-left py-1 pr-2 font-normal">Date</th>
                  <th className="text-left py-1 pr-2 font-normal">Opp</th>
                  <th className="text-right py-1 pr-2 font-normal">IP</th>
                  <th className="text-right py-1 pr-2 font-normal">K</th>
                  <th className="text-right py-1 pr-2 font-normal">BB</th>
                  <th className="text-right py-1 pr-2 font-normal">HR</th>
                  <th className="text-right py-1 pr-2 font-normal">P</th>
                  <th className="text-right py-1 font-normal">VFP</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g, i) => (
                  <tr key={`${g.date_iso ?? g.date_display ?? i}`} style={{ borderBottom: '1px solid oklch(0.18 0 0)', color: PITCH_VALUE }}>
                    <td className="py-1 pr-2" style={{ color: PITCH_LABEL }}>{g.date_display ?? g.date_iso ?? ''}</td>
                    <td className="py-1 pr-2" style={{ color: 'oklch(0.70 0.10 195)' }}>{g.opponent_team ?? ''}</td>
                    <td className="py-1 pr-2 text-right">{g.ip ?? ''}</td>
                    <td className="py-1 pr-2 text-right" style={{ color: PITCH_GREEN }}>{g.k ?? 0}</td>
                    <td className="py-1 pr-2 text-right">{g.bb ?? 0}</td>
                    <td className="py-1 pr-2 text-right">{g.hr ?? 0}</td>
                    <td className="py-1 pr-2 text-right">{g.pitches ?? 0}</td>
                    <td className="py-1 text-right" style={{ color: PITCH_ACCENT }}>{typeof g.vfp === 'number' ? g.vfp.toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MlbPitchFpvView({ payload }: { payload: MlbPitchFpvPayload }) {
  const games = payload.games ?? []
  const summary = payload.summary ?? {}
  const firstPitchTypes = summary.first_pitch_types ?? {}

  const playerLabel = payload.player || 'pitcher'
  const windowLabel = payload.window || ''
  const count = typeof summary.count === 'number' ? summary.count : games.length

  return (
    <div className="space-y-4">
      <div className="font-mono text-[13px]" style={{ color: PITCH_ACCENT }}>
        <span>{playerLabel}</span>
        <span style={{ color: PITCH_LABEL }}>{` · first-pitch velocity${windowLabel ? ` · ${windowLabel}` : ''} · ${count} game${count === 1 ? '' : 's'}`}</span>
      </div>

      {/* FPV summary */}
      <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.18 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
        <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
          first pitch velocity
        </div>
        <div className="grid grid-cols-4 gap-2">
          <StatBox label="avg" value={typeof summary.avg_fpv === 'number' ? summary.avg_fpv.toFixed(1) : '—'} accent={PITCH_ACCENT} />
          <StatBox label="min" value={typeof summary.min_fpv === 'number' ? summary.min_fpv.toFixed(0) : '—'} />
          <StatBox label="max" value={typeof summary.max_fpv === 'number' ? summary.max_fpv.toFixed(0) : '—'} />
          <StatBox label="games" value={count} />
        </div>
      </div>

      {/* First-pitch type mix */}
      {Object.keys(firstPitchTypes).length > 0 && (
        <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
            first pitch types
          </div>
          <PitchArsenalBars counts={firstPitchTypes} />
        </div>
      )}

      {/* Game log */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
          game log
        </div>
        {games.length === 0 ? (
          <div className="text-center py-3 font-mono text-[12px]" style={{ color: PITCH_VALUE }}>No games found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[12px] border-collapse">
              <thead>
                <tr style={{ color: PITCH_LABEL, borderBottom: `1px solid ${PITCH_BORDER}` }}>
                  <th className="text-left py-1 pr-2 font-normal">Date</th>
                  <th className="text-left py-1 pr-2 font-normal">Opp</th>
                  <th className="text-left py-1 pr-2 font-normal">H/A</th>
                  <th className="text-right py-1 pr-2 font-normal">FPV</th>
                  <th className="text-left py-1 pr-2 font-normal">Pitch</th>
                  <th className="text-right py-1 pr-2 font-normal">Inn</th>
                  <th className="text-left py-1 font-normal">Result</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g, i) => {
                  const ha = (g.home_away || '').toUpperCase()
                  const haLabel = ha === 'HOME' ? 'vs' : ha === 'AWAY' ? '@' : ha
                  return (
                    <tr key={`${g.date_iso ?? i}`} style={{ borderBottom: '1px solid oklch(0.18 0 0)', color: PITCH_VALUE }}>
                      <td className="py-1 pr-2" style={{ color: PITCH_LABEL }}>{g.date_iso ?? ''}</td>
                      <td className="py-1 pr-2" style={{ color: 'oklch(0.70 0.10 195)' }}>{g.opponent_team ?? ''}</td>
                      <td className="py-1 pr-2" style={{ color: PITCH_LABEL }}>{haLabel}</td>
                      <td className="py-1 pr-2 text-right" style={{ color: PITCH_ACCENT }}>{typeof g.fpv === 'number' ? g.fpv.toFixed(1) : '—'}</td>
                      <td className="py-1 pr-2">{g.pitch_type ?? ''}</td>
                      <td className="py-1 pr-2 text-right" style={{ color: PITCH_LABEL }}>{g.inning ?? ''}</td>
                      <td className="py-1" style={{ color: PITCH_VALUE }}>{g.batter_play ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function MlbBatTeamView({ payload }: { payload: MlbBatTeamPayload }) {
  const rates = payload.rates ?? {}
  const out_types = payload.out_types ?? {}
  const pbp = payload.pbp_tally ?? {}
  const fp = payload.first_pitch_summary ?? {}
  const pitchers = payload.contributing_pitchers ?? []

  const team = payload.team || 'TEAM'
  const yw = payload.year_window
  const yearLabel = yw ? (yw[0] === yw[1] ? `${yw[0]} season` : `${yw[0]}–${yw[1]}`) : payload.career ? 'career' : ''
  const totalOuts = rates.total_contact_outs ?? 0

  return (
    <div className="space-y-4">
      <div className="font-mono text-[13px]" style={{ color: PITCH_ACCENT }}>
        <span style={{ color: 'oklch(0.70 0.10 195)' }}>{team}</span>
        <span> batters</span>
        <span style={{ color: PITCH_LABEL }}>{` · ${payload.games ?? 0} game${payload.games === 1 ? '' : 's'}${yearLabel ? ` · ${yearLabel}` : ''} · ${rates.pa ?? 0} PA`}</span>
      </div>

      <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.18 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
        <div className="grid grid-cols-4 gap-2">
          <StatBox label="K%" value={rates.k_pct?.toFixed(1) ?? '—'} accent={PITCH_GREEN} />
          <StatBox label="BB%" value={rates.bb_pct?.toFixed(1) ?? '—'} />
          <StatBox label="HR%" value={rates.hr_pct?.toFixed(1) ?? '—'} />
          <StatBox label="H%" value={rates.h_pct?.toFixed(1) ?? '—'} />
          <StatBox label="K" value={pbp.K ?? 0} />
          <StatBox label="BB" value={pbp.BB ?? 0} />
          <StatBox label="HR" value={pbp.HR ?? 0} />
          <StatBox label="H" value={pbp.H ?? 0} />
          <StatBox label="ERA" value={typeof rates.era === 'number' ? rates.era.toFixed(2) : '—'} />
          <StatBox label="K/9" value={typeof rates.k9 === 'number' ? rates.k9.toFixed(2) : '—'} />
          <StatBox label="BB/9" value={typeof rates.bb9 === 'number' ? rates.bb9.toFixed(2) : '—'} />
          <StatBox label="HR/9" value={typeof rates.hr9 === 'number' ? rates.hr9.toFixed(2) : '—'} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.keys(out_types).length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              out types {totalOuts > 0 ? `({${totalOuts}} contact outs)` : ''}
            </div>
            <OutTypeGrid outTypes={out_types} totalOuts={totalOuts} />
          </div>
        )}
        {(typeof fp.avg === 'number' || typeof fp.median === 'number') && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              first pitch (opposing)
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatBox label="avg" value={typeof fp.avg === 'number' ? fp.avg.toFixed(1) : '—'} accent={PITCH_ACCENT} />
              <StatBox label="med" value={typeof fp.median === 'number' ? fp.median.toFixed(1) : '—'} />
              <StatBox label="min" value={typeof fp.min === 'number' ? fp.min.toFixed(0) : '—'} />
              <StatBox label="max" value={typeof fp.max === 'number' ? fp.max.toFixed(0) : '—'} />
            </div>
          </div>
        )}
      </div>

      {pitchers.length > 0 && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
            opposing pitchers in window
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 font-mono text-[12px]">
            {pitchers.slice(0, 24).map((p) => (
              <div key={p.name} className="flex items-baseline justify-between">
                <span style={{ color: PITCH_VALUE }}>{p.name}</span>
                <span style={{ color: PITCH_LABEL }}>{p.games} g</span>
              </div>
            ))}
          </div>
          {pitchers.length > 24 && (
            <div className="mt-1 font-mono text-[11px]" style={{ color: PITCH_LABEL }}>
              +{pitchers.length - 24} more
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MlbTeamOverviewView({ payload }: { payload: MlbTeamOverviewPayload }) {
  const team = payload.team || 'TEAM'
  const season = payload.season
  const processed = payload.games_processed ?? 0
  const completeness = typeof payload.completeness_pct === 'number' ? payload.completeness_pct : null
  const down3 = payload['3down'] ?? 0
  const down6 = payload['6down'] ?? 0
  const down9 = payload['9down'] ?? 0
  const avgFirstBR = payload.avg_first_baserunner_inning
  const kTotal = payload.team_k_total ?? 0
  const bbTotal = payload.team_bb_total ?? 0
  const outTypes = payload.out_type_pct ?? {}
  const hitsPerInning = payload.hits_per_inning_avg ?? {}

  // Sort out types by pct desc, drop zero rows
  const outTypeRows = Object.entries(outTypes)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
  const outTypeTotal = outTypeRows.reduce((s, [, v]) => s + (v as number), 0) || 1

  const inningEntries = Object.entries(hitsPerInning)
    .map(([k, v]) => [Number(k), v as number] as const)
    .filter(([n]) => Number.isFinite(n))
    .sort((a, b) => a[0] - b[0])
  const maxInningHits = inningEntries.reduce((m, [, v]) => Math.max(m, v), 0)

  return (
    <div className="space-y-4">
      <div className="font-mono text-[13px]" style={{ color: PITCH_ACCENT }}>
        <span>{team}</span>
        <span style={{ color: PITCH_LABEL }}>{` · team overview${season ? ` · ${season} season` : ''} · ${processed} game${processed === 1 ? '' : 's'}`}</span>
      </div>

      {/* Headline totals */}
      <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.18 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
        <div className="grid grid-cols-4 gap-2">
          <StatBox label="K" value={kTotal} accent={PITCH_GREEN} />
          <StatBox label="BB" value={bbTotal} />
          <StatBox label="1-2-3" value={down3} accent={PITCH_ACCENT} />
          <StatBox label="6 UP" value={down6} accent={PITCH_ACCENT} />
          <StatBox label="9 UP" value={down9} accent={PITCH_ACCENT} />
          <StatBox label="1st BR inn" value={typeof avgFirstBR === 'number' ? avgFirstBR.toFixed(2) : '—'} />
          <StatBox label="games" value={processed} />
          <StatBox label="data %" value={completeness !== null ? `${completeness.toFixed(1)}%` : '—'} />
        </div>
      </div>

      {/* Out type mix + Hits per inning */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {outTypeRows.length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              out types
            </div>
            <div className="space-y-1">
              {outTypeRows.map(([k, pct]) => {
                const widthPct = Math.min(100, ((pct as number) / outTypeTotal) * 100)
                return (
                  <div key={k} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="w-[80px] shrink-0" style={{ color: PITCH_VALUE }}>{k}</span>
                    <span className="w-[48px] text-right tabular-nums" style={{ color: PITCH_LABEL }}>{(pct as number).toFixed(2)}%</span>
                    <div className="flex-1 h-[6px] rounded-sm overflow-hidden" style={{ backgroundColor: 'oklch(0.18 0 0)' }}>
                      <div className="h-full rounded-sm" style={{ width: `${widthPct}%`, backgroundColor: PITCH_ACCENT }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {inningEntries.length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              avg hits / inning
            </div>
            <div className="space-y-1">
              {inningEntries.map(([n, v]) => {
                const widthPct = maxInningHits > 0 ? (v / maxInningHits) * 100 : 0
                return (
                  <div key={n} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="w-[24px] shrink-0 text-right tabular-nums" style={{ color: PITCH_LABEL }}>{n}</span>
                    <span className="w-[44px] text-right tabular-nums" style={{ color: PITCH_VALUE }}>{v.toFixed(2)}</span>
                    <div className="flex-1 h-[6px] rounded-sm overflow-hidden" style={{ backgroundColor: 'oklch(0.18 0 0)' }}>
                      <div className="h-full rounded-sm" style={{ width: `${widthPct}%`, backgroundColor: PITCH_GREEN }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Grade helpers ----------

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A++': return 'oklch(0.78 0.18 145)'
    case 'A+':  return 'oklch(0.82 0.16 155)'
    case 'A':   return 'oklch(0.85 0.16 165)'
    case 'B':   return 'oklch(0.85 0.20 100)'
    case 'C':   return 'oklch(0.80 0.20 60)'
    case 'D':   return 'oklch(0.72 0.18 35)'
    default:    return 'oklch(0.60 0.15 20)'
  }
}

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span
      className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded"
      style={{
        backgroundColor: 'oklch(0.16 0 0)',
        color: gradeColor(grade),
        border: `1px solid ${gradeColor(grade)}`,
        letterSpacing: '0.04em',
      }}
    >
      {grade}
    </span>
  )
}

// ---------- MLB Report Leaderboard View ----------

function MlbReportLeaderboardView({ payload }: { payload: MlbReportLeaderboardPayload }) {
  const rows = payload.rows ?? []
  const q = payload.query ?? {}
  const windowLabel = q.is_season ? 'season' : `last ${q.window}`
  const generatedDate = payload.generated_at ? formatLeaderboardDate(payload.generated_at) : ''

  return (
    <div className="space-y-3">
      <div className="font-mono text-[13px]" style={{ color: PITCH_ACCENT }}>
        <span>MLB Batter Report</span>
        <span style={{ color: PITCH_LABEL }}>{` · ${windowLabel} · top ${rows.length}`}</span>
        {generatedDate && (
          <span style={{ color: 'oklch(0.42 0 0)' }}>{` · ${generatedDate}`}</span>
        )}
      </div>

      {/* Header row */}
      <div
        className="grid font-mono text-[10px] uppercase tracking-widest px-2 py-1"
        style={{
          gridTemplateColumns: '24px 1fr 36px 44px 52px',
          gap: '8px',
          color: PITCH_LABEL,
          borderBottom: `1px solid ${PITCH_BORDER}`,
        }}
      >
        <span>#</span>
        <span>player</span>
        <span>tm</span>
        <span>grade</span>
        <span className="text-right">score</span>
      </div>

      {/* Rows */}
      {rows.map((row, idx) => {
        const rank = String(idx + 1).padStart(2, '0')
        return (
          <div
            key={`${row.player_key}-${idx}`}
            className="grid font-mono text-[12px] px-2 py-1.5 items-center"
            style={{
              gridTemplateColumns: '24px 1fr 36px 44px 52px',
              gap: '8px',
              borderBottom: idx < rows.length - 1 ? '1px solid oklch(0.18 0 0)' : 'none',
            }}
          >
            <span style={{ color: PITCH_LABEL }}>{rank}</span>
            <span className="truncate" style={{ color: PITCH_VALUE }}>{row.player}</span>
            <span style={{ color: 'oklch(0.70 0.10 195)' }}>{row.team}</span>
            <span><GradeBadge grade={row.grade} /></span>
            <span
              className="text-right tabular-nums"
              style={{ color: 'oklch(0.78 0.18 145)', fontWeight: 600 }}
            >
              {Math.round(row.score * 1.5)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------- MLB Player Report View ----------

function MlbPlayerReportView({ payload }: { payload: MlbPlayerReportPayload }) {
  const report = payload.report
  if (!report) {
    return (
      <div className="font-mono text-[13px]" style={{ color: PITCH_LABEL }}>
        No report data available
      </div>
    )
  }

  const windowLabel = report.is_season ? 'season' : `last ${report.window}`
  const dateRange =
    report.first_game && report.last_game
      ? `${report.first_game} — ${report.last_game}`
      : ''
  const t = report.totals ?? {}
  const breakdown = report.breakdown ?? []

  const absStats = [
    { label: 'PA', value: t.PA ?? 0 },
    { label: 'AB', value: t.AB ?? 0 },
    { label: 'H', value: t.H ?? 0 },
    { label: 'TB', value: t.TB ?? 0 },
    { label: 'BB', value: t.BB ?? 0 },
    { label: 'HBP', value: t.HBP ?? 0 },
    { label: 'SO', value: t.SO ?? 0 },
  ]

  const gameStats = [
    { label: 'G/Hit', value: t.games_with_hit ?? 0 },
    { label: 'G/RBI', value: t.games_with_rbi ?? 0 },
    { label: 'G/Run', value: t.games_with_run ?? 0 },
    { label: 'G/HR', value: t.games_with_hr ?? 0 },
    { label: 'G/SB', value: t.games_with_sb ?? 0 },
    { label: 'G/2TB', value: t.games_with_2tb ?? 0 },
    { label: 'G/3K', value: t.games_with_3k ?? 0 },
  ]

  const totalPoints = breakdown.reduce((sum, b) => sum + b.points, 0)

  const formatRate = (b: MlbPlayerReportBreakdown): string => {
    // For percentage-style rates, show as %
    const lbl = b.label.toLowerCase()
    if (lbl.includes('%') || lbl.includes('pct')) {
      return `${(b.rate * 100).toFixed(1)}%`
    }
    return b.rate.toFixed(4).replace(/\.?0+$/, '') || '0'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="font-mono text-[13px]" style={{ color: PITCH_ACCENT }}>
          {payload.team ? (
            <>
              <span style={{ color: 'oklch(0.70 0.10 195)' }}>{payload.team}</span>
              <span style={{ color: PITCH_LABEL }}>{' — '}</span>
            </>
          ) : null}
          <span>{payload.player}</span>
          <span style={{ color: PITCH_LABEL }}>{` · ${windowLabel}`}</span>
          {dateRange && (
            <span style={{ color: 'oklch(0.42 0 0)' }}>{` · ${dateRange}`}</span>
          )}
        </div>
        <div className="flex items-center gap-2 font-mono shrink-0">
          <GradeBadge grade={report.grade} />
          <span style={{ color: 'oklch(0.78 0.18 145)', fontWeight: 700, fontSize: '15px' }}>
            {Math.round(report.score * 1.5)}
          </span>
          <span style={{ color: PITCH_LABEL, fontSize: '11px' }}>{`${report.games}g`}</span>
        </div>
      </div>

      {/* Counting stats */}
      <div
        className="rounded p-3"
        style={{ backgroundColor: 'oklch(0.18 0 0)', border: `1px solid ${PITCH_BORDER}` }}
      >
        <div className="grid grid-cols-7 gap-2 mb-3">
          {absStats.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <span
                className="font-mono text-[9px] uppercase tracking-wider"
                style={{ color: PITCH_LABEL }}
              >
                {s.label}
              </span>
              <span className="font-mono text-[13px]" style={{ color: PITCH_VALUE }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {gameStats.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <span
                className="font-mono text-[9px] uppercase tracking-wider whitespace-nowrap"
                style={{ color: PITCH_LABEL }}
              >
                {s.label}
              </span>
              <span
                className="font-mono text-[13px]"
                style={{ color: s.value > 0 ? PITCH_ACCENT : PITCH_VALUE }}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Score breakdown */}
      <div
        className="rounded p-3"
        style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}
      >
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-2"
          style={{ color: PITCH_LABEL }}
        >
          score breakdown
        </div>
        <div className="space-y-0.5">
          {/* Column headers */}
          <div
            className="grid font-mono text-[9px] uppercase tracking-widest pb-1 mb-1"
            style={{
              gridTemplateColumns: '1fr 64px 44px 48px',
              gap: '8px',
              color: 'oklch(0.38 0 0)',
              borderBottom: '1px solid oklch(0.20 0 0)',
            }}
          >
            <span>metric</span>
            <span className="text-right">rate</span>
            <span className="text-right">wt</span>
            <span className="text-right">pts</span>
          </div>
          {breakdown.map((b, i) => {
            const isNeg = b.weight < 0
            const pts = b.points * 1.5
            const ptsColor =
              Math.abs(pts) < 0.01
                ? PITCH_LABEL
                : pts > 0
                ? 'oklch(0.78 0.18 145)'
                : 'oklch(0.68 0.18 25)'
            return (
              <div
                key={i}
                className="grid font-mono text-[11px] py-0.5"
                style={{ gridTemplateColumns: '1fr 64px 44px 48px', gap: '8px' }}
              >
                <span style={{ color: PITCH_VALUE }}>{b.label}</span>
                <span
                  className="text-right tabular-nums"
                  style={{ color: PITCH_LABEL }}
                >
                  {formatRate(b)}
                </span>
                <span
                  className="text-right tabular-nums"
                  style={{ color: isNeg ? 'oklch(0.68 0.18 25)' : PITCH_LABEL }}
                >
                  {isNeg ? b.weight.toFixed(1) : `+${b.weight.toFixed(1)}`}
                </span>
                <span
                  className="text-right tabular-nums font-bold"
                  style={{ color: ptsColor }}
                >
                  {pts >= 0 ? `+${Math.round(pts * 100) / 100}` : `${Math.round(pts * 100) / 100}`}
                </span>
              </div>
            )
          })}
          {/* Total row */}
          <div
            className="grid font-mono text-[12px] pt-1.5 mt-1"
            style={{
              gridTemplateColumns: '1fr 64px 44px 48px',
              gap: '8px',
              borderTop: '1px solid oklch(0.24 0 0)',
            }}
          >
            <span style={{ color: PITCH_VALUE, fontWeight: 600 }}>total</span>
            <span />
            <span />
            <span
              className="text-right tabular-nums font-bold"
              style={{ color: 'oklch(0.78 0.18 145)', fontSize: '13px' }}
            >
              {Math.round(totalPoints * 1.5)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [stars, setStars] = useState<Star[]>([])
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [placeholderOpacity, setPlaceholderOpacity] = useState(1)
  const [searchValue, setSearchValue] = useState('')
  const [isMiniOpen, setIsMiniOpen] = useState(false)
  const [isSampleMenuOpen, setIsSampleMenuOpen] = useState(false)
  const [isTutorialOpen, setIsTutorialOpen] = useState(false)
  const [miniPosition, setMiniPosition] = useState({
    x: window.innerWidth / 2 - 310,
    y: Math.max(80, Math.floor((window.innerHeight - window.innerHeight * 0.62) / 2)),
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [queryResults, setQueryResults] = useState<QueryResult[] | null>(null)
  const [h2hResult, setH2hResult] = useState<H2hPayload | null>(null)
  const [pitchResult, setPitchResult] = useState<MlbPitchH2hPayload | null>(null)
  const [fpvResult, setFpvResult] = useState<MlbPitchFpvPayload | null>(null)
  const [batTeamResult, setBatTeamResult] = useState<MlbBatTeamPayload | null>(null)
  const [teamOverviewResult, setTeamOverviewResult] = useState<MlbTeamOverviewPayload | null>(null)
  const [reportLeaderboardResult, setReportLeaderboardResult] = useState<MlbReportLeaderboardPayload | null>(null)
  const [playerReportResult, setPlayerReportResult] = useState<MlbPlayerReportPayload | null>(null)
  const [nflExplosiveResult, setNflExplosiveResult] = useState<NflExplosivePayload | null>(null)
  const [lastQuery, setLastQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [collapsedPlayers, setCollapsedPlayers] = useState<Record<string, boolean>>({})
  const [hitlistEntries, setHitlistEntries] = useState<HitlistEntry[]>(hitlistData as HitlistEntry[])
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [builderPosition, setBuilderPosition] = useState({
    x: Math.max(16, Math.floor(window.innerWidth / 2 - 320)),
    y: 96,
  })
  const [isBuilderDragging, setIsBuilderDragging] = useState(false)
  const [builderDragOffset, setBuilderDragOffset] = useState({ x: 0, y: 0 })
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(true)
  const [isMobileLeaderboardOpen, setIsMobileLeaderboardOpen] = useState(false)
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false)
  const leaderboard = leaderboardData as unknown as LeaderboardPayload
  const isMobile = useIsMobile()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const sampleMenuRef = useRef<HTMLDivElement>(null)
  const miniRef = useRef<HTMLDivElement>(null)
  const builderRef = useRef<HTMLDivElement>(null)
  const tickerRef = useRef<HTMLDivElement>(null)

  const tickerText = hitlistEntries
    .map(formatTickerEntry)
    .join('    ★    ')

  // Continuous ticker scroll driven by requestAnimationFrame.
  // 3 copies are rendered; we translate by exactly one copy's width then wrap modulo,
  // so the strip never restarts visibly. Speed is constant pixels-per-second.
  useEffect(() => {
    const el = tickerRef.current
    if (!el) return

    const PIXELS_PER_SECOND = 70
    let offset = 0
    let lastTime = performance.now()
    let rafId = 0

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000
      lastTime = now
      const copyWidth = el.scrollWidth / 3
      if (copyWidth > 0) {
        offset = (offset + PIXELS_PER_SECOND * dt) % copyWidth
        el.style.transform = `translateX(${-offset}px)`
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [tickerText])

  const runQuery = async (query: string) => {
    const sanitizedQuery = sanitizeQueryForApi(query)

    setIsLoading(true)
    setLastQuery(sanitizedQuery || query.trim())
    setQueryError(null)
    setCollapsedPlayers({})
    setH2hResult(null)
    setPitchResult(null)
    setFpvResult(null)
    setBatTeamResult(null)
    setTeamOverviewResult(null)
    setReportLeaderboardResult(null)
    setPlayerReportResult(null)
    setNflExplosiveResult(null)

    if (!sanitizedQuery) {
      setQueryResults([])
      setQueryError('Enter a valid query.')
      setIsLoading(false)
      return
    }

    try {
      const { response, url } = await fetchFirstSuccessful(
        RUN_ENDPOINTS,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: sanitizedQuery }),
        },
        12000,
      )

      const payload = await parseApiPayload(response)

      console.log('Query response:', payload, 'via', url)

      const h2hPayload = extractH2hPayload(payload)
      if (h2hPayload) {
        setH2hResult(h2hPayload)
        setQueryResults([])
        return
      }

      const pitchPayload = extractMlbPitchH2hPayload(payload)
      if (pitchPayload) {
        setPitchResult(pitchPayload)
        setQueryResults([])
        return
      }

      const fpvPayload = extractMlbPitchFpvPayload(payload)
      if (fpvPayload) {
        setFpvResult(fpvPayload)
        setQueryResults([])
        return
      }

      const batTeamPayload = extractMlbBatTeamPayload(payload)
      if (batTeamPayload) {
        setBatTeamResult(batTeamPayload)
        setQueryResults([])
        return
      }

      const teamOverviewPayload = extractMlbTeamOverviewPayload(payload)
      if (teamOverviewPayload) {
        setTeamOverviewResult(teamOverviewPayload)
        setQueryResults([])
        return
      }

      const reportLeaderboardPayload = extractMlbReportLeaderboardPayload(payload)
      if (reportLeaderboardPayload) {
        setReportLeaderboardResult(reportLeaderboardPayload)
        setQueryResults([])
        return
      }

      const playerReportPayload = extractMlbPlayerReportPayload(payload)
      if (playerReportPayload) {
        setPlayerReportResult(playerReportPayload)
        setQueryResults([])
        return
      }

      // NFL explosive (play-by-play long plays)
      if (isNflExplosivePayload(payload)) {
        setNflExplosiveResult(payload)
        setQueryResults([])
        return
      }

      const normalized = normalizeQueryResults(payload, sanitizedQuery)
      const enriched = normalized.map((r) =>
        r.team ? r : { ...r, team: PLAYER_TEAM_MAP.get(r.player.toLowerCase()) || undefined }
      )
      const payloadError = getPayloadError(payload)
      setQueryResults(enriched)

      if (payloadError) {
        setQueryError(payloadError)
      } else if (normalized.length === 0) {
        // If backend returned plain stdout with no structured envelope, surface it.
        const rec = (payload && typeof payload === 'object' && !Array.isArray(payload))
          ? (payload as Record<string, unknown>)
          : null
        const stdout = rec && typeof rec.output === 'string' ? rec.output.trim() : ''
        setQueryError(stdout || 'Connected to API, but response contained no recognizable result rows.')
      }
    } catch (error) {
      console.error('Query error:', error)
      setQueryResults([])
      setQueryError(formatQueryError(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const generateStars = () => {
      const newStars: Star[] = []
      const density = 217
      
      for (let i = 0; i < density; i++) {
        newStars.push({
          char: STARFIELD_CHARS[Math.floor(Math.random() * STARFIELD_CHARS.length)],
          x: Math.random() * 100,
          y: Math.random() * 100,
          color: TERMINAL_COLORS[Math.floor(Math.random() * TERMINAL_COLORS.length)],
          opacity: 0.3 + Math.random() * 0.5,
        })
      }
      
      setStars(newStars)
    }

    generateStars()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderOpacity(0)
      
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_TEXTS.length)
        setPlaceholderOpacity(1)
      }, 300)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (miniRef.current && e.target === e.currentTarget) {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - miniPosition.x,
        y: e.clientY - miniPosition.y,
      })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setMiniPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  const handleBuilderMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsBuilderDragging(true)
      setBuilderDragOffset({
        x: e.clientX - builderPosition.x,
        y: e.clientY - builderPosition.y,
      })
    }
  }

  useEffect(() => {
    if (!isBuilderDragging) return

    const move = (e: MouseEvent) => {
      const x = Math.max(0, Math.min(window.innerWidth - 240, e.clientX - builderDragOffset.x))
      const y = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - builderDragOffset.y))
      setBuilderPosition({ x, y })
    }
    const up = () => setIsBuilderDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [isBuilderDragging, builderDragOffset])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsMiniOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sampleMenuRef.current && !sampleMenuRef.current.contains(e.target as Node)) {
        setIsSampleMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const runSearchFromInput = () => {
    if (!searchValue.trim()) {
      return
    }

    const trimmedQuery = searchValue.trim().toLowerCase()

    if (trimmedQuery === 'help') {
      setQueryResults(null)
      setH2hResult(null)
      setPitchResult(null)
      setBatTeamResult(null)
      setLastQuery('')
      setQueryError(null)
      setIsMiniOpen(true)
    } else {
      runQuery(searchValue.trim())
      setIsMiniOpen(true)
    }
  }

  const handleRunFromBuilder = (query: string) => {
    setSearchValue(query)
    setIsBuilderOpen(false)
    runQuery(query)
    setIsMiniOpen(true)
  }

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      runSearchFromInput()
    }
  }

  const handleSampleCommandSelect = (command: string) => {
    setIsSampleMenuOpen(false)

    if (isMobile) {
      if (!command.trim()) {
        return
      }

      setSearchValue(command)
      runQuery(command)
      setIsMiniOpen(true)
      return
    }

    setSearchValue(command)

    window.requestAnimationFrame(() => {
      if (!searchInputRef.current) {
        return
      }

      searchInputRef.current.focus()
      const cursorPosition = command.length
      searchInputRef.current.setSelectionRange(cursorPosition, cursorPosition)
    })
  }

  const togglePlayerCollapsed = (player: string) => {
    setCollapsedPlayers((prev) => ({
      ...prev,
      [player]: !prev[player],
    }))
  }

  return (
    <div className="relative w-screen h-screen bg-background overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {stars.map((star, index) => (
          <span
            key={index}
            className="absolute text-[12px] font-mono select-none"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              color: star.color,
              opacity: star.opacity,
            }}
          >
            {star.char}
          </span>
        ))}
      </div>

      <div
        className={
          isMobile
            ? 'absolute top-2 left-3 z-20 flex flex-col items-start gap-1 font-mono text-[11px]'
            : 'absolute top-6 left-6 z-20 flex flex-col items-start gap-1 font-mono text-[14px]'
        }
      >
        {isMobile ? (
          <span
            className="flex items-center gap-2 whitespace-nowrap"
            style={{ color: 'oklch(0.95 0 0)', fontWeight: 700 }}
          >
            <span>
              nspe.dev{' '}
              <span style={{ color: 'oklch(0.75 0.15 145)' }}>{'{preview}'}</span>
            </span>
          </span>
        ) : (
          <span style={{ color: 'oklch(0.95 0 0)', fontWeight: 700 }}>
            nspe.dev{' '}
            <span style={{ color: 'oklch(0.75 0.15 145)' }}>{'{preview}'}</span>
          </span>
        )}
        {isMobile && (
          <button
            onClick={() => setIsTutorialOpen(true)}
            className="font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.78 0.18 145)' }}
          >
            {'{tutorial}'}
          </button>
        )}
      </div>

      <div
        className={
          isMobile
            ? 'absolute top-6 right-3 z-20 flex items-center gap-2 whitespace-nowrap'
            : 'absolute top-6 right-6 z-20 flex items-center gap-3'
        }
        ref={sampleMenuRef}
      >
        {!isMobile && (
          <button
            onClick={() => setIsTutorialOpen(true)}
            className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.78 0.18 145)' }}
          >
            {'{tutorial}'}
          </button>
        )}

        {!isMobile && (
          <a
            href="/nfl.season"
            className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.85 0.15 195)' }}
          >
            {'{nfl.season}'}
          </a>
        )}

        <div className="relative">
          <button
            onClick={() => setIsSampleMenuOpen((prev) => !prev)}
            className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.85 0.15 195)' }}
          >
            sample-commands
          </button>

          {isSampleMenuOpen && !isMobile && (
            <div
              className="absolute right-0 mt-3 w-[340px] max-h-[70vh] overflow-y-auto rounded-md p-2"
              style={{
                backgroundColor: 'oklch(0.12 0 0)',
                border: '1px solid oklch(0.30 0 0)',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
              }}
            >
              <div className="mb-2 px-2 font-mono text-[12px]" style={{ color: 'oklch(0.75 0 0)' }}>
                Select a command to prefill search
              </div>
              <div className="space-y-1">
                {SAMPLE_COMMANDS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => !sample.comingSoon && handleSampleCommandSelect(sample.command)}
                    disabled={Boolean(sample.comingSoon)}
                    className="w-full rounded px-2 py-2 text-left font-mono text-[12px] transition-opacity"
                    style={{
                      color: sample.comingSoon ? 'oklch(0.56 0 0)' : 'oklch(0.90 0.18 195)',
                      backgroundColor: sample.comingSoon ? 'transparent' : 'oklch(0.18 0 0)',
                      opacity: sample.comingSoon ? 0.8 : 1,
                      cursor: sample.comingSoon ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => setIsMiniOpen(!isMiniOpen)}
          className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
          style={{ color: 'oklch(0.85 0.15 195)' }}
        >
          nspe-mini
        </button>
      </div>

      <QueryBuilderTutorial open={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />

      {isMobile && isSampleMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.78)', whiteSpace: 'normal' }}
          onClick={() => setIsSampleMenuOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Sample commands"
        >
          <div
            className="w-full max-w-[640px] max-h-[92vh] overflow-y-auto rounded-lg"
            style={{
              backgroundColor: 'oklch(0.12 0 0)',
              border: '1px solid oklch(0.28 0 0)',
              color: 'oklch(0.88 0 0)',
              fontFamily: 'monospace',
              whiteSpace: 'normal',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-3 sticky top-0"
              style={{
                backgroundColor: 'oklch(0.18 0 0)',
                borderBottom: '1px solid oklch(0.28 0 0)',
              }}
            >
              <span
                className="font-mono font-bold text-[14px]"
                style={{ color: 'oklch(0.85 0.15 195)' }}
              >
                {'{sample-commands}'}
              </span>
              <button
                type="button"
                onClick={() => setIsSampleMenuOpen(false)}
                className="font-mono text-[14px] hover:opacity-70 transition-opacity"
                style={{ color: 'oklch(0.85 0.15 195)' }}
                aria-label="Close sample commands"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <div
                className="text-[11px] leading-relaxed mb-3"
                style={{ color: 'oklch(0.48 0 0)' }}
              >
                Tap a command to prefill the search bar.
              </div>
              <div className="flex flex-col gap-1">
                {SAMPLE_COMMANDS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => !sample.comingSoon && handleSampleCommandSelect(sample.command)}
                    disabled={Boolean(sample.comingSoon)}
                    className="block w-full rounded px-3 py-3 text-left font-mono text-[13px] transition-opacity"
                    style={{
                      color: sample.comingSoon ? 'oklch(0.56 0 0)' : 'oklch(0.90 0.18 195)',
                      backgroundColor: sample.comingSoon ? 'transparent' : 'oklch(0.18 0 0)',
                      opacity: sample.comingSoon ? 0.8 : 1,
                      cursor: sample.comingSoon ? 'not-allowed' : 'pointer',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                    }}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isMiniOpen && (
        <div
          ref={miniRef}
          className={isMobile
            ? 'fixed inset-x-2 top-2 z-30 rounded-lg shadow-2xl overflow-hidden'
            : 'absolute z-30 w-[620px] max-h-[62vh] rounded-lg shadow-2xl overflow-hidden'
          }
          style={isMobile
            ? { maxHeight: 'calc(100dvh - 80px)', backgroundColor: 'oklch(0.15 0 0)', border: '1px solid oklch(0.30 0 0)' }
            : { left: `${miniPosition.x}px`, top: `${miniPosition.y}px`, backgroundColor: 'oklch(0.15 0 0)', border: '1px solid oklch(0.30 0 0)' }
          }
        >
          <div
            className="flex items-center justify-between px-5 py-3 cursor-move select-none"
            style={{ backgroundColor: 'oklch(0.18 0 0)', borderBottom: '1px solid oklch(0.30 0 0)' }}
            onMouseDown={handleMouseDown}
          >
            <span className="font-mono font-bold text-[14px]" style={{ color: 'oklch(0.85 0.15 195)' }}>
              {h2hResult
                ? `${lastQuery} — h2h`
                : pitchResult
                ? `${lastQuery} — pitch`
                : batTeamResult
                ? `${lastQuery} — team`
                : reportLeaderboardResult
                ? `${lastQuery} — report`
                : playerReportResult
                ? `${lastQuery} — player report`
                : nflExplosiveResult
                ? `${lastQuery} — explosive`
                : queryResults
                ? `${lastQuery} — ${queryResults.length}results`
                : 'NSPE — Command Legend'}
            </span>
            <button
              onClick={() => setIsMiniOpen(false)}
              className="font-mono text-[14px] hover:opacity-70 transition-opacity"
              style={{ color: 'oklch(0.85 0.15 195)' }}
            >
              ✕
            </button>
          </div>

          <div className={`overflow-y-auto px-5 py-4 space-y-3 ${isMobile ? 'max-h-[calc(100dvh-130px)]' : 'max-h-[calc(62vh-50px)]'}`}>
            {isLoading ? (
              <div className="text-center py-8 font-mono text-[13px]" style={{ color: 'oklch(0.70 0 0)' }}>
                Running query...
              </div>
            ) : h2hResult ? (
              <H2hView payload={h2hResult} />
            ) : pitchResult ? (
              <MlbPitchH2hView payload={pitchResult} query={lastQuery} />
            ) : fpvResult ? (
              <MlbPitchFpvView payload={fpvResult} />
            ) : batTeamResult ? (
              <MlbBatTeamView payload={batTeamResult} />
            ) : teamOverviewResult ? (
              <MlbTeamOverviewView payload={teamOverviewResult} />
            ) : reportLeaderboardResult ? (
              <MlbReportLeaderboardView payload={reportLeaderboardResult} />
            ) : playerReportResult ? (
              <MlbPlayerReportView payload={playerReportResult} />
            ) : nflExplosiveResult ? (
              <NflExplosiveView payload={nflExplosiveResult} />
            ) : queryResults === null ? (
              <div className="text-center py-8 font-mono text-[13px]" style={{ color: 'oklch(0.70 0 0)' }}>
                Build a query to begin
              </div>
            ) : queryResults.length === 0 ? (
              <div className="text-center py-8 font-mono text-[13px] space-y-2" style={{ color: 'oklch(0.70 0 0)' }}>
                <div>No results found</div>
                {queryError && <div>{queryError}</div>}
              </div>
            ) : (
              queryResults.map((result, index) => {
                const hasStreakDetails = Boolean(result.streakDetails && result.streakDetails.length > 0)
                const hasMatchDetails = Boolean(result.matchDetails && result.matchDetails.length > 0)
                const canExpand = hasStreakDetails || hasMatchDetails
                const isExpanded = canExpand ? !collapsedPlayers[result.player] : false

                return (
                  <div
                    key={index}
                    className="py-2 border-b"
                    style={{ borderColor: 'oklch(0.22 0 0)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[13px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
                        {result.team ? (
                          <>
                            <span style={{ color: 'oklch(0.70 0.10 195)' }}>{result.team}</span>
                            <span style={{ color: 'oklch(0.55 0 0)' }}>{' — '}</span>
                          </>
                        ) : null}
                        {result.player}
                      </span>
                      {canExpand ? (
                        <button
                          type="button"
                          onClick={() => togglePlayerCollapsed(result.player)}
                          className="font-mono font-bold text-[13px] ml-4 shrink-0 px-2 py-0.5 rounded border"
                          style={{
                            backgroundColor: isExpanded ? 'oklch(0.27 0.03 145)' : 'oklch(0.22 0 0)',
                            color: 'oklch(0.85 0.15 145)',
                            borderColor: 'oklch(0.35 0 0)',
                            cursor: 'pointer',
                          }}
                          aria-expanded={isExpanded}
                          aria-label={`Toggle details for ${result.player}`}
                        >
                          {result.total}
                        </button>
                      ) : (
                        <span
                          className="font-mono font-bold text-[13px] ml-4 shrink-0 px-2 py-0.5 rounded"
                          style={{ backgroundColor: 'oklch(0.22 0 0)', color: 'oklch(0.85 0.15 145)' }}
                        >
                          {result.total}
                        </span>
                      )}
                    </div>

                    {isExpanded && hasStreakDetails && result.streakDetails && (
                      <div className="mt-2 space-y-1.5 pl-2">
                        {result.streakDetails.map((detail, detailIndex) => (
                          <div
                            key={`${result.player}-streak-${detailIndex}`}
                            className="font-mono text-[12px]"
                            style={{ color: 'oklch(0.76 0 0)' }}
                          >
                            {`${detail.length} game streak ${detail.start} - ${detail.end}`}
                          </div>
                        ))}
                      </div>
                    )}

                    {isExpanded && hasMatchDetails && result.matchDetails && (
                      <div className="mt-2 pl-2 font-mono text-[12px]" style={{ color: 'oklch(0.76 0 0)' }}>
                        <span style={{ color: 'oklch(0.55 0 0)' }}>match: </span>
                        {result.matchDetails
                          .map((m) => `${m.value}${m.statLabel} ${m.date}`)
                          .join(', ')}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-start h-screen pt-[40vh]">
        <div className="w-[65%] max-w-4xl min-w-[320px] px-4">
          {isMobile ? (
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => setIsBuilderOpen(true)}
                className="h-[52px] rounded-lg border px-8 font-mono text-[14px] hover:opacity-80 transition-opacity"
                style={{ color: 'oklch(0.85 0.15 195)', borderColor: 'oklch(0.85 0.15 195)' }}
              >
                build
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={handleSearchSubmit}
                  className="w-full h-[52px] px-5 py-3 bg-card text-foreground font-mono text-[16px] rounded-lg border border-border outline-none focus:border-primary transition-colors duration-200"
                  style={{
                    opacity: 1,
                  }}
                />
                {!searchValue && (
                  <div
                    className="absolute inset-0 flex items-center px-5 pointer-events-none font-mono text-[16px] text-muted-foreground transition-opacity duration-300"
                    style={{
                      opacity: placeholderOpacity * 0.5,
                    }}
                  >
                    {PLACEHOLDER_TEXTS[placeholderIndex]}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={runSearchFromInput}
                className="h-[52px] shrink-0 rounded-lg border border-border px-5 font-mono text-[14px] hover:opacity-80 transition-opacity"
                style={{ color: 'oklch(0.90 0.18 195)' }}
              >
                search
              </button>

              <button
                type="button"
                onClick={() => setIsBuilderOpen(true)}
                className="h-[52px] shrink-0 rounded-lg border px-5 font-mono text-[14px] hover:opacity-80 transition-opacity"
                style={{ color: 'oklch(0.85 0.15 195)', borderColor: 'oklch(0.85 0.15 195)' }}
              >
                build
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="font-mono text-[14px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
              try sample commands or build your own query
            </p>
          </div>
        </div>
      </div>

      {/* Query builder — bottom sheet on mobile, draggable floating panel on desktop */}
      {isBuilderOpen && isMobile && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onClick={() => setIsBuilderOpen(false)}
          />
          <div
            className="fixed z-50 rounded-t-2xl overflow-y-auto"
            style={{
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: '96dvh',
              backgroundColor: 'oklch(0.13 0 0)',
              border: '1px solid oklch(0.28 0 0)',
              borderBottom: 'none',
            }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'oklch(0.32 0 0)' }} />
            </div>
            <div className="px-5 pb-3 flex items-center justify-between">
              <span className="font-mono font-bold text-[13px]" style={{ color: 'oklch(0.85 0.15 195)' }}>
                Query Builder
              </span>
              <button
                onClick={() => setIsBuilderOpen(false)}
                className="font-mono text-[14px] hover:opacity-70 transition-opacity"
                style={{ color: 'oklch(0.85 0.15 195)' }}
              >
                ✕
              </button>
            </div>
            <div className="px-5 pb-10">
              <QueryBuilder
                onRunQuery={handleRunFromBuilder}
                isLoading={isLoading}
                popularPlayers={(leaderboard?.rows ?? []).slice(0, 20).map((r) => ({ player: r.player, team: r.team }))}
              />
            </div>
          </div>
        </>
      )}

      {isBuilderOpen && !isMobile && (
        <div
          ref={builderRef}
          className="fixed z-50 rounded-lg overflow-hidden shadow-2xl"
          style={{
            left: `${builderPosition.x}px`,
            top: `${builderPosition.y}px`,
            width: '640px',
            maxHeight: 'calc(100vh - 40px)',
            backgroundColor: 'oklch(0.13 0 0)',
            border: '1px solid oklch(0.30 0 0)',
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-2.5 cursor-move select-none"
            style={{
              backgroundColor: 'oklch(0.18 0 0)',
              borderBottom: '1px solid oklch(0.30 0 0)',
            }}
            onMouseDown={handleBuilderMouseDown}
          >
            <span
              className="font-mono font-bold text-[13px] pointer-events-none"
              style={{ color: 'oklch(0.85 0.15 195)' }}
            >
              {'{query builder}'}
              <span
                className="ml-2 font-normal"
                style={{ color: 'oklch(0.55 0 0)', fontSize: '10px', letterSpacing: '0.1em' }}
              >
                DRAG TO MOVE
              </span>
            </span>
            <button
              onClick={() => setIsBuilderOpen(false)}
              className="font-mono text-[14px] hover:opacity-70 transition-opacity"
              style={{ color: 'oklch(0.85 0.15 195)' }}
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(100vh - 100px)' }}>
            <QueryBuilder
              onRunQuery={handleRunFromBuilder}
              isLoading={isLoading}
              popularPlayers={(leaderboard?.rows ?? []).slice(0, 20).map((r) => ({ player: r.player, team: r.team }))}
            />
          </div>
        </div>
      )}

      <img
        src={madeitLogo}
        alt="NSPE Footer Logo Left"
        className="absolute bottom-[42px] left-4 z-10 pointer-events-none"
        style={{
          width: '38.5px',
          height: '63px',
          maxWidth: '38.5px',
          maxHeight: '63px',
          objectFit: 'contain',
        }}
      />

      {!isMobile && (
        <button
          type="button"
          onClick={() => setIsGlossaryOpen(true)}
          className="absolute z-20 font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
          style={{
            bottom: '52px',
            right: '440px',
            color: 'oklch(0.85 0.15 195)',
          }}
          aria-label="Open glossary"
        >
          {'{glossary}'}
        </button>
      )}

      {!isMobile && leaderboard?.rows?.length > 0 && (
        <div
          className="absolute right-4 z-20 rounded-md overflow-hidden"          style={{
            bottom: '44px',
            width: '420px',
            backgroundColor: 'oklch(0.12 0 0)',
            border: '1px solid oklch(0.28 0 0)',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.45)',
            fontFamily: 'monospace',
          }}
        >
          <button
            type="button"
            onClick={() => setIsLeaderboardOpen((p) => !p)}
            className="w-full flex items-center justify-between px-3 py-2 hover:opacity-90 transition-opacity"
            style={{
              backgroundColor: 'oklch(0.18 0 0)',
              borderBottom: isLeaderboardOpen ? '1px solid oklch(0.28 0 0)' : 'none',
              cursor: 'pointer',
            }}
            title={isLeaderboardOpen ? 'collapse leaderboard' : 'expand leaderboard'}
          >
            <span className="flex items-baseline gap-2">
              <span className="font-mono font-bold text-[13px]" style={{ color: 'oklch(0.85 0.15 195)' }}>
                {'{leaderboard}'}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'oklch(0.55 0 0)' }}>
                {leaderboardSportLabel(leaderboard.kind)} · top {leaderboard.rows.length}
              </span>
            </span>
            <span className="flex items-baseline gap-2">
              {!isLeaderboardOpen && leaderboard.rows[0] && (
                <span className="font-mono text-[11px]" style={{ color: 'oklch(0.75 0 0)' }}>
                  #1 {normalizeLeaderboardPlayer(leaderboard.rows[0].player)} {leaderboard.rows[0].score.toFixed(1)}
                </span>
              )}
              <span className="font-mono text-[10px]" style={{ color: 'oklch(0.48 0 0)' }}>
                {formatLeaderboardDate(leaderboard.generated_at)}
              </span>
              <span className="font-mono text-[11px]" style={{ color: 'oklch(0.85 0.15 195)' }}>
                {isLeaderboardOpen ? '▾' : '▸'}
              </span>
            </span>
          </button>
          {isLeaderboardOpen && (
            <div
              className="overflow-y-auto"
              style={{ maxHeight: '210px', backgroundColor: 'oklch(0.10 0 0)' }}
            >
              <div
                className="grid items-center px-3 py-1 font-mono text-[10px] uppercase tracking-widest sticky top-0"
                style={{
                  gridTemplateColumns: '22px 1fr 36px 84px 56px',
                  gap: '8px',
                  backgroundColor: 'oklch(0.14 0 0)',
                  borderBottom: '1px solid oklch(0.20 0 0)',
                  color: 'oklch(0.42 0 0)',
                }}
              >
                <span>#</span>
                <span>player</span>
                <span>tm</span>
                <span>stat(streak)</span>
                <span className="text-right">score</span>
              </div>
              {leaderboard.rows.map((row, idx) => {
                const rank = String(idx + 1).padStart(2, '0')
                const player = normalizeLeaderboardPlayer(row.player)
                const star = idx < 3 ? '★' : ' '
                return (
                  <div
                    key={`${row.player}-${idx}`}
                    className="grid items-center px-3 py-1.5 font-mono text-[12px]"
                    style={{
                      gridTemplateColumns: '22px 1fr 36px 84px 56px',
                      gap: '8px',
                      borderBottom: idx === leaderboard.rows.length - 1 ? 'none' : '1px solid oklch(0.16 0 0)',
                      color: 'oklch(0.85 0 0)',
                    }}
                  >
                    <span style={{ color: 'oklch(0.48 0 0)' }}>{rank}</span>
                    <span className="truncate" style={{ color: 'oklch(0.92 0 0)' }}>{player}</span>
                    <span style={{ color: 'oklch(0.55 0 0)' }}>{row.team}</span>
                    <span style={{ color: 'oklch(0.85 0.15 195)' }}>
                      {row.streak_label}({row.streak_length}){star}
                    </span>
                    <span className="text-right" style={{ color: 'oklch(0.78 0.18 145)', fontWeight: 600 }}>
                      {row.score.toFixed(1)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {isMobile && leaderboard?.rows?.length > 0 && (
        <button
          type="button"
          onClick={() => setIsMobileLeaderboardOpen(true)}
          className="absolute z-20 font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
          style={{
            bottom: '46px',
            right: '12px',
            color: 'oklch(0.85 0.15 195)',
          }}
          aria-label="Open leaderboard"
        >
          {'{leaderboard}'}
        </button>
      )}

      {isMobile && (
        <button
          type="button"
          onClick={() => setIsGlossaryOpen(true)}
          className="absolute z-20 font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
          style={{
            bottom: '46px',
            right: leaderboard?.rows?.length > 0 ? '128px' : '12px',
            color: 'oklch(0.85 0.15 195)',
          }}
          aria-label="Open glossary"
        >
          {'{glossary}'}
        </button>
      )}

      {isMobile && isMobileLeaderboardOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.78)', whiteSpace: 'normal' }}
          onClick={() => setIsMobileLeaderboardOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Leaderboard"
        >
          <div
            className="w-full max-w-[640px] max-h-[92vh] overflow-y-auto rounded-lg"
            style={{
              backgroundColor: 'oklch(0.12 0 0)',
              border: '1px solid oklch(0.28 0 0)',
              color: 'oklch(0.88 0 0)',
              fontFamily: 'monospace',
              whiteSpace: 'normal',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-3 sticky top-0"
              style={{
                backgroundColor: 'oklch(0.18 0 0)',
                borderBottom: '1px solid oklch(0.28 0 0)',
              }}
            >
              <span className="flex items-baseline gap-2">
                <span
                  className="font-mono font-bold text-[14px]"
                  style={{ color: 'oklch(0.85 0.15 195)' }}
                >
                  {'{leaderboard}'}
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: 'oklch(0.55 0 0)' }}
                >
                  {leaderboardSportLabel(leaderboard.kind)} · top {leaderboard.rows.length}
                </span>
              </span>
              <span className="flex items-baseline gap-3">
                <span
                  className="font-mono text-[10px]"
                  style={{ color: 'oklch(0.48 0 0)' }}
                >
                  {formatLeaderboardDate(leaderboard.generated_at)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileLeaderboardOpen(false)}
                  className="font-mono text-[14px] hover:opacity-70 transition-opacity"
                  style={{ color: 'oklch(0.85 0.15 195)' }}
                  aria-label="Close leaderboard"
                >
                  ✕
                </button>
              </span>
            </div>
            <div style={{ backgroundColor: 'oklch(0.10 0 0)' }}>
              <div
                className="grid items-center px-4 py-1 font-mono text-[10px] uppercase tracking-widest sticky top-0"
                style={{
                  gridTemplateColumns: '22px 1fr 36px 84px 56px',
                  gap: '8px',
                  backgroundColor: 'oklch(0.14 0 0)',
                  borderBottom: '1px solid oklch(0.20 0 0)',
                  color: 'oklch(0.42 0 0)',
                }}
              >
                <span>#</span>
                <span>player</span>
                <span>tm</span>
                <span>stat(streak)</span>
                <span className="text-right">score</span>
              </div>
              {leaderboard.rows.map((row, idx) => {
                const rank = String(idx + 1).padStart(2, '0')
                const player = normalizeLeaderboardPlayer(row.player)
                const star = idx < 3 ? '★' : ' '
                return (
                  <div
                    key={`m-${row.player}-${idx}`}
                    className="grid items-center px-4 py-2 font-mono text-[12px]"
                    style={{
                      gridTemplateColumns: '22px 1fr 36px 84px 56px',
                      gap: '8px',
                      borderBottom:
                        idx === leaderboard.rows.length - 1
                          ? 'none'
                          : '1px solid oklch(0.16 0 0)',
                      color: 'oklch(0.85 0 0)',
                    }}
                  >
                    <span style={{ color: 'oklch(0.48 0 0)' }}>{rank}</span>
                    <span className="truncate" style={{ color: 'oklch(0.92 0 0)' }}>
                      {player}
                    </span>
                    <span style={{ color: 'oklch(0.55 0 0)' }}>{row.team}</span>
                    <span style={{ color: 'oklch(0.85 0.15 195)' }}>
                      {row.streak_label}({row.streak_length}){star}
                    </span>
                    <span
                      className="text-right"
                      style={{ color: 'oklch(0.78 0.18 145)', fontWeight: 600 }}
                    >
                      {row.score.toFixed(1)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {isGlossaryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.78)', whiteSpace: 'normal' }}
          onClick={() => setIsGlossaryOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Glossary"
        >
          <div
            className="w-full max-w-[680px] max-h-[92vh] overflow-y-auto rounded-lg"
            style={{
              backgroundColor: 'oklch(0.12 0 0)',
              border: '1px solid oklch(0.28 0 0)',
              color: 'oklch(0.88 0 0)',
              fontFamily: 'monospace',
              whiteSpace: 'normal',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-3 sticky top-0"
              style={{
                backgroundColor: 'oklch(0.18 0 0)',
                borderBottom: '1px solid oklch(0.28 0 0)',
              }}
            >
              <span
                className="font-mono font-bold text-[14px]"
                style={{ color: 'oklch(0.85 0.15 195)' }}
              >
                {'{glossary}'}
              </span>
              <button
                type="button"
                onClick={() => setIsGlossaryOpen(false)}
                className="font-mono text-[14px] hover:opacity-70 transition-opacity"
                style={{ color: 'oklch(0.85 0.15 195)' }}
                aria-label="Close glossary"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {GLOSSARY_STATS.map((group) => (
                <section key={group.sport}>
                  <div
                    className="font-mono text-[12px] uppercase tracking-widest mb-2"
                    style={{ color: 'oklch(0.78 0.18 145)' }}
                  >
                    {`{${group.sport} stats}`}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    {group.entries.map((e) => (
                      <div key={e.term} className="font-mono text-[12px] flex gap-2">
                        <span
                          className="shrink-0"
                          style={{ color: 'oklch(0.90 0.18 195)', minWidth: '92px' }}
                        >
                          {e.term}
                        </span>
                        <span style={{ color: 'oklch(0.82 0 0)' }}>{e.meaning}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              <section>
                <div
                  className="font-mono text-[12px] uppercase tracking-widest mb-2"
                  style={{ color: 'oklch(0.78 0.18 145)' }}
                >
                  {'{query syntax}'}
                </div>
                <div className="grid grid-cols-1 gap-y-1.5">
                  {GLOSSARY_QUERY.map((e) => (
                    <div key={e.term} className="font-mono text-[12px] flex gap-2">
                      <span
                        className="shrink-0"
                        style={{ color: 'oklch(0.90 0.18 195)', minWidth: '110px' }}
                      >
                        {e.term}
                      </span>
                      <span style={{ color: 'oklch(0.82 0 0)' }}>{e.meaning}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div
                  className="font-mono text-[12px] uppercase tracking-widest mb-2"
                  style={{ color: 'oklch(0.78 0.18 145)' }}
                >
                  {'{leaderboard}'}
                </div>
                <div className="grid grid-cols-1 gap-y-1.5 mb-3">
                  {GLOSSARY_LEADERBOARD.map((e) => (
                    <div key={e.term} className="font-mono text-[12px] flex gap-2">
                      <span
                        className="shrink-0"
                        style={{ color: 'oklch(0.90 0.18 195)', minWidth: '110px' }}
                      >
                        {e.term}
                      </span>
                      <span style={{ color: 'oklch(0.82 0 0)' }}>{e.meaning}</span>
                    </div>
                  ))}
                </div>
                <div
                  className="font-mono text-[11px] mb-2"
                  style={{ color: 'oklch(0.62 0 0)' }}
                >
                  Streak labels (mlb):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                  {GLOSSARY_STREAK_LABELS.map((e) => (
                    <div key={e.term} className="font-mono text-[12px] flex gap-2">
                      <span
                        className="shrink-0"
                        style={{ color: 'oklch(0.90 0.18 195)', minWidth: '60px' }}
                      >
                        {e.term}
                      </span>
                      <span style={{ color: 'oklch(0.82 0 0)' }}>{e.meaning}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-10 overflow-hidden pointer-events-none border-t" style={{ borderColor: 'oklch(0.25 0 0)' }}>
        <div 
          ref={tickerRef}
          className="whitespace-nowrap font-mono text-[13px] py-2"
          style={{ 
            color: 'oklch(0.85 0.15 195)',
            willChange: 'transform'
          }}
        >
          {tickerText}    ★    {tickerText}    ★    {tickerText}
        </div>
      </div>
    </div>
  )
}

export default App
