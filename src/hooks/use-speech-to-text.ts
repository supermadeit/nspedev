import { useCallback, useEffect, useRef, useState } from 'react'

// Thin wrapper around the browser-native Web Speech API (SpeechRecognition).
// Client-side only — no backend involvement, no API cost. Coverage isn't
// universal (Chrome/Edge/Safari yes, Firefox no at all), so `supported`
// exists specifically so callers can hide the mic button entirely on
// unsupported browsers rather than render a dead one (owner ask, 2026-10-17).
//
// Deliberately non-continuous (recognition.continuous = false): this stops
// listening on its own after a pause in speech, which matches "dictate one
// thought into a text field" rather than an always-on mic — the caller's
// input stays the source of truth and the user can always keep editing by
// hand afterward, same as if they'd typed it.

// The Web Speech API has no official TypeScript lib entry — declaring just
// the surface this hook touches rather than pulling in a whole ambient-types
// package for one feature.
interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null
}

// "no-speech" (silence timeout) and "aborted" (caller-initiated stop, e.g.
// unmount) aren't real failures — surfacing them as an error reads as the
// mic being broken when it's really just "nothing was said" or "you stopped
// it yourself."
const SILENT_ERRORS = new Set(['no-speech', 'aborted'])

export function useSpeechToText(onTranscript: (text: string, isFinal: boolean) => void) {
  const [supported] = useState(() => getSpeechRecognitionCtor() !== null)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return
    setError(null)
    const recognition = new Ctor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (e) => {
      let text = ''
      let isFinal = false
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i]
        text += result[0].transcript
        if (result.isFinal) isFinal = true
      }
      onTranscriptRef.current(text, isFinal)
    }
    recognition.onerror = (e) => {
      if (!SILENT_ERRORS.has(e.error)) setError(e.error)
      setListening(false)
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  // Stop on unmount (e.g. navigating away mid-dictation) rather than leaving
  // the mic hot in the background.
  useEffect(() => () => recognitionRef.current?.stop(), [])

  return { supported, listening, error, start, stop, toggle }
}
