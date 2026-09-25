import Stripe from 'stripe'
import { admin, userFromRequest, ownedGymFor, siteOrigin } from '../../../lib/serverAuth'
import { gymPriceFor } from '../../../lib/billingServer'

// Starts the gym's subscription. Only the owner can, and the gym is the
// Stripe customer, not the owner, so the invoices carry the gym's name. The
// webhook, not this route, is what marks the gym paid.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const tier = req.body?.tier === 'gym_large' ? 'gym_large' : 'gym'
  const price = gymPriceFor(tier)
  if (!process.env.STRIPE_SECRET_KEY || !price) {
    return res.status(503).json({ error: 'Billing is not switched on yet' })
  }
  let user
  try { user = await userFromRequest(req) } catch { return res.status(503).json({ error: 'Server is not configured for this yet' }) }
  if (!user) return res.status(401).json({ error: 'Sign in first' })

  try {
    const gymId = await ownedGymFor(user.id)
    if (!gymId) return res.status(403).json({ error: 'Only the owner can choose the gym plan' })

    const { data: gym } = await admin().from('gyms').select('id, name, plan').eq('id', gymId).single()
    const { data: billing } = await admin().from('gym_billing').select('stripe_customer_id, stripe_subscription_id').eq('gym_id', gymId).maybeSingle()
    if ((gym?.plan === 'paid' || gym?.plan === 'past_due') && billing?.stripe_subscription_id) {
      return res.status(400).json({ error: 'The gym already has a plan. Use Manage to change it.' })
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    let customerId = billing?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: gym?.name || undefined,
        metadata: { gym_id: gymId, owner_id: user.id },
      })
      customerId = customer.id
      const { error } = await admin().from('gym_billing')
        .upsert({ gym_id: gymId, stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      if (error) throw error
    }

    const origin = siteOrigin(req)
    const meta = { kind: 'gym', gym_id: gymId, tier }
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin}/gym/?billing=success`,
      cancel_url: `${origin}/gym/`,
      client_reference_id: gymId,
      metadata: meta,
      subscription_data: { metadata: meta },
      allow_promotion_codes: true,
    })
    return res.status(200).json({ url: session.url })
  } catch (e) {
    console.error('gym-checkout:', e?.message)
    return res.status(500).json({ error: 'Could not start checkout' })
  }
}
