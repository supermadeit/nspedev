// Top-level component for the mobile calculator-style query builder.
// Reached automatically (not a URL users navigate to) when useIsMobile() is
// true at the catch-all route — see src/main.tsx. Owns screen state
// ('builder' | 'results') and mounts useNspeQuery(), following the same
// "separate top-level component, own file, own local state" precedent
// WorldCupApp.tsx already sets in this codebase.
import { useMemo, useState } from 'react'
import leaderboardData from '@/assets/data/leaderboard.json'
import { useNspeQuery } from '@/hooks/useNspeQuery'
import { BuilderScreen } from './BuilderScreen'
import { ResultsScreen } from './ResultsScreen'
import { useCalculatorQuery } from './state/useCalculatorQuery'

type Screen = 'builder' | 'results'

// Same source/shape as desktop QueryBuilder's popularPlayers prop
// (App.tsx: leaderboard.rows, top 20, {player, team}) — kept identical so
// the "popular players" list matches between desktop and mobile.
interface LeaderboardRowLike {
  player: string
  team: string
}

export function MobileCalculatorApp() {
  const [screen, setScreen] = useState<Screen>('builder')
  const [lastQuery, setLastQuery] = useState('')
  const calc = useCalculatorQuery()
  const { run, isLoading, error, result } = useNspeQuery()
  const popularPlayers = useMemo(() => {
    const rows = (leaderboardData as { rows?: LeaderboardRowLike[] })?.rows ?? []
    return rows.slice(0, 20).map((r) => ({ player: r.player, team: r.team }))
  }, [])

  const handleRun = () => {
    if (!calc.builtCommand) return
    setLastQuery(calc.builtCommand)
    setScreen('results')
    void run(calc.builtCommand)
  }

  const handleBack = () => {
    // Builder state (calc) is untouched on the way back — calculator UX:
    // state persists until explicitly changed by the user, not reset by
    // navigation.
    setScreen('builder')
  }

  return (
    // Fixed to the real viewport height (not min-h-screen, which has no
    // ceiling) and overflow-hidden at this level — the global `body` rule
    // (src/index.css) is `overflow: hidden`, so the page itself never
    // scrolls. BuilderScreen's own inner overflow-y-auto region is the only
    // thing that's allowed to scroll; without a hard-capped ancestor height,
    // that inner scroll never engages and content (including the run
    // button) can end up pushed below the reachable viewport.
    <div className="w-full h-dvh overflow-hidden relative" style={{ backgroundColor: 'oklch(0.08 0 0)' }}>
      <BuilderScreen state={calc} onRun={handleRun} isLoading={isLoading} popularPlayers={popularPlayers} />
      {screen === 'results' && (
        <ResultsScreen
          result={result}
          error={error}
          isLoading={isLoading}
          query={lastQuery}
          onBack={handleBack}
        />
      )}
    </div>
  )
}

export default MobileCalculatorApp
