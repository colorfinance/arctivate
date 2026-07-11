import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Nav from '../../components/Nav'
import LoadingState from '../../components/LoadingState'
import { supabase } from '../../lib/supabaseClient'

const CATEGORY_LABEL = {
  general: '💬 General', bug: '🐞 Bug', feature: '💡 Idea', praise: '❤️ Praise', other: '📌 Other',
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
]

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

const fmtDate = (s) => {
  const d = new Date(s)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function AdminFeedback() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)
  const [viewerImg, setViewerImg] = useState(null)

  const showToast = (m) => setToast(m)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profile?.is_admin) { router.push('/train'); return }
      await load()
      setIsLoading(false)
    }
    init()
  }, [])

  async function load() {
    // Embed the submitter's username; falls back gracefully if unavailable.
    let { data, error } = await supabase
      .from('feedback')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) {
      const retry = await supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(300)
      data = retry.data
    }
    if (data) setItems(data)
  }

  const setStatus = async (id, status) => {
    setBusyId(id)
    try {
      const { error } = await supabase.from('feedback').update({ status }).eq('id', id)
      if (error) throw error
      setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)))
    } catch (err) {
      showToast(err.message || 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = filter === 'all' ? items : items.filter((f) => f.status === filter)
  const newCount = items.filter((f) => f.status === 'new').length

  if (isLoading) return <LoadingState label="Loading feedback…" />

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-28 font-sans">
      <AnimatePresence>{toast && <Toast message={toast} onClose={() => setToast(null)} />}</AnimatePresence>

      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="p-5 flex justify-between items-center max-w-lg mx-auto">
          <div>
            <h1 className="text-xl font-black italic tracking-tighter text-gradient-accent">ARCTIVATE</h1>
            <span className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em]">Admin · Feedback</span>
          </div>
        </div>
      </header>

      <main className="pt-24 px-5 space-y-6 max-w-lg mx-auto">
        {/* Sub-nav between admin pages */}
        <div className="flex gap-2">
          <Link href="/admin/workouts" className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold bg-arc-card border border-white/[0.06] text-arc-muted hover:text-white transition-colors">
            Workouts
          </Link>
          <Link href="/admin/admins" className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold bg-arc-card border border-white/[0.06] text-arc-muted hover:text-white transition-colors">
            Admins
          </Link>
          <span className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold bg-accent-gradient text-white">
            Feedback
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all border ${
                filter === f.value ? 'bg-arc-accent/15 border-arc-accent/40 text-arc-accent' : 'bg-arc-card border-white/[0.06] text-arc-muted hover:text-white'
              }`}
            >
              {f.label}{f.value === 'new' && newCount > 0 ? ` (${newCount})` : ''}
            </button>
          ))}
        </div>

        {/* List */}
        <section className="space-y-2.5">
          {filtered.length === 0 && (
            <p className="text-center text-arc-muted text-sm py-12">No feedback{filter !== 'all' ? ` (${filter})` : ' yet'}.</p>
          )}
          {filtered.map((f) => (
            <div
              key={f.id}
              className={`bg-arc-card border p-4 rounded-2xl ${f.status === 'new' ? 'border-arc-accent/30' : 'border-white/[0.04]'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-arc-muted uppercase tracking-wider">
                  {CATEGORY_LABEL[f.category] || f.category}
                </span>
                <span className="text-[10px] text-arc-muted/70 font-mono">{fmtDate(f.created_at)}</span>
              </div>

              <p className="text-sm text-white/90 whitespace-pre-wrap break-words">{f.message}</p>

              {f.image_url && (
                <button onClick={() => setViewerImg(f.image_url)} className="mt-2 block w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.image_url} alt="Screenshot" className="w-full max-h-56 object-contain rounded-lg border border-white/[0.06] bg-black/20 hover:border-arc-accent/40 transition-colors" />
                </button>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                <span className="text-[10px] text-arc-muted truncate max-w-[40%]">
                  {f.profiles?.username ? `@${f.profiles.username}` : 'Anonymous'}
                </span>
                <div className="flex gap-1.5">
                  {f.status !== 'reviewed' && f.status !== 'resolved' && (
                    <button onClick={() => setStatus(f.id, 'reviewed')} disabled={busyId === f.id}
                      className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-arc-surface border border-white/[0.06] text-arc-cyan hover:text-white transition-colors disabled:opacity-40">
                      Mark reviewed
                    </button>
                  )}
                  {f.status !== 'resolved' ? (
                    <button onClick={() => setStatus(f.id, 'resolved')} disabled={busyId === f.id}
                      className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-40">
                      Resolve
                    </button>
                  ) : (
                    <button onClick={() => setStatus(f.id, 'new')} disabled={busyId === f.id}
                      className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-arc-surface border border-white/[0.06] text-arc-muted hover:text-white transition-colors disabled:opacity-40">
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>

      {/* Screenshot viewer */}
      <AnimatePresence>
        {viewerImg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setViewerImg(null)}
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewerImg} alt="Screenshot" className="max-w-full max-h-full rounded-2xl border border-white/10" />
          </motion.div>
        )}
      </AnimatePresence>

      <Nav />
    </div>
  )
}
