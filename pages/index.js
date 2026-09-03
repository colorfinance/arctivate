import { useState, useEffect, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import LoadingState from '../components/LoadingState'
import ErrorState from '../components/ErrorState'
import BrandMark from '../components/BrandMark'
import Button from '../components/Button'
import Field from '../components/Field'

// The front door.
//
// This is the only screen a prospective member sees, so it carries the
// brand and one concrete line about what the app is. The form sits in the
// bottom third so the keyboard does not fight it. Sign-up is its own state
// that says what happens next, and there is a way back in when you have
// forgotten your password -- there was not one before.

const COPY = {
  signin: {
    title: 'Welcome back',
    body: 'Sign in to pick up your streak.',
    cta: 'Sign in',
    busy: 'Signing in…',
  },
  signup: {
    title: 'Join your gym',
    body: 'Create an account, join your gym, and pick someone to beat.',
    cta: 'Create account',
    busy: 'Creating account…',
  },
  forgot: {
    title: 'Reset your password',
    body: 'We will email you a link. Open it on this device.',
    cta: 'Send reset link',
    busy: 'Sending…',
  },
  recover: {
    title: 'Choose a new password',
    body: 'At least 6 characters. You will stay signed in.',
    cta: 'Save password',
    busy: 'Saving…',
  },
}

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [mode, setMode] = useState('signin') // signin | signup | forgot | recover
  const modeRef = useRef('signin')
  const router = useRouter()

  const switchMode = (next) => {
    modeRef.current = next
    setMode(next)
    setError('')
    setNotice('')
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setCheckingAuth(false)
      return
    }

    // A recovery link lands here with #type=recovery. Show the new-password
    // form instead of bouncing straight into the app.
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const isRecovery = /type=recovery/.test(hash)
    if (isRecovery) {
      modeRef.current = 'recover'
      setMode('recover')
      setCheckingAuth(false)
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && modeRef.current !== 'recover') {
        navigateAfterAuth(user.id)
      } else {
        setCheckingAuth(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        modeRef.current = 'recover'
        setMode('recover')
        setCheckingAuth(false)
        return
      }
      if (event === 'SIGNED_IN' && session?.user && modeRef.current !== 'recover') {
        navigateAfterAuth(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const navigateAfterAuth = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('completed_onboarding')
        .eq('id', userId)
        .single()

      // Today, not Challenges. Opening the app asks "what do I do today",
      // and the answer is the habit list.
      if (error || !data || data.completed_onboarding === false) {
        router.push(error ? '/habits' : '/onboarding')
      } else {
        router.push('/habits')
      }
    } catch {
      router.push('/habits')
    }
  }

  const validEmail = () => {
    if (!email || !email.includes('@')) {
      setError('Enter the email you signed up with.')
      return false
    }
    return true
  }
  const validPassword = () => {
    if (!password || password.length < 6) {
      setError('Your password needs at least 6 characters.')
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (loading) return
    setError('')
    setNotice('')

    if (mode === 'forgot') {
      if (!validEmail()) return
      setLoading(true)
      try {
        const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
        if (error) setError(error.message)
        else setNotice(`Sent. Check ${email.trim()} for the link.`)
      } catch (err) {
        setError(err.message || 'Something went wrong')
      }
      setLoading(false)
      return
    }

    if (mode === 'recover') {
      if (!validPassword()) return
      setLoading(true)
      try {
        const { data, error } = await supabase.auth.updateUser({ password })
        if (error) setError(error.message)
        else if (data?.user) {
          if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname)
          await navigateAfterAuth(data.user.id)
        }
      } catch (err) {
        setError(err.message || 'Something went wrong')
      }
      setLoading(false)
      return
    }

    if (!validEmail() || !validPassword()) return
    setLoading(true)

    try {
      if (mode === 'signup') {
        // Server-side signup: auto-confirms, no email verification.
        let res
        try {
          res = await fetch('/api/auth/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), password, action: 'signup' }),
          })
        } catch {
          setError('Cannot connect. Check your connection and try again.')
          setLoading(false)
          return
        }

        let result
        try {
          result = await res.json()
        } catch {
          setError('The server returned something unexpected. Try again.')
          setLoading(false)
          return
        }

        if (!res.ok) {
          setError(result.error || 'Sign up failed')
          setLoading(false)
          return
        }

        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) {
          setError('Account created, but sign in failed. Try signing in.')
        } else if (data.session) {
          await navigateAfterAuth(data.user.id)
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) {
          if (error.message === 'Invalid login credentials') {
            setError('Wrong email or password.')
          } else if (error.message?.includes('Email not confirmed')) {
            setError('Email not confirmed. Try signing up again.')
          } else {
            setError(error.message)
          }
        } else if (data.session) {
          await navigateAfterAuth(data.user.id)
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    }
    setLoading(false)
  }

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

  const c = COPY[mode]
  const showEmail = mode !== 'recover'
  const showPasswordField = mode !== 'forgot'

  const eye = (
    <button
      type="button"
      onClick={() => setShowPassword(s => !s)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      className="w-10 h-10 rounded-full flex items-center justify-center text-arc-muted hover:text-white"
    >
      {showPassword ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="m1 1 22 22" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
      )}
    </button>
  )

  return (
    <div className="min-h-[100dvh] flex flex-col relative overflow-hidden bg-arc-bg">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-arc-accent/[0.07] blur-3xl pointer-events-none" />

      {/* Brand: the top of the screen belongs to the mark and one line. */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-6 text-center"
      >
        <BrandMark size={52} />
        <h1 className="t-display text-white mt-5" style={{ fontSize: 32 }}>Arctivate</h1>
        <p className="t-body text-arc-muted mt-2">Your gym, every day.</p>
      </motion.div>

      {/* Form: anchored to the bottom third. */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="relative z-10 w-full max-w-sm mx-auto px-6 pb-8"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
          >
            <h2 className="t-title text-white" style={{ fontSize: 22 }}>{c.title}</h2>
            <p className="t-body text-arc-muted mt-1 mb-5">{c.body}</p>

            <div className="space-y-4">
              {showEmail && (
                <Field
                  label="Email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              )}
              {showPasswordField && (
                <Field
                  label={mode === 'recover' ? 'New password' : 'Password'}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'signin' ? '' : 'At least 6 characters'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  trailing={eye}
                />
              )}
              {mode === 'signin' && (
                <div className="-mt-2 flex justify-end">
                  <button onClick={() => switchMode('forgot')} className="t-caption text-arc-muted hover:text-white transition-colors py-1">Forgot password?</button>
                </div>
              )}

              {error && (
                <p role="alert" className="t-caption font-bold text-arc-danger -mt-1">{error}</p>
              )}
              {notice && (
                <p role="status" className="t-caption font-bold text-arc-success -mt-1">{notice}</p>
              )}

              <Button variant="hero" size="lg" block onClick={handleSubmit} disabled={loading}>
                {loading ? c.busy : c.cta}
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-center text-[13px]">
              {mode === 'signin' && (
                <button onClick={() => switchMode('signup')} className="text-arc-muted hover:text-white transition-colors">
                  New here? <span className="font-bold text-white">Create an account</span>
                </button>
              )}
              {mode === 'signup' && (
                <button onClick={() => switchMode('signin')} className="mx-auto text-arc-muted hover:text-white transition-colors">
                  Already a member? <span className="font-bold text-white">Sign in</span>
                </button>
              )}
              {mode === 'forgot' && (
                <button onClick={() => switchMode('signin')} className="mx-auto text-arc-muted hover:text-white transition-colors">Back to sign in</button>
              )}
              {mode === 'recover' && (
                <button onClick={() => { switchMode('signin'); setPassword('') }} className="mx-auto text-arc-muted hover:text-white transition-colors">Cancel</button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-center gap-3 t-caption text-arc-muted">
          <Link href="/landing" className="hover:text-white transition-colors">About</Link>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
        </div>
      </motion.div>
    </div>
  )
}
