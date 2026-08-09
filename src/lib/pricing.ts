// Pricing tiers for credit refills.
//
// TODO: Confirm final credits/prices with backend. `plan` MUST match the plan
// identifier the backend expects in the POST /stripe/create-session body.
export interface PricingTier {
  plan: string
  name: string
  price: string
  credits: number
  description: string
  highlighted?: boolean
}

export const PRICING_TIERS: PricingTier[] = [
  {
    plan: 'starter',
    name: 'Starter',
    price: '$5',
    credits: 100,
    description: 'Enough to explore. Great for casual lookups.',
  },
  {
    plan: 'pro',
    name: 'Pro',
    price: '$15',
    credits: 400,
    description: 'For regular users running daily queries.',
    highlighted: true,
  },
  {
    plan: 'power',
    name: 'Power',
    price: '$40',
    credits: 1200,
    description: 'Heavy usage with the best per-credit rate.',
  },
  {
    plan: 'team',
    name: 'Team',
    price: '$100',
    credits: 3500,
    description: 'Bulk credits for teams and power workflows.',
  },
]
