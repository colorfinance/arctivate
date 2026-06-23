import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/router'
import Nav from '../components/Nav'
import LoadingState from '../components/LoadingState'
import { supabase } from '../lib/supabaseClient'

const CATEGORIES = [
  { value: 'general', label: '💬 General' },
  { value: 'bug', label: '🐞 Bug' },
  { value: 'feature', label: '💡 Idea' },
  { value: 'praise', label: '❤️ Praise' },
]

const STATUS_LABEL = { new: 'Received', reviewed: 'Reviewed', resolved: 'Resolved' }

const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <motion.div
      initial={{ opacity: 0, y: -50, x: '-50%' }} animate={{ opacity: 1, y: 20, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }}
      className="fixed top-0 left-1/2 z-50 bg-arc-surface/90 border border-arc-accent/20 text-white px-6 py-3 rounded-full shadow-glow flex items-center gap-3 backdrop-blur-xl"
    >
      <div className="w-2 h-2 rounded-full bg-arc-accent animate-pulse" />
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  )
}

export default function Feedback() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const [category, setCategory] = useState('general')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [mine, setMine] = useState([])

  const showToast = (m) => setToast(m)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      await loadMine(user.id)
      setIsLoading(false)
    }
    init()
  }, [])

  async function loadMine(userId) {
    const { data } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setMine(data)
  }

  const submit = async () => {
    if (sending) return
    if (!message.trim()) { showToast('Please write a message first'); return }
    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('Please log in'); setSending(false); return }

      const { data, error } = await supabase
        .from('feedback')
        .insert({ user_id: user.id, category, message: message.trim() })
        .select('*')
        .single()
      if (error) throw error

      setMine((prev) => [data, ...prev])
      setMessage('')
      setCategory('general')
      showToast('Thanks! Your feedback was sent 🙌')
    } catch (err) {
      console.error('[Arctivate] feedback submit failed:', err)
      showToast(`Couldn't send: ${err.message || 'unknown error'}`)
    } finally {
      setSending(false)
    }
  }

  if (isLoading) return <LoadingState label="Loading…" />

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-28 font-sans">
      <AnimatePresence>{toast && <Toast message={toast} onClose={() => setToast(null)} />}</AnimatePresence>

      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="p-5 flex justify-between items-center max-w-lg mx-auto">
          <div>
            <h1 className="text-xl font-black italic tracking-tighter text-gradient-accent">ARCTIVATE</h1>
            <span className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em]">Feedback</span>
          </div>
          <button onClick={() => router.back()} className="text-[10px] font-bold text-arc-accent uppercase tracking-[0.15em] hover:text-white transition-colors">
            ← Back
          </button>
        </div>
      </header>

      <main className="pt-24 px-5 space-y-6 max-w-lg mx-auto">
        {/* Form */}
        <section className="relative">
          <div className="absolute -inset-[1px] bg-gradient-to-b from-arc-accent/20 via-arc-cyan/10 to-transparent rounded-[2rem] blur-sm opacity-60" />
          <div className="relative bg-arc-card border border-white/[0.06] rounded-[2rem] shadow-card overflow-hidden">
            <div className="h-[2px] bg-accent-gradient-r" />
            <div className="p-6 space-y-4">
              <div>
                <h2 className="font-black italic tracking-tight text-lg">Tell us what you think</h2>
                <p className="text-[11px] text-arc-muted mt-1">Found a bug, got an idea, or just want to say hi? We read every message.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      category === c.value
                        ? 'bg-accent-gradient text-white border-transparent shadow-glow-accent'
                        : 'bg-arc-surface text-arc-muted border-white/[0.06] hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your feedback…"
                rows={5}
                maxLength={2000}
                className="w-full bg-arc-surface border border-white/[0.06] text-white p-4 rounded-xl outline-none focus:border-arc-accent/40 resize-none text-sm placeholder-white/20"
              />

              <button
                onClick={submit}
                disabled={sending || !message.trim()}
                className="w-full bg-accent-gradient text-white font-black italic tracking-wider py-4 rounded-xl shadow-glow-accent disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                    <span>SENDING…</span>
                  </>
                ) : 'SEND FEEDBACK'}
              </button>
            </div>
          </div>
        </section>

        {/* My submissions */}
        {mine.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] px-1">Your feedback</h3>
            <div className="space-y-2">
              {mine.map((f) => {
                const cat = CATEGORIES.find((c) => c.value === f.category)
                return (
                  <div key={f.id} className="bg-arc-card/60 border border-white/[0.04] p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-arc-muted uppercase tracking-wider">{cat ? cat.label : f.category}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        f.status === 'resolved' ? 'bg-emerald-500/15 text-emerald-400'
                          : f.status === 'reviewed' ? 'bg-arc-cyan/15 text-arc-cyan'
                          : 'bg-white/5 text-arc-muted'
                      }`}>
                        {STATUS_LABEL[f.status] || f.status}
                      </span>
                    </div>
                    <p className="text-sm text-white/90 whitespace-pre-wrap break-words">{f.message}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>

      <Nav />
    </div>
  )
}
