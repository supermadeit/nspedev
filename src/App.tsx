import { useState, useEffect, useRef } from 'react'

const STARFIELD_CHARS = ['@', '%', '#', '$', '*', '+', '~', '?', 'x', '⋇', '𝛯', '☼', '➲', '⇪', '➚', '₽']

const TERMINAL_COLORS = [
  'oklch(0.95 0 0)',
  'oklch(0.85 0.15 195)',
  'oklch(0.75 0.15 145)',
  'oklch(0.80 0.15 95)',
  'oklch(0.70 0.15 50)',
  'oklch(0.65 0.15 250)',
]

const PLACEHOLDER_TEXTS = [
  'What you need to know',
  'Search stats like the pros',
  'Make your hitlist',
  'Find the signal',
  'Query the game',
  "What's the angle",
  'Ask the engine',
  "Who's trending",
  "What's the window",
  'Build your case',
  'Run the numbers',
  'Start with a stat',
]

interface Star {
  char: string
  x: number
  y: number
  color: string
  opacity: number
}

function App() {
  const [stars, setStars] = useState<Star[]>([])
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [placeholderOpacity, setPlaceholderOpacity] = useState(1)
  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    const generateStars = () => {
      const newStars: Star[] = []
      const density = 350
      
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
    }

    generateStars()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderOpacity(0)
      
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_TEXTS.length)
        setPlaceholderOpacity(1)
      }, 300)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-screen h-screen bg-background overflow-hidden">
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

      <div className="relative z-10 flex flex-col items-center justify-start h-screen pt-[40vh]">
        <div className="w-[65%] max-w-4xl min-w-[320px] px-4">
          <div className="relative">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full h-[52px] px-5 py-3 bg-card text-foreground font-mono text-[16px] rounded-lg border border-border outline-none focus:border-primary transition-colors duration-200"
              style={{
                opacity: 1,
              }}
            />
            {!searchValue && (
              <div
                className="absolute inset-0 flex items-center px-5 pointer-events-none font-mono text-[16px] text-muted-foreground transition-opacity duration-300"
                style={{
                  opacity: placeholderOpacity * 0.5,
                }}
              >
                {PLACEHOLDER_TEXTS[placeholderIndex]}
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <p className="font-mono text-[14px]" style={{ color: 'oklch(0.90 0.18 195)' }}>
              Type "help" for available commands
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
