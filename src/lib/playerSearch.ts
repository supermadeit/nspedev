// Flat player index + name-search matching, shared by desktop's CLI input
// and mobile's dedicated search input (both wire this same module — see
// the plan discussion this was built from). Sourced the same way
// QbChartsPage filters its roster: glob every qb-profiles/*.json at build
// time so the index — and therefore what's searchable — grows automatically
// as more profiles land, no hardcoded roster to keep in sync.
import { normalizeDisplayPlayer } from './nspe-payloads'

export interface PlayerIndexEntry {
  name: string
  slug: string
  team: string
  position: string
  firstName: string
  lastName: string
}

const profileModules = import.meta.glob('../assets/data/qb-profiles/*.json', { eager: true }) as Record<
  string,
  { default: { player: string; player_id: string; team: string; position: string } }
>

function splitName(display: string): { first: string; last: string } {
  const parts = display.trim().split(/\s+/)
  return {
    first: (parts[0] ?? '').toLowerCase(),
    last: (parts[parts.length - 1] ?? '').toLowerCase(),
  }
}

export const PLAYER_INDEX: PlayerIndexEntry[] = Object.values(profileModules).map((m) => {
  const display = normalizeDisplayPlayer(m.default.player)
  const { first, last } = splitName(display)
  return {
    name: display,
    slug: m.default.player_id,
    team: m.default.team,
    position: m.default.position,
    firstName: first,
    lastName: last,
  }
})

export interface PlayerMatch {
  entry: PlayerIndexEntry
  matchedOn: 'first' | 'last'
  matchedPrefix: string
}

// Single word ("j", "jo") matches any player whose first OR last name
// starts with it. Two+ words ("aaron ro") narrows to first-name-starts-with
// token[0] AND last-name-starts-with token[1] — this is what lets a search
// keep narrowing as the user keeps typing rather than staying stuck on a
// first-name-only match set.
export function searchPlayers(query: string, limit = 8): PlayerMatch[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  let matches: PlayerMatch[]

  if (tokens.length === 1) {
    const [token] = tokens
    matches = PLAYER_INDEX.filter((e) => e.firstName.startsWith(token) || e.lastName.startsWith(token)).map(
      (entry): PlayerMatch => ({
        entry,
        matchedOn: entry.firstName.startsWith(token) ? 'first' : 'last',
        matchedPrefix: token,
      }),
    )
    // First-name matches rank above last-name matches (typing "j" surfaces
    // "Jalen Hurts" before "Bo Nix" would ever come up on "n"), alphabetical
    // within each group.
    matches.sort((a, b) => {
      if (a.matchedOn !== b.matchedOn) return a.matchedOn === 'first' ? -1 : 1
      return a.entry.name.localeCompare(b.entry.name)
    })
  } else {
    const [firstToken, lastToken] = tokens
    matches = PLAYER_INDEX.filter(
      (e) => e.firstName.startsWith(firstToken) && e.lastName.startsWith(lastToken),
    ).map(
      (entry): PlayerMatch => ({
        entry,
        matchedOn: 'first',
        matchedPrefix: firstToken,
      }),
    )
    matches.sort((a, b) => a.entry.name.localeCompare(b.entry.name))
  }

  return matches.slice(0, limit)
}
