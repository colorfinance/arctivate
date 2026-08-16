import { LockIcon } from '../../components/icons'
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

  // Multi-day challenges members join. Several can run at once.
  const [groups, setGroups] = useState([])
  const [groupCounts, setGroupCounts] = useState({})
  const [groupsMissing, setGroupsMissing] = useState(false)
  const [gcForm, setGcForm] = useState({ title: '', description: '', start_date: '', length_days: '75', strict: false })
  const [savingGroup, setSavingGroup] = useState(false)
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(null)

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
      loadGroups()
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

  async function loadGroups() {
    const { data, error } = await supabase
      .from('group_challenges')
      .select('*')
      .order('start_date', { ascending: false })
    if (error) { setGroupsMissing(true); return }
    setGroups(data || [])

    const { data: mem } = await supabase
      .from('group_challenge_members')
      .select('challenge_id, status')
    const counts = {}
    ;(mem || []).forEach(m => {
      if (m.status === 'left') return
      counts[m.challenge_id] = (counts[m.challenge_id] || 0) + 1
    })
    setGroupCounts(counts)
  }

  const addGroupChallenge = async () => {
    const title = gcForm.title.trim()
    if (!title) { showToast('Give the challenge a name'); return }
    const length = parseInt(gcForm.length_days, 10)
    if (!length || length < 1 || length > 400) { showToast('Length must be between 1 and 400 days'); return }
    setSavingGroup(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('group_challenges')
        .insert({
          title,
          description: gcForm.description.trim() || null,
          // Blank means it starts today.
          start_date: gcForm.start_date || new Date().toISOString().slice(0, 10),
          length_days: length,
          strict: gcForm.strict,
          is_active: true,
          created_by: user?.id,
        })
        .select()
        .single()
      if (error) throw error
      setGroups(prev => [data, ...prev])
      setGcForm({ title: '', description: '', start_date: '', length_days: '75', strict: false })
      showToast('Challenge is live — members can join it now 🏁')
    } catch {
      showToast('Could not create (run migration 031)')
    } finally {
      setSavingGroup(false)
    }
  }

  const toggleGroupActive = async (ch) => {
    const next = !ch.is_active
    setGroups(prev => prev.map(c => c.id === ch.id ? { ...c, is_active: next } : c))
    const { error } = await supabase.from('group_challenges').update({ is_active: next }).eq('id', ch.id)
    if (error) {
      setGroups(prev => prev.map(c => c.id === ch.id ? { ...c, is_active: ch.is_active } : c))
      showToast('Failed to update')
    }
  }

  const deleteGroupChallenge = async (ch) => {
    setConfirmDeleteGroup(null)
    const prev = groups
    setGroups(p => p.filter(c => c.id !== ch.id))
    const { error } = await supabase.from('group_challenges').delete().eq('id', ch.id)
    if (error) { setGroups(prev); showToast('Failed to delete') }
    else showToast('Challenge deleted')
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

        {/* Joinable, multi-day challenges */}
        <section className="bg-arc-card border border-white/[0.06] rounded-[2rem] p-6 space-y-4">
          <div>
            <h2 className="text-sm font-black italic tracking-tight">START A CHALLENGE</h2>
            <p className="text-[11px] text-arc-muted mt-1">
              A multi-day challenge members choose to join. As many can run at once as you like.
            </p>
          </div>

          {groupsMissing && (
            <p className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              Run migration 031 to enable these.
            </p>
          )}

          <input
            type="text" value={gcForm.title}
            onChange={(e) => setGcForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. 75 Hard — Autumn"
            className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
          />
          <textarea
            value={gcForm.description}
            onChange={(e) => setGcForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What it involves (optional)"
            rows={2}
            className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors text-sm resize-none"
          />

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1 block">Starts</label>
              <input
                type="date" value={gcForm.start_date}
                onChange={(e) => setGcForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent text-sm"
              />
            </div>
            <div className="w-28">
              <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1 block">Days</label>
              <input
                type="number" inputMode="numeric" min="1" max="400" value={gcForm.length_days}
                onChange={(e) => setGcForm(f => ({ ...f, length_days: e.target.value }))}
                className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent text-center font-bold"
              />
            </div>
          </div>
          <p className="text-[10px] text-arc-muted -mt-2">Leave the date blank to start today.</p>

          {/* Strict is opt-in per challenge, and joining it is the member's consent */}
          <button
            onClick={() => setGcForm(f => ({ ...f, strict: !f.strict }))}
            className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
              gcForm.strict ? 'bg-amber-500/10 border-amber-500/30' : 'bg-arc-surface border-white/[0.06]'
            }`}
          >
            <span className="text-left min-w-0">
              <span className={`block text-[11px] font-bold ${gcForm.strict ? 'text-amber-400' : 'text-white'}`}>
                Strict — miss a day, back to Day 1
              </span>
              <span className="block text-[9px] text-arc-muted leading-snug">
                Only applies to members who join this challenge
              </span>
            </span>
            <span className={`shrink-0 w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${gcForm.strict ? 'bg-amber-500 justify-end' : 'bg-white/10 justify-start'}`}>
              <span className="w-4 h-4 rounded-full bg-white" />
            </span>
          </button>

          <button
            onClick={addGroupChallenge} disabled={savingGroup}
            className="w-full bg-accent-gradient text-white font-black italic py-4 rounded-xl shadow-glow active:scale-95 transition-transform disabled:opacity-50"
          >
            {savingGroup ? 'CREATING…' : 'CREATE CHALLENGE'}
          </button>
        </section>

        {/* Challenges that are running */}
        {groups.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest px-1">Running challenges</h3>
            {groups.map(ch => (
              <div key={ch.id} className="bg-arc-card border border-white/[0.06] rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{ch.title}</p>
                    <p className="text-[10px] text-arc-muted mt-0.5">
                      {new Date(ch.start_date + 'T12:00:00').toLocaleDateString()} · {ch.length_days} days
                      {ch.strict && <span className="inline-flex items-center gap-1"> · <LockIcon size={10} /> strict</span>}
                      {' · '}{groupCounts[ch.id] || 0} joined
                    </p>
                  </div>
                  <span className={`shrink-0 text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${ch.is_active ? 'bg-green-500/10 text-green-400' : 'bg-white/5 text-arc-muted'}`}>
                    {ch.is_active ? 'Open' : 'Closed'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleGroupActive(ch)}
                    className="flex-1 bg-arc-surface border border-white/[0.06] text-arc-muted hover:text-white text-[11px] font-bold py-2 rounded-lg transition-colors"
                  >
                    {ch.is_active ? 'Close to new members' : 'Reopen'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteGroup(ch)}
                    className="px-3 bg-red-500/10 text-red-400 text-[11px] font-bold py-2 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Add a challenge */}
        <section className="bg-arc-card border border-white/[0.06] rounded-[2rem] p-6 space-y-4">
          <div>
            <h2 className="text-sm font-black italic tracking-tight">ADD A DAILY CHALLENGE</h2>
            <p className="text-[11px] text-arc-muted mt-1">A one-off task for today. Appears in every member&apos;s Protocol list to tick off — stays up for 24 hours, then drops off automatically.</p>
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
          <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest px-1">Published daily challenges</h3>
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

        {confirmDeleteGroup && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmDeleteGroup(null)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <div className="bg-arc-card border border-white/10 rounded-2xl p-6 w-full max-w-xs text-center space-y-4">
                <h3 className="text-lg font-black italic">DELETE THIS CHALLENGE?</h3>
                <p className="text-sm text-arc-muted">
                  <span className="text-white font-bold">{confirmDeleteGroup.title}</span> and everyone&apos;s progress in it
                  {groupCounts[confirmDeleteGroup.id] ? ` (${groupCounts[confirmDeleteGroup.id]} member${groupCounts[confirmDeleteGroup.id] === 1 ? '' : 's'})` : ''} will be removed. This cannot be undone.
                </p>
                <p className="text-[11px] text-arc-muted">
                  To stop new people joining without losing anyone&apos;s progress, close it instead.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmDeleteGroup(null)} className="flex-1 py-3 rounded-xl border border-white/10 text-arc-muted font-bold">Cancel</button>
                  <button onClick={() => deleteGroupChallenge(confirmDeleteGroup)} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">Delete</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
