// Predictive command-syntax suggestions — Option B from the design
// discussion this was built from: a curated template list (reusing the
// exact same buildSampleQueries() data that already powers {sample-queries})
// filtered by prefix/substring match, rather than a real grammar walker
// (Option A). Selecting a suggestion fills the CLI input with the full
// command text for the user to edit values in and then explicitly run —
// it never auto-runs or navigates, unlike player search selection.
import { buildSampleQueries, type SampleQuery } from './sampleQueries'
import { getOpponentThisWeek, getWeeklyMatchupCommands } from './matchupCommands'
import { getTeamCodes } from './teams'

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

// Missing-leading-dash tolerance: driven entirely by the catalog token at
// this same position, not a hardcoded keyword list (no need to special-case
// "yds"/"last"/"career"/... one by one — every catalog entry already knows
// where its own dashes go). If the catalog expects a flag here ("-yds150")
// and the user typed the bare word ("yds150"), treat it as if the dash were
// there before normalizing/comparing.
function withToleratedDash(typed: string, catalogRaw: string): string {
  return !typed.startsWith('-') && catalogRaw.startsWith('-') ? `-${typed}` : typed
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
    if (normalizeToken(withToleratedDash(typedTokens[i], catalogTokens[i])) !== normalizeToken(catalogTokens[i])) return null
  }
  const lastIdx = typedTokens.length - 1
  const typedLast = normalizeToken(withToleratedDash(typedTokens[lastIdx], catalogTokens[lastIdx]))
  const catalogLast = normalizeToken(catalogTokens[lastIdx])
  if (!catalogLast.startsWith(typedLast)) return null
  return catalogTokens.slice(typedTokens.length)
}

// Prefix matches (the typed text is literally how the command starts, once
// numbers are normalized) rank above substring matches (typed text appears
// somewhere in the middle) — typing "nba -pts" should surface pts-trend
// commands before some unrelated command that merely happens to contain
// "pts" deeper in its string.
// A bare "nspe" is the only realistic case that hits this ceiling at all —
// prefix matching narrows well below it the moment a sport or stat is
// typed. Deliberately turned down from an earlier, more "aggressively
// informative" 50 — per feedback that {psc} had started to bite rather
// than help, this trades a little of that up-front breadth for staying out
// of the way; the dropdown still scrolls, so nothing is hidden, just not
// dumped all at once.
export function searchSyntax(query: string, limit = 30): SyntaxMatch[] {
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
      const resolvedLastToken = /\d/.test(typedLastRaw)
        ? withToleratedDash(typedLastRaw, catalogLastRaw)
        : catalogLastRaw
      // Dash-correct the already-typed tokens too (not just the last one) —
      // otherwise a suggestion built from "nfl yds150 last1/1" would keep
      // echoing the user's own missing dashes back at them instead of fixing
      // the typo on select.
      const correctedTyped = typedTokens
        .slice(0, lastIdx)
        .map((t, i) => withToleratedDash(t, catalogTokens[i]))
      const displayCommand = [...correctedTyped, resolvedLastToken, ...tail].join(' ')
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

// ---------------------------------------------------------------------------
// Keyword matching — {psc} that ignores garbage. Every word that appears in
// any catalog command or label is a keyword (flags with their digits and
// dashes stripped: "-yds50" -> "yds", "-last1/1" -> "last"), plus a small
// alias table for plain-English words ("tds", "yards", "against"). Whatever a
// user types is split into words, unrecognized ones are dropped, and any
// command containing the recognized ones is surfaced — so "sandwich mahomes
// pass td vs den" and "axc derrick" still find their commands.
// ---------------------------------------------------------------------------
const STOPWORDS = new Set([
  'how', 'many', 'much', 'does', 'do', 'did', 'have', 'has', 'had', 'this', 'that', 'the', 'an',
  'of', 'in', 'on', 'for', 'to', 'what', 'whats', 'who', 'is', 'are', 'was', 'were', 'me', 'show',
  'get', 'give', 'with', 'and', 'or', 'his', 'her', 'their', 'my', 'can', 'you', 'please', 'tell',
  'it', 'at', 'be', 'so', 'if', 'by', 'from', 'about',
])

// plain word -> the catalog token(s) it stands for
const KEYWORD_ALIASES: Record<string, string[]> = {
  tds: ['td'], touchdown: ['td'], touchdowns: ['td'],
  yards: ['yds'], yard: ['yds'], yds: ['yds'],
  passing: ['pass'], rushing: ['rush'], receiving: ['rec'], receptions: ['rec'], catches: ['rec'],
  against: ['vs'], versus: ['vs'], v: ['vs'],
  homer: ['hr'], homers: ['hr'], homeruns: ['hr'], dingers: ['hr'],
  points: ['pts'], rebounds: ['reb'], assists: ['ast'], steals: ['stl'], blocks: ['blk'],
  threes: ['tpm'], shots: ['sog'], goals: ['g'], walks: ['bb'], strikeouts: ['k'],
  overview: ['ov'], summary: ['ov'], total: ['ov'], totals: ['ov'], stats: ['ov'],
  streaks: ['streak'], halves: ['1h'], half: ['1h'], quarter: ['q1'],
  year: ['season'], yr: ['season'], lifetime: ['career'],
  // parlay -risk: the backend keyword is "safe"; "short" (short odds) is the
  // natural word for it.
  // broadcast slots (-mnf/-snf/-tnf/-prime)
  monday: ['mnf'], sunday: ['snf'], thursday: ['tnf'], primetime: ['prime'], slot: ['slots'],
  short: ['safe'], shorts: ['safe'], conservative: ['safe'], risky: ['longshot'],
}

// Words that signal "give me his numbers" — -ov commands get a small ranking
// boost when one appears, since -ov is the command that answers those.
const OV_TRIGGERS = new Set(['td', 'yds', 'season', 'career', 'ov', 'hr', 'rec', 'rush', 'pass'])

const SLASH_NUMS = /\d+(?:\/\d+)+/g

function commandWords(q: SampleQuery): Set<string> {
  const words = new Set<string>()
  for (const raw of q.command.toLowerCase().split(/[\s/]+/)) {
    const t = raw.replace(/^-+/, '')
    if (/^(1h|q[1-4]|p[1-3])$/.test(t)) { words.add(t); continue }
    const w = t.replace(/\d+$/, '')
    if (/^[a-z]{1,}$/.test(w)) words.add(w)
  }
  // Slash-joined numbers (parlay shapes like 3/3/3) are keywords whole.
  for (const m of q.command.match(SLASH_NUMS) ?? []) words.add(m)
  for (const w of q.label.toLowerCase().split(/[^a-z0-9]+/)) if (w.length >= 2) words.add(w)
  words.delete('nspe')
  // Every command in a sport's own bucket trivially contains that sport's
  // name — keeping it as a "keyword" means matching e.g. "mlb" alone would
  // score as a hit against the ENTIRE mlb catalog (real bug this surfaced:
  // "nspe mlb primetime" matched 30 unrelated mlb commands purely because
  // they all contain the word "mlb", not because any of them mention
  // primetime). The sport is already the hard filter in scoreCatalog; it
  // shouldn't also double as a soft-scoring keyword.
  for (const s of ['mlb', 'nfl', 'nba', 'nhl', 'cfb', 'ncaaf']) words.delete(s)
  return words
}

const COMMAND_WORDS = new Map<SampleQuery, Set<string>>()
const VOCAB = new Set<string>()
for (const q of SYNTAX_CATALOG) {
  const w = commandWords(q)
  COMMAND_WORDS.set(q, w)
  w.forEach((x) => VOCAB.add(x))
}

// a canonical keyword "hits" a command word on equality, or — for 3+ chars —
// as a prefix of it ("der" -> "derrick").
function wordHits(canon: string, word: string): boolean {
  return word === canon || (canon.length >= 3 && word.startsWith(canon))
}

export function extractKeywords(query: string): string[] {
  const out: string[] = []
  for (const m of query.match(SLASH_NUMS) ?? []) if (VOCAB.has(m) && !out.includes(m)) out.push(m)
  for (const raw of query.toLowerCase().split(/[^a-z0-9-]+/)) {
    const t = raw.replace(/^-+/, '')
    if (t.length < 2 || STOPWORDS.has(t)) continue
    const stripped = /^(1h|q[1-4]|p[1-3])$/.test(t) ? t : t.replace(/\d+$/, '')
    if (stripped.length < 2) continue
    const canons = KEYWORD_ALIASES[stripped] ?? [stripped]
    for (const c of canons) {
      let known = false
      for (const v of VOCAB) if (wordHits(c, v)) { known = true; break }
      if (known && !out.includes(c)) out.push(c)
    }
  }
  return out
}

function keywordScore(command: string, words: Set<string> | undefined, keywords: string[]): number {
  const w = words ?? new Set(command.toLowerCase().split(/[^a-z0-9]+/))
  let score = 0
  for (const k of keywords) for (const cw of w) if (wordHits(k, cw)) { score++; break }
  if (score > 0 && command.includes('-ov') && keywords.some((k) => OV_TRIGGERS.has(k))) score += 0.5
  return score
}

// Only words with no real discriminating signal by themselves — "vs" and
// "-ov" appear across nearly the whole catalog regardless of sport/stat, so
// recognizing just one of them alone isn't a real ask. Deliberately NOT
// here: mode words like "streak"/"team"/"long"/"week"/"parlay"/"safe"/
// "longshot" each map to one coherent command family, so a single hit on
// one of those is already a specific, useful narrowing on its own.
const GENERIC_KEYWORDS = new Set(['vs', 'ov', 'last', 'season', 'career', 'min', 'max'])

function isSpecificEnough(keywords: string[]): boolean {
  return keywords.some((k) => !GENERIC_KEYWORDS.has(k)) || keywords.length >= 2
}

function scoreCatalog(keywords: string[], sport?: string): { m: SyntaxMatch; score: number; i: number }[] {
  const seen = new Set<string>()
  const scored: { m: SyntaxMatch; score: number; i: number }[] = []
  SYNTAX_CATALOG.forEach((q, i) => {
    if (seen.has(q.command)) return
    if (sport && commandSport(q.command) !== sport) return
    const score = keywordScore(q.command, COMMAND_WORDS.get(q), keywords)
    if (score <= 0) return
    seen.add(q.command)
    scored.push({ m: { query: q, matchedPrefix: '', displayCommand: q.command }, score, i })
  })
  return scored
}

// Catalog commands containing at least one recognized keyword, best first.
// When `sport` is given (the user typed an explicit "nspe {sport}" prefix),
// results stay native to that sport first — only falling back to the whole
// catalog when that sport genuinely has nothing matching — so an MLB query
// with no MLB answer doesn't get padded out with NFL/NBA noise instead.
export function searchKeywords(query: string, sport?: string, limit = 30): SyntaxMatch[] {
  const keywords = extractKeywords(query)
  if (keywords.length === 0 || !isSpecificEnough(keywords)) return []
  let scored = sport ? scoreCatalog(keywords, sport) : []
  if (scored.length === 0) scored = scoreCatalog(keywords)
  scored.sort((a, b) => b.score - a.score || a.i - b.i)
  return scored.slice(0, limit).map((x) => x.m)
}

// Re-orders a player's commands by how many of the typed keywords they
// contain (stable, so untouched ties keep catalog order).
export function rankByKeywords(matches: SyntaxMatch[], query: string): SyntaxMatch[] {
  const keywords = extractKeywords(query)
  if (keywords.length === 0) return matches
  return matches
    .map((m, i) => ({ m, i, score: keywordScore(m.displayCommand, undefined, keywords), n: tokenize(m.displayCommand).length }))
    // Ties: the simpler (fewer-token) command first, so a bare "-ov" leads
    // the fancier window/scope variants.
    .sort((a, b) => b.score - a.score || (a.score > 0 ? a.n - b.n : 0) || a.i - b.i)
    .map((x) => x.m)
}

// Player-name lookup doesn't un-match syntax mode the way stat/window
// prefixes do — a query only ever LOOKS like player search or syntax, but
// once it's decided to look like player search, this surfaces every
// player-slot template (-ov in its 3 scopes, h2h, -week, ...) right
// alongside the top match's profile, so typing a name promotes the moat
// commands the same way the syntax dropdown already does for bare "nspe".
//
// Name-agnostic by substitution, not by list size: each tagged entry's
// playerHint is the literal substring inside its own `command` that stands
// in for "a player" (e.g. "mahomes" in "nspe nfl long mahomes -ov") — it's
// swapped out for whichever real player the live search (playerSearch.ts's
// PLAYER_INDEX) currently has topping the match list. That means every
// player in the index gets the full template set for free, the same way a
// catalog entry's threshold number was never tied to one hardcoded value —
// no whitelist or per-player catalog growth needed as the index grows.
// Every command in the catalog opens with "nspe {sport}" — reusing that
// instead of a separate per-entry sport field, so a template's league is
// never at risk of drifting out of sync with its own command text.
function commandSport(command: string): string | undefined {
  return tokenize(command)[1]
}

export function findPlayerSpotlightCommands(
  playerName: string,
  playerSport: string | undefined,
  playerTeam?: string,
  playerPosition?: string,
  typedQuery = '',
  limit = 60,
): SyntaxMatch[] {
  const resolved = playerName.toLowerCase()
  const team = playerTeam?.toLowerCase()
  const matches: SyntaxMatch[] = []

  const teamCodes = getTeamCodes(playerSport)
  const pushH2h = (opp: string, label: string) => {
    const command = `nspe ${playerSport} ${resolved} vs ${opp}`
    if (!matches.some((m) => m.displayCommand === command)) {
      matches.push({ query: { label, command }, matchedPrefix: '', displayCommand: command })
    }
  }

  // Team codes the user actually typed ("vs den", or a bare "den") come
  // first — exact codes only, so partial words never fabricate a matchup.
  if (playerSport && teamCodes.length > 0) {
    const words = typedQuery.toLowerCase().split(/[^a-z]+/).filter(Boolean)
    words.forEach((w, i) => {
      // 2-letter codes ("no", "sf") only count right after "vs" — bare, they
      // collide with ordinary words.
      const ok = w.length >= 3 || words[i - 1] === 'vs'
      if (ok && w !== team && teamCodes.includes(w)) pushH2h(w, `${playerSport} h2h · ${w}`)
    })
  }

  // This week's real opponent first (NFL only — the only schedule we have),
  // so the most relevant h2h is always the top suggestion for that player.
  if (playerSport === 'nfl') {
    const opp = getOpponentThisWeek(team)
    if (opp) pushH2h(opp, 'nfl h2h · this week')
  }

  for (const q of SYNTAX_CATALOG) {
    if (!q.playerHint) continue
    // Only cross-check sport when the matched player's own sport is known —
    // an NFL player must never surface "vs bos" MLB h2h templates. When it's
    // unknown (index entry predates the sport field), fall back to showing
    // everything rather than silently hiding real suggestions.
    if (playerSport && commandSport(q.command) !== playerSport) continue
    if (q.onlyFor && q.onlyFor !== resolved) continue
    if (q.qbOnly && playerPosition && playerPosition !== 'QB') continue
    // Skip "vs X" templates where X is the player's own team.
    if (team && q.command.toLowerCase().endsWith(` vs ${team}`)) continue
    const displayCommand = q.command.toLowerCase().replace(q.playerHint, resolved)
    if (matches.some((m) => m.displayCommand === displayCommand)) continue
    matches.push({ query: q, matchedPrefix: '', displayCommand })
  }
  // Every other team last, so any "player vs TEAM" is one scroll away
  // without crowding out the -ov variants above.
  for (const code of teamCodes) if (code !== team) pushH2h(code, `${playerSport} h2h · ${code}`)
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
