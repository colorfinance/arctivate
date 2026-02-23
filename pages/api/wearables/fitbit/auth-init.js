import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { generatePKCE, generateState, getAuthorizationUrl } from '../../../../lib/wearables/fitbit'
import { signState } from '../../../../lib/wearables/crypto'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // Verify authenticated user
    const supabase = createPagesServerClient({ req, res })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return res.status(401).json({ error: 'Not authenticated' })

    // Generate PKCE and state
    const { verifier, challenge } = generatePKCE()
    const oauthState = generateState()

    // Sign state cookie with user ID and PKCE verifier
    const stateCookie = signState({
      user_id: user.id,
      provider: 'fitbit',
      code_verifier: verifier,
      oauth_state: oauthState,
      timestamp: Date.now(),
    })

    // Set encrypted cookie
    res.setHeader('Set-Cookie', `wearable_state=${stateCookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`)

    // Redirect to Fitbit authorization
    const authUrl = getAuthorizationUrl(challenge, oauthState)
    res.redirect(302, authUrl)
  } catch (error) {
    console.error('Fitbit auth-init error:', error)
    res.status(500).json({ error: 'Failed to start Fitbit connection' })
  }
}
