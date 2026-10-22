// The compact mobile header {vs.goalie} established (owner ask, 2026-10-28:
// "we'll make the {vs.goalie} page our new uniform for mobile tools").
// Three stacked rows instead of one long items-center row with an inline
// tagline: nspe.dev alone on top, the page's own badge + {how.to.use} on
// the row below it, then any page-specific secondary nav (sports switcher,
// a cross-link to a sibling tool) on a third row. The old layout's inline
// description text is what was eating vertical space before any real
// content on mobile (screenshot, 2026-10-28) — it moves into the
// {how.to.use} modal here instead of always sitting in the header.
//
// Desktop is untouched by this — each page keeps its own existing
// single-row desktop header, this component is only ever rendered in the
// `isMobile` branch.
import { useState, type ReactNode } from 'react'
import { HomeLogoLink } from '@/components/HomeLogoLink'
import { C } from '@/components/ProfileSections'

export function MobileToolHeader({
  badge,
  introTitle,
  introBody,
  nav,
}: {
  /** e.g. "{chart}" — rendered in the same bordered-badge style
   * {vs.goalie}'s own header uses. */
  badge: string
  /** Defaults to `badge` — the modal's own header label. */
  introTitle?: string
  /** The explanation that used to sit inline in the header, now shown on
   * demand via {how.to.use} instead. */
  introBody: ReactNode
  /** Page-specific secondary nav (a sports switcher, a cross-link to a
   * sibling tool) — renders as its own row under the badge row. Omit if a
   * page has none. */
  nav?: ReactNode
}) {
  const [introOpen, setIntroOpen] = useState(false)
  return (
    <>
      <div className="flex flex-col gap-3 px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div>
          <HomeLogoLink fontSizePx={13} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono font-bold text-[15px] rounded px-2 py-1" style={{ color: C.accent, border: `1px solid ${C.accent}` }}>
            {badge}
          </span>
          <button
            type="button"
            onClick={() => setIntroOpen(true)}
            className="font-mono font-bold text-[12px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
            style={{ color: 'oklch(0.78 0.18 145)' }}
          >
            {'{how.to.use}'}
          </button>
        </div>
        {nav && <div className="flex items-center gap-4 flex-wrap">{nav}</div>}
      </div>

      {introOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.80)' }}
          onClick={() => setIntroOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-[480px] rounded-lg overflow-hidden shadow-2xl"
            style={{ backgroundColor: C.surface, border: `1px solid ${C.border}`, fontFamily: 'monospace' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: 'oklch(0.16 0 0)', borderBottom: `1px solid ${C.border}` }}>
              <span className="font-mono font-bold text-[13px]" style={{ color: C.accent }}>{introTitle ?? badge}</span>
              <button
                type="button"
                onClick={() => setIntroOpen(false)}
                className="font-mono text-[14px] hover:opacity-70 transition-opacity"
                style={{ color: C.accent }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4 space-y-2 font-mono text-[13px]" style={{ color: C.textBright }}>
              {introBody}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
