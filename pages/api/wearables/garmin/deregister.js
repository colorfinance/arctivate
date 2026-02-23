import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const body = req.body

    // Garmin sends deregistration notifications when a user revokes access
    const items = body.deregistrations || body.userPermissions || []

    for (const item of items) {
      const userAccessToken = item.userAccessToken
      if (!userAccessToken) continue

      // Find the matching connection
      const { data: connections } = await supabaseAdmin
        .from('wearable_connections')
        .select('id, user_id, access_token')
        .eq('provider', 'garmin')
        .eq('is_active', true)

      if (connections) {
        const { decrypt } = await import('../../../../lib/wearables/crypto')
        for (const conn of connections) {
          try {
            const decrypted = decrypt(conn.access_token)
            if (decrypted === userAccessToken) {
              // Deactivate connection
              await supabaseAdmin
                .from('wearable_connections')
                .update({
                  is_active: false,
                  sync_error: 'User revoked access from Garmin',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', conn.id)

              await supabaseAdmin.from('wearable_sync_log').insert({
                user_id: conn.user_id,
                provider: 'garmin',
                event_type: 'deregistered',
                payload: { timestamp: new Date().toISOString() },
              })
              break
            }
          } catch {
            continue
          }
        }
      }
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Garmin deregister error:', error)
    res.status(200).json({ ok: true })
  }
}
