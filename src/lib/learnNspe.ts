// Client for POST /learn — a separate, free endpoint (no auth, no guest/
// credit quota; see nl_routes.py's own docstring) that answers fixed
// meta-questions about nspe itself ("what is nspe", "how does the syntax
// work") with a deterministic, hand-written answer plus runnable example
// commands. Confirmed live and stable via direct curl before wiring this up.
//
// Reuses /run's fetch plumbing (fetchFirstSuccessful/parseApiPayload) since
// the base-URL-candidate + timeout + envelope-parsing behavior is identical;
// this is just a different path with a much simpler, fixed response shape.
import { API_BASE_CANDIDATES, fetchFirstSuccessful, joinUrl, parseApiPayload } from './nspe-api'

const LEARN_ENDPOINTS = API_BASE_CANDIDATES.map((base) => joinUrl(base, '/learn'))

export interface LearnExample {
  label: string
  command: string
}

export interface LearnTopic {
  topic: string
  answer: string
  examples: LearnExample[]
}

function isLearnTopic(value: unknown): value is LearnTopic {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const rec = value as Record<string, unknown>
  return (
    typeof rec.topic === 'string' &&
    typeof rec.answer === 'string' &&
    Array.isArray(rec.examples)
  )
}

// The answer text is hand-written backend copy that only changes on a
// backend deploy, not per-visitor — sessionStorage means one fetch per
// question per tab, and a fresh copy next time someone opens a new tab
// (rather than a stale one following them around forever in localStorage).
function cacheKey(question: string): string {
  return `nspe.learn.${question}`
}

function readCache(question: string): LearnTopic | null {
  try {
    const raw = window.sessionStorage.getItem(cacheKey(question))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isLearnTopic(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeCache(question: string, topic: LearnTopic): void {
  try {
    window.sessionStorage.setItem(cacheKey(question), JSON.stringify(topic))
  } catch {
    // Storage unavailable (private mode, quota) — just means every open
    // re-fetches; not worth failing the request over.
  }
}

export async function fetchLearnTopic(question: string): Promise<LearnTopic> {
  const cached = readCache(question)
  if (cached) return cached

  const { response } = await fetchFirstSuccessful(
    LEARN_ENDPOINTS,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    },
    10000,
  )

  const payload = await parseApiPayload(response)
  if (!isLearnTopic(payload)) {
    throw new Error('Unrecognized /learn response shape.')
  }

  writeCache(question, payload)
  return payload
}
