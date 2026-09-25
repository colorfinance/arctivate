import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Who pays. A member in a gym is covered by the gym. A member with no gym
// pays for themselves, or uses the free tier. The plan itself is written
// only by Stripe's webhook; the client reads it.

export const PREMIUM_PRICE = '$9.99'

// What a gym pays. The price ids live in the server's env; these are the
// words and numbers the owner sees.
export const GYM_TIERS = {
  gym: { key: 'gym', name: 'Gym', price: '$149', members: 200 },
  gym_large: { key: 'gym_large', name: 'Gym Plus', price: '$299', members: 500 },
}

export const tierFor = (members) => (members > GYM_TIERS.gym.members ? 'gym_large' : 'gym')

// A pilot past its end date is lapsed, whether or not anything has written
// that down yet. A gym whose card failed keeps everything while it is fixed.
export function effectiveGymPlan(gym) {
  if (!gym?.plan) return null
  if (gym.plan === 'pilot' && gym.pilot_ends_at) {
    const today = new Date().toLocaleDateString('en-CA')
    if (gym.pilot_ends_at < today) return 'lapsed'
  }
  return gym.plan
}

export const gymCovers = (gymPlan) => gymPlan === 'pilot' || gymPlan === 'paid' || gymPlan === 'past_due'

export function isEntitled({ plan, gymPlan, isAdmin }) {
  if (isAdmin) return true
  if (plan === 'premium') return true
  return gymCovers(gymPlan)
}

export function usePlan() {
  const [state, setState] = useState({ ready: false, plan: 'free', gymPlan: null, gymName: null, renewsAt: null, entitled: true })
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (alive) setState(s => ({ ...s, ready: true })); return }
        const { data: p } = await supabase.from('profiles').select('plan, plan_renews_at, gym_id, is_admin').eq('id', user.id).single()
        let gym = null
        if (p?.gym_id) {
          const { data: g } = await supabase.from('gyms').select('name, plan, pilot_ends_at').eq('id', p.gym_id).single()
          gym = g
        }
        if (!alive) return
        const next = { ready: true, plan: p?.plan || 'free', gymPlan: effectiveGymPlan(gym), gymName: gym?.name || null, renewsAt: p?.plan_renews_at || null }
        next.entitled = isEntitled({ plan: next.plan, gymPlan: next.gymPlan, isAdmin: !!p?.is_admin })
        setState(next)
      } catch {
        if (alive) setState(s => ({ ...s, ready: true }))
      }
    })()
    return () => { alive = false }
  }, [])
  return state
}

async function bearer() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

// Sends the member to Stripe Checkout. Returns an error message, or null
// once the browser is on its way.
export async function startCheckout() {
  try {
    const res = await fetch('/api/billing/checkout/', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await bearer()) } })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.url) return body.error || 'Could not start checkout'
    window.location.href = body.url
    return null
  } catch {
    return 'Could not reach billing'
  }
}

// The same trip for a gym: the owner picks a tier and pays on the web.
export async function startGymCheckout(tier) {
  try {
    const res = await fetch('/api/billing/gym-checkout/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await bearer()) },
      body: JSON.stringify({ tier }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.url) return body.error || 'Could not start checkout'
    window.location.href = body.url
    return null
  } catch {
    return 'Could not reach billing'
  }
}

// Stripe's own page for the card, the invoices and cancelling. scope 'gym'
// opens the gym's, not the member's.
export async function openBillingPortal(scope) {
  try {
    const res = await fetch('/api/billing/portal/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await bearer()) },
      body: JSON.stringify(scope ? { scope } : {}),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.url) return body.error || 'Could not open billing'
    window.location.href = body.url
    return null
  } catch {
    return 'Could not reach billing'
  }
}
