// {sample-queries} — shared by both desktop and mobile's main search bar
// (App.tsx renders one instance; mobile-calculator's separate /calculator app
// has its own SampleQueriesScreen.tsx full-screen takeover with the same
// data, unrelated to this file). Replaces the old {sample-commands}
// scripted-typing demo as the primary entry point — that feature is shelved,
// not deleted, for a possible later redesign.
//
// Full-screen takeover (2026-10-03) — was a centered `max-w-[720px]` modal,
// which on a narrow mobile viewport (this same component opens from mobile's
// search bar too) left each row only ~300-350px wide for a `whitespace-nowrap`
// command string; the catalog's longer commands (up to ~56 chars, e.g.
// "nspe nfl pass -yds300 -prime -leaderboard -career -top10") ran past the
// row's own edge instead of fitting inside it. Full width fixes that outright
// and leaves room for longer commands later; each row also gets its own
// `overflow-x-auto` as a second line of defense for whatever's still too
// long for the viewport even at full width.
//
// Every row is a one-tap copy-to-clipboard target (the whole row, not a
// small icon) — the screen stays open afterward so multiple commands can be
// copied in one visit rather than closing after the first tap.
import { buildSampleQueries, type SampleQuery } from '@/lib/sampleQueries'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

const C = {
  accent: 'oklch(0.85 0.15 195)',
  green: 'oklch(0.85 0.15 145)',
  surface: 'oklch(0.12 0 0)',
  surface2: 'oklch(0.17 0 0)',
  border: 'oklch(0.25 0 0)',
  // Bumped to match textBright — grey text site-wide was hard to read
  // (2026-10-01), owner wants white.
  textDim: 'oklch(0.88 0 0)',
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
      {/* overflow-x-auto is the fallback for a command still too long for
          the viewport even at full screen width — see the file banner. */}
      <div className="overflow-x-auto">
        <div className="font-mono text-[13px] whitespace-nowrap" style={{ color: C.accent }}>
          {query.command}
        </div>
      </div>
    </button>
  )
}

export function SampleQueriesModal({ open, onClose }: SampleQueriesModalProps) {
  if (!open) return null
  const queries = buildSampleQueries()

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: C.surface, fontFamily: 'monospace' }}
      role="dialog"
      aria-modal="true"
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

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-2">
        {queries.map((q) => (
          <SampleQueryRow key={q.command} query={q} />
        ))}
      </div>
    </div>
  )
}
