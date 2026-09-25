// Stripe details shared by the billing routes. Server only.

// A gym tier's Stripe price, from the env. Null when that tier is not set up.
export function gymPriceFor(tier) {
  if (tier === 'gym') return process.env.STRIPE_PRICE_GYM || null
  if (tier === 'gym_large') return process.env.STRIPE_PRICE_GYM_LARGE || null
  return null
}

// The other way round, so a tier change made in Stripe's portal lands on
// the gym.
export function tierForPrice(priceId) {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_GYM) return 'gym'
  if (priceId === process.env.STRIPE_PRICE_GYM_LARGE) return 'gym_large'
  return null
}

// Newer Stripe API versions keep the period on the subscription item.
export function periodEnd(sub) {
  const end = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end
  return end ? new Date(end * 1000).toISOString() : null
}

export const priceOf = (sub) => sub?.items?.data?.[0]?.price?.id || null
