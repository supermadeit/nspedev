import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { PageShell } from './PageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setSubmitting(true)
    const { error, needsEmailConfirmation } = await signUp(email, password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    if (needsEmailConfirmation) {
      setConfirmSent(true)
      return
    }
    // handle_new_user trigger grants 20 free credits automatically.
    navigate('/', { replace: true })
  }

  if (confirmSent) {
    return (
      <PageShell title="Check your email" subtitle="One more step to activate your account.">
        <Alert>
          <AlertDescription>
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
            account and claim your 20 free credits.
          </AlertDescription>
        </Alert>
        <Link to="/login" className="text-emerald-400 hover:underline text-sm">
          Back to log in
        </Link>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Create your account"
      subtitle="Sign up and get 20 free credits to start querying."
      footer={
        <span>
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:underline">
            Log in
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
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-neutral-500">At least 6 characters.</p>
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>
    </PageShell>
  )
}
