// Predictive command-syntax suggestions — Option B from the design
// discussion this was built from: a curated template list (reusing the
// exact same buildSampleQueries() data that already powers {sample-queries})
// filtered by prefix/substring match, rather than a real grammar walker
// (Option A). Selecting a suggestion fills the CLI input with the full
// command text for the user to edit values in and then explicitly run —
// it never auto-runs or navigates, unlike player search selection.
import { buildSampleQueries, type SampleQuery } from './sampleQueries'
import { getWeeklyMatchupCommands } from './matchupCommands'

export interface SyntaxMatch {
  query: SampleQuery
  matchedPrefix: string
  // What to actually insert on selection/highlight — the user's own typed
  // tokens followed by whatever catalog tokens come after them. Differs from
  // query.command whenever the user's numbers differ from the catalog's
  // example numbers (see matchTokenShape below): editing "-yds30" to
  // "-yds40" must not un-match the "-last1/1" that follows it just because
  // the literal digits no longer agree with the curated example.
  displayCommand: string
}

// buildSampleQueries() is pure, reading static curated tables — safe to
// compute once per module load rather than per keystroke.
const SYNTAX_CATALOG = buildSampleQueries()

function tokenize(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean)
}

// Collapse a token's trailing digit run to a placeholder so tokens compare
// equal by shape regardless of the specific number typed — "-yds30" and
// "-yds40" both normalize to "-yds#", and a still-being-typed "-yds4" or even
// bare "-yds" (no digits yet) normalizes toward the same family so partial
// input keeps matching mid-keystroke.
function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/^(-last)\d+\/\d+$/, '$1#/#')
    .replace(/^(-last)\d+$/, '$1#')
    .replace(/^(min)\d+$/, '$1#')
    .replace(/^(max)\d+$/, '$1#')
    // Combo stats ("-pts/-ast35") — same digit-collapse as the plain
    // "-stat#" case just below, but for the slash-joined two-flag shape
    // QueryBuilder now emits for NBA's combo stats. Without this, editing
    // the threshold on one of these (e.g. "-pts/-ast35" -> "-pts/-ast40")
    // would un-match the "-last#/#" that follows it, the exact bug the
    // plain-stat case already avoids.
    .replace(/^(-[a-z]+\/-[a-z]+)\d+$/, '$1#')
    .replace(/^(-[a-z]+)\d+$/, '$1#')
}

// Token-shape match: every typed token except the last must equal the
// catalog's token at that position (post-normalization); the last typed
// token only needs to be a normalized *prefix* of the catalog's token there
// (the user may still be mid-digit on it). Returns the catalog tokens beyond
// what's been typed, to append verbatim — this is what keeps "-last1/1" (or
// whatever follows) alive after the user changes an earlier number.
function matchTokenShape(typedTokens: string[], catalogTokens: string[]): string[] | null {
  if (typedTokens.length === 0 || typedTokens.length > catalogTokens.length) return null
  for (let i = 0; i < typedTokens.length - 1; i++) {
    if (normalizeToken(typedTokens[i]) !== normalizeToken(catalogTokens[i])) return null
  }
  const lastIdx = typedTokens.length - 1
  const typedLast = normalizeToken(typedTokens[lastIdx])
  const catalogLast = normalizeToken(catalogTokens[lastIdx])
  if (!catalogLast.startsWith(typedLast)) return null
  return catalogTokens.slice(typedTokens.length)
}

// Prefix matches (the typed text is literally how the command starts, once
// numbers are normalized) rank above substring matches (typed text appears
// somewhere in the middle) — typing "nba -pts" should surface pts-trend
// commands before some unrelated command that merely happens to contain
// "pts" deeper in its string.
// 50 is a comfortable ceiling — the dropdown scrolls, so this isn't "how
// many are visible at once," it's "how deep can you scroll for a bare
// nspe." A bare "nspe" is the only realistic case that hits it at all —
// prefix matching narrows well below this the moment a sport or stat is
// typed. The product goal here is deliberately "aggressively informative"
// rather than minimal — {psc} is meant to spark curiosity about what's
// possible, so erring toward showing more command *types* up front (not
// just a token sample) is the right trade once scrolling absorbs the cost.
export function searchSyntax(query: string, limit = 50): SyntaxMatch[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []

  const withNspe = trimmed.startsWith('nspe') ? trimmed : `nspe ${trimmed}`
  const typedTokens = tokenize(withNspe)

  const prefixMatches: SyntaxMatch[] = []
  const containsMatches: SyntaxMatch[] = []

  const lastIdx = typedTokens.length - 1

  for (const q of SYNTAX_CATALOG) {
    const command = q.command.toLowerCase()
    const catalogTokens = tokenize(command)
    const tail = matchTokenShape(typedTokens, catalogTokens)
    if (tail) {
      // Keep showing the catalog's own preset value for the token the user
      // is still mid-typing, right up until they type a digit of their own
      // into it — that's the signal they're overriding the preset rather
      // than just still spelling out the flag name. Without this, "-pts" (no
      // digit yet) would show as just "-pts" instead of the persisted
      // "-pts25", and the same for "-last" vs "-last3/5" — the preset value
      // would blink out the instant the flag name itself was fully typed,
      // before the user ever got a chance to type their own number.
      const typedLastRaw = typedTokens[lastIdx]
      const catalogLastRaw = catalogTokens[lastIdx]
      const resolvedLastToken = /\d/.test(typedLastRaw) ? typedLastRaw : catalogLastRaw
      const displayCommand = [...typedTokens.slice(0, lastIdx), resolvedLastToken, ...tail].join(' ')
      prefixMatches.push({ query: q, matchedPrefix: trimmed, displayCommand })
    } else if (command.includes(trimmed) || q.label.toLowerCase().includes(trimmed)) {
      // Also checks the label, not just the literal command text — some
      // modes (h2h) never appear as a literal token in the command itself
      // ("nspe mlb judge vs bos" has no "h2h" substring anywhere), only in
      // the label ("mlb h2h"), so command-only matching left them
      // unreachable by their own mode name.
      containsMatches.push({ query: q, matchedPrefix: trimmed, displayCommand: q.command })
    }
  }

  return [...prefixMatches, ...containsMatches].slice(0, limit)
}

// Player-name lookup doesn't un-match syntax mode the way stat/window
// prefixes do — a query only ever LOOKS like player search or syntax, but
// once it's decided to look like player search, this surfaces any curated
// commands that showcase one of the matched players (Patrick Mahomes ->
// "nspe nfl long mahomes -ov") right alongside their profile match, so
// typing a name promotes the moat commands the same way the syntax
// dropdown already does for bare "nspe". Matched by substring against the
// player's real display name, not an exact slug — see playerHint's comment
// in predictiveCommands.ts for why. The explicit goal is showing ~all the
// popular query shapes for one player (-ov in its 3 scopes, h2h, -week,
// ...), not a token sample of them — 20 gives real headroom as each
// player's set of tagged commands grows past the initial 5.
export function findPlayerSpotlightCommands(playerNames: string[], limit = 20): SyntaxMatch[] {
  const lowerNames = playerNames.map((n) => n.toLowerCase())
  const matches: SyntaxMatch[] = []
  for (const q of SYNTAX_CATALOG) {
    if (!q.playerHint) continue
    if (lowerNames.some((name) => name.includes(q.playerHint!))) {
      matches.push({ query: q, matchedPrefix: '', displayCommand: q.command })
    }
  }
  return matches.slice(0, limit)
}

// "matchup" isn't a static catalog entry (it's a dynamic weekly slate, not
// a fixed example command) and deliberately doesn't go through
// looksLikePlayerSearch/searchSyntax's mutual exclusivity at all — this is
// checked independently and layered in alongside whichever of
// playerMatches/syntaxMatches is already showing, so typing "ma" surfaces
// this week's full slate right under Mahomes' profile match rather than
// needing "nspe" typed first. Any prefix of the word "matchup" long enough
// to be a deliberate signal (2+ chars, so bare "m" doesn't fire on every
// single keystroke) triggers it.
export function getMatchupSuggestions(query: string): SyntaxMatch[] {
  const trimmed = query.trim().toLowerCase()
  if (trimmed.length < 2 || !'matchup'.startsWith(trimmed)) return []
  return getWeeklyMatchupCommands().map((q) => ({ query: q, matchedPrefix: '', displayCommand: q.command }))
}
