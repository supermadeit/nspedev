// Flat player index + name-search matching, shared by desktop's CLI input
// and mobile's dedicated search input (both wire this same module — see
// the plan discussion this was built from). Sourced the same way
// QbChartsPage filters its roster: glob every profile file at build time so
// the index — and therefore what's searchable — grows automatically as more
// profiles land (any sport/position), no hardcoded roster to keep in sync.
import { normalizeDisplayPlayer } from './nspe-payloads'

export interface PlayerIndexEntry {
  name: string
  slug: string
  team: string
  position: string
  firstName: string
  lastName: string
  // Every searchable word in the display name, lowercased, generic
  // suffixes dropped — see buildNameTokens. Compound/multi-word surnames
  // (e.g. "Crow Armstrong", from "Pete Crow Armstrong") and suffixed names
  // (e.g. "Fernando Tatis Jr") both need every real name token searchable,
  // not just the first and last word — firstName/lastName alone missed
  // "crow" and "tatis" respectively.
  nameTokens: string[]
}

type RawProfileModule = { default: { player: string; player_id: string; team: string; position: string } }

const qbProfileModules = import.meta.glob('../assets/data/qb-profiles/*.json', { eager: true }) as Record<
  string,
  RawProfileModule
>
const batterProfileModules = import.meta.glob('../assets/data/batter-profiles/*.json', { eager: true }) as Record<
  string,
  RawProfileModule
>
const profileModules = { ...qbProfileModules, ...batterProfileModules }

// Suffixes are real words in the display name but aren't what anyone types
// to search for a player — dropping them means the word before the suffix
// (the actual surname) is treated as the last searchable token instead.
const NAME_SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv'])

function buildNameTokens(display: string): string[] {
  return display
    .trim()
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w && !NAME_SUFFIXES.has(w))
}

export const PLAYER_INDEX: PlayerIndexEntry[] = Object.values(profileModules).map((m) => {
  const display = normalizeDisplayPlayer(m.default.player)
  const nameTokens = buildNameTokens(display)
  return {
    name: display,
    slug: m.default.player_id,
    team: m.default.team,
    position: m.default.position,
    firstName: nameTokens[0] ?? '',
    lastName: nameTokens[nameTokens.length - 1] ?? '',
    nameTokens,
  }
})

export interface PlayerMatch {
  entry: PlayerIndexEntry
  // 'first' = query token matched the player's actual first name (ranked
  // highest); 'other' = it matched some other name token (middle/surname
  // word) instead.
  matchedOn: 'first' | 'other'
  matchedPrefix: string
}

// Single word ("j", "jo") matches a player if ANY of their name tokens
// starts with it — not just first/last, since compound surnames ("Crow
// Armstrong") and suffixed names ("Tatis Jr") both have real searchable
// words in the middle that a first/last-only check would miss. Two+ words
// ("aaron ro", "pete crow") narrows to: token[0] must prefix-match the
// player's actual first name, AND every remaining query token must
// prefix-match some other name token — this is what lets a search keep
// narrowing as the user keeps typing instead of staying stuck on a
// first-name-only match set.
export function searchPlayers(query: string, limit = 8): PlayerMatch[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  let matches: PlayerMatch[]

  if (tokens.length === 1) {
    const [token] = tokens
    matches = PLAYER_INDEX.filter((e) => e.nameTokens.some((t) => t.startsWith(token))).map(
      (entry): PlayerMatch => ({
        entry,
        matchedOn: entry.firstName.startsWith(token) ? 'first' : 'other',
        matchedPrefix: token,
      }),
    )
    // First-name matches rank above other-token matches (typing "j" surfaces
    // "Jalen Hurts" before a middle/surname-only "j" match), alphabetical
    // within each group.
    matches.sort((a, b) => {
      if (a.matchedOn !== b.matchedOn) return a.matchedOn === 'first' ? -1 : 1
      return a.entry.name.localeCompare(b.entry.name)
    })
  } else {
    const [firstToken, ...restTokens] = tokens
    matches = PLAYER_INDEX.filter(
      (e) =>
        e.firstName.startsWith(firstToken) &&
        restTokens.every((rt) => e.nameTokens.some((t) => t.startsWith(rt))),
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
