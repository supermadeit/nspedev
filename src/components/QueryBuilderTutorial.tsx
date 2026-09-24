// The query builder tutorial — rebuilt to actually operate the real, live
// <QueryBuilder> instead of a separate scripted replica of its UI (which is
// what this file used to be, and which is also what caused the z-index
// clash reported after {tutorial} moved into the builder's own header: two
// same-z-index "modals" competing, one a fake copy of the other).
//
// How it works: every real control the walkthroughs need (mode tabs, sport/
// stat pills, threshold/met/last/min/window chips, the run button) carries a
// stable `data-tour="..."` attribute (see Pill/NumSelect in QueryBuilder.tsx)
// and reflects its selected state via `aria-pressed`. This component finds
// those real DOM nodes with document.querySelector, draws a highlight box +
// caption bubble around whichever one is the current step, and on "Next"
// calls `.click()` on the real element — a genuine DOM click, so React's own
// handlers run and the builder's real state updates exactly as if a person
// had tapped it. The final step clicks the real run button, which fires the
// same onRunQuery the person's own queries use, so the result shown at the
// end is a real backend response, not a canned one.
//
// This overlay itself renders in a portal-less fixed layer above everything
// (z-[200]) — comfortably above the builder panel's z-50 — so it never has
// to fight the builder for stacking again; it doesn't need pointer-events on
// the highlighted area since it drives clicks itself rather than asking the
// person to click through it.
import { useEffect, useRef, useState } from 'react'

const C = {
  accent: 'oklch(0.85 0.15 195)',
  accentDark: 'oklch(0.10 0.02 195)',
  surface: 'oklch(0.12 0 0)',
  surface2: 'oklch(0.20 0 0)',
  border: 'oklch(0.30 0 0)',
  textDim: 'oklch(0.55 0 0)',
  textBright: 'oklch(0.92 0 0)',
  green: 'oklch(0.78 0.18 145)',
}

interface TourStep {
  /** The target's data-tour value. */
  target: string
  /** Caption shown while this step is active. */
  caption: string
  /** 'toggle' clicks the target only if it isn't already selected (aria-pressed);
   *  'always' (the run button) always clicks it. */
  kind: 'toggle' | 'always'
}

interface TourDemo {
  id: string
  label: string
  summary: string
  steps: TourStep[]
}

// Every command below was verified against the live backend before shipping
// (curl'd api.nspe.dev/run directly) to make sure it actually returns
// results — an earlier version of this list picked round, guessable numbers
// that happened to be unrealistic (e.g. 20+ hits over a last-10 window,
// which next to nobody clears), which made the payoff at the end of the
// walkthrough an empty result. Every demo here returns real rows today.
const DEMOS: TourDemo[] = [
  {
    id: 'explosive-nfl',
    label: 'Explosive — NFL long reception',
    summary: '30+ yard receptions, 1 of the last 2 games',
    steps: [
      { target: 'mode-explosive', kind: 'toggle', caption: '{explosive} tracks individual big plays, not per-game totals.' },
      { target: 'league-nfl', kind: 'toggle', caption: 'League — NFL.' },
      { target: 'explosivemode-trend', kind: 'toggle', caption: 'Trend, not compute — a single-play threshold over a window of games.' },
      { target: 'playtype-rec', kind: 'toggle', caption: 'Play type — reception.' },
      { target: 'explosiveYds-30', kind: 'toggle', caption: 'Set the yardage threshold — 30+ yards on a single play.' },
      { target: 'met-1', kind: 'toggle', caption: '"Met" — 1 of the games.' },
      { target: 'last-2', kind: 'toggle', caption: '"-last" — the window — the last 2 games.' },
      { target: 'run', kind: 'always', caption: 'Run it — this fires a real query against real data.' },
    ],
  },
  {
    id: 'trend-nba',
    label: 'Trend — NBA double-double',
    summary: 'a double-double in 4 of the last 5 games',
    steps: [
      { target: 'mode-trend', kind: 'toggle', caption: '{trend} looks for a stat clearing a threshold across a window of recent games.' },
      { target: 'sport-nba', kind: 'toggle', caption: 'Pick a sport — NBA.' },
      { target: 'stat-dub', kind: 'toggle', caption: 'Pick a stat — DUB (double-double). This one\'s a yes/no stat, so there\'s no threshold number to set.' },
      { target: 'met-4', kind: 'toggle', caption: '"Met" — how many of the games it needs to hit in — 4.' },
      { target: 'last-5', kind: 'toggle', caption: '"-last" — the window size — the last 5 games.' },
      { target: 'run', kind: 'always', caption: 'Run it — this fires a real query against real data.' },
    ],
  },
  {
    id: 'trend-mlb',
    label: 'Trend — MLB hits',
    summary: '2+ hits in 3 of the last 5 games',
    steps: [
      { target: 'mode-trend', kind: 'toggle', caption: 'Same {trend} mode, an MLB example this time.' },
      { target: 'sport-mlb', kind: 'toggle', caption: 'Pick a sport — MLB.' },
      { target: 'stat-hits', kind: 'toggle', caption: 'Pick a stat — hits.' },
      { target: 'threshold-2', kind: 'toggle', caption: 'Set the threshold — 2+ hits.' },
      { target: 'met-3', kind: 'toggle', caption: '"Met" — how many of the games it needs to hit in — 3.' },
      { target: 'last-5', kind: 'toggle', caption: '"-last" — the window size — the last 5 games.' },
      { target: 'run', kind: 'always', caption: 'Run it — this fires a real query against real data.' },
    ],
  },
  {
    id: 'compute-mlb',
    label: 'Compute — MLB combined total',
    summary: '300+ combined hits+runs+RBI for the season',
    steps: [
      { target: 'mode-compute', kind: 'toggle', caption: '{compute} totals a stat across a whole window instead of per-game.' },
      { target: 'sport-mlb', kind: 'toggle', caption: 'Pick a sport — MLB.' },
      { target: 'stat-total', kind: 'toggle', caption: 'Pick a stat — TOTAL, hits + runs + RBI combined.' },
      { target: 'window-season', kind: 'toggle', caption: 'Choose a window — the whole season.' },
      { target: 'min-300', kind: 'toggle', caption: 'Set the minimum — 300 combined.' },
      { target: 'run', kind: 'always', caption: 'Run it — this fires a real query against real data.' },
    ],
  },
  {
    id: 'streak',
    label: 'Streak — NHL shots on goal',
    summary: 'a streak of 3+ straight games with 2+ shots on goal',
    steps: [
      { target: 'mode-streak', kind: 'toggle', caption: '{streak} looks for consecutive games clearing a threshold, back to back.' },
      { target: 'sport-nhl', kind: 'toggle', caption: 'Pick a sport — NHL.' },
      { target: 'stat-sog', kind: 'toggle', caption: 'Pick a stat — shots on goal.' },
      { target: 'threshold-2', kind: 'toggle', caption: 'Set the threshold — 2+ shots.' },
      { target: 'streakN-3', kind: 'toggle', caption: 'Set the minimum streak length — 3 straight games.' },
      { target: 'run', kind: 'always', caption: 'Run it — this fires a real query against real data.' },
    ],
  },
]

interface QueryBuilderTutorialProps {
  open: boolean
  onClose: () => void
  /** Opens the real query builder panel (mobile or desktop, whichever applies). */
  openBuilder: () => void
  /** Closes it — called automatically once a demo's real result is in. */
  closeBuilder: () => void
  /** Wipes the builder's persisted state so a demo starts from a clean slate. */
  resetBuilder: () => void
}

const POLL_INTERVAL_MS = 60
const POLL_TIMEOUT_MS = 4000

function findTarget(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${name}"]`)
}

/** Brings a step's target into view before highlighting it — matters most
 * on mobile, where the builder is a tall scrollable full-screen form and a
 * later step's control (e.g. run) can start out below the fold. */
function revealTarget(el: HTMLElement) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** Polls for a data-tour target to exist in the DOM (it may not yet — e.g.
 * the stat row only renders after a sport is picked). Resolves null on
 * timeout rather than hanging forever if a step's target never appears. */
function waitForTarget(name: string): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const start = Date.now()
    const tick = () => {
      const el = findTarget(name)
      if (el) {
        resolve(el)
        return
      }
      if (Date.now() - start > POLL_TIMEOUT_MS) {
        resolve(null)
        return
      }
      window.setTimeout(tick, POLL_INTERVAL_MS)
    }
    tick()
  })
}

export function QueryBuilderTutorial({ open, onClose, openBuilder, closeBuilder, resetBuilder }: QueryBuilderTutorialProps) {
  const [demo, setDemo] = useState<TourDemo | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [phase, setPhase] = useState<'locating' | 'ready' | 'done'>('locating')
  const runIdRef = useRef(0)

  // Reset to the picker every time the tutorial is (re)opened.
  useEffect(() => {
    if (!open) return
    setDemo(null)
    setStepIndex(0)
    setRect(null)
    setPhase('locating')
  }, [open])

  // Keep the highlight box glued to its target across scroll/resize/drag
  // (the desktop builder panel is itself draggable).
  useEffect(() => {
    if (!demo || phase !== 'ready') return
    const step = demo.steps[stepIndex]
    const update = () => {
      const el = findTarget(step.target)
      if (el) setRect(el.getBoundingClientRect())
    }
    update()
    const id = window.setInterval(update, 200)
    window.addEventListener('resize', update)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', update)
    }
  }, [demo, stepIndex, phase])

  async function startDemo(chosen: TourDemo) {
    const myRun = ++runIdRef.current
    setDemo(chosen)
    setStepIndex(0)
    setPhase('locating')
    resetBuilder()
    openBuilder()
    const el = await waitForTarget(chosen.steps[0].target)
    if (myRun !== runIdRef.current) return
    if (!el) {
      setPhase('done')
      return
    }
    revealTarget(el)
    setRect(el.getBoundingClientRect())
    setPhase('ready')
  }

  async function advance() {
    if (!demo) return
    const myRun = runIdRef.current
    const step = demo.steps[stepIndex]
    const el = findTarget(step.target)
    if (el) {
      const alreadySelected = el.getAttribute('aria-pressed') === 'true'
      if (step.kind === 'always' || !alreadySelected) {
        el.click()
      }
    }

    const isLast = stepIndex === demo.steps.length - 1
    if (isLast) {
      // Real run button was just clicked — give the real request a moment,
      // then close the real builder so the real result underneath is what
      // the person actually sees, same as if they'd built and run it
      // themselves.
      setPhase('done')
      window.setTimeout(() => {
        if (myRun !== runIdRef.current) return
        closeBuilder()
      }, 900)
      return
    }

    setPhase('locating')
    const nextStep = demo.steps[stepIndex + 1]
    const nextEl = await waitForTarget(nextStep.target)
    if (myRun !== runIdRef.current) return
    if (!nextEl) {
      setPhase('done')
      return
    }
    revealTarget(nextEl)
    setRect(nextEl.getBoundingClientRect())
    setStepIndex((i) => i + 1)
    setPhase('ready')
  }

  function goBack() {
    if (!demo || stepIndex === 0) return
    const prevIndex = stepIndex - 1
    const el = findTarget(demo.steps[prevIndex].target)
    if (el) {
      revealTarget(el)
      setRect(el.getBoundingClientRect())
    }
    setStepIndex(prevIndex)
    setPhase('ready')
  }

  function finish() {
    runIdRef.current += 1
    onClose()
  }

  if (!open) return null

  // Picker — no demo chosen yet.
  if (!demo) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: 'oklch(0 0 0 / 0.6)' }}>
        <div
          className="w-full max-w-md rounded-lg p-5"
          style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-[15px]" style={{ color: C.textBright }}>
              {'{query builder tutorial}'}
            </span>
            <button onClick={finish} className="text-[15px] hover:opacity-70 transition-opacity" style={{ color: C.textDim }}>
              ✕
            </button>
          </div>
          <p className="text-[12px] mb-4" style={{ color: C.textDim }}>
            Pick an example — it'll open the real builder and walk the real controls for you, then run a real query.
          </p>
          <div className="flex flex-col gap-2">
            {DEMOS.map((d) => (
              <button
                key={d.id}
                onClick={() => startDemo(d)}
                className="text-left rounded-lg px-3 py-2.5 transition-colors"
                style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}
              >
                <div className="font-bold text-[13px]" style={{ color: C.accent }}>
                  {d.label}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: C.textDim }}>
                  {d.summary}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const step = demo.steps[stepIndex]
  const isLast = stepIndex === demo.steps.length - 1

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {rect && phase === 'ready' && (
        <div
          className="absolute rounded-md transition-all duration-200"
          style={{
            left: `${rect.left - 6}px`,
            top: `${rect.top - 6}px`,
            width: `${rect.width + 12}px`,
            height: `${rect.height + 12}px`,
            border: `2px solid ${C.green}`,
            boxShadow: '0 0 0 4000px oklch(0 0 0 / 0.45)',
          }}
        />
      )}

      {/* Bottom control bar — the one part of this overlay that accepts
          clicks, everything else is pointer-events-none so it never blocks
          the real builder underneath. */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-6 w-[min(92vw,480px)] rounded-lg p-4 pointer-events-auto"
        style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-widest" style={{ color: C.textDim }}>
            {demo.label} · step {Math.min(stepIndex + 1, demo.steps.length)}/{demo.steps.length}
          </span>
          <button onClick={finish} className="text-[13px] hover:opacity-70 transition-opacity" style={{ color: C.textDim }}>
            skip tutorial
          </button>
        </div>

        <p className="text-[13px] mb-3" style={{ color: C.textBright }}>
          {phase === 'done' ? "That's a real result from a real query — nice work." : phase === 'locating' ? 'Locating the next control…' : step.caption}
        </p>

        <div className="flex items-center gap-2">
          {phase === 'ready' && stepIndex > 0 && (
            <button
              onClick={goBack}
              className="font-mono text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors"
              style={{ border: `1px solid ${C.border}`, color: C.textDim }}
            >
              ‹ back
            </button>
          )}
          {phase === 'ready' && (
            <button
              onClick={advance}
              className="flex-1 font-mono text-[12px] font-bold px-3 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: C.accent, color: C.accentDark }}
            >
              {isLast ? 'run it →' : 'next →'}
            </button>
          )}
          {phase === 'done' && (
            <button
              onClick={finish}
              className="flex-1 font-mono text-[12px] font-bold px-3 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: C.accent, color: C.accentDark }}
            >
              done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
