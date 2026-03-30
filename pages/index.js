import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isSignUp, setIsSignUp] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setCheckingAuth(false)
      return
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        navigateAfterAuth(user.id)
      } else {
        setCheckingAuth(false)
      }
    })

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

    if (password.length < 6) {
      setMessage('error: Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    try {
      if (isSignUp) {
        // Server-side signup — auto-confirms, no email verification
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, action: 'signup' }),
        })

        const result = await res.json()

        if (!res.ok) {
          if (res.status === 409) {
            setMessage('error: This email is already registered. Tap Sign In below.')
          } else {
            setMessage('error: ' + (result.error || 'Sign up failed'))
          }
          setLoading(false)
          return
        }

        // Account created — now sign in
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setMessage('error: Account created but sign in failed. Try signing in.')
        } else if (data.session) {
          await navigateAfterAuth(data.user.id)
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
          if (error.message === 'Invalid login credentials') {
            setMessage('error: Wrong email or password.')
          } else if (error.message?.includes('Email not confirmed')) {
            // Try re-creating via server to auto-confirm
            setMessage('error: Email not confirmed. Try signing up again.')
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

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-arc-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 pt-20 text-center relative overflow-hidden">
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

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-arc-muted">
          <Link href="/privacy" className="hover:text-white transition underline">Privacy Policy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-white transition underline">Terms of Service</Link>
        </div>

        <div className="mt-4">
          <Link href="/landing" className="text-arc-muted hover:text-white transition text-sm">
            Learn more about Arctivate →
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
