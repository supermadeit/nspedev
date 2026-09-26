import { useEffect, useMemo, useState } from 'react'
import { StarsBackground } from '@/components/StarsBackground'
import { getCurrentNflWeek } from '@/lib/nflWeek'
import nflData from '@/assets/data/worldcup.json'
import scheduleData from '@/assets/data/nfl_schedule.json'
import { useIsMobile } from '@/hooks/use-mobile'
import { authHeader } from '@/lib/auth-token'
import { fetchFirstSuccessful, parseApiPayload, RUN_ENDPOINTS } from '@/lib/nspe-api'
import {
  extractMatchupInsightPayload,
  extractPowerRankingsPayload,
  type MatchupInsightPayload,
  type PowerRankingsPayload,
  type PowerRankingsRow,
} from '@/lib/nspe-payloads'
import { MatchupInsightOverlay } from '@/components/MatchupInsightOverlay'

// ---------------- types ----------------

interface NflTeam {
  name: string
  city: string
  abbr: string
  standing: number | null
  wins: number | null
  losses: number | null
  ties: number | null
}

interface NflDivision {
  division: string
  teams: NflTeam[]
}

interface NflConference {
  East: NflDivision
  North: NflDivision
  South: NflDivision
  West: NflDivision
}

interface NflSeasonData {
  season: string
  current_week: number | null
  total_weeks: number
  last_updated: string | null
  conferences: {
    AFC: NflConference
    NFC: NflConference
  }
}

interface Game {
  week: number
  awayTeam: string
  homeTeam: string
  gameTime: string
  gameDate: string
  score_away?: number | null
  score_home?: number | null
}

interface ScheduleData {
  season: number
  totalGames: number
  games: Game[]
}

// ---------------- design tokens ----------------

const C = {
  label:  'oklch(0.55 0 0)',
  value:  'oklch(0.88 0 0)',
  accent: 'oklch(0.85 0.15 195)',
  green:  'oklch(0.85 0.15 145)',
  border: 'oklch(0.28 0 0)',
  panel:  'oklch(0.13 0 0)',
  dim:    'oklch(0.40 0 0)',
}

// ---------------- helpers ----------------

function formatUpdated(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const m = d.getMonth() + 1
  const day = d.getDate()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${m}/${day} ${hh}:${mm}`
}

function wlt(team: NflTeam): string {
  if (team.wins === null) return '—'
  const t = team.ties ?? 0
  return t > 0 ? `${team.wins}-${team.losses}-${t}` : `${team.wins}-${team.losses}`
}

function buildAbbrMap(data: NflSeasonData): Record<string, string> {
  const map: Record<string, string> = {}
  for (const conf of ['AFC', 'NFC'] as const) {
    for (const div of ['East', 'North', 'South', 'West'] as const) {
      for (const team of data.conferences[conf][div].teams) {
        map[team.name] = team.abbr
      }
    }
  }
  return map
}

// Abbreviation -> "Dallas Cowboys", from the same standings file.
function buildFullNameMap(data: NflSeasonData): Record<string, string> {
  const map: Record<string, string> = {}
  for (const conf of ['AFC', 'NFC'] as const) {
    for (const div of ['East', 'North', 'South', 'West'] as const) {
      for (const team of data.conferences[conf][div].teams) {
        map[team.abbr] = `${team.city} ${team.name}`
      }
    }
  }
  return map
}

// ---------------- division panel ----------------

function DivisionPanel({ division }: { division: NflDivision }) {
  const [conf, ...rest] = division.division.split(' ')
  const dir = rest.join(' ')
  return (
    <div
      className="rounded p-2 flex flex-col"
      style={{ backgroundColor: C.panel, border: `1px solid ${C.accent}` }}
    >
      <div className="font-mono text-[10px] uppercase tracking-widest mb-1.5 shrink-0" style={{ color: C.label }}>
        {conf.toLowerCase()} · {dir.toLowerCase()}
      </div>
      <div
        className="grid items-center gap-x-2 pb-1 mb-1 border-b font-mono text-[10px]"
        style={{ gridTemplateColumns: '14px 36px 1fr 60px', color: C.label, borderColor: C.border }}
      >
        <span /><span>team</span><span /><span className="text-right">w-l</span>
      </div>
      <div className="font-mono text-[11px] space-y-[1px]">
        {division.teams.map((team, i) => {
          const rank = team.standing ?? (i + 1)
          const isLeader = rank === 1
          const isPending = team.wins === null
          return (
            <div
              key={team.abbr}
              className="grid items-center gap-x-2 py-[2px]"
              style={{ gridTemplateColumns: '14px 36px 1fr 60px', color: C.value, opacity: isPending ? 0.65 : 1 }}
            >
              <span style={{ color: isLeader ? C.accent : C.dim }}>
                {isPending ? '○' : isLeader ? '●' : '·'}
              </span>
              <span className="font-bold" style={{ color: isLeader ? C.value : C.label }}>{team.abbr}</span>
              <span className="truncate" style={{ color: C.label }}>{team.city} {team.name}</span>
              <span className="text-right tabular-nums" style={{ color: isPending ? C.dim : isLeader ? C.accent : C.value }}>
                {wlt(team)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- divisions view ----------------

function DivisionsView({ conferences }: { conferences: NflSeasonData['conferences'] }) {
  const dirs = ['East', 'North', 'South', 'West'] as const
  return (
    <div className="h-full flex flex-col gap-4">
      {(['AFC', 'NFC'] as const).map((conf) => (
        <div key={conf} className="flex-1 min-h-0 flex flex-col">
          <div className="font-mono text-[10px] uppercase tracking-widest mb-2 shrink-0" style={{ color: C.green }}>
            {conf}
          </div>
          <div className="grid gap-3 flex-1 min-h-0" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {dirs.map((dir) => (
              <DivisionPanel key={dir} division={conferences[conf][dir]} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------- matchup library (shelved) ----------------
// This was the page's PRIMARY content for one session, then superseded when
// power rankings took over that role — see WeekMatchupStrip below for what
// replaced it (a compact horizontal header instead of the full dense table /
// card grid). Left defined-but-unused rather than deleted, same as
// DivisionsView below: the full slate view (with day-grouping and a real
// week nav) is one call-site change away if a "see the whole week" surface
// is wanted again later, e.g. as its own expanded view off the strip.

function MatchupTile({
  game,
  abbrMap,
  onMatchupClick,
}: {
  game: Game
  abbrMap: Record<string, string>
  onMatchupClick: (teamA: string, teamB: string) => void
}) {
  const awayAbbr = abbrMap[game.awayTeam] ?? game.awayTeam.slice(0, 3).toUpperCase()
  const homeAbbr = abbrMap[game.homeTeam] ?? game.homeTeam.slice(0, 3).toUpperCase()
  return (
    <button
      type="button"
      onClick={() => onMatchupClick(awayAbbr, homeAbbr)}
      className="rounded p-3 text-left hover:opacity-80 transition-opacity"
      style={{ backgroundColor: 'oklch(0.10 0 0)', border: `1.5px solid ${C.green}` }}
    >
      {/* Bracket-wrapped like every other actionable command in this app
          ({leaderboard}, {chart}, {nfl.season}, ...) — plain team text here
          read as inert schedule info, not a button, which is what made the
          tap target invisible as an affordance. */}
      <div className="font-mono text-[17px] font-bold" style={{ color: C.accent }}>
        {`{${awayAbbr} @ ${homeAbbr}}`}
      </div>
      <div className="font-mono text-[12px] uppercase tracking-wider mt-1.5" style={{ color: C.label }}>
        {game.gameTime || 'tbd'}
      </div>
    </button>
  )
}

function MatchupTableRow({
  game,
  abbrMap,
  onMatchupClick,
}: {
  game: Game
  abbrMap: Record<string, string>
  onMatchupClick: (teamA: string, teamB: string) => void
}) {
  const awayAbbr = abbrMap[game.awayTeam] ?? game.awayTeam.slice(0, 3).toUpperCase()
  const homeAbbr = abbrMap[game.homeTeam] ?? game.homeTeam.slice(0, 3).toUpperCase()
  return (
    <button
      type="button"
      onClick={() => onMatchupClick(awayAbbr, homeAbbr)}
      className="w-full grid items-center gap-x-3 py-2.5 px-3 rounded text-left hover:opacity-80 transition-opacity"
      style={{ gridTemplateColumns: '90px 100px 1fr 90px' }}
    >
      <span className="font-mono text-[13px] uppercase tracking-wider" style={{ color: C.label }}>
        {game.gameDate || 'tbd'}
      </span>
      <span className="font-mono text-[14px] tabular-nums" style={{ color: C.dim }}>
        {game.gameTime || 'tbd'}
      </span>
      {/* Bracket-wrapped like every other actionable command in this app
          ({leaderboard}, {chart}, {nfl.season}, ...) — plain team text here
          read as inert schedule info, not a button, which is what made the
          tap target invisible as an affordance. */}
      <span className="font-mono text-[17px] font-bold" style={{ color: C.accent }}>
        {`{${awayAbbr} @ ${homeAbbr}}`}
      </span>
      <span className="font-mono text-[13px] text-right" style={{ color: C.dim }}>view →</span>
    </button>
  )
}

function MatchupLibraryView({
  games,
  totalWeeks,
  abbrMap,
  initialWeek,
  onMatchupClick,
}: {
  games: Game[]
  totalWeeks: number
  abbrMap: Record<string, string>
  initialWeek: number
  onMatchupClick: (teamA: string, teamB: string) => void
}) {
  const isMobile = useIsMobile()
  const [week, setWeek] = useState(initialWeek)
  const weekGames = useMemo(() => games.filter((g) => g.week === week), [games, week])
  const byDate = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, Game[]>()
    for (const g of weekGames) {
      const d = g.gameDate || 'TBD'
      if (!map.has(d)) { map.set(d, []); order.push(d) }
      map.get(d)!.push(g)
    }
    return order.map((d) => ({ date: d, games: map.get(d)! }))
  }, [weekGames])

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 mb-5 shrink-0">
        <button type="button" onClick={() => setWeek((w) => Math.max(1, w - 1))} disabled={week === 1}
          className="font-mono text-[22px] hover:opacity-70 transition-opacity disabled:opacity-20" style={{ color: C.accent }}>
          ←
        </button>
        <span className="font-mono text-[18px]" style={{ color: C.value }}>
          week <span style={{ color: C.accent }}>{week}</span>
          <span style={{ color: C.label }}> · {totalWeeks}</span>
        </span>
        <button type="button" onClick={() => setWeek((w) => Math.min(totalWeeks, w + 1))} disabled={week === totalWeeks}
          className="font-mono text-[22px] hover:opacity-70 transition-opacity disabled:opacity-20" style={{ color: C.accent }}>
          →
        </button>
        <span className="font-mono text-[13px]" style={{ color: C.dim }}>{weekGames.length} matchups</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-1">
        {weekGames.length === 0 && (
          <div className="font-mono text-[13px]" style={{ color: C.dim }}>schedule data pending</div>
        )}
        {isMobile ? (
          byDate.map(({ date, games: dGames }) => (
            <div key={date}>
              <div className="font-mono text-[13px] uppercase tracking-widest mb-2" style={{ color: C.label }}>{date}</div>
              <div className="grid grid-cols-2 gap-2">
                {dGames.map((g, i) => <MatchupTile key={i} game={g} abbrMap={abbrMap} onMatchupClick={onMatchupClick} />)}
              </div>
            </div>
          ))
        ) : (
          <div>
            <div
              className="grid items-center gap-x-3 py-1.5 px-3 mb-1 font-mono text-[11px] uppercase tracking-wider"
              style={{ gridTemplateColumns: '90px 100px 1fr 90px', color: C.dim, borderBottom: `1px solid ${C.border}` }}
            >
              <span>day</span><span>time</span><span>matchup</span><span />
            </div>
            {weekGames.map((g, i) => <MatchupTableRow key={i} game={g} abbrMap={abbrMap} onMatchupClick={onMatchupClick} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------- week matchup strip ----------------
// The weekly slate's new role: a compact, static horizontal header instead
// of the page's main content — power rankings took that job over (see
// below). One flat row per week (no day-grouping — that was useful when
// this was the thing to browse, not when it's a glanceable header), same
// week nav as before, same click-through into MatchupInsightOverlay via the
// bracket-button affordance already established.

function WeekMatchupStrip({
  games,
  totalWeeks,
  abbrMap,
  initialWeek,
  onMatchupClick,
}: {
  games: Game[]
  totalWeeks: number
  abbrMap: Record<string, string>
  initialWeek: number
  onMatchupClick: (teamA: string, teamB: string) => void
}) {
  const [week, setWeek] = useState(initialWeek)
  const weekGames = useMemo(() => games.filter((g) => g.week === week), [games, week])

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-3 mb-2">
        <button type="button" onClick={() => setWeek((w) => Math.max(1, w - 1))} disabled={week === 1}
          className="font-mono text-[16px] hover:opacity-70 transition-opacity disabled:opacity-20" style={{ color: C.accent }}>
          ←
        </button>
        <span className="font-mono text-[13px]" style={{ color: C.value }}>
          week <span style={{ color: C.accent }}>{week}</span>
          <span style={{ color: C.label }}> · {totalWeeks}</span>
        </span>
        <button type="button" onClick={() => setWeek((w) => Math.min(totalWeeks, w + 1))} disabled={week === totalWeeks}
          className="font-mono text-[16px] hover:opacity-70 transition-opacity disabled:opacity-20" style={{ color: C.accent }}>
          →
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
        {weekGames.length === 0 && (
          <div className="font-mono text-[12px]" style={{ color: C.dim }}>schedule data pending</div>
        )}
        {weekGames.map((g, i) => {
          const awayAbbr = abbrMap[g.awayTeam] ?? g.awayTeam.slice(0, 3).toUpperCase()
          const homeAbbr = abbrMap[g.homeTeam] ?? g.homeTeam.slice(0, 3).toUpperCase()
          return (
            <button
              key={i}
              type="button"
              onClick={() => onMatchupClick(awayAbbr, homeAbbr)}
              className="shrink-0 rounded px-2.5 py-1.5 text-left hover:opacity-80 transition-opacity"
              style={{ backgroundColor: 'oklch(0.10 0 0)', border: `1px solid ${C.green}` }}
            >
              <div className="font-mono text-[12px] font-bold whitespace-nowrap" style={{ color: C.accent }}>
                {`{${awayAbbr} @ ${homeAbbr}}`}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-wider" style={{ color: C.label }}>
                {g.gameDate || 'tbd'} · {g.gameTime || 'tbd'}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- power rankings ----------------
// `nfl-power-rankings` engine — a backend-computed weekly composite score
// per team. This is now {nfl.rankings}'s PRIMARY content (the layout
// inversion this was rebuilt for — see the conversation this was scoped in:
// power rankings dominates, the weekly slate above is just a glanceable
// strip now). Styled after the existing {leaderboard} panel's row grammar
// (rank/label/secondary/score, same color roles). Desktop keeps the
// no-scroll 16-per-row/2-row layout; mobile gets fewer columns (still no
// separate overlay needed now — this IS the page, not a strip squeezed
// under something else).
// Team tiles are clickable into a team-only overview (record, time of
// possession, red zone %, point margin — no roster, that stays in
// MatchupInsightOverlay's player-level detail) built entirely from this
// same payload's row data, no extra fetch needed.

function formatRecord(row: PowerRankingsRow): string {
  return row.ties ? `${row.wins}-${row.losses}-${row.ties}` : `${row.wins}-${row.losses}`
}

function RankingTile({ row, onSelect }: { row: PowerRankingsRow; onSelect: (team: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(row.team)}
      className="rounded px-3 py-2.5 flex flex-col items-center gap-1.5 text-center hover:opacity-80 transition-opacity"
      style={{ backgroundColor: 'oklch(0.10 0 0)', border: `1px solid ${C.border}` }}
    >
      <div className="flex items-center justify-center gap-2">
        <span className="font-mono text-[16px] font-bold leading-none" style={{ color: 'oklch(0.98 0 0)' }}>{row.rank}</span>
        {/* Team code gets its own bordered box inside the tile. */}
        <span
          className="font-mono text-[22px] font-bold leading-none rounded px-2 py-1"
          style={{ color: C.accent, border: `1px solid ${C.accent}` }}
        >
          {row.team}
        </span>
      </div>
      {/* Record and score stacked on their own lines, centered under the
          team box — sharing one row got tight once the team text above
          grew, and they're different enough concepts (season record vs.
          computed rank score) to not need to compete side by side. */}
      <span className="font-mono text-[12px]" style={{ color: C.label }}>{formatRecord(row)}</span>
      <span className="font-mono text-[16px] font-bold" style={{ color: C.green }}>{row.power_score.toFixed(1)}</span>
    </button>
  )
}

function PowerRankingsGrid({ rows, onSelectTeam }: { rows: PowerRankingsRow[]; onSelectTeam: (team: string) => void }) {
  const isMobile = useIsMobile()
  // Fewer, wider columns than the original 16/4 split — the tiles needed
  // more room once the team text and stacked record/score grew, and with
  // rankings now the page's primary content there's headroom to spend on
  // width instead of forcing everything into one no-scroll block.
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${isMobile ? 3 : 8}, minmax(0, 1fr))` }}>
      {rows.map((row) => <RankingTile key={row.team} row={row} onSelect={onSelectTeam} />)}
    </div>
  )
}

function formatPossession(seconds: number | undefined): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatPct(pct: number | undefined): string {
  return pct == null ? '—' : `${(pct * 100).toFixed(1)}%`
}

function formatMargin(margin: number | undefined): string {
  if (margin == null) return '—'
  return margin > 0 ? `+${margin}` : `${margin}`
}

function TeamOverviewOverlay({
  team,
  fullName,
  onClose,
}: {
  team: PowerRankingsRow | null
  /** "Dallas Cowboys" — falls back to the team code if the lookup misses. */
  fullName?: string
  onClose: () => void
}) {
  if (!team) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.80)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[420px] rounded-lg overflow-hidden shadow-2xl"
        style={{ backgroundColor: 'oklch(0.12 0 0)', border: `1px solid ${C.border}`, fontFamily: 'monospace' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ backgroundColor: 'oklch(0.16 0 0)', borderBottom: `1px solid ${C.border}` }}
        >
          <span className="font-mono font-bold text-[15px]" style={{ color: C.accent }}>
            {`{${(fullName ?? team.team).toUpperCase()}}`}
          </span>
          <span className="flex items-center gap-4">
            {/* Power score lives in the header now (it used to be a stat cell). */}
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.label }}>power</span>
              <span className="font-mono text-[16px] font-bold" style={{ color: C.green }}>{team.power_score.toFixed(1)}</span>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-[16px] hover:opacity-70 transition-opacity"
              style={{ color: C.accent }}
              aria-label="Close"
            >
              ✕
            </button>
          </span>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[12px] uppercase tracking-widest" style={{ color: C.label }}>record</span>
            <span className="font-mono text-[16px] font-bold" style={{ color: C.value }}>{formatRecord(team)}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.label }}>time of poss.</div>
              <div className="font-mono text-[16px] font-bold" style={{ color: C.value }}>{formatPossession(team.avg_possession_seconds as number | undefined)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.label }}>red zone %</div>
              <div className="font-mono text-[16px] font-bold" style={{ color: C.value }}>{formatPct(team.red_zone_pct as number | undefined)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.label }}>pts margin</div>
              <div className="font-mono text-[16px] font-bold" style={{ color: (team.point_margin ?? 0) >= 0 ? C.green : 'oklch(0.75 0.15 30)' }}>
                {formatMargin(team.point_margin)}
              </div>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.label }}>off. 3rd down %</div>
              <div className="font-mono text-[16px] font-bold" style={{ color: C.value }}>{formatPct(team.third_down_pct)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------- playoffs placeholder ----------------

function PlayoffsView() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3">
      <div className="font-mono text-[16px] uppercase tracking-widest" style={{ color: C.dim }}>nfl.playoffs</div>
      <div className="font-mono text-[13px]" style={{ color: C.label }}>playoff bracket · available once seeds are set</div>
    </div>
  )
}

// ---------------- page ----------------

type ActiveView = 'rankings' | 'schedule' | 'playoffs'

export default function WorldCupApp() {
  const data = nflData as unknown as NflSeasonData
  const schedule = scheduleData as unknown as ScheduleData
  const [activeView, setActiveView] = useState<ActiveView>('rankings')
  const abbrMap = useMemo(() => buildAbbrMap(data), [data])
  const fullNames = useMemo(() => buildFullNameMap(data), [data])
  // Schedule tab opens on the active week (data.current_week), not always
  // week 1 — current_week is expected to already reflect the Tuesday-
  // morning rollover backend-side (games run through Monday Night Football,
  // so the "active" week doesn't advance until Tuesday). Clamped in case
  // current_week is ever missing/out of range before a season starts.
  const initialScheduleWeek = getCurrentNflWeek(data.total_weeks, data.current_week)

  const [matchupResult, setMatchupResult] = useState<MatchupInsightPayload | null>(null)
  const [isMatchupOpen, setIsMatchupOpen] = useState(false)
  const [isMatchupLoading, setIsMatchupLoading] = useState(false)
  // Self-contained on purpose — this page has no shared query-running
  // infrastructure with App.tsx (separate route, separate component tree),
  // so it hits /run directly with the same base-URL/auth helpers rather
  // than threading state across the two. Wired for both platforms now that
  // the matchup library itself (card grid mobile / dense table desktop) is
  // the click-through entry point on this page — a *separate*, still-
  // undecided homepage-header entry point (bypassing this page entirely)
  // was discussed too, tangled up with an upcoming logo redesign, but that's
  // additive and doesn't block this one.
  const requestMatchup = async (teamA: string, teamB: string) => {
    setIsMatchupLoading(true)
    try {
      const { response } = await fetchFirstSuccessful(
        RUN_ENDPOINTS,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          // Lowercased defensively — the confirmed-working command shape
          // from the backend spec used lowercase codes ("dal vs wsh"); the
          // abbreviations flowing in here (abbrMap / schedule data) are
          // uppercase, and this was never actually exercised against the
          // real backend with real codes before now.
          body: JSON.stringify({ query: `nfl matchup ${teamA.toLowerCase()} vs ${teamB.toLowerCase()}` }),
        },
        12000,
      )
      const payload = await parseApiPayload(response)
      const matchup = extractMatchupInsightPayload(payload)
      if (matchup) {
        setMatchupResult(matchup)
        setIsMatchupOpen(true)
      }
    } catch (err) {
      console.error('Failed to load matchup insight:', err)
    } finally {
      setIsMatchupLoading(false)
    }
  }

  const [powerRankings, setPowerRankings] = useState<PowerRankingsPayload | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<PowerRankingsRow | null>(null)
  // Fetched once on page load rather than click-triggered like matchup
  // insight — power rankings is this page's primary content now, so it
  // should just be there when the page is, not behind an action.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { response } = await fetchFirstSuccessful(
          RUN_ENDPOINTS,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({ query: `nspe nfl team -rankings ${data.season}` }),
          },
          12000,
        )
        const payload = await parseApiPayload(response)
        const rankings = extractPowerRankingsPayload(payload)
        if (!cancelled && rankings) setPowerRankings(rankings)
      } catch (err) {
        console.error('Failed to load power rankings:', err)
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="relative w-screen h-screen bg-background overflow-hidden">
      <StarsBackground density={180} />

      {/* Slim utility row (back link + tabs) only — the old branded title
          block ("nfl.rankings · 2026" / week label) is gone so the matchup
          strip right below can be the page's actual top-of-screen header,
          not something pushed down under a headline. */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-4 max-w-[1480px] mx-auto">
          <a href="/" className="font-mono font-bold text-[14px] hover:opacity-70 transition-opacity" style={{ color: 'oklch(0.95 0 0)' }}>
            ← nspe.dev
          </a>
          <div className="flex items-center gap-4">
            {/* {nfl.schedule}'s tab button is hidden, not removed — standings
                (DivisionsView) live on this same 'schedule' activeView slot,
                just unreachable via nav for now. */}
            {(['rankings'] as const).map((view) => (
              <button key={view} type="button" onClick={() => setActiveView(view)}
                className="font-mono font-bold text-[14px] underline-offset-4 hover:opacity-80 transition-opacity whitespace-nowrap"
                style={{ color: activeView === view ? C.accent : C.label, textDecoration: activeView === view ? 'underline' : 'none' }}>
                {`{nfl.${view}}`}
              </button>
            ))}
            <span className="font-mono font-bold text-[14px] whitespace-nowrap inline-flex items-baseline gap-1.5"
              style={{ color: C.dim, cursor: 'not-allowed', userSelect: 'none' }}>
              <span>{'{nfl.playoffs}'}</span>
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.label }}>(pending)</span>
            </span>
          </div>
        </div>
        {activeView === 'rankings' && (
          <div className="max-w-[1480px] mx-auto mt-2">
            <WeekMatchupStrip
              games={schedule.games}
              totalWeeks={data.total_weeks}
              abbrMap={abbrMap}
              initialWeek={initialScheduleWeek}
              onMatchupClick={requestMatchup}
            />
          </div>
        )}
      </div>

      <div className="relative z-10 h-full pt-[148px] pb-8 px-6 max-w-[1480px] mx-auto">
        {/* {nfl.rankings} — power rankings is now the page's primary
            content (layout inversion from the previous matchup-library
            build, per the conversation this was rescoped in). The weekly
            slate that used to be the main event is now WeekMatchupStrip, a
            true top-of-screen header (moved into the fixed utility bar
            above) rather than living inside this scrollable section. */}
        {activeView === 'rankings' && (
          <section className="h-full flex flex-col">
            <div className="font-mono text-[14px] uppercase tracking-widest mb-2 shrink-0" style={{ color: 'oklch(0.95 0 0)' }}>
              power rankings
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {powerRankings ? (
                <PowerRankingsGrid rows={powerRankings.results} onSelectTeam={(team) => {
                  const row = powerRankings.results.find((r) => r.team === team)
                  if (row) setSelectedTeam(row)
                }} />
              ) : (
                <div className="font-mono text-[13px]" style={{ color: C.dim }}>loading power rankings…</div>
              )}
            </div>
          </section>
        )}
        {activeView === 'schedule' && (
          <section className="h-full flex flex-col">
            <div className="font-mono text-[14px] uppercase tracking-widest mb-3 shrink-0" style={{ color: C.label }}>standings</div>
            <div className="flex-1 min-h-0"><DivisionsView conferences={data.conferences} /></div>
          </section>
        )}
        {activeView === 'playoffs' && (
          <section className="h-full flex flex-col"><PlayoffsView /></section>
        )}
      </div>

      <div className="fixed bottom-3 left-4 z-20 font-mono text-[13px]" style={{ color: C.label }}>
        updated · {formatUpdated(data.last_updated)}
      </div>

      {isMatchupLoading && (
        <div
          className="fixed bottom-3 right-4 z-20 font-mono text-[13px]"
          style={{ color: C.accent }}
        >
          loading matchup…
        </div>
      )}
      <MatchupInsightOverlay open={isMatchupOpen} onClose={() => setIsMatchupOpen(false)} payload={matchupResult} />
      <TeamOverviewOverlay
        team={selectedTeam}
        fullName={selectedTeam ? fullNames[selectedTeam.team] : undefined}
        onClose={() => setSelectedTeam(null)}
      />
    </div>
  )
}
