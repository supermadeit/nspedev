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
}

export function StarsBackground({ density = 217 }: StarsBackgroundProps) {
  const [stars, setStars] = useState<Star[]>([])

  useEffect(() => {
    const next: Star[] = []
    for (let i = 0; i < density; i++) {
      next.push({
        char: STARFIELD_CHARS[Math.floor(Math.random() * STARFIELD_CHARS.length)],
        x: Math.random() * 100,
        y: Math.random() * 100,
        color: TERMINAL_COLORS[Math.floor(Math.random() * TERMINAL_COLORS.length)],
        opacity: 0.3 + Math.random() * 0.5,
      })
    }
    setStars(next)
  }, [density])

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
