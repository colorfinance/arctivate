import Stripe from 'stripe'
import { admin } from '../../../lib/serverAuth'
import { tierForPrice, periodEnd, priceOf } from '../../../lib/billingServer'

// Stripe tells us what happened; we write the plan. This is the only
// writer of the plan columns, which triggers protect from everyone else.
// Two kinds of customer come through here: a member paying for Premium,
// and a gym paying for its members.
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

async function setGymPlan({ gymId, customerId, plan, tier, subscriptionId, renewsAt }) {
  if (plan) {
    const patch = { plan }
    if (tier) patch.plan_tier = tier
    const { error } = await admin().from('gyms').update(patch).eq('id', gymId)
    if (error) throw error
  }
  const billing = { gym_id: gymId, updated_at: new Date().toISOString() }
  if (customerId) billing.stripe_customer_id = customerId
  if (subscriptionId !== undefined) billing.stripe_subscription_id = subscriptionId
  if (renewsAt !== undefined) billing.renews_at = renewsAt
  const { error } = await admin().from('gym_billing').upsert(billing)
  if (error) throw error
}

// Which gym an event is about, if any: the metadata we set at checkout, or
// the customer we created for the gym.
async function gymFor(obj) {
  if (obj?.metadata?.gym_id) return obj.metadata.gym_id
  if (!obj?.customer) return null
  const { data } = await admin().from('gym_billing').select('gym_id').eq('stripe_customer_id', obj.customer).maybeSingle()
  return data?.gym_id || null
}

const planFor = (status) =>
  status === 'active' || status === 'trialing' ? 'premium'
  : status === 'past_due' || status === 'unpaid' ? 'past_due'
  : 'free'

// 'incomplete' is a first payment still in flight; it must not end a
// gym's pilot, so it changes nothing.
const gymPlanFor = (status) =>
  status === 'active' || status === 'trialing' ? 'paid'
  : status === 'past_due' || status === 'unpaid' ? 'past_due'
  : status === 'incomplete' ? null
  : 'lapsed'

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
        const sub = s.subscription ? await stripe.subscriptions.retrieve(s.subscription) : null
        const gymId = s.metadata?.kind === 'gym' ? await gymFor(s) : null
        if (gymId) {
          await setGymPlan({
            gymId,
            customerId: s.customer,
            plan: 'paid',
            tier: tierForPrice(priceOf(sub)) || s.metadata?.tier || null,
            subscriptionId: s.subscription || null,
            renewsAt: periodEnd(sub),
          })
        } else {
          const userId = s.metadata?.user_id || s.client_reference_id || null
          await setPlan({ userId, customerId: s.customer, plan: 'premium', subscriptionId: s.subscription || null, renewsAt: periodEnd(sub) })
        }
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = event.data.object
        const gymId = await gymFor(sub)
        if (gymId) {
          await setGymPlan({
            gymId,
            customerId: sub.customer,
            plan: gymPlanFor(sub.status),
            tier: tierForPrice(priceOf(sub)),
            subscriptionId: sub.id,
            renewsAt: periodEnd(sub),
          })
        } else {
          await setPlan({
            userId: sub.metadata?.user_id || null,
            customerId: sub.customer,
            plan: planFor(sub.status),
            subscriptionId: sub.id,
            renewsAt: periodEnd(sub),
          })
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const gymId = await gymFor(sub)
        if (gymId) {
          await setGymPlan({ gymId, customerId: sub.customer, plan: 'lapsed', subscriptionId: null, renewsAt: null })
        } else {
          await setPlan({ userId: sub.metadata?.user_id || null, customerId: sub.customer, plan: 'free', subscriptionId: null, renewsAt: null })
        }
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
