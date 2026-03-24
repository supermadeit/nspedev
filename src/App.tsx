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
  'What do you need to know?',
  'Search stats like the pros',
  'Make your hitlist',
  'nspe nba -ast10 -last7/10',
  'nspe nhl -pts min100 -season',
  'Need to sound like an analyst?',
  'nspe nba -pts30 -last3/5',
]

const COMMAND_EXAMPLES = [
  {
    command: 'nspe nba -pts30 -last3/5',
    description: 'Players with 30+ points in 3 of their last 5 games',
  },
  {
    command: 'nspe nhl -pts min100 -season',
    description: 'Skaters with 100+ points this season',
  },
  {
    command: 'nspe nba -ast10 -last7/10',
    description: 'Players with 10+ assists in 7 of their last 10 games',
  },
  {
    command: 'nspe mlb -dub -last3/5',
    description: 'Batters with a double in 3 of their last 5 games',
  },
  {
    command: 'nspe nba -pts min1500 -season',
    description: 'Players with 1500+ points this season',
  },
  {
    command: 'nspe nba -reb15 -last5',
    description: 'Players with 15+ rebounds in their last 5 games',
  },
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
  const [isMiniOpen, setIsMiniOpen] = useState(false)
  const [miniPosition, setMiniPosition] = useState({ x: 100, y: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const miniRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const generateStars = () => {
      const newStars: Star[] = []
      const density = 217
      
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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (miniRef.current && e.target === e.currentTarget) {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - miniPosition.x,
        y: e.clientY - miniPosition.y,
      })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setMiniPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.toLowerCase().trim() === 'help') {
      setIsMiniOpen(true)
    }
  }

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

      <button
        onClick={() => setIsMiniOpen(!isMiniOpen)}
        className="absolute top-6 right-6 z-20 font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity"
        style={{ color: 'oklch(0.85 0.15 195)' }}
      >
        nspe-mini
      </button>

      {isMiniOpen && (
        <div
          ref={miniRef}
          className="absolute z-30 w-[600px] max-h-[70vh] rounded-lg shadow-2xl overflow-hidden"
          style={{
            left: `${miniPosition.x}px`,
            top: `${miniPosition.y}px`,
            backgroundColor: 'oklch(0.15 0 0)',
            border: '1px solid oklch(0.30 0 0)',
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-3 cursor-move select-none"
            style={{ backgroundColor: 'oklch(0.18 0 0)', borderBottom: '1px solid oklch(0.30 0 0)' }}
            onMouseDown={handleMouseDown}
          >
            <span className="font-mono font-bold text-[14px]" style={{ color: 'oklch(0.85 0.15 195)' }}>
              NSPE — Command Legend
            </span>
            <button
              onClick={() => setIsMiniOpen(false)}
              className="font-mono text-[14px] hover:opacity-70 transition-opacity"
              style={{ color: 'oklch(0.85 0.15 195)' }}
            >
              ✕
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(70vh-50px)] px-5 py-4 space-y-5">
            {COMMAND_EXAMPLES.map((example, index) => (
              <div key={index} className="space-y-1">
                <div className="font-mono text-[13px] font-medium" style={{ color: 'oklch(0.85 0.15 195)' }}>
                  {example.command}
                </div>
                <div className="font-mono text-[12px] pl-4" style={{ color: 'oklch(0.70 0 0)' }}>
                  → {example.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center justify-start h-screen pt-[40vh]">
        <div className="w-[65%] max-w-4xl min-w-[320px] px-4">
          <div className="relative">
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleSearchSubmit}
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
