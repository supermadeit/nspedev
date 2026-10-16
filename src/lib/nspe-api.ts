// Pure, non-React data layer for the "hit /run, get an ApiPayload" contract.
//
// Moved out of App.tsx mechanically (cut/paste, no logic changes) so it can be
// reused by other UI surfaces (e.g. a future mobile query builder) without
// pulling in App.tsx's React component tree. Keep this file free of React and
// App.tsx-local imports.

export type ApiPayload = Record<string, unknown> | unknown[]

export function joinUrl(base: string, endpoint: string): string {
  if (!base) {
    return endpoint
  }

  return `${base.replace(/\/$/, '')}${endpoint}`
}

export function uniqueNonEmpty(values: Array<string | undefined | null>): string[] {
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

export function shouldUseSameOriginApi(): boolean {
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

export function buildApiBaseCandidates(): string[] {
  const sameOriginApi = shouldUseSameOriginApi() ? `${window.location.origin}/api` : null

  return uniqueNonEmpty([
    (window as any).NSPE_API_BASE,
    import.meta.env.VITE_NSPE_API_BASE,
    sameOriginApi,
    'https://api.nspe.dev',
  ])
}

export function buildRunEndpoints(bases: string[]): string[] {
  return bases.map((base) => joinUrl(base, '/run'))
}

// Real multi-turn conversation endpoint (confirmed live 2026-10-15, per
// nspe-v2-da) — {question, history: [{role, content}, ...]} in, same gate/
// quota/error semantics as /run. /run itself has no history field at all
// and isn't getting one; a plain-English question is routed here instead of
// /run going forward (see App.tsx's runQuery), so real follow-ups can carry
// actual conversation context rather than /run's one-shot-only answers.
export function buildAgentEndpoints(bases: string[]): string[] {
  return bases.map((base) => joinUrl(base, '/agent'))
}

export const API_BASE_CANDIDATES = buildApiBaseCandidates()
export const CONFIGURED_API_BASE = API_BASE_CANDIDATES[0] || 'https://api.nspe.dev'
export const RUN_ENDPOINTS = buildRunEndpoints(API_BASE_CANDIDATES)
export const AGENT_ENDPOINTS = buildAgentEndpoints(API_BASE_CANDIDATES)

// Server caps per nspe-v2-da (2026-10-16): max 20 history entries / 4000
// chars each, a 400 past that. Only the last 6 of whatever's sent actually
// reaches the model (ask()'s own cap) -- these two constants just keep the
// client from ever tripping the hard 400, not an attempt to mirror the
// model's own context window.
export const AGENT_HISTORY_MAX_TURNS = 20
export const AGENT_HISTORY_MAX_CHARS = 4000

export interface AgentHistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

// Builds the history array to send with a follow-up — one {role, content}
// per side of each prior turn, oldest first (server/model expect
// chronological order, not newest-first like the UI's own display order
// elsewhere). Truncates defensively to the caps above rather than trusting
// a long conversation or a long answer to stay under them on its own.
export function buildAgentHistory(turns: Array<{ question: string; output: string }>): AgentHistoryTurn[] {
  const flat: AgentHistoryTurn[] = []
  for (const t of turns) {
    flat.push({ role: 'user', content: t.question.slice(0, AGENT_HISTORY_MAX_CHARS) })
    flat.push({ role: 'assistant', content: t.output.slice(0, AGENT_HISTORY_MAX_CHARS) })
  }
  return flat.slice(-AGENT_HISTORY_MAX_TURNS)
}

// The /run query gate (daily allowance / login-required), as opposed to a
// dead or unreachable endpoint. A 401/402 is a real answer from the backend
// — not a reason to try the next candidate base URL, and not a "connection
// failed" error — so fetchFirstSuccessful stops immediately and throws this
// instead of falling through to its generic "No API endpoint responded"
// message, which would otherwise make a fully-working backend look down.
export class QueryGateError extends Error {
  /** 401 = not logged in (or an expired session); 402 = allowance used up;
   * 429 = subscriber rate limit (tightened 120/min -> 25/min server-side). */
  status: 401 | 402 | 429
  /** The backend's own message, when the body has one readable string field. */
  detail: string | null
  /** From a 429's Retry-After header, in seconds, when the backend sends one. */
  retryAfterSeconds: number | null

  constructor(status: 401 | 402 | 429, detail: string | null, retryAfterSeconds: number | null = null) {
    super(
      detail ||
        (status === 401 ? 'Log in required.' : status === 402 ? 'Query allowance used up.' : 'Too many requests — slow down a little.'),
    )
    this.status = status
    this.detail = detail
    this.retryAfterSeconds = retryAfterSeconds
  }
}

// Tries a few likely field names for the gate's message rather than assuming
// one exact body shape — same tolerance-for-naming-drift approach every
// engine-payload parser in this app already takes, since this endpoint's
// exact response shape isn't finalized yet.
async function readGateDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.clone().json()
    if (body && typeof body === 'object') {
      const rec = body as Record<string, unknown>
      for (const key of ['message', 'error', 'detail', 'reason']) {
        const v = rec[key]
        if (typeof v === 'string' && v.trim()) return v.trim()
      }
    }
  } catch {
    try {
      const text = (await response.clone().text()).trim()
      if (text && !text.startsWith('<')) return text.slice(0, 300)
    } catch {
      // fall through to null
    }
  }
  return null
}

// Shared candidate-trying fetch for plain, free GET endpoints (/matchup,
// /api/data/output/...) — a lighter sibling of fetchFirstSuccessful below,
// which is shaped around /run's POST contract (gate-status codes, no
// content-type guard). Two real bugs this exists to fix, found live:
//
// 1. No timeout at all — a hand-rolled loop over these candidates with a
//    bare `fetch()` has nothing bounding how long a hung connection sits
//    before the browser's own (very long) default timeout kicks in. That
//    showed up as "really loading, like actually loading" on production.
// 2. On localhost, the same-origin candidate (see shouldUseSameOriginApi)
//    points at Vite's own dev server, which has no real /api backend behind
//    it — verified live that a GET to an unmatched path there returns a
//    fast `200 text/html` (Vite's SPA fallback serving index.html), NOT a
//    404. A bare `response.ok` check accepts that as success and never
//    even tries the real backend, which is exactly why these endpoints
//    "don't work on localhost" despite being plain fetches to api.nspe.dev
//    with no reason to actually differ from production. (POST requests
//    like /run's don't trigger this — confirmed live too, Vite's fallback
//    only intercepts GET — which is why /run never hit this.) Checking the
//    content-type before trusting a 200 closes this off structurally,
//    rather than needing every future free-GET caller to know to check it.
//
// A 404 is treated as a real, meaningful answer (e.g. "no matchup for these
// team codes") and returned immediately rather than retried against the
// next candidate — same reasoning fetchFirstSuccessful uses for 401/402/429
// — but only when it actually looks like it came from the real API, not
// Vite's fallback (which returns 200, not 404, but this guards the same way
// regardless, defensively).
export async function fetchJsonCandidate(
  urls: string[],
  timeoutMs: number,
): Promise<Response> {
  const failures: string[] = []
  const looksLikeJson = (res: Response) => (res.headers.get('content-type') || '').toLowerCase().includes('json')

  for (const url of urls) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, { signal: controller.signal })

      if (response.ok && looksLikeJson(response)) return response
      if (response.status === 404 && looksLikeJson(response)) return response

      failures.push(`${url} -> HTTP ${response.status} ${response.statusText} (${response.headers.get('content-type') || 'no content-type'})`)
    } catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error'
      failures.push(`${url} -> ${reason}`)
    } finally {
      window.clearTimeout(timeout)
    }
  }

  throw new Error(`No API endpoint responded successfully. Attempts: ${failures.join(' | ')}`)
}

export async function fetchFirstSuccessful(
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

      if (response.status === 401 || response.status === 402 || response.status === 429) {
        window.clearTimeout(timeout)
        const retryAfterHeader = response.headers.get('Retry-After')
        const retryAfterSeconds = retryAfterHeader && /^\d+$/.test(retryAfterHeader) ? Number(retryAfterHeader) : null
        throw new QueryGateError(response.status, await readGateDetail(response), retryAfterSeconds)
      }

      if (!response.ok) {
        failures.push(`${url} -> HTTP ${response.status} ${response.statusText}`.trim())
        continue
      }

      return { response, url }
    } catch (error) {
      // A real gate answer, not a dead endpoint — propagate immediately
      // instead of recording it as a failed candidate and moving on.
      if (error instanceof QueryGateError) throw error
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error'
      const onlineState = navigator.onLine ? 'online' : 'offline'
      failures.push(`${url} -> ${reason} (browser ${onlineState})`)
    } finally {
      window.clearTimeout(timeout)
    }
  }

  throw new Error(`No API endpoint responded successfully. Attempts: ${failures.join(' | ')}`)
}

export function asNumber(value: unknown): number {
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

export function sanitizeQueryForApi(query: string): string {
  return query.trim().replace(/^nspe\s+/i, '')
}

// Plain-English chat (2026-10-12 backend handoff, docs/frontend_chat_box_
// 2026-10-12.md in nspe-v2) — client-side guess at whether a typed query is
// nspe syntax or a question, used ONLY for picking the fetch abort timeout
// and the loading indicator's wording before the response comes back. The
// backend is the real, authoritative router (it decides by whether `agent`
// comes back non-null) — a wrong guess here never changes what runs or how
// it's rendered, just how long the client waits and what the spinner says
// while waiting. Shared by App.tsx (desktop) and useNspeQuery.ts (mobile) so
// both pick the same timeout for the same query rather than drifting.
// Mirrors the spec's own rule exactly: the first word (after an optional
// leading "nspe") being a league head, a denomination board, or starting
// with "-" means syntax; everything else is a question — except a league
// head immediately followed by actual question wording ("nfl who has the
// most rushing yards?"), which is still a question despite the leading
// league head.
const LEAGUE_HEADS = new Set(['nfl', 'nba', 'nhl', 'mlb', 'cfb', 'ncaaf', 'hybrid', 'plus', 'bets', 'read', 'scout'])
const DENOM_BOARDS = new Set(['333', '321', '4444', '54321'])
// Exported for App.tsx's looksLikeNlInProgress — same word list, same
// reasoning (a question-shaped sentence), reused rather than duplicated so
// the two "is this NL" checks (route it vs. suppress the {psc}/player
// dropdowns while typing it) never drift apart.
export const QUESTION_LEAD_WORDS = new Set([
  'who', 'what', 'when', 'where', 'why', 'how', 'does', 'do', 'did', 'is', 'are', 'was', 'were',
  'can', 'will', 'should', 'has', 'have', 'had',
])

export function looksLikeNspeSyntax(query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return true
  const words = trimmed.replace(/^nspe\s+/i, '').trim().split(/\s+/)
  const first = (words[0] || '').toLowerCase()
  if (first.startsWith('-')) return true
  if (DENOM_BOARDS.has(first)) return true
  if (LEAGUE_HEADS.has(first)) {
    const rest = words.slice(1).map((w) => w.toLowerCase())
    if (trimmed.endsWith('?') || rest.some((w) => QUESTION_LEAD_WORDS.has(w))) return false
    return true
  }
  return false
}

// Fetch abort timeout for a /run call, picked from the query's own shape:
// -parlay/-legs build a whole slate server-side (own, longer ceiling); a
// plain-English question goes to the real assistant and takes 3-25s per
// backend, with 60s as their STATED FLOOR, not a ceiling, hence the margin
// above it; anything else is ordinary syntax, warm and well under a second.
//
// NL ceiling bumped 75s -> 100s on 2026-10-16 after a live client-side
// AbortError on an unscoped superlative question ("what QB has thrown for
// the most yards since 2020"). Backend ran the exact query 5x authenticated
// and found nothing hanging -- 9.9s-18.4s worst case, well under even 75s,
// with the ~2x spread coming from the model guessing a different arbitrary
// threshold each run (the question gives it no floor), not re-querying
// after a failure. Their read: likely a one-off latency blip somewhere
// outside what agent.ask() alone can test (cold worker, auth lookup), not a
// real bug worth chasing -- but real ~2x variance from something that
// mundane is cheap defensive justification for more margin regardless.
export function queryTimeoutMs(query: string): number {
  if (/(^|\s)-(parlay|legs)\b/.test(query)) return 120000
  if (!looksLikeNspeSyntax(query)) return 100000
  return 12000
}

// The guest quota block the backend now sends on every /run response body
// (confirmed spec, not the header this was originally speculatively read
// from): {kind: "guest", remaining, limit, token} for an anonymous request,
// {kind: "credits" | "subscriber", ...} once signed in — no ambiguity from
// absence, every response says which it is. `token` is the per-browser
// rollover token (see guestToken.ts) — it rides in the body, not a response
// header, so no CORS expose_headers entry is needed for it.
export interface GuestQuota {
  kind: 'guest'
  remaining: number
  limit: number
  token: string
}

// Bug fix (2026-10-12, found while wiring up the plain-English chat
// response, which documents this block as nested `payload.quota.kind`):
// confirmed live against a real nfl_team_yards response that the quota
// block has ALWAYS been nested under `payload.quota`, never flat at
// `payload.kind` — `payload.kind` is `undefined` on every real response.
// That means this function (and isAuthenticatedQuotaKind below) has been
// returning null unconditionally in production, which silently broke the
// "N free queries left today" banner for every guest visitor — it never had
// a count to show. Reads `payload.quota` now, with a fallback to the
// payload root in case some other caller genuinely does send it flat.
function quotaRecord(payload: ApiPayload): Record<string, unknown> | null {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') return null
  const rec = payload as Record<string, unknown>
  if (rec.quota && typeof rec.quota === 'object' && !Array.isArray(rec.quota)) return rec.quota as Record<string, unknown>
  return rec
}

export function readGuestQuota(payload: ApiPayload): GuestQuota | null {
  const quota = quotaRecord(payload)
  if (!quota || quota.kind !== 'guest') return null
  const { remaining, limit, token } = quota
  if (typeof remaining !== 'number' || typeof limit !== 'number' || typeof token !== 'string' || !token) return null
  return { kind: 'guest', remaining, limit, token }
}

// True once a response confirms the request was authenticated (credits or a
// subscriber plan) — the counterpart to readGuestQuota, used to clear a
// stale guest-quota banner the moment someone logs in mid-session.
export function isAuthenticatedQuotaKind(payload: ApiPayload): boolean {
  const kind = quotaRecord(payload)?.kind
  return kind === 'credits' || kind === 'subscriber'
}

export function getPayloadError(payload: ApiPayload): string | null {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>
  const exitCode = asNumber(record.exit_code)
  const output = typeof record.output === 'string' ? record.output.trim() : ''

  if (exitCode !== 0 && output) {
    // Some engines fail as a JSON envelope — {"engine": ..., "error": "vs
    // <team> isn't available for ...", "results": []} — show just the message
    // rather than the raw JSON.
    const inner = extractEnvelopeFromText(output.split('\n').find((line) => line.trimStart().startsWith('{')) ?? '')
    const message = inner && !Array.isArray(inner) ? (inner as Record<string, unknown>).error : null
    return typeof message === 'string' && message.trim() ? message.trim() : output
  }

  return null
}

export function formatQueryError(error: unknown): string {
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

export function extractEnvelopeFromText(text: string): ApiPayload | null {
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

export async function parseApiPayload(response: Response): Promise<ApiPayload> {
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
