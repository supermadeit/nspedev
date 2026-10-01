// {site.tour} — a passive, homepage-only walkthrough. Unlike
// QueryBuilderTutorial (which drives the real query builder by clicking real
// controls through a multi-step form), this tour doesn't operate anything —
// the four things it explains are independent buttons, not steps in one
// flow, so there's nothing to click on the visitor's behalf. It just finds
// each target by its `data-tour` attribute, draws the same highlight-box +
// caption-bubble chrome, and lets "next"/"back" move between them.
//
// Reuses the mobile-vs-desktop trick already established elsewhere: the same
// `data-tour` name is applied to both the mobile and desktop variant of a
// button in App.tsx, but only one is ever mounted at a time, so
// document.querySelector always finds the right one without this component
// needing to know which layout is active.
import { useEffect, useState } from 'react'

const C = {
  accent: 'oklch(0.85 0.15 195)',
  accentDark: 'oklch(0.10 0.02 195)',
  surface: 'oklch(0.12 0 0)',
  border: 'oklch(0.30 0 0)',
  // Bumped to match textBright — grey text site-wide was hard to read
  // (2026-10-01), owner wants white.
  textDim: 'oklch(0.92 0 0)',
  textBright: 'oklch(0.92 0 0)',
  green: 'oklch(0.78 0.18 145)',
}

interface TourStep {
  target: string
  caption: string
}

// {psc} and {sample-queries} no longer have their own homepage entry point
// on every surface (psc lives in Account Settings now), so those two steps
// point at the nearest real thing that demonstrates them instead of a
// settings link: the search bar itself (where predictive syntax actually
// appears as you type) and the {sample-queries} button (which is the literal
// feature). The rest of the site — charts, player database, leaderboard —
// isn't covered here; per the call that shaped this list, those are
// considered self-explanatory on their own.
const STEPS: TourStep[] = [
  {
    target: 'tour-search',
    caption:
      'Type here and this bar suggests real, runnable commands as you go — that\'s predictive syntax ({psc}). Prefer a blank slate? Turn it off in Account Settings.',
  },
  {
    target: 'tour-sample-queries',
    caption:
      '{sample-queries} is a list of ready-made commands — copy and paste any of them. One more thing worth knowing: this search bar also understands plain-English questions, not just commands — ask something like "how many times has Mahomes thrown for 300 yards" and it reads the question, runs it, and answers, no syntax required.',
  },
  {
    target: 'tour-build',
    caption:
      'Don\'t want to type a command at all? {build} assembles one from buttons instead — pick a mode, a sport, a stat, a number. It has its own walkthrough once you open it.',
  },
  {
    target: 'tour-pocket',
    caption:
      '{pocket} saves the result you\'re looking at so you can come back to it later. It needs an account — logged out, it sends you to log in instead.',
  },
]

function findTarget(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${name}"]`)
}

export interface SiteTourProps {
  open: boolean
  onClose: () => void
}

export function SiteTour({ open, onClose }: SiteTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!open) return
    setStepIndex(0)
  }, [open])

  // Keep the highlight glued to its target across resize — nothing on the
  // homepage scrolls under normal use, but a window resize (or a rotate on
  // mobile) shouldn't leave the box stranded over empty space.
  useEffect(() => {
    if (!open) return
    const step = STEPS[stepIndex]
    const update = () => {
      const el = findTarget(step.target)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setRect(el.getBoundingClientRect())
        setMissing(false)
      } else {
        setRect(null)
        setMissing(true)
      }
    }
    update()
    const id = window.setInterval(update, 200)
    window.addEventListener('resize', update)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('resize', update)
    }
  }, [open, stepIndex])

  if (!open) return null

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {rect && (
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

      <div
        className="absolute left-1/2 -translate-x-1/2 bottom-6 w-[min(92vw,480px)] rounded-lg p-4 pointer-events-auto"
        style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-widest" style={{ color: C.textDim }}>
            {'{site.tour}'} · step {stepIndex + 1}/{STEPS.length}
          </span>
          <button onClick={onClose} className="text-[13px] hover:opacity-70 transition-opacity" style={{ color: C.textDim }}>
            skip tour
          </button>
        </div>

        <p className="text-[13px] mb-3 leading-relaxed" style={{ color: C.textBright }}>
          {missing ? 'This one isn\'t on screen right now — skip ahead or resize your browser back to see it.' : step.caption}
        </p>

        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              onClick={() => setStepIndex((i) => i - 1)}
              className="font-mono text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors"
              style={{ border: `1px solid ${C.border}`, color: C.textDim }}
            >
              ‹ back
            </button>
          )}
          <button
            onClick={() => (isLast ? onClose() : setStepIndex((i) => i + 1))}
            className="flex-1 font-mono text-[12px] font-bold px-3 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: C.accent, color: C.accentDark }}
          >
            {isLast ? 'done' : 'next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
