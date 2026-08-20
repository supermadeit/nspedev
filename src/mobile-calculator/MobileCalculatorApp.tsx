// Top-level component for the mobile calculator-style query builder.
// Reached automatically (not a URL users navigate to) when useIsMobile() is
// true at the catch-all route — see src/main.tsx. Owns screen state
// ('builder' | 'results') and mounts useNspeQuery(), following the same
// "separate top-level component, own file, own local state" precedent
// WorldCupApp.tsx already sets in this codebase.
import { useState } from 'react'
import { useNspeQuery } from '@/hooks/useNspeQuery'
import { BuilderScreen } from './BuilderScreen'
import { ResultsScreen } from './ResultsScreen'
import { useCalculatorQuery } from './state/useCalculatorQuery'

type Screen = 'builder' | 'results'

export function MobileCalculatorApp() {
  const [screen, setScreen] = useState<Screen>('builder')
  const [lastQuery, setLastQuery] = useState('')
  const calc = useCalculatorQuery()
  const { run, isLoading, error, result } = useNspeQuery()

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
    <div className="w-full h-full min-h-screen" style={{ backgroundColor: 'oklch(0.08 0 0)' }}>
      <BuilderScreen state={calc} onRun={handleRun} isLoading={isLoading} />
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
