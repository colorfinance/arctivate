/**
 * Apple Sign In integration with Supabase.
 *
 * On native iOS: uses the Capacitor Sign In with Apple plugin to get an
 * identity token, then exchanges it with Supabase via signInWithIdToken.
 *
 * On web: falls back to Supabase's built-in Apple OAuth redirect flow.
 */

import { supabase } from './supabaseClient'
import { isNative, signInWithAppleNative } from './capacitor'

/**
 * Perform Apple Sign In.
 * - On iOS native: presents the system Apple Sign In dialog, gets the
 *   identity token, and sends it to Supabase.
 * - On web: redirects to Supabase's Apple OAuth flow.
 */
export async function signInWithApple() {
  if (isNative()) {
    return signInWithAppleOnNative()
  }
  return signInWithAppleOnWeb()
}

async function signInWithAppleOnNative() {
  const appleResult = await signInWithAppleNative()

  if (!appleResult.identityToken) {
    throw new Error('Apple Sign In did not return an identity token.')
  }

  // Exchange the Apple identity token for a Supabase session
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: appleResult.identityToken,
  })

  if (error) throw error

  // Update profile with Apple name if available (Apple only sends name on first sign-in)
  if (data.user && (appleResult.givenName || appleResult.familyName)) {
    const fullName = [appleResult.givenName, appleResult.familyName].filter(Boolean).join(' ')
    await supabase.from('profiles').upsert({
      id: data.user.id,
      username: fullName || undefined,
    }, { onConflict: 'id', ignoreDuplicates: false })
  }

  return data
}

async function signInWithAppleOnWeb() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: window.location.origin + '/train',
    },
  })

  if (error) throw error
  return data
}
