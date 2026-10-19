// /refill's pricing catalog — fetched live from GET /plans rather than kept
// as static frontend data (owner's call, 2026-10-19: "the pricing page
// renders from the backend so the numbers can't drift"). Public, no auth.
// Confirmed live against the real response 2026-10-19 — catalog currently
// returns free/connect/standard (pro stays server-side hidden until the
// owner opens it, nothing to filter for that on this end) plus the one
// starter refill pack.
import { API_BASE_CANDIDATES, joinUrl } from '@/lib/nspe-api'

export interface PlanFeatures {
  mcp: boolean
  api_key: boolean
  mini: boolean
  team_metrics_windows: 'season' | 'all'
  allows_instances: 'blurred' | 'full'
  skater_vs_goalie: boolean
  refill_discount_pct: number
}

export interface NspePlan {
  slug: string
  name: string
  price_cents: number
  interval: 'month' | null
  chat_credits_month: number
  free_questions_day: number
  connect_calls_day: number | null
  connect_calls_month: number | null
  features: PlanFeatures
  blurb: string
}

export interface NspeRefill {
  slug: string
  name: string
  price_cents: number
  credits: number
}

export interface CreditExample {
  question: string
  credits: number | string
}

export interface CreditsExplainer {
  usd_per_credit: number
  rule: string
  examples: CreditExample[]
}

export interface PlansCatalog {
  plans: NspePlan[]
  refills: NspeRefill[]
  credits: CreditsExplainer
  currency: string
}

export async function fetchPlansCatalog(): Promise<PlansCatalog> {
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, '/plans'))
  let lastError: string | null = null
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (res.ok) return (await res.json()) as PlansCatalog
      lastError = `HTTP ${res.status}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Network error'
    }
  }
  throw new Error(lastError || 'Could not load pricing.')
}

/** `$5`/`$10` for whole dollars, `$14.99` once a fractional tier (Pro)
 * actually ships — avoids a "$5.00" that nothing else on the site prints. */
export function formatPriceCents(cents: number): string {
  const dollars = cents / 100
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`
}
