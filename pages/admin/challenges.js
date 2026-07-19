import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/router'
import Link from 'next/link'
import LoadingState from '../../components/LoadingState'
import { supabase } from '../../lib/supabaseClient'

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

export default function AdminChallenges() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const [challenges, setChallenges] = useState([])
  const [title, setTitle] = useState('')
  const [points, setPoints] = useState('10')
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const showToast = (m) => setToast(m)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profile?.is_admin) { router.push('/train'); return }
      setIsAdmin(true)
      setIsLoading(false)
      loadChallenges()
    }
    init()
  }, [])

  async function loadChallenges() {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { showToast('Run migration 018 to enable challenges'); return }
    setChallenges(data || [])
  }

  const addChallenge = async () => {
    if (!title.trim()) { showToast('Enter a challenge'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('challenges')
        .insert({ title: title.trim(), points_reward: parseInt(points, 10) || 10, created_by: user?.id, is_active: true })
        .select()
        .single()
      if (error) throw error
      setChallenges((prev) => [data, ...prev])
      setTitle('')
      setPoints('10')
      showToast('Challenge published to everyone 🎉')
    } catch {
      showToast('Could not publish (run migration 018)')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (ch) => {
    const next = !ch.is_active
    setChallenges((prev) => prev.map((c) => c.id === ch.id ? { ...c, is_active: next } : c))
    const { error } = await supabase.from('challenges').update({ is_active: next }).eq('id', ch.id)
    if (error) {
      setChallenges((prev) => prev.map((c) => c.id === ch.id ? { ...c, is_active: ch.is_active } : c))
      showToast('Failed to update')
    }
  }

  const deleteChallenge = async (id) => {
    const prev = challenges
    setChallenges((p) => p.filter((c) => c.id !== id))
    const { error } = await supabase.from('challenges').delete().eq('id', id)
    if (error) { setChallenges(prev); showToast('Failed to delete') }
  }

  const resetEveryone = async () => {
    setConfirmReset(false)
    setResetting(true)
    try {
      const { data, error } = await supabase.rpc('reset_all_challenges')
      if (error) throw error
      showToast(`Reset ${data ?? 'all'} members to Day 1 🔥`)
    } catch {
      showToast('Reset failed (run migration 018)')
    } finally {
      setResetting(false)
    }
  }

  if (isLoading) return <LoadingState label="Checking access…" />

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-28 font-sans">
      <AnimatePresence>{toast && <Toast message={toast} onClose={() => setToast(null)} />}</AnimatePresence>

      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="p-5 flex justify-between items-center max-w-lg mx-auto">
          <div>
            <h1 className="text-xl font-black italic tracking-tighter text-gradient-accent">ARCTIVATE</h1>
            <span className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em]">Admin · Challenges</span>
          </div>
        </div>
      </header>

      <main className="pt-24 px-5 space-y-6 max-w-lg mx-auto">

        {/* Sub-nav between admin pages */}
        <div className="flex gap-2">
          <Link href="/admin/workouts" className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold bg-arc-card border border-white/[0.06] text-arc-muted hover:text-white transition-colors">
            Workouts
          </Link>
          <span className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold bg-accent-gradient text-white">
            Challenges
          </span>
          <Link href="/admin/admins" className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold bg-arc-card border border-white/[0.06] text-arc-muted hover:text-white transition-colors">
            Admins
          </Link>
          <Link href="/admin/feedback" className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold bg-arc-card border border-white/[0.06] text-arc-muted hover:text-white transition-colors">
            Feedback
          </Link>
        </div>

        {/* Add a challenge */}
        <section className="bg-arc-card border border-white/[0.06] rounded-[2rem] p-6 space-y-4">
          <div>
            <h2 className="text-sm font-black italic tracking-tight">ADD A CHALLENGE</h2>
            <p className="text-[11px] text-arc-muted mt-1">Appears in every member&apos;s Protocol list to tick off today.</p>
          </div>
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 20 min cold shower"
            className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1 block">Points</label>
              <input
                type="number" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} min="0"
                className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent text-center font-bold"
              />
            </div>
            <button
              onClick={addChallenge} disabled={saving}
              className="flex-[2] bg-arc-accent text-white font-black italic py-4 rounded-xl shadow-glow active:scale-95 transition-transform disabled:opacity-50 mt-4"
            >
              {saving ? 'PUBLISHING…' : 'PUBLISH'}
            </button>
          </div>
        </section>

        {/* Live challenges */}
        <section className="space-y-3">
          <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest px-1">Published challenges</h3>
          {challenges.length === 0 && (
            <p className="text-sm text-arc-muted px-1">None yet. Add one above.</p>
          )}
          {challenges.map((ch) => (
            <div key={ch.id} className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${ch.is_active ? 'bg-arc-surface border-arc-accent/20' : 'bg-arc-surface/40 border-white/5 opacity-60'}`}>
              <div className="min-w-0">
                <div className="font-bold text-sm text-white truncate">{ch.title}</div>
                <div className="text-[10px] text-arc-muted font-bold uppercase tracking-wider">{ch.points_reward} pts · {ch.is_active ? 'Live' : 'Hidden'}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleActive(ch)} className="text-[10px] font-bold uppercase tracking-wider border border-white/10 px-3 py-1.5 rounded-full text-arc-muted hover:text-white transition-colors">
                  {ch.is_active ? 'Hide' : 'Show'}
                </button>
                <button onClick={() => deleteChallenge(ch.id)} aria-label="Delete" className="text-white/20 hover:text-red-400 transition-colors p-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* Reset everyone */}
        <section className="bg-arc-card border border-red-500/20 rounded-[2rem] p-6 space-y-3">
          <h2 className="text-sm font-black italic tracking-tight text-red-400">RESET THE CHALLENGE</h2>
          <p className="text-[11px] text-arc-muted">Sets every member back to <b>Day 1</b>. They&apos;ll see the &ldquo;Welcome to the Arctivate Challenge&rdquo; screen next time they open Protocol. This can&apos;t be undone.</p>
          <button
            onClick={() => setConfirmReset(true)} disabled={resetting}
            className="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-bold py-3.5 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {resetting ? 'Resetting…' : 'Reset everyone to Day 1'}
          </button>
        </section>
      </main>

      {/* Reset confirmation */}
      <AnimatePresence>
        {confirmReset && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmReset(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <div className="bg-arc-card border border-white/10 rounded-2xl p-6 w-full max-w-xs text-center space-y-4">
                <h3 className="text-lg font-black italic">RESET EVERYONE?</h3>
                <p className="text-sm text-arc-muted">Every member restarts at Day 1. This cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmReset(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-arc-muted font-bold">Cancel</button>
                  <button onClick={resetEveryone} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">Reset</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
