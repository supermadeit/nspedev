import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Centered, dark-themed shell used by the monetization pages (auth, refill,
 * checkout, success, account) to match the terminal aesthetic.
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
    <div className="min-h-screen w-full bg-black text-neutral-100 flex flex-col items-center px-4 py-10">
      <header className="w-full max-w-5xl flex items-center justify-between mb-10">
        <Link to="/" className="font-mono text-lg tracking-tight hover:opacity-80">
          nspe<span className="text-emerald-400">.dev</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-neutral-400">
          <Link to="/refill" className="hover:text-neutral-100">
            Pricing
          </Link>
          <Link to="/account" className="hover:text-neutral-100">
            Account
          </Link>
        </nav>
      </header>

      <main className={`w-full ${maxWidth} flex flex-col gap-6`}>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="text-sm text-neutral-400">{subtitle}</p> : null}
        </div>
        {children}
        {footer ? <div className="text-sm text-neutral-400">{footer}</div> : null}
      </main>
    </div>
  )
}
