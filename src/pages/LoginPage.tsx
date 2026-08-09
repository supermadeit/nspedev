import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PageShell } from './PageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redirectTo = params.get('redirect') || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    navigate(redirectTo, { replace: true })
  }

  return (
    <PageShell
      title="Log in"
      subtitle="Welcome back. Sign in to run queries and manage credits."
      footer={
        <span>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-emerald-400 hover:underline">
            Sign up
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Log in'}
        </Button>
      </form>
    </PageShell>
  )
}
