// Generic sport page for NBA/MLB/NHL — the {matchups} rollout's per-sport
// page structure the user chose (one page per sport, rather than one unified
// hub with a sport switcher): power rankings as primary content (same layout
// inversion WorldCupApp.tsx already made for NFL), a rolling schedule strip
// above it, and the same MatchupInsightOverlay click-through NFL uses.
//
// Deliberately NOT a refactor of WorldCupApp.tsx — that file stays untouched
// so the already-live, most-visited NFL page carries zero risk from this
// still-new, unexercised code. NFL also has real division standings/a real
// week concept that these three sports don't, so a shared component would
// have needed sport-specific branching anyway; a second, simpler file for
// the three that DO share a shape (all three: flat power-rankings row, flat
// schedule feed with no "week", matchup-insight with the same wire contract)
// was the smaller, safer surface.
//
// Schedule grouping: daily, rolling "next 7 days" grouped by calendar date —
// not an artificial week bucket — since NBA/MLB/NHL don't have NFL's real
// week numbers (confirmed by scrape-room: the games feed is deliberately
// flat/ungrouped for exactly this reason).
import { useEffect, useMemo, useState } from 'react'
import { StarsBackground } from '@/components/StarsBackground'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  fetchPowerRankings,
  fetchSportSchedule,
  type SportGame,
  type SportKey,
  type SportPowerRankingsRow,
} from '@/lib/databaseApi'
import { API_BASE_CANDIDATES, fetchJsonCandidate, joinUrl, parseApiPayload } from '@/lib/nspe-api'
import { extractMatchupInsightPayload, type MatchupInsightPayload } from '@/lib/nspe-payloads'
import { MatchupInsightOverlay } from '@/components/MatchupInsightOverlay'
import { SportsSwitcher, chartsHrefFor, metricsHrefFor } from '@/components/SportsSwitcher'
import { teamNickname } from '@/lib/teamNicknames'

const C = {
  label: 'oklch(0.55 0 0)',
  value: 'oklch(0.88 0 0)',
  accent: 'oklch(0.85 0.15 195)',
  green: 'oklch(0.85 0.15 145)',
  border: 'oklch(0.28 0 0)',
  panel: 'oklch(0.13 0 0)',
  dim: 'oklch(0.40 0 0)',
}

// ---------------- team-stat labels/formatting ----------------
// Real field names per sport, confirmed live via the actual power-rankings
// payloads (nba: point_margin/reb_margin/assists/fg_pct/fg3_pct/ft_pct/
// opp_fg_pct/pts_for/pts_allowed; mlb: run_margin/hit_margin/
// errors_committed/errors_forced/runs_for/runs_allowed; nhl: points_earned/
// goal_margin/save_pct/goalie_edge/goals_for/goals_against). `_z_*` fields are
// the internal z-scores that feed power_score and are never rendered, same
// as NFL's own row type already documents.
const TEAM_STAT_LABELS: Record<string, string> = {
  point_margin: 'pt margin', reb_margin: 'reb margin', assists: 'assists',
  fg_pct: 'fg%', fg3_pct: '3p%', ft_pct: 'ft%', opp_fg_pct: 'opp fg%',
  pts_for: 'pts for', pts_allowed: 'pts allowed',
  run_margin: 'run margin', hit_margin: 'hit margin', errors_committed: 'errors (off)', errors_forced: 'errors forced',
  runs_for: 'runs for', runs_allowed: 'runs allowed',
  points_earned: 'pts earned', goal_margin: 'goal margin', save_pct: 'save%', goalie_edge: 'goalie edge',
  goals_for: 'goals for', goals_against: 'goals against',
}

const HIDDEN_TEAM_KEYS = new Set(['team', 'rank', 'games', 'wins', 'losses', 'ties', 'otl', 'power_score'])

function teamStatLabel(key: string): string {
  return TEAM_STAT_LABELS[key] ?? key.replace(/_/g, ' ')
}

function formatTeamStatValue(key: string, value: number): string {
  if (key.endsWith('_pct')) return `${(value * 100).toFixed(1)}%`
  if (key.endsWith('_margin')) return value > 0 ? `+${value}` : String(value)
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(3).length <= 5 ? value.toFixed(3) : value.toFixed(1)
}

function formatRecord(row: SportPowerRankingsRow): string {
  const parts = [`${row.wins}-${row.losses}`]
  if (typeof row.otl === 'number' && row.otl > 0) parts.push(`${row.otl}`)
  else if (row.ties) parts.push(`${row.ties}`)
  return parts.join('-')
}

// ---------------- power rankings grid ----------------

function RankingTile({ row, onSelect }: { row: SportPowerRankingsRow; onSelect: (team: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(row.team)}
      className="rounded px-3 py-2.5 flex flex-col items-center gap-1.5 text-center hover:opacity-80 transition-opacity"
      style={{ backgroundColor: 'oklch(0.10 0 0)', border: `1px solid ${C.border}` }}
    >
      <div className="flex items-center justify-center gap-2">
        <span className="font-mono text-[16px] font-bold leading-none" style={{ color: 'oklch(0.98 0 0)' }}>{row.rank}</span>
        <span
          className="font-mono text-[22px] font-bold leading-none rounded px-2 py-1"
          style={{ color: C.accent, border: `1px solid ${C.accent}` }}
        >
          {row.team}
        </span>
      </div>
      <span className="font-mono text-[12px]" style={{ color: C.label }}>{formatRecord(row)}</span>
      <span className="font-mono text-[16px] font-bold" style={{ color: C.green }}>{row.power_score.toFixed(1)}</span>
    </button>
  )
}

function PowerRankingsGrid({ rows, onSelectTeam }: { rows: SportPowerRankingsRow[]; onSelectTeam: (team: string) => void }) {
  const isMobile = useIsMobile()
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${isMobile ? 3 : 8}, minmax(0, 1fr))` }}>
      {rows.map((row) => <RankingTile key={row.team} row={row} onSelect={onSelectTeam} />)}
    </div>
  )
}

// ---------------- team overview overlay ----------------
// Data-driven version of WorldCupApp.tsx's TeamOverviewOverlay — that one
// hardcodes NFL's exact 4 stat fields (time of possession/red zone %/pts
// margin/3rd down %); this renders whatever extra stat fields are actually
// present on the row (see TEAM_STAT_LABELS above), since each sport's
// rankings engine emits a completely different stat set.

function TeamStatsOverlay({ team, onClose }: { team: SportPowerRankingsRow | null; onClose: () => void }) {
  if (!team) return null
  const statKeys = Object.keys(team).filter(
    (k) => !HIDDEN_TEAM_KEYS.has(k) && !k.startsWith('_z_') && typeof team[k] === 'number',
  )
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
          <span className="font-mono font-bold text-[15px]" style={{ color: C.accent }}>{`{${team.team}}`}</span>
          <span className="flex items-center gap-4">
            <span className="flex items-baseline gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.label }}>power</span>
              <span className="font-mono text-[16px] font-bold" style={{ color: C.green }}>{team.power_score.toFixed(1)}</span>
            </span>
            <button type="button" onClick={onClose} className="font-mono text-[16px] hover:opacity-70 transition-opacity" style={{ color: C.accent }} aria-label="Close">
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
            {statKeys.map((key) => (
              <div key={key}>
                <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.label }}>{teamStatLabel(key)}</div>
                <div className="font-mono text-[16px] font-bold" style={{ color: C.value }}>
                  {formatTeamStatValue(key, team[key] as number)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------- daily schedule strip ----------------

function formatGameDate(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateIso
  const today = new Date()
  const diffDays = Math.round((d.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86400000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatGameTime(startTimeUtc: string): string {
  const d = new Date(startTimeUtc)
  if (Number.isNaN(d.getTime())) return 'tbd'
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function DailyMatchupStrip({ games, sport, onMatchupClick }: { games: SportGame[]; sport: SportKey; onMatchupClick: (teamA: string, teamB: string) => void }) {
  const grouped = useMemo(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const sevenDaysOut = new Date(startOfToday)
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7)

    const upcoming = games.filter((g) => {
      const d = new Date(`${g.date_iso}T00:00:00`)
      return !Number.isNaN(d.getTime()) && d >= startOfToday && d < sevenDaysOut
    })
    upcoming.sort((a, b) => a.date_iso.localeCompare(b.date_iso) || a.start_time_utc.localeCompare(b.start_time_utc))

    const order: string[] = []
    const map = new Map<string, SportGame[]>()
    for (const g of upcoming) {
      if (!map.has(g.date_iso)) { map.set(g.date_iso, []); order.push(g.date_iso) }
      map.get(g.date_iso)!.push(g)
    }
    return order.map((date) => ({ date, games: map.get(date)! }))
  }, [games])

  if (grouped.length === 0) {
    return <div className="font-mono text-[12px] shrink-0" style={{ color: C.dim }}>no games in the next 7 days</div>
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 shrink-0" style={{ scrollbarWidth: 'thin' }}>
      {grouped.map(({ date, games: dayGames }) => (
        <div key={date} className="shrink-0">
          <div className="font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: C.label }}>{formatGameDate(date)}</div>
          <div className="flex gap-2">
            {dayGames.map((g) => (
              <button
                key={g.game_id}
                type="button"
                onClick={() => onMatchupClick(g.away_team, g.home_team)}
                className="shrink-0 rounded px-2.5 py-1.5 text-left hover:opacity-80 transition-opacity"
                style={{ backgroundColor: 'oklch(0.10 0 0)', border: `1px solid ${C.green}` }}
              >
                <div className="font-mono text-[12px] font-bold whitespace-nowrap" style={{ color: C.accent }}>
                  {`{${teamNickname(sport, g.away_team)} @ ${teamNickname(sport, g.home_team)}}`}
                </div>
                {/* Concluded games show the real result (already on the same
                    row — home_score/away_score aren't placeholders, they're
                    the actual final score) instead of just a bare "final"
                    label. */}
                <div className="font-mono text-[9px] uppercase tracking-wider" style={{ color: C.label }}>
                  {g.status === 'final'
                    ? `final · ${g.away_score}-${g.home_score}`
                    : g.status === 'postponed' || g.status === 'canceled'
                      ? g.status
                      : formatGameTime(g.start_time_utc)}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------- season-label guessing ----------------
// The rankings feed and the schedule feed label seasons differently (rankings
// season:2026 for the same NHL data the schedule feed files as
// nhl_games/2027.json — rankings uses the year the season started, the
// schedule feed follows the normal NBA/NHL convention of naming a season by
// the calendar year it ends in). Guessed independently of the rankings
// payload for that reason, with adjacent-year fallbacks in case the guess is
// ever off by one (e.g. right at a season rollover).
function guessSeasonLabel(sport: SportKey, now: Date): number {
  if (sport === 'mlb' || sport === 'nfl') return now.getFullYear()
  // nba/nhl: a season spanning fall Y -> spring Y+1 is labeled Y+1; from July
  // onward the upcoming season's file is already the relevant one.
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear()
}

async function fetchScheduleWithFallback(sport: SportKey): Promise<SportGame[]> {
  const now = new Date()
  const primary = guessSeasonLabel(sport, now)
  const candidates = [primary, primary + 1, primary - 1]
  let lastErr: unknown = null
  for (const season of candidates) {
    try {
      const data = await fetchSportSchedule(sport, season)
      return data.games
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr ?? new Error(`No schedule file found for ${sport}`)
}

// ---------------- page ----------------

export interface SportSeasonPageProps {
  sport: Exclude<SportKey, 'nfl'>
  /** e.g. "nba.season", "mlb.playoffs", "nhl.season" — used verbatim as the on-page label. */
  label: string
}

export default function SportSeasonPage({ sport, label }: SportSeasonPageProps) {
  const [powerRankings, setPowerRankings] = useState<SportPowerRankingsRow[] | null>(null)
  const [powerRankingsError, setPowerRankingsError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<SportPowerRankingsRow | null>(null)

  const [games, setGames] = useState<SportGame[]>([])

  const [matchupResult, setMatchupResult] = useState<MatchupInsightPayload | null>(null)
  const [isMatchupOpen, setIsMatchupOpen] = useState(false)
  const [isMatchupLoading, setIsMatchupLoading] = useState(false)
  const [matchupNotice, setMatchupNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchPowerRankings(sport)
      .then((data) => {
        if (cancelled) return
        setPowerRankings(data.teams)
        setGeneratedAt(data.generated_at)
      })
      .catch((err) => {
        console.error(`Failed to load ${sport} power rankings:`, err)
        if (!cancelled) setPowerRankingsError("Couldn't load power rankings — try refreshing.")
      })
    return () => { cancelled = true }
  }, [sport])

  useEffect(() => {
    let cancelled = false
    fetchScheduleWithFallback(sport)
      .then((g) => { if (!cancelled) setGames(g) })
      .catch((err) => console.error(`Failed to load ${sport} schedule:`, err))
    return () => { cancelled = true }
  }, [sport])

  const requestMatchup = async (teamA: string, teamB: string) => {
    setIsMatchupLoading(true)
    setMatchupNotice(null)
    try {
      const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, `/matchup/${sport}/${teamA.toLowerCase()}/${teamB.toLowerCase()}`))
      const response = await fetchJsonCandidate(urls, 10000)
      if (response.status === 404) {
        setMatchupNotice("Couldn't find a matchup for those two teams.")
        return
      }
      const payload = await parseApiPayload(response)
      const matchup = extractMatchupInsightPayload(payload)
      if (matchup) {
        setMatchupResult(matchup)
        setIsMatchupOpen(true)
      } else {
        setMatchupNotice("Couldn't load that matchup — try again in a moment.")
      }
    } catch (err) {
      console.error('Failed to load matchup insight:', err)
      setMatchupNotice("Couldn't load that matchup — try again in a moment.")
    } finally {
      setIsMatchupLoading(false)
    }
  }

  return (
    <div className="relative w-screen h-screen bg-background overflow-hidden">
      <StarsBackground density={180} dim />

      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-3 pb-2">
        <div className="flex items-center justify-between gap-4 max-w-[1480px] mx-auto">
          <a href="/" className="font-mono font-bold text-[14px] hover:opacity-70 transition-opacity" style={{ color: 'oklch(0.95 0 0)' }}>
            ← nspe.dev
          </a>
          {/* {sports} sits in the same uniform spot WorldCupApp.tsx (NFL)
              carries it — a visitor can jump to any other sport's page from
              here without routing back through the homepage. {charts} added
              next to it 2026-09-30 — a direct link to this sport's own
              charts page (no popup needed, this page already knows its
              sport), same slot NFL's page carries it in. {team.metrics}
              added 2026-10-01, same treatment — mlb has no team-metrics page
              (metricsHrefFor returns undefined), so this page's mlb mount
              just won't render the link, nothing else needs to change. */}
          <div className="flex items-center gap-4">
            <span className="font-mono font-bold text-[14px] whitespace-nowrap" style={{ color: C.accent, textDecoration: 'underline' }}>
              {`{${label}}`}
            </span>
            <SportsSwitcher current={sport} />
            <a
              href={chartsHrefFor(sport)}
              className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
              style={{ color: C.accent }}
            >
              {'{charts}'}
            </a>
            {metricsHrefFor(sport) && (
              <a
                href={metricsHrefFor(sport)}
                className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
                style={{ color: C.accent }}
              >
                {'{team.metrics}'}
              </a>
            )}
          </div>
        </div>
        <div className="max-w-[1480px] mx-auto mt-2">
          <DailyMatchupStrip games={games} sport={sport} onMatchupClick={requestMatchup} />
        </div>
      </div>

      <div className="relative z-10 h-full pt-[128px] pb-8 px-6 max-w-[1480px] mx-auto">
        <section className="h-full flex flex-col">
          <div className="font-mono text-[14px] uppercase tracking-widest mb-2 shrink-0" style={{ color: 'oklch(0.95 0 0)' }}>
            power rankings
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {powerRankings ? (
              <PowerRankingsGrid
                rows={powerRankings}
                onSelectTeam={(team) => {
                  const row = powerRankings.find((r) => r.team === team)
                  if (row) setSelectedTeam(row)
                }}
              />
            ) : powerRankingsError ? (
              <div className="font-mono text-[13px]" style={{ color: C.value }}>{powerRankingsError}</div>
            ) : (
              <div className="font-mono text-[13px]" style={{ color: C.dim }}>loading power rankings…</div>
            )}
          </div>
        </section>
      </div>

      {generatedAt && (
        <div className="fixed bottom-3 left-4 z-20 font-mono text-[13px]" style={{ color: C.label }}>
          updated · {new Date(generatedAt).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {isMatchupLoading && (
        <div className="fixed bottom-3 right-4 z-20 font-mono text-[13px]" style={{ color: C.accent }}>
          loading matchup…
        </div>
      )}
      {!isMatchupLoading && matchupNotice && (
        <div
          className="fixed bottom-3 right-4 z-20 flex items-center gap-3 font-mono text-[13px] rounded px-3 py-1.5"
          style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.value }}
        >
          <span>{matchupNotice}</span>
          <button type="button" onClick={() => setMatchupNotice(null)} className="hover:opacity-70 transition-opacity" style={{ color: C.label }} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      <MatchupInsightOverlay open={isMatchupOpen} onClose={() => setIsMatchupOpen(false)} payload={matchupResult} />
      <TeamStatsOverlay team={selectedTeam} onClose={() => setSelectedTeam(null)} />
    </div>
  )
}
