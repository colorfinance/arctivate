import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const supabase = createPagesServerClient({ req, res })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return res.status(401).json({ error: 'Not authenticated' })

    const { provider } = req.body
    if (!provider || !['garmin', 'fitbit', 'apple'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' })
    }

    // Deactivate the connection
    const { error } = await supabase
      .from('wearable_connections')
      .update({
        is_active: false,
        sync_error: null,
        access_token: null,
        access_token_secret: null,
        refresh_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (error) {
      return res.status(500).json({ error: 'Failed to disconnect' })
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Disconnect error:', error)
    res.status(500).json({ error: 'Failed to disconnect' })
  }
}
