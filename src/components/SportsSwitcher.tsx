// Uniform "{sports}" nav control — dropped into the same spot on every
// sport's rankings/matchups page (WorldCupApp.tsx for NFL, SportSeasonPage.tsx
// for NBA/MLB/NHL) and next to {homepage} on the charts page, so a visitor
// can jump straight from any one of these pages to any other sport without
// routing back through the homepage first. Standalone styling (not importing
// any host page's own `C` palette, since the three host files don't share
// one) — just the app's usual cyan accent + dark panel, consistent with
// every other small popover in the app (the homepage's own mobile {sports}
// toggle, the mobile leaderboard, etc).
import { useEffect, useRef, useState } from 'react'

export type SportKey = 'nfl' | 'nba' | 'mlb' | 'nhl'

const SPORT_LINKS: { sport: SportKey; href: string; label: string }[] = [
  { sport: 'nfl', href: '/nfl.season', label: 'nfl.season' },
  { sport: 'nba', href: '/nba.season', label: 'nba.season' },
  { sport: 'mlb', href: '/mlb.playoffs', label: 'mlb.playoffs' },
  { sport: 'nhl', href: '/nhl.season', label: 'nhl.season' },
]

const ACCENT = 'oklch(0.85 0.15 195)'

// `current` is left off the list (no point linking a page to itself) —
// omitted entirely (e.g. from the homepage's {matchups} entry point, or the
// charts page, neither of which is itself "a sport page") to show all four
// instead.
// `label` overrides the trigger button's own text — "sports" everywhere this
// is a lateral nav control on a page that's already a specific sport
// ({nfl.rankings}'s old slot, each SportSeasonPage, {homepage} next to
// {sports} on the charts page), "matchups" on the homepage itself, where
// it's the discovery entry point into this whole feature rather than a
// same-page switch.
// `direction` picks which way the menu opens — "down" (default) for every
// per-page header placement, which all sit near the top of the screen;
// "up" for the homepage's {matchups} entry point specifically, which sits
// near the BOTTOM of the screen on both platforms, where a downward-opening
// menu would either run off-screen or read backwards.
export function SportsSwitcher({
  current,
  label = 'sports',
  direction = 'down',
}: {
  current?: SportKey
  label?: string
  direction?: 'up' | 'down'
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const others = SPORT_LINKS.filter((l) => l.sport !== current)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="font-mono font-bold text-[14px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
        style={{ color: ACCENT }}
        aria-label="Switch sport"
      >
        {`{${label}}`}
      </button>
      {open && (
        <div
          className={`absolute right-0 z-30 flex flex-col items-end gap-2 rounded px-3 py-2 ${direction === 'up' ? 'bottom-[26px]' : 'top-[26px]'}`}
          style={{ backgroundColor: 'oklch(0.14 0 0)', border: '1px solid oklch(0.28 0 0)' }}
        >
          {others.map((l) => (
            <a
              key={l.sport}
              href={l.href}
              className="font-mono font-bold text-[13px] underline hover:opacity-80 transition-opacity whitespace-nowrap"
              style={{ color: ACCENT }}
            >
              {`{${l.label}}`}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
