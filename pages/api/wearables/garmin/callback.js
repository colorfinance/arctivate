import { createClient } from '@supabase/supabase-js'
import { exchangeForAccessToken, encryptTokens } from '../../../../lib/wearables/garmin'
import { verifyState } from '../../../../lib/wearables/crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { oauth_token, oauth_verifier } = req.query

    if (!oauth_token || !oauth_verifier) {
      return res.redirect('/settings/wearables?error=missing_params')
    }

    // Verify state cookie to get user ID and token secret
    const stateCookie = req.cookies?.wearable_state
    if (!stateCookie) {
      return res.redirect('/settings/wearables?error=expired_session')
    }

    const state = verifyState(stateCookie)
    if (state.provider !== 'garmin') {
      return res.redirect('/settings/wearables?error=invalid_state')
    }

    // Exchange for access token
    const { accessToken, accessTokenSecret } = await exchangeForAccessToken(
      oauth_token,
      state.token_secret,
      oauth_verifier
    )

    // Encrypt and store tokens
    const encrypted = encryptTokens(accessToken, accessTokenSecret)

    const { error: dbError } = await supabaseAdmin
      .from('wearable_connections')
      .upsert({
        user_id: state.user_id,
        provider: 'garmin',
        access_token: encrypted.access_token,
        access_token_secret: encrypted.access_token_secret,
        is_active: true,
        sync_error: null,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' })

    if (dbError) {
      console.error('Garmin callback DB error:', dbError)
      return res.redirect('/settings/wearables?error=save_failed')
    }

    // Award first-connection bonus points
    await supabaseAdmin.rpc('add_points', { p_user_id: state.user_id, p_points: 50 })

    // Log the connection event
    await supabaseAdmin.from('wearable_sync_log').insert({
      user_id: state.user_id,
      provider: 'garmin',
      event_type: 'connected',
      payload: { timestamp: new Date().toISOString() },
    })

    // Clear state cookie
    res.setHeader('Set-Cookie', 'wearable_state=; Path=/; HttpOnly; Secure; Max-Age=0')

    res.redirect('/settings/wearables?connected=garmin')
  } catch (error) {
    console.error('Garmin callback error:', error)
    res.redirect('/settings/wearables?error=connection_failed')
  }
}
