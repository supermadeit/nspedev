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

// `plan: 'standard'` is kept as-is even though the displayed name changed —
// it's the identifier the backend's PLAN_PRICE_IDS map and /stripe/
// create-session actually key off, not just a label. Renaming it here
// without a matching backend change would break checkout for this tier.
const ESSENTIAL_TIER: PricingTier = {
  plan: 'standard',
  name: 'Essential',
  price: '$10',
  billingNote: '/mo',
  credits: 5000,
  kind: 'subscription',
  features: [
    '5,000 credits every month',
    '25% off refill packs',
    'In-browser terminal access — coming soon',
  ],
}

// Shelved, not deleted — hidden from SUBSCRIPTION_TIERS below per "remove/
// hide the $20 Pro option for now." Kept here (not exported to any active
// list) so it's a one-line change to bring back rather than a rebuild.
const PRO_TIER_SHELVED: PricingTier = {
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
}
void PRO_TIER_SHELVED

export const SUBSCRIPTION_TIERS: PricingTier[] = [ESSENTIAL_TIER]

export const PRICING_TIERS: PricingTier[] = [...REFILL_TIERS, ...SUBSCRIPTION_TIERS]
