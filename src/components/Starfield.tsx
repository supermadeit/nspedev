// Reusable version of the homepage's starry background (2026-10-16, built for
// {why.nspe}). App.tsx's own homepage keeps its original inline
// implementation untouched rather than being refactored to use this too —
// not worth the risk of touching that file's core render path for a DRY
// nicety. This is a deliberate, small duplication of the same density/char/
// color pools and generate-once-on-mount behavior, not a drifted copy — keep
// the two in sync if either one's visual tuning changes.
import { useEffect, useState } from 'react'

interface Star {
  char: string
  x: number
  y: number
  color: string
  opacity: number
}

const STARFIELD_CHARS = ['$', '*', '+', '⋇', '𝛯', '☼', '➲', '✦', '⚛︎', '⚇']
const TERMINAL_COLORS = [
  'oklch(0.95 0 0)',
  'oklch(0.85 0.15 195)',
  'oklch(0.75 0.15 145)',
  'oklch(0.65 0.15 250)',
]

// Fills its nearest positioned ancestor — mount it inside a `relative`
// wrapper with `overflow-hidden` the same way App.tsx's homepage does.
export function Starfield() {
  const [stars, setStars] = useState<Star[]>([])

  useEffect(() => {
    const density = 217
    const newStars: Star[] = []
    for (let i = 0; i < density; i++) {
      newStars.push({
        char: STARFIELD_CHARS[Math.floor(Math.random() * STARFIELD_CHARS.length)],
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: TERMINAL_COLORS[Math.floor(Math.random() * TERMINAL_COLORS.length)],
        opacity: 0.3 + Math.random() * 0.5,
      })
    }
    setStars(newStars)
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.map((star, index) => (
        <span
          key={index}
          className="absolute text-[12px] font-mono select-none"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            color: star.color,
            opacity: star.opacity,
          }}
        >
          {star.char}
        </span>
      ))}
    </div>
  )
}
