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

interface StarsBackgroundProps {
  density?: number
  // Data pages (power rankings, matchup strips) reported the stars reading
  // as visual noise directly behind card/header text with no backing panel
  // — not literally painted on top (z-index already puts them behind
  // everything), but bright/dense enough at the default 0.3-0.8 opacity
  // range to compete with foreground text. `dim` cuts both density and the
  // opacity ceiling for those pages while leaving the plain decorative uses
  // (homepage, etc.) untouched.
  dim?: boolean
}

export function StarsBackground({ density = 217, dim = false }: StarsBackgroundProps) {
  const [stars, setStars] = useState<Star[]>([])
  const effectiveDensity = dim ? Math.round(density / 3) : density

  useEffect(() => {
    const next: Star[] = []
    for (let i = 0; i < effectiveDensity; i++) {
      next.push({
        char: STARFIELD_CHARS[Math.floor(Math.random() * STARFIELD_CHARS.length)],
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: TERMINAL_COLORS[Math.floor(Math.random() * TERMINAL_COLORS.length)],
        opacity: dim ? 0.08 + Math.random() * 0.12 : 0.3 + Math.random() * 0.5,
      })
    }
    setStars(next)
  }, [effectiveDensity, dim])

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
