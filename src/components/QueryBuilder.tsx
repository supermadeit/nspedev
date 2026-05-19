import { useState, useMemo } from 'react'

type QueryMode = 'trend' | 'compute' | 'streak'
type SeasonType = 'post' | 'reg' | ''
type PeriodType = 'q1' | ''
type ComputeWindow = '-season' | '-career' | '-last' | ''

const DEFAULT_POST_YEAR_BY_SPORT: Record<string, string> = {
  nba: '2026',
  nhl: '2026',
  mlb: '2025',
}

const SPORTS = [
  { value: 'nba', label: 'NBA', comingSoon: false },
  { value: 'mlb', label: 'MLB', comingSoon: false },
  { value: 'nhl', label: 'NHL', comingSoon: false },
  { value: 'nfl', label: 'NFL', comingSoon: true },
]

const SPORT_STATS: Record<string, Array<{ value: string; label: string }>> = {
  nba: [
    { value: 'pts', label: 'PTS' },
    { value: 'reb', label: 'REB' },
    { value: 'ast', label: 'AST' },
    { value: 'stl', label: 'STL' },
    { value: 'blk', label: 'BLK' },
    { value: 'tpm', label: '3PM' },
    { value: 'total', label: 'TOT' },
  ],
  mlb: [
    { value: 'hits', label: 'HITS' },
    { value: 'hr', label: 'HR' },
    { value: 'rbi', label: 'RBI' },
    { value: 'dub', label: '2B' },
    { value: 'trp', label: '3B' },
    { value: 'sb', label: 'SB' },
    { value: 'k', label: 'K' },
    { value: 'bb', label: 'BB' },
  ],
  nhl: [
    { value: 'g', label: 'G' },
    { value: 'a', label: 'A' },
    { value: 'pts', label: 'PTS' },
    { value: 'sog', label: 'SOG' },
    { value: 'blk', label: 'BLK' },
    { value: 'pim', label: 'PIM' },
  ],
  nfl: [],
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
}

export function QueryBuilder({ onRunQuery, isLoading }: QueryBuilderProps) {
  const [mode, setMode] = useState<QueryMode>('trend')
  const [sport, setSport] = useState('')
  const [seasonType, setSeasonType] = useState<SeasonType>('')
  const [postYear, setPostYear] = useState('')
  const [period, setPeriod] = useState<PeriodType>('')
  const [stat, setStat] = useState('')
  // trend
  const [thresholdN, setThresholdN] = useState('')
  const [lastA, setLastA] = useState('')
  const [lastB, setLastB] = useState('')
  // compute
  const [minN, setMinN] = useState('')
  const [computeWindow, setComputeWindow] = useState<ComputeWindow>('')
  const [windowN, setWindowN] = useState('')
  // streak
  const [streakN, setStreakN] = useState('')
  const [streakYear, setStreakYear] = useState('')

  const stats = SPORT_STATS[sport] ?? []

  const handleSportSelect = (s: string) => {
    setSport((prev) => (prev === s ? '' : s))
    setStat('')
  }

  const builtCommand = useMemo(() => {
    if (!sport) return ''

    const parts: string[] = ['nspe', sport]

    if (seasonType) parts.push(seasonType)
    if (period === 'q1') parts.push('q1')

    const resolvedPostYear =
      seasonType === 'post'
        ? postYear || DEFAULT_POST_YEAR_BY_SPORT[sport] || ''
        : ''

    if (mode === 'trend') {
      if (stat) parts.push(`-${stat}${thresholdN}`)
      if (lastA && lastB) parts.push(`-last${lastA}/${lastB}`)
      if (resolvedPostYear) parts.push(resolvedPostYear)
    } else if (mode === 'compute') {
      if (stat) parts.push(`-${stat}`)
      if (minN) parts.push(`min${minN}`)
      if (computeWindow === '-season') parts.push('-season')
      else if (computeWindow === '-career') parts.push('-career')
      else if (computeWindow === '-last' && windowN) parts.push(`-last${windowN}`)
      if (resolvedPostYear) parts.push(resolvedPostYear)
    } else if (mode === 'streak') {
      if (stat && streakN) parts.push(`-${stat}${thresholdN}`)
      if (streakN) parts.push(`-streak${streakN}`)
      if (streakYear) parts.push(streakYear)
    }

    return parts.join(' ')
  }, [mode, sport, seasonType, postYear, period, stat, thresholdN, lastA, lastB, minN, computeWindow, windowN, streakN, streakYear])

  const canRun = Boolean(builtCommand) && !isLoading

  return (
    <div className="w-full" style={{ color: C.textBright, fontFamily: 'monospace' }}>
      {/* Mode tabs */}
      <div className="flex gap-2 mb-4">
        {(['trend', 'compute', 'streak'] as QueryMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="flex-1 py-2 text-[12px] font-bold rounded border uppercase tracking-wider transition-colors"
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
          ? '▸ nspe {sport} {post/reg} {full/q1} {stat}N -lastN/N'
          : mode === 'compute'
          ? '▸ nspe {sport} {post/reg} {full/q1} {stat} minN {-window}'
          : '▸ nspe {sport} {post/reg} {full/q1} {stat}N -streakN {YYYY|YYYY-YYYY}'}
      </div>
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
          <div>
            <SLabel>year window</SLabel>
            <input
              type="text"
              value={streakYear}
              onChange={e => setStreakYear(e.target.value.replace(/[^0-9\-]/g, ''))}
              placeholder="YYYY or YYYY-YYYY"
              className="font-mono text-[13px] rounded border px-2 py-1.5 outline-none"
              style={{ width: '110px', backgroundColor: C.surface2, borderColor: C.border, color: C.accent }}
            />
          </div>
        </div>
      )}

      {/* Sport */}
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

      {/* Season / Period */}
      <div className="flex gap-6 mb-3">
        <div>
          <SLabel>season</SLabel>
          <div className="flex gap-1.5">
            {(['post', 'reg'] as const).map((v) => (
              <Pill
                key={v}
                selected={seasonType === v}
                onClick={() => setSeasonType((p) => (p === v ? '' : v))}
              >
                {v}
              </Pill>
            ))}
          </div>
        </div>
        <div>
          <SLabel>period</SLabel>
          <div className="flex gap-1.5">
            <Pill selected={period === ''} onClick={() => setPeriod('')}>
              full
            </Pill>
            <Pill selected={period === 'q1'} onClick={() => setPeriod('q1')}>
              q1
            </Pill>
          </div>
        </div>
        {seasonType === 'post' && (mode === 'trend' || mode === 'compute') && (
          <div>
            <SLabel>post year</SLabel>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={postYear}
              onChange={(e) => setPostYear(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
              placeholder={sport ? DEFAULT_POST_YEAR_BY_SPORT[sport] || 'YYYY' : 'YYYY'}
              className="font-mono text-[13px] rounded border px-2 py-1.5 outline-none"
              style={{
                width: '88px',
                backgroundColor: C.surface2,
                borderColor: C.border,
                color: C.accent,
              }}
            />
          </div>
        )}
      </div>

      {/* Stats */}
      {sport && stats.length > 0 && (
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
          <div>
            <SLabel>-last &nbsp;met</SLabel>
            <div className="flex items-center gap-1.5">
              <NumInput value={lastA} onChange={setLastA} placeholder="N" w={54} />
              <span style={{ color: C.textDim }}>/</span>
              <NumInput value={lastB} onChange={setLastB} placeholder="" w={54} />
            </div>
          </div>
        </div>
      )}

      {/* Compute: min + window */}
      {mode === 'compute' && stat && (
        <div className="mb-3">
          <div className="mb-3">
            <SLabel>min threshold</SLabel>
            <NumInput value={minN} onChange={setMinN} w={72} />
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
