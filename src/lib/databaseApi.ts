// Thin fetch layer for the live /database endpoints (GET /database/{slug},
// GET /database/index) that replaced the bundled qb-profiles/*.json +
// batter-profiles/*.json glob approach — see PlayerProfilePage.tsx and
// playerSearch.ts, the only two consumers. Tries the same base-URL
// candidates /run already uses (same-origin proxy first when running
// locally, api.nspe.dev otherwise) so this behaves identically to the rest
// of the app's networking.
import { API_BASE_CANDIDATES, joinUrl } from './nspe-api'

// A 404 is a definitive "not found" from the backend (it already tried both
// the batter and QB builder) — stop immediately rather than treating it
// like a transient failure and retrying the next candidate base URL.
async function fetchFirstOk(urls: string[]): Promise<Response | null> {
  let lastError: unknown = null
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (res.status === 404) return null
      if (res.ok) return res
      lastError = new Error(`${url} -> HTTP ${res.status} ${res.statusText}`)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error('No /database endpoint responded')
}

// The backend returns the profile already shaped as ProfilePayload, but
// this fetch layer stays untyped on purpose — PlayerProfilePage.tsx does its
// own light runtime shape check before trusting the response, same as every
// other live-payload consumer in this app.
export async function fetchPlayerProfile(slug: string): Promise<unknown | null> {
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, `/database/${encodeURIComponent(slug)}`))
  const res = await fetchFirstOk(urls)
  if (!res) return null
  return res.json()
}

export interface DatabaseIndexEntry {
  name: string
  slug: string
  team: string
  position: string
  sport?: string
}

function isDatabaseIndexEntry(v: unknown): v is DatabaseIndexEntry {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return typeof r.name === 'string' && typeof r.slug === 'string'
}

// Defensive about the wrapper shape (bare array vs `{ entries: [...] }` /
// `{ players: [...] }` / `{ results: [...] }`) since this is a brand-new
// endpoint whose exact response shape hasn't been exercised against yet —
// same "don't assume the one shape you guessed" caution every other
// envelope-parsing function in this app already takes.
export async function fetchPlayerIndex(): Promise<DatabaseIndexEntry[]> {
  const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, '/database/index'))
  const res = await fetchFirstOk(urls)
  if (!res) return []
  const data: unknown = await res.json()

  const candidate: unknown = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? ((data as Record<string, unknown>).entries ??
        (data as Record<string, unknown>).players ??
        (data as Record<string, unknown>).results ??
        (data as Record<string, unknown>).index)
      : null

  if (!Array.isArray(candidate)) return []
  return candidate.filter(isDatabaseIndexEntry)
}
