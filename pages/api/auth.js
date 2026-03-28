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

  const { email, password, action } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  try {
    if (action === 'signup') {
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

    return res.status(400).json({ error: 'Invalid action. Use "signup".' })
  } catch (err) {
    console.error('Auth API error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
