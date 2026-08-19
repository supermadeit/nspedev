import { useState, useMemo, useEffect } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'

type QueryMode = 'trend' | 'compute' | 'streak' | 'h2h' | 'team' | 'explosive'
type SeasonType = 'post' | ''
type PeriodType = 'q1' | '1h' | ''
type ComputeWindow = '-season' | '-career' | '-last' | ''
type TeamStat = 'runs' | 'allowed' | ''
type ExplosiveLeague = 'mlb' | 'nfl'
type MlbFirstPaFlag = 'xbh' | 'walk' | 'single' | 'hit' | ''
type NflStatType = 'yds' | 'td'
type ThresholdMode = 'min' | 'range' | 'exact'

interface PersistedBuilderState {
  mode: QueryMode
  sport: string
  seasonType: SeasonType
  period: PeriodType
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

const SPORTS = [
  { value: 'nba', label: 'NBA', comingSoon: false },
  { value: 'mlb', label: 'MLB', comingSoon: false },
  { value: 'nhl', label: 'NHL', comingSoon: false },
  { value: 'nfl', label: 'NFL', comingSoon: false },
]

const SPORT_STATS: Record<string, Array<{ value: string; label: string }>> = {
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
    { value: 'total', label: 'TOTAL' },
  ],
  mlb: [
    { value: 'hits', label: 'HITS' },
    { value: 'hr', label: 'HR' },
    { value: 'rbi', label: 'RBI' },
    { value: 'dub', label: '2B' },
    { value: 'trp', label: '3B' },
    { value: 'sb', label: 'SB' },
    { value: 'bb', label: 'BB' },
    { value: 'tb', label: 'TB' },
  ],
  nhl: [
    { value: 'g', label: 'G' },
    { value: 'a', label: 'A' },
    { value: 'pts', label: 'PTS' },
    { value: 'sog', label: 'SOG' },
    { value: 'blk', label: 'BLK' },
  ],
  nfl: [
    { value: 'rush', label: 'RUSH' },
    { value: 'pass', label: 'PASS' },
    { value: 'rec', label: 'REC' },
  ],
}

const C = {
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
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  w?: number
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
      placeholder={placeholder ?? 'N'}
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
  const [seasonType, setSeasonType] = useState<SeasonType>(initial.seasonType ?? '')
  const [period, setPeriod] = useState<PeriodType>(initial.period ?? '')
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
      mode, sport, seasonType, period, stat,
      thresholdN, lastA, lastB,
      minN, maxN, thresholdMode, computeWindow, windowN,
      streakN,
      h2hPlayer, h2hOpponent,
      teamStat, teamSubMode,
      batPosition, mlbFirstFlag, nflStatType,
      explosiveLeague, nflPlayType, nflYds,
      nflExplosiveSubMode, nflMinYds,
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      // ignore quota / unavailable storage
    }
  }, [storageKey, mode, sport, seasonType, period, stat, thresholdN, lastA, lastB, minN, maxN, thresholdMode, computeWindow, windowN, streakN, h2hPlayer, h2hOpponent, teamStat, teamSubMode, batPosition, mlbFirstFlag, nflStatType, explosiveLeague, nflPlayType, nflYds, nflExplosiveSubMode, nflMinYds])

  const isNbaHalfPeriod = sport === 'nba' && period === '1h'
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
        } else if (thresholdMode === 'exact') {
          if (minN) {
            parts.push(`min${minN}`)
            parts.push(`max${minN}`)
          }
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
    if (seasonType) parts.push(seasonType)
    if (period === 'q1') {
      if (sport === 'nhl') parts.push('p1')
      else if (sport !== 'mlb') parts.push('q1')
    }
    else if (period === '1h') parts.push('1h')

    if (mode === 'trend') {
      if (stat) {
        if (sport === 'nfl') {
          parts.push(stat)
          parts.push(`-${nflStatType}${thresholdN}`)
        } else {
          parts.push(`-${stat}${thresholdN}`)
        }
      }
      if (lastA && lastB) parts.push(`-last${lastA}/${lastB}`)
    } else if (mode === 'compute') {
      if (stat) {
        if (sport === 'nfl') {
          parts.push(stat)
          parts.push(`-${nflStatType}`)
        } else {
          parts.push(`-${stat}`)
        }
      }
      if (thresholdMode === 'min') {
        if (minN) parts.push(`min${minN}`)
      } else if (thresholdMode === 'range') {
        if (minN) parts.push(`min${minN}`)
        if (maxN) parts.push(`max${maxN}`)
      } else if (thresholdMode === 'exact') {
        if (minN) {
          parts.push(`min${minN}`)
          parts.push(`max${minN}`)
        }
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
          parts.push(`-${stat}${thresholdN}`)
        }
      }
      if (streakN) parts.push(`-streak${streakN}`)
    }

    return parts.join(' ')
  }, [mode, sport, seasonType, period, stat, thresholdN, lastA, lastB, minN, maxN, thresholdMode, computeWindow, windowN, streakN, h2hPlayer, h2hOpponent, teamStat, teamSubMode, batPosition, mlbFirstFlag, explosiveLeague, nflPlayType, nflYds, nflExplosiveSubMode, nflMinYds, nflStatType])

  const canRun = Boolean(builtCommand) && !isLoading

  const isBuilderQuery = mode === 'trend' || mode === 'compute' || mode === 'streak'
  const firstPaActive = mode === 'trend' && sport === 'mlb' && Boolean(mlbFirstFlag)

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
                  <NumInput value={nflMinYds} onChange={setNflMinYds} w={72} />
                  <span className="font-mono text-[11px]" style={{ color: C.textDim }}>
                    {explosiveLeague === 'mlb' ? 'ft' : 'yds  ·  -season'}
                  </span>
                </div>
              </div>
              {explosiveLeague === 'mlb' && (
                <div>
                  <SLabel>-last {'{optional}'}</SLabel>
                  <NumInput value={windowN} onChange={setWindowN} placeholder="N" w={54} />
                </div>
              )}
            </div>
          ) : (
            <div className="mb-3 flex items-end gap-5 flex-wrap">
              <div>
                <SLabel>{explosiveLeague === 'mlb' ? 'distance threshold' : 'yards threshold'}</SLabel>
                <div className="flex items-center gap-2">
                  <NumInput value={nflYds} onChange={setNflYds} w={64} />
                  <span className="font-mono text-[11px]" style={{ color: C.textDim }}>
                    {explosiveLeague === 'mlb' ? 'ft' : 'yds'}
                  </span>
                </div>
              </div>
              <div className="flex items-end gap-1.5">
                <div>
                  <SLabel>met</SLabel>
                  <NumInput value={lastA} onChange={setLastA} placeholder="N" w={54} />
                </div>
                <span style={{ color: C.textDim, paddingBottom: '8px' }}>/</span>
                <div>
                  <SLabel>-last</SLabel>
                  <NumInput value={lastB} onChange={setLastB} placeholder="N" w={54} />
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
                <NumInput value={thresholdN} onChange={setThresholdN} w={64} />
              </div>
              <div className="flex items-end gap-1.5">
                <div>
                  <SLabel>met</SLabel>
                  <NumInput value={lastA} onChange={setLastA} placeholder="N" w={54} />
                </div>
                <span style={{ color: C.textDim, paddingBottom: '8px' }}>/</span>
                <div>
                  <SLabel>-last</SLabel>
                  <NumInput value={lastB} onChange={setLastB} placeholder="N" w={54} />
                </div>
              </div>
            </div>
          )}

          {teamSubMode === 'compute' && teamStat && (
            <div className="mb-3">
              <div className="mb-2">
                <SLabel>threshold mode</SLabel>
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
                    onClick={() => {
                      if (thresholdMode === 'exact' && minN) setMaxN(minN)
                      setThresholdMode('range')
                    }}
                  >
                    min - max
                  </Pill>
                  <Pill
                    selected={thresholdMode === 'exact'}
                    onClick={() => {
                      setThresholdMode('exact')
                      setMaxN('')
                    }}
                  >
                    exact
                  </Pill>
                </div>
              </div>
              <div className="mb-3 flex items-end gap-2">
                {thresholdMode === 'min' && (
                  <div>
                    <SLabel>min threshold</SLabel>
                    <NumInput value={minN} onChange={setMinN} w={72} />
                  </div>
                )}
                {thresholdMode === 'range' && (
                  <>
                    <div>
                      <SLabel>min</SLabel>
                      <NumInput value={minN} onChange={setMinN} w={64} />
                    </div>
                    <span style={{ color: C.textDim, paddingBottom: '8px' }}>—</span>
                    <div>
                      <SLabel>max</SLabel>
                      <NumInput value={maxN} onChange={setMaxN} w={64} />
                    </div>
                  </>
                )}
                {thresholdMode === 'exact' && (
                  <div>
                    <SLabel>exact threshold</SLabel>
                    <NumInput value={minN} onChange={setMinN} w={72} />
                  </div>
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
                    <NumInput value={windowN} onChange={setWindowN} placeholder="N" w={52} />
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
            <NumInput value={thresholdN} onChange={setThresholdN} w={64} />
          </div>
          <div>
            <SLabel>min streak</SLabel>
            <NumInput value={streakN} onChange={setStreakN} placeholder="N" w={54} />
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

      {/* Season / Period */}
      {isBuilderQuery && !firstPaActive && (
      <div className="flex gap-6 mb-3">
        <div>
          <SLabel>season</SLabel>
          <div className="flex gap-1.5">
            <Pill
              selected={seasonType === 'post'}
              onClick={() => setSeasonType((p) => (p === 'post' ? '' : 'post'))}
            >
              post
            </Pill>
          </div>
        </div>
        <div>
          <SLabel>{sport === 'mlb' ? 'season' : 'period'}</SLabel>
          <div className="flex gap-1.5 flex-wrap">
            <Pill selected={period === ''} onClick={() => handlePeriodSelect('')}>
              {sport === 'mlb' ? 'reg' : 'full'}
            </Pill>
            {sport !== 'mlb' && sport !== 'nfl' && (
              <Pill selected={period === 'q1'} onClick={() => handlePeriodSelect('q1')}>
                {sport === 'nhl' ? 'p1' : 'q1'}
              </Pill>
            )}
            {sport === 'nba' && (
              <Pill selected={period === '1h'} onClick={() => handlePeriodSelect('1h')}>
                1h
              </Pill>
            )}
          </div>
        </div>
      </div>
      )}

      {/* First plate appearance (MLB trend only — one PA per game, no threshold N) */}
      {mode === 'trend' && sport === 'mlb' && (
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
            <NumInput value={lastA} onChange={setLastA} placeholder="N" w={54} />
          </div>
          <span style={{ color: C.textDim, paddingBottom: '8px' }}>/</span>
          <div>
            <SLabel>-last</SLabel>
            <NumInput value={lastB} onChange={setLastB} placeholder="N" w={54} />
          </div>
        </div>
      )}

      {/* Batter position (MLB only) */}
      {isBuilderQuery && sport === 'mlb' && !firstPaActive && (
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

      {/* NFL stat type: yards or touchdowns */}
      {isBuilderQuery && sport === 'nfl' && stat && (
        <div className="mb-3">
          <SLabel>type</SLabel>
          <div className="flex gap-1.5">
            <Pill selected={nflStatType === 'yds'} onClick={() => setNflStatType('yds')}>
              -yds
            </Pill>
            <Pill selected={nflStatType === 'td'} onClick={() => setNflStatType('td')}>
              -td
            </Pill>
          </div>
        </div>
      )}

      {/* Trend: threshold + last */}
      {mode === 'trend' && stat && !firstPaActive && (
        <div className="mb-3 flex items-end gap-5 flex-wrap">
          <div>
            <SLabel>threshold</SLabel>
            <NumInput value={thresholdN} onChange={setThresholdN} w={64} />
          </div>
          <div className="flex items-end gap-1.5">
            <div>
              <SLabel>met</SLabel>
              <NumInput value={lastA} onChange={setLastA} placeholder="N" w={54} />
            </div>
            <span style={{ color: C.textDim, paddingBottom: '8px' }}>/</span>
            <div>
              <SLabel>-last</SLabel>
              <NumInput value={lastB} onChange={setLastB} placeholder="N" w={54} />
            </div>
          </div>
        </div>
      )}

      {/* Compute: threshold mode + window */}
      {mode === 'compute' && stat && (
        <div className="mb-3">
          <div className="mb-2">
            <SLabel>threshold mode</SLabel>
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
                onClick={() => {
                  if (thresholdMode === 'exact' && minN) setMaxN(minN)
                  setThresholdMode('range')
                }}
              >
                min - max
              </Pill>
              <Pill
                selected={thresholdMode === 'exact'}
                onClick={() => {
                  setThresholdMode('exact')
                  setMaxN('')
                }}
              >
                exact
              </Pill>
            </div>
          </div>
          <div className="mb-3 flex items-end gap-2">
            {thresholdMode === 'min' && (
              <div>
                <SLabel>min threshold</SLabel>
                <NumInput value={minN} onChange={setMinN} w={72} />
              </div>
            )}
            {thresholdMode === 'range' && (
              <>
                <div>
                  <SLabel>min</SLabel>
                  <NumInput value={minN} onChange={setMinN} w={64} />
                </div>
                <span style={{ color: C.textDim, paddingBottom: '8px' }}>—</span>
                <div>
                  <SLabel>max</SLabel>
                  <NumInput value={maxN} onChange={setMaxN} w={64} />
                </div>
              </>
            )}
            {thresholdMode === 'exact' && (
              <div>
                <SLabel>exact threshold</SLabel>
                <NumInput value={minN} onChange={setMinN} w={72} />
              </div>
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
                <NumInput value={windowN} onChange={setWindowN} placeholder="N" w={52} />
              )}
            </div>
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
