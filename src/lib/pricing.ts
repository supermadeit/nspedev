// Pricing tiers for one-time credit refills and monthly subscriptions.
//
// `plan` MUST match both the plan identifier the backend expects in the
// POST /stripe/create-session body and the key in the backend's
// PLAN_PRICE_IDS map (starter/plus/standard/pro).
export interface PricingTier {
  plan: string
  name: string
  price: string
  billingNote?: string
  credits: number
  kind: 'refill' | 'subscription'
  description?: string
  features?: string[]
  highlighted?: boolean
}

export const REFILL_TIERS: PricingTier[] = [
  {
    plan: 'starter',
    name: 'Starter',
    price: '$5',
    credits: 100,
    kind: 'refill',
  },
  {
    plan: 'plus',
    name: 'Plus',
    price: '$10',
    credits: 300,
    kind: 'refill',
  },
]

export const SUBSCRIPTION_TIERS: PricingTier[] = [
  {
    plan: 'standard',
    name: 'Standard',
    price: '$10',
    billingNote: '/mo',
    credits: 1000,
    kind: 'subscription',
    features: [
      '1000 credits every month',
      '25% off refill packs',
      'In-browser terminal access — coming soon',
    ],
  },
  {
    plan: 'pro',
    name: 'Pro',
    price: '$20',
    billingNote: '/mo',
    credits: 2500,
    kind: 'subscription',
    highlighted: true,
    features: [
      '2500 credits every month',
      '50% off refill packs',
      'In-browser terminal access — coming soon',
      'Unlimited terminal searches',
    ],
  },
]

export const PRICING_TIERS: PricingTier[] = [...REFILL_TIERS, ...SUBSCRIPTION_TIERS]
