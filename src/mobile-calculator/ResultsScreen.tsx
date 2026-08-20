// Full-screen results takeover. Back button + calc-logo top-left return to
// the builder screen WITHOUT resetting its state — calculator UX persists
// state until the user explicitly changes it, so navigating back must not
// clear anything in useCalculatorQuery.
import type { NspeResult } from '@/hooks/useNspeQuery'
import { LeaderboardList } from './components/LeaderboardList'
import { C } from './components/theme'

export interface ResultsScreenProps {
  result: NspeResult | null
  error: string | null
  isLoading: boolean
  query: string
  onBack: () => void
}

function CalcLogo() {
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[13px] font-bold flex-none"
      style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}`, color: C.accent }}
      aria-hidden="true"
    >
      ▸_
    </div>
  )
}

export function ResultsScreen({ result, error, isLoading, query, onBack }: ResultsScreenProps) {
  return (
    <div
      className="w-full h-full flex flex-col fixed inset-0 z-50"
      style={{ backgroundColor: 'oklch(0.08 0 0)', color: C.textBright, fontFamily: 'monospace' }}
    >
      <div className="flex items-center gap-3 px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-[13px] px-3 py-2 rounded-lg border flex-none"
          style={{ backgroundColor: C.surface2, borderColor: C.border, color: C.textBright }}
        >
          ‹ back
        </button>
        <CalcLogo />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: C.textDim }}>
            query
          </div>
          <div className="font-mono text-[11px] truncate" style={{ color: C.accent }}>
            {query || '—'}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading && (
          <div className="font-mono text-[12px] text-center py-10" style={{ color: C.textDim }}>
            running query…
          </div>
        )}

        {!isLoading && error && (
          <div
            className="font-mono text-[12px] rounded-lg border px-3 py-3 mb-3"
            style={{ backgroundColor: C.surface2, borderColor: C.border, color: 'oklch(0.70 0.15 30)' }}
          >
            {error}
          </div>
        )}

        {!isLoading && result && <LeaderboardList result={result} />}

        {!isLoading && !result && !error && (
          <div className="font-mono text-[12px] text-center py-10" style={{ color: C.textDim }}>
            no results
          </div>
        )}
      </div>
    </div>
  )
}
