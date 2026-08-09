import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

/** Redirects unauthenticated users to /login, preserving the intended path. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-black text-neutral-400 flex items-center justify-center font-mono text-sm">
        Loading…
      </div>
    )
  }

  if (!session) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  return <>{children}</>
}
