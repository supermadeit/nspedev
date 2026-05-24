import { useEffect, useMemo, useState } from 'react'

const C = {
  accent: 'oklch(0.85 0.15 195)',
  accentDark: 'oklch(0.10 0.02 195)',
  accentDim: 'oklch(0.55 0.12 195)',
  surface: 'oklch(0.12 0 0)',
  surface2: 'oklch(0.20 0 0)',
  border: 'oklch(0.28 0 0)',
  textDim: 'oklch(0.48 0 0)',
  textBright: 'oklch(0.88 0 0)',
}

type DemoStep = {
  mode: 'trend' | 'compute' | 'streak'
  sport: 'nba' | 'mlb' | 'nhl'
  season?: 'post' | 'reg'
  period?: 'q1' | 'q2' | '1h' | 'p1'
  stat?: string
  thresholdN?: string
  lastA?: string
  lastB?: string
  minN?: string
  window?: '-season' | '-career' | string
  streakN?: string
  command: string
  caption: string
}

const DEMOS: DemoStep[] = [
  {
    mode: 'trend',
    sport: 'nba',
    period: '1h',
    stat: 'pts',
    thresholdN: '20',
    lastA: '2',
    lastB: '5',
    command: 'nspe nba 1h -pts20 -last2/5',
    caption: 'NBA \u2014 1st-half PTS \u2265 20 in 2 of last 5 games',
  },
  {
    mode: 'trend',
    sport: 'nba',
    period: 'q2',
    stat: 'tpm',
    thresholdN: '2',
    lastA: '3',
    lastB: '5',
    command: 'nspe nba q2 -tpm2 -last3/5',
    caption: 'NBA \u2014 Q2 3PM \u2265 2 in 3 of last 5 games',
  },
  {
    mode: 'trend',
    sport: 'nba',
    stat: 'pts+ast',
    thresholdN: '35',
    lastA: '2',
    lastB: '5',
    command: 'nspe nba -pts+ast35 -last2/5',
    caption: 'NBA \u2014 PTS+AST combo \u2265 35 in 2 of last 5 games',
  },
  {
    mode: 'compute',
    sport: 'mlb',
    stat: 'hits',
    minN: '20',
    window: '-last',
    command: 'nspe mlb -hits min20 -last10',
    caption: 'MLB \u2014 regular-season hits \u2265 20, last 10 games',
  },
  {
    mode: 'trend',
    sport: 'mlb',
    stat: 'tb',
    thresholdN: '2',
    lastA: '3',
    lastB: '5',
    command: 'nspe mlb -tb2 -last3/5',
    caption: 'MLB \u2014 total bases \u2265 2 in 3 of last 5 games',
  },
  {
    mode: 'streak',
    sport: 'nhl',
    period: 'p1',
    stat: 'pts',
    thresholdN: '1',
    streakN: '3',
    command: 'nspe nhl p1 -pts1 -streak3',
    caption: 'NHL \u2014 1st-period PTS \u2265 1, min streak of 3',
  },
]

// fade-in order of pills per step
const PILL_STAGES = ['mode', 'sport', 'season', 'period', 'stat', 'value', 'command'] as const
type Stage = (typeof PILL_STAGES)[number]

function Pill({
  children,
  selected,
  highlight,
  disabled,
}: {
  children: React.ReactNode
  selected?: boolean
  highlight?: boolean
  disabled?: boolean
}) {
  return (
    <span
      className="font-mono text-[11px] px-3 py-1.5 rounded border select-none transition-all duration-300"
      style={{
        backgroundColor: selected ? C.accent : C.surface2,
        color: selected ? C.accentDark : disabled ? C.textDim : C.textBright,
        borderColor: selected ? C.accent : C.border,
        opacity: disabled ? 0.4 : highlight ? 1 : selected ? 1 : 0.55,
        fontWeight: selected ? 700 : 400,
        boxShadow: highlight ? `0 0 0 2px ${C.accent}` : 'none',
      }}
    >
      {children}
    </span>
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

function FakeNum({ value, visible }: { value: string; visible: boolean }) {
  return (
    <span
      className="font-mono text-[13px] rounded border px-2 py-1.5 inline-block transition-opacity duration-300"
      style={{
        width: '64px',
        backgroundColor: C.surface2,
        borderColor: C.border,
        color: C.accent,
        opacity: visible ? 1 : 0.35,
      }}
    >
      {visible ? value || 'N' : 'N'}
    </span>
  )
}

export interface QueryBuilderTutorialProps {
  open: boolean
  onClose: () => void
}

export function QueryBuilderTutorial({ open, onClose }: QueryBuilderTutorialProps) {
  const [stepIdx, setStepIdx] = useState(0)
  const [stageIdx, setStageIdx] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (!open) return
    setStepIdx(0)
    setStageIdx(0)
    setIsPaused(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === ' ') {
        e.preventDefault()
        setIsPaused((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || isPaused) return
    const id = window.setInterval(() => {
      setStageIdx((s) => {
        if (s < PILL_STAGES.length - 1) return s + 1
        // advance to next demo after a beat at the final stage
        setStepIdx((d) => (d + 1) % DEMOS.length)
        return 0
      })
    }, 1150)
    return () => window.clearInterval(id)
  }, [open, isPaused])

  const demo = DEMOS[stepIdx]
  const stage: Stage = PILL_STAGES[stageIdx]
  const reached = useMemo(
    () => (s: Stage) => PILL_STAGES.indexOf(s) <= stageIdx,
    [stageIdx],
  )

  if (!open) return null

  // build progressive command preview
  let preview = `nspe ${demo.sport}`
  if (reached('season') && demo.season) preview += ` ${demo.season}`
  if (reached('period') && demo.period) preview += ` ${demo.period}`
  if (reached('stat') && demo.stat) {
    if (demo.mode === 'trend' || demo.mode === 'streak') {
      preview += ` -${demo.stat}${reached('value') ? demo.thresholdN ?? '' : ''}`
    } else {
      preview += ` -${demo.stat}`
    }
  }
  if (reached('value')) {
    if (demo.mode === 'trend' && demo.lastA && demo.lastB) {
      preview += ` -last${demo.lastA}/${demo.lastB}`
    } else if (demo.mode === 'compute' && demo.minN) {
      preview += ` min${demo.minN}${demo.window ? ' ' + demo.window : ''}`
    } else if (demo.mode === 'streak' && demo.streakN) {
      preview += ` -streak${demo.streakN}`
    }
  }
  const finalCmd = reached('command') ? demo.command : preview

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.78)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Query builder tutorial"
    >
      <div
        className="w-full max-w-[640px] max-h-[92vh] rounded-lg overflow-y-auto cursor-pointer"
        style={{
          backgroundColor: C.surface,
          border: `1px solid ${C.border}`,
          color: C.textBright,
          fontFamily: 'monospace',
        }}
        onClick={(e) => {
          e.stopPropagation()
          setIsPaused((p) => !p)
        }}
        title={isPaused ? 'click to resume' : 'click to pause'}
      >
        {/* header */}
        <div
          className="flex items-center justify-between px-5 py-3 sticky top-0"
          style={{ backgroundColor: 'oklch(0.18 0 0)', borderBottom: `1px solid ${C.border}` }}
        >
          <span className="font-mono font-bold text-[14px]" style={{ color: C.accent }}>
            {'{tutorial}'} — query builder
          </span>
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-[10px] uppercase tracking-widest"
              style={{ color: isPaused ? 'oklch(0.75 0.15 145)' : C.textDim }}
            >
              {isPaused ? '❙❙ paused' : '▸ playing'}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              className="font-mono text-[14px] hover:opacity-70 transition-opacity"
              style={{ color: C.accent }}
              aria-label="Close tutorial"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-[11px] leading-relaxed" style={{ color: C.textDim }}>
            Watch the builder light up step-by-step. Click anywhere to pause / resume (space also
            works). Read-only — run real queries from the query builder or search bar.
          </div>

          {/* step caption */}
          <div
            className="rounded px-3 py-2 text-[12px]"
            style={{ backgroundColor: 'oklch(0.10 0 0)', border: `1px solid ${C.border}`, color: C.accentDim }}
          >
            <span style={{ color: C.textDim }}>step {stepIdx + 1}/{DEMOS.length} · </span>
            <span style={{ color: C.textBright }}>{demo.caption}</span>
          </div>

          {/* mock builder */}
          <div className="rounded p-3" style={{ border: `1px solid ${C.border}`, backgroundColor: 'oklch(0.10 0 0)' }}>
            {/* mode tabs */}
            <div className="flex gap-2 mb-3">
              {(['trend', 'compute', 'streak'] as const).map((m) => (
                <div
                  key={m}
                  className="flex-1 py-2 text-[11px] font-bold rounded border uppercase tracking-wider text-center transition-all duration-300"
                  style={{
                    backgroundColor: demo.mode === m ? C.accent : C.surface2,
                    color: demo.mode === m ? C.accentDark : C.accentDim,
                    borderColor: demo.mode === m ? C.accent : C.border,
                    opacity: reached('mode') ? 1 : 0.4,
                    boxShadow: stage === 'mode' && demo.mode === m ? `0 0 0 2px ${C.accent}` : 'none',
                  }}
                >
                  {m}
                </div>
              ))}
            </div>

            {/* sport */}
            <div className="mb-3">
              <SLabel>sport</SLabel>
              <div className="flex gap-2 flex-wrap">
                {(['nba', 'mlb', 'nhl', 'nfl'] as const).map((s) => (
                  <Pill
                    key={s}
                    selected={reached('sport') && demo.sport === s}
                    highlight={stage === 'sport' && demo.sport === s}
                    disabled={s === 'nfl'}
                  >
                    {s === 'nfl' ? '{NFL}' : s.toUpperCase()}
                  </Pill>
                ))}
              </div>
            </div>

            {/* season + period */}
            <div className="flex gap-6 mb-3 flex-wrap">
              <div>
                <SLabel>season</SLabel>
                <div className="flex gap-1.5">
                  {(['post', 'reg'] as const).map((v) => (
                    <Pill
                      key={v}
                      selected={reached('season') && demo.season === v}
                      highlight={stage === 'season' && demo.season === v}
                    >
                      {v}
                    </Pill>
                  ))}
                </div>
              </div>
              <div>
                <SLabel>period</SLabel>
                <div className="flex gap-1.5 flex-wrap">
                  <Pill selected={reached('period') && !demo.period}>full</Pill>
                  {demo.sport !== 'mlb' && (
                    <Pill
                      selected={reached('period') && (demo.period === 'q1' || demo.period === 'p1')}
                      highlight={stage === 'period' && (demo.period === 'q1' || demo.period === 'p1')}
                    >
                      {demo.sport === 'nhl' ? 'p1' : 'q1'}
                    </Pill>
                  )}
                  {demo.sport === 'nba' && (
                    <>
                      <Pill
                        selected={reached('period') && demo.period === 'q2'}
                        highlight={stage === 'period' && demo.period === 'q2'}
                      >
                        q2
                      </Pill>
                      <Pill
                        selected={reached('period') && demo.period === '1h'}
                        highlight={stage === 'period' && demo.period === '1h'}
                      >
                        1h
                      </Pill>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* stat */}
            <div className="mb-3">
              <SLabel>stat</SLabel>
              <div className="flex gap-1.5 flex-wrap">
                {(demo.sport === 'nba'
                  ? ['pts', 'reb', 'ast', 'tpm', 'pts+ast']
                  : demo.sport === 'mlb'
                    ? ['hits', 'hr', 'rbi', 'k', 'tb']
                    : ['g', 'a', 'pts', 'sog']
                ).map((s) => (
                  <Pill
                    key={s}
                    selected={reached('stat') && demo.stat === s}
                    highlight={stage === 'stat' && demo.stat === s}
                  >
                    {s.toUpperCase()}
                  </Pill>
                ))}
              </div>
            </div>

            {/* mode-specific values */}
            {demo.mode === 'trend' && (
              <div className="mb-1 flex items-end gap-5 flex-wrap">
                <div>
                  <SLabel>threshold</SLabel>
                  <FakeNum value={demo.thresholdN ?? ''} visible={reached('value')} />
                </div>
                <div>
                  <SLabel>-last met</SLabel>
                  <div className="flex items-center gap-1.5">
                    <FakeNum value={demo.lastA ?? ''} visible={reached('value')} />
                    <span style={{ color: C.textDim }}>/</span>
                    <FakeNum value={demo.lastB ?? ''} visible={reached('value')} />
                  </div>
                </div>
              </div>
            )}
            {demo.mode === 'compute' && (
              <div className="mb-1 flex items-end gap-5 flex-wrap">
                <div>
                  <SLabel>min</SLabel>
                  <FakeNum value={demo.minN ?? ''} visible={reached('value')} />
                </div>
                <div>
                  <SLabel>window</SLabel>
                  <div className="flex gap-1.5">
                    {(['-season', '-career', '-last'] as const).map((w) => (
                      <Pill
                        key={w}
                        selected={reached('value') && demo.window === w}
                        highlight={stage === 'value' && demo.window === w}
                      >
                        {w}
                      </Pill>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {demo.mode === 'streak' && (
              <div className="mb-1 flex items-end gap-5 flex-wrap">
                <div>
                  <SLabel>threshold</SLabel>
                  <FakeNum value={demo.thresholdN ?? ''} visible={reached('value')} />
                </div>
                <div>
                  <SLabel>min streak</SLabel>
                  <FakeNum value={demo.streakN ?? ''} visible={reached('value')} />
                </div>
              </div>
            )}
          </div>

          {/* command preview */}
          <div
            className="px-3 py-2.5 rounded text-[12px] break-all min-h-[38px] flex items-center"
            style={{
              backgroundColor: 'oklch(0.08 0 0)',
              border: `1px solid ${C.border}`,
            }}
          >
            <span style={{ color: C.textDim }}>▸ </span>
            <span style={{ color: C.accent }}>{finalCmd}</span>
          </div>

          {/* step dots */}
          <div className="flex items-center justify-center gap-1.5 pt-1">
            {DEMOS.map((_, i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full transition-opacity"
                style={{
                  backgroundColor: C.accent,
                  opacity: i === stepIdx ? 1 : 0.3,
                }}
              />
            ))}
          </div>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-[12px] px-4 py-2 rounded border transition-colors"
              style={{
                backgroundColor: C.surface2,
                borderColor: C.border,
                color: C.textBright,
              }}
            >
              close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
