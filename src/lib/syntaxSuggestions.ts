// Predictive command-syntax suggestions — Option B from the design
// discussion this was built from: a curated template list (reusing the
// exact same buildSampleQueries() data that already powers {sample-queries})
// filtered by prefix/substring match, rather than a real grammar walker
// (Option A). Selecting a suggestion fills the CLI input with the full
// command text for the user to edit values in and then explicitly run —
// it never auto-runs or navigates, unlike player search selection.
import { buildSampleQueries, type SampleQuery } from './sampleQueries'

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
// 25 is a comfortable ceiling — a bare "nspe" is the only realistic case
// that hits it (prefix matching naturally narrows well below 25 the moment
// a sport or stat is typed), and the dropdown scrolls if it's ever exceeded.
export function searchSyntax(query: string, limit = 25): SyntaxMatch[] {
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
    } else if (command.includes(trimmed)) {
      containsMatches.push({ query: q, matchedPrefix: trimmed, displayCommand: q.command })
    }
  }

  return [...prefixMatches, ...containsMatches].slice(0, limit)
}
