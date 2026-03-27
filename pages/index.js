import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { signInWithApple } from '../lib/appleAuth'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isSignUp, setIsSignUp] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if already logged in (session persists automatically)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        navigateAfterAuth(user.id)
      } else {
        setCheckingAuth(false)
      }
    })

    // Listen for auth state changes (handles OAuth redirects, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        navigateAfterAuth(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const navigateAfterAuth = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('completed_onboarding')
        .eq('id', userId)
        .single()

      if (error || !data || data.completed_onboarding === false) {
        router.push(error ? '/train' : '/onboarding')
      } else {
        router.push('/train')
      }
    } catch {
      router.push('/train')
    }
  }

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (!isSupabaseConfigured()) {
      setMessage('error: App is not configured.')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setMessage('error: Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) {
          setMessage('error: ' + error.message)
        } else if (data.user && !data.session) {
          // Email confirmation required
          setMessage('Check your email to confirm your account!')
        } else if (data.session) {
          // Auto-confirmed, navigate
          await navigateAfterAuth(data.user.id)
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          if (error.message === 'Invalid login credentials') {
            setMessage('error: Wrong email or password. Need an account? Tap Sign Up below.')
          } else {
            setMessage('error: ' + error.message)
          }
        } else if (data.session) {
          await navigateAfterAuth(data.user.id)
        }
      }
    } catch (err) {
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setMessage('error: Unable to connect. Check your internet connection.')
      } else {
        setMessage('error: ' + (err.message || 'Something went wrong'))
      }
    }
    setLoading(false)
  }

  const handleAppleSignIn = async () => {
    setAppleLoading(true)
    setMessage('')

    if (!isSupabaseConfigured()) {
      setMessage('error: App is not configured.')
      setAppleLoading(false)
      return
    }

    try {
      const data = await signInWithApple()
      if (data?.session || data?.user) {
        await navigateAfterAuth(data.user?.id || data.session?.user?.id)
      }
    } catch (err) {
      if (err.message?.includes('canceled') || err.message?.includes('cancelled') || err.code === '1001') {
        // User cancelled — do nothing
      } else {
        setMessage('error: ' + (err.message || 'Apple Sign In failed'))
      }
    }
    setAppleLoading(false)
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-arc-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 pt-20 text-center relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-radial from-arc-accent/10 via-transparent to-transparent opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm"
      >
        <h1 className="text-5xl font-black italic tracking-tighter mb-2 text-white">ARCTIVATE</h1>
        <p className="text-arc-muted mb-8">Gamify Your Discipline</p>

        <div className="glass-panel p-8 rounded-2xl w-full shadow-glass">
          {/* Apple Sign In Button */}
          <button
            onClick={handleAppleSignIn}
            disabled={appleLoading}
            className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-4 rounded-xl active:scale-95 transition disabled:opacity-50 mb-4"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            {appleLoading ? 'Signing in...' : 'Sign in with Apple'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-arc-muted text-xs uppercase">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Email + Password */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/30 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition placeholder:text-arc-muted"
              required
              autoComplete="email"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/30 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition placeholder:text-arc-muted"
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow active:scale-95 transition disabled:opacity-50"
            >
              {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN')}
            </button>
          </form>

          {/* Toggle sign in / sign up */}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
            className="mt-4 text-arc-muted text-sm hover:text-white transition"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>

          {message && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`mt-4 text-sm font-bold ${message.startsWith('error:') ? 'text-red-400' : 'text-green-400'}`}
            >
              {message.startsWith('error:') ? message.slice(7) : message}
            </motion.div>
          )}
        </div>

        <div className="mt-8">
          <Link href="/landing" className="text-arc-muted hover:text-white transition text-sm">
            Learn more about Arctivate →
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
