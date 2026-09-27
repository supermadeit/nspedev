import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { setAccessToken } from '@/lib/auth-token'
import { claimGuestCreditsIfAny, getGuestToken } from '@/lib/guestToken'

interface AuthResult {
  error: string | null
  /** True when signup created a user but email confirmation is still required. */
  needsEmailConfirmation?: boolean
}

interface AuthContextValue {
  session: Session | null
  user: User | null
  /** The current Supabase access token (JWT), or null when signed out. */
  accessToken: string | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<AuthResult>
  signIn: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'Something went wrong. Please try again.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    // Claims whatever's left on a stored guest-quota token (see
    // guestToken.ts) once we know a session exists — covers both a
    // just-completed sign-in/signup (the common case) and an already-logged-in
    // visitor whose browser picked up a token from guest use in another tab.
    // Safe to call speculatively: it's a no-op when no token is stored, and
    // the backend guards replay of an already-redeemed token server-side too.
    const claimIfSignedIn = (nextSession: Session | null) => {
      if (nextSession && getGuestToken()) void claimGuestCreditsIfAny()
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setAccessToken(data.session?.access_token ?? null)
      setLoading(false)
      claimIfSignedIn(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAccessToken(nextSession?.access_token ?? null)
      claimIfSignedIn(nextSession)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    return {
      session,
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      loading,
      async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) return { error: errorMessage(error) }
        // When email confirmation is enabled, no session is returned yet.
        return { error: null, needsEmailConfirmation: !data.session }
      },
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return { error: errorMessage(error) }
        return { error: null }
      },
      async signOut() {
        await supabase.auth.signOut()
      },
    }
  }, [session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
