import Stripe from 'stripe'
import { admin, userFromRequest, ownedGymFor, siteOrigin } from '../../../lib/serverAuth'

// Stripe's own page for changing the card, the tier, or cancelling. With
// { scope: 'gym' } it opens the gym's billing, for the gym's owner.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Billing is not switched on yet' })
  let user
  try { user = await userFromRequest(req) } catch { return res.status(503).json({ error: 'Server is not configured for this yet' }) }
  if (!user) return res.status(401).json({ error: 'Sign in first' })
  const forGym = req.body?.scope === 'gym'
  try {
    let customerId = null
    if (forGym) {
      const gymId = await ownedGymFor(user.id)
      if (!gymId) return res.status(403).json({ error: 'Only the owner can manage the gym plan' })
      const { data: billing } = await admin().from('gym_billing').select('stripe_customer_id').eq('gym_id', gymId).maybeSingle()
      customerId = billing?.stripe_customer_id || null
    } else {
      const { data: profile } = await admin().from('profiles').select('stripe_customer_id').eq('id', user.id).single()
      customerId = profile?.stripe_customer_id || null
    }
    if (!customerId) return res.status(400).json({ error: 'No subscription to manage' })
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteOrigin(req)}/${forGym ? 'gym' : 'profile'}/`,
    })
    return res.status(200).json({ url: session.url })
  } catch (e) {
    console.error('portal:', e?.message)
    return res.status(500).json({ error: 'Could not open billing' })
  }
}
