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

export const API_BASE_CANDIDATES = buildApiBaseCandidates()
export const CONFIGURED_API_BASE = API_BASE_CANDIDATES[0] || 'https://api.nspe.dev'
export const RUN_ENDPOINTS = buildRunEndpoints(API_BASE_CANDIDATES)

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

export function readGuestQuota(payload: ApiPayload): GuestQuota | null {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') return null
  const rec = payload as Record<string, unknown>
  if (rec.kind !== 'guest') return null
  const { remaining, limit, token } = rec
  if (typeof remaining !== 'number' || typeof limit !== 'number' || typeof token !== 'string' || !token) return null
  return { kind: 'guest', remaining, limit, token }
}

// True once a response confirms the request was authenticated (credits or a
// subscriber plan) — the counterpart to readGuestQuota, used to clear a
// stale guest-quota banner the moment someone logs in mid-session.
export function isAuthenticatedQuotaKind(payload: ApiPayload): boolean {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') return false
  const kind = (payload as Record<string, unknown>).kind
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
