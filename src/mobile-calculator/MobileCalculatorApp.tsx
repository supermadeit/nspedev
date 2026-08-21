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
import { SampleQueriesScreen } from './SampleQueriesScreen'
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
  const [isSampleQueriesOpen, setIsSampleQueriesOpen] = useState(false)
  const [lastQuery, setLastQuery] = useState('')
  // Captured at run time (not read live during results view) — the unit
  // label for the generic case's bare compute total, e.g. "27hits" instead
  // of just "27". NFL uses its yds/td type as the unit since "pass"/"rush"
  // alone isn't a unit; every other sport's stat code already reads fine
  // as one (hits, pts, runs, ...).
  const [lastStatLabel, setLastStatLabel] = useState('')
  const calc = useCalculatorQuery()
  const { run, isLoading, error, result } = useNspeQuery()
  const popularPlayers = useMemo(() => {
    const rows = (leaderboardData as { rows?: LeaderboardRowLike[] })?.rows ?? []
    return rows.slice(0, 20).map((r) => ({ player: r.player, team: r.team }))
  }, [])

  const handleRun = () => {
    if (!calc.builtCommand) return
    setLastQuery(calc.builtCommand)
    // "total" (the pass+rush / rush+rec combo type) isn't itself a unit —
    // the underlying stat is yardage, so label compute totals "N yds", not
    // the literal, confusing "N total".
    const nflLabel = calc.nflStatType === 'total' ? 'yds' : calc.nflStatType
    setLastStatLabel(calc.sport === 'nfl' ? nflLabel : calc.stat)
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
      <BuilderScreen
        state={calc}
        onRun={handleRun}
        isLoading={isLoading}
        popularPlayers={popularPlayers}
        onOpenSampleQueries={() => setIsSampleQueriesOpen(true)}
      />
      {screen === 'results' && (
        <ResultsScreen
          result={result}
          error={error}
          isLoading={isLoading}
          query={lastQuery}
          onBack={handleBack}
          statLabel={lastStatLabel}
        />
      )}
      {isSampleQueriesOpen && <SampleQueriesScreen onBack={() => setIsSampleQueriesOpen(false)} />}
    </div>
  )
}

export default MobileCalculatorApp
