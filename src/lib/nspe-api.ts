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

export function getPayloadError(payload: ApiPayload): string | null {
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
