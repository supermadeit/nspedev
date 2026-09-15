// Desktop's {sample-queries} modal — same curated command list mobile's
// SampleQueriesScreen shows (both read buildSampleQueries() from
// @/lib/sampleQueries.ts), just windowed as a centered modal instead of a
// full-screen takeover, matching this app's existing modal chrome (see
// AutoDemo.tsx). Replaces the old {sample-commands} scripted-typing demo as
// the primary entry point — that feature is shelved, not deleted, for a
// possible later redesign.
//
// Every row is a one-tap copy-to-clipboard target (the whole row, not a
// small icon) — the modal stays open afterward so multiple commands can be
// copied in one visit rather than closing after the first tap.
import { buildSampleQueries, type SampleQuery } from '@/lib/sampleQueries'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

const C = {
  accent: 'oklch(0.85 0.15 195)',
  green: 'oklch(0.85 0.15 145)',
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

function SampleQueryRow({ query }: { query: SampleQuery }) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <button
      type="button"
      onClick={() => copy(query.command)}
      className="w-full text-left rounded px-3 py-2 hover:opacity-90 transition-opacity"
      style={{ backgroundColor: C.surface2, border: `1px solid ${copied ? C.green : C.border}` }}
    >
      {/* {copy}/{copied} lives on the label row, not next to the command
          itself — freeing the full row width for the command text, which is
          what was truncating on narrower viewports. Still far-right, just a
          line up. */}
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: C.textDim }}>
          {query.label}
        </span>
        <span className="font-mono text-[11px] flex-none" style={{ color: copied ? C.green : C.textDim }}>
          {copied ? '{copied}' : '{copy}'}
        </span>
      </div>
      <div className="font-mono text-[13px] whitespace-nowrap" style={{ color: C.accent }}>
        {query.command}
      </div>
    </button>
  )
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
        className="w-full max-w-[720px] max-h-[80vh] rounded-lg overflow-hidden shadow-2xl flex flex-col"
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
            <SampleQueryRow key={q.command} query={q} />
          ))}
        </div>
      </div>
    </div>
  )
}
