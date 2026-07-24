import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { pickQuote } from '../lib/quotes'

// Shows a motivational quote once per app open (per session), for logged-in
// members only. Auto-dismisses; tap to close early. Mounted globally in _app.
export default function MotivationBanner() {
  const [quote, setQuote] = useState(null)

  useEffect(() => {
    let timer
    const run = async () => {
      try {
        // Only once per app open (a fresh load / cold start clears this).
        if (sessionStorage.getItem('arc_quote_shown')) return
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return // don't greet on the login/landing screens
        sessionStorage.setItem('arc_quote_shown', '1')
        setQuote(pickQuote())
        timer = setTimeout(() => setQuote(null), 7000)
      } catch {}
    }
    run()
    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {quote && (
        <motion.button
          type="button"
          onClick={() => setQuote(null)}
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className="fixed top-3 inset-x-0 z-[70] mx-auto max-w-lg px-4 text-left"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
          aria-label="Dismiss quote"
        >
          <div className="relative overflow-hidden rounded-2xl border border-arc-accent/25 bg-arc-card/90 backdrop-blur-xl shadow-glow px-4 py-3 flex items-start gap-3">
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-arc-accent/15 blur-2xl rounded-full pointer-events-none" />
            <span className="text-lg leading-none mt-0.5">💪</span>
            <div className="min-w-0">
              <div className="text-[9px] font-bold text-arc-accent uppercase tracking-[0.2em] mb-0.5">Daily fuel</div>
              <p className="text-[13px] font-semibold text-white leading-snug">{quote}</p>
            </div>
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
