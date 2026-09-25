import { admin, userFromRequest, staffGymFor } from '../../../lib/serverAuth'

// The gym's members, with whether each has actually signed in yet. Emails
// come from auth, which only the service role can read, so this is a route
// and not a query.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  let user
  try { user = await userFromRequest(req) } catch { return res.status(503).json({ error: 'Server is not configured for this yet' }) }
  if (!user) return res.status(401).json({ error: 'Sign in first' })
  const gymId = await staffGymFor(user.id)
  if (!gymId) return res.status(403).json({ error: 'Only gym staff can see this' })

  try {
    const { data: members } = await admin()
      .from('profiles').select('id, username, completed_onboarding').eq('gym_id', gymId)
    const ids = new Set((members || []).map(m => m.id))
    const byId = {}
    let page = 1
    while (page <= 10) {
      const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 500 })
      if (error) throw error
      for (const u of data?.users || []) if (ids.has(u.id)) byId[u.id] = u
      if (!data?.users?.length || data.users.length < 500) break
      page += 1
    }
    const rows = (members || []).map(m => {
      const u = byId[m.id]
      return {
        id: m.id,
        name: m.username || (u?.user_metadata?.username) || null,
        email: u?.email || null,
        invited: !!u && !u.last_sign_in_at,
        joined_at: u?.created_at || null,
        onboarded: !!m.completed_onboarding,
      }
    }).sort((a, b) => (b.joined_at || '').localeCompare(a.joined_at || ''))
    return res.status(200).json({ members: rows })
  } catch (e) {
    console.error('clients:', e?.message)
    return res.status(500).json({ error: 'Could not load members' })
  }
}
