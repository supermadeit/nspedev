import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { authHeader } from '@/lib/auth-token'
import { apiUrl } from '@/lib/api'
import { PRICING_TIERS, type PricingTier } from '@/lib/pricing'
import { PageShell } from './PageShell'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'

export default function RefillPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function buy(tier: PricingTier) {
    if (!user) {
      navigate('/login?redirect=%2Frefill', { replace: true })
      return
    }
    setError(null)
    setLoadingPlan(tier.plan)
    try {
      const res = await fetch(apiUrl('/stripe/create-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // /stripe/create-session is auth-gated: JWT required.
          ...authHeader(),
        },
        body: JSON.stringify({
          plan: tier.plan,
          // Backend cross-checks user_id against the JWT and copies it into the
          // Stripe subscription metadata.
          user_id: user.id,
          email: user.email,
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Checkout failed (HTTP ${res.status}).`)
      }

      const data: { client_secret?: string } = await res.json()
      if (!data.client_secret) {
        throw new Error('Backend did not return a client_secret.')
      }

      // Hand the client_secret to the embedded checkout page.
      navigate('/checkout', {
        state: { clientSecret: data.client_secret, plan: tier.plan },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <PageShell
      title="Buy credits"
      subtitle="Pick a pack. Credits are added to your balance after payment."
      maxWidth="max-w-5xl"
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PRICING_TIERS.map((tier) => (
          <Card
            key={tier.plan}
            className={
              tier.highlighted
                ? 'border-emerald-500 bg-neutral-950 flex flex-col'
                : 'border-neutral-800 bg-neutral-950 flex flex-col'
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{tier.name}</span>
                {tier.highlighted ? (
                  <span className="text-xs font-normal text-emerald-400">Popular</span>
                ) : null}
              </CardTitle>
              <CardDescription>{tier.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="text-3xl font-semibold">{tier.price}</div>
              <div className="text-sm text-neutral-400 mt-1">
                {tier.credits.toLocaleString()} credits
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={tier.highlighted ? 'default' : 'secondary'}
                disabled={loadingPlan !== null}
                onClick={() => buy(tier)}
              >
                {loadingPlan === tier.plan ? 'Starting…' : 'Buy'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </PageShell>
  )
}
