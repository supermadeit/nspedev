// Flat player index + name-search matching, shared by desktop's CLI input
// and mobile's dedicated search input (both wire this same module — see
// the plan discussion this was built from). Sourced from the live
// GET /database/index endpoint (fetched once, cached — not a bundled glob
// anymore) so the index — and therefore what's searchable — grows as the
// backend's roster grows, with no rebuild/redeploy needed on this side. See
// nspedev-live-architecture-pivot in memory for the migration this replaced
// (qb-profiles/*.json + batter-profiles/*.json globs).
import { normalizeDisplayPlayer, PLAYER_TEAM_MAP } from './nspe-payloads'
import { fetchPlayerIndex } from './databaseApi'

export interface PlayerIndexEntry {
  name: string
  slug: string
  team: string
  position: string
  // Lowercase league token ('nfl'/'mlb'/'nba'/'nhl'), when the backend index
  // sends one — used to keep findPlayerSpotlightCommands (syntaxSuggestions.ts)
  // from handing an NFL player MLB h2h templates and vice versa. Optional
  // since this is a newer field on a still-settling endpoint (see
  // databaseApi.ts's DatabaseIndexEntry comment) — treat its absence as
  // "unknown," not "no sport."
  sport?: string
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

// Mutable — starts empty, populated once loadPlayerIndex()'s fetch resolves.
// searchPlayers() stays synchronous and just reads whatever's here at call
// time (empty results before the first load completes, same as any other
// "no matches yet" case — App.tsx re-triggers its search useMemo once
// loadPlayerIndex() resolves so results appear without the user retyping).
export let PLAYER_INDEX: PlayerIndexEntry[] = []

let loadPromise: Promise<void> | null = null

// Idempotent — safe to call from multiple components/renders, only ever
// fetches once. Callers that need to react to the index becoming available
// (e.g. to recompute search results) should await this or key off its
// resolution, not assume PLAYER_INDEX is already populated on first render.
export function loadPlayerIndex(): Promise<void> {
  if (!loadPromise) {
    loadPromise = fetchPlayerIndex()
      .then((entries) => {
        PLAYER_INDEX = entries.map((e) => {
          const display = normalizeDisplayPlayer(e.name)
          const nameTokens = buildNameTokens(display)
          return {
            name: display,
            slug: e.slug,
            team: e.team,
            position: e.position,
            sport: e.sport?.toLowerCase(),
            firstName: nameTokens[0] ?? '',
            lastName: nameTokens[nameTokens.length - 1] ?? '',
            nameTokens,
          }
        })
      })
      .catch((err) => {
        console.error('Failed to load player search index:', err)
        // Leave loadPromise resolved (not reset to null) — a hard failure
        // shouldn't retry on every keystroke; PLAYER_INDEX just stays empty
        // until a full page reload.
      })
  }
  return loadPromise
}

// Frontend player -> team fallback for query results whose backend engine
// doesn't echo a team field on the row itself — checked before falling back
// to the raw result rendering with no team at all. PLAYER_INDEX (this same
// module's live /database/index fetch) is tried first since it's the
// broader, actively-growing source; PLAYER_TEAM_MAP (nspe-payloads.ts,
// built from the bundled leaderboard/hitlist data) only fills in players
// PLAYER_INDEX doesn't have yet — most trend/compute engines return far more
// players than have a dedicated database profile.
export function resolvePlayerTeam(player: string): string | undefined {
  const normalized = normalizeDisplayPlayer(player).toLowerCase()
  const indexed = PLAYER_INDEX.find((e) => e.name.toLowerCase() === normalized)
  if (indexed?.team) return indexed.team
  return PLAYER_TEAM_MAP.get(normalized)
}

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

// Words that can never be part of a player name in a typed command: the
// command grammar's own keywords, flags, and numbers. Kept local (not
// imported from App.tsx) to avoid a lib -> component dependency.
const NON_NAME_TOKENS = new Set([
  'nspe', 'mlb', 'nfl', 'nba', 'nhl', 'cfb', 'ncaaf', 'plus', 'help',
  'streak', 'team', 'first', 'long', 'h2h', 'week', '1h', 'q1', 'p1',
  'pass', 'rush', 'rec', 'any', 'vs', 'min', 'max', 'matchup',
  // Everyday filler + stat words, so "how many tds does derrick henry have
  // this season" reduces to just "derrick henry".
  'how', 'many', 'much', 'does', 'do', 'did', 'have', 'has', 'had', 'this', 'that', 'the', 'what',
  'whats', 'who', 'is', 'are', 'was', 'were', 'me', 'show', 'get', 'give', 'with', 'and', 'or',
  'his', 'her', 'their', 'my', 'can', 'you', 'please', 'tell', 'for', 'of', 'in', 'on', 'to',
  'td', 'tds', 'touchdown', 'touchdowns', 'yds', 'yards', 'season', 'career', 'total', 'stats',
  'against', 'versus', 'ov', 'last', 'streak',
])

// Like searchPlayers, but tolerant of junk around the name: "xyz derrick",
// "nspe nfl derrick henry vs cin" and "der -ov" all still find Derrick
// Henry. Grammar tokens/flags/numbers split the input into runs of
// candidate name words; every contiguous sub-run is tried (longest first,
// then leftmost) and the first that matches anyone wins, so a real
// full-name match beats a stray first-name-only one.
export function searchPlayersLoose(query: string, limit = 8): PlayerMatch[] {
  const words = query.trim().toLowerCase().split(/[\s/,]+/).filter(Boolean)
  const runs: string[][] = []
  let cur: string[] = []
  for (const w of words) {
    if (NON_NAME_TOKENS.has(w) || w.startsWith('-') || /\d/.test(w)) {
      if (cur.length) runs.push(cur)
      cur = []
    } else {
      cur.push(w)
    }
  }
  if (cur.length) runs.push(cur)

  const candidates: string[][] = []
  for (const run of runs) {
    for (let len = run.length; len >= 1; len--) {
      for (let start = 0; start + len <= run.length; start++) {
        candidates.push(run.slice(start, start + len))
      }
    }
  }
  // Longest run first (a full name beats a stray first name); among
  // single words, one that IS a whole name token ("derrick") beats one that
  // merely prefixes a name ("der..."), then longer words beat shorter ones.
  const isExactToken = (w: string) => PLAYER_INDEX.some((e) => e.nameTokens.includes(w))
  candidates.sort((a, b) => {
    if (a.length !== b.length) return b.length - a.length
    if (a.length === 1) {
      const ea = isExactToken(a[0]) ? 1 : 0
      const eb = isExactToken(b[0]) ? 1 : 0
      if (ea !== eb) return eb - ea
      return b[0].length - a[0].length
    }
    return 0
  })
  for (const c of candidates) {
    const found = searchPlayers(c.join(' '), limit)
    if (found.length) return found
  }
  return []
}
