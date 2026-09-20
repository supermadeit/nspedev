import { useState, useMemo, useEffect, useRef } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'

export type QueryMode = 'trend' | 'compute' | 'streak' | 'h2h' | 'team' | 'explosive'
export type SeasonType = 'post' | ''
export type PeriodType = 'q1' | '1h' | ''
export type ComputeWindow = '-season' | '-career' | '-last' | ''
export type TeamStat = 'runs' | 'allowed' | ''
export type ExplosiveLeague = 'mlb' | 'nfl'
export type MlbFirstPaFlag = 'xbh' | 'walk' | 'single' | 'hit' | ''
export type NflStatType = 'yds' | 'td' | 'total'

// NBA's 3 combo stats ("pts+ast"/"pts+reb"/"reb+ast" in STAT_FIELDS) are
// typed with each half separately dash-flagged and slash-joined —
// "-pts/-ast35", not "-pts+ast35" — confirmed against a real combo-trend
// backend response: the response's own query.short still comes back
// "pts+ast" internally (which is why STAT_FIELDS/detectStatContext keep
// using "+" as the internal key), but that's not the syntax the backend
// accepts as *input* — sending "-pts+ast35" returns no results. Only stat
// keys containing "+" need reformatting here; everything else passes
// through unchanged.
function formatStatFlag(stat: string, suffix: string): string {
  if (stat.includes('+')) {
    const [first, second] = stat.split('+')
    return `-${first}/-${second}${suffix}`
  }
  return `-${stat}${suffix}`
}

// pass -> pass+rush combo ("-pr"), rush/rec -> rush+rec combo ("-rr") — the
// two short flags the backend recognizes directly after "nspe nfl", with no
// category word in front (unlike -yds/-td, which need "pass"/"rush"/"rec"
// first).
function nflComboCode(stat: string): 'pr' | 'rr' {
  return stat === 'pass' ? 'pr' : 'rr'
}

// Default combo-yardage threshold, keyed by combo code (see nflComboCode
// above) — a comfortably-clearable single-game value for each. Used both as
// the trend "-pr{N}/-rr{N}" default and the compute "min{N}" default, since
// both share the same season-start single-game window pin as the rest of
// NFL right now.
export const NFL_COMBO_DEFAULT: Record<'pr' | 'rr', number> = { pr: 250, rr: 80 }
// 'exact' has no reachable UI on desktop anymore (the {exact} button was
// removed — see the compute-mode threshold Pills below), but stays in the
// type purely so the paused mobile calculator (BuilderScreen.tsx /
// useCalculatorQuery.ts, which still has a live {exact} button) keeps
// compiling — same reasoning as SeasonType above.
export type ThresholdMode = 'min' | 'range' | 'exact'

interface PersistedBuilderState {
  mode: QueryMode
  sport: string
  period: PeriodType
  yearFilter: string
  stat: string
  thresholdN: string
  lastA: string
  lastB: string
  minN: string
  maxN: string
  thresholdMode: ThresholdMode
  computeWindow: ComputeWindow
  windowN: string
  streakN: string
  h2hPlayer: string
  h2hOpponent: string
  teamStat: TeamStat
  teamSubMode: 'trend' | 'compute'
  batPosition: string
  mlbFirstFlag: MlbFirstPaFlag
  nflStatType: NflStatType
  nflCombo: boolean
  explosiveLeague: ExplosiveLeague
  nflPlayType: string
  nflYds: string
  nflExplosiveSubMode: 'trend' | 'compute'
  nflMinYds: string
}

export interface PopularPlayer {
  player: string
  team: string
}

const MLB_POSITIONS = [
  { value: 'c', label: 'C', title: 'Catcher' },
  { value: 'of', label: 'OF', title: 'Outfielder' },
  { value: 'ss', label: 'SS', title: 'Shortstop' },
  { value: '1b', label: '1B', title: 'First Base' },
  { value: '2b', label: '2B', title: 'Second Base' },
  { value: '3b', label: '3B', title: 'Third Base' },
  { value: 'dh', label: 'DH', title: 'Designated Hitter' },
]

// All 30 MLB team abbreviations matching backend codes (e.g. ATH for Athletics).
const MLB_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BOS', 'CHC', 'CWS', 'CIN', 'CLE', 'COL', 'DET',
  'HOU', 'KC', 'LAA', 'LAD', 'MIA', 'MIL', 'MIN', 'NYM', 'NYY', 'ATH',
  'PHI', 'PIT', 'SD', 'SEA', 'SF', 'STL', 'TB', 'TEX', 'TOR', 'WSH',
]

const STORAGE_KEY_DESKTOP = 'nspe.queryBuilder.desktop.v1'
const STORAGE_KEY_MOBILE = 'nspe.queryBuilder.mobile.v1'

function loadPersistedState(key: string): Partial<PersistedBuilderState> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const NBA_HALF_STATS = new Set(['pts', 'tpm'])

export const SPORTS = [
  { value: 'nba', label: 'NBA', comingSoon: false },
  { value: 'mlb', label: 'MLB', comingSoon: false },
  { value: 'nhl', label: 'NHL', comingSoon: false },
  { value: 'nfl', label: 'NFL', comingSoon: false },
]

export const SPORT_STATS: Record<string, Array<{ value: string; label: string }>> = {
  nba: [
    { value: 'pts', label: 'PTS' },
    { value: 'reb', label: 'REB' },
    { value: 'ast', label: 'AST' },
    { value: 'stl', label: 'STL' },
    { value: 'blk', label: 'BLK' },
    { value: 'tpm', label: '3PM' },
    { value: 'pts+ast', label: 'PTS+AST' },
    { value: 'pts+reb', label: 'PTS+REB' },
    { value: 'reb+ast', label: 'REB+AST' },
    { value: 'stl+blk', label: 'STL+BLK' },
    { value: 'total', label: 'TOTAL' },
  ],
  mlb: [
    { value: 'hits', label: 'HITS' },
    { value: 'hr', label: 'HR' },
    { value: 'rbi', label: 'RBI' },
    { value: 'runs', label: 'RUN' },
    { value: 'dub', label: 'DUB' },
    { value: 'trp', label: 'TRIP' },
    { value: 'sb', label: 'SB' },
    { value: 'bb', label: 'BB' },
    { value: 'tb', label: 'TB' },
  ],
  nhl: [
    { value: 'g', label: 'G' },
    { value: 'a', label: 'A' },
    { value: 'pts', label: 'PTS' },
    { value: 'sog', label: 'SOG' },
    // Shelved, not deleted — the backend has no NHL blocked-shots data yet
    // (see predictiveCommands.ts's NHL notes). Restore with its presets below.
    // { value: 'blk', label: 'BLK' },
  ],
  nfl: [
    { value: 'rush', label: 'RUSH' },
    { value: 'pass', label: 'PASS' },
    { value: 'rec', label: 'REC' },
  ],
}

// Preset dropdown values per sport+stat for the trend/streak threshold and
// compute min/max. Anything not covered here falls back to GENERIC_THRESHOLD.
// These are starting points, not tuned against real usage — easy to retune
// later, NumSelect's "Other…" fallback covers anything missed.
export const GENERIC_THRESHOLD = [1, 2, 3, 5, 8, 10]
export const THRESHOLD_PRESETS: Record<string, Record<string, number[]>> = {
  nba: {
    pts: [10, 15, 20, 25, 30, 35, 40, 50],
    reb: [5, 8, 10, 12, 15],
    ast: [5, 8, 10, 12, 15],
    stl: [1, 2, 3, 4, 5],
    blk: [1, 2, 3, 4, 5],
    tpm: [2, 3, 4, 5, 6, 8],
    'pts+ast': [20, 25, 30, 35, 40, 45, 50],
    'pts+reb': [20, 25, 30, 35, 40, 45, 50],
    'reb+ast': [10, 15, 20, 25, 30],
    'stl+blk': [2, 3, 4, 5, 6],
    total: [30, 35, 40, 45, 50],
  },
  mlb: {
    hits: [1, 2, 3, 4],
    hr: [1, 2, 3],
    rbi: [1, 2, 3, 4, 5],
    runs: [1, 2, 3, 4],
    dub: [1, 2],
    trp: [1],
    sb: [1, 2, 3],
    bb: [1, 2, 3],
    tb: [2, 3, 4, 5, 6],
  },
  nhl: {
    g: [1, 2, 3],
    a: [1, 2, 3],
    pts: [1, 2, 3, 4],
    sog: [2, 3, 4, 5, 6, 8],
    // blk: [1, 2, 3, 4], // shelved with the BLK stat button above
  },
}
export const NFL_YDS_PRESETS = [50, 100, 150, 200, 250, 300, 350, 400]
export const NFL_TD_PRESETS = [1, 2, 3, 4, 5]
export const STREAK_N_PRESETS = [2, 3, 4, 5, 6, 8, 10]
export const WINDOW_MET_PRESETS = [1, 2, 3, 4, 5, 6, 8, 10]
export const WINDOW_LAST_PRESETS = [1, 3, 5, 10, 15, 20, 25, 30]
// Leading 1 added for NFL's season-start default (see the compute default-
// fill effect below) — a full "-last1" window until there's enough season
// depth for the wider presets to make sense again.
export const COMPUTE_WINDOW_N_PRESETS = [1, 3, 5, 10, 15, 20, 25, 30]
// Compute asks for a TOTAL over the window (e.g. every stat over the last 10
// games), not a per-game amount — reusing the trend per-game presets here
// made queries like "min2 -last10" trivially match almost the whole roster,
// since a couple of games with the stat is nothing over a 10-game stretch.
// Scale up so the range (and the default, which uses the smallest value)
// reflects a genuinely selective total instead of a floor everyone clears.
export const COMPUTE_SCALE = 5
// Legacy ×COMPUTE_SCALE totals — kept only because the paused mobile
// calculator (BuilderScreen.tsx / useCalculatorQuery.ts) still imports them;
// the desktop builder uses nflComputePresets below instead.
export const NFL_YDS_COMPUTE_PRESETS = NFL_YDS_PRESETS.map((n) => n * COMPUTE_SCALE)
export const NFL_TD_COMPUTE_PRESETS = NFL_TD_PRESETS.map((n) => n * COMPUTE_SCALE)
// NFL compute defaults to a single-game window (-last1), so its presets are
// single-game numbers a real performance can land on, by stat — not the
// ×COMPUTE_SCALE totals the multi-game sports use. Combos ("-pr"/"-rr") and
// touchdowns get their own ranges; a wider window is still reachable via
// the number picker's "other".
export function nflComputePresets(stat: string, statType: string, combo: boolean): number[] {
  if (statType === 'td') return [1, 2, 3, 4, 5]
  if (combo) return stat === 'pass' ? [200, 250, 300, 350, 400] : [60, 80, 100, 120, 150]
  if (stat === 'pass') return [150, 200, 250, 300, 350, 400]
  return [50, 75, 100, 125, 150, 200]
}
export const TEAM_RUNS_TREND_PRESETS = [3, 4, 5, 6, 7, 8, 10]
export const TEAM_RUNS_COMPUTE_PRESETS = [10, 15, 20, 25, 30, 35, 40]
export const EXPLOSIVE_NFL_TREND_PRESETS = [20, 25, 30, 40, 50, 60, 75, 100]
export const EXPLOSIVE_NFL_COMPUTE_PRESETS = [20, 25, 30, 35, 40, 45, 50]
export const EXPLOSIVE_MLB_TREND_PRESETS = [350, 375, 400, 425, 450, 475, 500, 525]
export const EXPLOSIVE_MLB_COMPUTE_PRESETS = [300, 400, 500, 600, 750, 1000]
// Per-stat overrides for compute mode, when the generic COMPUTE_SCALE ×5
// rule doesn't land on a sensible range (e.g. "total" points+rebounds+
// assists is naturally larger-scale than a single stat, so ×5 overshoots).
// Checked before the generic scaling in computeThresholdPresetsFor below.
export const COMPUTE_PRESET_OVERRIDES: Record<string, Record<string, number[]>> = {
  nba: {
    total: [80, 100, 120, 140, 160],
    // pts' own ×5 scaling (trend preset 10 → 50) starts too high for a
    // compute-mode "total over the window" ask — 30, stepping by 10 to 100,
    // matches the requested range directly.
    pts: [30, 40, 50, 60, 70, 80, 90, 100],
  },
}

// Compute-mode single-game bases that differ from the trend presets — NHL
// points start at 2 (a "2 points over last 2" ask is reasonable; 1 is not
// selective enough to be worth a chip).
const COMPUTE_BASE_OVERRIDES: Record<string, Record<string, number[]>> = {
  nhl: { pts: [2, 3, 4] },
}

export function thresholdPresetsFor(sport: string, stat: string): number[] {
  return THRESHOLD_PRESETS[sport]?.[stat] ?? GENERIC_THRESHOLD
}

// How much a compute window widens the reachable totals — deliberately
// gentle (well under a straight ×window), since the per-game numbers are the
// point of the presets and a wider window only needs a few bigger targets.
function windowFactor(computeWindow: string, windowN: string): number {
  if (computeWindow === '-season') return 10
  if (computeWindow === '-career') return 15
  const n = computeWindow === '-last' ? Number(windowN) || 1 : 1
  if (n <= 1) return 1
  if (n <= 3) return 2
  if (n <= 5) return 3
  if (n <= 10) return 5
  if (n <= 20) return 8
  return 12
}

// Compute presets for the window in play: the single-game values ALWAYS stay
// (someone may genuinely want "200 rushing in one game" even on a -last10
// window) with a few larger window-scaled targets added alongside. NBA's
// hand-tuned overrides are treated as the ×5 ("last10") set and rescaled from
// there.
export function computePresetsForWindow(
  sport: string,
  stat: string,
  computeWindow: string,
  windowN: string,
  nfl?: { statType: string; combo: boolean },
): number[] {
  const f = windowFactor(computeWindow, windowN)
  if (sport === 'nfl' && nfl) {
    const base = nflComputePresets(stat, nfl.statType, nfl.combo)
    return f === 1 ? base : [...new Set([...base, ...base.map((n) => n * f)])].sort((a, b) => a - b)
  }
  const base = COMPUTE_BASE_OVERRIDES[sport]?.[stat] ?? thresholdPresetsFor(sport, stat)
  if (f === 1) return base
  const override = COMPUTE_PRESET_OVERRIDES[sport]?.[stat]
  const scaled = override ? override.map((n) => Math.round((n * f) / 5)) : base.map((n) => n * f)
  return [...new Set([...base, ...scaled])].sort((a, b) => a - b)
}

export function computeThresholdPresetsFor(sport: string, stat: string): number[] {
  const override = COMPUTE_PRESET_OVERRIDES[sport]?.[stat]
  if (override) return override
  return thresholdPresetsFor(sport, stat).map((n) => n * COMPUTE_SCALE)
}

// Season year selector — replaces the old postseason toggle entirely.
// Visible as individual {YY} pills for the most recent 7 years (styled like
// H2H's opponent-team buttons — see MLB_TEAMS above), plus an {older}
// dropdown for 2010–2019. Bump both ranges by hand as seasons roll over
// rather than deriving from the current date, same reasoning YEAR_OPTIONS
// used to have — season-start timing doesn't map cleanly to a calendar
// cutoff. Pre-2010 seasons (career-spanning players like LeBron/Rodgers go
// back to 2005) aren't reachable from this picker yet — a manual YYYY input
// is the planned follow-up for that, not built here.
export const SEASON_YEARS_VISIBLE: number[] = []
for (let y = 2026; y >= 2020; y -= 1) SEASON_YEARS_VISIBLE.push(y)
export const SEASON_YEARS_OLDER: number[] = []
for (let y = 2019; y >= 2010; y -= 1) SEASON_YEARS_OLDER.push(y)

export const C = {
  accent: 'oklch(0.85 0.15 195)',
  accentDark: 'oklch(0.10 0.02 195)',
  accentDim: 'oklch(0.55 0.12 195)',
  surface2: 'oklch(0.20 0 0)',
  border: 'oklch(0.28 0 0)',
  textDim: 'oklch(0.48 0 0)',
  textBright: 'oklch(0.88 0 0)',
}

function Pill({
  children,
  selected,
  onClick,
  disabled,
}: {
  children: string
  selected: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      className="font-mono text-[11px] px-3 py-1.5 rounded border transition-colors select-none"
      style={{
        backgroundColor: selected ? C.accent : C.surface2,
        color: selected ? C.accentDark : disabled ? C.textDim : C.textBright,
        borderColor: selected ? C.accent : C.border,
        opacity: disabled ? 0.38 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: selected ? 700 : 400,
      }}
    >
      {children}
    </button>
  )
}

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono text-[10px] uppercase tracking-widest mb-1.5"
      style={{ color: C.textDim }}
    >
      {children}
    </div>
  )
}

function NumInput({
  value,
  onChange,
  placeholder,
  w = 60,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  w?: number
  autoFocus?: boolean
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
      placeholder={placeholder ?? 'N'}
      autoFocus={autoFocus}
      className="font-mono text-[13px] rounded border px-2 py-1.5 outline-none"
      style={{
        width: `${w}px`,
        backgroundColor: C.surface2,
        borderColor: C.border,
        color: C.accent,
      }}
    />
  )
}

const selectClass =
  'font-mono text-[13px] rounded border px-2 py-1.5 outline-none appearance-none'
const selectStyle = {
  backgroundColor: C.surface2,
  borderColor: C.border,
  color: C.accent,
}

// Horizontal row of tappable preset chips with a trailing "other" chip that
// turns into a numeric input (inputMode="numeric" -> phone numpad) for any
// value the presets didn't anticipate. Replaced the native <select>: one tap
// instead of open-list-then-pick, and the range of sensible values is
// visible at a glance. The `w` prop is kept only so existing call sites
// (which sized the old select) keep compiling; chips size themselves.
function NumSelect({
  value,
  onChange,
  options,
  placeholder = 'N',
}: {
  value: string
  onChange: (v: string) => void
  options: number[]
  placeholder?: string
  w?: number
}) {
  const isCustom = value !== '' && !options.includes(Number(value))
  const [otherOpen, setOtherOpen] = useState(isCustom)
  // Only auto-focus the input when the user actively taps "other" — never on
  // a fresh mount that restored a persisted custom value, which would pop
  // the mobile keyboard the instant the builder opens with no user action.
  const hasMountedRef = useRef(false)
  useEffect(() => {
    hasMountedRef.current = true
  }, [])
  // A preset value arriving from elsewhere (default-fill, stat change)
  // closes a stale open "other" input.
  useEffect(() => {
    if (value !== '' && options.includes(Number(value))) setOtherOpen(false)
  }, [value, options])

  const chip = (selected: boolean): React.CSSProperties => ({
    backgroundColor: selected ? C.accent : C.surface2,
    color: selected ? C.accentDark : C.textBright,
    borderColor: selected ? C.accent : C.border,
    fontWeight: selected ? 700 : 400,
    cursor: 'pointer',
  })
  const chipClass = 'font-mono text-[12px] min-w-[38px] px-2.5 py-1.5 rounded border transition-colors select-none text-center'

  return (
    <div className="flex flex-wrap items-center gap-1.5 max-w-[300px]">
      {options.map((n) => {
        const selected = !otherOpen && value === String(n)
        return (
          <button
            key={n}
            type="button"
            className={chipClass}
            style={chip(selected)}
            onClick={() => {
              setOtherOpen(false)
              onChange(selected ? '' : String(n))
            }}
          >
            {n}
          </button>
        )
      })}
      {otherOpen ? (
        <div className="flex items-center gap-1">
          <NumInput value={value} onChange={onChange} placeholder={placeholder} w={64} autoFocus={hasMountedRef.current} />
          <button
            type="button"
            className="font-mono text-[11px] px-1.5 py-1.5 rounded border"
            style={{ ...selectStyle, cursor: 'pointer' }}
            title="Back to presets"
            onClick={() => {
              setOtherOpen(false)
              onChange('')
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={chipClass}
          style={{ ...chip(isCustom), borderStyle: 'dashed' }}
          onClick={() => {
            setOtherOpen(true)
            onChange('')
          }}
        >
          {isCustom ? value : 'other'}
        </button>
      )}
    </div>
  )
}

export interface QueryBuilderProps {
  onRunQuery: (query: string) => void
  isLoading: boolean
  popularPlayers?: PopularPlayer[]
}

export function QueryBuilder({ onRunQuery, isLoading, popularPlayers = [] }: QueryBuilderProps) {
  const isMobile = useIsMobile()
  const storageKey = isMobile ? STORAGE_KEY_MOBILE : STORAGE_KEY_DESKTOP
  const initial = useMemo(() => loadPersistedState(storageKey) ?? {}, [storageKey])

  const [mode, setMode] = useState<QueryMode>(initial.mode ?? 'trend')
  const [sport, setSport] = useState(initial.sport ?? '')
  const [period, setPeriod] = useState<PeriodType>(initial.period ?? '')
  // Explicit season year, any sport — blank means current season. Replaces
  // the old postseason toggle entirely (see SEASON_YEARS_VISIBLE/_OLDER):
  // picking a specific past year already covers what "post" used to mean
  // for most queries, and a manual YYYY input for pre-2010 seasons (Lebron/
  // Rodgers-era players) is a known follow-up, not built yet.
  const [yearFilter, setYearFilter] = useState(initial.yearFilter ?? '')
  const [stat, setStat] = useState(initial.stat ?? '')
  // trend
  const [thresholdN, setThresholdN] = useState(initial.thresholdN ?? '')
  const [lastA, setLastA] = useState(initial.lastA ?? '')
  const [lastB, setLastB] = useState(initial.lastB ?? '')
  // compute
  const [minN, setMinN] = useState(initial.minN ?? '')
  const [maxN, setMaxN] = useState(initial.maxN ?? '')
  const [thresholdMode, setThresholdMode] = useState<ThresholdMode>(initial.thresholdMode ?? 'min')
  const [computeWindow, setComputeWindow] = useState<ComputeWindow>(initial.computeWindow ?? '')
  const [windowN, setWindowN] = useState(initial.windowN ?? '')
  // streak
  const [streakN, setStreakN] = useState(initial.streakN ?? '')
  // h2h (batter)
  const [h2hPlayer, setH2hPlayer] = useState(initial.h2hPlayer ?? '')
  const [h2hOpponent, setH2hOpponent] = useState(initial.h2hOpponent ?? '')
  // team (runs scored/allowed)
  const [teamStat, setTeamStat] = useState<TeamStat>(initial.teamStat ?? '')
  const [teamSubMode, setTeamSubMode] = useState<'trend' | 'compute'>(initial.teamSubMode ?? 'trend')
  // batter position (MLB only)
  const [batPosition, setBatPosition] = useState(initial.batPosition ?? '')
  // first plate appearance (MLB trend only)
  const [mlbFirstFlag, setMlbFirstFlag] = useState<MlbFirstPaFlag>(initial.mlbFirstFlag ?? '')
  // NFL stat type: yards or touchdowns, applies to rush/pass/rec
  const [nflStatType, setNflStatType] = useState<NflStatType>(initial.nflStatType ?? 'yds')
  // Combo toggle (pass+rush / rush+rec), independent of nflStatType so -td
  // stays selectable alongside it instead of being mutually exclusive — see
  // the {rush+rec} button's comment below for the full command mapping.
  const [nflCombo, setNflCombo] = useState(initial.nflCombo ?? false)
  // explosive (NFL long plays / MLB long HR)
  const [explosiveLeague, setExplosiveLeague] = useState<ExplosiveLeague>(initial.explosiveLeague ?? 'nfl')
  const [nflPlayType, setNflPlayType] = useState(initial.nflPlayType ?? '')
  // yards threshold for nfl, HR distance in feet for mlb
  const [nflYds, setNflYds] = useState(initial.nflYds ?? '')
  const [nflExplosiveSubMode, setNflExplosiveSubMode] = useState<'trend' | 'compute'>(initial.nflExplosiveSubMode ?? 'trend')
  const [nflMinYds, setNflMinYds] = useState(initial.nflMinYds ?? '')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload: PersistedBuilderState = {
      mode, sport, period, yearFilter, stat,
      thresholdN, lastA, lastB,
      minN, maxN, thresholdMode, computeWindow, windowN,
      streakN,
      h2hPlayer, h2hOpponent,
      teamStat, teamSubMode,
      batPosition, mlbFirstFlag, nflStatType, nflCombo,
      explosiveLeague, nflPlayType, nflYds,
      nflExplosiveSubMode, nflMinYds,
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      // ignore quota / unavailable storage
    }
  }, [storageKey, mode, sport, period, yearFilter, stat, thresholdN, lastA, lastB, minN, maxN, thresholdMode, computeWindow, windowN, streakN, h2hPlayer, h2hOpponent, teamStat, teamSubMode, batPosition, mlbFirstFlag, nflStatType, nflCombo, explosiveLeague, nflPlayType, nflYds, nflExplosiveSubMode, nflMinYds])

  const isNbaHalfPeriod = sport === 'nba' && period === '1h'
  const computeMinPresets = computePresetsForWindow(sport, stat, computeWindow, windowN, {
    statType: nflStatType,
    combo: nflCombo,
  })
  // Optional controls (period, first PA, batter position, season) live behind
  // one toggle so the default view is just sport / stat / threshold. Stays
  // open on its own whenever one of them already holds a value, so a set
  // option can never be hidden out from under the user.
  const [showMore, setShowMore] = useState(false)
  const optionalOpen = showMore || Boolean(period || mlbFirstFlag || batPosition || yearFilter)
  const allStats = SPORT_STATS[sport] ?? []
  const stats = isNbaHalfPeriod
    ? allStats.filter((s) => NBA_HALF_STATS.has(s.value))
    : allStats

  const handleSportSelect = (s: string) => {
    setSport((prev) => (prev === s ? '' : s))
    setStat('')
    // 1h is NBA-only — clear if switching away
    if (s !== 'nba' && period === '1h') {
      setPeriod('')
    }
    // MLB has no q1 yet — clear q1 if switching to MLB
    if (s === 'mlb' && period === 'q1') {
      setPeriod('')
    }
    // position filter is MLB-only — clear when switching away
    if (s !== 'mlb') {
      setBatPosition('')
    }
  }

  const handleModeSelect = (m: QueryMode) => {
    setMode(m)
    // h2h, team are MLB-only — force sport to mlb when switching in.
    if ((m === 'h2h' || m === 'team') && sport !== 'mlb') {
      setSport('mlb')
      setStat('')
      if (period === '1h' || period === 'q1') setPeriod('')
    }
    // explosive has its own league toggle (mlb/nfl), separate from the generic sport picker.
    if (m === 'explosive') {
      setStat('')
      if (period === '1h' || period === 'q1') setPeriod('')
      setBatPosition('')
    }
  }

  const handlePeriodSelect = (p: PeriodType) => {
    setPeriod((prev) => (prev === p ? '' : p))
    // when entering 1h, stat must be pts or tpm
    if (p === '1h' && stat && !NBA_HALF_STATS.has(stat)) {
      setStat('')
    }
  }

  const builtCommand = useMemo(() => {
    // Explosive: trend or compute, mlb (HR distance) or nfl (long plays)
    if (mode === 'explosive') {
      if (explosiveLeague === 'mlb') {
        if (nflExplosiveSubMode === 'compute') {
          if (!nflMinYds) return ''
          const parts = ['nspe', 'mlb', 'long', `-hr`, `min${nflMinYds}`]
          if (windowN) parts.push(`-last${windowN}`)
          return parts.join(' ')
        }
        if (!nflYds || !lastA || !lastB) return ''
        return `nspe mlb long -hr${nflYds} -last${lastA}/${lastB}`
      }
      if (!nflPlayType) return ''
      if (nflExplosiveSubMode === 'compute') {
        if (!nflMinYds) return ''
        return `nspe nfl long ${nflPlayType} -yds min${nflMinYds} -season`
      }
      if (!nflYds || !lastA || !lastB) return ''
      return `nspe nfl long ${nflPlayType} -yds${nflYds} -last${lastA}/${lastB}`
    }

    if (mode === 'h2h') {
      const player = h2hPlayer.trim()
      if (!player || !h2hOpponent) return ''
      return `nspe mlb ${player.toLowerCase()} vs ${h2hOpponent}`
    }

    if (mode === 'team') {
      if (!teamStat) return ''
      const parts = ['nspe', 'mlb', 'team']
      if (teamSubMode === 'trend') {
        parts.push(`-${teamStat}${thresholdN}`)
        if (lastA && lastB) parts.push(`-last${lastA}/${lastB}`)
      } else {
        parts.push(`-${teamStat}`)
        if (thresholdMode === 'min') {
          if (minN) parts.push(`min${minN}`)
        } else if (thresholdMode === 'range') {
          if (minN) parts.push(`min${minN}`)
          if (maxN) parts.push(`max${maxN}`)
        }
        if (computeWindow === '-season') parts.push('-season')
        else if (computeWindow === '-last' && windowN) parts.push(`-last${windowN}`)
      }
      return parts.join(' ')
    }

    if (mode === 'trend' && sport === 'mlb' && mlbFirstFlag) {
      if (!lastA || !lastB) return ''
      return `nspe mlb first -${mlbFirstFlag} -last${lastA}/${lastB}`
    }

    if (!sport) return ''

    const parts: string[] = ['nspe', sport]

    if (sport === 'mlb' && batPosition) parts.push(batPosition)
    if (period === 'q1') {
      if (sport === 'nhl') parts.push('p1')
      else if (sport !== 'mlb') parts.push('q1')
    }
    else if (period === '1h') parts.push('1h')

    if (mode === 'trend') {
      if (stat) {
        if (sport === 'nfl') {
          if (nflCombo && nflStatType === 'td') {
            // Combo + td is the "anytime TD" concept — the backend's own
            // engine for this is a distinct "any" category (rush_td +
            // rec_td summed), not a per-category -td flag, regardless of
            // which of the three categories happens to be selected.
            parts.push('any')
            parts.push(`-td${thresholdN}`)
          } else if (nflCombo) {
            parts.push(`-${nflComboCode(stat)}${thresholdN}`)
          } else {
            parts.push(stat)
            parts.push(`-${nflStatType}${thresholdN}`)
          }
        } else {
          parts.push(formatStatFlag(stat, thresholdN))
        }
      }
      if (lastA && lastB) parts.push(`-last${lastA}/${lastB}`)
    } else if (mode === 'compute') {
      if (stat) {
        if (sport === 'nfl') {
          if (nflCombo && nflStatType === 'td') {
            parts.push('any')
            parts.push('-td')
          } else if (nflCombo) {
            parts.push(`-${nflComboCode(stat)}`)
          } else {
            parts.push(stat)
            parts.push(`-${nflStatType}`)
          }
        } else {
          parts.push(formatStatFlag(stat, ''))
        }
      }
      if (thresholdMode === 'min') {
        if (minN) parts.push(`min${minN}`)
      } else if (thresholdMode === 'range') {
        if (minN) parts.push(`min${minN}`)
        if (maxN) parts.push(`max${maxN}`)
      }
      if (computeWindow === '-season') parts.push('-season')
      else if (computeWindow === '-career') parts.push('-career')
      else if (computeWindow === '-last' && windowN) parts.push(`-last${windowN}`)
    } else if (mode === 'streak') {
      if (stat && streakN) {
        if (sport === 'nfl') {
          parts.push(stat)
          parts.push(`-${nflStatType}${thresholdN}`)
        } else {
          parts.push(formatStatFlag(stat, thresholdN))
        }
      }
      if (streakN) parts.push(`-streak${streakN}`)
    }

    // Explicit season year — replaces the old postseason toggle, any sport,
    // appended as a trailing bare token (matches the backend's
    // `... -first3/5 2020` form / the documented -YYYY shared token, dash
    // optional). Blank means "current season," the backend's own default.
    if (yearFilter) parts.push(yearFilter)

    return parts.join(' ')
  }, [mode, sport, period, yearFilter, stat, thresholdN, lastA, lastB, minN, maxN, thresholdMode, computeWindow, windowN, streakN, h2hPlayer, h2hOpponent, teamStat, teamSubMode, batPosition, mlbFirstFlag, explosiveLeague, nflPlayType, nflYds, nflExplosiveSubMode, nflMinYds, nflStatType, nflCombo])

  const canRun = Boolean(builtCommand) && !isLoading

  const isBuilderQuery = mode === 'trend' || mode === 'compute' || mode === 'streak'
  const firstPaActive = mode === 'trend' && sport === 'mlb' && Boolean(mlbFirstFlag)

  // Pre-fill threshold/window with a sensible default the moment a stat is
  // picked (or the mode changes), so the command preview always shows a
  // complete, valid example — teaching the syntax visually instead of
  // requiring a first-time user to fill in every field by hand.
  useEffect(() => {
    if (mode === 'trend' || mode === 'streak') {
      if (!stat || firstPaActive) return
      // NFL's season just started — a 3/5-style multi-game trend window asks
      // for more games than any player has played yet. Pin to the tightest
      // possible window (met 1 of the last 1 game) instead, revisited once
      // there's enough season depth for a wider window to make sense again.
      if (mode === 'trend' && sport === 'nfl' && nflCombo && nflStatType !== 'td') {
        setThresholdN(String(NFL_COMBO_DEFAULT[nflComboCode(stat)]))
        setLastA('1')
        setLastB('1')
        return
      }
      const presets =
        sport === 'nfl' ? (nflStatType === 'td' ? NFL_TD_PRESETS : NFL_YDS_PRESETS) : thresholdPresetsFor(sport, stat)
      setThresholdN(String(presets[0]))
      if (mode === 'trend') {
        setLastA(sport === 'nfl' ? '1' : '3')
        setLastB(sport === 'nfl' ? '1' : '5')
      } else {
        setStreakN('3')
      }
    } else if (mode === 'compute') {
      if (!stat) return
      setThresholdMode('min')
      if (sport === 'nfl') {
        // Same season-start reasoning as trend, and the ×COMPUTE_SCALE
        // presets below assume a wide multi-game window — with the window
        // pinned to a single game, reuse the unscaled per-game presets
        // instead so the default min value is still one a single game can
        // realistically clear.
        const minDefault =
          nflCombo && nflStatType !== 'td'
            ? NFL_COMBO_DEFAULT[nflComboCode(stat)]
            : nflComputePresets(stat, nflStatType, nflCombo)[stat === 'pass' && nflStatType !== 'td' ? 1 : 0]
        setMinN(String(minDefault))
        setComputeWindow('-last')
        setWindowN('1')
      } else {
        const presets = computeThresholdPresetsFor(sport, stat)
        setMinN(String(presets[0]))
        setComputeWindow('-last')
        setWindowN('10')
      }
    } else if (mode === 'team') {
      if (!teamStat) return
      if (teamSubMode === 'trend') {
        setThresholdN(String(TEAM_RUNS_TREND_PRESETS[0]))
        setLastA('3')
        setLastB('5')
      } else {
        setThresholdMode('min')
        setMinN(String(TEAM_RUNS_COMPUTE_PRESETS[0]))
        setComputeWindow('-last')
        setWindowN('10')
      }
    } else if (mode === 'explosive') {
      const trendPresets = explosiveLeague === 'mlb' ? EXPLOSIVE_MLB_TREND_PRESETS : EXPLOSIVE_NFL_TREND_PRESETS
      const computePresets = explosiveLeague === 'mlb' ? EXPLOSIVE_MLB_COMPUTE_PRESETS : EXPLOSIVE_NFL_COMPUTE_PRESETS
      if (nflExplosiveSubMode === 'trend') {
        setNflYds(String(trendPresets[0]))
        // NFL only — season just started, same 1/1 pin as regular trend.
        // MLB's season is well underway, so its 3/5 default stays as is.
        setLastA(explosiveLeague === 'nfl' ? '1' : '3')
        setLastB(explosiveLeague === 'nfl' ? '1' : '5')
      } else {
        setNflMinYds(String(computePresets[0]))
        if (explosiveLeague === 'mlb') setWindowN('10')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sport, stat, nflStatType, nflCombo, firstPaActive, teamStat, teamSubMode, explosiveLeague, nflExplosiveSubMode])

  // Same idea for MLB first plate appearance — picking a category fills in
  // the met/last window right away.
  useEffect(() => {
    if (!firstPaActive) return
    setLastA('3')
    setLastB('5')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstPaActive])

  return (
    <div className="w-full" style={{ color: C.textBright, fontFamily: 'monospace' }}>
      {/* Mode tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {(['trend', 'compute', 'explosive', 'team', 'h2h'] as QueryMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleModeSelect(m)}
            className="flex-1 min-w-[72px] py-2 text-[12px] font-bold rounded border uppercase tracking-wider transition-colors"
            style={{
              backgroundColor: mode === m ? C.accent : C.surface2,
              color: mode === m ? C.accentDark : C.accentDim,
              borderColor: mode === m ? C.accent : C.border,
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Format hint */}
      <div className="text-[10px] mb-4 leading-relaxed" style={{ color: C.textDim }}>
        {mode === 'trend'
          ? (firstPaActive
            ? '▸ nspe mlb first {-xbh|-walk|-single|-hit} -lastN/N'
            : '▸ nspe {sport} {full/q1} {stat} -lastN/N')
          : mode === 'compute'
          ? '▸ nspe {sport} {stat} minN {-window}'
          : mode === 'streak'
          ? '▸ nspe {sport} {full/q1} {stat} -streakN'
          : mode === 'h2h'
          ? '▸ nspe mlb {player name} vs {TEAM}'
          : mode === 'explosive'
          ? (explosiveLeague === 'mlb'
            ? (nflExplosiveSubMode === 'compute'
              ? '▸ nspe mlb long -hr minN {-lastN}'
              : '▸ nspe mlb long -hrN -lastA/B')
            : (nflExplosiveSubMode === 'compute'
              ? '▸ nspe nfl long {pass|rush|rec} -yds minN -season'
              : '▸ nspe nfl long {pass|rush|rec} -ydsN -lastA/B'))
          : (teamSubMode === 'compute'
            ? '▸ nspe mlb team {-runs|-allowed} minN {maxN} {-season|-lastN}'
            : '▸ nspe mlb team {-runs|-allowed}N -lastA/B')}
      </div>

      {/* Explosive: NFL long plays / MLB long HR */}
      {mode === 'explosive' && (
        <>
          {/* league filter */}
          <div className="mb-3">
            <SLabel>league</SLabel>
            <div className="flex gap-1.5">
              <Pill
                selected={explosiveLeague === 'mlb'}
                onClick={() => setExplosiveLeague('mlb')}
              >
                MLB
              </Pill>
              <Pill
                selected={explosiveLeague === 'nfl'}
                onClick={() => setExplosiveLeague('nfl')}
              >
                NFL
              </Pill>
            </div>
          </div>

          {/* sub-mode toggle */}
          <div className="mb-3">
            <SLabel>mode</SLabel>
            <div className="flex gap-1.5">
              <Pill
                selected={nflExplosiveSubMode === 'trend'}
                onClick={() => setNflExplosiveSubMode('trend')}
              >
                trend
              </Pill>
              <Pill
                selected={nflExplosiveSubMode === 'compute'}
                onClick={() => setNflExplosiveSubMode('compute')}
              >
                compute
              </Pill>
            </div>
          </div>

          {explosiveLeague === 'nfl' && (
            <div className="mb-3">
              <SLabel>play type</SLabel>
              <div className="flex gap-1.5 flex-wrap">
                {(['rush', 'pass', 'rec'] as const).map((pt) => (
                  <Pill
                    key={pt}
                    selected={nflPlayType === pt}
                    onClick={() => setNflPlayType((p) => (p === pt ? '' : pt))}
                  >
                    {pt.toUpperCase()}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          {nflExplosiveSubMode === 'compute' ? (
            <div className="mb-3 flex items-end gap-5 flex-wrap">
              <div>
                <SLabel>{explosiveLeague === 'mlb' ? 'min distance' : 'min yards'}</SLabel>
                <div className="flex items-center gap-2">
                  <NumSelect
                    value={nflMinYds}
                    onChange={setNflMinYds}
                    options={explosiveLeague === 'mlb' ? EXPLOSIVE_MLB_COMPUTE_PRESETS : EXPLOSIVE_NFL_COMPUTE_PRESETS}
                    w={80}
                  />
                  <span className="font-mono text-[11px]" style={{ color: C.textDim }}>
                    {explosiveLeague === 'mlb' ? 'ft' : 'yds  ·  -season'}
                  </span>
                </div>
              </div>
              {explosiveLeague === 'mlb' && (
                <div>
                  <SLabel>-last {'{optional}'}</SLabel>
                  <NumSelect value={windowN} onChange={setWindowN} options={COMPUTE_WINDOW_N_PRESETS} w={70} />
                </div>
              )}
            </div>
          ) : (
            <div className="mb-3 flex items-end gap-5 flex-wrap">
              <div>
                <SLabel>{explosiveLeague === 'mlb' ? 'distance threshold' : 'yards threshold'}</SLabel>
                <div className="flex items-center gap-2">
                  <NumSelect
                    value={nflYds}
                    onChange={setNflYds}
                    options={explosiveLeague === 'mlb' ? EXPLOSIVE_MLB_TREND_PRESETS : EXPLOSIVE_NFL_TREND_PRESETS}
                    w={80}
                  />
                  <span className="font-mono text-[11px]" style={{ color: C.textDim }}>
                    {explosiveLeague === 'mlb' ? 'ft' : 'yds'}
                  </span>
                </div>
              </div>
              <div className="flex items-end gap-1.5">
                <div>
                  <SLabel>met</SLabel>
                  <NumSelect value={lastA} onChange={setLastA} options={WINDOW_MET_PRESETS} w={64} />
                </div>
                <span style={{ color: C.textDim, paddingBottom: '8px' }}>/</span>
                <div>
                  <SLabel>-last</SLabel>
                  <NumSelect value={lastB} onChange={setLastB} options={WINDOW_LAST_PRESETS} w={64} />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* H2H: opponent team + player */}
      {mode === 'h2h' && (
        <>
          <div className="mb-3">
            <SLabel>opponent team</SLabel>
            <div className="flex gap-1.5 flex-wrap">
              {MLB_TEAMS.map((t) => (
                <Pill
                  key={t}
                  selected={h2hOpponent === t}
                  onClick={() => setH2hOpponent((prev) => (prev === t ? '' : t))}
                >
                  {t}
                </Pill>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <SLabel>player name</SLabel>
            <input
              type="text"
              value={h2hPlayer}
              onChange={(e) => setH2hPlayer(e.target.value)}
              placeholder="type any MLB player (e.g. ketel marte)"
              className="w-full font-mono text-[13px] rounded border px-3 py-2 outline-none"
              style={{
                backgroundColor: C.surface2,
                borderColor: C.border,
                color: C.accent,
              }}
            />
          </div>

          {popularPlayers.length > 0 && (
            <div className="mb-3">
              <SLabel>popular {'{'}top {popularPlayers.length}{'}'}</SLabel>
              <div className="flex gap-1.5 flex-wrap">
                {popularPlayers.map((p) => {
                  const selected = h2hPlayer.trim().toLowerCase() === p.player.toLowerCase()
                  return (
                    <Pill
                      key={`${p.team}-${p.player}`}
                      selected={selected}
                      onClick={() => setH2hPlayer(selected ? '' : p.player)}
                    >
                      {`${p.team} ${p.player}`}
                    </Pill>
                  )
                })}
              </div>
              <div className="text-[10px] mt-2" style={{ color: C.textDim }}>
                or type any player name above — not limited to this list
              </div>
            </div>
          )}
        </>
      )}

      {/* Team: runs scored/allowed */}
      {mode === 'team' && (
        <>
          <div className="mb-3">
            <SLabel>mode</SLabel>
            <div className="flex gap-1.5">
              <Pill selected={teamSubMode === 'trend'} onClick={() => setTeamSubMode('trend')}>
                trend
              </Pill>
              <Pill selected={teamSubMode === 'compute'} onClick={() => setTeamSubMode('compute')}>
                compute
              </Pill>
            </div>
          </div>

          <div className="mb-3">
            <SLabel>stat</SLabel>
            <div className="flex gap-1.5 flex-wrap">
              <Pill
                selected={teamStat === 'runs'}
                onClick={() => setTeamStat((p) => (p === 'runs' ? '' : 'runs'))}
              >
                -runs
              </Pill>
              <Pill
                selected={teamStat === 'allowed'}
                onClick={() => setTeamStat((p) => (p === 'allowed' ? '' : 'allowed'))}
              >
                -allowed
              </Pill>
            </div>
          </div>

          {teamSubMode === 'trend' && teamStat && (
            <div className="mb-3 flex items-end gap-5 flex-wrap">
              <div>
                <SLabel>threshold</SLabel>
                <NumSelect value={thresholdN} onChange={setThresholdN} options={TEAM_RUNS_TREND_PRESETS} w={64} />
              </div>
              <div className="flex items-end gap-1.5">
                <div>
                  <SLabel>met</SLabel>
                  <NumSelect value={lastA} onChange={setLastA} options={WINDOW_MET_PRESETS} w={64} />
                </div>
                <span style={{ color: C.textDim, paddingBottom: '8px' }}>/</span>
                <div>
                  <SLabel>-last</SLabel>
                  <NumSelect value={lastB} onChange={setLastB} options={WINDOW_LAST_PRESETS} w={64} />
                </div>
              </div>
            </div>
          )}

          {teamSubMode === 'compute' && teamStat && (
            <div className="mb-3">
              <div className="mb-2">
                <SLabel>threshold</SLabel>
                <div className="flex gap-1.5 flex-wrap">
                  <Pill
                    selected={thresholdMode === 'min'}
                    onClick={() => {
                      setThresholdMode('min')
                      setMaxN('')
                    }}
                  >
                    min
                  </Pill>
                  <Pill
                    selected={thresholdMode === 'range'}
                    onClick={() => setThresholdMode('range')}
                  >
                    min - max
                  </Pill>
                </div>
              </div>
              <div className="mb-3 flex items-end gap-2">
                {thresholdMode === 'min' && (
                  <div>
                    <SLabel>min value</SLabel>
                    <NumSelect value={minN} onChange={setMinN} options={TEAM_RUNS_COMPUTE_PRESETS} w={80} />
                  </div>
                )}
                {thresholdMode === 'range' && (
                  <>
                    <div>
                      <SLabel>min</SLabel>
                      <NumSelect value={minN} onChange={setMinN} options={TEAM_RUNS_COMPUTE_PRESETS} w={80} />
                    </div>
                    <span style={{ color: C.textDim, paddingBottom: '8px' }}>—</span>
                    <div>
                      <SLabel>max</SLabel>
                      <NumSelect value={maxN} onChange={setMaxN} options={TEAM_RUNS_COMPUTE_PRESETS} w={80} />
                    </div>
                  </>
                )}
              </div>
              <SLabel>window</SLabel>
              <div className="flex gap-2 flex-wrap items-center">
                <Pill
                  selected={computeWindow === '-season'}
                  onClick={() => setComputeWindow((p) => (p === '-season' ? '' : '-season'))}
                >
                  -season
                </Pill>
                <div className="flex items-center gap-1.5">
                  <Pill
                    selected={computeWindow === '-last'}
                    onClick={() => setComputeWindow((p) => (p === '-last' ? '' : '-last'))}
                  >
                    -last
                  </Pill>
                  {computeWindow === '-last' && (
                    <NumSelect value={windowN} onChange={setWindowN} options={COMPUTE_WINDOW_N_PRESETS} w={64} />
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Streak: threshold + streakN + year */}
      {mode === 'streak' && stat && (
        <div className="mb-3 flex items-end gap-5 flex-wrap">
          <div>
            <SLabel>threshold</SLabel>
            <NumSelect value={thresholdN} onChange={setThresholdN} options={thresholdPresetsFor(sport, stat)} w={64} />
          </div>
          <div>
            <SLabel>min streak</SLabel>
            <NumSelect value={streakN} onChange={setStreakN} options={STREAK_N_PRESETS} w={64} />
          </div>
        </div>
      )}

      {/* Sport */}
      {isBuilderQuery && (
        <div className="mb-3">
          <SLabel>sport</SLabel>
          <div className="flex gap-2 flex-wrap">
            {SPORTS.map((s) => (
              <Pill
                key={s.value}
                selected={sport === s.value}
                onClick={() => handleSportSelect(s.value)}
                disabled={s.comingSoon}
              >
                {s.comingSoon ? `{${s.label}}` : s.label}
              </Pill>
            ))}
          </div>
        </div>
      )}

      {/* Optional-controls toggle — right under sport. */}
      {isBuilderQuery && sport && !firstPaActive && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            disabled={Boolean(period || mlbFirstFlag || batPosition || yearFilter)}
            className="font-mono text-[11px] underline underline-offset-4 hover:opacity-80 transition-opacity"
            style={{ color: C.accentDim, cursor: 'pointer' }}
          >
            {optionalOpen ? '{fewer options}' : '{more options}'}
          </button>
        </div>
      )}

      {/* Period — kept here (right after sport, before stat) since it's
          pushed onto the built command early (right after sport, before the
          stat/threshold tokens) — its position in the UI mirrors its actual
          position in the command, same reasoning as moving {season} to the
          bottom below. MLB/NFL dropped entirely — both only ever had a
          single always-selected "reg"/"full" pill with nothing else to
          toggle to, which read as a dead control now that "post" (its one
          real alternative) is gone. Only render this column for sports with
          a genuine second option (NHL's p1, NBA's q1/1h). Postseason returns
          later as its own thing once MLB's October postseason starts — for
          now every command defaults to regular season same as before, just
          without a pointless button implying there's a choice to make. */}
      {optionalOpen && isBuilderQuery && !firstPaActive && (sport === 'nba' || sport === 'nhl') && (
        <div className="mb-3">
          <SLabel>period</SLabel>
          <div className="flex gap-1.5 flex-wrap">
            <Pill selected={period === ''} onClick={() => handlePeriodSelect('')}>
              full
            </Pill>
            <Pill selected={period === 'q1'} onClick={() => handlePeriodSelect('q1')}>
              {sport === 'nhl' ? 'p1' : 'q1'}
            </Pill>
            {sport === 'nba' && (
              <Pill selected={period === '1h'} onClick={() => handlePeriodSelect('1h')}>
                1h
              </Pill>
            )}
          </div>
        </div>
      )}

      {/* First plate appearance (MLB trend only — one PA per game, no threshold N) */}
      {optionalOpen && mode === 'trend' && sport === 'mlb' && (
        <div className="mb-3">
          <SLabel>first plate appearance {'{optional}'}</SLabel>
          <div className="flex gap-1.5 flex-wrap">
            {(['xbh', 'walk', 'single', 'hit'] as const).map((f) => (
              <Pill
                key={f}
                selected={mlbFirstFlag === f}
                onClick={() => setMlbFirstFlag((p) => (p === f ? '' : f))}
              >
                {`-${f}`}
              </Pill>
            ))}
          </div>
        </div>
      )}

      {firstPaActive && (
        <div className="mb-3 flex items-end gap-1.5">
          <div>
            <SLabel>met</SLabel>
            <NumSelect value={lastA} onChange={setLastA} options={WINDOW_MET_PRESETS} w={64} />
          </div>
          <span style={{ color: C.textDim, paddingBottom: '8px' }}>/</span>
          <div>
            <SLabel>-last</SLabel>
            <NumSelect value={lastB} onChange={setLastB} options={WINDOW_LAST_PRESETS} w={64} />
          </div>
        </div>
      )}

      {/* Batter position (MLB only) */}
      {optionalOpen && isBuilderQuery && sport === 'mlb' && !firstPaActive && (
        <div className="mb-3">
          <SLabel>batter position {'{optional}'}</SLabel>
          <div className="flex gap-1.5 flex-wrap">
            {MLB_POSITIONS.map((pos) => (
              <Pill
                key={pos.value}
                selected={batPosition === pos.value}
                onClick={() => setBatPosition((prev) => (prev === pos.value ? '' : pos.value))}
              >
                {pos.label}
              </Pill>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {isBuilderQuery && sport && stats.length > 0 && !firstPaActive && (
        <div className="mb-3">
          <SLabel>stat</SLabel>
          <div className="flex gap-1.5 flex-wrap">
            {stats.map((s) => (
              <Pill
                key={s.value}
                selected={stat === s.value}
                onClick={() => setStat((p) => (p === s.value ? '' : s.value))}
              >
                {s.label}
              </Pill>
            ))}
          </div>
        </div>
      )}

      {/* NFL stat type: -yds/-td stay a normal mutually-exclusive pair,
          always both clickable. The combo (pass+rush / rush+rec) is a
          separate toggle, not a third radio option — that's what lets it
          combine with -td instead of disabling it. Combo alone -> bare
          "-pr"/"-rr" (no category word, e.g. "nspe nfl -rr80 -last1/1").
          Combo + -td -> the backend's actual "anytime TD" concept, which is
          its own "any" category rather than a per-category -td flag (e.g.
          "nspe nfl any -td2 -last1/1", equivalently thought of as
          "-rr -td2"). */}
      {isBuilderQuery && sport === 'nfl' && stat && (
        <div className="mb-3">
          <SLabel>type</SLabel>
          <div className="flex gap-1.5 flex-wrap items-center">
            <Pill selected={nflStatType === 'yds'} onClick={() => setNflStatType('yds')}>
              -yds
            </Pill>
            <Pill selected={nflStatType === 'td'} onClick={() => setNflStatType('td')}>
              -td
            </Pill>
            <span style={{ color: C.textDim }}>+</span>
            <Pill selected={nflCombo} onClick={() => setNflCombo((p) => !p)}>
              {stat === 'pass' ? 'pass+rush' : 'rush+rec'}
            </Pill>
          </div>
        </div>
      )}

      {/* Trend: threshold + last */}
      {mode === 'trend' && stat && !firstPaActive && (
        <div className="mb-3 flex items-end gap-5 flex-wrap">
          <div>
            <SLabel>threshold</SLabel>
            <NumSelect
              value={thresholdN}
              onChange={setThresholdN}
              options={
                sport === 'nfl'
                  ? nflStatType === 'td'
                    ? NFL_TD_PRESETS
                    : NFL_YDS_PRESETS
                  : thresholdPresetsFor(sport, stat)
              }
              w={sport === 'nfl' && nflStatType !== 'td' ? 80 : 64}
            />
          </div>
          <div className="flex items-end gap-1.5">
            <div>
              <SLabel>met</SLabel>
              <NumSelect value={lastA} onChange={setLastA} options={WINDOW_MET_PRESETS} w={64} />
            </div>
            <span style={{ color: C.textDim, paddingBottom: '8px' }}>/</span>
            <div>
              <SLabel>-last</SLabel>
              <NumSelect value={lastB} onChange={setLastB} options={WINDOW_LAST_PRESETS} w={64} />
            </div>
          </div>
        </div>
      )}

      {/* Compute: threshold mode + window */}
      {mode === 'compute' && stat && (
        <div className="mb-3">
          <div className="mb-2">
            <SLabel>threshold</SLabel>
            <div className="flex gap-1.5 flex-wrap">
              <Pill
                selected={thresholdMode === 'min'}
                onClick={() => {
                  setThresholdMode('min')
                  setMaxN('')
                }}
              >
                min
              </Pill>
              <Pill
                selected={thresholdMode === 'range'}
                onClick={() => setThresholdMode('range')}
              >
                min - max
              </Pill>
            </div>
          </div>
          <div className="mb-3 flex items-end gap-2">
            {thresholdMode === 'min' && (
              <div>
                <SLabel>min value</SLabel>
                <NumSelect
                  value={minN}
                  onChange={setMinN}
                  options={computeMinPresets}
                  w={80}
                />
              </div>
            )}
            {thresholdMode === 'range' && (
              <>
                <div>
                  <SLabel>min</SLabel>
                  <NumSelect
                    value={minN}
                    onChange={setMinN}
                    options={computeMinPresets}
                    w={80}
                  />
                </div>
                <span style={{ color: C.textDim, paddingBottom: '8px' }}>—</span>
                <div>
                  <SLabel>max</SLabel>
                  <NumSelect
                    value={maxN}
                    onChange={setMaxN}
                    options={computeMinPresets}
                    w={80}
                  />
                </div>
              </>
            )}
          </div>
          <SLabel>window</SLabel>
          <div className="flex gap-2 flex-wrap items-center">
            {(['-season', '-career'] as ComputeWindow[]).map((w) => (
              <Pill
                key={w as string}
                selected={computeWindow === w}
                onClick={() => setComputeWindow((p) => (p === w ? '' : w))}
              >
                {w as string}
              </Pill>
            ))}
            <div className="flex items-center gap-1.5">
              <Pill
                selected={computeWindow === '-last'}
                onClick={() => setComputeWindow((p) => (p === '-last' ? '' : '-last'))}
              >
                -last
              </Pill>
              {computeWindow === '-last' && (
                <NumSelect value={windowN} onChange={setWindowN} options={COMPUTE_WINDOW_N_PRESETS} w={64} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Season — lives at the bottom, under window, since it's optional and
          is literally the last token in the built command (appended after
          everything else in builtCommand's yearFilter push, regardless of
          mode) — e.g. "nspe mlb -hits min100 -season 2025". Replaces the old
          postseason toggle — pick a specific year instead. Styled like H2H's
          opponent-team pills (MLB_TEAMS above): small buttons in a wrapping
          row. {YY} not {YYYY} to keep the row compact; the {older} dropdown
          covers 2010-2019. Pre-2010 (career-spanning players) isn't
          reachable here yet — planned manual-YYYY-input follow-up, not
          built. */}
      {optionalOpen && isBuilderQuery && !firstPaActive && (
        <div className="mb-3">
          <SLabel>season {'{optional}'}</SLabel>
          <div className="flex gap-1.5 flex-wrap items-center">
            {SEASON_YEARS_VISIBLE.map((y) => (
              <Pill
                key={y}
                selected={yearFilter === String(y)}
                onClick={() => setYearFilter((p) => (p === String(y) ? '' : String(y)))}
              >
                {String(y).slice(2)}
              </Pill>
            ))}
            <select
              value={SEASON_YEARS_OLDER.includes(Number(yearFilter)) ? yearFilter : ''}
              onChange={(e) => setYearFilter(e.target.value)}
              className={selectClass}
              style={{ ...selectStyle, width: '84px' }}
            >
              <option value="">{'{older}'}</option>
              {SEASON_YEARS_OLDER.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Command preview */}
      <div
        className="mt-4 px-3 py-2.5 rounded text-[12px] break-all min-h-[38px] flex items-center"
        style={{
          backgroundColor: 'oklch(0.10 0 0)',
          border: `1px solid ${C.border}`,
        }}
      >
        {builtCommand ? (
          <>
            <span style={{ color: C.textDim }}>▸ </span>
            <span style={{ color: C.accent }}>{builtCommand}</span>
          </>
        ) : (
          <span style={{ color: C.textDim }}>select options to build query</span>
        )}
      </div>

      {/* Run button */}
      <button
        type="button"
        onClick={() => canRun && onRunQuery(builtCommand)}
        disabled={!canRun}
        className="w-full mt-3 py-3 rounded font-mono font-bold text-[13px] uppercase tracking-wide border transition-colors"
        style={{
          backgroundColor: canRun ? C.accent : C.surface2,
          color: canRun ? C.accentDark : C.textDim,
          borderColor: canRun ? C.accent : C.border,
          cursor: canRun ? 'pointer' : 'not-allowed',
        }}
      >
        {isLoading ? 'running...' : 'run query'}
      </button>
    </div>
  )
}
