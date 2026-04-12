import { useState, useEffect, useRef } from 'react'
import hitlistData from '@/assets/data/hitlist.json'

const API_BASE = 'https://api.nspe.dev'

const STARFIELD_CHARS = ['$', '*', '+', '⋇', '𝛯', '☼', '➲','✦','⚛︎','⚇']

const TERMINAL_COLORS = [
  'oklch(0.95 0 0)',
  'oklch(0.85 0.15 195)',
  'oklch(0.75 0.15 145)',
  'oklch(0.65 0.15 250)',
]

const PLACEHOLDER_TEXTS = [
  'What do you need to know?',
  'Search stats like the pros',
  '{SPORTS}{WORLD} IS YOURS',
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
    command: 'nspe nba -reb min100 -last10',
    description: 'Players with 100+ rebounds in their last 10 games',
  },
]

interface QueryResult {
  date: string
  line: string
  hits: number
  notes: string
}

interface Star {
  char: string
  x: number
  y: number
  color: string
  opacity: number
}

interface HitlistEntry {
  player: string
  stat: string
  values: number[]
  threshold: number
  hit_dates: string[]
}

const STAT_LABELS: Record<string, string> = {
  tpm: '3pt',
  reb: 'reb',
  stl: 'stl',
  ast: 'ast',
}

function formatTickerEntry(entry: HitlistEntry): string {
  const statLabel = STAT_LABELS[entry.stat] || entry.stat
  const threshold = `${entry.threshold}+`
  const values = entry.values.join(' | ')
  const dates = entry.hit_dates.join(' • ')
  
  return `${entry.player} ${threshold} ${statLabel} | ${values} | ${dates}`
}

function App() {
  const [stars, setStars] = useState<Star[]>([])
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [placeholderOpacity, setPlaceholderOpacity] = useState(1)
  const [searchValue, setSearchValue] = useState('')
  const [isMiniOpen, setIsMiniOpen] = useState(false)
  const [miniPosition, setMiniPosition] = useState({ x: window.innerWidth / 2 - 300, y: window.innerHeight * 0.40 + 70 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [queryResults, setQueryResults] = useState<QueryResult[] | null>(null)
  const [lastQuery, setLastQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [leftMascotVisible, setLeftMascotVisible] = useState(true)
  const miniRef = useRef<HTMLDivElement>(null)
  const tickerRef = useRef<HTMLDivElement>(null)

  const tickerText = (hitlistData as HitlistEntry[])
    .map(formatTickerEntry)
    .join('    ★    ')

  const runQuery = async (query: string) => {
    setIsLoading(true)
    setLastQuery(query)
    try {
      const response = await fetch(`${API_BASE}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })
      
      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('Query response:', data)
      setQueryResults(data.results || [])
    } catch (error) {
      console.error('Query error:', error)
      setQueryResults([])
    } finally {
      setIsLoading(false)
    }
  }

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsMiniOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setLeftMascotVisible((prev) => !prev)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      const trimmedQuery = searchValue.trim().toLowerCase()
      
      if (trimmedQuery === 'help') {
        setQueryResults(null)
        setLastQuery('')
        setIsMiniOpen(true)
      } else {
        runQuery(searchValue.trim())
        setIsMiniOpen(true)
      }
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
          className="absolute z-30 w-[600px] max-h-[40vh] rounded-lg shadow-2xl overflow-hidden"
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
              {queryResults ? `${lastQuery} — hitlist` : 'NSPE — Command Legend'}
            </span>
            <button
              onClick={() => setIsMiniOpen(false)}
              className="font-mono text-[14px] hover:opacity-70 transition-opacity"
              style={{ color: 'oklch(0.85 0.15 195)' }}
            >
              ✕
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(40vh-50px)] px-5 py-4 space-y-5">
            {isLoading ? (
              <div className="text-center py-8 font-mono text-[13px]" style={{ color: 'oklch(0.70 0 0)' }}>
                Loading...
              </div>
            ) : queryResults === null ? (
              <div className="space-y-4">
                {COMMAND_EXAMPLES.map((example, index) => (
                  <div key={index} className="space-y-1">
                    <div className="font-mono text-[13px] font-bold" style={{ color: 'oklch(0.85 0.15 195)' }}>
                      {example.command}
                    </div>
                    <div className="font-mono text-[12px]" style={{ color: 'oklch(0.70 0 0)' }}>
                      {example.description}
                    </div>
                  </div>
                ))}
              </div>
            ) : queryResults.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <div className="font-mono text-[13px]" style={{ color: 'oklch(0.70 0 0)' }}>
                  No results found
                </div>
              </div>
            ) : (
              queryResults.map((result, index) => (
                <div key={index} className="space-y-2 pb-4 border-b last:border-b-0" style={{ borderColor: 'oklch(0.25 0 0)' }}>
                  <div className="font-mono text-[12px]" style={{ color: 'oklch(0.85 0.15 195)' }}>
                    {result.date}
                  </div>
                  <div className="font-mono text-[13px]" style={{ color: 'oklch(0.95 0 0)' }}>
                    {result.line}
                  </div>
                  {result.notes && (
                    <div className="font-mono text-[11px]" style={{ color: 'oklch(0.70 0 0)' }}>
                      {result.notes}
                    </div>
                  )}
                  <div className="font-mono text-[11px]" style={{ color: 'oklch(0.70 0 0)' }}>
                    Hits: {result.hits}
                  </div>
                </div>
              ))
            )}
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

      <img
        src="/src/assets/images/madeit-tech-logo-v2.jpeg"
        alt="NSPE Footer Logo Left"
        className={`absolute bottom-[42px] left-4 z-10 pointer-events-none ${leftMascotVisible ? 'fade-in' : 'fade-out'}`}
        style={{
          width: '38.5px',
          height: '63px',
          maxWidth: '38.5px',
          maxHeight: '63px',
          objectFit: 'contain',
        }}
      />

      <img
        src="/src/assets/images/madeit-tech-logo-v2.jpeg"
        alt="NSPE Footer Logo Right"
        className={`absolute bottom-[42px] right-4 z-10 pointer-events-none flip-horizontal ${!leftMascotVisible ? 'fade-in' : 'fade-out'}`}
        style={{
          width: '38.5px',
          height: '63px',
          maxWidth: '38.5px',
          maxHeight: '63px',
          objectFit: 'contain',
        }}
      />

      <div className="absolute bottom-0 left-0 right-0 z-10 overflow-hidden pointer-events-none border-t" style={{ borderColor: 'oklch(0.25 0 0)' }}>
        <div 
          ref={tickerRef}
          className="whitespace-nowrap font-mono text-[13px] py-2 animate-ticker"
          style={{ 
            color: 'oklch(0.85 0.15 195)',
            animation: 'ticker-scroll 11.33s linear infinite'
          }}
        >
          {tickerText}    ★    {tickerText}    ★    {tickerText}
        </div>
      </div>
    </div>
  )
}

export default App
