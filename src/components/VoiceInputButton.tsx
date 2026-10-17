import { useEffect, useRef } from 'react'
import { Mic } from 'lucide-react'
import { useSpeechToText } from '@/hooks/use-speech-to-text'

// Mic button for voice-to-text (owner ask, 2026-10-17 — "a no brainer").
// Pure client-side (Web Speech API), no backend involvement. Renders nothing
// at all on browsers without SpeechRecognition support (Firefox, mainly) —
// a dead mic icon that does nothing on click is worse than no icon.
//
// Appends to whatever's already in the field rather than replacing it, so
// dictating partway through typing (or dictating twice) behaves the way
// someone would expect: it adds on, it doesn't wipe out what's there. The
// base text is captured once per listening session (on click, not on every
// result event) so interim results replace only the just-spoken portion
// instead of re-appending on every partial update.
export function VoiceInputButton({
  getBaseText,
  onTranscript,
  targetRef,
  onListeningChange,
  className = '',
}: {
  // Called once when listening starts, to snapshot the text already in the
  // field at that moment.
  getBaseText: () => string
  // Called with the full new field value (base + dictated text) as speech
  // is recognized, live on interim results and once more on the final one.
  onTranscript: (fullText: string) => void
  // The actual <input>/<textarea> being dictated into (owner ask, 2026-10-18
  // — follow-while-speaking for fields that don't grow, e.g. the homepage
  // single-line CLI bar). Setting a controlled input's value via React state
  // doesn't reliably move the caret or scroll position the way a real
  // keystroke does — left alone, a long dictated command can keep the view
  // scrolled to its start while new words land off-screen to the right.
  // When passed, this pushes the caret (and scroll position, for a
  // single-line field) to the end after each recognized chunk, so the
  // just-spoken words stay in view instead of needing a manual scroll to
  // find them. Optional — the follow-up chat textarea doesn't need it since
  // it grows instead of scrolling.
  targetRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  // Reports listening on/off so a parent that wants to (e.g. highlighting
  // the field itself while dictation is live, not just the mic icon) can.
  onListeningChange?: (listening: boolean) => void
  className?: string
}) {
  // A ref, not a plain variable — this needs to survive across the
  // re-renders that `listening` toggling causes, and be readable from
  // inside the onresult closure below, which a local variable re-created
  // fresh every render can't do (it'd always read back as '').
  const baseTextRef = useRef('')
  const { supported, listening, error, toggle } = useSpeechToText((spoken) => {
    const base = baseTextRef.current
    onTranscript(base ? `${base} ${spoken}` : spoken)
    if (targetRef) {
      // The state update above hasn't painted yet — wait a frame so the
      // field's DOM value (and scrollWidth) actually reflects the new text
      // before chasing the caret/scroll to its end.
      requestAnimationFrame(() => {
        const el = targetRef.current
        if (!el) return
        el.scrollLeft = el.scrollWidth
        try {
          el.setSelectionRange(el.value.length, el.value.length)
        } catch {
          // Thrown on input types that don't support text selection — none
          // of this component's actual callers, but harmless either way.
        }
      })
    }
  })

  useEffect(() => {
    onListeningChange?.(listening)
  }, [listening, onListeningChange])

  if (!supported) return null

  const handleClick = () => {
    if (!listening) baseTextRef.current = getBaseText()
    toggle()
  }

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={handleClick}
        title={listening ? 'Stop dictation' : 'Dictate with your voice'}
        aria-label={listening ? 'Stop dictation' : 'Dictate with your voice'}
        className={`flex items-center justify-center rounded-full transition-opacity hover:opacity-80 ${className}`}
        style={{
          color: listening ? 'oklch(0.70 0.18 25)' : 'oklch(0.70 0.10 195)',
        }}
      >
        <Mic size={16} className={listening ? 'animate-pulse' : undefined} />
      </button>
      {error && (
        <div
          className="absolute top-full right-0 mt-1 whitespace-nowrap rounded px-2 py-1 font-mono text-[10px] z-10"
          style={{ backgroundColor: 'oklch(0.18 0 0)', border: '1px solid oklch(0.30 0 0)', color: 'oklch(0.70 0.18 25)' }}
        >
          {error === 'not-allowed' ? 'mic permission denied' : `mic error: ${error}`}
        </div>
      )}
    </div>
  )
}
