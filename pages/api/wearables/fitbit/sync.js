import { createClient } from '@supabase/supabase-js'
import {
  decryptTokens,
  encryptTokens,
  refreshAccessToken,
  fetchDailySummary,
  fetchSleepData,
  fetchHeartRate,
  fetchHRV,
  fetchSpO2,
  mapFitbitData,
} from '../../../../lib/wearables/fitbit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Verify cron secret or manual trigger
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const results = { synced: 0, errors: 0 }

  try {
    // Fetch all active Fitbit connections
    const { data: connections, error: fetchError } = await supabaseAdmin
      .from('wearable_connections')
      .select('*')
      .eq('provider', 'fitbit')
      .eq('is_active', true)

    if (fetchError || !connections) {
      return res.status(500).json({ error: 'Failed to fetch connections' })
    }

    const today = new Date().toISOString().split('T')[0]

    for (const conn of connections) {
      try {
        let { accessToken, refreshToken } = decryptTokens(conn)

        // Refresh token if expired
        if (conn.token_expires_at && new Date(conn.token_expires_at) <= new Date()) {
          const refreshed = await refreshAccessToken(refreshToken)
          const encrypted = encryptTokens(refreshed.accessToken, refreshed.refreshToken)
          const newExpiry = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()

          await supabaseAdmin
            .from('wearable_connections')
            .update({
              access_token: encrypted.access_token,
              refresh_token: encrypted.refresh_token,
              token_expires_at: newExpiry,
              updated_at: new Date().toISOString(),
            })
            .eq('id', conn.id)

          accessToken = refreshed.accessToken

          await supabaseAdmin.from('wearable_sync_log').insert({
            user_id: conn.user_id,
            provider: 'fitbit',
            event_type: 'token_refreshed',
          })
        }

        // Fetch data from Fitbit (wrap each in try-catch to handle partial failures)
        let activityData = null, sleepData = null, heartData = null, hrvData = null, spo2Data = null

        try { activityData = await fetchDailySummary(accessToken, today) } catch {}
        try { sleepData = await fetchSleepData(accessToken, today) } catch {}
        try { heartData = await fetchHeartRate(accessToken, today) } catch {}
        try { hrvData = await fetchHRV(accessToken, today) } catch {}
        try { spo2Data = await fetchSpO2(accessToken, today) } catch {}

        // Map to wearable_logs schema
        const logData = mapFitbitData(activityData, sleepData, heartData, hrvData, spo2Data, today)

        // Upsert into wearable_logs
        const { error: upsertError } = await supabaseAdmin
          .from('wearable_logs')
          .upsert({
            user_id: conn.user_id,
            ...logData,
          }, {
            onConflict: 'user_id,source,logged_at',
            ignoreDuplicates: false,
          })

        if (upsertError) throw upsertError

        // Award daily sync points (max once per day)
        const { data: existingPoints } = await supabaseAdmin
          .from('wearable_logs')
          .select('id')
          .eq('user_id', conn.user_id)
          .eq('source', 'fitbit')
          .eq('logged_at', today)
          .gt('points_awarded', 0)
          .limit(1)

        if (!existingPoints || existingPoints.length === 0) {
          await supabaseAdmin.rpc('add_points', { p_user_id: conn.user_id, p_points: 5 })
          await supabaseAdmin
            .from('wearable_logs')
            .update({ points_awarded: 5 })
            .eq('user_id', conn.user_id)
            .eq('source', 'fitbit')
            .eq('logged_at', today)
        }

        // Update connection sync status
        const newStreak = (conn.sync_streak || 0) + 1
        await supabaseAdmin
          .from('wearable_connections')
          .update({
            last_sync_at: new Date().toISOString(),
            sync_error: null,
            sync_streak: newStreak,
            updated_at: new Date().toISOString(),
          })
          .eq('id', conn.id)

        // Check streak milestones
        if (newStreak === 7) {
          await supabaseAdmin.rpc('add_points', { p_user_id: conn.user_id, p_points: 25 })
        } else if (newStreak === 30) {
          await supabaseAdmin.rpc('add_points', { p_user_id: conn.user_id, p_points: 100 })
        }

        await supabaseAdmin.from('wearable_sync_log').insert({
          user_id: conn.user_id,
          provider: 'fitbit',
          event_type: 'poll_completed',
          payload: { date: today },
        })

        results.synced++
      } catch (error) {
        console.error(`Fitbit sync error for user ${conn.user_id}:`, error.message)
        results.errors++

        await supabaseAdmin
          .from('wearable_connections')
          .update({
            sync_error: error.message,
            sync_streak: 0,
            updated_at: new Date().toISOString(),
          })
          .eq('id', conn.id)

        await supabaseAdmin.from('wearable_sync_log').insert({
          user_id: conn.user_id,
          provider: 'fitbit',
          event_type: 'error',
          error_message: error.message,
        })
      }
    }

    res.status(200).json(results)
  } catch (error) {
    console.error('Fitbit sync global error:', error)
    res.status(500).json({ error: 'Sync failed', details: error.message })
  }
}
