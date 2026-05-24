import { useState, useEffect, useRef } from 'react'
import hitlistData from '@/assets/data/hitlist.json'
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

const SAMPLE_COMMANDS = [
  { label: 'nspe nba post -pts min300 -last10', command: 'nspe nba post -pts min300 -last10' },
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
  { label: '{nfl coming soon}', command: '', comingSoon: true },
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

type ApiPayload = Record<string, unknown> | unknown[]

interface Star {
  char: string
  x: number
  y: number
  color: string
  opacity: number
}

interface HitlistEntry {
  player: string
  stat: string
  values: number[]
  threshold: number
  window?: string
  hit_dates: string[]
}

const STAT_LABELS: Record<string, string> = {
  tpm: '3pm',
  reb: 'reb',
  stl: 'stl',
  ast: 'ast',
}

function formatTickerEntry(entry: HitlistEntry): string {
  const statLabel = STAT_LABELS[entry.stat] || entry.stat
  const windowPart = entry.window ? ` last${entry.window}` : ''
  const header = `{${statLabel}${entry.threshold}${windowPart}}`
  const pairs = entry.hit_dates.map((date, i) => {
    const value = entry.values[i]
    return `"${date}" {${value ?? ''}}`
  })

  return `${entry.player} ${header} ${pairs.join(', ')}`
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

function App() {
  const [stars, setStars] = useState<Star[]>([])
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [placeholderOpacity, setPlaceholderOpacity] = useState(1)
  const [searchValue, setSearchValue] = useState('')
  const [isMiniOpen, setIsMiniOpen] = useState(false)
  const [isSampleMenuOpen, setIsSampleMenuOpen] = useState(false)
  const [isTutorialOpen, setIsTutorialOpen] = useState(false)
  const [miniPosition, setMiniPosition] = useState({ x: window.innerWidth / 2 - 300, y: window.innerHeight * 0.40 + 70 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [queryResults, setQueryResults] = useState<QueryResult[] | null>(null)
  const [lastQuery, setLastQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [collapsedPlayers, setCollapsedPlayers] = useState<Record<string, boolean>>({})
  const [hitlistEntries, setHitlistEntries] = useState<HitlistEntry[]>(hitlistData as HitlistEntry[])
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const isMobile = useIsMobile()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const sampleMenuRef = useRef<HTMLDivElement>(null)
  const miniRef = useRef<HTMLDivElement>(null)
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
      const normalized = normalizeQueryResults(payload, sanitizedQuery)
      const payloadError = getPayloadError(payload)
      setQueryResults(normalized)

      if (payloadError) {
        setQueryError(payloadError)
      } else if (normalized.length === 0) {
        setQueryError('Connected to API, but response contained no recognizable result rows.')
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
            ? 'absolute top-2 left-3 z-20 flex flex-col items-start gap-0 font-mono text-[11px]'
            : 'absolute top-6 left-6 z-20 flex flex-col items-start gap-1 font-mono text-[14px]'
        }
      >
        <span style={{ color: 'oklch(0.95 0 0)', fontWeight: 700 }}>
          nspe.dev{' '}
          <span style={{ color: 'oklch(0.75 0.15 145)' }}>{'{preview}'}</span>
        </span>
        <span style={{ color: 'oklch(0.65 0 0)', fontSize: isMobile ? '10px' : '12px' }}>
          {`{stats refreshed ${new Date().getMonth() + 1}/${new Date().getDate()}}`}
        </span>
      </div>

      <div
        className={
          isMobile
            ? 'absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 whitespace-nowrap'
            : 'absolute top-6 right-6 z-20 flex items-center gap-3'
        }
        ref={sampleMenuRef}
      >
        <button
          onClick={() => setIsTutorialOpen(true)}
          className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
          style={{ color: 'oklch(0.78 0.18 145)' }}
        >
          {'{tutorial}'}
        </button>

        <div className="relative">
          <button
            onClick={() => setIsSampleMenuOpen((prev) => !prev)}
            className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.85 0.15 195)' }}
          >
            sample-commands
          </button>

          {isSampleMenuOpen && (
            <div
              className={
                isMobile
                  ? 'absolute left-1/2 -translate-x-1/2 mt-3 w-[300px] max-w-[92vw] rounded-md p-2'
                  : 'absolute right-0 mt-3 w-[340px] rounded-md p-2'
              }
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

      {isMiniOpen && (
        <div
          ref={miniRef}
          className={isMobile
            ? 'fixed inset-x-2 top-2 z-30 rounded-lg shadow-2xl overflow-hidden'
            : 'absolute z-30 w-[600px] max-h-[40vh] rounded-lg shadow-2xl overflow-hidden'
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
              {queryResults ? `${lastQuery} — hitlist` : 'NSPE — Command Legend'}
            </span>
            <button
              onClick={() => setIsMiniOpen(false)}
              className="font-mono text-[14px] hover:opacity-70 transition-opacity"
              style={{ color: 'oklch(0.85 0.15 195)' }}
            >
              ✕
            </button>
          </div>

          <div className={`overflow-y-auto px-5 py-4 space-y-3 ${isMobile ? 'max-h-[calc(100dvh-130px)]' : 'max-h-[calc(40vh-50px)]'}`}>
            {isLoading ? (
              <div className="text-center py-8 font-mono text-[13px]" style={{ color: 'oklch(0.70 0 0)' }}>
                Running query...
              </div>
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
              Search stats like the pros
            </p>
          </div>
        </div>
      </div>

      {/* Query builder sheet */}
      {isBuilderOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onClick={() => setIsBuilderOpen(false)}
          />
          {/* Sheet */}
          <div
            className="fixed z-50 rounded-t-2xl overflow-y-auto"
            style={{
              bottom: 0,
              left: isMobile ? 0 : '50%',
              right: isMobile ? 0 : 'auto',
              transform: isMobile ? undefined : 'translateX(-50%)',
              width: isMobile ? undefined : '480px',
              maxHeight: '88dvh',
              backgroundColor: 'oklch(0.13 0 0)',
              border: '1px solid oklch(0.28 0 0)',
              borderBottom: 'none',
            }}
          >
            {/* Drag handle */}
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
              <QueryBuilder onRunQuery={handleRunFromBuilder} isLoading={isLoading} />
            </div>
          </div>
        </>
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
