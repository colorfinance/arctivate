import { admin, userFromRequest, staffGymFor, siteOrigin } from '../../../lib/serverAuth'

// An owner adds a client: name and email. The client gets Supabase's
// invite email with a link that signs them in; they land in the gym with
// their name already on the profile.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  let user
  try { user = await userFromRequest(req) } catch { return res.status(503).json({ error: 'Server is not configured for this yet' }) }
  if (!user) return res.status(401).json({ error: 'Sign in first' })
  const gymId = await staffGymFor(user.id)
  if (!gymId) return res.status(403).json({ error: 'Only gym staff can add clients' })

  const name = String(req.body?.name || '').trim().slice(0, 60)
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!email.includes('@')) return res.status(400).json({ error: 'Enter a real email address' })
  if (name.length < 2) return res.status(400).json({ error: 'Give them a name' })

  try {
    const { data, error } = await admin().auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteOrigin(req)}/`,
      data: { username: name },
    })
    if (error) {
      if (/already|registered|exists/i.test(error.message || '')) {
        return res.status(409).json({ error: 'They already have an account. Give them the gym code instead.' })
      }
      throw error
    }
    const id = data?.user?.id
    if (id) {
      await admin().from('profiles').upsert(
        { id, username: name, gym_id: gymId, completed_onboarding: false },
        { onConflict: 'id' }
      )
    }
    return res.status(200).json({ ok: true, id })
  } catch (e) {
    console.error('invite:', e?.message)
    return res.status(500).json({ error: 'Could not send the invite' })
  }
}
