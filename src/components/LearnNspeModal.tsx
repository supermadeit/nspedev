// {learn.nspe} modal — replaces the old static "search a player or type:
// nspe" hint line with a real answer, sourced live from POST /learn (see
// learnNspe.ts). That endpoint is free for everyone (no guest/credit quota)
// and returns a deterministic, hand-written answer — so this fetches rather
// than hardcodes the copy, keeping backend's learn.py the single source of
// truth (it gets rewritten there often; hardcoding it here would drift).
//
// Two tabs map to the two questions that return genuinely different content
// ("what is nspe" / topic "start", "how does the syntax work" / topic
// "syntax") — other phrasings we tried ("how to use nspe") returned the same
// "start" answer, so there's no third tab yet.
//
// Examples are click-to-copy, same interaction as {sample-queries}'s rows
// (SampleQueriesModal) — not click-to-run, so this stays consistent with how
// every other command list on the site already behaves.
import { useEffect, useState } from 'react'
import { fetchLearnTopic, type LearnTopic } from '@/lib/learnNspe'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

const C = {
  accent: 'oklch(0.85 0.15 195)',
  green: 'oklch(0.85 0.15 145)',
  surface: 'oklch(0.12 0 0)',
  surface2: 'oklch(0.17 0 0)',
  border: 'oklch(0.25 0 0)',
  textDim: 'oklch(0.48 0 0)',
  textBright: 'oklch(0.88 0 0)',
}

const TABS = [
  { label: 'what is nspe', question: 'what is nspe' },
  { label: 'syntax', question: 'how does the syntax work' },
] as const

export interface LearnNspeModalProps {
  open: boolean
  onClose: () => void
}

function ExampleRow({ example }: { example: LearnTopic['examples'][number] }) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <button
      type="button"
      onClick={() => copy(example.command)}
      className="w-full text-left rounded px-3 py-2 hover:opacity-90 transition-opacity"
      style={{ backgroundColor: C.surface2, border: `1px solid ${copied ? C.green : C.border}` }}
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: C.textDim }}>
          {example.label}
        </span>
        <span className="font-mono text-[11px] flex-none" style={{ color: copied ? C.green : C.textDim }}>
          {copied ? '{copied}' : '{copy}'}
        </span>
      </div>
      <div className="font-mono text-[13px] whitespace-nowrap" style={{ color: C.accent }}>
        {example.command}
      </div>
    </button>
  )
}

export function LearnNspeModal({ open, onClose }: LearnNspeModalProps) {
  const [activeTab, setActiveTab] = useState<number>(0)
  const [topic, setTopic] = useState<LearnTopic | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setTopic(null)
    setLoadError(null)

    fetchLearnTopic(TABS[activeTab].question)
      .then((result) => {
        if (active) setTopic(result)
      })
      .catch(() => {
        if (active) setLoadError('Could not load this right now — try again in a moment.')
      })

    return () => {
      active = false
    }
  }, [open, activeTab])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.80)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[720px] max-h-[80vh] rounded-lg overflow-hidden shadow-2xl flex flex-col"
        style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3 flex-none"
          style={{ backgroundColor: 'oklch(0.16 0 0)', borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-center gap-4">
            <span className="font-mono font-bold text-[13px]" style={{ color: C.accent }}>
              {'{learn.nspe}'}
            </span>
            <div className="flex items-center gap-2">
              {TABS.map((tab, i) => (
                <button
                  key={tab.question}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className="font-mono text-[11px] px-2 py-1 rounded hover:opacity-90 transition-opacity"
                  style={{
                    color: activeTab === i ? C.surface : C.textBright,
                    backgroundColor: activeTab === i ? C.accent : 'transparent',
                    border: `1px solid ${activeTab === i ? C.accent : C.border}`,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[14px] hover:opacity-70 transition-opacity"
            style={{ color: C.accent }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {loadError && (
            <p className="font-mono text-[13px]" style={{ color: 'oklch(0.75 0.18 30)' }}>
              {loadError}
            </p>
          )}
          {!loadError && !topic && (
            <p className="font-mono text-[13px]" style={{ color: C.textDim }}>
              loading…
            </p>
          )}
          {topic && (
            <>
              <p
                className="font-mono text-[13px] leading-relaxed whitespace-pre-line"
                style={{ color: C.textBright }}
              >
                {topic.answer}
              </p>
              {topic.examples.length > 0 && (
                <div className="space-y-2">
                  <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: C.textDim }}>
                    try it
                  </span>
                  {topic.examples.map((example) => (
                    <ExampleRow key={example.command} example={example} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
