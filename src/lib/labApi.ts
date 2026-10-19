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

export interface LabLeg {
  text: string
  league: string
  kind: 'player' | 'team'
  player: string
  team: string
  line: string
  hits: number
  n: number
  pct: number
}

export interface LabCluster {
  legs: number[]
  shared_games: number
  hits: number
  pct: number
  method: 'single' | 'measured' | 'independent' | 'mixed'
}

export interface LabJoint {
  pct: number
  method: 'single' | 'measured' | 'independent' | 'mixed'
  independent_pct: number
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

/** Typed legs — free, no auth required. */
export function runLabLegs(legs: string[], opts: LabOptions = {}): Promise<LabResult> {
  return postLab<LabResult>({ legs, since: opts.since ?? 2018, post: opts.post ?? false, season: opts.season ?? false })
}

/** A screenshot of a slip — needs a signed-in session; spends a free
 * question or a credit (quota/credits_charged come back on the result). */
export function runLabImage(dataUri: string, opts: LabOptions = {}): Promise<LabImageResult> {
  return postLab<LabImageResult>({
    image: dataUri,
    since: opts.since ?? 2018,
    post: opts.post ?? false,
    season: opts.season ?? false,
  })
}
