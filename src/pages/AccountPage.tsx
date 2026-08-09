import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { PageShell } from './PageShell'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Profile {
  credits: number
  plan?: string | null
  api_key?: string | null
}

export default function AccountPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      if (!user) return
      setLoading(true)
      // Balance lives in user_profiles.credits — queried directly via Supabase
      // with the user's JWT (RLS scopes the row). No backend round-trip needed.
      const { data, error } = await supabase
        .from('user_profiles')
        .select('credits, plan, api_key')
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

  return (
    <PageShell title="Account" subtitle={user?.email ?? undefined} maxWidth="max-w-2xl">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

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
          {profile?.api_key ? (
            <div className="text-sm text-neutral-400">
              API key:{' '}
              <code className="text-neutral-100 break-all">{profile.api_key}</code>
            </div>
          ) : null}
          <Button asChild>
            <Link to="/refill">Buy more credits</Link>
          </Button>
        </CardContent>
      </Card>

      <Button variant="secondary" onClick={handleSignOut} className="self-start">
        Sign out
      </Button>
    </PageShell>
  )
}
