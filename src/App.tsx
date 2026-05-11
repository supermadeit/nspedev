import { useState, useEffect, useRef } from 'react'
import hitlistData from '@/assets/data/hitlist.json'
import madeitLogo from '@/assets/images/madeit-tech-logo-v2.jpeg'

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

function buildHitlistEndpoints(bases: string[]): string[] {
  const candidates: string[] = []

  for (const base of bases) {
    candidates.push(joinUrl(base, '/data/hitlist.json'))

    // Legacy backend layout can expose data under /api/data only.
    if (!base.endsWith('/api')) {
      candidates.push(joinUrl(base, '/api/data/hitlist.json'))
    }
  }

  return uniqueNonEmpty(candidates)
}

const API_BASE_CANDIDATES = buildApiBaseCandidates()
const CONFIGURED_API_BASE = API_BASE_CANDIDATES[0] || 'https://api.nspe.dev'
const RUN_ENDPOINTS = buildRunEndpoints(API_BASE_CANDIDATES)
const HITLIST_ENDPOINTS = buildHitlistEndpoints(API_BASE_CANDIDATES)

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

interface QueryResult {
  player: string
  total: number
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
  hit_dates: string[]
}

const STAT_LABELS: Record<string, string> = {
  tpm: '3pt',
  reb: 'reb',
  stl: 'stl',
  ast: 'ast',
}

function formatTickerEntry(entry: HitlistEntry): string {
  const statLabel = STAT_LABELS[entry.stat] || entry.stat
  const threshold = `${entry.threshold}+`
  const values = entry.values.join(' | ')
  const dates = entry.hit_dates.join(' • ')
  
  return `${entry.player} ${threshold} ${statLabel} | ${values} | ${dates}`
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

function normalizeQueryResults(payload: ApiPayload): QueryResult[] {
  let envelope = extractResultArray(payload)

  if (envelope.length === 0 && !Array.isArray(payload) && typeof payload === 'object') {
    const output = (payload as Record<string, unknown>)?.output
    if (typeof output === 'string') {
      const parsedOutput = extractEnvelopeFromText(output)
      if (parsedOutput) {
        envelope = extractResultArray(parsedOutput)
      }
    }
  }

  return envelope
    .map((item) => {
      if (Array.isArray(item)) {
        const [playerCandidate, totalCandidate] = item
        if (typeof playerCandidate === 'string' && playerCandidate.trim()) {
          return {
            player: playerCandidate,
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
      const matchesCount = Array.isArray(row.matches) ? row.matches.length : null

      const playerCandidate =
        row.player ??
        row.name ??
        row.athlete ??
        row.player_name ??
        row.playerName ??
        row.full_name ??
        row.label ??
        playerFromNotes

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
        total: asNumber(totalCandidate),
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
  const [miniPosition, setMiniPosition] = useState({ x: window.innerWidth / 2 - 300, y: window.innerHeight * 0.40 + 70 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [queryResults, setQueryResults] = useState<QueryResult[] | null>(null)
  const [lastQuery, setLastQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [leftMascotVisible, setLeftMascotVisible] = useState(true)
  const [hitlistEntries, setHitlistEntries] = useState<HitlistEntry[]>(hitlistData as HitlistEntry[])
  const miniRef = useRef<HTMLDivElement>(null)
  const tickerRef = useRef<HTMLDivElement>(null)

  const tickerText = hitlistEntries
    .map(formatTickerEntry)
    .join('    ★    ')

  useEffect(() => {
    let isMounted = true

    const loadHitlist = async () => {
      try {
        const { response, url } = await fetchFirstSuccessful(
          HITLIST_ENDPOINTS,
          {
            method: 'GET',
          },
          8000,
        )
        const payload = await response.json()
        if (!Array.isArray(payload)) {
          throw new Error('Hitlist payload is not an array')
        }

        if (isMounted) {
          setHitlistEntries(payload as HitlistEntry[])
        }

        console.info('Loaded hitlist from endpoint:', url)
      } catch (error) {
        console.warn('Using bundled hitlist fallback:', error)
      }
    }

    void loadHitlist()

    return () => {
      isMounted = false
    }
  }, [])

  const runQuery = async (query: string) => {
    const sanitizedQuery = sanitizeQueryForApi(query)

    setIsLoading(true)
    setLastQuery(sanitizedQuery || query.trim())
    setQueryError(null)

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
      const normalized = normalizeQueryResults(payload)
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
    const interval = setInterval(() => {
      setLeftMascotVisible((prev) => !prev)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
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

      <button
        onClick={() => setIsMiniOpen(!isMiniOpen)}
        className="absolute top-6 right-6 z-20 font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity"
        style={{ color: 'oklch(0.85 0.15 195)' }}
      >
        nspe-mini
      </button>

      {isMiniOpen && (
        <div
          ref={miniRef}
          className="absolute z-30 w-[600px] max-h-[40vh] rounded-lg shadow-2xl overflow-hidden"
          style={{
            left: `${miniPosition.x}px`,
            top: `${miniPosition.y}px`,
            backgroundColor: 'oklch(0.15 0 0)',
            border: '1px solid oklch(0.30 0 0)',
          }}
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

          <div className="overflow-y-auto max-h-[calc(40vh-50px)] px-5 py-4 space-y-5">
            {isLoading ? (
              <div className="text-center py-8 font-mono text-[13px]" style={{ color: 'oklch(0.70 0 0)' }}>
                Running query...
              </div>
            ) : queryResults === null ? (
              <div className="text-center py-8 font-mono text-[13px]" style={{ color: 'oklch(0.70 0 0)' }}>
                Type a query to begin
              </div>
            ) : queryResults.length === 0 ? (
              <div className="text-center py-8 font-mono text-[13px] space-y-2" style={{ color: 'oklch(0.70 0 0)' }}>
                <div>No results found</div>
                {queryError && <div>{queryError}</div>}
              </div>
            ) : (
              queryResults.map((result, index) => (
                <div key={index}>
                  <div>{result.player}</div>
                  <div>{result.total}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-start h-screen pt-[40vh]">
        <div className="w-[65%] max-w-4xl min-w-[320px] px-4">
          <div className="relative">
            <input
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

          <div className="mt-6 text-center">
            <p className="font-mono text-[14px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
              Type "help" for available commands
            </p>
          </div>
        </div>
      </div>

      <img
        src={madeitLogo}
        alt="NSPE Footer Logo Left"
        className={`absolute bottom-[42px] left-4 z-10 pointer-events-none ${leftMascotVisible ? 'fade-in' : 'fade-out'}`}
        style={{
          width: '38.5px',
          height: '63px',
          maxWidth: '38.5px',
          maxHeight: '63px',
          objectFit: 'contain',
        }}
      />

      <img
        src={madeitLogo}
        alt="NSPE Footer Logo Right"
        className={`absolute bottom-[42px] right-4 z-10 pointer-events-none flip-horizontal ${!leftMascotVisible ? 'fade-in' : 'fade-out'}`}
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
          className="whitespace-nowrap font-mono text-[13px] py-2 animate-ticker"
          style={{ 
            color: 'oklch(0.85 0.15 195)',
            animation: 'ticker-scroll 11.33s linear infinite'
          }}
        >
          {tickerText}    ★    {tickerText}    ★    {tickerText}
        </div>
      </div>
    </div>
  )
}

export default App
