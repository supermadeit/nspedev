import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { authHeader } from '@/lib/auth-token'
import { apiUrl } from '@/lib/api'
import { fetchPlansCatalog, formatPriceCents, type NspePlan, type NspeRefill, type PlansCatalog } from '@/lib/plans'
import { PageShell } from './PageShell'
import { C } from '@/components/ProfileSections'

type Tab = 'refill' | 'subscribe'
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; catalog: PlansCatalog }

export default function RefillPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('refill')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    fetchPlansCatalog()
      .then((catalog) => {
        if (active) setState({ status: 'ready', catalog })
      })
      .catch((e) => {
        if (active) setState({ status: 'error', message: e instanceof Error ? e.message : 'Could not load pricing.' })
      })
    return () => {
      active = false
    }
  }, [])

  async function buy(slug: string) {
    if (!user) {
      navigate('/login?redirect=%2Frefill', { replace: true })
      return
    }
    setCheckoutError(null)
    setLoadingPlan(slug)
    try {
      const res = await fetch(apiUrl('/stripe/create-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // /stripe/create-session is auth-gated: JWT required.
          ...authHeader(),
        },
        body: JSON.stringify({
          plan: slug,
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
        state: { clientSecret: data.client_secret, plan: slug },
      })
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <PageShell
      title="Pricing"
      subtitle="Buy a one-time credit pack, or subscribe for a monthly allowance."
      maxWidth="max-w-5xl"
    >
      {state.status === 'loading' && (
        <div className="font-mono text-sm" style={{ color: C.textDim }}>loading pricing…</div>
      )}

      {state.status === 'error' && (
        <div
          className="rounded-lg px-4 py-3 text-sm font-mono"
          style={{ border: '1px solid oklch(0.6 0.2 25)', backgroundColor: 'oklch(0.18 0.05 25)', color: 'oklch(0.85 0.15 25)' }}
        >
          {state.message}
        </div>
      )}

      {state.status === 'ready' && (
        <>
          {checkoutError ? (
            <div
              className="rounded-lg px-4 py-3 text-sm font-mono"
              style={{ border: '1px solid oklch(0.6 0.2 25)', backgroundColor: 'oklch(0.18 0.05 25)', color: 'oklch(0.85 0.15 25)' }}
            >
              {checkoutError}
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

          {tab === 'refill' ? (
            <RefillGrid refills={state.catalog.refills} loadingPlan={loadingPlan} onBuy={buy} />
          ) : (
            <PlansGrid
              // This page is for paying — the free tier is in the catalog
              // (so the Connect page can quote its allowances) but isn't
              // something to buy, so it's left off here (owner, 2026-10-19).
              plans={state.catalog.plans.filter((p) => p.slug !== 'free')}
              loadingPlan={loadingPlan}
              onBuy={buy}
            />
          )}

          <CreditsExplainer catalog={state.catalog} />
        </>
      )}
    </PageShell>
  )
}

function TierCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg p-5 flex flex-col gap-3"
      style={{ border: `1px solid ${C.border}`, backgroundColor: C.surface2 }}
    >
      {children}
    </div>
  )
}

function RefillGrid({ refills, loadingPlan, onBuy }: { refills: NspeRefill[]; loadingPlan: string | null; onBuy: (slug: string) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {refills.map((r) => (
        <TierCard key={r.slug}>
          <div className="font-mono font-bold text-[16px]" style={{ color: C.textBright }}>{r.name}</div>
          <div className="font-mono text-[28px] font-bold" style={{ color: C.textBright }}>{formatPriceCents(r.price_cents)}</div>
          <div className="flex-1 font-mono text-[13px]" style={{ color: C.textDim }}>{r.credits.toLocaleString()} credits</div>
          <button
            onClick={() => onBuy(r.slug)}
            disabled={loadingPlan !== null}
            className="w-full font-mono text-[13px] font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ border: `1px solid ${C.accent}`, color: C.accent, backgroundColor: 'transparent' }}
          >
            {loadingPlan === r.slug ? 'Starting…' : 'Buy'}
          </button>
        </TierCard>
      ))}
    </div>
  )
}

function PlansGrid({ plans, loadingPlan, onBuy }: { plans: NspePlan[]; loadingPlan: string | null; onBuy: (slug: string) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {plans.map((p) => (
        <TierCard key={p.slug}>
          <div className="font-mono font-bold text-[16px]" style={{ color: C.textBright }}>{p.name}</div>
          <div>
            <span className="font-mono text-[28px] font-bold" style={{ color: C.textBright }}>{formatPriceCents(p.price_cents)}</span>
            {p.interval && <span className="font-mono text-[13px]" style={{ color: C.textDim }}>/{p.interval === 'month' ? 'mo' : p.interval}</span>}
          </div>
          <p className="flex-1 font-mono text-[13px]" style={{ color: C.textDim }}>{p.blurb}</p>
          <button
            onClick={() => onBuy(p.slug)}
            disabled={loadingPlan !== null}
            className="w-full font-mono text-[13px] font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ border: `1px solid ${C.accent}`, color: C.accent, backgroundColor: 'transparent' }}
          >
            {loadingPlan === p.slug ? 'Starting…' : 'Subscribe'}
          </button>
        </TierCard>
      ))}
    </div>
  )
}

// The "what a credit actually costs" explainer backend asked for — pulled
// live from the same /plans response (catalog.credits) rather than typed in
// here a second time, so this can't drift out of sync with the rule the
// backend is actually enforcing.
function CreditsExplainer({ catalog }: { catalog: PlansCatalog }) {
  const { rule, examples } = catalog.credits
  return (
    <div className="rounded-lg p-5 space-y-3" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surface2 }}>
      <div className="font-mono font-bold text-[14px]" style={{ color: C.accent }}>How chat credits work</div>
      <p className="font-mono text-[13px]" style={{ color: C.textDim }}>{rule}</p>
      <p className="font-mono text-[13px]" style={{ color: C.textBright }}>
        A quick question is 1 credit; the deeper the answer, the more it costs — you only pay for the depth you asked for.
      </p>
      <div className="space-y-1.5">
        {examples.map((ex, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4 font-mono text-[12px]" style={{ color: C.textDim }}>
            <span className="italic">"{ex.question}"</span>
            <span className="whitespace-nowrap font-bold" style={{ color: C.accent }}>{ex.credits} credit{ex.credits === 1 ? '' : 's'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
