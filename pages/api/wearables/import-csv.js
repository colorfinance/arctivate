import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const supabase = createPagesServerClient({ req, res })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return res.status(401).json({ error: 'Not authenticated' })

    const { data: rows, format } = req.body

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No data provided. Expected { data: [...], format: "csv"|"json" }' })
    }

    const results = { imported: 0, errors: [] }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]

      // Validate required field
      if (!row.date) {
        results.errors.push({ row: i + 1, error: 'Missing date field' })
        continue
      }

      // Build wearable_log entry
      const logEntry = {
        user_id: user.id,
        source: 'csv_import',
        logged_at: row.date,
        hrv: row.hrv ? parseFloat(row.hrv) : null,
        rhr: row.rhr ? parseFloat(row.rhr) : null,
        sleep_hours: row.sleep_hours ? parseFloat(row.sleep_hours) : null,
        sleep_quality: row.sleep_quality || null,
        steps: row.steps ? parseInt(row.steps) : null,
        calories_burned: row.calories_burned ? parseInt(row.calories_burned) : null,
        active_minutes: row.active_minutes ? parseInt(row.active_minutes) : null,
        stress_score: row.stress_score ? parseFloat(row.stress_score) : null,
        spo2: row.spo2 ? parseFloat(row.spo2) : null,
        body_battery: row.body_battery ? parseInt(row.body_battery) : null,
        sleep_deep_hours: row.sleep_deep_hours ? parseFloat(row.sleep_deep_hours) : null,
        sleep_light_hours: row.sleep_light_hours ? parseFloat(row.sleep_light_hours) : null,
        sleep_rem_hours: row.sleep_rem_hours ? parseFloat(row.sleep_rem_hours) : null,
        distance_meters: row.distance_meters ? parseFloat(row.distance_meters) : null,
      }

      const { error: insertError } = await supabase
        .from('wearable_logs')
        .upsert(logEntry, {
          onConflict: 'user_id,source,logged_at',
          ignoreDuplicates: false,
        })

      if (insertError) {
        results.errors.push({ row: i + 1, error: insertError.message })
      } else {
        results.imported++
      }
    }

    // Award points for imported days (3 pts per day, max once per date)
    if (results.imported > 0) {
      const totalPoints = results.imported * 3
      await supabase.rpc('add_points', { p_user_id: user.id, p_points: totalPoints })
    }

    res.status(200).json(results)
  } catch (error) {
    console.error('CSV import error:', error)
    res.status(500).json({ error: 'Import failed' })
  }
}
