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
import { useEffect, useRef, useState } from 'react'
import { fetchLearnTopic, type LearnTopic } from '@/lib/learnNspe'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

const C = {
  accent: 'oklch(0.85 0.15 195)',
  green: 'oklch(0.85 0.15 145)',
  surface: 'oklch(0.12 0 0)',
  surface2: 'oklch(0.17 0 0)',
  border: 'oklch(0.25 0 0)',
  // Bumped to match textBright — grey text site-wide was hard to read
  // (2026-10-01), owner wants white.
  textDim: 'oklch(0.88 0 0)',
  textBright: 'oklch(0.88 0 0)',
}

const TABS = [
  { label: 'what is nspe', question: 'what is nspe' },
  { label: 'syntax', question: 'how does the syntax work' },
] as const

// Reads a topic's answer aloud via the browser's built-in SpeechSynthesis —
// no backend involvement, no generated audio file to keep in sync. That
// matters here specifically because learn.py's copy "gets rewritten there
// often" (see the file banner above): a pre-generated voiceover would need
// re-recording on every text edit, while this always reads whatever text is
// currently on screen. Quality is OS/browser-dependent (solid on Mac/iOS
// Safari and Chrome, more robotic elsewhere), which is the trade for zero
// cost and zero staleness — swap this for a cached TTS-API clip later if the
// robotic voice becomes the complaint instead of "there's no voice at all."
// SHELVED (2026-09-29): the {listen} button below read this via browser
// SpeechSynthesis, but the default system voices read as "nervous" even
// after tuning rate/pitch/voice — pulled from the render below pending a
// decision on a real voice (possibly a cloned one, still undecided — see
// conversation). Left in place rather than deleted since the plumbing
// (voice-picking, rate/pitch tuning, cleanup-on-unmount) is still valid,
// whatever the eventual voice source turns out to be.
function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// Best-effort male voice pick — the Web Speech API exposes no gender field,
// just a name/lang per installed voice, so this matches against the known
// male system voices per platform (macOS/iOS Safari's "Daniel"/"Alex",
// Windows' "David"/"Mark"/"Guy", Chrome's "Google UK English Male", etc.),
// in rough quality order. Falls through to "first English voice whose name
// isn't a known female one" so something reasonable still gets picked on a
// platform/browser we didn't list by name, and finally to `undefined` (the
// browser's own default voice) if that still finds nothing.
const PREFERRED_MALE_VOICES = [
  'Google UK English Male',
  'Microsoft David - English (United States)',
  'Microsoft Guy - English (United States)',
  'Microsoft Mark - English (United States)',
  'Microsoft David',
  'Daniel',
  'Alex',
  'Aaron',
  'Arthur',
  'Oliver',
  'Gordon',
  'Rishi',
  'Eddy (English (US))',
  'Eddy',
]
const KNOWN_FEMALE_VOICE_NAMES = [
  'samantha', 'victoria', 'karen', 'moira', 'tessa', 'zira', 'susan', 'fiona',
  'kate', 'serena', 'ava', 'allison', 'nicky', 'sandy', 'shelley', 'catherine',
  'hazel', 'amy', 'emma', 'joanna', 'kendra', 'salli', 'kimberly', 'zoe',
]

function pickMaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  for (const name of PREFERRED_MALE_VOICES) {
    const match = voices.find((v) => v.name === name)
    if (match) return match
  }
  return voices.find(
    (v) => v.lang.toLowerCase().startsWith('en') && !KNOWN_FEMALE_VOICE_NAMES.some((f) => v.name.toLowerCase().includes(f)),
  )
}

function SpeakButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false)
  // Voice list loads async in most browsers (empty until 'voiceschanged'
  // fires) — read once on mount and again on that event rather than at
  // speak-time, so the first click doesn't race an empty list.
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    if (!speechSupported()) return
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices()
    }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
  }, [])

  useEffect(() => {
    // Cancels on tab switch (text changes under an already-speaking button)
    // and on modal close (this component unmounts) — never leave narration
    // running over an answer that's no longer on screen.
    return () => {
      window.speechSynthesis?.cancel()
      setSpeaking(false)
    }
  }, [text])

  if (!speechSupported()) return null

  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(text)
    const voice = pickMaleVoice(voicesRef.current)
    if (voice) utter.voice = voice
    // Slower and a step lower in pitch than the default — the plain default
    // voice/rate/pitch read as thin and rushed ("nervous"), this reads
    // calmer and deeper.
    utter.rate = 0.88
    utter.pitch = 0.8
    utter.onend = () => setSpeaking(false)
    utter.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utter)
    setSpeaking(true)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="font-mono text-[11px] px-2 py-1 rounded hover:opacity-90 transition-opacity flex-none whitespace-nowrap"
      style={{ color: speaking ? C.green : C.textDim, border: `1px solid ${speaking ? C.green : C.border}` }}
      aria-label={speaking ? 'Stop reading aloud' : 'Read answer aloud'}
    >
      {speaking ? '{stop}' : '{listen}'}
    </button>
  )
}

export interface LearnNspeModalProps {
  open: boolean
  onClose: () => void
  /** Closes this modal and opens {site.tour} — the "start" answer's own copy
   * ends with "Take the {site.tour} for a hands on demo," so this is that
   * button. */
  onStartTour: () => void
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

export function LearnNspeModal({ open, onClose, onStartTour }: LearnNspeModalProps) {
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

        <div
          className="flex items-center justify-between px-5 py-3 flex-none"
          style={{ backgroundColor: 'oklch(0.16 0 0)', borderTop: `1px solid ${C.border}` }}
        >
          <span className="font-mono text-[11px]" style={{ color: C.textDim }}>
            prefer a hands-on walkthrough?
          </span>
          <button
            type="button"
            onClick={() => {
              onClose()
              onStartTour()
            }}
            className="font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: C.green }}
          >
            {'{site.tour}'}
          </button>
        </div>
      </div>
    </div>
  )
}
