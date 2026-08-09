import { loadStripe, type Stripe } from '@stripe/stripe-js'

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

if (!publishableKey) {
  console.error('Missing VITE_STRIPE_PUBLISHABLE_KEY in your .env file.')
}

// loadStripe returns a singleton promise; created once at module load.
export const stripePromise: Promise<Stripe | null> = loadStripe(publishableKey ?? '')
