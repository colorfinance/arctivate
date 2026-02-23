import { createClient } from '@supabase/supabase-js'
import { mergeGarminData } from '../../../../lib/wearables/garmin'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const body = req.body

    // Process each data type that Garmin may send
    const dataTypes = ['dailies', 'sleeps', 'activities', 'bodyComps', 'stressDetails', 'userMetrics']

    for (const dataType of dataTypes) {
      const items = body[dataType]
      if (!items || !Array.isArray(items)) continue

      for (const item of items) {
        const userAccessToken = item.userAccessToken
        if (!userAccessToken) continue

        // Look up user by their Garmin access token
        const { data: connections } = await supabaseAdmin
          .from('wearable_connections')
          .select('id, user_id, access_token')
          .eq('provider', 'garmin')
          .eq('is_active', true)

        // Find the matching connection (tokens are encrypted, so we need to check)
        let matchedConnection = null
        if (connections) {
          const { decrypt } = await import('../../../../lib/wearables/crypto')
          for (const conn of connections) {
            try {
              const decrypted = decrypt(conn.access_token)
              if (decrypted === userAccessToken) {
                matchedConnection = conn
                break
              }
            } catch {
              continue
            }
          }
        }

        if (!matchedConnection) {
          console.warn('Garmin webhook: no matching connection for token')
          continue
        }

        const userId = matchedConnection.user_id
        const date = item.calendarDate || item.summaryDate || new Date().toISOString().split('T')[0]

        // Build the wearable log data
        const logData = mergeGarminData(
          dataType === 'dailies' ? item : null,
          dataType === 'sleeps' ? item : null,
          dataType === 'userMetrics' ? item : null,
          item
        )

        // Upsert into wearable_logs
        const { error: upsertError } = await supabaseAdmin
          .from('wearable_logs')
          .upsert({
            user_id: userId,
            ...logData,
            logged_at: date,
          }, {
            onConflict: 'user_id,source,logged_at',
            ignoreDuplicates: false,
          })

        if (upsertError) {
          console.error('Garmin webhook upsert error:', upsertError)
          // Log error but continue processing other items
          await supabaseAdmin.from('wearable_sync_log').insert({
            user_id: userId,
            provider: 'garmin',
            event_type: 'error',
            error_message: upsertError.message,
            payload: { dataType, date },
          })
          continue
        }

        // Award daily sync points (max once per day)
        const { data: existingPoints } = await supabaseAdmin
          .from('wearable_logs')
          .select('id')
          .eq('user_id', userId)
          .eq('source', 'garmin')
          .eq('logged_at', date)
          .gt('points_awarded', 0)
          .limit(1)

        if (!existingPoints || existingPoints.length === 0) {
          await supabaseAdmin.rpc('add_points', { p_user_id: userId, p_points: 5 })
          await supabaseAdmin
            .from('wearable_logs')
            .update({ points_awarded: 5 })
            .eq('user_id', userId)
            .eq('source', 'garmin')
            .eq('logged_at', date)
        }

        // Update connection sync status
        await supabaseAdmin
          .from('wearable_connections')
          .update({
            last_sync_at: new Date().toISOString(),
            sync_error: null,
            sync_streak: matchedConnection.sync_streak ? matchedConnection.sync_streak + 1 : 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', matchedConnection.id)

        // Log successful sync
        await supabaseAdmin.from('wearable_sync_log').insert({
          user_id: userId,
          provider: 'garmin',
          event_type: 'webhook_received',
          payload: { dataType, date },
        })
      }
    }

    // Return 200 immediately (Garmin expects fast response)
    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('Garmin webhook error:', error)
    // Still return 200 to prevent Garmin from retrying
    res.status(200).json({ ok: true })
  }
}
