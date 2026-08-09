import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loadStripe } from '@stripe/stripe-js'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { PageShell } from './PageShell'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

type VerifyState = 'verifying' | 'paid' | 'unpaid' | 'error'

// Poll Supabase for the updated credit balance. The Stripe webhook fires
// asynchronously, so credits may not yet be written when we first land on
// /success. Retry up to maxAttempts times with a fixed delay between each.
async function pollBalance(
  userId: string,
  minCredits: number,
  maxAttempts = 6,
  delayMs = 2000,
): Promise<number | null> {
  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delayMs))
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('credits')
      .eq('id', userId)
      .single()
    const credits = profile?.credits as number | undefined
    // If credits have increased beyond the pre-purchase floor, the webhook fired.
    if (credits !== undefined && credits > minCredits) return credits
    // On the last attempt return whatever we have even if unchanged.
    if (i === maxAttempts - 1 && credits !== undefined) return credits
  }
  return null
}

export default function SuccessPage() {
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')
  const { user } = useAuth()

  const [state, setState] = useState<VerifyState>('verifying')
  const [balance, setBalance] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function verify() {
      if (!sessionId) {
        setState('error')
        setMessage('Missing session_id — cannot confirm payment.')
        return
      }

      try {
        // Verify client-side via Stripe.js — no backend /success endpoint needed.
        // retrieveEmbeddedCheckoutSession uses the publishable key to confirm
        // payment_status without an extra backend round-trip.
        const stripe = await loadStripe(
          import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string,
        )
        if (!stripe) throw new Error('Stripe.js failed to load.')

        // @ts-expect-error — retrieveEmbeddedCheckoutSession is present in
        // stripe-js ≥ 3.x but not yet reflected in the bundled type stubs.
        const session = await stripe.retrieveEmbeddedCheckoutSession(sessionId)
        if (!active) return

        const paid =
          session?.payment_status === 'paid' || session?.status === 'complete'

        if (paid) {
          setState('paid')
          // Fetch the authoritative new balance from Supabase (written by webhook).
          // Short-poll to handle fast *and* slow webhook delivery.
          if (user) {
            // Snapshot pre-purchase balance as a floor for the poll comparison.
            const { data: before } = await supabase
              .from('user_profiles')
              .select('credits')
              .eq('id', user.id)
              .single()
            const prePurchase = (before?.credits as number | undefined) ?? 0
            const updated = await pollBalance(user.id, prePurchase)
            if (active) setBalance(updated)
          }
        } else {
          setState('unpaid')
          setMessage(
            'Payment has not completed yet. If you were charged, credits will appear in your account shortly.',
          )
        }
      } catch (e) {
        if (!active) return
        setState('error')
        setMessage(
          e instanceof Error
            ? e.message
            : 'Could not verify payment. Check your account balance.',
        )
      }
    }

    verify()
    return () => {
      active = false
    }
  }, [sessionId, user])

  return (
    <PageShell title="Payment" subtitle="Confirming your purchase.">
      {state === 'verifying' ? (
        <p className="text-neutral-400 font-mono text-sm">Verifying payment…</p>
      ) : null}

      {state === 'paid' ? (
        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              Payment confirmed — your credits have been added.
              {balance !== null ? (
                <> New balance: <strong>{balance.toLocaleString()} credits</strong>.</>
              ) : null}
            </AlertDescription>
          </Alert>
          <div className="flex gap-3">
            <Button asChild>
              <Link to="/">Start querying</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/account">View account</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {(state === 'unpaid' || state === 'error') && message ? (
        <div className="space-y-4">
          <Alert variant={state === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          <Button asChild variant="secondary">
            <Link to="/account">Go to account</Link>
          </Button>
        </div>
      ) : null}
    </PageShell>
  )
}
