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
}

// buildSampleQueries() is pure, reading static curated tables — safe to
// compute once per module load rather than per keystroke.
const SYNTAX_CATALOG = buildSampleQueries()

// Prefix matches (the typed text is literally how the command starts) rank
// above substring matches (typed text appears somewhere in the middle) —
// typing "nba -pts" should surface pts-trend commands before some unrelated
// command that merely happens to contain "pts" deeper in its string.
export function searchSyntax(query: string, limit = 8): SyntaxMatch[] {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return []

  const withNspe = trimmed.startsWith('nspe') ? trimmed : `nspe ${trimmed}`

  const prefixMatches: SyntaxMatch[] = []
  const containsMatches: SyntaxMatch[] = []

  for (const q of SYNTAX_CATALOG) {
    const command = q.command.toLowerCase()
    if (command.startsWith(withNspe) || command.startsWith(trimmed)) {
      prefixMatches.push({ query: q, matchedPrefix: trimmed })
    } else if (command.includes(trimmed)) {
      containsMatches.push({ query: q, matchedPrefix: trimmed })
    }
  }

  return [...prefixMatches, ...containsMatches].slice(0, limit)
}
