import { createClient } from '@supabase/supabase-js'

// Admin client with service role for user management
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password, action, userId } = req.body

  try {
    if (action === 'signup') {
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' })
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' })
      }

      // Create user with auto-confirm (no email verification needed)
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (error) {
        if (error.message?.includes('already been registered') || error.message?.includes('already exists')) {
          return res.status(409).json({ error: 'This email is already registered. Try signing in.' })
        }
        return res.status(400).json({ error: error.message })
      }

      // Create a profile for the new user
      if (data.user) {
        await supabaseAdmin.from('profiles').upsert({
          id: data.user.id,
          completed_onboarding: false,
        }, { onConflict: 'id', ignoreDuplicates: true })
      }

      return res.status(200).json({ success: true, userId: data.user?.id })
    }

    if (action === 'delete') {
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' })
      }

      // Delete all user data in correct order (respect foreign keys)
      // 1. Delete from tables that reference other user tables first
      await supabaseAdmin.from('habit_logs').delete().eq('user_id', userId)
      await supabaseAdmin.from('personal_bests').delete().eq('user_id', userId)
      await supabaseAdmin.from('workout_logs').delete().eq('user_id', userId)
      await supabaseAdmin.from('high_fives').delete().eq('user_id', userId)
      await supabaseAdmin.from('public_feed').delete().eq('user_id', userId)
      await supabaseAdmin.from('check_ins').delete().eq('user_id', userId)
      await supabaseAdmin.from('food_logs').delete().eq('user_id', userId)
      await supabaseAdmin.from('rewards_ledger').delete().eq('used_by', userId)

      // 2. Delete from tables that other tables reference
      await supabaseAdmin.from('habits').delete().eq('user_id', userId)
      await supabaseAdmin.from('exercises').delete().eq('user_id', userId)

      // 3. Delete profile
      await supabaseAdmin.from('profiles').delete().eq('id', userId)

      // 4. Delete the auth user
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (error) {
        return res.status(400).json({ error: 'Failed to delete auth user: ' + error.message })
      }

      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Invalid action. Use "signup" or "delete".' })
  } catch (err) {
    console.error('Auth API error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
