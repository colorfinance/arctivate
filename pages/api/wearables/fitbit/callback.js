import { createClient } from '@supabase/supabase-js'
import { exchangeCodeForTokens, encryptTokens } from '../../../../lib/wearables/fitbit'
import { verifyState } from '../../../../lib/wearables/crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { code, state: oauthState } = req.query

    if (!code || !oauthState) {
      return res.redirect('/settings/wearables?error=missing_params')
    }

    // Verify state cookie
    const stateCookie = req.cookies?.wearable_state
    if (!stateCookie) {
      return res.redirect('/settings/wearables?error=expired_session')
    }

    const state = verifyState(stateCookie)
    if (state.provider !== 'fitbit' || state.oauth_state !== oauthState) {
      return res.redirect('/settings/wearables?error=invalid_state')
    }

    // Exchange code for tokens
    const { accessToken, refreshToken, expiresIn, userId: fitbitUserId } =
      await exchangeCodeForTokens(code, state.code_verifier)

    // Encrypt and store tokens
    const encrypted = encryptTokens(accessToken, refreshToken)
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

    const { error: dbError } = await supabaseAdmin
      .from('wearable_connections')
      .upsert({
        user_id: state.user_id,
        provider: 'fitbit',
        access_token: encrypted.access_token,
        refresh_token: encrypted.refresh_token,
        token_expires_at: expiresAt,
        provider_user_id: fitbitUserId,
        is_active: true,
        sync_error: null,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,provider' })

    if (dbError) {
      console.error('Fitbit callback DB error:', dbError)
      return res.redirect('/settings/wearables?error=save_failed')
    }

    // Award first-connection bonus points
    await supabaseAdmin.rpc('add_points', { p_user_id: state.user_id, p_points: 50 })

    // Log connection event
    await supabaseAdmin.from('wearable_sync_log').insert({
      user_id: state.user_id,
      provider: 'fitbit',
      event_type: 'connected',
      payload: { fitbitUserId, timestamp: new Date().toISOString() },
    })

    // Clear state cookie
    res.setHeader('Set-Cookie', 'wearable_state=; Path=/; HttpOnly; Secure; Max-Age=0')

    res.redirect('/settings/wearables?connected=fitbit')
  } catch (error) {
    console.error('Fitbit callback error:', error)
    res.redirect('/settings/wearables?error=connection_failed')
  }
}
