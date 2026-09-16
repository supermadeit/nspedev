import { useEffect, useMemo, useState } from 'react'
import { StarsBackground } from '@/components/StarsBackground'
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

// ---------------- matchup library ----------------
// Replaces the old score-card schedule view — {nfl.season}'s primary
// purpose is shifting from a per-division standings/score page to a weekly
// slate of actionable matchup commands, per the conversation this was
// redesigned in. Confirmed layouts: mobile gets a day-grouped 2-column card
// grid, desktop gets a single dense day/time/matchup table — deliberately
// not the same widget scaled up, per the explicit design discussion.
// Scores are dropped entirely here (matchup insight — career history vs
// this opponent — is meaningful whether or not this week's game has been
// played yet); the old GameCard scoreboard-style rendering is gone with it
// rather than kept as unused dead code, since it's specifically the "current
// per-division/score style" being moved away from, not a shelved feature.

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

// ---------------- power rankings ----------------
// `nfl-power-rankings` engine — a backend-computed weekly composite score
// per team. Styled after the existing {leaderboard} panel's row grammar
// (rank/label/secondary/score, same color roles) but scaled up: this is a
// full 32-team list, not a top-N, and desktop has the spare vertical space
// in the dense matchup table to show all of it without scrolling — 16
// teams per row, 2 rows, per the design call. Mobile gets its own
// {nfl.rankings} button into a scrollable overlay instead, since a phone
// screen doesn't have that spare room.

function formatRecord(row: PowerRankingsRow): string {
  return row.ties ? `${row.wins}-${row.losses}-${row.ties}` : `${row.wins}-${row.losses}`
}

function RankingTile({ row }: { row: PowerRankingsRow }) {
  return (
    <div
      className="rounded px-2 py-1.5 flex flex-col gap-1"
      style={{ backgroundColor: 'oklch(0.10 0 0)', border: `1px solid ${C.border}` }}
    >
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-[11px]" style={{ color: C.dim }}>{row.rank}</span>
        <span className="font-mono text-[15px] font-bold" style={{ color: C.value }}>{row.team}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px]" style={{ color: C.label }}>{formatRecord(row)}</span>
        <span className="font-mono text-[13px] font-bold" style={{ color: C.green }}>{row.power_score.toFixed(1)}</span>
      </div>
    </div>
  )
}

function PowerRankingsGrid({ rows }: { rows: PowerRankingsRow[] }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}>
      {rows.map((row) => <RankingTile key={row.team} row={row} />)}
    </div>
  )
}

function PowerRankingsOverlay({
  open,
  onClose,
  rows,
}: {
  open: boolean
  onClose: () => void
  rows: PowerRankingsRow[]
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'oklch(0.08 0 0)', fontFamily: 'monospace' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex items-center justify-between px-4 py-3 flex-none"
        style={{ backgroundColor: 'oklch(0.14 0 0)', borderBottom: `1px solid ${C.border}` }}
      >
        <span className="font-mono font-bold text-[17px]" style={{ color: C.accent }}>{'{nfl.rankings}'}</span>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[18px] hover:opacity-70 transition-opacity"
          style={{ color: C.accent }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div
        className="grid items-center px-4 py-2 font-mono text-[12px] uppercase tracking-widest sticky top-0"
        style={{ gridTemplateColumns: '32px 1fr 72px 72px', gap: '8px', backgroundColor: 'oklch(0.12 0 0)', borderBottom: `1px solid ${C.border}`, color: C.dim }}
      >
        <span>#</span><span>team</span><span>record</span><span className="text-right">score</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rows.map((row, idx) => (
          <div
            key={row.team}
            className="grid items-center px-4 py-2.5 font-mono text-[16px]"
            style={{ gridTemplateColumns: '32px 1fr 72px 72px', gap: '8px', borderBottom: idx === rows.length - 1 ? 'none' : `1px solid oklch(0.16 0 0)` }}
          >
            <span style={{ color: C.dim }}>{row.rank}</span>
            <span className="font-bold" style={{ color: C.value }}>{row.team}</span>
            <span style={{ color: C.label }}>{formatRecord(row)}</span>
            <span className="text-right font-bold" style={{ color: C.green }}>{row.power_score.toFixed(1)}</span>
          </div>
        ))}
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

type ActiveView = 'season' | 'schedule' | 'playoffs'

export default function WorldCupApp() {
  const data = nflData as unknown as NflSeasonData
  const schedule = scheduleData as unknown as ScheduleData
  const [activeView, setActiveView] = useState<ActiveView>('season')
  const abbrMap = useMemo(() => buildAbbrMap(data), [data])
  const weekLabel = data.current_week != null
    ? `week ${data.current_week} · ${data.total_weeks}`
    : 'pre-season'
  // Schedule tab opens on the active week (data.current_week), not always
  // week 1 — current_week is expected to already reflect the Tuesday-
  // morning rollover backend-side (games run through Monday Night Football,
  // so the "active" week doesn't advance until Tuesday). Clamped in case
  // current_week is ever missing/out of range before a season starts.
  const initialScheduleWeek = Math.min(Math.max(data.current_week ?? 1, 1), data.total_weeks)

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

  const isMobile = useIsMobile()
  const [powerRankings, setPowerRankings] = useState<PowerRankingsPayload | null>(null)
  const [isRankingsOverlayOpen, setIsRankingsOverlayOpen] = useState(false)
  // Fetched once on page load rather than click-triggered like matchup
  // insight — this fills fixed on-screen space (the dense desktop table's
  // spare room, a dedicated mobile overlay) rather than responding to a
  // specific user action, so it should just be there when the page is.
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

      <div className="absolute top-6 left-6 right-6 z-20 flex items-start justify-between gap-6">
        <div className="flex flex-col">
          <a href="/" className="font-mono text-[16px] hover:opacity-70 transition-opacity" style={{ color: C.label }}>
            ← nspe.dev
          </a>
          <div className="font-mono text-[26px] mt-1" style={{ color: C.value }}>
            <span style={{ color: C.accent }}>nfl.season</span>
            <span style={{ color: C.label }}>{' · '}</span>
            <span style={{ color: C.green }}>{data.season}</span>
          </div>
          <div className="font-mono text-[14px] mt-0.5" style={{ color: C.label }}>{weekLabel}</div>
        </div>

        <div className="flex items-center gap-5 pt-2">
          {/* {nfl.schedule}'s tab button is hidden, not removed — the tab
              nav entry point isn't in use for now, since this whole view is
              slated to become "the official matchup library" (a weekly
              slate of actionable matchup commands) rather than keeping its
              current per-division/score-card style. ScheduleView, GameCard,
              and the mobile matchup buttons all stay wired underneath;
              route/state (activeView) is untouched, just unreachable via
              this nav until that redesign happens. */}
          {(['season'] as const).map((view) => (
            <button key={view} type="button" onClick={() => setActiveView(view)}
              className="font-mono font-bold text-[18px] underline-offset-4 hover:opacity-80 transition-opacity whitespace-nowrap"
              style={{ color: activeView === view ? C.accent : C.label, textDecoration: activeView === view ? 'underline' : 'none' }}>
              {`{nfl.${view}}`}
            </button>
          ))}
          <span className="font-mono font-bold text-[18px] whitespace-nowrap inline-flex items-baseline gap-1.5"
            style={{ color: C.dim, cursor: 'not-allowed', userSelect: 'none' }}>
            <span>{'{nfl.playoffs}'}</span>
            <span className="font-mono text-[12px] uppercase tracking-widest" style={{ color: C.label }}>(pending)</span>
          </span>
        </div>
      </div>

      <div className="relative z-10 h-full pt-32 pb-8 px-6 max-w-[1480px] mx-auto">
        {/* {nfl.season} now IS the matchup library, per the redesign
            discussion — this replaces the old per-division standings as
            the tab's primary content. DivisionsView isn't deleted, just
            shelved onto the still-hidden 'schedule' activeView slot below
            (unreachable via nav right now, same as before) so standings
            stay one small nav change away if they need to come back. */}
        {activeView === 'season' && (
          <section className="h-full flex flex-col">
            {/* Dropped the total-season game count that used to sit here
                ("· 272 games") — easy to misread as this week's count when
                it was actually the full-season total. */}
            <div className="font-mono text-[14px] uppercase tracking-widest mb-3 shrink-0" style={{ color: C.label }}>
              this week's matchups
            </div>
            <div className={isMobile ? 'flex-1 min-h-0' : 'flex-1 min-h-0 basis-0'}>
              <MatchupLibraryView
                games={schedule.games}
                totalWeeks={data.total_weeks}
                abbrMap={abbrMap}
                initialWeek={initialScheduleWeek}
                onMatchupClick={requestMatchup}
              />
            </div>
            {/* Power rankings: desktop only, filling the spare vertical room
                the dense table leaves — mobile gets the same data through
                the {nfl.rankings} button/overlay instead of squeezing it
                into an already-tight layout. */}
            {!isMobile && powerRankings && (
              <div className="shrink-0 mt-4 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="font-mono text-[14px] uppercase tracking-widest mb-2" style={{ color: C.label }}>
                  power rankings
                </div>
                <PowerRankingsGrid rows={powerRankings.results} />
              </div>
            )}
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
      {isMobile && powerRankings && (
        <button
          type="button"
          onClick={() => setIsRankingsOverlayOpen(true)}
          className="fixed bottom-3 right-4 z-20 font-mono font-bold text-[16px] rounded px-3.5 py-2 hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'oklch(0.16 0 0)', border: `1px solid ${C.border}`, color: C.accent }}
          aria-label="Open power rankings"
        >
          {'{nfl.rankings}'}
        </button>
      )}
      <MatchupInsightOverlay open={isMatchupOpen} onClose={() => setIsMatchupOpen(false)} payload={matchupResult} />
      <PowerRankingsOverlay open={isRankingsOverlayOpen} onClose={() => setIsRankingsOverlayOpen(false)} rows={powerRankings?.results ?? []} />
    </div>
  )
}
