import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js'
import { stripePromise } from '@/lib/stripe'
import { PageShell } from './PageShell'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface CheckoutState {
  clientSecret?: string
  plan?: string
}

export default function CheckoutPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = (location.state as CheckoutState | null) ?? null
  const clientSecret = state?.clientSecret

  // No client_secret means the user landed here directly — send them to refill.
  useEffect(() => {
    if (!clientSecret) {
      const t = setTimeout(() => navigate('/refill', { replace: true }), 2500)
      return () => clearTimeout(t)
    }
  }, [clientSecret, navigate])

  if (!clientSecret) {
    return (
      <PageShell title="Checkout" subtitle="No active checkout session.">
        <Alert>
          <AlertDescription>
            Nothing to check out. Redirecting you to the pricing page…
          </AlertDescription>
        </Alert>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Complete your purchase"
      subtitle="Payments are securely processed by Stripe."
      maxWidth="max-w-2xl"
    >
      <div className="rounded-lg bg-white p-1">
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </PageShell>
  )
}
