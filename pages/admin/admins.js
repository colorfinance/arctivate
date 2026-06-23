import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Nav from '../../components/Nav'
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

export default function AdminAdmins() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [meId, setMeId] = useState(null)

  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [grantEmail, setGrantEmail] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [granting, setGranting] = useState(false)

  const showToast = (m) => setToast(m)

  const token = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const callApi = async (body) => {
    const t = await token()
    if (!t) throw new Error('Session expired, please re-login')
    const res = await fetch('/api/admin/manage-admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
    return data
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setMeId(user.id)
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profile?.is_admin) { router.push('/train'); return }
      try {
        const data = await callApi({ action: 'list' })
        setUsers(data.users || [])
      } catch (err) {
        showToast(err.message)
      }
      setIsLoading(false)
    }
    init()
  }, [])

  const setAdmin = async ({ userId, email }, makeAdmin) => {
    setBusyId(userId || email)
    try {
      const data = await callApi({ action: 'set', userId, email, makeAdmin })
      setUsers(data.users || [])
      showToast(makeAdmin ? 'Admin access granted' : 'Admin access removed')
    } catch (err) {
      showToast(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const grantByEmail = async () => {
    if (!grantEmail.trim() || granting) return
    setGranting(true)
    try {
      const data = await callApi({ action: 'set', email: grantEmail.trim(), makeAdmin: true })
      setUsers(data.users || [])
      setGrantEmail('')
      showToast('Admin access granted')
    } catch (err) {
      showToast(err.message)
    } finally {
      setGranting(false)
    }
  }

  const filtered = users.filter((u) => u.email?.toLowerCase().includes(search.toLowerCase()))
  const adminCount = users.filter((u) => u.is_admin).length

  if (isLoading) return <LoadingState label="Loading team…" />

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-28 font-sans">
      <AnimatePresence>{toast && <Toast message={toast} onClose={() => setToast(null)} />}</AnimatePresence>

      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="p-5 flex justify-between items-center max-w-lg mx-auto">
          <div>
            <h1 className="text-xl font-black italic tracking-tighter text-gradient-accent">ARCTIVATE</h1>
            <span className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em]">Admin · Team</span>
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
            Admins
          </span>
          <Link href="/admin/feedback" className="flex-1 text-center py-2.5 rounded-xl text-xs font-bold bg-arc-card border border-white/[0.06] text-arc-muted hover:text-white transition-colors">
            Feedback
          </Link>
        </div>

        {/* Grant by email */}
        <section className="relative">
          <div className="absolute -inset-[1px] bg-gradient-to-b from-arc-accent/20 via-arc-cyan/10 to-transparent rounded-[2rem] blur-sm opacity-60" />
          <div className="relative bg-arc-card border border-white/[0.06] rounded-[2rem] shadow-card overflow-hidden">
            <div className="h-[2px] bg-accent-gradient-r" />
            <div className="p-6 space-y-4">
              <div>
                <h2 className="font-black italic tracking-tight text-lg">Add an admin</h2>
                <p className="text-[11px] text-arc-muted mt-1">Enter the email of an existing user to give them admin access. They must have signed up already.</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="email" value={grantEmail} onChange={(e) => setGrantEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && grantByEmail()}
                  placeholder="name@email.com" autoCapitalize="off" autoCorrect="off" spellCheck="false"
                  className="flex-1 bg-arc-surface border border-white/[0.06] text-white p-3 rounded-xl outline-none focus:border-arc-accent/40 text-sm"
                />
                <button onClick={grantByEmail} disabled={granting || !grantEmail.trim()}
                  className="px-5 bg-accent-gradient text-white font-bold rounded-xl shadow-glow-accent disabled:opacity-50 text-sm">
                  {granting ? '…' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* User list */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em]">All Users · {adminCount} admin{adminCount !== 1 ? 's' : ''}</h3>
          </div>
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email…"
            className="w-full bg-arc-surface border border-white/[0.06] text-white p-3 rounded-xl outline-none focus:border-arc-accent/40 text-sm placeholder-white/20"
          />

          <div className="space-y-2">
            {filtered.length === 0 && (
              <p className="text-center text-arc-muted text-sm py-8">No users found.</p>
            )}
            {filtered.map((u) => {
              const isMe = u.id === meId
              const busy = busyId === u.id
              return (
                <div key={u.id} className={`flex items-center gap-3 p-4 rounded-2xl border ${u.is_admin ? 'border-arc-accent/30 bg-arc-accent/[0.05]' : 'border-white/[0.04] bg-arc-card'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{u.email || '(no email)'}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider mt-0.5">
                      {u.is_admin ? <span className="text-arc-accent">Admin</span> : <span className="text-arc-muted">Member</span>}
                      {isMe && <span className="text-arc-cyan ml-1">· you</span>}
                    </div>
                  </div>
                  {u.is_admin ? (
                    <button
                      onClick={() => setAdmin({ userId: u.id }, false)}
                      disabled={busy || isMe}
                      title={isMe ? "You can't remove your own access" : 'Remove admin'}
                      className="text-xs font-bold px-3 py-2 rounded-xl bg-arc-surface border border-white/[0.06] text-arc-muted hover:text-red-400 transition-colors disabled:opacity-40"
                    >
                      {busy ? '…' : 'Remove'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setAdmin({ userId: u.id }, true)}
                      disabled={busy}
                      className="text-xs font-bold px-3 py-2 rounded-xl bg-accent-gradient text-white shadow-glow-accent disabled:opacity-40"
                    >
                      {busy ? '…' : 'Make admin'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </main>

      <Nav />
    </div>
  )
}
