import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import hitlistData from '@/assets/data/hitlist.json'
import leaderboardData from '@/assets/data/leaderboard.json'
import madeitLogo from '@/assets/images/madeit-tech-logo-v2.jpeg'
import { useIsMobile } from '@/hooks/use-mobile'
import { QueryBuilder } from '@/components/QueryBuilder'
import { QueryBuilderTutorial } from '@/components/QueryBuilderTutorial'
import { AutoDemo } from '@/components/AutoDemo'
import { SampleQueriesModal } from '@/components/SampleQueriesModal'
import { H2hStaffOverlay } from '@/components/H2hStaffOverlay'
import { MatchupInsightOverlay } from '@/components/MatchupInsightOverlay'
import { PlayerSearchDropdown } from '@/components/PlayerSearchDropdown'
import { SyntaxSuggestionDropdown } from '@/components/SyntaxSuggestionDropdown'
import { loadPlayerIndex, resolvePlayerTeam, searchPlayers, searchPlayersLoose } from '@/lib/playerSearch'
import {
  findPlayerSpotlightCommands,
  getMatchupSuggestions,
  rankByKeywords,
  searchKeywords,
  searchSyntax,
} from '@/lib/syntaxSuggestions'
import { authHeader } from '@/lib/auth-token'
import {
  asNumber,
  fetchFirstSuccessful,
  formatQueryError,
  getPayloadError,
  parseApiPayload,
  RUN_ENDPOINTS,
  sanitizeQueryForApi,
} from '@/lib/nspe-api'
import {
  detectStatContext,
  extractDateToken,
  extractH2hPayload,
  extractMatchupInsightPayload,
  extractMlbBatTeamPayload,
  extractMlbFirstPaTrendPayload,
  extractMlbHrPayload,
  extractMlbPitchFpvPayload,
  extractMlbPitchH2hPayload,
  extractMlbPlayerReportPayload,
  extractMlbReportLeaderboardPayload,
  extractMlbTeamOverviewPayload,
  extractMlbTeamRunsPayload,
  extractExplosiveOverviewPayload,
  extractNflParlayPayload,
  extractNflPlayerSlotsPayload,
  extractNflTeamSlotsPayload,
  extractNflPlayerLegsPayload,
  extractNflOverviewScopesPayload,
  extractNflOverviewStatNPayload,
  isNflExplosivePayload,
  normalizeDisplayPlayer,
  normalizeQueryResults,
  STAT_DISPLAY_LABELS,
  type H2hPayload,
  type MatchupInsightPayload,
  type MlbBatTeamPayload,
  type MlbFirstPaTrendPayload,
  type MlbHrComputeResult,
  type MlbHrPayload,
  type MlbHrTrendResult,
  type MlbPitchFpvPayload,
  type MlbPitchH2hPayload,
  type MlbPlayerReportBreakdown,
  type MlbPlayerReportPayload,
  type MlbReportLeaderboardPayload,
  type MlbTeamOverviewPayload,
  type MlbTeamRunsComputeResult,
  type MlbTeamRunsPayload,
  type MlbTeamRunsTrendResult,
  type ExplosiveOverviewPayload,
  type NflParlayLeg,
  type NflParlayPayload,
  type NflPlayerSlotsPayload,
  type NflTeamSlotsPayload,
  type NflPlayerLegsPayload,
  type NflOverviewScopesPayload,
  type NflOverviewStatNPayload,
  type NflExplosivePayload,
  type QueryResult,
} from '@/lib/nspe-payloads'

const STARFIELD_CHARS = ['$', '*', '+', '⋇', '𝛯', '☼', '➲','✦','⚛︎','⚇']

const TERMINAL_COLORS = [
  'oklch(0.95 0 0)',
  'oklch(0.85 0.15 195)',
  'oklch(0.75 0.15 145)',
  'oklch(0.65 0.15 250)',
]

const PLACEHOLDER_TEXTS = ['{SPORTS}{WORLD} IS YOURS']

const COMMAND_EXAMPLES = [
  {
    command: 'nba -pts30 -last3/5',
    description: 'Players with 30+ points in 3 of their last 5 games',
  },
  {
    command: 'nhl -pts min100 -season',
    description: 'Skaters with 100+ points this season',
  },
  {
    command: 'nba -ast10 -last7/10',
    description: 'Players with 10+ assists in 7 of their last 10 games',
  },
  {
    command: 'mlb -dub -last3/5',
    description: 'Batters with a double in 3 of their last 5 games',
  },
  {
    command: 'nba -pts min1500 -season',
    description: 'Players with 1500+ points this season',
  },
  {
    command: 'nba -reb min100 -last10',
    description: 'Players with 100+ rebounds in their last 10 games',
  },
]

const SAMPLE_COMMANDS: Array<{ label: string; command: string; comingSoon?: boolean }> = [
  { label: 'nspe nba post -pts/-ast350 -last10', command: 'nspe nba post -pts/-ast350 -last10' },
  { label: 'nspe nba post 1h -pts15 -last3/5', command: 'nspe nba post 1h -pts15 -last3/5' },
  { label: 'nspe nba post q1 -tpm2 -last2/5', command: 'nspe nba post q1 -tpm2 -last2/5' },
  { label: 'nspe nba -ast8 -last8/10', command: 'nspe nba -ast8 -last8/10' },
  { label: 'nspe nba -pts30 -streak5', command: 'nspe nba -pts30 -streak5' },
  { label: 'nspe nhl post -g1 -last3/5', command: 'nspe nhl post -g1 -last3/5' },
  { label: 'nspe nhl post p1 -pts1 -last3/5', command: 'nspe nhl post p1 -pts1 -last3/5' },
  { label: 'nspe nhl -pts min80 -season', command: 'nspe nhl -pts min80 -season' },
  { label: 'nspe mlb -hits2 -last3/5', command: 'nspe mlb -hits2 -last3/5' },
  { label: 'nspe mlb -hr -streak3', command: 'nspe mlb -hr -streak3' },
  { label: 'nspe mlb -tb2 -last3/5', command: 'nspe mlb -tb2 -last3/5' },
  { label: 'nspe mlb -tb min20 -last10', command: 'nspe mlb -tb min20 -last10' },
  { label: 'nspe mlb -tb2 -streak5', command: 'nspe mlb -tb2 -streak5' },
  { label: 'nspe mlb shohei ohtani vs SF', command: 'nspe mlb shohei ohtani vs SF' },
  // Shelved (SHOW_PITCHER_FPV) — no pitcher first-pitch data right now.
  // { label: 'nspe mlb pitch wheeler -vfp', command: 'nspe mlb pitch wheeler -vfp' },
  { label: 'nspe mlb pitch skenes -outs', command: 'nspe mlb pitch skenes -outs' },
  { label: 'nspe mlb pitch gavin -3down', command: 'nspe mlb pitch gavin -3down' },
  { label: 'nspe mlb bat LAD -outs -season', command: 'nspe mlb bat LAD -outs -season' },
  { label: 'nspe mlb LAD -ov -season', command: 'nspe mlb LAD -ov -season' },
  { label: 'nspe mlb -report', command: 'nspe mlb -report' },
  { label: 'nspe mlb -report -last5', command: 'nspe mlb -report -last5' },
  { label: 'nspe mlb DH -report -season', command: 'nspe mlb DH -report -season' },
  { label: 'nspe mlb juan soto -report -last20', command: 'nspe mlb juan soto -report -last20' },
  { label: 'nspe nfl long pass -yds30 -last2/5', command: 'nspe nfl long pass -yds30 -last2/5' },
  { label: 'nspe nfl long rush -yds20 -last3/5', command: 'nspe nfl long rush -yds20 -last3/5' },
  { label: 'nspe nfl long rec -yds40 -last3/5', command: 'nspe nfl long rec -yds40 -last3/5' },
  { label: 'nspe nfl rush -yds100 -last3/5', command: 'nspe nfl rush -yds100 -last3/5' },
  { label: 'nspe nfl pass -yds250 -last2/5', command: 'nspe nfl pass -yds250 -last2/5' },
  { label: 'nspe nfl -rush min800 -season', command: 'nspe nfl -rush min800 -season' },
  { label: 'nspe nfl -rec min1000 -season', command: 'nspe nfl -rec min1000 -season' },
]

interface Star {
  char: string
  x: number
  y: number
  color: string
  opacity: number
}

interface HitlistEntry {
  player?: string
  team?: string
  stat?: string
  values?: number[]
  threshold?: number
  window?: string
  hit_dates?: string[]
  games_meeting?: number
  window_games?: number
  // The specific game the leaderboard-style entry most recently hit this
  // in — e.g. "101yds 9/20/26" appended after the {100yds 1G season} tag.
  latest_value?: number
  latest_date?: string
  raw?: string
}

const STAT_LABELS: Record<string, string> = {
  tpm: '3pm',
  reb: 'reb',
  stl: 'stl',
  ast: 'ast',
  // NFL leaderboard entries carry the raw stat key (e.g. "pass_yds") — map
  // to the short display unit so the ticker reads "300yds" not
  // "300pass_yds". Covers the yds/td categories across all three play
  // types since the backend's NFL formatting isn't limited to passing.
  pass_yds: 'yds',
  rush_yds: 'yds',
  rec_yds: 'yds',
  pass_td: 'td',
  rush_td: 'td',
  rec_td: 'td',
}

interface GlossaryEntry {
  term: string
  meaning: string
}

const GLOSSARY_STATS: { sport: string; entries: GlossaryEntry[] }[] = [
  {
    sport: 'nba',
    entries: [
      { term: 'pts', meaning: 'Points' },
      { term: 'reb', meaning: 'Rebounds' },
      { term: 'ast', meaning: 'Assists' },
      { term: 'stl', meaning: 'Steals' },
      { term: 'blk', meaning: 'Blocks' },
      { term: 'tpm / 3pm', meaning: 'Three-Pointers Made' },
      { term: 'pts+ast', meaning: 'Points + Assists combined' },
      { term: 'pts+reb', meaning: 'Points + Rebounds combined' },
      { term: 'reb+ast', meaning: 'Rebounds + Assists combined' },
      { term: 'total', meaning: 'Points + Rebounds + Assists' },
      { term: 'q1 / q2 / q3 / q4', meaning: 'By quarter (e.g. q1 -pts10)' },
      { term: '1h', meaning: 'First half' },
    ],
  },
  {
    sport: 'nhl',
    entries: [
      { term: 'g', meaning: 'Goals' },
      { term: 'a', meaning: 'Assists' },
      { term: 'pts', meaning: 'Points (Goals + Assists)' },
      { term: 'sog', meaning: 'Shots On Goal' },
      { term: 'blk', meaning: 'Blocks' },
      { term: 'pim', meaning: 'Penalty Minutes' },
      { term: 'p1 / p2 / p3', meaning: 'By period' },
    ],
  },
  {
    sport: 'mlb',
    entries: [
      { term: 'hits', meaning: 'Hits' },
      { term: 'hr', meaning: 'Home Runs' },
      { term: 'rbi', meaning: 'Runs Batted In' },
      { term: 'dub', meaning: 'Doubles (2B)' },
      { term: 'trp', meaning: 'Triples (3B)' },
      { term: 'tb', meaning: 'Total Bases' },
      { term: 'sb', meaning: 'Stolen Bases' },
      { term: 'k', meaning: 'Strikeouts' },
      { term: 'bb', meaning: 'Walks (Base on Balls)' },
    ],
  },
]

const GLOSSARY_QUERY: GlossaryEntry[] = [
  { term: '-statN', meaning: 'Per-game threshold (e.g. -pts30 = 30+ points in a game)' },
  { term: '-stat minN', meaning: 'Season/window total (e.g. -pts min1500)' },
  { term: '-lastN', meaning: 'Look back across the player\'s last N games' },
  { term: '-lastM/N', meaning: 'M of the last N games meeting the threshold' },
  { term: '-streakN', meaning: 'Active streak of N+ consecutive games meeting the threshold' },
  { term: '-season', meaning: 'Use the full current season window' },
  { term: 'post', meaning: 'Postseason / playoff scope' },
]

const GLOSSARY_LEADERBOARD: GlossaryEntry[] = [
  { term: 'Rank', meaning: 'Position in the top list (sorted by Score)' },
  { term: 'Player / Team', meaning: 'Player name and team abbreviation' },
  { term: 'Label(N)', meaning: 'Active streak type with (N) = number of games the streak is currently on' },
  { term: '★', meaning: 'Top 3 indicator' },
  { term: 'Score', meaning: 'Composite ranking value combining streak length, type weight, and recent form' },
]

const GLOSSARY_STREAK_LABELS: GlossaryEntry[] = [
  { term: 'HR', meaning: 'Home Run streak — HR in each game' },
  { term: '2TB', meaning: '2+ Total Bases in each game' },
  { term: 'Hit', meaning: 'Hit streak — at least one hit each game' },
  { term: '2H', meaning: '2+ Hits in each game' },
  { term: 'OB', meaning: 'On-Base streak — reached base each game' },
  { term: '2R', meaning: '2+ Runs scored in each game' },
  { term: '2RBI', meaning: '2+ RBI in each game' },
]

function formatTickerEntry(entry: HitlistEntry): string {
  if (entry.raw) {
    return entry.raw
  }

  const statLabel = entry.stat ? (STAT_LABELS[entry.stat] || entry.stat) : ''
  const playerLabel = entry.player ? normalizeDisplayPlayer(entry.player) : ''

  // Leaderboard style (MLB and now NFL both use this): team + player +
  // {Nstat MG <window>} — e.g. "DAL Dak Prescott {300yds 6G season}". This
  // branch is sport-agnostic; it only fires once an entry actually carries
  // games_meeting. NFL leaderboard entries added so far (team/player/stat/
  // threshold only, no games_meeting) fall through to the legacy branch
  // below and render without a games count until the backend adds that
  // field — this function doesn't need to change again once it does.
  if (entry.team && typeof entry.games_meeting === 'number') {
    const windowSuffix =
      typeof entry.window_games === 'number' ? `L${entry.window_games}` : 'season'
    const tag = `{${entry.threshold ?? ''}${statLabel} ${entry.games_meeting}G ${windowSuffix}}`
    // The actual game it happened in, e.g. "101yds 9/20/26" — same
    // value-then-unit convention as the tag itself, date normalized to
    // M/D/YY the same way every other date in this app is.
    const latestPart =
      typeof entry.latest_value === 'number' && entry.latest_date
        ? ` ${entry.latest_value}${statLabel} ${extractDateToken(entry.latest_date) ?? entry.latest_date}`
        : ''
    return `${entry.team} ${playerLabel} ${tag}${latestPart}`.trim()
  }

  // Legacy per-player rolling entries. Also the current fallback path for
  // NFL leaderboard entries (see above) — includes team when present so
  // those don't lose it entirely just because games_meeting isn't there yet.
  const windowPart = entry.window ? ` last${entry.window}` : ''
  // Value-then-unit ("300yds", not "yds300") to match the leaderboard-style
  // branch above and every other stat display in this app.
  const header = `{${entry.threshold ?? ''}${statLabel}${windowPart}}`
  const dates = entry.hit_dates ?? []
  const values = entry.values ?? []
  const pairs = dates.map((date, i) => {
    const value = values[i]
    return `"${date}" {${value ?? ''}}`
  })

  const teamPrefix = entry.team ? `${entry.team} ` : ''
  return `${teamPrefix}${playerLabel} ${header} ${pairs.join(', ')}`.trim()
}

interface LeaderboardRow {
  player: string
  team: string
  streak_type: string
  streak_label: string
  streak_length: number
  streak_active: boolean
  avg: number
  hits: number
  at_bats: number
  score: number
}

interface LeaderboardPayload {
  kind: string
  generated_at: string
  thresholds?: Record<string, number>
  rows: LeaderboardRow[]
}

function formatLeaderboardDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function leaderboardSportLabel(kind: string): string {
  const m = /^([a-z]+)_leaderboard$/i.exec(kind)
  return m ? m[1].toLowerCase() : kind
}

function normalizeLeaderboardPlayer(name: string): string {
  if (!name) return ''
  if (name.includes(' ')) return name
  return name.replace(/([a-z])([A-Z])/g, '$1 $2')
}

/** Extract a stat value from a full-game-stats match object for demo display. */
function demoMatchValue(m: Record<string, unknown>, cmd: string): number | null {
  if (m.val != null) return asNumber(m.val)
  if (/\bpass\b/.test(cmd) && m.pass_yds != null) return asNumber(m.pass_yds)
  if (/\brush\b/.test(cmd) && m.rush_yds != null) return asNumber(m.rush_yds)
  if (/\brec\b/.test(cmd) && m.rec_yds != null) return asNumber(m.rec_yds)
  if (m.points != null) return asNumber(m.points)
  if (m.sog != null) return asNumber(m.sog)
  const s = m.stats as Record<string, unknown> | undefined
  if (s && typeof s === 'object') {
    for (const k of ['points', 'sog', 'goals', 'assists']) {
      if (s[k] != null) return asNumber(s[k])
    }
  }
  return null
}

/** Extract a short display date from a full-game-stats match object. */
function demoMatchDate(m: Record<string, unknown>): string {
  const raw = typeof m.date_iso === 'string' ? m.date_iso
            : typeof m.date === 'string' ? m.date : ''
  return extractDateToken(raw) ?? ''
}

// ---------------- NFL explosive view ----------------

/** Extract the yards threshold from a query string like "nfl long rush ydsmin30 last5 reqmet2" */
function parseExplosiveThreshold(query: string | string[]): number | null {
  const q = Array.isArray(query) ? query.join(' ') : query
  const m = q.match(/yds(?:min)?(\d+)/i)
  return m ? parseInt(m[1], 10) : null
}

// "met=N" alone drops the window it was measured against — "met=2" reads
// very differently depending on whether the window was -last2/3 or
// -last2/10. Appending "/window" whenever the window size is known keeps
// that scope visible even when there's no per-match value/date to show
// instead (the fallback path below, for engines whose per-match values
// don't parse yet).
function formatMet(met: number, window?: number | null): string {
  return window != null ? `met=${met}/${window}` : `met=${met}`
}

// Shared collapsed-row badge for every trend-shaped view (generic results
// panel, NFL explosive, MLB HR/first-PA/team-runs) — a small lowercase
// "met=N · latest" header (same monospace/cyan family as the TEAM acronym
// beside it, but dim and tiny so it doesn't compete with the value line)
// stacked over the actual {value/stat/date} for the most recent qualifying
// game. Uniform across sports/engines per the explicit ask that trend rows
// read the same way everywhere. `ml-auto` (not `justify-between` on the row)
// is what lets this badge drop to its own line on narrow/mobile widths while
// staying right-aligned — flex auto-margins resolve per wrapped line, so it
// works whether it shares a line with the name or not.
function TrendBadge({
  header,
  value,
  expanded,
  onToggle,
  accent = 'oklch(0.85 0.15 145)',
  ariaLabel,
}: {
  header?: string | null
  value: string
  expanded?: boolean
  onToggle?: () => void
  accent?: string
  ariaLabel?: string
}) {
  const inner = (
    <span className="flex flex-col items-end gap-0.5 leading-none">
      {header && (
        <span className="text-[9px] lowercase tracking-wide" style={{ color: 'oklch(0.55 0.07 195)' }}>
          {header}
        </span>
      )}
      <span className="font-bold text-[13px]" style={{ color: accent }}>
        {value}
      </span>
    </span>
  )
  const className = `font-mono ml-auto shrink-0 px-2 py-1 rounded${onToggle ? ' border' : ''}`
  const style = {
    backgroundColor: expanded ? 'oklch(0.27 0.03 145)' : 'oklch(0.22 0 0)',
    borderColor: onToggle ? 'oklch(0.35 0 0)' : undefined,
    cursor: onToggle ? 'pointer' : undefined,
  }
  if (!onToggle) {
    return (
      <span className={className} style={style}>
        {inner}
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      className={className}
      style={style}
      aria-expanded={expanded}
      aria-label={ariaLabel}
    >
      {inner}
    </button>
  )
}

// Per-payload collapse/expand state for a list of result rows, keyed by
// index. Was previously copy-pasted (identical useState<Set<number>> +
// toggle function) into every trend/compute view separately — pulled out
// once so there's a single implementation to get right.
function useExpandableRows() {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  return { isExpanded: (i: number) => expanded.has(i), toggle }
}

// One shared row shell for every "one entity + a headline stat badge + an
// optional expandable per-game breakdown" result — the shape every trend
// AND compute engine in this app actually has. Centralizing it is what makes
// TrendBadge usage, the collapsed-by-default toggle, and the border/spacing
// automatic for any view, instead of depending on whoever writes the next
// one remembering to copy the pattern by hand — the exact way the compute
// branches (mlb_hr_compute, mlb_team_runs_compute, NFL explosive's leaderboard
// shape) drifted into their own bespoke, non-collapsible layouts instead of
// matching their trend siblings one function down.
function ResultRow({
  label,
  badgeHeader,
  badgeValue,
  accent,
  expanded,
  onToggle,
  ariaLabel,
  children,
}: {
  label: ReactNode
  badgeHeader?: string | null
  badgeValue: string
  accent?: string
  expanded?: boolean
  onToggle?: () => void
  ariaLabel?: string
  children?: ReactNode
}) {
  return (
    <div className="py-2 border-b" style={{ borderColor: PITCH_BORDER }}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="font-mono text-[13px] min-w-0" style={{ color: PITCH_ACCENT }}>
          {label}
        </span>
        <TrendBadge
          header={badgeHeader}
          value={badgeValue}
          expanded={expanded}
          onToggle={onToggle}
          accent={accent}
          ariaLabel={ariaLabel}
        />
      </div>
      {expanded && children && <div className="mt-2 space-y-1.5 pl-2">{children}</div>}
    </div>
  )
}

function NflExplosiveView({ payload }: { payload: NflExplosivePayload }) {
  const { isExpanded, toggle } = useExpandableRows()
  const results = payload.results

  // Compute (leaderboard) shape — results have value/games/yards, no matches array
  const isCompute = results.length > 0 && results[0].value != null && !results[0].matches
  if (isCompute) {
    return (
      <div className="space-y-0">
        {results.map((r, i) => (
          <ResultRow
            key={i}
            label={normalizeDisplayPlayer(r.player)}
            badgeHeader={`${r.games}gp`}
            badgeValue={`${(r.yards ?? r.value)?.toLocaleString()}yds`}
          />
        ))}
      </div>
    )
  }

  // Trend (per-game drill-down) shape
  const threshold = parseExplosiveThreshold(payload.query)
  // Pull window from the first result that has one
  const globalWindow = results.find((r) => r.window != null)?.window ?? null

  return (
    <div className="space-y-0">
      {/* context header */}
      {(threshold != null || globalWindow != null) && (
        <div
          className="flex items-center gap-2 pb-1.5 mb-1 font-mono text-[11px]"
          style={{ color: 'oklch(0.50 0 0)', borderBottom: `1px solid ${PITCH_BORDER}` }}
        >
          {threshold != null && (
            <span>yds<span style={{ color: 'oklch(0.72 0 0)' }}>&ge;{threshold}</span></span>
          )}
          {threshold != null && globalWindow != null && (
            <span style={{ color: 'oklch(0.30 0 0)' }}>·</span>
          )}
          {globalWindow != null && (
            <span>last <span style={{ color: 'oklch(0.72 0 0)' }}>{globalWindow}</span> games</span>
          )}
        </div>
      )}
      {results.map((r, i) => {
        const matchList = r.matches ?? []
        const metCount = r.met_count ?? r.met ?? matchList.length
        const metLabel = formatMet(metCount, r.window)
        const latest = matchList.length > 0 ? matchList[matchList.length - 1] : null
        const latestYds = latest ? (Array.isArray(latest.yards_list) ? latest.yards_list.join(', ') : latest.yards) : null
        const latestValue = latest
          ? `${latestYds}yds ${extractDateToken(latest.date_iso ?? latest.date) ?? (latest.date_iso ?? latest.date)}`
          : null
        return (
          <ResultRow
            key={i}
            label={
              <>
                {r.team && r.team !== 'UNK' && (
                  <>
                    <span style={{ color: 'oklch(0.70 0.10 195)' }}>{r.team}</span>
                    <span style={{ color: 'oklch(0.55 0 0)' }}>{' — '}</span>
                  </>
                )}
                {normalizeDisplayPlayer(r.player)}
              </>
            }
            badgeHeader={latestValue ? `${metLabel} · latest` : null}
            badgeValue={latestValue ?? metLabel}
            expanded={isExpanded(i)}
            onToggle={() => toggle(i)}
          >
            {matchList.map((m, j) => {
              const ydsDisplay = Array.isArray(m.yards_list)
                ? m.yards_list.join(', ')
                : String(m.yards)
              return (
                <div key={j} className="font-mono text-[12px]" style={{ color: 'oklch(0.76 0 0)' }}>
                  <span style={{ color: 'oklch(0.60 0 0)' }}>{extractDateToken(m.date_iso ?? m.date) ?? (m.date_iso ?? m.date)}</span>
                  {m.opponent && (
                    <>
                      <span style={{ color: 'oklch(0.45 0 0)' }}>{' vs '}</span>
                      <span style={{ color: 'oklch(0.75 0.08 220)' }}>{m.opponent}</span>
                    </>
                  )}
                  <span style={{ color: 'oklch(0.45 0 0)' }}>{' · '}</span>
                  <span style={{ color: 'oklch(0.85 0.15 145)' }}>{ydsDisplay}yds</span>
                  {m.quarter != null && (
                    <span style={{ color: 'oklch(0.55 0 0)' }}> Q{m.quarter}</span>
                  )}
                  {m.touchdown && (
                    <span style={{ color: 'oklch(0.80 0.18 60)' }}> TD</span>
                  )}
                  {m.receiver && (
                    <>
                      <span style={{ color: 'oklch(0.45 0 0)' }}>{' → '}</span>
                      <span style={{ color: 'oklch(0.72 0 0)' }}>{normalizeDisplayPlayer(m.receiver)}</span>
                    </>
                  )}
                  {m.passer && (
                    <>
                      <span style={{ color: 'oklch(0.45 0 0)' }}>{' from '}</span>
                      <span style={{ color: 'oklch(0.72 0 0)' }}>{normalizeDisplayPlayer(m.passer)}</span>
                    </>
                  )}
                  {m.count != null && m.count > 1 && (
                    <span style={{ color: 'oklch(0.50 0 0)' }}> ({m.count} plays)</span>
                  )}
                </div>
              )
            })}
          </ResultRow>
        )
      })}
    </div>
  )
}

// ---- NFL primetime slots ------------------------------------------------
const SLOT_WHITE = 'oklch(0.95 0 0)'

function slotName(slot: string): string {
  const t = slot.toLowerCase()
  return t === 'primetime' ? 'PRIME' : slot.toUpperCase()
}

function fmtInt(n: number): string {
  return n.toLocaleString()
}

// One boxed card per broadcast slot; PRIME and ALL are the rollups, so they
// read a little stronger than the individual slots.
function NflPlayerSlotsView({ payload }: { payload: NflPlayerSlotsPayload }) {
  const q = payload.query
  const s = payload.summary
  const rollup = (slot: string) => slot === 'PRIME' || slot === 'ALL'
  return (
    <div className="space-y-3">
      <div className="font-mono text-[13px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
        <span>{normalizeDisplayPlayer(q.player)}</span>
        <span style={{ color: SLOT_WHITE, fontWeight: 700 }}>{` · ${q.category} by slot · ${q.window_label}`}</span>
      </div>

      {s && (
        <div
          className="rounded p-3 font-mono text-[12px]"
          style={{ backgroundColor: 'oklch(0.18 0 0)', border: '1px solid oklch(0.28 0 0)' }}
        >
          <div style={{ color: 'oklch(0.88 0 0)' }}>
            <span className="font-bold">primetime</span> {s.prime_avg.toFixed(1)} avg vs{' '}
            <span className="font-bold">other slots</span> {s.other_avg.toFixed(1)} avg
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            <span
              className="font-bold whitespace-nowrap"
              style={{ color: s.pct_diff >= 0 ? PARLAY_GREEN : 'oklch(0.75 0.15 25)' }}
            >
              {`${s.pct_diff >= 0 ? '+' : ''}${s.pct_diff.toFixed(1)}% in primetime`}
            </span>
            <span className="whitespace-nowrap" style={{ color: PARLAY_DIM }}>
              {`${s.prime_games} prime · ${s.other_games} other games`}
            </span>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {payload.rows.map((r) => {
          const name = slotName(r.slot)
          const strong = rollup(name)
          return (
            <div
              key={r.slot}
              className="rounded p-3 font-mono text-[12px]"
              style={{
                backgroundColor: 'oklch(0.18 0 0)',
                border: `1px solid ${strong ? 'oklch(0.45 0.08 195)' : 'oklch(0.28 0 0)'}`,
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold text-[13px]" style={{ color: strong ? 'oklch(0.90 0.18 195)' : PARLAY_CYAN }}>
                  {name}
                </span>
                <span style={{ color: PARLAY_DIM }}>{`${r.games} game${r.games === 1 ? '' : 's'}`}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: PARLAY_GREEN }}>
                <span className="whitespace-nowrap font-bold">{`${r.avg.toFixed(1)} avg`}</span>
                <span className="whitespace-nowrap">{`${fmtInt(r.yards)} yds`}</span>
                <span className="whitespace-nowrap">{`${r.td} td (${r.td_per_game.toFixed(2)}/g)`}</span>
                {r.extra ? <span className="whitespace-nowrap">{r.extra}</span> : null}
              </div>
            </div>
          )
        })}
      </div>

      {payload.unclassified_games ? (
        <div className="font-mono text-[11px]" style={{ color: PARLAY_DIM }}>
          {`${payload.unclassified_games} game${payload.unclassified_games === 1 ? '' : 's'} couldn't be classified into a slot`}
        </div>
      ) : null}
    </div>
  )
}

// Team record in the requested slot(s): one card per team, plus each game
// when a single team was named.
function NflTeamSlotsView({ payload }: { payload: NflTeamSlotsPayload }) {
  const q = payload.query
  const slots = Array.from(new Set(q.slots.map(slotName))).join(' + ')
  const games = payload.games ?? []
  return (
    <div className="space-y-3">
      <div className="font-mono text-[13px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
        <span>{q.teams && q.teams.length > 0 ? q.teams.join(', ') : 'nfl teams'}</span>
        <span style={{ color: SLOT_WHITE, fontWeight: 700 }}>{` · ${slots} · ${q.window_label}`}</span>
      </div>

      <div className="space-y-2">
        {payload.rows.map((r) => (
          <div
            key={r.team}
            className="rounded p-3 font-mono text-[12px]"
            style={{ backgroundColor: 'oklch(0.18 0 0)', border: '1px solid oklch(0.28 0 0)' }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-[13px]" style={{ color: 'oklch(0.90 0.18 195)' }}>{r.team}</span>
              <span className="font-bold text-[14px]" style={{ color: PARLAY_GREEN }}>
                {`${r.wins}-${r.losses}${r.ties ? `-${r.ties}` : ''}`}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: 'oklch(0.76 0 0)' }}>
              <span className="whitespace-nowrap">{`${(r.win_pct * 100).toFixed(1)}% win`}</span>
              <span className="whitespace-nowrap">{`${r.games} game${r.games === 1 ? '' : 's'}`}</span>
              <span className="whitespace-nowrap">{`${r.pf.toFixed(1)} pf`}</span>
              <span className="whitespace-nowrap">{`${r.pa.toFixed(1)} pa`}</span>
              <span className="whitespace-nowrap font-bold" style={{ color: r.diff >= 0 ? PARLAY_GREEN : 'oklch(0.75 0.15 25)' }}>
                {`${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(1)} diff`}
              </span>
            </div>
          </div>
        ))}
      </div>

      {games.length > 0 && (
        <>
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'oklch(0.48 0 0)' }}>
            games
          </div>
          <div className="space-y-2">
            {games.map((g, i) => {
              const won = g.result.trim().toUpperCase().startsWith('W')
              const lost = g.result.trim().toUpperCase().startsWith('L')
              return (
                <div
                  key={`${g.date}-${i}`}
                  className="rounded p-3 font-mono text-[12px]"
                  style={{ backgroundColor: 'oklch(0.18 0 0)', border: '1px solid oklch(0.28 0 0)' }}
                >
                  <div>
                    <span style={{ color: PARLAY_DIM }}>{extractDateToken(g.date) ?? g.date}</span>
                    <span style={{ color: 'oklch(0.40 0 0)' }}>{'  '}</span>
                    <span style={{ color: PARLAY_CYAN }}>{`${g.venue === 'away' ? '@' : 'vs'} ${g.opponent}`}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3">
                    <span className="whitespace-nowrap font-bold" style={{ color: won ? PARLAY_GREEN : lost ? 'oklch(0.75 0.15 25)' : 'oklch(0.76 0 0)' }}>
                      {g.result}
                    </span>
                    <span className="whitespace-nowrap" style={{ color: PARLAY_DIM }}>{slotName(g.slot)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// "Running query..." for ordinary commands; -parlay/-legs build a whole slate
// server-side and take 45-70s, so they get a message that says so, with an
// elapsed-seconds counter so it visibly isn't hung.
function LoadingMessage({ query }: { query: string }) {
  const isParlay = /(^|\s)-parlay\b/.test(query)
  const isLegs = /(^|\s)-legs\b/.test(query)
  const slow = isParlay || isLegs
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!slow) return
    const id = window.setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [slow])
  if (!slow) return <>Running query...</>
  return (
    <div className="space-y-1">
      <div style={{ color: 'oklch(0.85 0.15 195)' }}>{isParlay ? 'building parlay…' : 'building legs…'}</div>
      <div className="text-[11px]" style={{ color: 'oklch(0.55 0 0)' }}>
        {`this can take up to a minute · ${elapsed}s`}
      </div>
    </div>
  )
}

// ---- NFL parlay builder / player legs ----------------------------------
// One boxed card per leg, same treatment as the h2h game log: player + matchup
// + confidence on top, the leg's label under it, then its hit-rate evidence
// left to right.
const PARLAY_DIM = 'oklch(0.55 0 0)'
const PARLAY_CYAN = 'oklch(0.70 0.10 195)'
const PARLAY_GREEN = 'oklch(0.85 0.15 145)'

function pct(rate: number | undefined): string {
  return typeof rate === 'number' ? `${Math.round(rate * 100)}%` : '—'
}

function ParlayLegCard({ leg, showPlayer = true }: { leg: NflParlayLeg; showPlayer?: boolean }) {
  const stats: { text: string; color?: string }[] = [
    { text: `career ${leg.overall} (${pct(leg.overall_rate)})` },
    { text: `recent ${leg.recent} (${pct(leg.recent_rate)})` },
    { text: `vs ${leg.opponent} ${leg.vs_opp} (${pct(leg.vs_opp_rate)})` },
  ]
  return (
    <div
      className="rounded p-3 font-mono text-[12px]"
      style={{ backgroundColor: 'oklch(0.18 0 0)', border: '1px solid oklch(0.28 0 0)' }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span>
          {showPlayer && (
            <span className="font-bold text-[13px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
              {normalizeDisplayPlayer(leg.player)}
            </span>
          )}
          <span style={{ color: PARLAY_CYAN }}>{`${showPlayer ? '  ' : ''}${leg.team} vs ${leg.opponent}`}</span>
        </span>
        <span className="font-bold text-[14px]" style={{ color: PARLAY_GREEN }}>{pct(leg.confidence)}</span>
      </div>
      <div className="mt-1" style={{ color: 'oklch(0.88 0 0)' }}>
        {leg.label}
        {leg.shadow ? <span style={{ color: PARLAY_DIM }}>{'  (shadow)'}</span> : null}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: 'oklch(0.76 0 0)' }}>
        {stats.map((st, i) => (
          <span key={i} className="whitespace-nowrap" style={st.color ? { color: st.color } : undefined}>
            {st.text}
          </span>
        ))}
      </div>
      {leg.pair_reason ? (
        <div className="mt-1" style={{ color: PARLAY_DIM }}>{`pairing: ${leg.pair_reason}`}</div>
      ) : null}
    </div>
  )
}

function NflParlayView({ payload }: { payload: NflParlayPayload }) {
  const q = payload.query ?? {}
  const picks = payload.parlay?.picks ?? []
  const shape = (q.shape ?? '3/2/1').replace(/[{}]/g, '')
  const excluded = (payload.parlay?.excluded_teams ?? []).filter((t): t is string => typeof t === 'string')
  return (
    <div className="space-y-3">
      <div className="font-mono text-[13px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
        <span>nfl parlay</span>
        <span style={{ color: 'oklch(0.95 0 0)', fontWeight: 700 }}>
          {` · week ${q.week ?? '—'} · shape ${shape} · ${q.risk ?? 'standard'} · ${payload.parlay?.legs ?? picks.length} legs`}
        </span>
      </div>
      {picks.length === 0 ? (
        <div className="text-center py-4 font-mono text-[12px]" style={{ color: 'oklch(0.70 0 0)' }}>
          No legs qualified for this shape
        </div>
      ) : (
        <div className="space-y-2">
          {picks.map((leg, i) => (
            <ParlayLegCard key={`${leg.player}-${leg.category}-${i}`} leg={leg} />
          ))}
        </div>
      )}
      {excluded.length > 0 && (
        <div className="font-mono text-[11px]" style={{ color: PARLAY_DIM }}>
          {`excluded teams: ${excluded.join(', ')}`}
        </div>
      )}
    </div>
  )
}

function NflPlayerLegsView({ payload }: { payload: NflPlayerLegsPayload }) {
  const q = payload.query ?? {}
  const legs = payload.legs ?? []
  const first = legs[0]
  return (
    <div className="space-y-3">
      <div className="font-mono text-[13px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
        {first?.team ? (
          <>
            <span style={{ color: PARLAY_CYAN }}>{first.team}</span>
            <span style={{ color: PARLAY_DIM }}>{' — '}</span>
          </>
        ) : null}
        <span>{normalizeDisplayPlayer(payload.player || q.player || 'player')}</span>
        <span style={{ color: 'oklch(0.95 0 0)', fontWeight: 700 }}>
          {` · week ${q.week ?? '—'}${first ? ` · vs ${first.opponent}` : ''} · ${legs.length} leg${legs.length === 1 ? '' : 's'}`}
        </span>
      </div>
      {legs.length === 0 ? (
        <div className="text-center py-4 font-mono text-[12px]" style={{ color: 'oklch(0.70 0 0)' }}>
          No legs for this player this week
        </div>
      ) : (
        <div className="space-y-2">
          {legs.map((leg, i) => (
            <ParlayLegCard key={`${leg.category}-${i}`} leg={leg} showPlayer={false} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Explosive-play overview (single player, bar chart) ----------
// Sport-agnostic — see ExplosiveOverviewPayload's comment in nspe-payloads.ts
// for why (matched by engine suffix, tolerant field-name resolution, an
// explicit/inferred `unit` so this same view can print "64yds" for NFL or
// "450ft" for a future MLB variant without knowing the sport). The app's
// first result rendered as an actual chart rather than stat cards or a
// table — horizontal bars (not vertical) since they read cleanly at the
// mini panel's fixed ~620px width without needing extra height. Terminal
// palette per request: cyan/white text, green bars.

function ExplosiveOverviewView({ payload }: { payload: ExplosiveOverviewPayload }) {
  const CYAN = 'oklch(0.85 0.15 195)'
  const CYAN_BRIGHT = 'oklch(0.90 0.18 195)'
  const GREEN = 'oklch(0.75 0.16 145)'
  const DIM = 'oklch(0.55 0 0)'
  const BORDER = 'oklch(0.22 0 0)'

  const player = normalizeDisplayPlayer(payload.query.player)
  const category = payload.query.category
  const unit = payload.unit
  const [yearStart, yearEnd] = payload.query.year_window ?? []
  const yearLabel = yearStart != null ? (yearStart === yearEnd ? `${yearStart}` : `${yearStart}-${yearEnd}`) : ''

  const buckets = payload.buckets
  const maxCount = Math.max(1, ...buckets.map((b) => b.count))

  return (
    <div className="space-y-4 font-mono">
      <div className="flex items-baseline gap-2 pb-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <span className="text-[14px] font-bold" style={{ color: CYAN_BRIGHT }}>
          {player}
        </span>
        <span className="text-[12px]" style={{ color: DIM }}>
          explosive {category} plays{yearLabel ? ` · ${yearLabel}` : ''}
        </span>
      </div>

      <div className="flex flex-wrap gap-5 text-[12px]">
        <div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>
            Plays
          </div>
          <div className="text-[16px] font-bold" style={{ color: CYAN }}>
            {payload.totalPlays}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>
            Total {unit}
          </div>
          <div className="text-[16px] font-bold" style={{ color: CYAN }}>
            {payload.totalValue.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>
            Avg {unit}
          </div>
          <div className="text-[16px] font-bold" style={{ color: CYAN }}>
            {payload.avgValue.toFixed(1)}
          </div>
        </div>
        {payload.longest && (
          <div>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>
              Longest
            </div>
            <div className="text-[16px] font-bold" style={{ color: GREEN }}>
              {payload.longest.value}
              {unit}
              <span className="text-[11px] font-normal ml-1.5" style={{ color: DIM }}>
                {[
                  payload.longest.opponent,
                  payload.longest.quarter ? `Q${payload.longest.quarter}` : null,
                  extractDateToken(payload.longest.date_iso),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="text-[9px] uppercase tracking-wider mb-2" style={{ color: DIM }}>
          by distance
        </div>
        <div className="space-y-1.5">
          {buckets.map((b) => {
            const widthPct = Math.max(4, (b.count / maxCount) * 100)
            return (
              <div key={b.range} className="flex items-center gap-2">
                <span className="text-[11px] w-[46px] flex-none text-right" style={{ color: DIM }}>
                  {b.range}
                </span>
                <div className="flex-1 h-[16px] rounded relative overflow-hidden" style={{ backgroundColor: 'oklch(0.20 0 0)' }}>
                  <div className="h-full rounded" style={{ width: `${widthPct}%`, backgroundColor: GREEN }} />
                </div>
                <span className="text-[11px] w-[22px] flex-none font-bold text-right" style={{ color: CYAN_BRIGHT }}>
                  {b.count}
                </span>
                <span className="text-[10px] w-[100px] flex-none" style={{ color: DIM }}>
                  {b.value}
                  {unit} · {b.avg.toFixed(1)}avg
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function scopeLabel(scope: string | null): string {
  if (scope === null) return 'every quarter/half'
  if (scope === 'q1') return 'Q1'
  if (scope === '1h') return '1H'
  return scope.toUpperCase()
}

function NflOverviewScopesView({ payload }: { payload: NflOverviewScopesPayload }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const CYAN = 'oklch(0.85 0.15 195)'
  const CYAN_BRIGHT = 'oklch(0.90 0.18 195)'
  const DIM = 'oklch(0.55 0 0)'
  const BORDER = 'oklch(0.22 0 0)'

  const player = normalizeDisplayPlayer(payload.query.player)
  const category = payload.query.category
  const yearWindow = payload.query.year_window
  const yearLabel = yearWindow == null ? 'career' : yearWindow[0] === yearWindow[1] ? `${yearWindow[0]}` : `${yearWindow[0]}-${yearWindow[1]}`

  return (
    <div className="space-y-4 font-mono">
      <div className="flex items-baseline gap-2 pb-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <span className="text-[14px] font-bold" style={{ color: CYAN_BRIGHT }}>
          {player}
        </span>
        <span className="text-[12px]" style={{ color: DIM }}>
          {category} · {scopeLabel(payload.query.scope)} · {yearLabel}
        </span>
      </div>

      {payload.rows.map((r, i) => {
        const isOpen = expanded.has(i)
        const hasCompletions = r.completions != null && r.attempts != null
        // Only shown when there's more than one row (the bare "-ov" case,
        // no period specified — one row per scope) — a single-row result
        // already has its one scope named in the header above, repeating it
        // per-row there would be redundant.
        return (
          <div key={i} className="space-y-3">
            {payload.rows.length > 1 && (
              <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: CYAN_BRIGHT }}>
                {scopeLabel(r.scope)}
                {r.share_pct != null && (
                  <span className="font-normal normal-case ml-2" style={{ color: DIM }}>
                    {r.share_pct.toFixed(1)}% of full game
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-5 text-[12px]">
              <div>
                <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>Games</div>
                <div className="text-[16px] font-bold" style={{ color: CYAN }}>{r.games}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>Total Yards</div>
                <div className="text-[16px] font-bold" style={{ color: CYAN }}>{r.total_yards.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>Avg</div>
                <div className="text-[16px] font-bold" style={{ color: CYAN }}>{r.avg.toFixed(1)}</div>
              </div>
              {r.total_td != null && (
                <div>
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>TD</div>
                  <div className="text-[16px] font-bold" style={{ color: CYAN }}>{r.total_td}</div>
                </div>
              )}
              {hasCompletions && (
                <div>
                  <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>Comp/Att</div>
                  <div className="text-[16px] font-bold" style={{ color: CYAN }}>
                    {r.completions}/{r.attempts}
                    {r.completion_pct != null && (
                      <span className="text-[11px] font-normal ml-1" style={{ color: DIM }}>{r.completion_pct.toFixed(1)}%</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {r.breakdown.length > 0 && (
              <div className="flex items-start gap-x-3">
                <TrendBadge
                  header={`${r.breakdown.length} games`}
                  value={isOpen ? 'hide' : 'view'}
                  expanded={isOpen}
                  onToggle={() => toggle(i)}
                  ariaLabel="Toggle game-by-game breakdown"
                />
              </div>
            )}
            {isOpen && (
              <div className="space-y-1 pl-1">
                {r.breakdown.map((b, j) => (
                  <div key={j} className="font-mono text-[12px]" style={{ color: 'oklch(0.76 0 0)' }}>
                    {b.date && <span style={{ color: 'oklch(0.60 0 0)' }}>{extractDateToken(b.date) ?? b.date}</span>}
                    {b.opponent && (
                      <>
                        <span style={{ color: 'oklch(0.45 0 0)' }}>{b.date ? ' vs ' : 'vs '}</span>
                        <span style={{ color: 'oklch(0.75 0.08 220)' }}>{b.opponent}</span>
                      </>
                    )}
                    {(b.date || b.opponent) && <span style={{ color: 'oklch(0.45 0 0)' }}>{' · '}</span>}
                    <span style={{ color: CYAN }}>{b.amount} yds</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------- NFL overview stat-threshold view (-statN -ov) ----------
// Third -ov sibling — see NflOverviewStatNPayload's comment in
// nspe-payloads.ts for why this isn't a trend view despite having a
// `matches` array. Mirrors NflOverviewScopesView's structure (header ·
// tiles · TrendBadge-toggled breakdown) for visual consistency across the
// -ov family, even though the data shape is single-row rather than
// multi-row.

// Broadcast-slot tokens on a command ("-mnf", "-snf", "-tnf", "-prime",
// "-1pm", "-4pm") -> a display label. Slot-filtered -statN -ov responses
// don't echo the slot back, so the view reads it off the command instead.
function slotLabelFromQuery(query: string): string {
  const found = query.toLowerCase().match(/(?:^|\s)-(mnf|snf|tnf|prime|1pm|4pm)\b/g) ?? []
  return found.map((t) => t.trim().slice(1).toUpperCase()).join('+')
}

function NflOverviewStatNView({ payload, query = '' }: { payload: NflOverviewStatNPayload; query?: string }) {
  const { isExpanded, toggle } = useExpandableRows()

  const CYAN = 'oklch(0.85 0.15 195)'
  const CYAN_BRIGHT = 'oklch(0.90 0.18 195)'
  const DIM = 'oklch(0.55 0 0)'
  const BORDER = 'oklch(0.22 0 0)'

  const player = normalizeDisplayPlayer(payload.query.player)
  const { category, threshold, stat_kind, window_label } = payload.query
  const windowGames = payload.window ?? payload.games_in_window ?? payload.count

  return (
    <div className="space-y-4 font-mono">
      <div className="flex items-baseline gap-2 pb-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <span className="text-[14px] font-bold" style={{ color: CYAN_BRIGHT }}>
          {player}
        </span>
        <span className="text-[12px]" style={{ color: DIM }}>
          {category} · {payload.scope != null ? scopeLabel(payload.scope) : slotLabelFromQuery(query) || 'full game'} · &ge;{threshold}{stat_kind} · {window_label}
        </span>
      </div>

      <div className="flex flex-wrap gap-5 text-[12px]">
        <div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>Games</div>
          <div className="text-[16px] font-bold" style={{ color: CYAN }}>{payload.count}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>Window</div>
          <div className="text-[16px] font-bold" style={{ color: CYAN }}>{windowGames}</div>
        </div>
      </div>

      {payload.matches.length > 0 && (
        <ResultRow
          label={`${payload.count} of ${windowGames} games`}
          badgeValue={isExpanded(0) ? 'hide' : 'view'}
          expanded={isExpanded(0)}
          onToggle={() => toggle(0)}
        >
          {payload.matches.map((m, j) => (
            <div key={j} className="font-mono text-[12px]" style={{ color: 'oklch(0.76 0 0)' }}>
              <span style={{ color: 'oklch(0.60 0 0)' }}>{extractDateToken(m.date_iso ?? m.date) ?? m.date_iso ?? m.date}</span>
              {m.opponent && (
                <>
                  <span style={{ color: 'oklch(0.45 0 0)' }}>{' vs '}</span>
                  <span style={{ color: 'oklch(0.75 0.08 220)' }}>{m.opponent}</span>
                </>
              )}
              <span style={{ color: 'oklch(0.45 0 0)' }}>{' · '}</span>
              <span style={{ color: CYAN }}>{m.value ?? m.val}{stat_kind}</span>
            </div>
          ))}
        </ResultRow>
      )}
    </div>
  )
}

// ---------- MLB Home Run Distance view ----------

function MlbHrView({ payload }: { payload: MlbHrPayload }) {
  const { isExpanded, toggle } = useExpandableRows()

  // A zero-row response used to render as a blank panel. Say so instead.
  if (payload.results.length === 0) {
    return (
      <div className="text-center py-8 font-mono text-[13px] space-y-2" style={{ color: 'oklch(0.70 0 0)' }}>
        <div>No home runs matched</div>
        <div className="text-[11px]" style={{ color: 'oklch(0.50 0 0)' }}>
          Try a lower distance or a wider window.
        </div>
      </div>
    )
  }

  if (payload.engine === 'mlb_hr_compute') {
    const results = payload.results as MlbHrComputeResult[]
    return (
      <div className="space-y-0">
        {results.map((r, i) => (
          <ResultRow
            key={i}
            label={
              <>
                <span style={{ color: 'oklch(0.70 0.10 195)' }}>{r.team}</span>
                <span style={{ color: 'oklch(0.55 0 0)' }}>{' — '}</span>
                {normalizeDisplayPlayer(r.player)}
              </>
            }
            badgeHeader={`${r.games}gp`}
            badgeValue={`${r.hr_count}HR · ${r.total_ft?.toLocaleString()}ft`}
            accent={PITCH_GREEN}
            expanded={isExpanded(i)}
            onToggle={r.events?.length > 0 ? () => toggle(i) : undefined}
          >
            {r.events?.map((e, j) => (
              <div key={j} className="font-mono text-[12px]" style={{ color: 'oklch(0.76 0 0)' }}>
                <span style={{ color: 'oklch(0.60 0 0)' }}>{extractDateToken(e.date) ?? e.date}</span>
                {e.opponent && (
                  <>
                    <span style={{ color: 'oklch(0.45 0 0)' }}>{' vs '}</span>
                    <span style={{ color: 'oklch(0.75 0.08 220)' }}>{e.opponent}</span>
                  </>
                )}
                <span style={{ color: 'oklch(0.45 0 0)' }}>{' · '}</span>
                <span style={{ color: PITCH_GREEN }}>{e.distance_feet}ft</span>
                <span style={{ color: 'oklch(0.50 0 0)' }}> Inn {e.inning}</span>
              </div>
            ))}
          </ResultRow>
        ))}
      </div>
    )
  }

  const results = payload.results as MlbHrTrendResult[]
  return (
    <div className="space-y-0">
      {results.map((r, i) => {
        const matchList = r.matches ?? []
        const metCount = r.met_count ?? matchList.length
        const metLabel = formatMet(metCount, r.window)
        const latest = matchList.length > 0 ? matchList[matchList.length - 1] : null
        const latestValue = latest ? `${latest.distance_feet}ft ${extractDateToken(latest.date) ?? latest.date}` : null
        return (
          <ResultRow
            key={i}
            label={
              <>
                {r.team && (
                  <>
                    <span style={{ color: 'oklch(0.70 0.10 195)' }}>{r.team}</span>
                    <span style={{ color: 'oklch(0.55 0 0)' }}>{' — '}</span>
                  </>
                )}
                {normalizeDisplayPlayer(r.player)}
              </>
            }
            badgeHeader={latestValue ? `${metLabel} · latest` : null}
            badgeValue={latestValue ?? metLabel}
            accent={PITCH_GREEN}
            expanded={isExpanded(i)}
            onToggle={() => toggle(i)}
          >
            {matchList.map((m, j) => (
              <div key={j} className="font-mono text-[12px]" style={{ color: 'oklch(0.76 0 0)' }}>
                <div>
                  <span style={{ color: 'oklch(0.60 0 0)' }}>{extractDateToken(m.date) ?? m.date}</span>
                  {m.opponent && (
                    <>
                      <span style={{ color: 'oklch(0.45 0 0)' }}>{' vs '}</span>
                      <span style={{ color: 'oklch(0.75 0.08 220)' }}>{m.opponent}</span>
                    </>
                  )}
                  <span style={{ color: 'oklch(0.45 0 0)' }}>{' · '}</span>
                  <span style={{ color: PITCH_GREEN }}>{m.distance_feet}ft</span>
                </div>
                {m.description && (
                  <div style={{ color: 'oklch(0.60 0 0)' }}>{m.description}</div>
                )}
              </div>
            ))}
          </ResultRow>
        )
      })}
    </div>
  )
}

// ---------- MLB First Plate Appearance Trend view ----------

function MlbFirstPaTrendView({ payload }: { payload: MlbFirstPaTrendPayload }) {
  const { isExpanded, toggle } = useExpandableRows()

  const results = payload.results
  return (
    <div className="space-y-0">
      {results.map((r, i) => {
        const matchList = r.matches ?? []
        const metCount = r.met_count ?? matchList.length
        const metLabel = formatMet(metCount, r.window)
        const latest = matchList.length > 0 ? matchList[matchList.length - 1] : null
        const latestValue = latest
          ? `${latest.result}${latest.distance_feet != null ? ` (${latest.distance_feet}ft)` : ''} ${extractDateToken(latest.date) ?? latest.date}`
          : null
        return (
          <ResultRow
            key={i}
            label={
              <>
                {r.team && (
                  <>
                    <span style={{ color: 'oklch(0.70 0.10 195)' }}>{r.team}</span>
                    <span style={{ color: 'oklch(0.55 0 0)' }}>{' — '}</span>
                  </>
                )}
                {normalizeDisplayPlayer(r.player)}
              </>
            }
            badgeHeader={latestValue ? `${metLabel} · latest` : null}
            badgeValue={latestValue ?? metLabel}
            accent={PITCH_GREEN}
            expanded={isExpanded(i)}
            onToggle={() => toggle(i)}
          >
            {matchList.map((m, j) => (
              <div key={j} className="font-mono text-[12px]" style={{ color: 'oklch(0.76 0 0)' }}>
                <div>
                  <span style={{ color: 'oklch(0.60 0 0)' }}>{extractDateToken(m.date) ?? m.date}</span>
                  {m.opponent && (
                    <>
                      <span style={{ color: 'oklch(0.45 0 0)' }}>{' vs '}</span>
                      <span style={{ color: 'oklch(0.75 0.08 220)' }}>{m.opponent}</span>
                    </>
                  )}
                  <span style={{ color: 'oklch(0.45 0 0)' }}>{' · '}</span>
                  <span style={{ color: PITCH_GREEN }}>{m.result}</span>
                  {m.distance_feet != null && (
                    <span style={{ color: PITCH_LABEL }}> ({m.distance_feet}ft)</span>
                  )}
                </div>
                {m.description && (
                  <div style={{ color: 'oklch(0.60 0 0)' }}>{m.description}</div>
                )}
              </div>
            ))}
          </ResultRow>
        )
      })}
    </div>
  )
}

// ---------- MLB Team Runs For/Allowed view ----------

function MlbTeamRunsView({ payload }: { payload: MlbTeamRunsPayload }) {
  const { isExpanded, toggle } = useExpandableRows()

  if (payload.engine === 'mlb_team_runs_compute') {
    const results = payload.results as MlbTeamRunsComputeResult[]
    if (results.length === 0) {
      return (
        <div className="text-center py-8 font-mono text-[13px]" style={{ color: PITCH_LABEL }}>
          No teams matched this window
        </div>
      )
    }
    return (
      <div className="space-y-0">
        {results.map((r, i) => (
          <ResultRow
            key={i}
            label={r.team}
            badgeHeader={`${r.games ?? '—'}gp`}
            badgeValue={`${r.total ?? '—'} total · ${r.avg ?? '—'} avg`}
            accent={PITCH_GREEN}
          />
        ))}
      </div>
    )
  }

  const results = payload.results as MlbTeamRunsTrendResult[]
  return (
    <div className="space-y-0">
      {results.map((r, i) => {
        const matchList = r.matches ?? []
        const metCount = r.met_count ?? matchList.length
        const metLabel = formatMet(metCount, r.window)
        const latest = matchList.length > 0 ? matchList[matchList.length - 1] : null
        const latestValue = latest
          ? `${latest.runs_for}-${latest.runs_allowed} ${extractDateToken(latest.date_iso) ?? latest.date_iso}`
          : null
        return (
          <ResultRow
            key={i}
            label={r.team}
            badgeHeader={latestValue ? `${metLabel} · latest` : null}
            badgeValue={latestValue ?? metLabel}
            accent={PITCH_GREEN}
            expanded={isExpanded(i)}
            onToggle={() => toggle(i)}
          >
            {matchList.map((m, j) => (
              <div key={j} className="font-mono text-[12px]" style={{ color: 'oklch(0.76 0 0)' }}>
                <span style={{ color: 'oklch(0.60 0 0)' }}>{extractDateToken(m.date_iso) ?? m.date_iso}</span>
                {m.opponent && (
                  <>
                    <span style={{ color: 'oklch(0.45 0 0)' }}>{' vs '}</span>
                    <span style={{ color: 'oklch(0.75 0.08 220)' }}>{m.opponent}</span>
                  </>
                )}
                <span style={{ color: 'oklch(0.45 0 0)' }}>{' · '}</span>
                <span style={{ color: PITCH_GREEN }}>{m.runs_for}</span>
                <span style={{ color: PITCH_LABEL }}> runs for</span>
                <span style={{ color: 'oklch(0.45 0 0)' }}>{' · '}</span>
                <span style={{ color: 'oklch(0.80 0.15 30)' }}>{m.runs_allowed}</span>
                <span style={{ color: PITCH_LABEL }}> allowed</span>
              </div>
            ))}
          </ResultRow>
        )
      })}
    </div>
  )
}


// Non-MLB h2h engines (e.g. "nfl-h2h") reuse the same totals/games envelope
// but with an entirely different stat set, named explicitly by
// query.display_fields rather than MLB's fixed batting line — this is the
// label map for whichever of those fields show up. Anything not listed
// falls back to the raw field name (still readable, just not prettified).
const H2H_FIELD_LABELS: Record<string, string> = {
  pass_cmp: 'cmp',
  pass_att: 'att',
  pass_yds: 'pass yds',
  pass_td: 'pass td',
  pass_int: 'int',
  pass_lng: 'long',
  pass_rtg: 'rtg',
  rush_yds: 'rush yds',
  rush_td: 'rush td',
  rec_yds: 'rec yds',
  rec_td: 'rec td',
  rec: 'rec',
  g: 'g',
  a: 'a',
  pts: 'pts',
  sog: 'sog',
}

function formatH2hFieldValue(field: string, value: number): string {
  return /rtg|avg|pct/i.test(field) ? value.toFixed(1) : String(value)
}

function H2hView({ payload }: { payload: H2hPayload }) {
  const q = payload.query ?? {}
  const t = payload.totals ?? {}
  const games = payload.games ?? []

  const playerLabel = normalizeDisplayPlayer(q.player_display || q.player_query || 'player')
  const playerTeam = q.player_team || ''
  const opponent = q.opponent_code || ''
  const venueLabel =
    q.home_away === 'home' ? '@ home' : q.home_away === 'away' ? 'on the road' : 'home & away'
  const windowLabel = q.window_label || (q.year ? `(${q.year})` : '')
  // "-week" queries ("career week N", e.g. engine "nfl-week") have no
  // opponent/home-away concept at all — they're keyed by week number
  // instead, so the header reads "week N" rather than "vs OPP · home & away".
  const isWeekQuery = q.week != null
  const weekLabel = isWeekQuery
    ? q.week_end != null && q.week_end !== q.week
      ? `week ${q.week}-${q.week_end}`
      : `week ${q.week}`
    : ''

  // display_fields present -> a non-MLB sport's stat line (see
  // H2H_FIELD_LABELS above); absent -> assume classic MLB batting fields,
  // exactly as this view always has — zero behavior change for every h2h
  // response that predates display_fields.
  const displayFields = q.display_fields && q.display_fields.length > 0 ? q.display_fields : null

  const formatAvg = (n?: number) => (typeof n === 'number' ? n.toFixed(3).replace(/^0+/, '') : '—')

  const slashLine: { label: string; value: string }[] = [
    { label: 'AVG', value: formatAvg(t.AVG) },
    { label: 'OBP', value: formatAvg(t.OBP) },
    { label: 'SLG', value: formatAvg(t.SLG) },
    { label: 'OPS', value: formatAvg(t.OPS) },
  ]

  const counting: { label: string; value: number }[] = [
    { label: 'G', value: t.games ?? 0 },
    { label: 'AB', value: t.AB ?? 0 },
    { label: 'H', value: t.H ?? 0 },
    { label: 'R', value: t.R ?? 0 },
    { label: 'HR', value: t.HR ?? 0 },
    { label: 'RBI', value: t.RBI ?? 0 },
    { label: 'TB', value: t.TB ?? 0 },
    { label: '2B', value: t['2B'] ?? 0 },
    { label: '3B', value: t['3B'] ?? 0 },
    { label: 'BB', value: t.BB ?? 0 },
    { label: 'SO', value: t.SO ?? 0 },
    { label: 'SB', value: t.SB ?? 0 },
  ]

  const genericCounting: { label: string; value: string }[] | null = displayFields
    ? [
        { label: 'g', value: String(t.games ?? games.length) },
        ...displayFields.map((f) => ({
          label: H2H_FIELD_LABELS[f] ?? f.replace(/_/g, ' '),
          value: formatH2hFieldValue(f, typeof t[f] === 'number' ? (t[f] as number) : 0),
        })),
      ]
    : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="font-mono text-[13px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
        {playerTeam ? (
          <>
            <span style={{ color: 'oklch(0.70 0.10 195)' }}>{playerTeam}</span>
            <span style={{ color: 'oklch(0.55 0 0)' }}>{' — '}</span>
          </>
        ) : null}
        <span>{playerLabel}</span>
        {isWeekQuery ? (
          <span style={{ color: 'oklch(0.70 0.10 195)' }}>{` · ${weekLabel}`}</span>
        ) : (
          <>
            <span style={{ color: 'oklch(0.55 0 0)' }}> vs </span>
            <span style={{ color: 'oklch(0.70 0.10 195)' }}>{opponent || '—'}</span>
            <span style={{ color: 'oklch(0.55 0 0)' }}>{` · ${venueLabel}`}</span>
          </>
        )}
        <span style={{ color: 'oklch(0.55 0 0)' }}>{windowLabel ? ` · ${windowLabel}` : ''}</span>
      </div>

      {/* Totals card */}
      <div
        className="rounded p-3"
        style={{ backgroundColor: 'oklch(0.18 0 0)', border: '1px solid oklch(0.28 0 0)' }}
      >
        {genericCounting ? (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(genericCounting.length, 6)}, minmax(0, 1fr))` }}>
            {genericCounting.map((s) => (
              <div key={s.label} className="flex flex-col items-center">
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.55 0 0)' }}>
                  {s.label}
                </span>
                <span className="font-mono font-bold text-[15px]" style={{ color: 'oklch(0.85 0.15 145)' }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {slashLine.map((s) => (
                <div key={s.label} className="flex flex-col items-center">
                  <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.55 0 0)' }}>
                    {s.label}
                  </span>
                  <span className="font-mono font-bold text-[15px]" style={{ color: 'oklch(0.85 0.15 145)' }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-6 gap-2">
              {counting.map((s) => (
                <div key={s.label} className="flex flex-col items-center">
                  <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'oklch(0.48 0 0)' }}>
                    {s.label}
                  </span>
                  <span className="font-mono text-[13px]" style={{ color: 'oklch(0.88 0 0)' }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Game log */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: 'oklch(0.48 0 0)' }}>
          game log
        </div>
        {games.length === 0 ? (
          <div className="text-center py-4 font-mono text-[12px]" style={{ color: 'oklch(0.70 0 0)' }}>
            No games found in window
          </div>
        ) : (
          <div className="space-y-2">
            {games.map((g, i) => {
              const venuePrefix = g.venue === 'away' ? '@' : g.venue === 'home' ? 'vs' : ''
              const opp = g.opponent ?? ''
              const matchup = [venuePrefix, opp].filter(Boolean).join(' ')
              // Stat pieces stay separate (not one comma-joined string) so the
              // row beneath the date can wrap cleanly between whole stats
              // instead of mid-"rush yds" when a line is long.
              const line: string[] = displayFields
                ? displayFields
                    // Skip a field entirely for this row when it's absent
                    // from the game object (not the same as a genuine 0) —
                    // some engines only carry certain fields (e.g. cmp/att)
                    // on the totals object, not per game. Showing "0 cmp"
                    // there would misreport a stat that was simply never
                    // recorded per-game as an actual zero performance.
                    .filter((f) => typeof g[f] === 'number')
                    .map((f) => `${formatH2hFieldValue(f, g[f] as number)} ${H2H_FIELD_LABELS[f] ?? f.replace(/_/g, ' ')}`)
                : [
                    `${g.AB ?? 0} AB`,
                    `${g.H ?? 0} H`,
                    ...(g.HR ? [`${g.HR} HR`] : []),
                    ...(g.RBI ? [`${g.RBI} RBI`] : []),
                    ...(g.R ? [`${g.R} R`] : []),
                    ...(g['2B'] ? [`${g['2B']} 2B`] : []),
                    ...(g['3B'] ? [`${g['3B']} 3B`] : []),
                    ...(g.BB ? [`${g.BB} BB`] : []),
                    ...(g.SO ? [`${g.SO} SO`] : []),
                    ...(g.SB ? [`${g.SB} SB`] : []),
                  ]
              // Boxed like the totals card. Date/matchup owns the whole top
              // row; stats sit beneath it left to right, so a full stat line
              // fits one row instead of being squeezed beside the date.
              return (
                <div
                  key={`${g.date_iso ?? g.date}-${i}`}
                  className="rounded p-3 font-mono text-[12px]"
                  style={{ backgroundColor: 'oklch(0.18 0 0)', border: '1px solid oklch(0.28 0 0)' }}
                >
                  <div style={{ color: 'oklch(0.76 0 0)' }}>
                    <span style={{ color: 'oklch(0.55 0 0)' }}>{extractDateToken(g.date_iso ?? g.date) ?? g.date}</span>
                    {matchup ? (
                      <>
                        <span style={{ color: 'oklch(0.40 0 0)' }}>{'  '}</span>
                        <span style={{ color: 'oklch(0.70 0.10 195)' }}>{matchup}</span>
                      </>
                    ) : null}
                  </div>
                  {line.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5" style={{ color: 'oklch(0.85 0.15 145)' }}>
                      {line.map((piece, pi) => (
                        <span key={`${piece}-${pi}`} className="whitespace-nowrap">{piece}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function formatIpFromOuts(outs?: number): string {
  if (typeof outs !== 'number' || outs <= 0) return '0.0'
  const whole = Math.floor(outs / 3)
  const rem = outs % 3
  return `${whole}.${rem}`
}

// Pitcher first-pitch-velocity data isn't available right now (coming back
// soon) — every FPV/VFP surface below is gated on this instead of deleted,
// so restoring it is flipping one flag.
const SHOW_PITCHER_FPV = false

const PITCH_STAT_PILL = 'oklch(0.18 0 0)'
const PITCH_LABEL = 'oklch(0.55 0 0)'
const PITCH_VALUE = 'oklch(0.88 0 0)'
const PITCH_ACCENT = 'oklch(0.85 0.15 195)'
const PITCH_GREEN = 'oklch(0.85 0.15 145)'
const PITCH_BORDER = 'oklch(0.28 0 0)'

// Boxed game-log row shared by the pitcher h2h / first-pitch-velocity views —
// same treatment as H2hView's game boxes: date + matchup own the top row,
// stats sit beneath left to right and wrap between whole stats.
function PitchGameCard({
  date,
  matchup,
  stats,
}: {
  date: string
  matchup: string
  stats: { text: string; color?: string; wrap?: boolean }[]
}) {
  return (
    <div
      className="rounded p-3 font-mono text-[12px]"
      style={{ backgroundColor: 'oklch(0.18 0 0)', border: `1px solid ${PITCH_BORDER}` }}
    >
      <div>
        <span style={{ color: PITCH_LABEL }}>{date}</span>
        {matchup ? (
          <>
            <span style={{ color: 'oklch(0.40 0 0)' }}>{'  '}</span>
            <span style={{ color: 'oklch(0.70 0.10 195)' }}>{matchup}</span>
          </>
        ) : null}
      </div>
      {stats.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {stats.map((st, i) => (
            <span
              key={`${st.text}-${i}`}
              className={st.wrap ? undefined : 'whitespace-nowrap'}
              style={{ color: st.color ?? PITCH_VALUE }}
            >
              {st.text}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function StatBox({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 py-1.5 rounded" style={{ backgroundColor: PITCH_STAT_PILL, border: `1px solid ${PITCH_BORDER}` }}>
      <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: PITCH_LABEL }}>{label}</span>
      <span className="font-mono font-bold text-[13px]" style={{ color: accent ?? PITCH_VALUE }}>{value}</span>
    </div>
  )
}

const OUT_TYPE_LABELS: Array<[keyof Record<string, number>, string]> = [
  ['GO', 'Ground out'],
  ['FO', 'Fly out'],
  ['LO', 'Line out'],
  ['PO', 'Pop out'],
  ['FOUL_OUT', 'Foul out'],
  ['DP', 'Double play'],
  ['SAC_FLY', 'Sac fly'],
  ['SAC_BUNT', 'Sac bunt'],
  ['BUNT_OUT', 'Bunt out'],
  ['FORCE_OUT', 'Force out'],
  ['CS', 'Caught stealing'],
  ['PICKOFF', 'Pickoff'],
  ['TP', 'Triple play'],
  ['OTHER_OUT', 'Other'],
]

function OutTypeGrid({ outTypes, totalOuts }: { outTypes: Record<string, number>; totalOuts: number }) {
  const rows = OUT_TYPE_LABELS
    .map(([key, label]) => ({ key: key as string, label, value: outTypes[key as string] ?? 0 }))
    .filter((r) => r.value > 0)
  if (rows.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[12px]">
      {rows.map((r) => {
        const pct = totalOuts > 0 ? (r.value / totalOuts) * 100 : 0
        return (
          <div key={r.key} className="flex items-baseline justify-between">
            <span style={{ color: PITCH_VALUE }}>{r.label}</span>
            <span style={{ color: PITCH_LABEL }}>
              <span style={{ color: PITCH_VALUE }}>{r.value}</span>
              {totalOuts > 0 ? ` (${pct.toFixed(1)}%)` : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function PitchArsenalBars({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
  const total = entries.reduce((sum, [, v]) => sum + (v as number), 0)
  if (total === 0) return null
  const max = entries[0][1] as number
  return (
    <div className="space-y-1 font-mono text-[12px]">
      {entries.map(([name, count]) => {
        const pct = (count / total) * 100
        const widthPct = (count / max) * 100
        return (
          <div key={name} className="flex items-center gap-2">
            <span className="w-[120px] shrink-0" style={{ color: PITCH_VALUE }}>{name}</span>
            <span className="w-[34px] text-right tabular-nums" style={{ color: PITCH_LABEL }}>{count}</span>
            <span className="w-[52px] text-right tabular-nums" style={{ color: PITCH_LABEL }}>{pct.toFixed(1)}%</span>
            <div className="flex-1 h-[8px] rounded-sm" style={{ backgroundColor: 'oklch(0.16 0 0)' }}>
              <div className="h-full rounded-sm" style={{ width: `${widthPct}%`, backgroundColor: PITCH_ACCENT }} />
            </div>
          </div>
        )
      })}
      <div className="text-[10px] mt-1" style={{ color: PITCH_LABEL }}>{total} pitches total</div>
    </div>
  )
}

function MlbPitchH2hView({ payload, query }: { payload: MlbPitchH2hPayload; query?: string }) {
  const games = payload.games ?? []
  const totals = payload.totals ?? {}
  const rates = payload.rates ?? {}
  const out_types = payload.out_types ?? {}
  const pbp = payload.pbp_tally ?? {}
  const arsenal = payload.pitch_type_counts ?? {}
  const fp = payload.first_pitch_summary ?? {}
  const updown = payload.updown
  const hasUpdown = !!updown && typeof updown.target === 'string'
  const isOutsMode = !hasUpdown && typeof query === 'string' && /(?:^|\s)-outs(?:\s|$)/i.test(query)
  const mode: 'overview' | 'outs' | 'down' = hasUpdown ? 'down' : isOutsMode ? 'outs' : 'overview'

  const playerLabel = payload.player || 'pitcher'
  const opponent = payload.opponent || 'ALL'
  const yw = payload.year_window
  const yearLabel = yw ? (yw[0] === yw[1] ? `${yw[0]}` : `${yw[0]}–${yw[1]}`) : payload.career ? 'career' : ''

  const ip = formatIpFromOuts(totals.ip_outs)
  const totalOuts = rates.total_contact_outs ?? 0

  const header = (
    <div className="font-mono text-[13px]" style={{ color: PITCH_ACCENT }}>
      <span>{playerLabel}</span>
      <span style={{ color: PITCH_LABEL }}> vs </span>
      <span style={{ color: 'oklch(0.70 0.10 195)' }}>{opponent}</span>
      <span style={{ color: PITCH_LABEL }}>{` · ${games.length} game${games.length === 1 ? '' : 's'}${yearLabel ? ` · ${yearLabel}` : ''}${mode === 'outs' ? ' · contact outs' : mode === 'down' ? ` · ${updown!.target ?? 'updown'}` : ''}`}</span>
    </div>
  )

  if (mode === 'down') {
    const matches = typeof updown!.matches === 'number' ? updown!.matches : 0
    const total = updown!.per_game?.length ?? games.length
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
            {`${updown!.target ?? ''} match`}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <StatBox label="matches" value={matches} accent={PITCH_GREEN} />
            <StatBox label="games" value={total} />
            <StatBox label="hit %" value={total > 0 ? `${((matches / total) * 100).toFixed(1)}%` : '—'} accent={PITCH_ACCENT} />
            <StatBox label="miss" value={total - matches} />
          </div>
          {Array.isArray(updown!.per_game) && updown!.per_game.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {updown!.per_game.map((hit, i) => (
                <span
                  key={i}
                  className="inline-block w-[10px] h-[10px] rounded-sm"
                  style={{ backgroundColor: hit ? PITCH_GREEN : 'oklch(0.22 0 0)' }}
                  title={hit ? 'match' : 'miss'}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'outs') {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.18 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
            rate overview
          </div>
          <div className="grid grid-cols-4 gap-2">
            <StatBox label="K%" value={typeof rates.k_pct === 'number' ? rates.k_pct.toFixed(1) : '—'} accent={PITCH_GREEN} />
            <StatBox label="BB%" value={typeof rates.bb_pct === 'number' ? rates.bb_pct.toFixed(1) : '—'} />
            <StatBox label="HR%" value={typeof rates.hr_pct === 'number' ? rates.hr_pct.toFixed(1) : '—'} />
            <StatBox label="H%" value={typeof rates.h_pct === 'number' ? rates.h_pct.toFixed(1) : '—'} />
          </div>
        </div>
        {Object.keys(out_types).length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              contact outs {totalOuts > 0 ? `({${totalOuts}} total)` : ''}
            </div>
            <OutTypeGrid outTypes={out_types} totalOuts={totalOuts} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {header}

      {/* Totals */}
      <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.18 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
        <div className="grid grid-cols-4 gap-2 mb-2">
          <StatBox label="G" value={totals.games ?? games.length} />
          <StatBox label="IP" value={ip} />
          <StatBox label="K" value={totals.k ?? 0} accent={PITCH_GREEN} />
          <StatBox label="ERA" value={typeof rates.era === 'number' ? rates.era.toFixed(2) : '—'} accent={PITCH_GREEN} />
          <StatBox label="BB" value={totals.bb ?? 0} />
          <StatBox label="HR" value={totals.hr ?? 0} />
          <StatBox label="H" value={totals.h ?? 0} />
          <StatBox label="P" value={totals.pitches ?? 0} />
          <StatBox label="K/9" value={typeof rates.k9 === 'number' ? rates.k9.toFixed(2) : '—'} />
          <StatBox label="BB/9" value={typeof rates.bb9 === 'number' ? rates.bb9.toFixed(2) : '—'} />
          <StatBox label="HR/9" value={typeof rates.hr9 === 'number' ? rates.hr9.toFixed(2) : '—'} />
          <StatBox label="PA" value={rates.pa ?? 0} />
        </div>
        <div className="grid grid-cols-4 gap-2 font-mono text-[11px]" style={{ color: PITCH_LABEL }}>
          <div className="flex items-baseline gap-1.5"><span>K%</span><span style={{ color: PITCH_VALUE }}>{rates.k_pct?.toFixed(1) ?? '—'}</span></div>
          <div className="flex items-baseline gap-1.5"><span>BB%</span><span style={{ color: PITCH_VALUE }}>{rates.bb_pct?.toFixed(1) ?? '—'}</span></div>
          <div className="flex items-baseline gap-1.5"><span>HR%</span><span style={{ color: PITCH_VALUE }}>{rates.hr_pct?.toFixed(1) ?? '—'}</span></div>
          <div className="flex items-baseline gap-1.5"><span>H%</span><span style={{ color: PITCH_VALUE }}>{rates.h_pct?.toFixed(1) ?? '—'}</span></div>
        </div>
      </div>

      {/* Out types + Arsenal side-by-side on wide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.keys(out_types).length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              out types {totalOuts > 0 ? `({${totalOuts}} contact outs)` : ''}
            </div>
            <OutTypeGrid outTypes={out_types} totalOuts={totalOuts} />
          </div>
        )}
        {Object.keys(arsenal).length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              pitch arsenal
            </div>
            <PitchArsenalBars counts={arsenal} />
          </div>
        )}
      </div>

      {/* PBP + first-pitch */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.keys(pbp).length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              plate appearances
            </div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1 font-mono text-[12px]">
              {(['K', 'BB', 'H', 'HR', 'HBP', 'OUT', 'FC', 'ROE', 'OTHER'] as const).map((k) => (
                pbp[k] ? (
                  <div key={k} className="flex items-baseline justify-between">
                    <span style={{ color: PITCH_VALUE }}>{k}</span>
                    <span style={{ color: PITCH_VALUE }}>{pbp[k]}</span>
                  </div>
                ) : null
              ))}
            </div>
          </div>
        )}
        {SHOW_PITCHER_FPV && (typeof fp.avg === 'number' || typeof fp.median === 'number') && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              first pitch
            </div>
            <div className="grid grid-cols-4 gap-2 font-mono text-[12px]">
              <StatBox label="avg" value={typeof fp.avg === 'number' ? fp.avg.toFixed(1) : '—'} accent={PITCH_ACCENT} />
              <StatBox label="med" value={typeof fp.median === 'number' ? fp.median.toFixed(1) : '—'} />
              <StatBox label="min" value={typeof fp.min === 'number' ? fp.min.toFixed(0) : '—'} />
              <StatBox label="max" value={typeof fp.max === 'number' ? fp.max.toFixed(0) : '—'} />
            </div>
            {fp.pitch_types && Object.keys(fp.pitch_types).length > 0 && (
              <div className="mt-2 font-mono text-[11px]" style={{ color: PITCH_LABEL }}>
                {Object.entries(fp.pitch_types).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Game log */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
          game log
        </div>
        {games.length === 0 ? (
          <div className="text-center py-3 font-mono text-[12px]" style={{ color: PITCH_VALUE }}>No games found</div>
        ) : (
          <div className="space-y-2">
            {games.map((g, i) => (
              <PitchGameCard
                key={`${g.date_iso ?? g.date_display ?? i}`}
                date={g.date_display ?? g.date_iso ?? ''}
                matchup={g.opponent_team ?? ''}
                stats={[
                  { text: `${g.ip ?? ''} IP` },
                  { text: `${g.k ?? 0} K`, color: PITCH_GREEN },
                  { text: `${g.bb ?? 0} BB` },
                  { text: `${g.hr ?? 0} HR` },
                  { text: `${g.pitches ?? 0} P` },
                  ...(SHOW_PITCHER_FPV ? [{ text: `${typeof g.vfp === 'number' ? g.vfp.toFixed(1) : '—'} VFP`, color: PITCH_ACCENT }] : []),
                ]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MlbPitchFpvView({ payload }: { payload: MlbPitchFpvPayload }) {
  const games = payload.games ?? []
  const summary = payload.summary ?? {}
  const firstPitchTypes = summary.first_pitch_types ?? {}

  const playerLabel = payload.player || 'pitcher'
  const windowLabel = payload.window || ''
  const count = typeof summary.count === 'number' ? summary.count : games.length

  return (
    <div className="space-y-4">
      <div className="font-mono text-[13px]" style={{ color: PITCH_ACCENT }}>
        <span>{playerLabel}</span>
        <span style={{ color: PITCH_LABEL }}>{` · first-pitch velocity${windowLabel ? ` · ${windowLabel}` : ''} · ${count} game${count === 1 ? '' : 's'}`}</span>
      </div>

      {/* FPV summary */}
      <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.18 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
        <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
          first pitch velocity
        </div>
        <div className="grid grid-cols-4 gap-2">
          <StatBox label="avg" value={typeof summary.avg_fpv === 'number' ? summary.avg_fpv.toFixed(1) : '—'} accent={PITCH_ACCENT} />
          <StatBox label="min" value={typeof summary.min_fpv === 'number' ? summary.min_fpv.toFixed(0) : '—'} />
          <StatBox label="max" value={typeof summary.max_fpv === 'number' ? summary.max_fpv.toFixed(0) : '—'} />
          <StatBox label="games" value={count} />
        </div>
      </div>

      {/* First-pitch type mix */}
      {Object.keys(firstPitchTypes).length > 0 && (
        <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
            first pitch types
          </div>
          <PitchArsenalBars counts={firstPitchTypes} />
        </div>
      )}

      {/* Game log */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
          game log
        </div>
        {games.length === 0 ? (
          <div className="text-center py-3 font-mono text-[12px]" style={{ color: PITCH_VALUE }}>No games found</div>
        ) : (
          <div className="space-y-2">
            {games.map((g, i) => {
              const ha = (g.home_away || '').toUpperCase()
              const haLabel = ha === 'HOME' ? 'vs' : ha === 'AWAY' ? '@' : ha
              return (
                <PitchGameCard
                  key={`${g.date_iso ?? i}`}
                  date={extractDateToken(g.date_iso) ?? g.date_iso ?? ''}
                  matchup={[haLabel, g.opponent_team ?? ''].filter(Boolean).join(' ')}
                  stats={[
                    { text: `${typeof g.fpv === 'number' ? g.fpv.toFixed(1) : '—'} FPV`, color: PITCH_ACCENT },
                    ...(g.pitch_type ? [{ text: g.pitch_type }] : []),
                    ...(g.inning ? [{ text: `inn ${g.inning}`, color: PITCH_LABEL }] : []),
                    // Free-text play description — can be long, so it's
                    // allowed to wrap instead of forcing horizontal overflow.
                    ...(g.batter_play ? [{ text: g.batter_play, wrap: true }] : []),
                  ]}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function MlbBatTeamView({ payload }: { payload: MlbBatTeamPayload }) {
  const rates = payload.rates ?? {}
  const out_types = payload.out_types ?? {}
  const pbp = payload.pbp_tally ?? {}
  const fp = payload.first_pitch_summary ?? {}
  const pitchers = payload.contributing_pitchers ?? []

  const team = payload.team || 'TEAM'
  const yw = payload.year_window
  const yearLabel = yw ? (yw[0] === yw[1] ? `${yw[0]} season` : `${yw[0]}–${yw[1]}`) : payload.career ? 'career' : ''
  const totalOuts = rates.total_contact_outs ?? 0

  return (
    <div className="space-y-4">
      <div className="font-mono text-[13px]" style={{ color: PITCH_ACCENT }}>
        <span style={{ color: 'oklch(0.70 0.10 195)' }}>{team}</span>
        <span> batters</span>
        <span style={{ color: PITCH_LABEL }}>{` · ${payload.games ?? 0} game${payload.games === 1 ? '' : 's'}${yearLabel ? ` · ${yearLabel}` : ''} · ${rates.pa ?? 0} PA`}</span>
      </div>

      <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.18 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
        <div className="grid grid-cols-4 gap-2">
          <StatBox label="K%" value={rates.k_pct?.toFixed(1) ?? '—'} accent={PITCH_GREEN} />
          <StatBox label="BB%" value={rates.bb_pct?.toFixed(1) ?? '—'} />
          <StatBox label="HR%" value={rates.hr_pct?.toFixed(1) ?? '—'} />
          <StatBox label="H%" value={rates.h_pct?.toFixed(1) ?? '—'} />
          <StatBox label="K" value={pbp.K ?? 0} />
          <StatBox label="BB" value={pbp.BB ?? 0} />
          <StatBox label="HR" value={pbp.HR ?? 0} />
          <StatBox label="H" value={pbp.H ?? 0} />
          <StatBox label="ERA" value={typeof rates.era === 'number' ? rates.era.toFixed(2) : '—'} />
          <StatBox label="K/9" value={typeof rates.k9 === 'number' ? rates.k9.toFixed(2) : '—'} />
          <StatBox label="BB/9" value={typeof rates.bb9 === 'number' ? rates.bb9.toFixed(2) : '—'} />
          <StatBox label="HR/9" value={typeof rates.hr9 === 'number' ? rates.hr9.toFixed(2) : '—'} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.keys(out_types).length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              out types {totalOuts > 0 ? `({${totalOuts}} contact outs)` : ''}
            </div>
            <OutTypeGrid outTypes={out_types} totalOuts={totalOuts} />
          </div>
        )}
        {SHOW_PITCHER_FPV && (typeof fp.avg === 'number' || typeof fp.median === 'number') && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              first pitch (opposing)
            </div>
            <div className="grid grid-cols-4 gap-2">
              <StatBox label="avg" value={typeof fp.avg === 'number' ? fp.avg.toFixed(1) : '—'} accent={PITCH_ACCENT} />
              <StatBox label="med" value={typeof fp.median === 'number' ? fp.median.toFixed(1) : '—'} />
              <StatBox label="min" value={typeof fp.min === 'number' ? fp.min.toFixed(0) : '—'} />
              <StatBox label="max" value={typeof fp.max === 'number' ? fp.max.toFixed(0) : '—'} />
            </div>
          </div>
        )}
      </div>

      {pitchers.length > 0 && (
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
            opposing pitchers in window
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 font-mono text-[12px]">
            {pitchers.slice(0, 24).map((p) => (
              <div key={p.name} className="flex items-baseline justify-between">
                <span style={{ color: PITCH_VALUE }}>{p.name}</span>
                <span style={{ color: PITCH_LABEL }}>{p.games} g</span>
              </div>
            ))}
          </div>
          {pitchers.length > 24 && (
            <div className="mt-1 font-mono text-[11px]" style={{ color: PITCH_LABEL }}>
              +{pitchers.length - 24} more
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MlbTeamOverviewView({ payload }: { payload: MlbTeamOverviewPayload }) {
  const team = payload.team || 'TEAM'
  const season = payload.season
  const processed = payload.games_processed ?? 0
  const completeness = typeof payload.completeness_pct === 'number' ? payload.completeness_pct : null
  const down3 = payload['3down'] ?? 0
  const down6 = payload['6down'] ?? 0
  const down9 = payload['9down'] ?? 0
  const avgFirstBR = payload.avg_first_baserunner_inning
  const kTotal = payload.team_k_total ?? 0
  const bbTotal = payload.team_bb_total ?? 0
  const outTypes = payload.out_type_pct ?? {}
  const hitsPerInning = payload.hits_per_inning_avg ?? {}

  // Sort out types by pct desc, drop zero rows
  const outTypeRows = Object.entries(outTypes)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
  const outTypeTotal = outTypeRows.reduce((s, [, v]) => s + (v as number), 0) || 1

  const inningEntries = Object.entries(hitsPerInning)
    .map(([k, v]) => [Number(k), v as number] as const)
    .filter(([n]) => Number.isFinite(n))
    .sort((a, b) => a[0] - b[0])
  const maxInningHits = inningEntries.reduce((m, [, v]) => Math.max(m, v), 0)

  return (
    <div className="space-y-4">
      <div className="font-mono text-[13px]" style={{ color: PITCH_ACCENT }}>
        <span>{team}</span>
        <span style={{ color: PITCH_LABEL }}>{` · team overview${season ? ` · ${season} season` : ''} · ${processed} game${processed === 1 ? '' : 's'}`}</span>
      </div>

      {/* Headline totals */}
      <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.18 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
        <div className="grid grid-cols-4 gap-2">
          <StatBox label="K" value={kTotal} accent={PITCH_GREEN} />
          <StatBox label="BB" value={bbTotal} />
          <StatBox label="1-2-3" value={down3} accent={PITCH_ACCENT} />
          <StatBox label="6 UP" value={down6} accent={PITCH_ACCENT} />
          <StatBox label="9 UP" value={down9} accent={PITCH_ACCENT} />
          <StatBox label="1st BR inn" value={typeof avgFirstBR === 'number' ? avgFirstBR.toFixed(2) : '—'} />
          <StatBox label="games" value={processed} />
          <StatBox label="data %" value={completeness !== null ? `${completeness.toFixed(1)}%` : '—'} />
        </div>
      </div>

      {/* Out type mix + Hits per inning */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {outTypeRows.length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              out types
            </div>
            <div className="space-y-1">
              {outTypeRows.map(([k, pct]) => {
                const widthPct = Math.min(100, ((pct as number) / outTypeTotal) * 100)
                return (
                  <div key={k} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="w-[80px] shrink-0" style={{ color: PITCH_VALUE }}>{k}</span>
                    <span className="w-[48px] text-right tabular-nums" style={{ color: PITCH_LABEL }}>{(pct as number).toFixed(2)}%</span>
                    <div className="flex-1 h-[6px] rounded-sm overflow-hidden" style={{ backgroundColor: 'oklch(0.18 0 0)' }}>
                      <div className="h-full rounded-sm" style={{ width: `${widthPct}%`, backgroundColor: PITCH_ACCENT }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {inningEntries.length > 0 && (
          <div className="rounded p-3" style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}>
            <div className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{ color: PITCH_LABEL }}>
              avg hits / inning
            </div>
            <div className="space-y-1">
              {inningEntries.map(([n, v]) => {
                const widthPct = maxInningHits > 0 ? (v / maxInningHits) * 100 : 0
                return (
                  <div key={n} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="w-[24px] shrink-0 text-right tabular-nums" style={{ color: PITCH_LABEL }}>{n}</span>
                    <span className="w-[44px] text-right tabular-nums" style={{ color: PITCH_VALUE }}>{v.toFixed(2)}</span>
                    <div className="flex-1 h-[6px] rounded-sm overflow-hidden" style={{ backgroundColor: 'oklch(0.18 0 0)' }}>
                      <div className="h-full rounded-sm" style={{ width: `${widthPct}%`, backgroundColor: PITCH_GREEN }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------- Grade helpers ----------

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A++': return 'oklch(0.78 0.18 145)'
    case 'A+':  return 'oklch(0.82 0.16 155)'
    case 'A':   return 'oklch(0.85 0.16 165)'
    case 'B':   return 'oklch(0.85 0.20 100)'
    case 'C':   return 'oklch(0.80 0.20 60)'
    case 'D':   return 'oklch(0.72 0.18 35)'
    default:    return 'oklch(0.60 0.15 20)'
  }
}

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span
      className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded"
      style={{
        backgroundColor: 'oklch(0.16 0 0)',
        color: gradeColor(grade),
        border: `1px solid ${gradeColor(grade)}`,
        letterSpacing: '0.04em',
      }}
    >
      {grade}
    </span>
  )
}

// ---------- MLB Report Leaderboard View ----------

function MlbReportLeaderboardView({ payload }: { payload: MlbReportLeaderboardPayload }) {
  const rows = payload.rows ?? []
  const q = payload.query ?? {}
  const windowLabel = q.is_season ? 'season' : `last ${q.window}`
  const generatedDate = payload.generated_at ? formatLeaderboardDate(payload.generated_at) : ''

  return (
    <div className="space-y-3">
      <div className="font-mono text-[13px]" style={{ color: PITCH_ACCENT }}>
        <span>MLB Batter Report</span>
        <span style={{ color: PITCH_LABEL }}>{` · ${windowLabel} · top ${rows.length}`}</span>
        {generatedDate && (
          <span style={{ color: 'oklch(0.42 0 0)' }}>{` · ${generatedDate}`}</span>
        )}
      </div>

      {/* Header row */}
      <div
        className="grid font-mono text-[10px] uppercase tracking-widest px-2 py-1"
        style={{
          gridTemplateColumns: '24px 1fr 36px 44px 52px',
          gap: '8px',
          color: PITCH_LABEL,
          borderBottom: `1px solid ${PITCH_BORDER}`,
        }}
      >
        <span>#</span>
        <span>player</span>
        <span>tm</span>
        <span>grade</span>
        <span className="text-right">score</span>
      </div>

      {/* Rows */}
      {rows.map((row, idx) => {
        const rank = String(idx + 1).padStart(2, '0')
        return (
          <div
            key={`${row.player_key}-${idx}`}
            className="grid font-mono text-[12px] px-2 py-1.5 items-center"
            style={{
              gridTemplateColumns: '24px 1fr 36px 44px 52px',
              gap: '8px',
              borderBottom: idx < rows.length - 1 ? '1px solid oklch(0.18 0 0)' : 'none',
            }}
          >
            <span style={{ color: PITCH_LABEL }}>{rank}</span>
            <span className="truncate" style={{ color: PITCH_VALUE }}>{row.player}</span>
            <span style={{ color: 'oklch(0.70 0.10 195)' }}>{row.team}</span>
            <span><GradeBadge grade={row.grade} /></span>
            <span
              className="text-right tabular-nums"
              style={{ color: 'oklch(0.78 0.18 145)', fontWeight: 600 }}
            >
              {Math.round(row.score * 1.5)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ---------- MLB Player Report View ----------

function MlbPlayerReportView({ payload }: { payload: MlbPlayerReportPayload }) {
  const report = payload.report
  if (!report) {
    return (
      <div className="font-mono text-[13px]" style={{ color: PITCH_LABEL }}>
        No report data available
      </div>
    )
  }

  const windowLabel = report.is_season ? 'season' : `last ${report.window}`
  const dateRange =
    report.first_game && report.last_game
      ? `${report.first_game} — ${report.last_game}`
      : ''
  const t = report.totals ?? {}
  const breakdown = report.breakdown ?? []

  const absStats = [
    { label: 'PA', value: t.PA ?? 0 },
    { label: 'AB', value: t.AB ?? 0 },
    { label: 'H', value: t.H ?? 0 },
    { label: 'TB', value: t.TB ?? 0 },
    { label: 'BB', value: t.BB ?? 0 },
    { label: 'HBP', value: t.HBP ?? 0 },
    { label: 'SO', value: t.SO ?? 0 },
  ]

  const gameStats = [
    { label: 'G/Hit', value: t.games_with_hit ?? 0 },
    { label: 'G/RBI', value: t.games_with_rbi ?? 0 },
    { label: 'G/Run', value: t.games_with_run ?? 0 },
    { label: 'G/HR', value: t.games_with_hr ?? 0 },
    { label: 'G/SB', value: t.games_with_sb ?? 0 },
    { label: 'G/2TB', value: t.games_with_2tb ?? 0 },
    { label: 'G/3K', value: t.games_with_3k ?? 0 },
  ]

  const totalPoints = breakdown.reduce((sum, b) => sum + b.points, 0)

  const formatRate = (b: MlbPlayerReportBreakdown): string => {
    // For percentage-style rates, show as %
    const lbl = b.label.toLowerCase()
    if (lbl.includes('%') || lbl.includes('pct')) {
      return `${(b.rate * 100).toFixed(1)}%`
    }
    return b.rate.toFixed(4).replace(/\.?0+$/, '') || '0'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="font-mono text-[13px]" style={{ color: PITCH_ACCENT }}>
          {payload.team ? (
            <>
              <span style={{ color: 'oklch(0.70 0.10 195)' }}>{payload.team}</span>
              <span style={{ color: PITCH_LABEL }}>{' — '}</span>
            </>
          ) : null}
          <span>{payload.player}</span>
          <span style={{ color: PITCH_LABEL }}>{` · ${windowLabel}`}</span>
          {dateRange && (
            <span style={{ color: 'oklch(0.42 0 0)' }}>{` · ${dateRange}`}</span>
          )}
        </div>
        <div className="flex items-center gap-2 font-mono shrink-0">
          <GradeBadge grade={report.grade} />
          <span style={{ color: 'oklch(0.78 0.18 145)', fontWeight: 700, fontSize: '15px' }}>
            {Math.round(report.score * 1.5)}
          </span>
          <span style={{ color: PITCH_LABEL, fontSize: '11px' }}>{`${report.games}g`}</span>
        </div>
      </div>

      {/* Counting stats */}
      <div
        className="rounded p-3"
        style={{ backgroundColor: 'oklch(0.18 0 0)', border: `1px solid ${PITCH_BORDER}` }}
      >
        <div className="grid grid-cols-7 gap-2 mb-3">
          {absStats.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <span
                className="font-mono text-[9px] uppercase tracking-wider"
                style={{ color: PITCH_LABEL }}
              >
                {s.label}
              </span>
              <span className="font-mono text-[13px]" style={{ color: PITCH_VALUE }}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {gameStats.map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <span
                className="font-mono text-[9px] uppercase tracking-wider whitespace-nowrap"
                style={{ color: PITCH_LABEL }}
              >
                {s.label}
              </span>
              <span
                className="font-mono text-[13px]"
                style={{ color: s.value > 0 ? PITCH_ACCENT : PITCH_VALUE }}
              >
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Score breakdown */}
      <div
        className="rounded p-3"
        style={{ backgroundColor: 'oklch(0.13 0 0)', border: `1px solid ${PITCH_BORDER}` }}
      >
        <div
          className="font-mono text-[10px] uppercase tracking-widest mb-2"
          style={{ color: PITCH_LABEL }}
        >
          score breakdown
        </div>
        <div className="space-y-0.5">
          {/* Column headers */}
          <div
            className="grid font-mono text-[9px] uppercase tracking-widest pb-1 mb-1"
            style={{
              gridTemplateColumns: '1fr 64px 44px 48px',
              gap: '8px',
              color: 'oklch(0.38 0 0)',
              borderBottom: '1px solid oklch(0.20 0 0)',
            }}
          >
            <span>metric</span>
            <span className="text-right">rate</span>
            <span className="text-right">wt</span>
            <span className="text-right">pts</span>
          </div>
          {breakdown.map((b, i) => {
            const isNeg = b.weight < 0
            const pts = b.points * 1.5
            const ptsColor =
              Math.abs(pts) < 0.01
                ? PITCH_LABEL
                : pts > 0
                ? 'oklch(0.78 0.18 145)'
                : 'oklch(0.68 0.18 25)'
            return (
              <div
                key={i}
                className="grid font-mono text-[11px] py-0.5"
                style={{ gridTemplateColumns: '1fr 64px 44px 48px', gap: '8px' }}
              >
                <span style={{ color: PITCH_VALUE }}>{b.label}</span>
                <span
                  className="text-right tabular-nums"
                  style={{ color: PITCH_LABEL }}
                >
                  {formatRate(b)}
                </span>
                <span
                  className="text-right tabular-nums"
                  style={{ color: isNeg ? 'oklch(0.68 0.18 25)' : PITCH_LABEL }}
                >
                  {isNeg ? b.weight.toFixed(1) : `+${b.weight.toFixed(1)}`}
                </span>
                <span
                  className="text-right tabular-nums font-bold"
                  style={{ color: ptsColor }}
                >
                  {pts >= 0 ? `+${Math.round(pts * 100) / 100}` : `${Math.round(pts * 100) / 100}`}
                </span>
              </div>
            )
          })}
          {/* Total row */}
          <div
            className="grid font-mono text-[12px] pt-1.5 mt-1"
            style={{
              gridTemplateColumns: '1fr 64px 44px 48px',
              gap: '8px',
              borderTop: '1px solid oklch(0.24 0 0)',
            }}
          >
            <span style={{ color: PITCH_VALUE, fontWeight: 600 }}>total</span>
            <span />
            <span />
            <span
              className="text-right tabular-nums font-bold"
              style={{ color: 'oklch(0.78 0.18 145)', fontSize: '13px' }}
            >
              {Math.round(totalPoints * 1.5)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Distinguishes "typing a player name" from "typing an nspe command" in the
// same free-text input, so the CLI can double as the player search without a
// separate input. Real nspe queries always open with a sport token and/or
// contain a hyphenated flag (`-yds300`) very early on — a bare word or two
// with no hyphen and no leading sport keyword is what a name search looks
// like instead. Checked before running `searchPlayers`, which is the actual
// arbiter of whether anything matches.
// Static neon glow on the {search} button — same cyan as its text, two
// layers (tight+bright, wide+soft) rather than an animated pulse, so it
// reads as "the button that matters" without being distracting.
const SEARCH_GLOW = '0 0 8px 1px oklch(0.90 0.18 195 / 0.55), 0 0 20px 4px oklch(0.90 0.18 195 / 0.25)'

// Every command family in nspecommand_map.json (the CLI's own dispatch
// catalog) opens with one of these tokens — a league name, 'ncaaf' (a pure
// input alias for 'cfb'), the 'plus' batch-runner meta-command, 'help', or
// the literal CLI program name 'nspe' itself (so predictive syntax starts
// the moment someone types "nspe", before they've even picked a sport, per
// the explicit request not to wait for "nspe <sport>"). Anything else with
// no hyphen and no leading token from this list is treated as a player-name
// search instead of a malformed command.
// Sport names plus every bare mode/category keyword that can start a real
// command on its own (streak/team/first/long/h2h/week/1h/q1/pass/rush/rec/any)
// — without these, typing e.g. "streak" alone has no "-" and isn't a sport,
// so looksLikePlayerSearch treated it as a player-name search and syntax
// matching never even ran, even though "-streak" commands are literally in
// the catalog.
const NSPE_COMMAND_TOKENS = [
  'nspe', 'mlb', 'nfl', 'nba', 'nhl', 'cfb', 'ncaaf', 'plus', 'help',
  'streak', 'team', 'first', 'long', 'h2h', 'week', '1h', 'q1',
  'pass', 'rush', 'rec', 'any', 'parlay',
]
function looksLikePlayerSearch(value: string): boolean {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed || trimmed.includes('-')) return false
  const firstToken = trimmed.split(/\s+/)[0]
  if (NSPE_COMMAND_TOKENS.includes(firstToken)) return false
  return true
}

const SPORT_TOKENS = ['mlb', 'nfl', 'nba', 'nhl', 'cfb', 'ncaaf']

// Strips a leading "nspe"/sport prefix so "nspe nfl saquon" can still
// resolve "saquon" as a player-name search on its own — without this,
// looksLikePlayerSearch(the whole string) sees the leading "nspe"/"nfl"
// tokens and routes the entire thing to command-syntax mode instead, so
// searchPlayers() never even gets to see the name portion (the exact
// "{nspe nfl saquon} makes every {psc} suggestion disappear" bug: no
// player match means playerSpotlightMatches never runs, and no catalog
// command literally starts with "saquon" either, so syntaxMatches comes up
// empty too). Reuses looksLikePlayerSearch on the remainder (not a fresh
// check) so reserved mode keywords ("long"/"pass"/"streak"/...) still
// correctly stay out of player-search mode — otherwise a real player
// surnamed e.g. "Long" would hijack the "long" explosive-plays category the
// moment someone typed "nspe nfl long".
function stripSportPrefix(value: string): { sport?: string; rest: string } {
  const tokens = value.trim().toLowerCase().split(/[\s/]+/).filter(Boolean)
  let i = 0
  if (tokens[i] === 'nspe') i++
  let sport: string | undefined
  if (tokens[i] && SPORT_TOKENS.includes(tokens[i])) {
    sport = tokens[i] === 'ncaaf' ? 'cfb' : tokens[i]
    i++
  }
  return { sport, rest: tokens.slice(i).join(' ') }
}

function App() {
  const [stars, setStars] = useState<Star[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [isMiniOpen, setIsMiniOpen] = useState(false)
  const [isSampleMenuOpen, setIsSampleMenuOpen] = useState(false)
  const [isTutorialOpen, setIsTutorialOpen] = useState(false)
  const [isSampleDemoOpen, setIsSampleDemoOpen] = useState(false)
  const [isSampleQueriesOpen, setIsSampleQueriesOpen] = useState(false)
  const [miniPosition, setMiniPosition] = useState({
    x: window.innerWidth / 2 - 310,
    y: Math.max(80, Math.floor((window.innerHeight - window.innerHeight * 0.62) / 2)),
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [queryResults, setQueryResults] = useState<QueryResult[] | null>(null)
  // Unit label for the generic path's bare compute totals (e.g. "yds"),
  // derived from the query itself — App.tsx only gets a command string back
  // from QueryBuilder, not typed sport/stat state, so this is resolved fresh
  // per query the same way extractMatchDetails resolves match statLabels.
  const [queryResultsStatLabel, setQueryResultsStatLabel] = useState('')
  const [h2hResult, setH2hResult] = useState<H2hPayload | null>(null)
  const [matchupResult, setMatchupResult] = useState<MatchupInsightPayload | null>(null)
  const [isMatchupOpen, setIsMatchupOpen] = useState(false)
  const [pitchResult, setPitchResult] = useState<MlbPitchH2hPayload | null>(null)
  const [fpvResult, setFpvResult] = useState<MlbPitchFpvPayload | null>(null)
  const [batTeamResult, setBatTeamResult] = useState<MlbBatTeamPayload | null>(null)
  const [teamOverviewResult, setTeamOverviewResult] = useState<MlbTeamOverviewPayload | null>(null)
  const [reportLeaderboardResult, setReportLeaderboardResult] = useState<MlbReportLeaderboardPayload | null>(null)
  const [playerReportResult, setPlayerReportResult] = useState<MlbPlayerReportPayload | null>(null)
  const [nflExplosiveResult, setNflExplosiveResult] = useState<NflExplosivePayload | null>(null)
  const [explosiveOverviewResult, setExplosiveOverviewResult] = useState<ExplosiveOverviewPayload | null>(null)
  const [parlayResult, setParlayResult] = useState<NflParlayPayload | null>(null)
  const [playerLegsResult, setPlayerLegsResult] = useState<NflPlayerLegsPayload | null>(null)
  const [playerSlotsResult, setPlayerSlotsResult] = useState<NflPlayerSlotsPayload | null>(null)
  const [teamSlotsResult, setTeamSlotsResult] = useState<NflTeamSlotsPayload | null>(null)
  const [overviewScopesResult, setOverviewScopesResult] = useState<NflOverviewScopesPayload | null>(null)
  const [overviewStatNResult, setOverviewStatNResult] = useState<NflOverviewStatNPayload | null>(null)
  const [hrResult, setHrResult] = useState<MlbHrPayload | null>(null)
  const [firstPaResult, setFirstPaResult] = useState<MlbFirstPaTrendPayload | null>(null)
  const [teamRunsResult, setTeamRunsResult] = useState<MlbTeamRunsPayload | null>(null)
  const [lastQuery, setLastQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [expandedPlayers, setExpandedPlayers] = useState<Record<string, boolean>>({})
  const [hitlistEntries, setHitlistEntries] = useState<HitlistEntry[]>(hitlistData as HitlistEntry[])
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [builderPosition, setBuilderPosition] = useState({
    x: Math.max(16, Math.floor(window.innerWidth / 2 - 320)),
    // ~16% down from the top — center/top-half of the screen rather than
    // hugging the very top edge. Safe to push down because the panel's own
    // maxHeight (below) now actually accounts for this offset instead of
    // assuming the panel starts at y=0.
    y: Math.max(48, Math.floor(window.innerHeight * 0.16)),
  })
  const [isBuilderDragging, setIsBuilderDragging] = useState(false)
  const [builderDragOffset, setBuilderDragOffset] = useState({ x: 0, y: 0 })
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(true)
  const [isMobileLeaderboardOpen, setIsMobileLeaderboardOpen] = useState(false)
  // Score is hidden inline on the mobile leaderboard (no room for it next to
  // a full player name on a phone width) — tapping a row reveals it instead.
  const mobileLeaderboardRows = useExpandableRows()
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false)
  const [isH2hStaffOpen, setIsH2hStaffOpen] = useState(false)
  const leaderboard = leaderboardData as unknown as LeaderboardPayload
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  // Player-search dropdown, doubled up on the same input as the CLI (see
  // looksLikePlayerSearch above) — {database} has no static nav entry point,
  // this is the only way to reach a player's page short of a direct URL.
  const [playerSearchActiveIndex, setPlayerSearchActiveIndex] = useState(0)
  // PLAYER_INDEX now loads from a live fetch (GET /database/index) instead
  // of a build-time glob, so it's empty on first render — bump this once
  // loadPlayerIndex() resolves so playerMatches recomputes even if the user
  // already finished typing before the fetch came back.
  const [isPlayerIndexReady, setIsPlayerIndexReady] = useState(false)
  useEffect(() => {
    loadPlayerIndex().then(() => setIsPlayerIndexReady(true))
  }, [])
  // Strict: the typed text (or the part after "nspe {sport}") really does
  // look like just a player's name — no flags, no extra "vs TEAM" tokens.
  // This alone drives Enter's "go straight to the profile" behavior below;
  // it must NOT include the loose fallback, or typing a full command that
  // merely CONTAINS a player's name (e.g. "james wood vs det") would hijack
  // Enter into navigating away instead of running that command.
  const strictPlayerMatches = useMemo(() => {
    let matches: ReturnType<typeof searchPlayers> = []
    const { sport, rest } = stripSportPrefix(searchValue)
    if (looksLikePlayerSearch(searchValue)) matches = searchPlayers(searchValue, 8)
    // Sport already typed ("nspe nfl saquon") — see stripSportPrefix's
    // comment for why the whole-string check above misses this case.
    else if (rest && looksLikePlayerSearch(rest)) matches = searchPlayers(rest, 8)
    return sport ? matches.filter((m) => !m.entry.sport || m.entry.sport === sport) : matches
  }, [searchValue, isPlayerIndexReady])
  // Loose: falls back to searchPlayersLoose (junk-tolerant) only when the
  // strict search above found nothing — this is what actually renders the
  // cyan profile dropdown, so it still surfaces a player's profile as a
  // selectable option even inside a full command like "... vs det" or
  // "derrick henry -slots -ov -career". Selecting it (click, or arrow +
  // Enter) still navigates — only the bare, no-navigation Enter keypress
  // treats a loose-only match as "not a deliberate profile request."
  const playerMatches = useMemo(() => {
    if (strictPlayerMatches.length > 0) return strictPlayerMatches
    const { sport, rest } = stripSportPrefix(searchValue)
    const loose = searchPlayersLoose(rest, 8)
    return sport ? loose.filter((m) => !m.entry.sport || m.entry.sport === sport) : loose
  }, [searchValue, strictPlayerMatches, isPlayerIndexReady])
  // True only once the user has actually pressed an arrow key to browse the
  // player dropdown — a deliberate "I want to pick from this list" signal,
  // as opposed to Enter being pressed the instant a loose match happens to
  // exist. Reset to false on every real keystroke (see the input onChange
  // handlers) and on any programmatic fill.
  const [playerNavTouched, setPlayerNavTouched] = useState(false)
  // Same "deliberate keyboard browsing" gate as playerNavTouched, for the
  // green {psc} dropdown — Enter only ever fills/selects a suggestion when
  // the user actually arrowed to it; a bare Enter always runs whatever is
  // literally typed, the same as clicking {search}. This is what used to be
  // missing: a full, self-typed command that also happened to keyword-match
  // the catalog would get silently replaced by the top suggestion on Enter
  // instead of running.
  const [syntaxNavTouched, setSyntaxNavTouched] = useState(false)
  // Any curated commands that showcase one of the currently-matched players
  // (e.g. typing "mahomes" surfaces "nspe nfl long mahomes -ov" alongside
  // his profile match) — shown as a second, stacked dropdown beneath the
  // player matches rather than replacing them, since the two are answering
  // different questions ("here's his profile" vs "here's a popular query
  // that uses him").
  const playerSpotlightMatches = useMemo(
    () =>
      playerMatches.length > 0
        ? rankByKeywords(
            findPlayerSpotlightCommands(
              playerMatches[0].entry.name,
              playerMatches[0].entry.sport,
              playerMatches[0].entry.team,
              playerMatches[0].entry.position,
              searchValue,
            ),
            searchValue,
          )
        : [],
    [playerMatches, searchValue],
  )
  // Predictive command-syntax suggestions (Option B: curated templates,
  // filtered by prefix/substring — see syntaxSuggestions.ts) — the exact
  // inverse trigger of playerMatches, since a query only ever looks like one
  // or the other, never both. Selecting one fills the input for editing, it
  // never runs/navigates on its own.
  const [syntaxActiveIndex, setSyntaxActiveIndex] = useState(0)
  // Selecting a suggestion fills the input with that exact command, which
  // would otherwise still self-match on the very next render (the dropdown
  // never actually closes, blocking the search button underneath it on
  // mobile). This suppresses matching right after a selection; any real
  // keystroke afterward (the input's onChange) clears it again.
  const [suppressSyntaxDropdown, setSuppressSyntaxDropdown] = useState(false)
  const syntaxMatches = useMemo(
    () =>
      searchValue.trim() && !looksLikePlayerSearch(searchValue) && !suppressSyntaxDropdown
        ? searchSyntax(searchValue)
        : [],
    [searchValue, suppressSyntaxDropdown],
  )
  // This week's real matchup slate (dynamic — derived from schedule data,
  // not a static catalog entry) — checked independently of
  // looksLikePlayerSearch entirely, so it surfaces regardless of which mode
  // the rest of the dropdown is in: alongside player matches for "ma" (a
  // real prefix of both "matchup" and player names like Mahomes), or on its
  // own for "matc"/"matchup" where no player happens to match.
  const matchupSuggestions = useMemo(() => getMatchupSuggestions(searchValue), [searchValue])
  // The single green-dropdown payload, covering all three cases: player
  // matches exist (their spotlight commands + the matchup slate, stacked
  // beneath the cyan player dropdown), real syntax matches exist (those,
  // matchup slate not needed since a real command match already won), or
  // neither (falls back to just the matchup slate, e.g. "matc").
  // Keyword pass: every word in every catalog command is a keyword, and
  // anything unrecognized in what was typed is ignored — so "axc derrick" or
  // "how many tds does derrick henry have this season" still surface commands
  // containing the words we DO recognize. Only used when the strict
  // prefix/substring match found nothing, or (below) to append related
  // generic commands after a matched player's own.
  // Native-sport preference: when the query names a sport explicitly
  // ("nspe mlb ..."), keyword suggestions stay MLB-first (only spilling
  // into other sports if MLB truly has nothing) — same idea whether or not
  // a player also matched, so the sport comes from whichever is relevant:
  // the matched player's own sport when one exists, otherwise whatever the
  // user typed.
  const typedSport = stripSportPrefix(searchValue).sport
  const keywordMatches = useMemo(
    () =>
      searchValue.trim() && !suppressSyntaxDropdown
        ? searchKeywords(searchValue, playerMatches[0]?.entry.sport ?? typedSport)
        : [],
    [searchValue, suppressSyntaxDropdown, playerMatches, typedSport],
  )
  const greenMatches = suppressSyntaxDropdown
    ? []
    : playerMatches.length > 0
    ? [
        ...playerSpotlightMatches,
        ...keywordMatches
          .filter((k) => !playerSpotlightMatches.some((p) => p.displayCommand === k.displayCommand))
          .slice(0, 8),
        ...matchupSuggestions,
      ]
    : syntaxMatches.length > 0
    ? syntaxMatches
    : keywordMatches.length > 0
    ? keywordMatches
    : matchupSuggestions
  const searchInputRef = useRef<HTMLInputElement>(null)
  // Mobile only — tapping outside the search input/dropdown dismisses
  // whichever dropdown is open. Separate from suppressSyntaxDropdown above
  // (which only ever targets the syntax dropdown, right after a selection):
  // this also covers the player-search dropdown, and resets on refocus (not
  // just on typing), so tapping back into the input with the same text
  // still-typed repopulates the dropdown normally rather than requiring the
  // user to retype something to bring it back.
  const [isMobileDropdownDismissed, setIsMobileDropdownDismissed] = useState(false)
  const mobileSearchContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (mobileSearchContainerRef.current && !mobileSearchContainerRef.current.contains(e.target as Node)) {
        setIsMobileDropdownDismissed(true)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])
  // Desktop equivalent — the dropdown previously had no outside-click
  // dismissal at all on desktop, so clicking anywhere else on the page left
  // it sitting open.
  const [isDesktopDropdownDismissed, setIsDesktopDropdownDismissed] = useState(false)
  const desktopSearchContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (desktopSearchContainerRef.current && !desktopSearchContainerRef.current.contains(e.target as Node)) {
        setIsDesktopDropdownDismissed(true)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])
  const sampleMenuRef = useRef<HTMLDivElement>(null)
  const miniRef = useRef<HTMLDivElement>(null)
  const builderRef = useRef<HTMLDivElement>(null)
  const tickerRef = useRef<HTMLDivElement>(null)

  const tickerText = hitlistEntries
    .map(formatTickerEntry)
    .join('    ★    ')

  // Continuous ticker scroll driven by requestAnimationFrame.
  // 3 copies are rendered; we translate by exactly one copy's width then wrap modulo,
  // so the strip never restarts visibly. Speed is constant pixels-per-second.
  useEffect(() => {
    const el = tickerRef.current
    if (!el) return

    const PIXELS_PER_SECOND = 70
    let offset = 0
    let lastTime = performance.now()
    let rafId = 0

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000
      lastTime = now
      const copyWidth = el.scrollWidth / 3
      if (copyWidth > 0) {
        offset = (offset + PIXELS_PER_SECOND * dt) % copyWidth
        el.style.transform = `translateX(${-offset}px)`
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [tickerText])

  const runQuery = async (query: string) => {
    const sanitizedQuery = sanitizeQueryForApi(query)

    setIsLoading(true)
    setLastQuery(sanitizedQuery || query.trim())
    setQueryError(null)
    setExpandedPlayers({})
    setIsH2hStaffOpen(false)
    setH2hResult(null)
    setIsMatchupOpen(false)
    setMatchupResult(null)
    setPitchResult(null)
    setFpvResult(null)
    setBatTeamResult(null)
    setTeamOverviewResult(null)
    setReportLeaderboardResult(null)
    setPlayerReportResult(null)
    setNflExplosiveResult(null)
    setExplosiveOverviewResult(null)
    setParlayResult(null)
    setPlayerLegsResult(null)
    setPlayerSlotsResult(null)
    setTeamSlotsResult(null)
    setOverviewScopesResult(null)
    setOverviewStatNResult(null)
    setHrResult(null)
    setFirstPaResult(null)
    setTeamRunsResult(null)

    if (!sanitizedQuery) {
      setQueryResults([])
      setQueryError('Enter a valid query.')
      setIsLoading(false)
      return
    }

    try {
      const { response, url } = await fetchFirstSuccessful(
        RUN_ENDPOINTS,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Attach the Supabase JWT when the user is signed in. The /run gate
            // is still commented out on the backend, so anonymous requests keep
            // working until the backend flips it on.
            ...authHeader(),
          },
          body: JSON.stringify({ query: sanitizedQuery }),
        },
        // -parlay/-legs build a whole slate server-side and run far longer than
        // an ordinary query, so they get a much longer ceiling.
        /(^|\s)-(parlay|legs)\b/.test(sanitizedQuery) ? 120000 : 12000,
      )

      const payload = await parseApiPayload(response)

      console.log('Query response:', payload, 'via', url)

      const h2hPayload = extractH2hPayload(payload)
      if (h2hPayload) {
        setH2hResult(h2hPayload)
        setQueryResults([])
        // -staff carries a real table's worth of extra data (a pitcher-by-
        // pitcher breakdown) that doesn't fit the compact floating results
        // panel — escalate to the full-screen overlay instead. Plain h2h
        // (no staff_breakdown) keeps using the panel unchanged, since it
        // already reads fine there.
        if (h2hPayload.staff_breakdown) {
          setIsMiniOpen(false)
          setIsH2hStaffOpen(true)
        }
        return
      }

      const matchupPayload = extractMatchupInsightPayload(payload)
      if (matchupPayload) {
        setMatchupResult(matchupPayload)
        setQueryResults([])
        setIsMiniOpen(false)
        setIsMatchupOpen(true)
        return
      }

      const pitchPayload = extractMlbPitchH2hPayload(payload)
      if (pitchPayload) {
        setPitchResult(pitchPayload)
        setQueryResults([])
        return
      }

      const fpvPayload = extractMlbPitchFpvPayload(payload)
      if (fpvPayload) {
        setFpvResult(fpvPayload)
        setQueryResults([])
        return
      }

      const batTeamPayload = extractMlbBatTeamPayload(payload)
      if (batTeamPayload) {
        setBatTeamResult(batTeamPayload)
        setQueryResults([])
        return
      }

      const teamOverviewPayload = extractMlbTeamOverviewPayload(payload)
      if (teamOverviewPayload) {
        setTeamOverviewResult(teamOverviewPayload)
        setQueryResults([])
        return
      }

      const reportLeaderboardPayload = extractMlbReportLeaderboardPayload(payload)
      if (reportLeaderboardPayload) {
        setReportLeaderboardResult(reportLeaderboardPayload)
        setQueryResults([])
        return
      }

      const playerReportPayload = extractMlbPlayerReportPayload(payload)
      if (playerReportPayload) {
        setPlayerReportResult(playerReportPayload)
        setQueryResults([])
        return
      }

      const hrPayload = extractMlbHrPayload(payload)
      if (hrPayload) {
        setHrResult(hrPayload)
        setQueryResults([])
        return
      }

      const firstPaPayload = extractMlbFirstPaTrendPayload(payload)
      if (firstPaPayload) {
        setFirstPaResult(firstPaPayload)
        setQueryResults([])
        return
      }

      const teamRunsPayload = extractMlbTeamRunsPayload(payload)
      if (teamRunsPayload) {
        setTeamRunsResult(teamRunsPayload)
        setQueryResults([])
        return
      }

      // NFL explosive (play-by-play long plays)
      if (isNflExplosivePayload(payload)) {
        setNflExplosiveResult(payload)
        setQueryResults([])
        return
      }

      // NFL parlay builder / single-player legs
      const parlayPayload = extractNflParlayPayload(payload)
      if (parlayPayload) {
        setParlayResult(parlayPayload)
        setQueryResults([])
        return
      }
      const playerLegsPayload = extractNflPlayerLegsPayload(payload)
      if (playerLegsPayload) {
        setPlayerLegsResult(playerLegsPayload)
        setQueryResults([])
        return
      }

      // NFL primetime slots (player table / team record)
      const playerSlotsPayload = extractNflPlayerSlotsPayload(payload)
      if (playerSlotsPayload) {
        setPlayerSlotsResult(playerSlotsPayload)
        setQueryResults([])
        return
      }
      const teamSlotsPayload = extractNflTeamSlotsPayload(payload)
      if (teamSlotsPayload) {
        setTeamSlotsResult(teamSlotsPayload)
        setQueryResults([])
        return
      }

      // NFL explosive-play overview (single player, distance-bucketed bar chart)
      const explosiveOverviewPayload = extractExplosiveOverviewPayload(payload)
      if (explosiveOverviewPayload) {
        setExplosiveOverviewResult(explosiveOverviewPayload)
        setQueryResults([])
        return
      }

      // NFL q1/1h overview (flat per-game totals, no distance buckets — see
      // nspe-payloads.ts's comment on why this isn't part of the engine
      // family above despite sharing the "-ov" command suffix)
      const overviewScopesPayload = extractNflOverviewScopesPayload(payload)
      if (overviewScopesPayload) {
        setOverviewScopesResult(overviewScopesPayload)
        setQueryResults([])
        return
      }

      // NFL -statN overview (e.g. "nfl dak 1h -yds150 -ov -career") — a
      // third -ov shape, single player/threshold with its own match list,
      // not a generic trend row (see nspe-payloads.ts's comment)
      const overviewStatNPayload = extractNflOverviewStatNPayload(payload)
      if (overviewStatNPayload) {
        setOverviewStatNResult(overviewStatNPayload)
        setQueryResults([])
        return
      }

      // Block non-explosive NFL queries that the REST API routes to the wrong
      // handler. The response arrives as {exit_code, output: "json_string"} where
      // the inner JSON has an array query without "long" and threshold: 0 for all
      // results. Intercept before normalizeQueryResults shows garbage players.
      if (!Array.isArray(payload) && payload && typeof payload === 'object') {
        const outputStr = (payload as Record<string, unknown>).output
        if (typeof outputStr === 'string') {
          try {
            const inner = JSON.parse(outputStr) as Record<string, unknown>
            const _inner = inner // reserved for future envelope checks
            void _inner
          } catch { /* output is not JSON */ }
        }
      }

      const normalized = normalizeQueryResults(payload, sanitizedQuery)
      const enriched = normalized.map((r) =>
        r.team ? r : { ...r, team: resolvePlayerTeam(r.player) }
      )
      const payloadError = getPayloadError(payload)
      const statCtx = detectStatContext(payload, sanitizedQuery)
      setQueryResultsStatLabel(statCtx ? statCtx.unitLabel ?? STAT_DISPLAY_LABELS[statCtx.stat] ?? statCtx.stat : '')
      setQueryResults(enriched)

      if (payloadError) {
        setQueryError(payloadError)
      } else if (normalized.length === 0) {
        // If backend returned plain stdout with no structured envelope, surface it.
        const rec = (payload && typeof payload === 'object' && !Array.isArray(payload))
          ? (payload as Record<string, unknown>)
          : null
        const stdout = rec && typeof rec.output === 'string' ? rec.output.trim() : ''
        setQueryError(stdout || 'Connected to API, but response contained no recognizable result rows.')
      }
    } catch (error) {
      console.error('Query error:', error)
      setQueryResults([])
      setQueryError(formatQueryError(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const generateStars = () => {
      const newStars: Star[] = []
      const density = 217
      
      for (let i = 0; i < density; i++) {
        newStars.push({
          char: STARFIELD_CHARS[Math.floor(Math.random() * STARFIELD_CHARS.length)],
          x: Math.random() * 100,
          y: Math.random() * 100,
          color: TERMINAL_COLORS[Math.floor(Math.random() * TERMINAL_COLORS.length)],
          opacity: 0.3 + Math.random() * 0.5,
        })
      }
      
      setStars(newStars)
    }

    generateStars()
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (miniRef.current && e.target === e.currentTarget) {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - miniPosition.x,
        y: e.clientY - miniPosition.y,
      })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setMiniPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  const handleBuilderMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsBuilderDragging(true)
      setBuilderDragOffset({
        x: e.clientX - builderPosition.x,
        y: e.clientY - builderPosition.y,
      })
    }
  }

  useEffect(() => {
    if (!isBuilderDragging) return

    const move = (e: MouseEvent) => {
      const x = Math.max(0, Math.min(window.innerWidth - 240, e.clientX - builderDragOffset.x))
      const y = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - builderDragOffset.y))
      setBuilderPosition({ x, y })
    }
    const up = () => setIsBuilderDragging(false)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [isBuilderDragging, builderDragOffset])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsMiniOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sampleMenuRef.current && !sampleMenuRef.current.contains(e.target as Node)) {
        setIsSampleMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const runSearchFromInput = () => {
    if (!searchValue.trim()) {
      return
    }

    const trimmedQuery = searchValue.trim().toLowerCase()

    if (trimmedQuery === 'help') {
      setQueryResults(null)
      setH2hResult(null)
      setIsMatchupOpen(false)
      setMatchupResult(null)
      setPitchResult(null)
      setBatTeamResult(null)
      setLastQuery('')
      setQueryError(null)
      setIsMiniOpen(true)
    } else {
      runQuery(searchValue.trim())
      setIsMiniOpen(true)
    }
  }

  const handleRunFromBuilder = (query: string) => {
    setSearchValue('')
    setIsBuilderOpen(false)
    runQuery(query)
    setIsMiniOpen(true)
  }

  const goToPlayerProfile = (slug: string) => {
    setSearchValue('')
    setPlayerNavTouched(false)
    setSyntaxNavTouched(false)
    navigate(`/database/${slug}`)
  }

  // Fills the input for editing (statN/lastN/N/minN values, etc.) — never
  // runs or navigates on its own, per the explicit design call: users must
  // still hit search themselves after customizing the template's values.
  const selectSyntaxSuggestion = (command: string) => {
    setSearchValue(command)
    setSyntaxActiveIndex(0)
    setPlayerSearchActiveIndex(0)
    setPlayerNavTouched(false)
    setSyntaxNavTouched(false)
    setSuppressSyntaxDropdown(true)
    // Close BOTH dropdowns immediately, not just the green one — the filled
    // command text often still loosely matches a player (e.g. "... vs det"
    // still finds that player), which used to leave the cyan profile
    // dropdown sitting open after a selection. Cleared again by the next
    // real keystroke, same as the outside-click dismissal.
    setIsMobileDropdownDismissed(true)
    setIsDesktopDropdownDismissed(true)
    searchInputRef.current?.focus()
  }

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (playerMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setPlayerNavTouched(true)
        setPlayerSearchActiveIndex((i) => (i + 1) % playerMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setPlayerNavTouched(true)
        setPlayerSearchActiveIndex((i) => (i - 1 + playerMatches.length) % playerMatches.length)
        return
      }
      if (e.key === 'Enter') {
        // Only treat Enter as "go to the profile" when that's a deliberate
        // choice — a strict, name-only match (the classic "type a name, hit
        // enter" flow), or the user has actually arrowed through this list.
        // A loose-only match (the typed text is a fuller command that merely
        // contains a player's name, e.g. "james wood vs det" or "derrick
        // henry -slots -ov -career") falls through to run the typed command
        // instead, same as clicking {search} — the whole point of that
        // command was never "show me the profile."
        if (strictPlayerMatches.length > 0 || playerNavTouched) {
          e.preventDefault()
          const match = playerMatches[playerSearchActiveIndex] ?? playerMatches[0]
          goToPlayerProfile(match.entry.slug)
          return
        }
      }
      if (e.key === 'Escape') {
        setSearchValue('')
        return
      }
    }
    if (playerMatches.length === 0 && greenMatches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSyntaxNavTouched(true)
        setSyntaxActiveIndex((i) => (i + 1) % greenMatches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSyntaxNavTouched(true)
        setSyntaxActiveIndex((i) => (i - 1 + greenMatches.length) % greenMatches.length)
        return
      }
      if (e.key === 'Enter' && syntaxNavTouched) {
        // Only fires once the user has actually arrowed to a suggestion —
        // a bare Enter with no navigation falls through below and runs
        // whatever is literally typed, same as clicking {search}.
        e.preventDefault()
        const match = greenMatches[syntaxActiveIndex] ?? greenMatches[0]
        selectSyntaxSuggestion(match.displayCommand)
        return
      }
      if (e.key === 'Escape') {
        setSearchValue('')
        return
      }
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      runSearchFromInput()
    }
  }

  const handleSampleCommandSelect = (command: string) => {
    setIsSampleMenuOpen(false)

    if (isMobile) {
      if (!command.trim()) {
        return
      }

      setSearchValue(command)
      runQuery(command)
      setIsMiniOpen(true)
      return
    }

    setSearchValue(command)

    window.requestAnimationFrame(() => {
      if (!searchInputRef.current) {
        return
      }

      searchInputRef.current.focus()
      const cursorPosition = command.length
      searchInputRef.current.setSelectionRange(cursorPosition, cursorPosition)
    })
  }

  const togglePlayerExpanded = (player: string) => {
    setExpandedPlayers((prev) => ({
      ...prev,
      [player]: !prev[player],
    }))
  }

  return (
    <div className="relative w-screen h-screen bg-background overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {stars.map((star, index) => (
          <span
            key={index}
            className="absolute text-[12px] font-mono select-none"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              color: star.color,
              opacity: star.opacity,
            }}
          >
            {star.char}
          </span>
        ))}
      </div>

      <div
        className={
          isMobile
            ? 'absolute top-2 left-3 z-20 flex flex-col items-start gap-1 font-mono text-[11px]'
            : 'absolute top-6 left-6 z-20 flex flex-col items-start gap-1 font-mono text-[14px]'
        }
      >
        {isMobile ? (
          <span
            className="flex items-center gap-2 whitespace-nowrap"
            style={{ color: 'oklch(0.95 0 0)', fontWeight: 700 }}
          >
            <span>
              nspe.dev{' '}
              <span style={{ color: 'oklch(0.75 0.15 145)' }}>{'{preview}'}</span>
            </span>
          </span>
        ) : (
          <span style={{ color: 'oklch(0.95 0 0)', fontWeight: 700 }}>
            nspe.dev{' '}
            <span style={{ color: 'oklch(0.75 0.15 145)' }}>{'{preview}'}</span>
          </span>
        )}
        {isMobile && (
          <button
            onClick={() => setIsSampleQueriesOpen(true)}
            className="font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.65 0.12 145)' }}
          >
            {'{sample-queries}'}
          </button>
        )}
        {isMobile && (
          <button
            onClick={() => setIsTutorialOpen(true)}
            className="font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.78 0.18 145)' }}
            aria-label="Open tutorial"
          >
            {'{tutorial}'}
          </button>
        )}
      </div>

      <div
        className={
          isMobile
            ? 'absolute top-6 right-3 z-20 flex items-center gap-2 whitespace-nowrap'
            : 'absolute top-6 right-6 z-20 flex items-center gap-3'
        }
        ref={sampleMenuRef}
      >
        {/* {tutorial} and {sample-queries} moved down next to {glossary} —
            see the bottom-row group near the leaderboard panel. */}
        {!isMobile && (
          <a
            href="/nfl.season"
            className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.85 0.15 195)' }}
          >
            {'{nfl.season}'}
          </a>
        )}
        {!isMobile && (
          <a
            href="/charts"
            className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.85 0.15 195)' }}
          >
            {'{charts}'}
          </a>
        )}

        {/* Mobile drops {sign-up} — {log-in} leads to the same place ("don't
            have an account? sign up") — and uses the slot for {charts}. */}
        {isMobile ? (
          <a
            href="/charts"
            className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.85 0.15 195)' }}
          >
            {'{charts}'}
          </a>
        ) : (
          <a
            href="/signup"
            className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.85 0.15 195)' }}
          >
            {'{sign-up}'}
          </a>
        )}

        <a
          href="/login"
          className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
          style={{ color: 'oklch(0.85 0.15 195)' }}
        >
          {'{log-in}'}
        </a>
      </div>

      <QueryBuilderTutorial open={isTutorialOpen} onClose={() => setIsTutorialOpen(false)} />
      <SampleQueriesModal open={isSampleQueriesOpen} onClose={() => setIsSampleQueriesOpen(false)} />
      <H2hStaffOverlay open={isH2hStaffOpen} onClose={() => setIsH2hStaffOpen(false)} payload={h2hResult} />
      <MatchupInsightOverlay open={isMatchupOpen} onClose={() => setIsMatchupOpen(false)} payload={matchupResult} />
      {/* {sample-commands}'s scripted-typing demo is shelved (not deleted) in
          favor of {sample-queries} above — no entry point triggers this open
          anymore, kept mounted only so it's easy to revisit later. */}
      <AutoDemo
        open={isSampleDemoOpen}
        onClose={() => setIsSampleDemoOpen(false)}
        renderResults={(results, command) => {
          const sanitized = sanitizeQueryForApi(command)
          const sport = sanitized.split(/\s+/)[0]
          const payload = { sport, query: sanitized, results } as Record<string, unknown>
          const MAX_DEMO_ROWS = 7

          // NFL explosive trend (contains 'long') — or NFL compute with value/games shape
          const firstR = results[0] as Record<string, unknown> | undefined
          const isNflCompute = sport === 'nfl' && firstR?.value != null && firstR?.games != null
          if (isNflExplosivePayload(payload) || isNflCompute) {
            return <NflExplosiveView payload={payload as NflExplosivePayload} />
          }

          // Shape B: matches array contains full game-stat objects (no 'val' shortcut)
          const firstMatch = Array.isArray(firstR?.matches) && (firstR!.matches as unknown[]).length > 0
            ? (firstR!.matches as Record<string, unknown>[])[0]
            : null
          const isFullGameStats = firstMatch != null && !('val' in firstMatch) && !('yards' in firstMatch)
          if (isFullGameStats) {
            const rows = results.slice(0, MAX_DEMO_ROWS)
            const overflow = results.length - MAX_DEMO_ROWS
            return (
              <div>
                {rows.map((row, i) => {
                  if (!row || typeof row !== 'object') return null
                  const r = row as Record<string, unknown>
                  const player = normalizeDisplayPlayer(String(r.player ?? ''))
                  const met = Number(r.met_count ?? r.met ?? 0)
                  const matches = Array.isArray(r.matches) ? (r.matches as Record<string, unknown>[]) : []
                  const matchLine = matches.slice(0, 3)
                    .map((m) => {
                      const v = demoMatchValue(m, sanitized)
                      const d = demoMatchDate(m)
                      return v != null && d ? `${v} ${d}` : null
                    })
                    .filter(Boolean)
                    .join('  ·  ')
                  return (
                    <div key={i} className="py-1.5 border-b" style={{ borderColor: 'oklch(0.22 0 0)' }}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[13px]" style={{ color: 'oklch(0.90 0.18 195)' }}>{player}</span>
                        <span className="font-mono text-[13px]">
                          <span className="font-bold" style={{ color: 'oklch(0.85 0.15 145)' }}>met={met}</span>
                        </span>
                      </div>
                      {matchLine && (
                        <div className="mt-0.5 pl-2 font-mono text-[11px]" style={{ color: 'oklch(0.65 0 0)' }}>
                          {matchLine}
                        </div>
                      )}
                    </div>
                  )
                })}
                {overflow > 0 && <div className="pt-1.5 font-mono text-[11px]" style={{ color: 'oklch(0.48 0 0)' }}>+ {overflow} more</div>}
              </div>
            )
          }

          // Standard (NBA / MLB / NHL / NFL per-game) — simplified {val,date} match shape
          const normalized = normalizeQueryResults(payload, sanitized).slice(0, MAX_DEMO_ROWS)
          const overflow = results.length - MAX_DEMO_ROWS
          if (normalized.length === 0) {
            return <div className="font-mono text-[12px]" style={{ color: 'oklch(0.48 0 0)' }}>no results</div>
          }
          const demoStatCtx = detectStatContext(payload, sanitized)
          const demoStatLabel = demoStatCtx ? demoStatCtx.unitLabel ?? STAT_DISPLAY_LABELS[demoStatCtx.stat] ?? demoStatCtx.stat : ''
          return (
            <div>
              {normalized.map((result, i) => {
                const isTrendRow = result.hasMatchArray ?? Boolean(result.matchDetails && result.matchDetails.length > 0)
                const isSingleDayWindow = isTrendRow && result.windowSize === 1 && result.matchDetails?.length === 1
                const badge = isSingleDayWindow
                  ? `${result.matchDetails![0].value}${result.matchDetails![0].statLabel} ${result.matchDetails![0].date}`
                  : isTrendRow
                  ? `met=${result.total}`
                  : demoStatLabel
                  ? `${result.total}${demoStatLabel}`
                  : result.total
                return (
                <div key={i} className="py-1.5 border-b" style={{ borderColor: 'oklch(0.22 0 0)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[13px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
                      {result.player}
                    </span>
                    <span
                      className="font-mono font-bold text-[13px] ml-4 shrink-0 px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'oklch(0.22 0 0)', color: 'oklch(0.85 0.15 145)' }}
                    >
                      {badge}
                    </span>
                  </div>
                  {result.matchDetails && result.matchDetails.length > 0 && (
                    <div className="mt-0.5 pl-2 font-mono text-[11px]" style={{ color: 'oklch(0.65 0 0)' }}>
                      {result.matchDetails.map((m) => `${m.value}${m.statLabel} ${m.date}`).join('  ·  ')}
                    </div>
                  )}
                </div>
                )
              })}
              {overflow > 0 && (
                <div className="pt-1.5 font-mono text-[11px]" style={{ color: 'oklch(0.48 0 0)' }}>
                  + {overflow} more
                </div>
              )}
            </div>
          )
        }}
      />

      {false && isMobile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.78)', whiteSpace: 'normal' }}
          role="dialog"
          aria-modal="true"
          aria-label="Sample commands"
        >
          <div
            className="w-full max-w-[640px] max-h-[92vh] overflow-y-auto rounded-lg"
            style={{
              backgroundColor: 'oklch(0.12 0 0)',
              border: '1px solid oklch(0.28 0 0)',
              color: 'oklch(0.88 0 0)',
              fontFamily: 'monospace',
              whiteSpace: 'normal',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-3 sticky top-0"
              style={{
                backgroundColor: 'oklch(0.18 0 0)',
                borderBottom: '1px solid oklch(0.28 0 0)',
              }}
            >
              <span
                className="font-mono font-bold text-[14px]"
                style={{ color: 'oklch(0.85 0.15 195)' }}
              >
                {'{sample-commands}'}
              </span>
              <button
                type="button"
                onClick={() => setIsSampleMenuOpen(false)}
                className="font-mono text-[14px] hover:opacity-70 transition-opacity"
                style={{ color: 'oklch(0.85 0.15 195)' }}
                aria-label="Close sample commands"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <div
                className="text-[11px] leading-relaxed mb-3"
                style={{ color: 'oklch(0.48 0 0)' }}
              >
                Tap a command to prefill the search bar.
              </div>
              <div className="flex flex-col gap-1">
                {SAMPLE_COMMANDS.map((sample) => (
                  <button
                    key={sample.label}
                    type="button"
                    onClick={() => !sample.comingSoon && handleSampleCommandSelect(sample.command)}
                    disabled={Boolean(sample.comingSoon)}
                    className="block w-full rounded px-3 py-3 text-left font-mono text-[13px] transition-opacity"
                    style={{
                      color: sample.comingSoon ? 'oklch(0.56 0 0)' : 'oklch(0.90 0.18 195)',
                      backgroundColor: sample.comingSoon ? 'transparent' : 'oklch(0.18 0 0)',
                      opacity: sample.comingSoon ? 0.8 : 1,
                      cursor: sample.comingSoon ? 'not-allowed' : 'pointer',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                    }}
                  >
                    {sample.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isMiniOpen && (
        <div
          ref={miniRef}
          className={isMobile
            ? 'fixed inset-x-2 top-2 z-30 rounded-lg shadow-2xl overflow-hidden'
            : 'absolute z-30 w-[620px] max-h-[62vh] rounded-lg shadow-2xl overflow-hidden'
          }
          style={isMobile
            ? { maxHeight: 'calc(100dvh - 80px)', backgroundColor: 'oklch(0.15 0 0)', border: '1px solid oklch(0.30 0 0)' }
            : { left: `${miniPosition.x}px`, top: `${miniPosition.y}px`, backgroundColor: 'oklch(0.15 0 0)', border: '1px solid oklch(0.30 0 0)' }
          }
        >
          <div
            className="flex items-center justify-between px-5 py-3 cursor-move select-none"
            style={{ backgroundColor: 'oklch(0.18 0 0)', borderBottom: '1px solid oklch(0.30 0 0)' }}
            onMouseDown={handleMouseDown}
          >
            <span className="font-mono font-bold text-[14px]" style={{ color: 'oklch(0.85 0.15 195)' }}>
              {h2hResult
                ? `${lastQuery} — h2h`
                : pitchResult
                ? `${lastQuery} — pitch`
                : batTeamResult
                ? `${lastQuery} — team`
                : reportLeaderboardResult
                ? `${lastQuery} — report`
                : playerReportResult
                ? `${lastQuery} — player report`
                : nflExplosiveResult
                ? `${lastQuery} — explosive`
                : parlayResult
                ? `${lastQuery} — parlay`
                : playerLegsResult
                ? `${lastQuery} — legs`
                : playerSlotsResult
                ? `${lastQuery} — slots`
                : teamSlotsResult
                ? `${lastQuery} — team slots`
                : explosiveOverviewResult
                ? `${lastQuery} — explosive overview`
                : overviewScopesResult
                ? `${lastQuery} — overview`
                : overviewStatNResult
                ? `${lastQuery} — overview`
                : hrResult
                ? `${lastQuery} — hr`
                : firstPaResult
                ? `${lastQuery} — first pa`
                : teamRunsResult
                ? `${lastQuery} — team runs`
                : queryResults
                ? `${lastQuery} — ${queryResults.length}results`
                : 'NSPE — Command Legend'}
            </span>
            <button
              onClick={() => setIsMiniOpen(false)}
              className="font-mono text-[14px] hover:opacity-70 transition-opacity"
              style={{ color: 'oklch(0.85 0.15 195)' }}
            >
              ✕
            </button>
          </div>

          <div className={`overflow-y-auto px-5 py-4 space-y-3 ${isMobile ? 'max-h-[calc(100dvh-130px)]' : 'max-h-[calc(62vh-50px)]'}`}>
            {isLoading ? (
              <div className="text-center py-8 font-mono text-[13px]" style={{ color: 'oklch(0.70 0 0)' }}>
                <LoadingMessage query={lastQuery} />
              </div>
            ) : h2hResult ? (
              <H2hView payload={h2hResult} />
            ) : pitchResult ? (
              <MlbPitchH2hView payload={pitchResult} query={lastQuery} />
            ) : fpvResult && SHOW_PITCHER_FPV ? (
              <MlbPitchFpvView payload={fpvResult} />
            ) : batTeamResult ? (
              <MlbBatTeamView payload={batTeamResult} />
            ) : teamOverviewResult ? (
              <MlbTeamOverviewView payload={teamOverviewResult} />
            ) : reportLeaderboardResult ? (
              <MlbReportLeaderboardView payload={reportLeaderboardResult} />
            ) : playerReportResult ? (
              <MlbPlayerReportView payload={playerReportResult} />
            ) : nflExplosiveResult ? (
              <NflExplosiveView payload={nflExplosiveResult} />
            ) : parlayResult ? (
              <NflParlayView payload={parlayResult} />
            ) : playerLegsResult ? (
              <NflPlayerLegsView payload={playerLegsResult} />
            ) : playerSlotsResult ? (
              <NflPlayerSlotsView payload={playerSlotsResult} />
            ) : teamSlotsResult ? (
              <NflTeamSlotsView payload={teamSlotsResult} />
            ) : explosiveOverviewResult ? (
              <ExplosiveOverviewView payload={explosiveOverviewResult} />
            ) : overviewScopesResult ? (
              <NflOverviewScopesView payload={overviewScopesResult} />
            ) : overviewStatNResult ? (
              <NflOverviewStatNView payload={overviewStatNResult} query={lastQuery} />
            ) : hrResult ? (
              <MlbHrView payload={hrResult} />
            ) : firstPaResult ? (
              <MlbFirstPaTrendView payload={firstPaResult} />
            ) : teamRunsResult ? (
              <MlbTeamRunsView payload={teamRunsResult} />
            ) : queryResults === null ? (
              <div className="text-center py-8 font-mono text-[13px]" style={{ color: 'oklch(0.70 0 0)' }}>
                Build a query to begin
              </div>
            ) : queryResults.length === 0 ? (
              <div className="text-center py-8 font-mono text-[13px] space-y-2" style={{ color: 'oklch(0.70 0 0)' }}>
                <div>No results found</div>
                {queryError && <div>{queryError}</div>}
              </div>
            ) : (
              queryResults.map((result, index) => {
                const hasStreakDetails = Boolean(result.streakDetails && result.streakDetails.length > 0)
                const hasMatchDetails = Boolean(result.matchDetails && result.matchDetails.length > 0)
                // Trend rows report how many games met the threshold —
                // "met=N", never a stat unit (that number isn't a stat
                // total). Only a bare compute total gets "N unit". Keyed off
                // hasMatchArray (did the raw row have a per-game match array
                // at all), NOT hasMatchDetails — some trend-shaped engines'
                // per-match values don't parse yet (see QueryResult's
                // hasMatchArray doc), and a parsing gap must never make a
                // trend row look like a compute row.
                const isTrendRow = result.hasMatchArray ?? hasMatchDetails
                // A single-day window (-yst) only ever has one possible
                // match — "met=1" is meaningless (there was only one day to
                // check). Show that match's value+date directly instead, and
                // skip the expand affordance since there's nothing further
                // to drill into beyond what the badge already shows.
                const isSingleDayWindow = isTrendRow && result.windowSize === 1 && result.matchDetails?.length === 1
                const canExpand = !isSingleDayWindow && (hasStreakDetails || hasMatchDetails)
                // Collapsed by default — only expands once a user explicitly
                // asks for the full per-game breakdown, rather than jumbling
                // every qualifying game into the row up front. Backend match
                // arrays are chronological ascending in every shape seen so
                // far (h2h, HR trend, first-PA), so the last element is the
                // most recent game.
                const isExpanded = canExpand ? Boolean(expandedPlayers[result.player]) : false
                const latestMatch = hasMatchDetails ? result.matchDetails![result.matchDetails!.length - 1] : null
                // Streak-only rows (mode: -streakN, e.g. "trend-streak")
                // have no match array at all — isTrendRow is false for
                // them, and result.total is just the backend's raw streak
                // *count* (almost always 1), not a stat value. Showing
                // "1tb" there is meaningless — every row reads identically
                // regardless of how long the actual streak was. Show the
                // most recent streak's length/dates instead, same "latest
                // wins" convention as match-based trends.
                const latestStreak = hasStreakDetails ? result.streakDetails![result.streakDetails!.length - 1] : null
                const resultBadge = isSingleDayWindow
                  ? `${result.matchDetails![0].value}${result.matchDetails![0].statLabel} ${result.matchDetails![0].date}`
                  : isTrendRow && latestMatch
                  ? `${latestMatch.value}${latestMatch.statLabel} ${latestMatch.date}`
                  : isTrendRow
                  ? // Per-match values didn't parse (e.g. -rr/-pr/-any combo
                    // stats — see the conversation this was flagged in), so
                    // there's no latest-match value/date to show. met=N/window
                    // stays the safe fallback rather than fabricating a unit —
                    // the window is included so the scope isn't lost just
                    // because the per-match breakdown didn't parse.
                    formatMet(result.total, result.windowSize)
                  : !isTrendRow && latestStreak
                  ? `${latestStreak.length} game streak`
                  : queryResultsStatLabel
                  ? `${result.total}${queryResultsStatLabel}`
                  : result.total
                // A tiny lowercase header sits above the badge so "the number
                // on the right" is never ambiguous between a met-count and an
                // actual stat value — only shown when the badge itself is a
                // value/date (met=N alone, or a bare compute total, already
                // reads fine standalone).
                const resultBadgeHeader = isSingleDayWindow
                  ? 'latest'
                  : isTrendRow && latestMatch
                  ? `${formatMet(result.total, result.windowSize)} · latest`
                  : !isTrendRow && latestStreak
                  ? `${latestStreak.start} - ${latestStreak.end}`
                  : null

                return (
                  <ResultRow
                    key={index}
                    label={
                      <>
                        {result.team ? (
                          <>
                            <span style={{ color: 'oklch(0.70 0.10 195)' }}>{result.team}</span>
                            <span style={{ color: 'oklch(0.55 0 0)' }}>{' — '}</span>
                          </>
                        ) : null}
                        {result.player}
                      </>
                    }
                    badgeHeader={resultBadgeHeader}
                    badgeValue={String(resultBadge)}
                    expanded={isExpanded}
                    onToggle={canExpand ? () => togglePlayerExpanded(result.player) : undefined}
                    ariaLabel={canExpand ? `Toggle details for ${result.player}` : undefined}
                  >
                    {hasStreakDetails && result.streakDetails && (
                      <>
                        {result.streakDetails.map((detail, detailIndex) => (
                          <div
                            key={`${result.player}-streak-${detailIndex}`}
                            className="font-mono text-[12px]"
                            style={{ color: 'oklch(0.76 0 0)' }}
                          >
                            {`${detail.length} game streak ${detail.start} - ${detail.end}`}
                          </div>
                        ))}
                      </>
                    )}

                    {hasMatchDetails && result.matchDetails && (
                      <div className="font-mono text-[12px]" style={{ color: 'oklch(0.76 0 0)' }}>
                        {isTrendRow && (
                          <span style={{ color: 'oklch(0.55 0 0)' }}>{formatMet(result.total, result.windowSize)} — </span>
                        )}
                        {result.matchDetails
                          .map((m) => `${m.value}${m.statLabel} ${m.date}`)
                          .join(', ')}
                      </div>
                    )}
                  </ResultRow>
                )
              })
            )}
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-start h-screen pt-[40vh]">
        <div className="w-[65%] max-w-4xl min-w-[320px] px-4">
          {isMobile ? (
            <div className="flex flex-col items-center gap-3">
              {/* Same CLI-doubling input as desktop (searchValue,
                  looksLikePlayerSearch, playerMatches) — mobile no longer
                  gets a player-search-only input, nspe commands run here
                  too, same as desktop. Stacked layout instead of desktop's
                  single row: input+run on one line, {calculator}/{charts}
                  below. */}
              <div className="relative w-full" ref={mobileSearchContainerRef}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value)
                    setPlayerSearchActiveIndex(0)
                    setPlayerNavTouched(false)
                    setSyntaxActiveIndex(0)
                    setSyntaxNavTouched(false)
                    setSuppressSyntaxDropdown(false)
                    setIsMobileDropdownDismissed(false)
                  }}
                  onFocus={() => setIsMobileDropdownDismissed(false)}
                  onKeyDown={handleSearchSubmit}
                  className="w-full h-[52px] px-5 py-3 bg-card text-foreground font-mono text-[16px] rounded-lg border border-border outline-none focus:border-primary transition-colors duration-200"
                />
                {!searchValue && (
                  <div
                    className="absolute inset-0 flex items-center px-5 pointer-events-none font-mono text-[16px] text-muted-foreground"
                    style={{ opacity: 0.5 }}
                  >
                    {PLACEHOLDER_TEXTS[0]}
                  </div>
                )}
                {(playerMatches.length > 0 || greenMatches.length > 0) && !isMobileDropdownDismissed && (
                  <div className="absolute top-[60px] left-0 right-0 z-20 flex flex-col gap-2">
                    {playerMatches.length > 0 && (
                      <PlayerSearchDropdown
                        matches={playerMatches}
                        activeIndex={playerSearchActiveIndex}
                        onHoverIndex={setPlayerSearchActiveIndex}
                        onSelect={(entry) => goToPlayerProfile(entry.slug)}
                      />
                    )}
                    {greenMatches.length > 0 && (
                      <SyntaxSuggestionDropdown
                        matches={greenMatches}
                        activeIndex={playerMatches.length === 0 ? syntaxActiveIndex : -1}
                        onHoverIndex={playerMatches.length === 0 ? setSyntaxActiveIndex : undefined}
                        onSelect={selectSyntaxSuggestion}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={runSearchFromInput}
                  className="h-[52px] shrink-0 rounded-lg border border-border px-6 font-mono text-[14px] hover:opacity-80 transition-opacity"
                  style={{ color: 'oklch(0.90 0.18 195)', boxShadow: SEARCH_GLOW }}
                >
                  search
                </button>
                {/* {calculator} removed from mobile nav — paused indefinitely
                    pending a design rework (see the conversation this was
                    decided in). Route stays live at /calculator, just
                    unlinked, same shelve-don't-delete pattern as {database}/
                    {sample-commands}. QueryBuilder (already built, desktop-
                    proven) fills the gap for now via the same mobile
                    full-screen bottom-sheet-turned-takeover below. */}
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(true)}
                  className="h-[52px] shrink-0 rounded-lg border px-6 font-mono text-[14px] hover:opacity-80 transition-opacity"
                  style={{ color: 'oklch(0.85 0.15 195)', borderColor: 'oklch(0.85 0.15 195)' }}
                >
                  build
                </button>
              </div>
            </div>
          ) : (
            // {cli}{search}{build} in one symmetric row — {database} has no
            // static nav entry point, this input doubles as the player
            // search (see looksLikePlayerSearch): typing a name opens a
            // dropdown of matches below the input instead of sending
            // anything to the backend; typing actual nspe syntax behaves
            // exactly as before. {charts} removed from this row (still live
            // at /charts, just not linked from the homepage).
            <div className="flex items-center gap-3">
              <div className="relative flex-1" ref={desktopSearchContainerRef}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => {
                    setSearchValue(e.target.value)
                    setPlayerSearchActiveIndex(0)
                    setPlayerNavTouched(false)
                    setSyntaxActiveIndex(0)
                    setSyntaxNavTouched(false)
                    setSuppressSyntaxDropdown(false)
                    setIsDesktopDropdownDismissed(false)
                  }}
                  onFocus={() => setIsDesktopDropdownDismissed(false)}
                  onKeyDown={handleSearchSubmit}
                  className="w-full h-[52px] px-5 py-3 bg-card text-foreground font-mono text-[16px] rounded-lg border border-border outline-none focus:border-primary transition-colors duration-200"
                  style={{
                    opacity: 1,
                  }}
                />
                {!searchValue && (
                  <div
                    className="absolute inset-0 flex items-center px-5 pointer-events-none font-mono text-[16px] text-muted-foreground"
                    style={{ opacity: 0.5 }}
                  >
                    {PLACEHOLDER_TEXTS[0]}
                  </div>
                )}
                {(playerMatches.length > 0 || greenMatches.length > 0) && !isDesktopDropdownDismissed && (
                  <div className="absolute top-[60px] left-0 right-0 z-20 flex flex-col gap-2">
                    {playerMatches.length > 0 && (
                      <PlayerSearchDropdown
                        matches={playerMatches}
                        activeIndex={playerSearchActiveIndex}
                        onHoverIndex={setPlayerSearchActiveIndex}
                        onSelect={(entry) => goToPlayerProfile(entry.slug)}
                      />
                    )}
                    {greenMatches.length > 0 && (
                      <SyntaxSuggestionDropdown
                        matches={greenMatches}
                        activeIndex={playerMatches.length === 0 ? syntaxActiveIndex : -1}
                        onHoverIndex={playerMatches.length === 0 ? setSyntaxActiveIndex : undefined}
                        onSelect={selectSyntaxSuggestion}
                      />
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={runSearchFromInput}
                className="h-[52px] shrink-0 rounded-lg border border-border px-5 font-mono text-[14px] hover:opacity-80 transition-opacity"
                style={{ color: 'oklch(0.90 0.18 195)', boxShadow: SEARCH_GLOW }}
              >
                search
              </button>

              <button
                type="button"
                onClick={() => setIsBuilderOpen(true)}
                className="h-[52px] shrink-0 rounded-lg border px-5 font-mono text-[14px] hover:opacity-80 transition-opacity"
                style={{ color: 'oklch(0.85 0.15 195)', borderColor: 'oklch(0.85 0.15 195)' }}
              >
                build
              </button>
            </div>
          )}

          {/* Shown on both platforms now — was mobile-only "build your own
              query" before; replaced with a direct nudge toward the CLI
              itself now that it doubles as player search + predictive
              syntax on both platforms. Desktop-only: nudged left so the "s"
              in "search" lines up under the "W" in "{WORLD}" from the
              placeholder above — measured offset (~97px), not eyeballed.
              Mobile stays centered, narrower width makes an offset like
              this look arbitrary rather than deliberate. */}
          <div className={`mt-6 ${isMobile ? 'text-center' : 'text-left'}`} style={isMobile ? undefined : { paddingLeft: '97px' }}>
            <p className="font-mono text-[14px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
              search a player or type: nspe
            </p>
          </div>
        </div>
      </div>

      {/* Query builder — full-screen takeover on mobile (matching /calculator's
          own full-viewport page feel, per request, rather than a partial
          bottom sheet), draggable floating panel on desktop. */}
      {isBuilderOpen && isMobile && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'oklch(0.08 0 0)' }}>
          <div
            className="flex items-center gap-3 px-4 pt-4 pb-3 flex-none"
            style={{ borderBottom: '1px solid oklch(0.28 0 0)' }}
          >
            <button
              type="button"
              onClick={() => setIsBuilderOpen(false)}
              className="font-mono text-[13px] px-3 py-2 rounded-lg border flex-none"
              style={{ backgroundColor: 'oklch(0.15 0 0)', borderColor: 'oklch(0.28 0 0)', color: 'oklch(0.88 0 0)' }}
            >
              ‹ back
            </button>
            <span className="font-mono font-bold text-[13px]" style={{ color: 'oklch(0.85 0.15 195)' }}>
              {'{build}'}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <QueryBuilder
              onRunQuery={handleRunFromBuilder}
              isLoading={isLoading}
              popularPlayers={(leaderboard?.rows ?? []).slice(0, 20).map((r) => ({ player: r.player, team: r.team }))}
            />
          </div>
        </div>
      )}

      {isBuilderOpen && !isMobile && (
        <div
          ref={builderRef}
          className="fixed z-50 rounded-lg overflow-hidden shadow-2xl"
          style={{
            left: `${builderPosition.x}px`,
            top: `${builderPosition.y}px`,
            width: '640px',
            // Was a flat `calc(100vh - 40px)` regardless of where the panel
            // actually sits — on a viewport where the panel opens well below
            // y=0 (as it always has, and now does even more deliberately),
            // that let the panel claim more height than the space actually
            // remaining below it, which is exactly what forced an internal
            // scroll to reach the run button even when the content itself
            // was short enough to fit. Now genuinely bounded by the
            // remaining viewport space below the panel's own top offset.
            maxHeight: `calc(100vh - ${builderPosition.y}px - 20px)`,
            backgroundColor: 'oklch(0.13 0 0)',
            border: '1px solid oklch(0.30 0 0)',
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-2.5 cursor-move select-none"
            style={{
              backgroundColor: 'oklch(0.18 0 0)',
              borderBottom: '1px solid oklch(0.30 0 0)',
            }}
            onMouseDown={handleBuilderMouseDown}
          >
            <span
              className="font-mono font-bold text-[13px] pointer-events-none"
              style={{ color: 'oklch(0.85 0.15 195)' }}
            >
              {'{query builder}'}
              <span
                className="ml-2 font-normal"
                style={{ color: 'oklch(0.55 0 0)', fontSize: '10px', letterSpacing: '0.1em' }}
              >
                DRAG TO MOVE
              </span>
            </span>
            <button
              onClick={() => setIsBuilderOpen(false)}
              className="font-mono text-[14px] hover:opacity-70 transition-opacity"
              style={{ color: 'oklch(0.85 0.15 195)' }}
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: `calc(100vh - ${builderPosition.y}px - 64px)` }}>
            <QueryBuilder
              onRunQuery={handleRunFromBuilder}
              isLoading={isLoading}
              popularPlayers={(leaderboard?.rows ?? []).slice(0, 20).map((r) => ({ player: r.player, team: r.team }))}
            />
          </div>
        </div>
      )}

      <img
        src={madeitLogo}
        alt="NSPE Footer Logo Left"
        className="absolute bottom-[42px] left-4 z-10 pointer-events-none"
        style={{
          width: '38.5px',
          height: '63px',
          maxWidth: '38.5px',
          maxHeight: '63px',
          objectFit: 'contain',
        }}
      />

      {/* {tutorial} and {sample-queries}, formerly in the top-right nav —
          a flex group with gap rather than individually guessed pixel
          offsets per label, so it doesn't need re-tuning if either label
          changes length. {glossary} removed (nav entry only — its modal/
          state is still in this file, just unreachable, same shelve pattern
          as {sample-commands}/{database} until the tutorial/howto rework
          replaces it). */}
      {!isMobile && (
        <div className="absolute z-20 flex items-center gap-4" style={{ bottom: '52px', right: '440px' }}>
          <button
            type="button"
            onClick={() => setIsTutorialOpen(true)}
            className="font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.78 0.18 145)' }}
          >
            {'{tutorial}'}
          </button>
          <button
            type="button"
            onClick={() => setIsSampleQueriesOpen(true)}
            className="font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.65 0.12 145)' }}
          >
            {'{sample-queries}'}
          </button>
        </div>
      )}

      {!isMobile && leaderboard?.rows?.length > 0 && (
        <div
          className="absolute right-4 z-20 rounded-md overflow-hidden"          style={{
            bottom: '44px',
            width: '420px',
            backgroundColor: 'oklch(0.12 0 0)',
            border: '1px solid oklch(0.28 0 0)',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.45)',
            fontFamily: 'monospace',
          }}
        >
          <button
            type="button"
            onClick={() => setIsLeaderboardOpen((p) => !p)}
            className="w-full flex items-center justify-between px-3 py-2 hover:opacity-90 transition-opacity"
            style={{
              backgroundColor: 'oklch(0.18 0 0)',
              borderBottom: isLeaderboardOpen ? '1px solid oklch(0.28 0 0)' : 'none',
              cursor: 'pointer',
            }}
            title={isLeaderboardOpen ? 'collapse leaderboard' : 'expand leaderboard'}
          >
            <span className="flex items-baseline gap-2">
              <span className="font-mono font-bold text-[13px]" style={{ color: 'oklch(0.85 0.15 195)' }}>
                {'{leaderboard}'}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: 'oklch(0.55 0 0)' }}>
                {leaderboardSportLabel(leaderboard.kind)} · top {leaderboard.rows.length}
              </span>
            </span>
            <span className="flex items-baseline gap-2">
              {!isLeaderboardOpen && leaderboard.rows[0] && (
                <span className="font-mono text-[11px]" style={{ color: 'oklch(0.75 0 0)' }}>
                  #1 {normalizeLeaderboardPlayer(leaderboard.rows[0].player)} {leaderboard.rows[0].score.toFixed(1)}
                </span>
              )}
              <span className="font-mono text-[10px]" style={{ color: 'oklch(0.48 0 0)' }}>
                {formatLeaderboardDate(leaderboard.generated_at)}
              </span>
              <span className="font-mono text-[11px]" style={{ color: 'oklch(0.85 0.15 195)' }}>
                {isLeaderboardOpen ? '▾' : '▸'}
              </span>
            </span>
          </button>
          {isLeaderboardOpen && (
            <div
              className="overflow-y-auto"
              style={{ maxHeight: '210px', backgroundColor: 'oklch(0.10 0 0)' }}
            >
              <div
                className="grid items-center px-3 py-1 font-mono text-[10px] uppercase tracking-widest sticky top-0"
                style={{
                  gridTemplateColumns: '22px 1fr 36px 84px 56px',
                  gap: '8px',
                  backgroundColor: 'oklch(0.14 0 0)',
                  borderBottom: '1px solid oklch(0.20 0 0)',
                  color: 'oklch(0.42 0 0)',
                }}
              >
                <span>#</span>
                <span>player</span>
                <span>tm</span>
                <span>stat(streak)</span>
                <span className="text-right">score</span>
              </div>
              {leaderboard.rows.map((row, idx) => {
                const rank = String(idx + 1).padStart(2, '0')
                const player = normalizeLeaderboardPlayer(row.player)
                const star = idx < 3 ? '★' : ' '
                return (
                  <div
                    key={`${row.player}-${idx}`}
                    className="grid items-center px-3 py-1.5 font-mono text-[12px]"
                    style={{
                      gridTemplateColumns: '22px 1fr 36px 84px 56px',
                      gap: '8px',
                      borderBottom: idx === leaderboard.rows.length - 1 ? 'none' : '1px solid oklch(0.16 0 0)',
                      color: 'oklch(0.85 0 0)',
                    }}
                  >
                    <span style={{ color: 'oklch(0.48 0 0)' }}>{rank}</span>
                    <span className="truncate" style={{ color: 'oklch(0.92 0 0)' }}>{player}</span>
                    <span style={{ color: 'oklch(0.55 0 0)' }}>{row.team}</span>
                    <span style={{ color: 'oklch(0.85 0.15 195)' }}>
                      {row.streak_label}({row.streak_length}){star}
                    </span>
                    <span className="text-right" style={{ color: 'oklch(0.78 0.18 145)', fontWeight: 600 }}>
                      {row.score.toFixed(1)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {isMobile && leaderboard?.rows?.length > 0 && (
        <button
          type="button"
          onClick={() => setIsMobileLeaderboardOpen(true)}
          className="absolute z-20 font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
          style={{
            bottom: '46px',
            right: '12px',
            color: 'oklch(0.85 0.15 195)',
          }}
          aria-label="Open leaderboard"
        >
          {'{leaderboard}'}
        </button>
      )}

      {/* Mobile: {nfl.season} sits next to {leaderboard} (desktop has it in the
          top-right nav); {tutorial} moved to the top-left under
          {sample-queries}. */}
      {isMobile && (
        <a
          href="/nfl.season"
          className="absolute z-20 font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
          style={{
            bottom: '46px',
            right: leaderboard?.rows?.length > 0 ? '128px' : '12px',
            color: 'oklch(0.85 0.15 195)',
          }}
          aria-label="Open NFL season"
        >
          {'{nfl.season}'}
        </a>
      )}

      {isMobile && isMobileLeaderboardOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.78)', whiteSpace: 'normal' }}
          onClick={() => setIsMobileLeaderboardOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Leaderboard"
        >
          <div
            className="w-full max-w-[640px] max-h-[92vh] overflow-y-auto rounded-lg"
            style={{
              backgroundColor: 'oklch(0.12 0 0)',
              border: '1px solid oklch(0.28 0 0)',
              color: 'oklch(0.88 0 0)',
              fontFamily: 'monospace',
              whiteSpace: 'normal',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-3 sticky top-0"
              style={{
                backgroundColor: 'oklch(0.18 0 0)',
                borderBottom: '1px solid oklch(0.28 0 0)',
              }}
            >
              <span className="flex items-baseline gap-2">
                <span
                  className="font-mono font-bold text-[14px]"
                  style={{ color: 'oklch(0.85 0.15 195)' }}
                >
                  {'{leaderboard}'}
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-widest"
                  style={{ color: 'oklch(0.55 0 0)' }}
                >
                  {leaderboardSportLabel(leaderboard.kind)} · top {leaderboard.rows.length}
                </span>
              </span>
              <span className="flex items-baseline gap-3">
                <span
                  className="font-mono text-[10px]"
                  style={{ color: 'oklch(0.48 0 0)' }}
                >
                  {formatLeaderboardDate(leaderboard.generated_at)}
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileLeaderboardOpen(false)}
                  className="font-mono text-[14px] hover:opacity-70 transition-opacity"
                  style={{ color: 'oklch(0.85 0.15 195)' }}
                  aria-label="Close leaderboard"
                >
                  ✕
                </button>
              </span>
            </div>
            <div style={{ backgroundColor: 'oklch(0.10 0 0)' }}>
              <div
                className="grid items-center px-4 py-1 font-mono text-[10px] uppercase tracking-widest sticky top-0"
                style={{
                  gridTemplateColumns: '22px 1fr 36px 84px',
                  gap: '8px',
                  backgroundColor: 'oklch(0.14 0 0)',
                  borderBottom: '1px solid oklch(0.20 0 0)',
                  color: 'oklch(0.42 0 0)',
                }}
              >
                <span>#</span>
                <span>player</span>
                <span>tm</span>
                <span>stat(streak)</span>
              </div>
              {leaderboard.rows.map((row, idx) => {
                const rank = String(idx + 1).padStart(2, '0')
                const player = normalizeLeaderboardPlayer(row.player)
                const star = idx < 3 ? '★' : ' '
                const expanded = mobileLeaderboardRows.isExpanded(idx)
                return (
                  <div
                    key={`m-${row.player}-${idx}`}
                    onClick={() => mobileLeaderboardRows.toggle(idx)}
                    className="px-4 py-2 font-mono text-[12px] cursor-pointer"
                    style={{
                      borderBottom:
                        idx === leaderboard.rows.length - 1
                          ? 'none'
                          : '1px solid oklch(0.16 0 0)',
                      color: 'oklch(0.85 0 0)',
                    }}
                  >
                    <div
                      className="grid items-center"
                      style={{ gridTemplateColumns: '22px 1fr 36px 84px', gap: '8px' }}
                    >
                      <span style={{ color: 'oklch(0.48 0 0)' }}>{rank}</span>
                      <span className="truncate" style={{ color: 'oklch(0.92 0 0)' }}>
                        {player}
                      </span>
                      <span style={{ color: 'oklch(0.55 0 0)' }}>{row.team}</span>
                      <span style={{ color: 'oklch(0.85 0.15 195)' }}>
                        {row.streak_label}({row.streak_length}){star}
                      </span>
                    </div>
                    {expanded && (
                      <div
                        className="flex items-center justify-between mt-1.5 pt-1.5"
                        style={{ borderTop: '1px solid oklch(0.18 0 0)' }}
                      >
                        <span className="text-[10px] uppercase tracking-widest" style={{ color: 'oklch(0.42 0 0)' }}>
                          score
                        </span>
                        <span style={{ color: 'oklch(0.78 0.18 145)', fontWeight: 600 }}>
                          {row.score.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {isGlossaryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.78)', whiteSpace: 'normal' }}
          onClick={() => setIsGlossaryOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Glossary"
        >
          <div
            className="w-full max-w-[680px] max-h-[92vh] overflow-y-auto rounded-lg"
            style={{
              backgroundColor: 'oklch(0.12 0 0)',
              border: '1px solid oklch(0.28 0 0)',
              color: 'oklch(0.88 0 0)',
              fontFamily: 'monospace',
              whiteSpace: 'normal',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-5 py-3 sticky top-0"
              style={{
                backgroundColor: 'oklch(0.18 0 0)',
                borderBottom: '1px solid oklch(0.28 0 0)',
              }}
            >
              <span
                className="font-mono font-bold text-[14px]"
                style={{ color: 'oklch(0.85 0.15 195)' }}
              >
                {'{glossary}'}
              </span>
              <button
                type="button"
                onClick={() => setIsGlossaryOpen(false)}
                className="font-mono text-[14px] hover:opacity-70 transition-opacity"
                style={{ color: 'oklch(0.85 0.15 195)' }}
                aria-label="Close glossary"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {GLOSSARY_STATS.map((group) => (
                <section key={group.sport}>
                  <div
                    className="font-mono text-[12px] uppercase tracking-widest mb-2"
                    style={{ color: 'oklch(0.78 0.18 145)' }}
                  >
                    {`{${group.sport} stats}`}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    {group.entries.map((e) => (
                      <div key={e.term} className="font-mono text-[12px] flex gap-2">
                        <span
                          className="shrink-0"
                          style={{ color: 'oklch(0.90 0.18 195)', minWidth: '92px' }}
                        >
                          {e.term}
                        </span>
                        <span style={{ color: 'oklch(0.82 0 0)' }}>{e.meaning}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              <section>
                <div
                  className="font-mono text-[12px] uppercase tracking-widest mb-2"
                  style={{ color: 'oklch(0.78 0.18 145)' }}
                >
                  {'{query syntax}'}
                </div>
                <div className="grid grid-cols-1 gap-y-1.5">
                  {GLOSSARY_QUERY.map((e) => (
                    <div key={e.term} className="font-mono text-[12px] flex gap-2">
                      <span
                        className="shrink-0"
                        style={{ color: 'oklch(0.90 0.18 195)', minWidth: '110px' }}
                      >
                        {e.term}
                      </span>
                      <span style={{ color: 'oklch(0.82 0 0)' }}>{e.meaning}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div
                  className="font-mono text-[12px] uppercase tracking-widest mb-2"
                  style={{ color: 'oklch(0.78 0.18 145)' }}
                >
                  {'{leaderboard}'}
                </div>
                <div className="grid grid-cols-1 gap-y-1.5 mb-3">
                  {GLOSSARY_LEADERBOARD.map((e) => (
                    <div key={e.term} className="font-mono text-[12px] flex gap-2">
                      <span
                        className="shrink-0"
                        style={{ color: 'oklch(0.90 0.18 195)', minWidth: '110px' }}
                      >
                        {e.term}
                      </span>
                      <span style={{ color: 'oklch(0.82 0 0)' }}>{e.meaning}</span>
                    </div>
                  ))}
                </div>
                <div
                  className="font-mono text-[11px] mb-2"
                  style={{ color: 'oklch(0.62 0 0)' }}
                >
                  Streak labels (mlb):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                  {GLOSSARY_STREAK_LABELS.map((e) => (
                    <div key={e.term} className="font-mono text-[12px] flex gap-2">
                      <span
                        className="shrink-0"
                        style={{ color: 'oklch(0.90 0.18 195)', minWidth: '60px' }}
                      >
                        {e.term}
                      </span>
                      <span style={{ color: 'oklch(0.82 0 0)' }}>{e.meaning}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* {hitlist} ticker — border and background now match {leaderboard}'s
          header bar (oklch(0.28 0 0) border, oklch(0.18 0 0) fill) instead
          of a plain 1px line over a transparent strip, which let the
          starfield show through behind the scrolling text. */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 overflow-hidden pointer-events-none border-t"
        style={{ borderColor: 'oklch(0.28 0 0)', backgroundColor: 'oklch(0.18 0 0)' }}
      >
        <div
          ref={tickerRef}
          className="whitespace-nowrap font-mono text-[13px] py-2"
          style={{
            color: 'oklch(0.85 0.15 195)',
            willChange: 'transform'
          }}
        >
          {tickerText}    ★    {tickerText}    ★    {tickerText}
        </div>
      </div>
    </div>
  )
}

export default App
