// Shared starfield background — extracted from App.tsx's homepage so other
// pages (currently just PlayerProfilePage) can reuse the exact same look
// without duplicating the generation logic. Renders once per mount (stars
// don't need to re-roll on re-render), absolutely positioned and
// pointer-events-none so it never blocks the page's real content.
import { useEffect, useState } from 'react'

const STARFIELD_CHARS = ['$', '*', '+', '⋇', '𝛯', '☼', '➲', '✦', '⚛︎', '⚇']

const TERMINAL_COLORS = [
  'oklch(0.95 0 0)',
  'oklch(0.85 0.15 195)',
  'oklch(0.75 0.15 145)',
  'oklch(0.65 0.15 250)',
]

interface Star {
  char: string
  x: number
  y: number
  color: string
  opacity: number
}

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
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
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
