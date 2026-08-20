// Full-screen takeover listing every curated sample command, generated live
// from curatedDefaults.ts (see state/sampleQueries.ts) — a review surface for
// cross-checking curated threshold/window values against the actual command
// they produce, not a polished "what would you press" tutorial yet (that's a
// later design pass).
import { buildSampleQueries } from './state/sampleQueries'
import { C } from './components/theme'

export interface SampleQueriesScreenProps {
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

export function SampleQueriesScreen({ onBack }: SampleQueriesScreenProps) {
  const queries = buildSampleQueries()

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
            sample queries
          </div>
          <div className="font-mono text-[11px]" style={{ color: C.textDim }}>
            {queries.length} curated commands
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {queries.map((q) => (
          <div
            key={q.command}
            className="rounded-lg border px-3 py-2.5"
            style={{ backgroundColor: C.surface2, borderColor: C.border }}
          >
            <div className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: C.textDim }}>
              {q.label}
            </div>
            <div className="font-mono text-[13px]" style={{ color: C.accent }}>
              {q.command}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
