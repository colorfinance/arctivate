import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
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

  const handleLogin = async (e) => {
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
          emailRedirectTo: window.location.origin + '/train',
        },
      })

      if (error) {
        setMessage('error: ' + error.message)
      } else {
        setMessage('Check your email for the login link!')
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
        className="relative z-10"
      >
        <h1 className="text-5xl font-black italic tracking-tighter mb-2 text-white">ARCTIVATE</h1>
        <p className="text-arc-muted mb-8">Gamify Your Discipline</p>

        <div className="glass-panel p-8 rounded-2xl w-full max-w-sm shadow-glass">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/30 border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition placeholder:text-arc-muted"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow active:scale-95 transition disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'SEND LOGIN LINK'}
            </button>
          </form>
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