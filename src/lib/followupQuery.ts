// Client-side conversational follow-ups ("what about receiving?" after a
// Derrick Henry TD question) — built entirely to the backend's own spec
// (docs/frontend_spec_followup_questions_2026-09-27.md in nspe-v2, Option A:
// no backend changes, no new session store). `/run` already returns
// everything needed to rebuild context locally on every NL-resolved
// response, in the `nl.entities` block.
//
// The whole mechanism, end to end:
//   1. After every successful, non-disambiguating /run response that carries
//      an `nl` block, remember its `entities`+`sport` as the last-known
//      topic (see LastNlContext / shouldRememberAsContext below).
//   2. Before sending a new typed message, check it against the small
//      enumerable fragment grammar below (detectFollowup).
//   3. A match gets rewritten into a full plain-English sentence merging the
//      fragment with the remembered topic (buildFollowupSentence) — that
//      rewritten sentence is what actually gets sent to /run, never the raw
//      fragment. A miss is sent unchanged, exactly like today.
//   4. Whatever was inferred must be shown, never merged silently — see
//      FollowupMatch.summary, meant for a "Continuing: …" chip.
//
// Deliberately NOT general NLP: the fragment grammar and dimension
// vocabularies below are small, closed lists, matching the backend's own NL
// layer philosophy (deterministic mapping over a fixed grammar). If a
// message doesn't cleanly match, it's just sent as a normal new question.
import { searchPlayersLoose } from './playerSearch'
import { getTeamCodes } from './teams'

export interface NlEntities {
  players: Array<{ name: string; league?: string; team?: string; pos?: string }>
  team: string | null
  stat: string | null
  threshold: number | null
  window: string | null
}

export interface NlBlock {
  intent?: string
  confidence?: number
  original?: string
  interpreted_as?: string
  commands?: string[]
  sport: string
  entities: NlEntities
  assumptions?: string[]
  notes?: string[]
  headline?: string
}

export interface LastNlContext {
  sport: string
  entities: NlEntities
}

function isNlEntities(value: unknown): value is NlEntities {
  if (!value || typeof value !== 'object') return false
  const rec = value as Record<string, unknown>
  return Array.isArray(rec.players)
}

/** Reads the top-level `nl` block off a raw /run payload, when present —
 * absent entirely for a raw CLI-syntax query (see the spec doc's note that
 * `nl` only shows up "when the query went through the NL layer"). */
export function extractNlBlock(payload: unknown): NlBlock | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const rec = payload as Record<string, unknown>
  const nl = rec.nl
  if (!nl || typeof nl !== 'object' || Array.isArray(nl)) return null
  const nlRec = nl as Record<string, unknown>
  if (!isNlEntities(nlRec.entities) || typeof nlRec.sport !== 'string') return null
  return nlRec as unknown as NlBlock
}

/** A pending "which of these did you mean" prompt means nothing is actually
 * resolved yet — never worth remembering as a topic (guardrail from the
 * spec doc). Structural check only (works whether or not the feature is
 * actually turned on backend-side). */
export function hasPendingDisambiguation(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const rec = payload as Record<string, unknown>
  return rec.disambiguation != null
}

/** The single gate for "should this response become the new lastContext" —
 * called once per /run response, regardless of which specific view ends up
 * rendering it. Deliberately conservative: no nl block, no player subject,
 * or a pending disambiguation all mean "don't touch lastContext" rather than
 * clearing it — a failed/ambiguous turn shouldn't cost the conversation its
 * only usable context. */
export function contextFromResponse(payload: unknown): LastNlContext | null {
  if (hasPendingDisambiguation(payload)) return null
  const nl = extractNlBlock(payload)
  if (!nl || nl.entities.players.length === 0) return null
  return { sport: nl.sport, entities: nl.entities }
}

// ---------------------------------------------------------------------------
// Dimension vocabulary — small and enumerable, per the spec.
// ---------------------------------------------------------------------------

// Qualifies whatever stat is already in context rather than replacing it
// outright — "what about receiving" after a TD question means "receiving
// touchdowns," not "receiving" on its own.
const CATEGORY_WORDS = new Set(['receiving', 'rushing', 'passing'])

// Stands alone as a full replacement for the existing stat.
const STAT_NAME_WORDS: Record<string, string> = {
  touchdowns: 'touchdowns', touchdown: 'touchdowns', tds: 'touchdowns', td: 'touchdowns',
  yards: 'yards', yds: 'yards',
  receptions: 'receptions', catches: 'receptions', targets: 'targets',
  carries: 'carries', attempts: 'attempts', completions: 'completions',
  interceptions: 'interceptions', picks: 'interceptions',
  points: 'points', rebounds: 'rebounds', assists: 'assists',
  steals: 'steals', blocks: 'blocks', threes: '3-pointers made',
  hits: 'hits', homers: 'home runs', homeruns: 'home runs', 'home runs': 'home runs',
  strikeouts: 'strikeouts', walks: 'walks', rbi: 'RBI', rbis: 'RBI',
  goals: 'goals', saves: 'saves', shots: 'shots on goal',
}

// Renders a backend stat code (as seen on nl.entities.stat, e.g. "TD") back
// into a word for stitching into a category phrase ("receiving " + this).
// Falls back to lowercasing the raw code when it's not one we know — still
// a coherent-enough word for the NL layer to reparse, per the spec's "this
// only needs to produce a sentence, not a command."
const STAT_CODE_TO_WORD: Record<string, string> = {
  TD: 'touchdowns', YDS: 'yards', REC: 'receptions', TGTS: 'targets',
  ATT: 'attempts', CMP: 'completions', INT: 'interceptions',
  PTS: 'points', REB: 'rebounds', AST: 'assists', STL: 'steals', BLK: 'blocks',
  HR: 'home runs', HITS: 'hits', RBI: 'RBI', SO: 'strikeouts', BB: 'walks',
  G: 'goals', A: 'assists', SOG: 'shots on goal', SAVES: 'saves',
}

function statWord(code: string | null): string {
  if (!code) return ''
  return STAT_CODE_TO_WORD[code.trim().toUpperCase()] ?? code.toLowerCase()
}

// Longest-first so "last 5 games" matches before a bare "last" would.
const WINDOW_PHRASES: Array<{ pattern: RegExp; render: (m: RegExpMatchArray) => string }> = [
  { pattern: /^last\s+(\d+)\s+games?$/, render: (m) => `last ${m[1]} games` },
  { pattern: /^this\s+season$/, render: () => 'this season' },
  { pattern: /^last\s+season$/, render: () => 'last season' },
  { pattern: /^this\s+year$/, render: () => 'this season' },
  { pattern: /^career$/, render: () => 'career' },
  { pattern: /^(the\s+)?playoffs$/, render: () => 'playoffs' },
  { pattern: /^postseason$/, render: () => 'playoffs' },
  { pattern: /^\d{4}$/, render: (m) => m[0] },
  { pattern: /^\d{4}-\d{4}$/, render: (m) => m[0] },
]

// Words that can sit alongside a dimension word without ruining a match
// ("his receiving", "just this season?", "what about just his rushing") —
// connectors, possessives and intensifiers only, nothing that carries its
// own meaning. Stripped before matching, in both the prefixed-trigger and
// bare-dimension paths — "this"/"season" stay, since WINDOW_PHRASES needs
// them as a unit.
const FILLER_WORDS = new Set([
  'his', 'her', 'their', 'the', 'a', 'for', 'in', 'on', 'about', 'and',
  'just', 'only', 'also',
])

type MatchedDimension =
  | { kind: 'stat-category'; value: string }
  | { kind: 'stat-name'; value: string }
  | { kind: 'window'; value: string }
  | { kind: 'team'; value: string }

function classifyDimension(phrase: string, sport: string): MatchedDimension | null {
  const cleaned = phrase
    .trim()
    .toLowerCase()
    .replace(/[?.!]+$/, '')
    .split(/\s+/)
    .filter((w) => w && !FILLER_WORDS.has(w))
    .join(' ')
  if (!cleaned) return null

  for (const { pattern, render } of WINDOW_PHRASES) {
    const m = cleaned.match(pattern)
    if (m) return { kind: 'window', value: render(m) }
  }

  const teamCodes = getTeamCodes(sport)
  const withoutVs = cleaned.replace(/^(vs\.?|against)\s+/, '')
  if (teamCodes.includes(withoutVs)) return { kind: 'team', value: withoutVs }

  if (CATEGORY_WORDS.has(cleaned)) return { kind: 'stat-category', value: cleaned }
  if (STAT_NAME_WORDS[cleaned]) return { kind: 'stat-name', value: STAT_NAME_WORDS[cleaned] }

  return null
}

/** "Bare dimension" shape: no trigger phrase, no verb, no player name — just
 * the dimension itself, optionally dressed with filler words
 * ("receiving touchdowns?", "this season?", "his rushing"). Rejects
 * anything with a leftover word outside the closed vocabulary, which is
 * what keeps a genuine full sentence (which has verbs) from matching. */
function classifyBareDimension(text: string, sport: string): MatchedDimension | null {
  const words = text.trim().toLowerCase().replace(/[?.!]+$/, '').split(/\s+/).filter(Boolean)
  if (words.length === 0 || words.length > 4) return null

  const meaningful = words.filter((w) => !FILLER_WORDS.has(w))
  if (meaningful.length === 0) return null

  // Try the full meaningful phrase first ("receiving touchdowns" as one
  // unit isn't itself a listed dimension, but each word might classify on
  // its own — a category word plus a stat name, e.g. "receiving touchdowns",
  // is exactly the doc's example shape once already resolved once).
  const whole = classifyDimension(meaningful.join(' '), sport)
  if (whole) return whole

  if (meaningful.length === 1) return classifyDimension(meaningful[0], sport)

  // "receiving touchdowns" — one category word + one stat name word,
  // together describing a single new stat outright.
  if (meaningful.length === 2) {
    const [a, b] = meaningful
    if (CATEGORY_WORDS.has(a) && STAT_NAME_WORDS[b]) {
      return { kind: 'stat-name', value: `${a} ${STAT_NAME_WORDS[b]}` }
    }
  }

  return null
}

export interface FollowupMatch {
  dimension: MatchedDimension
  /** The rewritten plain-English sentence — this, not the raw fragment, is
   * what actually gets sent to /run. */
  sentence: string
  /** For the required "never merge silently" UI — see App.tsx's use of it. */
  summary: string
}

/** The whole entry point: null means "not a follow-up, send `text` as
 * typed" — the caller's existing behavior, completely unchanged. A new
 * player name in `text` always wins over any fragment shape (a real subject
 * always starts fresh), checked first and unconditionally. */
export function detectFollowup(text: string, context: LastNlContext | null): FollowupMatch | null {
  if (!context) return null
  const subject = context.entities.players[0]?.name
  if (!subject) return null

  // Guardrail: a message naming its own player is never a follow-up, no
  // matter how it's phrased.
  if (searchPlayersLoose(text).length > 0) return null

  const trimmed = text.trim()
  const sport = context.sport

  let dimension: MatchedDimension | null = null

  const prefixed = trimmed.match(/^(what about|and|same but)\s+(.+)$/i)
  if (prefixed) {
    dimension = classifyDimension(prefixed[2], sport) ?? classifyBareDimension(prefixed[2], sport)
  } else {
    dimension = classifyBareDimension(trimmed, sport)
  }

  if (!dimension) return null

  let stat = statWord(context.entities.stat)
  let windowPhrase = context.entities.window || ''
  let teamPhrase = context.entities.team ? `vs ${context.entities.team}` : ''

  if (dimension.kind === 'stat-category') {
    stat = stat ? `${dimension.value} ${stat}` : dimension.value
  } else if (dimension.kind === 'stat-name') {
    stat = dimension.value
  } else if (dimension.kind === 'window') {
    windowPhrase = dimension.value
  } else if (dimension.kind === 'team') {
    teamPhrase = `vs ${dimension.value}`
  }

  const sentence = [`${subject}'s`, stat, teamPhrase, windowPhrase]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  const summary = ['Continuing:', subject, stat].filter(Boolean).join(' ')

  return { dimension, sentence, summary }
}
