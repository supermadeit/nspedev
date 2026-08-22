// Desktop's {sample-queries} modal — same curated command list mobile's
// SampleQueriesScreen shows (both read buildSampleQueries() from
// @/lib/sampleQueries.ts), just windowed as a centered modal instead of a
// full-screen takeover, matching this app's existing modal chrome (see
// AutoDemo.tsx). Replaces the old {sample-commands} scripted-typing demo as
// the primary entry point — that feature is shelved, not deleted, for a
// possible later redesign.
import { buildSampleQueries } from '@/lib/sampleQueries'

const C = {
  accent: 'oklch(0.85 0.15 195)',
  surface: 'oklch(0.12 0 0)',
  surface2: 'oklch(0.17 0 0)',
  border: 'oklch(0.25 0 0)',
  textDim: 'oklch(0.48 0 0)',
  textBright: 'oklch(0.88 0 0)',
}

export interface SampleQueriesModalProps {
  open: boolean
  onClose: () => void
}

export function SampleQueriesModal({ open, onClose }: SampleQueriesModalProps) {
  if (!open) return null
  const queries = buildSampleQueries()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.80)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-[600px] max-h-[80vh] rounded-lg overflow-hidden shadow-2xl flex flex-col"
        style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-3 flex-none"
          style={{ backgroundColor: 'oklch(0.16 0 0)', borderBottom: `1px solid ${C.border}` }}
        >
          <span className="font-mono font-bold text-[13px]" style={{ color: C.accent }}>
            {'{sample-queries}'}
            <span className="ml-2 font-normal text-[11px]" style={{ color: C.textDim }}>
              {queries.length} curated commands
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[14px] hover:opacity-70 transition-opacity"
            style={{ color: C.accent }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-2">
          {queries.map((q) => (
            <div
              key={q.command}
              className="rounded px-3 py-2"
              style={{ backgroundColor: C.surface2, border: `1px solid ${C.border}` }}
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
    </div>
  )
}
