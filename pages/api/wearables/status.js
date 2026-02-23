import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const supabase = createPagesServerClient({ req, res })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return res.status(401).json({ error: 'Not authenticated' })

    // Fetch connections (RLS will filter to current user)
    const { data: connections, error } = await supabase
      .from('wearable_connections')
      .select('id, provider, is_active, last_sync_at, sync_error, sync_streak, created_at')
      .eq('user_id', user.id)

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch connections' })
    }

    // Build status map
    const status = {
      garmin: { connected: false, lastSync: null, error: null, streak: 0 },
      fitbit: { connected: false, lastSync: null, error: null, streak: 0 },
      apple: { connected: false, lastSync: null, error: null, streak: 0, comingSoon: true },
    }

    for (const conn of connections || []) {
      if (status[conn.provider]) {
        status[conn.provider] = {
          connected: conn.is_active,
          lastSync: conn.last_sync_at,
          error: conn.sync_error,
          streak: conn.sync_streak || 0,
          connectedAt: conn.created_at,
        }
      }
    }

    // Fetch recent sync logs
    const { data: syncLogs } = await supabase
      .from('wearable_sync_log')
      .select('provider, event_type, error_message, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    res.status(200).json({ status, recentSyncs: syncLogs || [] })
  } catch (error) {
    console.error('Wearable status error:', error)
    res.status(500).json({ error: 'Failed to get status' })
  }
}
