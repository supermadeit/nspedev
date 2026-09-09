import { useCallback, useRef, useState } from 'react'

// One `copied` flag per hook instance — call this once per row in a list
// (not once for the whole list) so each row tracks its own "just copied"
// state independently rather than one flag lighting up every row at once.
export function useCopyToClipboard(resetDelayMs = 1500) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<number | null>(null)

  const copy = useCallback(
    (text: string) => {
      navigator.clipboard
        ?.writeText(text)
        .then(() => {
          setCopied(true)
          if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
          timeoutRef.current = window.setTimeout(() => setCopied(false), resetDelayMs)
        })
        .catch(() => {
          // Clipboard access denied/unavailable — fail silently, same as a
          // no-op tap. Not worth a visible error for a convenience action.
        })
    },
    [resetDelayMs],
  )

  return { copied, copy }
}
