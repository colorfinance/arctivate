import { createClient } from '@supabase/supabase-js'

// Server-side helpers for API routes. The admin client bypasses RLS, so
// every route that uses it must first prove who is calling with the bearer
// token the app sends, and then check that person's rights itself.

let _admin = null
export function admin() {
  if (_admin) return _admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return _admin
}

export async function userFromRequest(req) {
  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const { data, error } = await admin().auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

// The gym this person runs, or null.
export async function staffGymFor(userId) {
  const { data } = await admin()
    .from('gym_staff').select('gym_id, role').eq('user_id', userId).limit(1).maybeSingle()
  if (data?.gym_id) return data.gym_id
  const { data: p } = await admin().from('profiles').select('is_admin, gym_id').eq('id', userId).single()
  return p?.is_admin ? p.gym_id : null
}

export function siteOrigin(req) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return host ? `${proto}://${host}` : 'https://arctivate.vercel.app'
}

// The gym this person owns, or null. Billing is the owner's; a coach on
// the staff sees the plan but does not change it. An admin stands in for
// the owner of their own gym.
export async function ownedGymFor(userId) {
  const { data } = await admin()
    .from('gym_staff').select('gym_id').eq('user_id', userId).eq('role', 'owner').limit(1).maybeSingle()
  if (data?.gym_id) return data.gym_id
  const { data: p } = await admin().from('profiles').select('is_admin, gym_id').eq('id', userId).single()
  return p?.is_admin ? p.gym_id : null
}
