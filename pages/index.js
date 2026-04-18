import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import Link from 'next/link'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isSignUp, setIsSignUp] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
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

  const handleSubmit = async () => {
    if (loading) return
    setLoading(true)
    setMessage('')

    // Validate locally
    if (!email || !email.includes('@')) {
      setMessage('error: Please enter a valid email address.')
      setLoading(false)
      return
    }
    if (!password || password.length < 6) {
      setMessage('error: Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    if (isSignUp && !acceptedTerms) {
      setMessage('error: Please agree to the Terms of Service and Community Rules to create an account.')
      setLoading(false)
      return
    }

    try {
      if (isSignUp) {
        // Server-side signup — auto-confirms, no email verification
        let res
        try {
          res = await fetch('/api/auth/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), password, action: 'signup' }),
          })
        } catch (fetchErr) {
          setMessage('error: Cannot connect to server. Check your connection.')
          setLoading(false)
          return
        }

        let result
        try {
          result = await res.json()
        } catch {
          setMessage('error: Server returned an invalid response. Please try again.')
          setLoading(false)
          return
        }

        if (!res.ok) {
          setMessage('error: ' + (result.error || 'Sign up failed'))
          setLoading(false)
          return
        }

        // Account created — now sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) {
          setMessage('error: Account created but sign in failed. Try signing in.')
        } else if (data.session) {
          await navigateAfterAuth(data.user.id)
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) {
          if (error.message === 'Invalid login credentials') {
            setMessage('error: Wrong email or password.')
          } else if (error.message?.includes('Email not confirmed')) {
            setMessage('error: Email not confirmed. Try signing up again.')
          } else {
            setMessage('error: ' + error.message)
          }
        } else if (data.session) {
          await navigateAfterAuth(data.user.id)
        }
      }
    } catch (err) {
      setMessage('error: ' + (err.message || 'Something went wrong'))
    }
    setLoading(false)
  }

  // Allow Enter key to submit
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  if (checkingAuth) {
    return <LoadingState label="Checking session…" />
  }

  if (!isSupabaseConfigured()) {
    return (
      <ErrorState
        title="App not configured"
        message="Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then reload."
      />
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
          <div className="space-y-3">
            <input
              type="text"
              inputMode="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-black/30 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition placeholder:text-arc-muted"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-black/30 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition placeholder:text-arc-muted"
            />
            {isSignUp && (
              <label className="flex items-start gap-3 text-left text-xs text-arc-muted cursor-pointer select-none px-1 pt-1">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-arc-accent shrink-0"
                />
                <span>
                  I am at least 17 years old and I agree to the{' '}
                  <Link href="/terms" className="text-arc-accent underline">Terms of Service</Link>,{' '}
                  <Link href="/privacy" className="text-arc-accent underline">Privacy Policy</Link>, and the
                  zero-tolerance community rules against hate speech, harassment,
                  and other objectionable content.
                </span>
              </label>
            )}
            <button
              onClick={handleSubmit}
              disabled={loading || (isSignUp && !acceptedTerms)}
              className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow active:scale-95 transition disabled:opacity-50"
            >
              {loading ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN')}
            </button>
          </div>

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

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-arc-muted flex-wrap">
          <Link href="/privacy" className="hover:text-white transition underline">Privacy Policy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-white transition underline">Terms of Service</Link>
          <span>·</span>
          <Link href="/support" className="hover:text-white transition underline">Support</Link>
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
