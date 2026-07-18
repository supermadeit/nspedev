import { useState, useMemo, useEffect } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'

type QueryMode = 'trend' | 'compute' | 'streak' | 'h2h' | 'pitch' | 'team' | 'report' | 'explosive'
type ReportSubMode = 'leaderboard' | 'player'
type ReportWindow = '-season' | '-last5' | '-last10' | '-last20' | '-lastN' | ''
type SeasonType = 'post' | ''
type PeriodType = 'q1' | '1h' | ''
type ComputeWindow = '-season' | '-career' | '-last' | ''
type PitchFlag = 'vfp' | 'outs' | 'down' | ''
type TeamFlag = 'outs' | 'ov' | ''
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
  pitchPlayer: string
  pitchFlag: PitchFlag
  pitchDownN: string
  teamCode: string
  teamFlag: TeamFlag
  batPosition: string
  reportSubMode: ReportSubMode
  reportWindow: ReportWindow
  reportWindowN: string
  reportPlayer: string
  reportPosition: string
  nflPlayType: string
  nflYds: string
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

const REPORT_POSITIONS = [
  { value: 'c', label: 'C' },
  { value: '1b', label: '1B' },
  { value: '2b', label: '2B' },
  { value: '3b', label: '3B' },
  { value: 'ss', label: 'SS' },
  { value: 'lf', label: 'LF' },
  { value: 'cf', label: 'CF' },
  { value: 'rf', label: 'RF' },
  { value: 'of', label: 'OF' },
  { value: 'dh', label: 'DH' },
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
  // pitch (pitcher h2h)
  const [pitchPlayer, setPitchPlayer] = useState(initial.pitchPlayer ?? '')
  const [pitchFlag, setPitchFlag] = useState<PitchFlag>(initial.pitchFlag ?? '')
  const [pitchDownN, setPitchDownN] = useState(initial.pitchDownN ?? '')
  // team (bat vs TEAM)
  const [teamCode, setTeamCode] = useState(initial.teamCode ?? '')
  const [teamFlag, setTeamFlag] = useState<TeamFlag>(initial.teamFlag ?? '')
  // batter position (MLB only)
  const [batPosition, setBatPosition] = useState(initial.batPosition ?? '')
  // report mode
  const [reportSubMode, setReportSubMode] = useState<ReportSubMode>(initial.reportSubMode ?? 'leaderboard')
  const [reportWindow, setReportWindow] = useState<ReportWindow>(initial.reportWindow ?? '')
  const [reportWindowN, setReportWindowN] = useState(initial.reportWindowN ?? '')
  const [reportPlayer, setReportPlayer] = useState(initial.reportPlayer ?? '')
  const [reportPosition, setReportPosition] = useState(initial.reportPosition ?? '')
  // NFL explosive
  const [nflPlayType, setNflPlayType] = useState(initial.nflPlayType ?? '')
  const [nflYds, setNflYds] = useState(initial.nflYds ?? '')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload: PersistedBuilderState = {
      mode, sport, seasonType, period, stat,
      thresholdN, lastA, lastB,
      minN, maxN, thresholdMode, computeWindow, windowN,
      streakN,
      h2hPlayer, h2hOpponent,
      pitchPlayer, pitchFlag, pitchDownN,
      teamCode, teamFlag,
      batPosition,
      reportSubMode, reportWindow, reportWindowN, reportPlayer, reportPosition,
      nflPlayType, nflYds,
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch {
      // ignore quota / unavailable storage
    }
  }, [storageKey, mode, sport, seasonType, period, stat, thresholdN, lastA, lastB, minN, maxN, thresholdMode, computeWindow, windowN, streakN, h2hPlayer, h2hOpponent, pitchPlayer, pitchFlag, pitchDownN, teamCode, teamFlag, batPosition, reportSubMode, reportWindow, reportWindowN, reportPlayer, reportPosition, nflPlayType, nflYds])

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
    // explosive mode is NFL-only — switch to trend when leaving NFL
    if (s !== 'nfl' && mode === 'explosive') {
      setMode('trend')
    }
  }

  const handleModeSelect = (m: QueryMode) => {
    setMode(m)
    // h2h, pitch, team, report are MLB-only — force sport to mlb when switching in.
    if ((m === 'h2h' || m === 'pitch' || m === 'team' || m === 'report') && sport !== 'mlb') {
      setSport('mlb')
      setStat('')
      if (period === '1h' || period === 'q1') setPeriod('')
    }
    // explosive is NFL-only — force sport to nfl when switching in.
    if (m === 'explosive') {
      setSport('nfl')
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
    // Explosive: nspe nfl long {type} -yds{N} -last{A}/{B}
    if (mode === 'explosive') {
      if (!nflPlayType || !nflYds || !lastA || !lastB) return ''
      return `nspe nfl long ${nflPlayType} -yds${nflYds} -last${lastA}/${lastB}`
    }

    if (mode === 'h2h') {
      const player = h2hPlayer.trim()
      if (!player || !h2hOpponent) return ''
      return `nspe mlb ${player.toLowerCase()} vs ${h2hOpponent}`
    }

    if (mode === 'pitch') {
      const player = pitchPlayer.trim()
      if (!player) return ''
      const parts = ['nspe', 'mlb', 'pitch', player.toLowerCase()]
      if (pitchFlag === 'vfp') parts.push('-vfp')
      else if (pitchFlag === 'outs') parts.push('-outs')
      else if (pitchFlag === 'down' && pitchDownN) parts.push(`-${pitchDownN}down`)
      return parts.join(' ')
    }

    if (mode === 'team') {
      if (!teamCode) return ''
      if (teamFlag === 'outs') {
        return `nspe mlb bat ${teamCode} -outs -season`
      }
      if (teamFlag === 'ov') {
        return `nspe mlb ${teamCode} -ov -season`
      }
      const parts = ['nspe', 'mlb', 'bat', 'vs', teamCode]
      return parts.join(' ')
    }

    if (mode === 'report') {
      const parts = ['nspe', 'mlb']
      if (reportSubMode === 'player') {
        const player = reportPlayer.trim()
        if (!player) return ''
        parts.push(player.toLowerCase())
      } else {
        // leaderboard — optional position filter
        if (reportPosition) parts.push(reportPosition.toUpperCase())
      }
      parts.push('-report')
      if (reportWindow === '-season') parts.push('-season')
      else if (reportWindow === '-last5') parts.push('-last5')
      else if (reportWindow === '-last10') parts.push('-last10')
      else if (reportWindow === '-last20') parts.push('-last20')
      else if (reportWindow === '-lastN' && reportWindowN) parts.push(`-last${reportWindowN}`)
      return parts.join(' ')
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
      if (sport === 'nfl') {
        // NFL per-game trend queries are not yet supported by the REST API.
        // Return empty so the run button stays disabled.
        return ''
      }
      if (stat) parts.push(`-${stat}${thresholdN}`)
      if (lastA && lastB) parts.push(`-last${lastA}/${lastB}`)
    } else if (mode === 'compute') {
      if (stat) parts.push(`-${stat}`)
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
      if (stat && streakN) parts.push(`-${stat}${thresholdN}`)
      if (streakN) parts.push(`-streak${streakN}`)
    }

    return parts.join(' ')
  }, [mode, sport, seasonType, period, stat, thresholdN, lastA, lastB, minN, maxN, thresholdMode, computeWindow, windowN, streakN, h2hPlayer, h2hOpponent, pitchPlayer, pitchFlag, pitchDownN, teamCode, teamFlag, batPosition, reportSubMode, reportWindow, reportWindowN, reportPlayer, reportPosition])

  const canRun = Boolean(builtCommand) && !isLoading

  const isBuilderQuery = mode === 'trend' || mode === 'compute' || mode === 'streak'

  return (
    <div className="w-full" style={{ color: C.textBright, fontFamily: 'monospace' }}>
      {/* Mode tabs */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {(['trend', 'compute', 'streak', 'h2h', 'pitch', 'team', 'report', 'explosive'] as QueryMode[]).map((m) => (
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
          ? (sport === 'nfl'
            ? '▸ nfl per-game trend · not yet available via api · use explosive or compute mode'
            : '▸ nspe {sport} {post} {full/q1} {stat}N -lastN/N')
          : mode === 'compute'
          ? '▸ nspe {sport} {post} {full/q1} {stat} minN {maxN} {-window}'
          : mode === 'streak'
          ? '▸ nspe {sport} {post} {full/q1} {stat}N -streakN'
          : mode === 'h2h'
          ? '▸ nspe mlb {player name} vs {TEAM}'
          : mode === 'pitch'
          ? '▸ nspe mlb pitch {player} {-vfp|-outs|-Ndown} {vs TEAM}'
          : mode === 'report'
          ? '▸ nspe mlb {pos} -report {-season|-lastN}  |  nspe mlb {player} -report {-lastN}'
          : mode === 'explosive'
          ? '▸ nspe nfl long {pass|rush|rec} -ydsN -lastA/B'
          : '▸ nspe mlb bat vs {TEAM} {-outs}'}
      </div>

      {/* Explosive: NFL play-by-play explosive plays */}
      {mode === 'explosive' && (
        <>
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

          <div className="mb-3 flex items-end gap-5 flex-wrap">
            <div>
              <SLabel>yards threshold</SLabel>
              <div className="flex items-center gap-2">
                <NumInput value={nflYds} onChange={setNflYds} w={64} />
                <span className="font-mono text-[11px]" style={{ color: C.textDim }}>yds</span>
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

      {/* Pitch (pitcher h2h) */}
      {mode === 'pitch' && (
        <>
          <div className="mb-3">
            <SLabel>pitcher name</SLabel>
            <input
              type="text"
              value={pitchPlayer}
              onChange={(e) => setPitchPlayer(e.target.value)}
              placeholder="type any MLB pitcher (e.g. wheeler, skenes)"
              className="w-full font-mono text-[13px] rounded border px-3 py-2 outline-none"
              style={{
                backgroundColor: C.surface2,
                borderColor: C.border,
                color: C.accent,
              }}
            />
          </div>

          <div className="mb-3">
            <SLabel>flag {'{optional}'}</SLabel>
            <div className="flex gap-1.5 flex-wrap items-center">
              <Pill
                selected={pitchFlag === ''}
                onClick={() => { setPitchFlag(''); setPitchDownN('') }}
              >
                overview
              </Pill>
              <Pill
                selected={pitchFlag === 'vfp'}
                onClick={() => setPitchFlag((p) => (p === 'vfp' ? '' : 'vfp'))}
              >
                -vfp
              </Pill>
              <Pill
                selected={pitchFlag === 'outs'}
                onClick={() => setPitchFlag((p) => (p === 'outs' ? '' : 'outs'))}
              >
                -outs
              </Pill>
              <div className="flex items-center gap-1.5">
                <Pill
                  selected={pitchFlag === 'down'}
                  onClick={() => setPitchFlag((p) => (p === 'down' ? '' : 'down'))}
                >
                  -Ndown
                </Pill>
                {pitchFlag === 'down' && (
                  <div className="flex gap-1">
                    {(['3', '6', '9'] as const).map((n) => (
                      <Pill
                        key={n}
                        selected={pitchDownN === n}
                        onClick={() => setPitchDownN((prev) => (prev === n ? '' : n))}
                      >
                        {n}
                      </Pill>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Team (bat vs TEAM) */}
      {mode === 'team' && (
        <>
          <div className="mb-3">
            <SLabel>team</SLabel>
            <div className="flex gap-1.5 flex-wrap">
              {MLB_TEAMS.map((t) => (
                <Pill
                  key={t}
                  selected={teamCode === t}
                  onClick={() => setTeamCode((prev) => (prev === t ? '' : t))}
                >
                  {t}
                </Pill>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <SLabel>flag {'{optional}'}</SLabel>
            <div className="flex gap-1.5 flex-wrap">
              <Pill selected={teamFlag === ''} onClick={() => setTeamFlag('')}>
                none
              </Pill>
              <Pill
                selected={teamFlag === 'outs'}
                onClick={() => setTeamFlag((p) => (p === 'outs' ? '' : 'outs'))}
              >
                -outs
              </Pill>
              <Pill
                selected={teamFlag === 'ov'}
                onClick={() => setTeamFlag((p) => (p === 'ov' ? '' : 'ov'))}
              >
                -ov
              </Pill>
            </div>
          </div>
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

      {/* Report mode */}
      {mode === 'report' && (
        <>
          {/* Sub-mode: leaderboard vs player */}
          <div className="mb-3">
            <SLabel>report type</SLabel>
            <div className="flex gap-1.5">
              <Pill
                selected={reportSubMode === 'leaderboard'}
                onClick={() => setReportSubMode('leaderboard')}
              >
                leaderboard
              </Pill>
              <Pill
                selected={reportSubMode === 'player'}
                onClick={() => setReportSubMode('player')}
              >
                player
              </Pill>
            </div>
          </div>

          {/* Position filter (leaderboard only, optional) */}
          {reportSubMode === 'leaderboard' && (
            <div className="mb-3">
              <SLabel>position filter {'{optional}'}</SLabel>
              <div className="flex gap-1.5 flex-wrap">
                {REPORT_POSITIONS.map((pos) => (
                  <Pill
                    key={pos.value}
                    selected={reportPosition === pos.value}
                    onClick={() => setReportPosition((prev) => (prev === pos.value ? '' : pos.value))}
                  >
                    {pos.label}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          {/* Player name (player mode only) */}
          {reportSubMode === 'player' && (
            <div className="mb-3">
              <SLabel>player name</SLabel>
              <input
                type="text"
                value={reportPlayer}
                onChange={(e) => setReportPlayer(e.target.value)}
                placeholder="e.g. juan soto, judge"
                className="w-full font-mono text-[13px] rounded border px-3 py-2 outline-none"
                style={{
                  backgroundColor: C.surface2,
                  borderColor: C.border,
                  color: C.accent,
                }}
              />
            </div>
          )}

          {/* Window */}
          <div className="mb-3">
            <SLabel>window</SLabel>
            <div className="flex gap-1.5 flex-wrap items-center">
              <Pill
                selected={reportWindow === ''}
                onClick={() => { setReportWindow(''); setReportWindowN('') }}
              >
                default
              </Pill>
              {(['-last5', '-last10', '-last20', '-season'] as ReportWindow[]).map((w) => (
                <Pill
                  key={w as string}
                  selected={reportWindow === w}
                  onClick={() => { setReportWindow((p) => (p === w ? '' : w)); setReportWindowN('') }}
                >
                  {w as string}
                </Pill>
              ))}
              <div className="flex items-center gap-1.5">
                <Pill
                  selected={reportWindow === '-lastN'}
                  onClick={() => setReportWindow((p) => (p === '-lastN' ? '' : '-lastN'))}
                >
                  -lastN
                </Pill>
                {reportWindow === '-lastN' && (
                  <NumInput value={reportWindowN} onChange={setReportWindowN} placeholder="N" w={52} />
                )}
              </div>
            </div>
          </div>
        </>
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
      {isBuilderQuery && (
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

      {/* Batter position (MLB only) */}
      {isBuilderQuery && sport === 'mlb' && (
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

      {/* NFL trend coming soon notice */}
      {mode === 'trend' && sport === 'nfl' && (
        <div className="mb-3 flex items-center gap-2">
          <span
            className="font-mono text-[12px] px-2.5 py-1 rounded border"
            style={{ color: C.textDim, borderColor: C.border, backgroundColor: C.surface2 }}
          >
            {'{nfl.trend}'}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.textDim }}>
            coming soon
          </span>
        </div>
      )}

      {/* Stats */}
      {isBuilderQuery && sport && stats.length > 0 && !(sport === 'nfl' && mode === 'trend') && (
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

      {/* Trend: threshold + last */}
      {mode === 'trend' && stat && (
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
