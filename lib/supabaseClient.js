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
