import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { C } from '@/components/ProfileSections'

/**
 * Centered, dark-themed shell used by the monetization pages (auth, refill,
 * checkout, success, account) to match the terminal aesthetic used by
 * {database} player profiles — same C color tokens, monospace font, and
 * bordered-box treatment rather than the generic shadcn defaults these
 * pages started from.
 */
export function PageShell({
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-md',
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
}) {
  return (
    // h-dvh + overflow-y-auto (not min-h-screen) — the global `body { overflow:
    // hidden }` (src/index.css) means a plain min-h-screen div has nowhere to
    // scroll once its content runs past the viewport; every other full-page
    // view in the app (PlayerProfilePage, WorldCupApp) opts back into
    // scrolling this same way.
    <div
      className="h-dvh w-full overflow-y-auto flex flex-col items-center px-4 py-10"
      style={{ backgroundColor: C.surface, color: C.textBright, fontFamily: 'monospace' }}
    >
      <header
        className="w-full max-w-5xl flex items-center justify-between mb-10 pb-4"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <Link
          to="/"
          className="font-mono font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
          style={{ color: C.textBright }}
        >
          nspe.dev
        </Link>
        <nav className="flex items-center gap-4 text-[13px] font-mono font-bold">
          <Link to="/refill" className="underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
            {'{pricing}'}
          </Link>
          <Link to="/account" className="underline hover:opacity-80 transition-opacity" style={{ color: C.accent }}>
            {'{account}'}
          </Link>
        </nav>
      </header>

      <main className={`w-full ${maxWidth} flex flex-col gap-6`}>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.textBright }}>
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm" style={{ color: C.textDim }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {children}
        {footer ? (
          <div className="text-sm" style={{ color: C.textDim }}>
            {footer}
          </div>
        ) : null}
      </main>
    </div>
  )
}
