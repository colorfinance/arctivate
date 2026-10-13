import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isConfigured = !!(supabaseUrl && supabaseAnonKey)

if (!isConfigured && typeof window !== 'undefined') {
  // Surface the misconfiguration loudly in the browser instead of letting
  // every Supabase call fail with a generic auth/network error.
  console.error(
    '[Arctivate] Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and ' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel project / .env.local.'
  )
}

// Build-time fallback so SSG/SSR doesn't crash when env vars are unavailable
// during static analysis. Real runtime calls (browser/server request) are
// gated by `isSupabaseConfigured()` checks at the call sites and the proxy
// below throws with a clear message if the placeholder client is used.
const realClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
)

// Who is signed in, without a trip to the server.
//
// auth.getUser() asks Supabase to check the token on every call. The app
// calls it at the start of nearly every load and every tap -- 8 to 18 times
// on one screen -- and each one is a round trip to Singapore before the real
// query can start. In the browser the session in storage already has the
// user, and getSession() refreshes it when it expires, so reads come from
// there. What a member may see is still decided by RLS on every query; this
// only stops asking the same question over and over. A call with an explicit
// token (as a server would make) still goes to the server.
const verifyUserOnServer = realClient.auth.getUser.bind(realClient.auth)
if (typeof window !== 'undefined') {
  realClient.auth.getUser = async (jwt) => {
    if (jwt) return verifyUserOnServer(jwt)
    const { data, error } = await realClient.auth.getSession()
    if (error) return { data: { user: null }, error }
    return { data: { user: data?.session?.user ?? null }, error: null }
  }
}
export const verifyUser = verifyUserOnServer

const guardedClient = isConfigured
  ? realClient
  : new Proxy(realClient, {
      get(target, prop) {
        // Allow inspection in dev tools without throwing.
        if (typeof window === 'undefined') return target[prop]
        if (prop === 'then') return undefined // not a thenable
        const value = target[prop]
        if (typeof value === 'function') {
          return (...args) => {
            throw new Error(
              '[Arctivate] Supabase is not configured. Set ' +
              'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
            )
          }
        }
        return value
      },
    })

export const supabase = guardedClient

export const isSupabaseConfigured = () => isConfigured
