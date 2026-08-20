// Calculator-style builder screen: mode chips, live query-preview line,
// button grid, numpad-as-fallback (via CalcNumSelect), run button.
//
// Deliberately calculator-shaped, not a ported form: button ROWS are fixed
// CSS grids (uniform cell size, like a real keypad) rather than flex-wrap
// pills that shrink to their text — and section labels are kept small and
// secondary so the buttons themselves stay the dominant visual element.
import type { ReactNode } from 'react'
import {
  COMPUTE_WINDOW_N_PRESETS,
  EXPLOSIVE_MLB_COMPUTE_PRESETS,
  EXPLOSIVE_MLB_TREND_PRESETS,
  EXPLOSIVE_NFL_COMPUTE_PRESETS,
  EXPLOSIVE_NFL_TREND_PRESETS,
  NFL_TD_COMPUTE_PRESETS,
  NFL_TD_PRESETS,
  NFL_YDS_COMPUTE_PRESETS,
  NFL_YDS_PRESETS,
  SPORTS,
  TEAM_RUNS_COMPUTE_PRESETS,
  TEAM_RUNS_TREND_PRESETS,
  WINDOW_LAST_PRESETS,
  WINDOW_MET_PRESETS,
  type ComputeWindow,
} from '@/components/QueryBuilder'
import { CalcButton } from './components/CalcButton'
import { CalcNumSelect } from './components/CalcNumSelect'
import { ModeChip } from './components/ModeChip'
import { C } from './components/theme'
import {
  CALC_MODES,
  MLB_TEAMS,
  type CalcMode,
  type CalculatorQueryState,
} from './state/useCalculatorQuery'
import type { PopularPlayer } from '@/components/QueryBuilder'

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[9px] uppercase tracking-widest mb-1 opacity-70" style={{ color: C.textDim }}>
      {children}
    </div>
  )
}

// Fixed-column button grid — the calculator-keypad primitive every button
// row in this screen uses, instead of flex-wrap pills that shrink to fit
// their own text. Uniform cell size is what makes this read as a keypad.
function ButtonGrid({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {children}
    </div>
  )
}

export interface BuilderScreenProps {
  state: CalculatorQueryState
  onRun: () => void
  isLoading: boolean
  popularPlayers?: PopularPlayer[]
}

export function BuilderScreen({ state, onRun, isLoading, popularPlayers = [] }: BuilderScreenProps) {
  const {
    mode, setMode,
    sport, setSport,
    seasonType, setSeasonType,
    period, setPeriod,
    stat, setStat,
    stats,
    thresholdN, setThresholdN,
    lastA, setLastA,
    lastB, setLastB,
    minN, setMinN,
    maxN, setMaxN,
    thresholdMode, setThresholdMode,
    computeWindow, setComputeWindow,
    windowN, setWindowN,
    h2hPlayer, setH2hPlayer,
    h2hOpponent, setH2hOpponent,
    teamStat, setTeamStat,
    teamSubMode, setTeamSubMode,
    nflStatType, setNflStatType,
    explosiveLeague, setExplosiveLeague,
    nflPlayType, setNflPlayType,
    nflYds, setNflYds,
    nflExplosiveSubMode, setNflExplosiveSubMode,
    nflMinYds, setNflMinYds,
    builtCommand,
    canRun,
    isBuilderQuery,
    computeThresholdPresetsFor,
    thresholdPresetsFor,
  } = state

  const isExplosiveMlb = mode === 'explosive' && explosiveLeague === 'mlb'
  const explosiveTrendPresets = explosiveLeague === 'mlb' ? EXPLOSIVE_MLB_TREND_PRESETS : EXPLOSIVE_NFL_TREND_PRESETS
  const explosiveComputePresets = explosiveLeague === 'mlb' ? EXPLOSIVE_MLB_COMPUTE_PRESETS : EXPLOSIVE_NFL_COMPUTE_PRESETS
  const nflThresholdPresets = nflStatType === 'td' ? NFL_TD_PRESETS : NFL_YDS_PRESETS
  const nflComputePresets = nflStatType === 'td' ? NFL_TD_COMPUTE_PRESETS : NFL_YDS_COMPUTE_PRESETS

  // Stat grid: enough columns that MLB's 9/NBA's 10 options still read as a
  // keypad (3 short rows) rather than a long single-column list.
  const statCols = stats.length > 6 ? 3 : Math.min(stats.length, 3) || 2

  return (
    <div className="w-full h-full flex flex-col" style={{ color: C.textBright, fontFamily: 'monospace' }}>
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2">
        {/* Mode chips — the one row that's genuinely a tab bar, not a keypad */}
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {CALC_MODES.map((m: CalcMode) => (
            <ModeChip
              key={m}
              selected={mode === m}
              onClick={() => setMode(m)}
              variant={m === 'explosive' ? 'explosive' : 'accent'}
            >
              {m}
            </ModeChip>
          ))}
        </div>

        {/* Explosive mode */}
        {mode === 'explosive' && (
          <>
            <SectionLabel>league</SectionLabel>
            <ButtonGrid cols={2}>
              <CalcButton selected={explosiveLeague === 'mlb'} onClick={() => setExplosiveLeague('mlb')}>MLB</CalcButton>
              <CalcButton selected={explosiveLeague === 'nfl'} onClick={() => setExplosiveLeague('nfl')}>NFL</CalcButton>
            </ButtonGrid>

            <SectionLabel>mode</SectionLabel>
            <ButtonGrid cols={2}>
              <CalcButton selected={nflExplosiveSubMode === 'trend'} onClick={() => setNflExplosiveSubMode('trend')}>trend</CalcButton>
              <CalcButton selected={nflExplosiveSubMode === 'compute'} onClick={() => setNflExplosiveSubMode('compute')}>compute</CalcButton>
            </ButtonGrid>

            {explosiveLeague === 'nfl' && (
              <>
                <SectionLabel>play type</SectionLabel>
                <ButtonGrid cols={3}>
                  {(['rush', 'pass', 'rec'] as const).map((pt) => (
                    <CalcButton key={pt} selected={nflPlayType === pt} onClick={() => setNflPlayType(nflPlayType === pt ? '' : pt)}>
                      {pt.toUpperCase()}
                    </CalcButton>
                  ))}
                </ButtonGrid>
              </>
            )}

            {nflExplosiveSubMode === 'trend' ? (
              <>
                <div className="mb-3">
                  {/* Explosive-specific copy: makes single-play vs full-game-total
                      unambiguous, since preset numbers alone can't carry that
                      distinction on a screen with less room than desktop. */}
                  <SectionLabel>single play ≥ {isExplosiveMlb ? '(ft)' : '(yds)'}</SectionLabel>
                  <CalcNumSelect value={nflYds} onChange={setNflYds} options={explosiveTrendPresets} />
                </div>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <SectionLabel>met</SectionLabel>
                    <CalcNumSelect value={lastA} onChange={setLastA} options={WINDOW_MET_PRESETS} />
                  </div>
                  <div>
                    <SectionLabel>-last</SectionLabel>
                    <CalcNumSelect value={lastB} onChange={setLastB} options={WINDOW_LAST_PRESETS} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mb-3">
                  <SectionLabel>single play, min ≥ {isExplosiveMlb ? '(ft)' : '(yds)'}</SectionLabel>
                  <CalcNumSelect value={nflMinYds} onChange={setNflMinYds} options={explosiveComputePresets} />
                </div>
                <div className="mb-3">
                  <SectionLabel>-last {'{optional — defaults to -season}'}</SectionLabel>
                  <CalcNumSelect value={windowN} onChange={setWindowN} options={COMPUTE_WINDOW_N_PRESETS} />
                </div>
              </>
            )}
          </>
        )}

        {/* H2H mode */}
        {mode === 'h2h' && (
          <>
            <SectionLabel>opponent team</SectionLabel>
            <div className="grid grid-cols-6 gap-1.5 mb-3">
              {MLB_TEAMS.map((t) => (
                <CalcButton
                  key={t}
                  selected={h2hOpponent === t}
                  onClick={() => setH2hOpponent(h2hOpponent === t ? '' : t)}
                  className="w-full text-[12px] min-h-[40px]"
                >
                  {t}
                </CalcButton>
              ))}
            </div>

            <SectionLabel>player name</SectionLabel>
            <input
              type="text"
              value={h2hPlayer}
              onChange={(e) => setH2hPlayer(e.target.value)}
              placeholder="type any MLB player (e.g. ketel marte)"
              className="w-full font-mono text-[14px] rounded-xl border px-3 py-3.5 outline-none mb-3"
              style={{ backgroundColor: C.surface2, borderColor: C.border, color: C.accent }}
            />

            {popularPlayers.length > 0 && (
              <>
                <SectionLabel>popular {'{'}top {popularPlayers.length}{'}'}</SectionLabel>
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {popularPlayers.map((p) => {
                    const selected = h2hPlayer.trim().toLowerCase() === p.player.toLowerCase()
                    return (
                      <CalcButton
                        key={`${p.team}-${p.player}`}
                        selected={selected}
                        onClick={() => setH2hPlayer(selected ? '' : p.player)}
                        className="w-auto flex-none px-3 min-h-[36px] text-[11px]"
                      >
                        {`${p.team} ${p.player}`}
                      </CalcButton>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* Team mode */}
        {mode === 'team' && (
          <>
            <SectionLabel>mode</SectionLabel>
            <ButtonGrid cols={2}>
              <CalcButton selected={teamSubMode === 'trend'} onClick={() => setTeamSubMode('trend')}>trend</CalcButton>
              <CalcButton selected={teamSubMode === 'compute'} onClick={() => setTeamSubMode('compute')}>compute</CalcButton>
            </ButtonGrid>

            <SectionLabel>stat</SectionLabel>
            <ButtonGrid cols={2}>
              <CalcButton selected={teamStat === 'runs'} onClick={() => setTeamStat(teamStat === 'runs' ? '' : 'runs')}>-runs</CalcButton>
              <CalcButton selected={teamStat === 'allowed'} onClick={() => setTeamStat(teamStat === 'allowed' ? '' : 'allowed')}>-allowed</CalcButton>
            </ButtonGrid>

            {teamSubMode === 'trend' && teamStat && (
              <>
                <div className="mb-3">
                  <SectionLabel>threshold</SectionLabel>
                  <CalcNumSelect value={thresholdN} onChange={setThresholdN} options={TEAM_RUNS_TREND_PRESETS} />
                </div>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <SectionLabel>met</SectionLabel>
                    <CalcNumSelect value={lastA} onChange={setLastA} options={WINDOW_MET_PRESETS} />
                  </div>
                  <div>
                    <SectionLabel>-last</SectionLabel>
                    <CalcNumSelect value={lastB} onChange={setLastB} options={WINDOW_LAST_PRESETS} />
                  </div>
                </div>
              </>
            )}

            {teamSubMode === 'compute' && teamStat && (
              <ThresholdModeBlock
                thresholdMode={thresholdMode}
                setThresholdMode={setThresholdMode}
                minN={minN}
                setMinN={setMinN}
                maxN={maxN}
                setMaxN={setMaxN}
                presets={TEAM_RUNS_COMPUTE_PRESETS}
                computeWindow={computeWindow}
                setComputeWindow={setComputeWindow}
                windowN={windowN}
                setWindowN={setWindowN}
                allowCareer={false}
              />
            )}
          </>
        )}

        {/* Shared builder fields: trend / compute */}
        {isBuilderQuery && (
          <>
            <SectionLabel>sport</SectionLabel>
            <ButtonGrid cols={4}>
              {SPORTS.map((s) => (
                <CalcButton key={s.value} selected={sport === s.value} onClick={() => setSport(s.value)}>
                  {s.label}
                </CalcButton>
              ))}
            </ButtonGrid>

            {/* "post" is a small optional toggle, not a full section — and
                there's no explicit "reg"/"full" button anymore, since not
                selecting a period already means regular season by default;
                q1/1h/p1 (when applicable) toggle themselves on/off directly
                since there's no separate "reg" button to fall back to. */}
            <div className="mb-3 flex items-center gap-2 flex-wrap">
              <div className="w-24">
                <CalcButton
                  selected={seasonType === 'post'}
                  onClick={() => setSeasonType(seasonType === 'post' ? '' : 'post')}
                  className="w-full min-h-[36px] text-[12px]"
                >
                  post
                </CalcButton>
              </div>
              {sport !== 'mlb' && sport !== 'nfl' && (
                <div className="w-20">
                  <CalcButton
                    selected={period === 'q1'}
                    onClick={() => setPeriod(period === 'q1' ? '' : 'q1')}
                    className="w-full min-h-[36px] text-[12px]"
                  >
                    {sport === 'nhl' ? 'p1' : 'q1'}
                  </CalcButton>
                </div>
              )}
              {sport === 'nba' && (
                <div className="w-20">
                  <CalcButton
                    selected={period === '1h'}
                    onClick={() => setPeriod(period === '1h' ? '' : '1h')}
                    className="w-full min-h-[36px] text-[12px]"
                  >
                    1h
                  </CalcButton>
                </div>
              )}
            </div>

            {sport && stats.length > 0 && (
              <>
                <SectionLabel>stat</SectionLabel>
                <ButtonGrid cols={statCols}>
                  {stats.map((s) => (
                    <CalcButton key={s.value} selected={stat === s.value} onClick={() => setStat(stat === s.value ? '' : s.value)}>
                      {s.label}
                    </CalcButton>
                  ))}
                </ButtonGrid>
              </>
            )}

            {sport === 'nfl' && stat && (
              <>
                <SectionLabel>type</SectionLabel>
                <ButtonGrid cols={2}>
                  <CalcButton selected={nflStatType === 'yds'} onClick={() => setNflStatType('yds')}>-yds</CalcButton>
                  <CalcButton selected={nflStatType === 'td'} onClick={() => setNflStatType('td')}>-td</CalcButton>
                </ButtonGrid>
              </>
            )}

            {mode === 'trend' && stat && (
              <>
                <div className="mb-3">
                  <SectionLabel>threshold</SectionLabel>
                  <CalcNumSelect
                    value={thresholdN}
                    onChange={setThresholdN}
                    options={sport === 'nfl' ? nflThresholdPresets : thresholdPresetsFor(sport, stat)}
                  />
                </div>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <SectionLabel>met</SectionLabel>
                    <CalcNumSelect value={lastA} onChange={setLastA} options={WINDOW_MET_PRESETS} />
                  </div>
                  <div>
                    <SectionLabel>-last</SectionLabel>
                    <CalcNumSelect value={lastB} onChange={setLastB} options={WINDOW_LAST_PRESETS} />
                  </div>
                </div>
              </>
            )}

            {mode === 'compute' && stat && (
              <ThresholdModeBlock
                thresholdMode={thresholdMode}
                setThresholdMode={setThresholdMode}
                minN={minN}
                setMinN={setMinN}
                maxN={maxN}
                setMaxN={setMaxN}
                presets={sport === 'nfl' ? nflComputePresets : computeThresholdPresetsFor(sport, stat)}
                computeWindow={computeWindow}
                setComputeWindow={setComputeWindow}
                windowN={windowN}
                setWindowN={setWindowN}
                allowCareer
              />
            )}
          </>
        )}
      </div>

      {/* Command preview + run — pinned to the bottom like a calculator's
          display+equals row. Run sits bottom-right at a fixed width, not a
          full-width bar, matching where "=" sits on a real calculator. */}
      <div className="px-3 pb-3 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="flex items-stretch gap-2">
          <div
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[12px] break-all flex items-center"
            style={{ backgroundColor: 'oklch(0.10 0 0)', border: `1px solid ${C.border}` }}
          >
            {builtCommand ? (
              <span style={{ color: C.accent }}>{builtCommand}</span>
            ) : (
              <span style={{ color: C.textDim }}>select options</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => canRun && onRun()}
            disabled={!canRun || isLoading}
            className="flex-none w-24 rounded-xl font-mono font-bold text-[15px] uppercase tracking-wide border transition-colors"
            style={{
              backgroundColor: canRun ? C.accent : C.surface2,
              color: canRun ? C.accentDark : C.textDim,
              borderColor: canRun ? C.accent : C.border,
              cursor: canRun && !isLoading ? 'pointer' : 'not-allowed',
            }}
          >
            {isLoading ? '…' : 'run'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Shared "min / min-max / exact" threshold picker + season/career/last window
// picker, used by both compute mode and team-compute mode.
function ThresholdModeBlock({
  thresholdMode,
  setThresholdMode,
  minN,
  setMinN,
  maxN,
  setMaxN,
  presets,
  computeWindow,
  setComputeWindow,
  windowN,
  setWindowN,
  allowCareer,
}: {
  thresholdMode: CalculatorQueryState['thresholdMode']
  setThresholdMode: CalculatorQueryState['setThresholdMode']
  minN: string
  setMinN: (v: string) => void
  maxN: string
  setMaxN: (v: string) => void
  presets: number[]
  computeWindow: ComputeWindow
  setComputeWindow: (w: ComputeWindow) => void
  windowN: string
  setWindowN: (v: string) => void
  allowCareer: boolean
}) {
  return (
    <>
      <SectionLabel>threshold</SectionLabel>
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        <CalcButton
          selected={thresholdMode === 'min'}
          onClick={() => {
            setThresholdMode('min')
            setMaxN('')
          }}
          className="w-full min-h-[36px] text-[12px]"
        >
          min
        </CalcButton>
        <CalcButton
          selected={thresholdMode === 'range'}
          onClick={() => {
            if (thresholdMode === 'exact' && minN) setMaxN(minN)
            setThresholdMode('range')
          }}
          className="w-full min-h-[36px] text-[12px]"
        >
          min-max
        </CalcButton>
        <CalcButton
          selected={thresholdMode === 'exact'}
          onClick={() => {
            setThresholdMode('exact')
            setMaxN('')
          }}
          className="w-full min-h-[36px] text-[12px]"
        >
          exact
        </CalcButton>
      </div>

      <div className="mb-3">
        {thresholdMode === 'min' && (
          <>
            <SectionLabel>min value</SectionLabel>
            <CalcNumSelect value={minN} onChange={setMinN} options={presets} />
          </>
        )}
        {thresholdMode === 'range' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <SectionLabel>min</SectionLabel>
              <CalcNumSelect value={minN} onChange={setMinN} options={presets} />
            </div>
            <div>
              <SectionLabel>max</SectionLabel>
              <CalcNumSelect value={maxN} onChange={setMaxN} options={presets} />
            </div>
          </div>
        )}
        {thresholdMode === 'exact' && (
          <>
            <SectionLabel>exact threshold</SectionLabel>
            <CalcNumSelect value={minN} onChange={setMinN} options={presets} />
          </>
        )}
      </div>

      <SectionLabel>window</SectionLabel>
      <div className="grid grid-cols-3 gap-1.5 items-stretch mb-1">
        <CalcButton
          selected={computeWindow === '-season'}
          onClick={() => setComputeWindow(computeWindow === '-season' ? '' : '-season')}
          className="w-full min-h-[36px] text-[12px]"
        >
          -season
        </CalcButton>
        {allowCareer && (
          <CalcButton
            selected={computeWindow === '-career'}
            onClick={() => setComputeWindow(computeWindow === '-career' ? '' : '-career')}
            className="w-full min-h-[36px] text-[12px]"
          >
            -career
          </CalcButton>
        )}
        <CalcButton
          selected={computeWindow === '-last'}
          onClick={() => setComputeWindow(computeWindow === '-last' ? '' : '-last')}
          className="w-full min-h-[36px] text-[12px]"
        >
          -last
        </CalcButton>
      </div>
      {computeWindow === '-last' && (
        <div className="mb-3">
          <CalcNumSelect value={windowN} onChange={setWindowN} options={COMPUTE_WINDOW_N_PRESETS} />
        </div>
      )}
    </>
  )
}
