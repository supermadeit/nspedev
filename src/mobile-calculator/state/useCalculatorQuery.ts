// Ported state model + built-command logic for the mobile calculator UI.
//
// This is a direct PORT (not an import) of the relevant state/useMemo/
// useEffect blocks in src/components/QueryBuilder.tsx's `QueryBuilder`
// component — same command-building rules, same auto-default behavior —
// restricted to the modes in scope for Phase 1: trend, compute, team,
// explosive, h2h. `streak`, MLB's "first plate appearance" trend flag, and
// the NFL/NBA year filter are intentionally left out of this first pass
// (out of scope per the mobile calculator plan's mode list); see
// QueryBuilder.tsx if those need to be ported later.
//
// Keep this in lockstep with QueryBuilder.tsx's `builtCommand` logic by hand
// for now — see QueryBuilder.tsx's own comment about why this is a
// deliberate duplication rather than a shared hook.

import { useEffect, useMemo, useState } from 'react'
import {
  EXPLOSIVE_MLB_COMPUTE_PRESETS,
  EXPLOSIVE_MLB_TREND_PRESETS,
  EXPLOSIVE_NFL_COMPUTE_PRESETS,
  EXPLOSIVE_NFL_TREND_PRESETS,
  NFL_TD_COMPUTE_PRESETS,
  NFL_TD_PRESETS,
  NFL_YDS_COMPUTE_PRESETS,
  NFL_YDS_PRESETS,
  SPORT_STATS,
  TEAM_RUNS_COMPUTE_PRESETS,
  TEAM_RUNS_TREND_PRESETS,
  computeThresholdPresetsFor,
  thresholdPresetsFor,
  type ComputeWindow,
  type ExplosiveLeague,
  type NflStatType,
  type PeriodType,
  type SeasonType,
  type TeamStat,
  type ThresholdMode,
} from '@/components/QueryBuilder'

// Modes in scope for the mobile calculator's Phase 1 build.
export type CalcMode = 'trend' | 'compute' | 'team' | 'explosive' | 'h2h'

export const CALC_MODES: CalcMode[] = ['trend', 'compute', 'explosive', 'team', 'h2h']

// Duplicated from QueryBuilder.tsx (not exported there — small enough to
// keep as a mobile-local copy rather than widening desktop's export surface).
export const MLB_POSITIONS = [
  { value: 'c', label: 'C', title: 'Catcher' },
  { value: 'of', label: 'OF', title: 'Outfielder' },
  { value: 'ss', label: 'SS', title: 'Shortstop' },
  { value: '1b', label: '1B', title: 'First Base' },
  { value: '2b', label: '2B', title: 'Second Base' },
  { value: '3b', label: '3B', title: 'Third Base' },
  { value: 'dh', label: 'DH', title: 'Designated Hitter' },
]

export const MLB_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BOS', 'CHC', 'CWS', 'CIN', 'CLE', 'COL', 'DET',
  'HOU', 'KC', 'LAA', 'LAD', 'MIA', 'MIL', 'MIN', 'NYM', 'NYY', 'ATH',
  'PHI', 'PIT', 'SD', 'SEA', 'SF', 'STL', 'TB', 'TEX', 'TOR', 'WSH',
]

const STORAGE_KEY = 'nspe.calculator.mobile.v1'

interface PersistedCalcState {
  mode: CalcMode
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
  h2hPlayer: string
  h2hOpponent: string
  teamStat: TeamStat
  teamSubMode: 'trend' | 'compute'
  batPosition: string
  nflStatType: NflStatType
  explosiveLeague: ExplosiveLeague
  nflPlayType: string
  nflYds: string
  nflExplosiveSubMode: 'trend' | 'compute'
  nflMinYds: string
}

function loadPersisted(): Partial<PersistedCalcState> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

const NBA_HALF_STATS = new Set(['pts', 'tpm'])

export function useCalculatorQuery() {
  const initial = useMemo(() => loadPersisted() ?? {}, [])

  const [mode, setMode] = useState<CalcMode>(initial.mode ?? 'trend')
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
  // h2h
  const [h2hPlayer, setH2hPlayer] = useState(initial.h2hPlayer ?? '')
  const [h2hOpponent, setH2hOpponent] = useState(initial.h2hOpponent ?? '')
  // team
  const [teamStat, setTeamStat] = useState<TeamStat>(initial.teamStat ?? '')
  const [teamSubMode, setTeamSubMode] = useState<'trend' | 'compute'>(initial.teamSubMode ?? 'trend')
  // mlb batter position
  const [batPosition, setBatPosition] = useState(initial.batPosition ?? '')
  // NFL stat type
  const [nflStatType, setNflStatType] = useState<NflStatType>(initial.nflStatType ?? 'yds')
  // explosive
  const [explosiveLeague, setExplosiveLeague] = useState<ExplosiveLeague>(initial.explosiveLeague ?? 'nfl')
  const [nflPlayType, setNflPlayType] = useState(initial.nflPlayType ?? '')
  const [nflYds, setNflYds] = useState(initial.nflYds ?? '')
  const [nflExplosiveSubMode, setNflExplosiveSubMode] = useState<'trend' | 'compute'>(initial.nflExplosiveSubMode ?? 'trend')
  const [nflMinYds, setNflMinYds] = useState(initial.nflMinYds ?? '')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload: PersistedCalcState = {
      mode, sport, seasonType, period, stat,
      thresholdN, lastA, lastB,
      minN, maxN, thresholdMode, computeWindow, windowN,
      h2hPlayer, h2hOpponent,
      teamStat, teamSubMode,
      batPosition, nflStatType,
      explosiveLeague, nflPlayType, nflYds,
      nflExplosiveSubMode, nflMinYds,
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // ignore quota / unavailable storage
    }
  }, [mode, sport, seasonType, period, stat, thresholdN, lastA, lastB, minN, maxN, thresholdMode, computeWindow, windowN, h2hPlayer, h2hOpponent, teamStat, teamSubMode, batPosition, nflStatType, explosiveLeague, nflPlayType, nflYds, nflExplosiveSubMode, nflMinYds])

  const isNbaHalfPeriod = sport === 'nba' && period === '1h'
  const allStats = SPORT_STATS[sport] ?? []
  const stats = isNbaHalfPeriod ? allStats.filter((s) => NBA_HALF_STATS.has(s.value)) : allStats

  const handleSportSelect = (s: string) => {
    setSport((prev) => (prev === s ? '' : s))
    setStat('')
    if (s !== 'nba' && period === '1h') setPeriod('')
    if (s === 'mlb' && period === 'q1') setPeriod('')
    if (s !== 'mlb') setBatPosition('')
  }

  const handleModeSelect = (m: CalcMode) => {
    setMode(m)
    if ((m === 'h2h' || m === 'team') && sport !== 'mlb') {
      setSport('mlb')
      setStat('')
      if (period === '1h' || period === 'q1') setPeriod('')
    }
    if (m === 'explosive') {
      setStat('')
      if (period === '1h' || period === 'q1') setPeriod('')
      setBatPosition('')
    }
  }

  const handlePeriodSelect = (p: PeriodType) => {
    setPeriod((prev) => (prev === p ? '' : p))
    if (p === '1h' && stat && !NBA_HALF_STATS.has(stat)) setStat('')
  }

  const builtCommand = useMemo(() => {
    if (mode === 'explosive') {
      if (explosiveLeague === 'mlb') {
        if (nflExplosiveSubMode === 'compute') {
          if (!nflMinYds) return ''
          const parts = ['nspe', 'mlb', 'long', '-hr', `min${nflMinYds}`]
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

    if (!sport) return ''

    const parts: string[] = ['nspe', sport]

    if (sport === 'mlb' && batPosition) parts.push(batPosition)
    if (seasonType) parts.push(seasonType)
    if (period === 'q1') {
      if (sport === 'nhl') parts.push('p1')
      else if (sport !== 'mlb') parts.push('q1')
    } else if (period === '1h') parts.push('1h')

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
    }

    return parts.join(' ')
  }, [mode, sport, seasonType, period, stat, thresholdN, lastA, lastB, minN, maxN, thresholdMode, computeWindow, windowN, h2hPlayer, h2hOpponent, teamStat, teamSubMode, batPosition, explosiveLeague, nflPlayType, nflYds, nflExplosiveSubMode, nflMinYds, nflStatType])

  const canRun = Boolean(builtCommand)
  const isBuilderQuery = mode === 'trend' || mode === 'compute'

  // Pre-fill threshold/window with a sensible default the moment a stat is
  // picked (or the mode changes) — same behavior as QueryBuilder.tsx.
  useEffect(() => {
    if (mode === 'trend') {
      if (!stat) return
      const presets =
        sport === 'nfl' ? (nflStatType === 'td' ? NFL_TD_PRESETS : NFL_YDS_PRESETS) : thresholdPresetsFor(sport, stat)
      setThresholdN(String(presets[0]))
      setLastA('3')
      setLastB('5')
    } else if (mode === 'compute') {
      if (!stat) return
      const presets =
        sport === 'nfl' ? (nflStatType === 'td' ? NFL_TD_COMPUTE_PRESETS : NFL_YDS_COMPUTE_PRESETS) : computeThresholdPresetsFor(sport, stat)
      setThresholdMode('min')
      setMinN(String(presets[0]))
      setComputeWindow('-last')
      setWindowN('10')
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
        setLastA('3')
        setLastB('5')
      } else {
        setNflMinYds(String(computePresets[0]))
        if (explosiveLeague === 'mlb') setWindowN('10')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sport, stat, nflStatType, teamStat, teamSubMode, explosiveLeague, nflExplosiveSubMode])

  return {
    // mode
    mode, setMode: handleModeSelect,
    // sport / stat / period
    sport, setSport: handleSportSelect,
    seasonType, setSeasonType,
    period, setPeriod: handlePeriodSelect,
    stat, setStat,
    stats,
    batPosition, setBatPosition,
    // trend
    thresholdN, setThresholdN,
    lastA, setLastA,
    lastB, setLastB,
    // compute
    minN, setMinN,
    maxN, setMaxN,
    thresholdMode, setThresholdMode,
    computeWindow, setComputeWindow,
    windowN, setWindowN,
    // h2h
    h2hPlayer, setH2hPlayer,
    h2hOpponent, setH2hOpponent,
    // team
    teamStat, setTeamStat,
    teamSubMode, setTeamSubMode,
    // nfl
    nflStatType, setNflStatType,
    // explosive
    explosiveLeague, setExplosiveLeague,
    nflPlayType, setNflPlayType,
    nflYds, setNflYds,
    nflExplosiveSubMode, setNflExplosiveSubMode,
    nflMinYds, setNflMinYds,
    // computed
    builtCommand,
    canRun,
    isBuilderQuery,
    isNbaHalfPeriod,
    // helpers used by CalcNumSelect callers
    computeThresholdPresetsFor,
    thresholdPresetsFor,
  }
}

export type CalculatorQueryState = ReturnType<typeof useCalculatorQuery>
