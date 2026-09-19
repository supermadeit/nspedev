import { useEffect, useState } from "react"

const MOBILE_BREAKPOINT = 768

// Lazy initializer computes the real value on the very first render instead
// of starting at undefined/false — components that key off this on mount
// (QueryBuilder's mobile-vs-desktop localStorage key, in particular) used to
// always see "desktop" for one render before the useEffect below fired and
// flipped it, which is too late for a useState initializer that only ever
// runs once. That race silently loaded the wrong (usually empty) persisted
// state on mobile every time, even though saving was never actually broken.
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT,
  )

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
