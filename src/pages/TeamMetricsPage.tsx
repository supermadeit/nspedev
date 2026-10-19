// {team.metrics} — nfl/nba/nhl/mlb (mlb joined 2026-10-01, its own dedicated
// engine rather than a retrofit of the gap-having team feed the others
// originally used). One shared page component mounted 4x via routes with
// different `sport`/`label` props — same pattern SportSeasonPage
// already established for the rankings pages, since the page SHELL here
// (team/window pickers, mode switching, fetch orchestration) is identical
// across sports; only the metric field list differs, which is what
// FIELD_GROUPS_BY_SPORT below exists to isolate. Visually styled like the
// charts pages (plain dark surface, bordered header, no starfield) rather
// than the rankings pages' fixed-height/matchup-strip layout — this is a
// data-dense single-scroll page, closer in kind to {chart} than to
// {nfl.season}.
//
// Three modes, all built on the SAME card component (TeamMetricsCard) —
// "single team" renders one, "vs. another team" and "vs. a past season"
// both render two with different (team, window) pairs. No separate
// comparison renderer exists; the single-team deep-dive IS the comparison
// renderer, just called once. Per the owner's 2026-10-01 ask: a single-team
// view needed to exist on its own (not just as half of a forced comparison),
// since a team's own for/against split already answers "what are they good
// at vs. what do they allow" without a second team involved at all.
import { useEffect, useMemo, useState } from 'react'
import { HomeLogoLink } from '@/components/HomeLogoLink'
import { C } from '@/components/ProfileSections'
import { SportsSwitcher, chartsHrefFor } from '@/components/SportsSwitcher'
import { TeamMetricsCard, OpponentThresholdsPanel, type TeamMetricsFieldDef } from '@/components/TeamMetricsCard'
import { fetchTeamMetrics, type TeamMetricsPayload } from '@/lib/databaseApi'
import { teamRoster } from '@/lib/teamNicknames'
import { useIsMobile } from '@/hooks/use-mobile'

type Sport = 'nfl' | 'nba' | 'nhl' | 'mlb'
type Mode = 'single' | 'vsTeam' | 'vsHistory'

const FIELD_GROUPS_BY_SPORT: Record<Sport, TeamMetricsFieldDef[]> = {
  nfl: [
    { key: 'points', label: 'Points', group: 'Scoring' },
    { key: 'total_yards', label: 'Total Yards', group: 'Yardage' },
    { key: 'pass_yards', label: 'Pass Yards', group: 'Yardage' },
    { key: 'rush_yards', label: 'Rush Yards', group: 'Yardage' },
    { key: 'yards_per_play', label: 'Yards / Play', group: 'Yardage' },
    { key: 'completion_pct', label: 'Completion %', group: 'Efficiency' },
    { key: 'third_down_pct', label: '3rd Down %', group: 'Efficiency' },
    { key: 'red_zone_pct', label: 'Red Zone %', group: 'Efficiency' },
    { key: 'time_of_possession', label: 'Time of Poss.', group: 'Efficiency' },
    { key: 'first_downs', label: '1st Downs', group: 'Drives' },
    { key: 'offensive_plays', label: 'Plays', group: 'Drives' },
    { key: 'drives', label: 'Drives', group: 'Drives' },
    { key: 'pass_tds', label: 'Pass TDs', group: 'Touchdowns' },
    { key: 'rush_tds', label: 'Rush TDs', group: 'Touchdowns' },
    { key: 'defensive_st_tds', label: 'Def/ST TDs', group: 'Touchdowns' },
    { key: 'turnovers', label: 'Turnovers', group: 'Turnovers & Discipline' },
    { key: 'interceptions', label: 'Interceptions', group: 'Turnovers & Discipline' },
    { key: 'fumbles_lost', label: 'Fumbles Lost', group: 'Turnovers & Discipline' },
    { key: 'sacks', label: 'Sacks', group: 'Turnovers & Discipline' },
    { key: 'sack_yards', label: 'Sack Yards', group: 'Turnovers & Discipline' },
    { key: 'penalties', label: 'Penalties', group: 'Turnovers & Discipline' },
    { key: 'explosive_plays', label: 'Explosive Plays (20+ yd)', group: 'Explosive Plays' },
  ],
  nba: [
    { key: 'points', label: 'Points', group: 'Scoring' },
    { key: 'points_by_quarter', label: 'Points by Quarter', group: 'Scoring', periodLabels: ['Q1', 'Q2', 'Q3', 'Q4'] },
    { key: 'first_half_points', label: '1st Half Points', group: 'Scoring' },
    { key: 'second_half_points', label: '2nd Half Points', group: 'Scoring' },
    { key: 'overtime_points', label: 'OT Points', group: 'Scoring' },
    { key: 'fg_pct', label: 'FG %', group: 'Shooting' },
    { key: 'fg_made', label: 'FG Made', group: 'Shooting' },
    { key: 'fg_att', label: 'FG Att', group: 'Shooting' },
    { key: 'three_pt_pct', label: '3PT %', group: 'Shooting' },
    { key: 'three_pt_made', label: '3PT Made', group: 'Shooting' },
    { key: 'three_pt_att', label: '3PT Att', group: 'Shooting' },
    { key: 'ft_pct', label: 'FT %', group: 'Shooting' },
    { key: 'ft_made', label: 'FT Made', group: 'Shooting' },
    { key: 'ft_att', label: 'FT Att', group: 'Shooting' },
    { key: 'rebounds', label: 'Rebounds', group: 'Rebounding' },
    { key: 'off_rebounds', label: 'Off. Rebounds', group: 'Rebounding' },
    { key: 'def_rebounds', label: 'Def. Rebounds', group: 'Rebounding' },
    { key: 'assists', label: 'Assists', group: 'Playmaking & Defense' },
    { key: 'steals', label: 'Steals', group: 'Playmaking & Defense' },
    { key: 'blocks', label: 'Blocks', group: 'Playmaking & Defense' },
    { key: 'turnovers', label: 'Turnovers', group: 'Playmaking & Defense' },
    { key: 'fouls', label: 'Fouls', group: 'Playmaking & Defense' },
    { key: 'points_in_paint', label: 'Points in Paint', group: 'Shot Profile' },
    { key: 'fast_break_points', label: 'Fast Break Pts', group: 'Shot Profile' },
    { key: 'points_off_turnovers', label: 'Pts off Turnovers', group: 'Shot Profile' },
    { key: 'largest_lead', label: 'Largest Lead', group: 'Shot Profile' },
  ],
  nhl: [
    { key: 'goals', label: 'Goals', group: 'Scoring' },
    { key: 'goals_by_period', label: 'Goals by Period', group: 'Scoring', periodLabels: ['P1', 'P2', 'P3'] },
    { key: 'overtime_goals', label: 'OT Goals', group: 'Scoring' },
    { key: 'saves', label: 'Saves', group: 'Goaltending' },
    { key: 'save_pct', label: 'Save %', group: 'Goaltending' },
    { key: 'power_play_goals', label: 'PP Goals', group: 'Special Teams' },
    { key: 'power_play_opportunities', label: 'PP Opportunities', group: 'Special Teams' },
    { key: 'power_play_pct', label: 'PP %', group: 'Special Teams' },
    { key: 'short_handed_goals', label: 'SH Goals', group: 'Special Teams' },
    { key: 'penalty_kill_pct', label: 'Penalty Kill %', group: 'Special Teams' },
    { key: 'penalties', label: 'Penalties', group: 'Discipline' },
    { key: 'penalty_minutes', label: 'Penalty Minutes', group: 'Discipline' },
    { key: 'shots', label: 'Shots', group: 'Puck Possession' },
    { key: 'faceoffs_won', label: 'Faceoffs Won', group: 'Puck Possession' },
    { key: 'faceoff_pct', label: 'Faceoff %', group: 'Puck Possession' },
    { key: 'hits', label: 'Hits', group: 'Puck Possession' },
    { key: 'blocked_shots', label: 'Blocked Shots', group: 'Puck Possession' },
    { key: 'takeaways', label: 'Takeaways', group: 'Puck Possession' },
    { key: 'giveaways', label: 'Giveaways', group: 'Puck Possession' },
  ],
  mlb: [
    { key: 'runs', label: 'Runs', group: 'Scoring' },
    { key: 'runs_by_inning', label: 'Runs by Inning', group: 'Scoring', periodLabels: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] },
    { key: 'first_five_runs', label: 'First 5 Runs', group: 'Scoring' },
    { key: 'extra_innings_runs', label: 'Extra Innings Runs', group: 'Scoring' },
    { key: 'hits', label: 'Hits', group: 'Batting' },
    { key: 'home_runs', label: 'Home Runs', group: 'Batting' },
    { key: 'doubles', label: 'Doubles', group: 'Batting' },
    { key: 'triples', label: 'Triples', group: 'Batting' },
    { key: 'walks', label: 'Walks', group: 'Batting' },
    { key: 'strikeouts', label: 'Strikeouts', group: 'Batting' },
    { key: 'stolen_bases', label: 'Stolen Bases', group: 'Batting' },
    { key: 'total_bases', label: 'Total Bases', group: 'Batting' },
    { key: 'extra_base_hits', label: 'Extra-Base Hits', group: 'Batting' },
    { key: 'left_on_base', label: 'Left on Base', group: 'Batting' },
    { key: 'gidp', label: 'GIDP', group: 'Batting' },
    { key: 'pitching_strikeouts', label: 'Strikeouts', group: 'Pitching' },
    { key: 'walks_allowed', label: 'Walks Allowed', group: 'Pitching' },
    { key: 'hits_allowed', label: 'Hits Allowed', group: 'Pitching' },
    { key: 'home_runs_allowed', label: 'HR Allowed', group: 'Pitching' },
    { key: 'quality_starts', label: 'Quality Starts', group: 'Pitching', decimals: 2 },
    { key: 'saves', label: 'Saves', group: 'Pitching' },
    { key: 'blown_saves', label: 'Blown Saves', group: 'Pitching' },
    { key: 'holds', label: 'Holds', group: 'Pitching' },
    { key: 'pitches', label: 'Pitches', group: 'Pitching' },
    // errors_committed (full history, from the games index) and errors (box
    // score only, 2020+) are genuinely two separate keys on this payload —
    // kept as two rows, not merged, so each one's own coverage stays honest.
    { key: 'errors_committed', label: 'Errors', group: 'Fielding' },
    { key: 'errors', label: 'Errors (box)', group: 'Fielding' },
    { key: 'double_plays', label: 'Double Plays', group: 'Fielding' },
    { key: 'fielding_pct', label: 'Fielding %', group: 'Fielding', decimals: 3 },
    // Rates — decimals explicit since these are .246-style stats, not
    // percentages; the default 1-decimal rounding would read as "0.2".
    { key: 'batting_avg', label: 'AVG', group: 'Rates', decimals: 3 },
    { key: 'on_base_pct', label: 'OBP', group: 'Rates', decimals: 3 },
    { key: 'slugging', label: 'SLG', group: 'Rates', decimals: 3 },
    { key: 'ops', label: 'OPS', group: 'Rates', decimals: 3 },
    { key: 'era', label: 'ERA', group: 'Rates', decimals: 2 },
    { key: 'whip', label: 'WHIP', group: 'Rates', decimals: 2 },
  ],
}

interface FetchState {
  loading: boolean
  error: string | null
  payload: TeamMetricsPayload | null
}

function useTeamMetricsFetch(sport: Sport, team: string, window: string, enabled: boolean): FetchState {
  const [state, setState] = useState<FetchState>({ loading: false, error: null, payload: null })
  useEffect(() => {
    if (!enabled || !team) return
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    fetchTeamMetrics(sport, team, window)
      .then((payload) => {
        if (!cancelled) setState({ loading: false, error: null, payload })
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: err instanceof Error ? err.message : 'Failed to load', payload: null })
      })
    return () => {
      cancelled = true
    }
  }, [sport, team, window, enabled])
  return state
}

// Backend unified NBA/NHL year tokens to both mean the display/start year
// ("2026" = 2026-27 for NBA too, same as NHL already was) — deployed
// 2026-10-17 (commit a0c7e4a), independently verified live (window=2026 →
// "2026 (2026-27)" for both sports, window=2024/2025 correct too) before
// this shipped. Previously held uncommitted to avoid a misleading label
// window; see git history (commit b8cc086) for the prior split-convention
// version if this ever needs reverting.
//
// A plain year token used to mean a different season for NBA than NHL
// (NBA: the season's END year; NHL: the START year) — once this ships, both
// read as the DISPLAY/start year. NFL's and MLB's tokens already equal
// their season year 1:1 (confirmed for mlb 2026-10-01), so neither needs a
// second form — both just fall through to the plain `String(year)` below.
// Explicitly NOT the same rule as the player-profile page's own `?window=`
// (PlayerProfilePage.tsx) — backend deliberately left that endpoint's year
// meaning untouched for now, so don't copy this logic there without
// checking first.
function yearOptionLabel(sport: Sport, year: number): string {
  if (sport === 'nba' || sport === 'nhl') return `${year} (${year}-${String(year + 1).slice(2)})`
  return String(year)
}

// HELD, NOT YET LIVE (2026-10-18): backend is precomputing a last-N-games
// window (last5/last10/last20) across the whole /team-metrics bundle
// (metrics + record + allows, same denominators) — confirmed scope/
// contract, but not yet built/deployed (expected after tonight's slate).
// Staged here, ready to ship, but deliberately left unwired into the
// dropdowns below until that's confirmed live — picking one of these before
// the precompute files exist would fall through to the slow live-compute
// path (the exact thing fixed earlier today), not fail outright, so this
// wouldn't even be visibly broken to ship early — just quietly slow/flaky
// for anyone who clicks it, which is worse than not being there yet.
// DO NOT wire this into the <select> elements below until nspe-v2-da
// confirms the precompute files are live; verify independently via curl
// first, same as every other backend-dependent change this session.
const LAST_N_WINDOW_OPTIONS: { value: string; label: string }[] = [
  { value: 'last5', label: 'last 5 games' },
  { value: 'last10', label: 'last 10 games' },
  { value: 'last20', label: 'last 20 games' },
]

const MODE_TABS: { key: Mode; label: string }[] = [
  { key: 'single', label: 'single team' },
  { key: 'vsTeam', label: 'vs. another team' },
  { key: 'vsHistory', label: "vs. a past season" },
]

export default function TeamMetricsPage({ sport, label }: { sport: Sport; label: string }) {
  const isMobile = useIsMobile()
  const roster = useMemo(() => teamRoster(sport), [sport])
  const fieldGroups = FIELD_GROUPS_BY_SPORT[sport]
  const currentYear = new Date().getFullYear()
  const yearOptions = useMemo(() => Array.from({ length: 10 }, (_, i) => String(currentYear - i)), [currentYear])

  const [mode, setMode] = useState<Mode>('single')
  const [teamA, setTeamA] = useState(roster[0]?.code ?? '')
  const [teamB, setTeamB] = useState(roster[1]?.code ?? roster[0]?.code ?? '')
  const [windowA, setWindowA] = useState('season')
  const [windowB, setWindowB] = useState(String(currentYear - 1))

  const cardBTeam = mode === 'vsHistory' ? teamA : teamB
  const cardBWindow = mode === 'vsHistory' ? windowB : windowA

  const cardA = useTeamMetricsFetch(sport, teamA, windowA, true)
  const cardB = useTeamMetricsFetch(sport, cardBTeam, cardBWindow, mode !== 'single')

  const teamLabelFor = (code: string) => roster.find((t) => t.code === code)?.nickname ?? code

  const selectStyle: React.CSSProperties = {
    backgroundColor: C.surface2,
    border: `1px solid ${C.border}`,
    color: C.textBright,
  }

  return (
    // h-dvh + overflow-y-auto, not min-h-dvh — body has a global
    // `overflow: hidden` (src/index.css), so every data page scrolls inside
    // its own capped-height container (same as the charts pages) rather
    // than relying on normal page/body scroll, which has nowhere to go.
    // Reported 2026-10-01: content taller than the viewport (the two-card
    // comparison modes especially) was invisible below the fold with no way
    // to reach it short of browser zoom.
    <div className="h-dvh w-full overflow-y-auto" style={{ backgroundColor: C.surface, color: C.textBright, fontFamily: 'monospace' }}>
      {/* Mobile (reported 2026-10-01): {HOMEPAGE}+{sports} ran off-screen on
          one row — stacks {sports} underneath {HOMEPAGE} on mobile, same
          treatment as the other chart pages; desktop stays the original row.
          Nav order (2026-10-04, owner): {sports} {charts} {HOMEPAGE} left to
          right, HOMEPAGE furthest right. */}
      <div className={`flex gap-3 px-6 py-4 ${isMobile ? 'flex-col' : 'items-center justify-between'}`} style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          {/* Bordered badge, not a `{brace}` button — this is the page's own
              logo/title, not an actionable link, same treatment as the
              nspe.dev logo on the homepage (reported 2026-10-04: braces made
              it read as a fourth nav button next to {sports}/{charts}/
              {HOMEPAGE}). */}
          <span
            className="font-mono font-bold text-[15px] rounded px-2 py-1"
            style={{ color: C.accent, border: `1px solid ${C.accent}` }}
          >
            {label}
          </span>
          <span className="ml-2 font-mono text-[12px]" style={{ color: C.textDim }}>
            team production, what they do vs. what they allow
          </span>
        </div>
        <div className={`flex gap-2 ${isMobile ? 'flex-col items-start' : 'items-center gap-4'}`}>
          {/* Mobile: this sits flush-left (items-start, above) with little
              room to its left, so the default leftward-opening menu ran
              off-screen (owner report, 2026-10-19) — opens rightward there
              instead. Desktop's row layout has room to spare, unchanged. */}
          <SportsSwitcher current={sport} variant="metrics" align={isMobile ? 'left' : 'right'} />
          <a
            href={chartsHrefFor(sport)}
            className="font-mono text-[13px] underline hover:opacity-80 transition-opacity"
            style={{ color: C.accent }}
          >
            {'{charts}'}
          </a>
          <HomeLogoLink fontSizePx={13} />
        </div>
      </div>

      <div className="px-6 py-4 flex flex-wrap items-center gap-2">
        {MODE_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setMode(t.key)}
            className="font-mono text-[12px] px-3 py-1.5 rounded transition-opacity hover:opacity-80"
            style={{
              backgroundColor: mode === t.key ? 'oklch(0.20 0.03 195)' : C.surface2,
              color: mode === t.key ? C.accent : C.textDim,
              border: `1px solid ${C.border}`,
            }}
          >
            {`{${t.label}}`}
          </button>
        ))}
      </div>

      <div className="px-6 pb-4 flex flex-wrap items-center gap-3 font-mono text-[12px]">
        <label className="flex items-center gap-1.5" style={{ color: C.textDim }}>
          team
          <select value={teamA} onChange={(e) => setTeamA(e.target.value)} className="rounded px-2 py-1" style={selectStyle}>
            {roster.map((t) => <option key={t.code} value={t.code}>{t.nickname}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5" style={{ color: C.textDim }}>
          window
          <select value={windowA} onChange={(e) => setWindowA(e.target.value)} className="rounded px-2 py-1" style={selectStyle}>
            <option value="season">current season</option>
            <option value="history">all-time</option>
            {yearOptions.map((y) => <option key={y} value={y}>{yearOptionLabel(sport, Number(y))}</option>)}
          </select>
        </label>

        {mode === 'vsTeam' && (
          <>
            <span style={{ color: C.textDim }}>vs.</span>
            <label className="flex items-center gap-1.5" style={{ color: C.textDim }}>
              team
              <select value={teamB} onChange={(e) => setTeamB(e.target.value)} className="rounded px-2 py-1" style={selectStyle}>
                {roster.map((t) => <option key={t.code} value={t.code}>{t.nickname}</option>)}
              </select>
            </label>
          </>
        )}

        {mode === 'vsHistory' && (
          <>
            <span style={{ color: C.textDim }}>vs.</span>
            <label className="flex items-center gap-1.5" style={{ color: C.textDim }}>
              window
              <select value={windowB} onChange={(e) => setWindowB(e.target.value)} className="rounded px-2 py-1" style={selectStyle}>
                <option value="history">all-time</option>
                {yearOptions.map((y) => <option key={y} value={y}>{yearOptionLabel(sport, Number(y))}</option>)}
              </select>
            </label>
          </>
        )}
      </div>

      {/* Single-team mode used to cap at max-w-[640px] with the whole right
          side of wider viewports sitting empty — that space was only ever a
          placeholder for {vs. another team}'s second card. Now it always
          runs the full md:grid-cols-2 width; single mode just fills the
          second slot with the expanded thresholds panel instead of a second
          TeamMetricsCard (owner ask, 2026-10-16). TeamMetricsCard's own
          compact allows section is hidden in single mode (hideAllows) since
          this panel is showing the same data with more room. */}
      <div className="px-6 pb-10 grid gap-4 md:grid-cols-2">
        {cardA.error && <div className="font-mono text-[12px]" style={{ color: 'oklch(0.75 0.15 30)' }}>{cardA.error}</div>}
        {!cardA.error && !cardA.payload && <div className="font-mono text-[12px]" style={{ color: C.textDim }}>loading…</div>}
        {cardA.payload && (
          <TeamMetricsCard
            payload={cardA.payload}
            teamLabel={teamLabelFor(teamA)}
            fieldGroups={fieldGroups}
            hideAllows={mode === 'single'}
            collapsibleAllows={sport !== 'nfl'}
          />
        )}

        {mode === 'single' && (
          cardA.payload ? (
            <OpponentThresholdsPanel payload={cardA.payload} teamLabel={teamLabelFor(teamA)} collapsible={sport !== 'nfl'} />
          ) : !cardA.error ? (
            <div className="font-mono text-[12px]" style={{ color: C.textDim }}>loading…</div>
          ) : null
        )}

        {mode !== 'single' && (
          <>
            {cardB.error && <div className="font-mono text-[12px]" style={{ color: 'oklch(0.75 0.15 30)' }}>{cardB.error}</div>}
            {!cardB.error && !cardB.payload && <div className="font-mono text-[12px]" style={{ color: C.textDim }}>loading…</div>}
            {cardB.payload && (
              <TeamMetricsCard payload={cardB.payload} teamLabel={teamLabelFor(cardBTeam)} fieldGroups={fieldGroups} collapsibleAllows={sport !== 'nfl'} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
