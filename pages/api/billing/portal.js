import Stripe from 'stripe'
import { admin, userFromRequest, siteOrigin } from '../../../lib/serverAuth'

// Stripe's own page for changing the card or cancelling.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: 'Billing is not switched on yet' })
  let user
  try { user = await userFromRequest(req) } catch { return res.status(503).json({ error: 'Server is not configured for this yet' }) }
  if (!user) return res.status(401).json({ error: 'Sign in first' })
  try {
    const { data: profile } = await admin().from('profiles').select('stripe_customer_id').eq('id', user.id).single()
    if (!profile?.stripe_customer_id) return res.status(400).json({ error: 'No subscription to manage' })
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${siteOrigin(req)}/profile/`,
    })
    return res.status(200).json({ url: session.url })
  } catch (e) {
    console.error('portal:', e?.message)
    return res.status(500).json({ error: 'Could not open billing' })
  }
}
