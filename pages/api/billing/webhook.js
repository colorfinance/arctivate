import Stripe from 'stripe'
import { admin } from '../../../lib/serverAuth'

// Stripe tells us what happened; we write the plan. This is the only
// writer of the plan columns, which a trigger protects from everyone else.
export const config = { api: { bodyParser: false } }

function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function setPlan({ userId, customerId, plan, subscriptionId, renewsAt }) {
  const patch = { plan }
  if (subscriptionId !== undefined) patch.stripe_subscription_id = subscriptionId
  if (renewsAt !== undefined) patch.plan_renews_at = renewsAt
  let q = admin().from('profiles').update(patch)
  q = userId ? q.eq('id', userId) : q.eq('stripe_customer_id', customerId)
  const { error } = await q
  if (error) throw error
}

const planFor = (status) =>
  status === 'active' || status === 'trialing' ? 'premium'
  : status === 'past_due' || status === 'unpaid' ? 'past_due'
  : 'free'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).end()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  let event
  try {
    const sig = req.headers['stripe-signature']
    event = stripe.webhooks.constructEvent(await rawBody(req), sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (e) {
    return res.status(400).send(`Webhook error: ${e.message}`)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object
        const userId = s.metadata?.user_id || s.client_reference_id || null
        let renewsAt
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(s.subscription)
          renewsAt = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
        }
        await setPlan({ userId, customerId: s.customer, plan: 'premium', subscriptionId: s.subscription || null, renewsAt })
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object
        await setPlan({
          userId: sub.metadata?.user_id || null,
          customerId: sub.customer,
          plan: planFor(sub.status),
          subscriptionId: sub.id,
          renewsAt: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        })
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await setPlan({ userId: sub.metadata?.user_id || null, customerId: sub.customer, plan: 'free', subscriptionId: null, renewsAt: null })
        break
      }
      default:
        break
    }
    return res.status(200).json({ received: true })
  } catch (e) {
    console.error('webhook:', event.type, e?.message)
    return res.status(500).json({ error: 'Could not apply that event' })
  }
}
