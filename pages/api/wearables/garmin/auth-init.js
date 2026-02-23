import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { getRequestToken, getAuthorizationUrl } from '../../../../lib/wearables/garmin'
import { signState } from '../../../../lib/wearables/crypto'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Verify authenticated user
    const supabase = createPagesServerClient({ req, res })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return res.status(401).json({ error: 'Not authenticated' })

    // Get request token from Garmin
    const callbackUrl = process.env.GARMIN_CALLBACK_URL
      || `${req.headers.origin || process.env.NEXT_PUBLIC_BASE_URL}/api/wearables/garmin/callback`
    const { token, tokenSecret } = await getRequestToken(callbackUrl)

    // Sign state cookie with user ID and request token secret
    const state = signState({
      user_id: user.id,
      provider: 'garmin',
      token_secret: tokenSecret,
      timestamp: Date.now(),
    })

    // Set encrypted cookie (httpOnly, secure, 10 min expiry)
    res.setHeader('Set-Cookie', `wearable_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)

    // Redirect to Garmin authorization
    const authUrl = getAuthorizationUrl(token)
    res.redirect(302, authUrl)
  } catch (error) {
    console.error('Garmin auth-init error:', error)
    res.status(500).json({ error: 'Failed to start Garmin connection' })
  }
}
