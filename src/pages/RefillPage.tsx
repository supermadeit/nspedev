import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { authHeader } from '@/lib/auth-token'
import { apiUrl } from '@/lib/api'
import { REFILL_TIERS, SUBSCRIPTION_TIERS, type PricingTier } from '@/lib/pricing'
import { PageShell } from './PageShell'
import { C } from '@/components/ProfileSections'

type Tab = 'refill' | 'subscribe'

export default function RefillPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('refill')
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

  const tiers = tab === 'refill' ? REFILL_TIERS : SUBSCRIPTION_TIERS

  return (
    <PageShell
      title="Pricing"
      subtitle="Buy a one-time credit pack, or subscribe for a monthly allowance."
      maxWidth="max-w-5xl"
    >
      {error ? (
        <div
          className="rounded-lg px-4 py-3 text-sm font-mono"
          style={{ border: '1px solid oklch(0.6 0.2 25)', backgroundColor: 'oklch(0.18 0.05 25)', color: 'oklch(0.85 0.15 25)' }}
        >
          {error}
        </div>
      ) : null}

      {/* Tab toggle — bordered pill buttons instead of the generic shadcn
          Tabs look, matching the bracketed-button convention used elsewhere
          ({pricing}, {account}, ...). */}
      <div className="flex items-center gap-2">
        {(
          [
            ['refill', 'Buy credits'],
            ['subscribe', 'Subscribe'],
          ] as const
        ).map(([key, label]) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="font-mono text-[13px] font-bold px-4 py-1.5 rounded-lg transition-colors"
              style={{
                border: `1px solid ${active ? C.accent : C.border}`,
                backgroundColor: active ? C.surface2 : 'transparent',
                color: active ? C.accent : C.textDim,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tiers.map((tier) => (
          <div
            key={tier.plan}
            className="rounded-lg p-5 flex flex-col gap-3"
            style={{
              border: `1px solid ${tier.highlighted ? C.green : C.border}`,
              backgroundColor: C.surface2,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-[16px]" style={{ color: C.textBright }}>
                {tier.name}
              </span>
              {tier.highlighted ? (
                <span className="font-mono text-[11px] font-bold uppercase tracking-wide" style={{ color: C.green }}>
                  Popular
                </span>
              ) : null}
            </div>

            <div>
              <span className="font-mono text-[28px] font-bold" style={{ color: C.textBright }}>
                {tier.price}
              </span>
              {tier.billingNote ? (
                <span className="font-mono text-[13px]" style={{ color: C.textDim }}>
                  {tier.billingNote}
                </span>
              ) : null}
            </div>
            <div className="font-mono text-[13px]" style={{ color: C.textDim }}>
              {tier.credits.toLocaleString()} credits{tier.kind === 'subscription' ? ' per month' : ''}
            </div>

            {tier.features ? (
              <ul className="flex-1 flex flex-col gap-1.5 font-mono text-[12px]" style={{ color: C.textDim }}>
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span style={{ color: C.green }}>·</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex-1" />
            )}

            <button
              onClick={() => buy(tier)}
              disabled={loadingPlan !== null}
              className="w-full font-mono text-[13px] font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
              style={{
                border: `1px solid ${tier.highlighted ? C.green : C.accent}`,
                color: tier.highlighted ? C.green : C.accent,
                backgroundColor: 'transparent',
              }}
            >
              {loadingPlan === tier.plan ? 'Starting…' : tier.kind === 'subscription' ? 'Subscribe' : 'Buy'}
            </button>
          </div>
        ))}
      </div>
    </PageShell>
  )
}
