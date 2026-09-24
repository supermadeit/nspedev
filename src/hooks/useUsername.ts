// Signed-in user's display handle for chrome that isn't a full account page
// (the homepage header's top-right nav) — separate from AccountPage's own
// profile load since that one also needs credits/plan, not just the
// username. Same table/column, just a lighter read for a smaller need.
import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export function useUsername(): { username: string | null; loading: boolean } {
  const { user } = useAuth()
  const [username, setUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setUsername(null)
      return
    }
    let active = true
    setLoading(true)
    supabase
      .from('user_profiles')
      .select('username')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        setUsername(!error && data ? (data as { username: string | null }).username : null)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user])

  return { username, loading }
}
