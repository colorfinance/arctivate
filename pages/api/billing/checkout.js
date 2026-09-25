import Stripe from 'stripe'
import { admin, userFromRequest, siteOrigin } from '../../../lib/serverAuth'

// Starts a Premium subscription. The member comes back to Profile either
// way; the webhook, not this route, is what marks them premium.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_PREMIUM) {
    return res.status(503).json({ error: 'Billing is not switched on yet' })
  }
  let user
  try { user = await userFromRequest(req) } catch { return res.status(503).json({ error: 'Server is not configured for this yet' }) }
  if (!user) return res.status(401).json({ error: 'Sign in first' })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const origin = siteOrigin(req)

  try {
    const { data: profile } = await admin()
      .from('profiles').select('stripe_customer_id, plan, username').eq('id', user.id).single()
    if (profile?.plan === 'premium') return res.status(400).json({ error: 'You are already on Premium' })

    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: profile?.username || undefined,
        metadata: { user_id: user.id },
      })
      customerId = customer.id
      await admin().from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_PREMIUM, quantity: 1 }],
      success_url: `${origin}/profile/?billing=success`,
      cancel_url: `${origin}/profile/`,
      client_reference_id: user.id,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
    })
    return res.status(200).json({ url: session.url })
  } catch (e) {
    console.error('checkout:', e?.message)
    return res.status(500).json({ error: 'Could not start checkout' })
  }
}
