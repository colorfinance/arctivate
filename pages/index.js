import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Capacitor } from '@capacitor/core'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [message, setMessage] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [step, setStep] = useState('login') // 'login' | 'otp'
  const router = useRouter()

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from('profiles').select('completed_onboarding').eq('id', user.id).single()
          .then(({ data, error }) => {
             if (error) {
                console.error("Onboarding check error:", error)
                router.push('/train')
             } else if (data && data.completed_onboarding === false) {
                router.push('/onboarding')
             } else {
                router.push('/train')
             }
          })
      } else {
        setCheckingAuth(false)
      }
    })
  }, [])

  const handleSocialLogin = async (provider) => {
    setLoading(true)
    setMessage('')

    if (!isSupabaseConfigured()) {
      setMessage('error: App is not configured. Please set Supabase environment variables.')
      setLoading(false)
      return
    }

    try {
      const isNative = Capacitor.isNativePlatform()

      if (isNative) {
        // On native iOS/Android, use redirect flow via in-app browser
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            skipBrowserRedirect: true,
            redirectTo: 'com.arc.arctivate://callback',
          },
        })

        if (error) {
          setMessage('error: ' + error.message)
          setLoading(false)
          return
        }

        // Open the OAuth URL in the system browser
        if (data?.url) {
          const { Browser } = await import('@capacitor/browser')
          await Browser.open({ url: data.url })
        }
      } else {
        // On web, use standard redirect
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: window.location.origin + '/train',
          },
        })

        if (error) {
          setMessage('error: ' + error.message)
        }
      }
    } catch (err) {
      setMessage('error: ' + (err.message || 'Something went wrong'))
    }
    setLoading(false)
  }

  // Listen for OAuth callback on native
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let cleanup = () => {}

    import('@capacitor/app').then(({ App }) => {
      const listener = App.addListener('appUrlOpen', async ({ url }) => {
        // Handle the OAuth callback
        if (url.includes('callback')) {
          const { Browser } = await import('@capacitor/browser')
          await Browser.close()

          // Extract tokens from the URL hash
          const hashParams = new URLSearchParams(url.split('#')[1] || '')
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            router.push('/train')
          }
        }
      })

      cleanup = () => listener.then(l => l.remove())
    })

    return () => cleanup()
  }, [])

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (!isSupabaseConfigured()) {
      setMessage('error: App is not configured. Please set Supabase environment variables.')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      })

      if (error) {
        setMessage('error: ' + error.message)
      } else {
        setStep('otp')
        setMessage('Check your email for a 6-digit code!')
      }
    } catch (err) {
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setMessage('error: Unable to connect to server. Your Supabase project may be paused — check your Supabase dashboard.')
      } else {
        setMessage('error: ' + (err.message || 'Something went wrong'))
      }
    }
    setLoading(false)
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      })

      if (error) {
        setMessage('error: ' + error.message)
      } else {
        router.push('/train')
      }
    } catch (err) {
      setMessage('error: ' + (err.message || 'Something went wrong'))
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
          {/* Social Login Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleSocialLogin('apple')}
              disabled={loading}
              className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 transition disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
            </button>

            <button
              onClick={() => handleSocialLogin('google')}
              disabled={loading}
              className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-3 active:scale-95 transition disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-arc-muted text-xs uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Email OTP Flow */}
          {step === 'login' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/30 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition placeholder:text-arc-muted"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow active:scale-95 transition disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'SEND CODE'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-arc-muted text-sm mb-2">
                Enter the 6-digit code sent to <span className="text-white">{email}</span>
              </p>
              <input
                type="text"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-black/30 border border-white/10 p-4 rounded-xl text-white text-center text-2xl tracking-[0.5em] outline-none focus:border-arc-accent transition placeholder:text-arc-muted placeholder:tracking-[0.5em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow active:scale-95 transition disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'VERIFY'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('login'); setOtp(''); setMessage(''); }}
                className="w-full text-arc-muted text-sm hover:text-white transition"
              >
                Use a different email
              </button>
            </form>
          )}

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
