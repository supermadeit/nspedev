// The uniform "go home" control (owner ask, 2026-10-19: "{homepage} doesn't
// look right to me most times... the logo will give it away"). This is the
// same bordered "nspe.dev" badge that's always sat top-left on the homepage
// itself (App.tsx) — previously just decorative text there, not even a
// link — now made clickable everywhere, including on the homepage, and
// given a glow around its existing green outline so it reads as clickable
// rather than purely decorative. Replaces every plain "{HOMEPAGE}" text
// link site-wide (chart pages, team.metrics, player profiles, the mobile
// calculator, and the team.metrics share-card poster).
import { Link } from 'react-router-dom'

const GREEN_BORDER = 'oklch(0.85 0.15 145)'
// Same glow shape/alpha as the homepage mic's listening glow
// (App.tsx's MIC_LISTENING_GLOW), just the green hue instead of red —
// matches the site's existing "glow = notice me, this is interactive"
// convention rather than inventing a new one.
const GREEN_GLOW = '0 0 6px 1px oklch(0.85 0.15 145 / 0.55), 0 0 16px 3px oklch(0.85 0.15 145 / 0.25)'

export function HomeLogoLink({
  fontSizePx,
  className = '',
}: {
  /** Omit to inherit the ambient font-size from wherever this is placed
   * (the homepage's own responsive mobile/desktop text-size wrapper does
   * this); pass a value for standalone placements with no such wrapper
   * (chart/team.metrics page headers, the share-card poster). */
  fontSizePx?: number
  className?: string
}) {
  return (
    <Link
      to="/"
      aria-label="nspe.dev homepage"
      className={`inline-flex items-center rounded px-2 py-1 font-bold whitespace-nowrap font-mono hover:opacity-90 transition-opacity ${className}`}
      style={{
        color: 'oklch(0.95 0 0)',
        border: `1px solid ${GREEN_BORDER}`,
        boxShadow: GREEN_GLOW,
        ...(fontSizePx != null ? { fontSize: `${fontSizePx}px` } : {}),
      }}
    >
      nspe.dev
    </Link>
  )
}
