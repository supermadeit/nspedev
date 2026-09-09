// Full-screen takeover listing every curated sample command, generated live
// from curatedDefaults.ts (see @/lib/sampleQueries.ts) — a review surface for
// cross-checking curated threshold/window values against the actual command
// they produce, not a polished "what would you press" tutorial yet (that's a
// later design pass). Desktop's equivalent is SampleQueriesModal.tsx, sharing
// the same buildSampleQueries() data — content is uniform, only the chrome
// (full-screen takeover vs. centered modal) differs per platform.
//
// Every row is a one-tap copy-to-clipboard target (the whole row, not a
// small icon) — the screen stays open afterward so multiple commands can be
// copied in one visit rather than bouncing back after the first tap.
import { buildSampleQueries, type SampleQuery } from '@/lib/sampleQueries'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
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

function SampleQueryRow({ query }: { query: SampleQuery }) {
  const { copied, copy } = useCopyToClipboard()
  const green = 'oklch(0.85 0.15 145)'

  return (
    <button
      type="button"
      onClick={() => copy(query.command)}
      className="w-full text-left rounded-lg border px-3 py-2.5 flex items-center justify-between gap-3"
      style={{ backgroundColor: C.surface2, borderColor: copied ? green : C.border }}
    >
      <div className="min-w-0">
        <div className="font-mono text-[9px] uppercase tracking-widest mb-1" style={{ color: C.textDim }}>
          {query.label}
        </div>
        <div className="font-mono text-[13px] truncate" style={{ color: C.accent }}>
          {query.command}
        </div>
      </div>
      <span className="font-mono text-[11px] flex-none" style={{ color: copied ? green : C.textDim }}>
        {copied ? '{copied}' : '{copy}'}
      </span>
    </button>
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
            sample-queries
          </div>
          <div className="font-mono text-[11px]" style={{ color: C.textDim }}>
            {queries.length} curated commands
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {queries.map((q) => (
          <SampleQueryRow key={q.command} query={q} />
        ))}
      </div>
    </div>
  )
}
