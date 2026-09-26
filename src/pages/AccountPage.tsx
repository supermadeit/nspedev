import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { authHeader } from '@/lib/auth-token'
import { API_BASE_CANDIDATES, joinUrl } from '@/lib/nspe-api'
import { PageShell } from './PageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Profile {
  credits: number
  plan?: string | null
  username?: string | null
}

// Same shape the backend validates (api/account_routes.py's _USERNAME_RE):
// 3-20 chars, lowercase letters/digits/underscore. Checked client-side first
// for instant feedback; the server (and its unique constraint) is still the
// real guard against a taken name or a race between two signups.
const USERNAME_RE = /^[a-z0-9_]{3,20}$/

function normalizeUsername(v: string): string {
  return v.trim().toLowerCase()
}

export default function AccountPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  // Same localStorage key the homepage's {psc} toggle reads.
  const [pscOn, setPscOn] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('nspe.psc') !== 'off'
    } catch {
      return true
    }
  })
  const togglePsc = () => {
    const next = !pscOn
    setPscOn(next)
    try {
      window.localStorage.setItem('nspe.psc', next ? 'on' : 'off')
    } catch {
      // ignore
    }
  }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Username editor — separate from the credits/plan load above/error state
  // so a failed username save never clobbers the profile card, and vice
  // versa.
  const [usernameInput, setUsernameInput] = useState('')
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      if (!user) return
      setLoading(true)
      // Balance/plan/username all live in user_profiles — queried directly
      // via Supabase with the user's JWT (RLS scopes the row), same as
      // before. Username is also readable through the backend's new
      // GET /account/me, but there's no need for a second round-trip when
      // this table read already covers it.
      const { data, error } = await supabase
        .from('user_profiles')
        .select('credits, plan, username')
        .eq('id', user.id)
        .single()
      if (!active) return
      if (error) {
        setError(error.message)
      } else {
        setProfile(data as Profile)
      }
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [user])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  function startEditingUsername() {
    setUsernameInput(profile?.username ?? '')
    setUsernameError(null)
    setIsEditingUsername(true)
  }

  async function handleSaveUsername() {
    const candidate = normalizeUsername(usernameInput)
    if (!USERNAME_RE.test(candidate)) {
      setUsernameError('3-20 characters: lowercase letters, digits, underscore only.')
      return
    }
    setUsernameSaving(true)
    setUsernameError(null)
    try {
      // Same base-URL failover every other backend call in this app uses
      // (same-origin proxy locally, api.nspe.dev otherwise).
      const urls = API_BASE_CANDIDATES.map((base) => joinUrl(base, '/account/username'))
      let lastError: string | null = null
      for (const url of urls) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({ username: candidate }),
          })
          if (res.ok) {
            setProfile((p) => (p ? { ...p, username: candidate } : p))
            setIsEditingUsername(false)
            setUsernameSaving(false)
            return
          }
          if (res.status === 409) {
            setUsernameError('That username is already taken.')
            setUsernameSaving(false)
            return
          }
          const body = await res.json().catch(() => null)
          lastError = body?.detail || `HTTP ${res.status}`
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Network error'
        }
      }
      setUsernameError(lastError || 'Could not save username. Try again.')
    } finally {
      setUsernameSaving(false)
    }
  }

  return (
    <PageShell title="Account" subtitle={user?.email ?? undefined} maxWidth="max-w-2xl">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-neutral-800 bg-neutral-950">
        <CardHeader>
          <CardTitle>Username</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isEditingUsername ? (
            <div className="space-y-2">
              <Input
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="lowercase, 3-20 chars, a-z 0-9 _"
                maxLength={20}
                autoFocus
                disabled={usernameSaving}
              />
              {usernameError ? (
                <div className="text-sm text-red-400">{usernameError}</div>
              ) : null}
              <div className="flex gap-2">
                <Button onClick={handleSaveUsername} disabled={usernameSaving}>
                  {usernameSaving ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsEditingUsername(false)
                    setUsernameError(null)
                  }}
                  disabled={usernameSaving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-lg">
                {loading ? '—' : profile?.username ? `@${profile.username}` : (
                  <span className="text-neutral-400">not set</span>
                )}
              </div>
              <Button variant="secondary" onClick={startEditingUsername} disabled={loading}>
                {profile?.username ? 'Change' : 'Set username'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-neutral-950">
        <CardHeader>
          <CardTitle>Credit balance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-4xl font-semibold">
            {loading ? '—' : (profile?.credits ?? 0).toLocaleString()}
            <span className="text-base text-neutral-400 ml-2">credits</span>
          </div>
          {profile?.plan ? (
            <div className="text-sm text-neutral-400">
              Plan: <span className="text-neutral-100">{profile.plan}</span>
            </div>
          ) : null}
          <Button asChild>
            <Link to="/refill">Buy more credits</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-neutral-800 bg-neutral-950">
        <CardHeader>
          <CardTitle>Search suggestions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-neutral-400">
            Show command suggestions ({'{psc}'}) as you type in the search bar. Player search always stays on.
          </p>
          <Button variant="secondary" onClick={togglePsc} aria-pressed={pscOn} className="self-start">
            {pscOn ? 'Suggestions: on' : 'Suggestions: off'}
          </Button>
        </CardContent>
      </Card>

      <Button variant="secondary" onClick={handleSignOut} className="self-start">
        Sign out
      </Button>
    </PageShell>
  )
}
