// Calculator-style builder screen: mode chips, live query-preview line,
// button grid, numpad-as-fallback (via CalcNumSelect), run button.
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
  MLB_POSITIONS,
  MLB_TEAMS,
  type CalcMode,
  type CalculatorQueryState,
} from './state/useCalculatorQuery'

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-widest mb-1.5" style={{ color: C.textDim }}>
      {children}
    </div>
  )
}

export interface BuilderScreenProps {
  state: CalculatorQueryState
  onRun: () => void
  isLoading: boolean
}

export function BuilderScreen({ state, onRun, isLoading }: BuilderScreenProps) {
  const {
    mode, setMode,
    sport, setSport,
    seasonType, setSeasonType,
    period, setPeriod,
    stat, setStat,
    stats,
    batPosition, setBatPosition,
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

  return (
    <div className="w-full h-full flex flex-col" style={{ color: C.textBright, fontFamily: 'monospace' }}>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {/* Mode chips */}
        <div className="flex gap-1.5 mb-4 flex-wrap">
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
            <div className="mb-3">
              <SectionLabel>league</SectionLabel>
              <div className="flex gap-1.5">
                <CalcButton selected={explosiveLeague === 'mlb'} onClick={() => setExplosiveLeague('mlb')}>MLB</CalcButton>
                <CalcButton selected={explosiveLeague === 'nfl'} onClick={() => setExplosiveLeague('nfl')}>NFL</CalcButton>
              </div>
            </div>

            <div className="mb-3">
              <SectionLabel>mode</SectionLabel>
              <div className="flex gap-1.5">
                <CalcButton selected={nflExplosiveSubMode === 'trend'} onClick={() => setNflExplosiveSubMode('trend')}>trend</CalcButton>
                <CalcButton selected={nflExplosiveSubMode === 'compute'} onClick={() => setNflExplosiveSubMode('compute')}>compute</CalcButton>
              </div>
            </div>

            {explosiveLeague === 'nfl' && (
              <div className="mb-3">
                <SectionLabel>play type</SectionLabel>
                <div className="flex gap-1.5 flex-wrap">
                  {(['rush', 'pass', 'rec'] as const).map((pt) => (
                    <CalcButton key={pt} selected={nflPlayType === pt} onClick={() => setNflPlayType(nflPlayType === pt ? '' : pt)}>
                      {pt.toUpperCase()}
                    </CalcButton>
                  ))}
                </div>
              </div>
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
                <div className="mb-3 flex gap-4">
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
                {isExplosiveMlb && (
                  <div className="mb-3">
                    <SectionLabel>-last {'{optional}'}</SectionLabel>
                    <CalcNumSelect value={windowN} onChange={setWindowN} options={COMPUTE_WINDOW_N_PRESETS} />
                  </div>
                )}
                {!isExplosiveMlb && (
                  <div className="font-mono text-[10px] mb-3" style={{ color: C.textDim }}>
                    ▸ -season (fixed for NFL compute)
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* H2H mode */}
        {mode === 'h2h' && (
          <>
            <div className="mb-3">
              <SectionLabel>opponent team</SectionLabel>
              <div className="grid grid-cols-5 gap-1.5">
                {MLB_TEAMS.map((t) => (
                  <CalcButton
                    key={t}
                    selected={h2hOpponent === t}
                    onClick={() => setH2hOpponent(h2hOpponent === t ? '' : t)}
                    className="px-1.5 py-2 text-[11px]"
                  >
                    {t}
                  </CalcButton>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <SectionLabel>player name</SectionLabel>
              <input
                type="text"
                value={h2hPlayer}
                onChange={(e) => setH2hPlayer(e.target.value)}
                placeholder="type any MLB player (e.g. ketel marte)"
                className="w-full font-mono text-[13px] rounded-lg border px-3 py-2.5 outline-none"
                style={{ backgroundColor: C.surface2, borderColor: C.border, color: C.accent }}
              />
            </div>
          </>
        )}

        {/* Team mode */}
        {mode === 'team' && (
          <>
            <div className="mb-3">
              <SectionLabel>mode</SectionLabel>
              <div className="flex gap-1.5">
                <CalcButton selected={teamSubMode === 'trend'} onClick={() => setTeamSubMode('trend')}>trend</CalcButton>
                <CalcButton selected={teamSubMode === 'compute'} onClick={() => setTeamSubMode('compute')}>compute</CalcButton>
              </div>
            </div>

            <div className="mb-3">
              <SectionLabel>stat</SectionLabel>
              <div className="flex gap-1.5">
                <CalcButton selected={teamStat === 'runs'} onClick={() => setTeamStat(teamStat === 'runs' ? '' : 'runs')}>-runs</CalcButton>
                <CalcButton selected={teamStat === 'allowed'} onClick={() => setTeamStat(teamStat === 'allowed' ? '' : 'allowed')}>-allowed</CalcButton>
              </div>
            </div>

            {teamSubMode === 'trend' && teamStat && (
              <>
                <div className="mb-3">
                  <SectionLabel>threshold</SectionLabel>
                  <CalcNumSelect value={thresholdN} onChange={setThresholdN} options={TEAM_RUNS_TREND_PRESETS} />
                </div>
                <div className="mb-3 flex gap-4">
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
            <div className="mb-3">
              <SectionLabel>sport</SectionLabel>
              <div className="flex gap-1.5 flex-wrap">
                {SPORTS.map((s) => (
                  <CalcButton key={s.value} selected={sport === s.value} onClick={() => setSport(s.value)}>
                    {s.label}
                  </CalcButton>
                ))}
              </div>
            </div>

            <div className="mb-3 flex gap-4 flex-wrap">
              <div>
                <SectionLabel>season</SectionLabel>
                <CalcButton
                  selected={seasonType === 'post'}
                  onClick={() => setSeasonType(seasonType === 'post' ? '' : 'post')}
                >
                  post
                </CalcButton>
              </div>
              <div>
                <SectionLabel>{sport === 'mlb' ? 'season' : 'period'}</SectionLabel>
                <div className="flex gap-1.5 flex-wrap">
                  <CalcButton selected={period === ''} onClick={() => setPeriod('')}>
                    {sport === 'mlb' ? 'reg' : 'full'}
                  </CalcButton>
                  {sport !== 'mlb' && sport !== 'nfl' && (
                    <CalcButton selected={period === 'q1'} onClick={() => setPeriod('q1')}>
                      {sport === 'nhl' ? 'p1' : 'q1'}
                    </CalcButton>
                  )}
                  {sport === 'nba' && (
                    <CalcButton selected={period === '1h'} onClick={() => setPeriod('1h')}>1h</CalcButton>
                  )}
                </div>
              </div>
            </div>

            {sport === 'mlb' && (
              <div className="mb-3">
                <SectionLabel>batter position {'{optional}'}</SectionLabel>
                <div className="flex gap-1.5 flex-wrap">
                  {MLB_POSITIONS.map((pos) => (
                    <CalcButton
                      key={pos.value}
                      selected={batPosition === pos.value}
                      onClick={() => setBatPosition(batPosition === pos.value ? '' : pos.value)}
                    >
                      {pos.label}
                    </CalcButton>
                  ))}
                </div>
              </div>
            )}

            {sport && stats.length > 0 && (
              <div className="mb-3">
                <SectionLabel>stat</SectionLabel>
                <div className="flex gap-1.5 flex-wrap">
                  {stats.map((s) => (
                    <CalcButton key={s.value} selected={stat === s.value} onClick={() => setStat(stat === s.value ? '' : s.value)}>
                      {s.label}
                    </CalcButton>
                  ))}
                </div>
              </div>
            )}

            {sport === 'nfl' && stat && (
              <div className="mb-3">
                <SectionLabel>type</SectionLabel>
                <div className="flex gap-1.5">
                  <CalcButton selected={nflStatType === 'yds'} onClick={() => setNflStatType('yds')}>-yds</CalcButton>
                  <CalcButton selected={nflStatType === 'td'} onClick={() => setNflStatType('td')}>-td</CalcButton>
                </div>
              </div>
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
                <div className="mb-3 flex gap-4">
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

      {/* Command preview + run — pinned to the bottom, like a calculator's display */}
      <div className="px-4 pb-4 pt-2" style={{ borderTop: `1px solid ${C.border}` }}>
        <div
          className="px-3 py-2.5 rounded-lg text-[12px] break-all min-h-[38px] flex items-center mb-3"
          style={{ backgroundColor: 'oklch(0.10 0 0)', border: `1px solid ${C.border}` }}
        >
          {builtCommand ? (
            <span style={{ color: C.accent }}>{builtCommand}</span>
          ) : (
            <span style={{ color: C.textDim }}>select options to build query</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => canRun && onRun()}
          disabled={!canRun || isLoading}
          className="w-full py-3.5 rounded-lg font-mono font-bold text-[14px] uppercase tracking-wide border transition-colors"
          style={{
            backgroundColor: canRun ? C.accent : C.surface2,
            color: canRun ? C.accentDark : C.textDim,
            borderColor: canRun ? C.accent : C.border,
            cursor: canRun && !isLoading ? 'pointer' : 'not-allowed',
          }}
        >
          {isLoading ? 'running...' : 'run'}
        </button>
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
    <div className="mb-3">
      <div className="mb-2">
        <SectionLabel>threshold</SectionLabel>
        <div className="flex gap-1.5 flex-wrap">
          <CalcButton
            selected={thresholdMode === 'min'}
            onClick={() => {
              setThresholdMode('min')
              setMaxN('')
            }}
          >
            min
          </CalcButton>
          <CalcButton
            selected={thresholdMode === 'range'}
            onClick={() => {
              if (thresholdMode === 'exact' && minN) setMaxN(minN)
              setThresholdMode('range')
            }}
          >
            min-max
          </CalcButton>
          <CalcButton
            selected={thresholdMode === 'exact'}
            onClick={() => {
              setThresholdMode('exact')
              setMaxN('')
            }}
          >
            exact
          </CalcButton>
        </div>
      </div>

      <div className="mb-3">
        {thresholdMode === 'min' && (
          <>
            <SectionLabel>min value</SectionLabel>
            <CalcNumSelect value={minN} onChange={setMinN} options={presets} />
          </>
        )}
        {thresholdMode === 'range' && (
          <div className="flex flex-col gap-2">
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
      <div className="flex gap-1.5 flex-wrap items-center">
        <CalcButton
          selected={computeWindow === '-season'}
          onClick={() => setComputeWindow(computeWindow === '-season' ? '' : '-season')}
        >
          -season
        </CalcButton>
        {allowCareer && (
          <CalcButton
            selected={computeWindow === '-career'}
            onClick={() => setComputeWindow(computeWindow === '-career' ? '' : '-career')}
          >
            -career
          </CalcButton>
        )}
        <CalcButton
          selected={computeWindow === '-last'}
          onClick={() => setComputeWindow(computeWindow === '-last' ? '' : '-last')}
        >
          -last
        </CalcButton>
        {computeWindow === '-last' && (
          <CalcNumSelect value={windowN} onChange={setWindowN} options={COMPUTE_WINDOW_N_PRESETS} />
        )}
      </div>
    </div>
  )
}
