import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Who pays. A member in a gym is covered by the gym. A member with no gym
// pays for themselves, or uses the free tier. The plan itself is written
// only by Stripe's webhook; the client reads it.

export const PREMIUM_PRICE = '$9.99'

export function isEntitled({ plan, gymPlan, isAdmin }) {
  if (isAdmin) return true
  if (plan === 'premium') return true
  return gymPlan === 'pilot' || gymPlan === 'paid'
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
          const { data: g } = await supabase.from('gyms').select('name, plan').eq('id', p.gym_id).single()
          gym = g
        }
        if (!alive) return
        const next = { ready: true, plan: p?.plan || 'free', gymPlan: gym?.plan || null, gymName: gym?.name || null, renewsAt: p?.plan_renews_at || null }
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

export async function openBillingPortal() {
  try {
    const res = await fetch('/api/billing/portal/', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await bearer()) } })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.url) return body.error || 'Could not open billing'
    window.location.href = body.url
    return null
  } catch {
    return 'Could not reach billing'
  }
}
