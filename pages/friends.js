import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Nav from '../components/Nav'
import Avatar from '../components/Avatar'
import { supabase } from '../lib/supabaseClient'
import { ArrowLeftIcon, CheckIcon, CloseIcon, UsersIcon, FlameIcon } from '../components/icons'
import { pairFor, otherSide, friendIds, incomingRequests, outgoingRequests, friendState } from '../lib/social'

export default function Friends() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [myGymId, setMyGymId] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [friendships, setFriendships] = useState([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(null)
  const [toast, setToast] = useState(null)
  const [notReady, setNotReady] = useState(false)

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 2600) }

  const fetchAll = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data: me } = await supabase.from('profiles').select('gym_id').eq('id', user.id).single()
      setMyGymId(me?.gym_id || null)

      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, total_points, current_streak, gym_id')
      setProfiles(profs || [])

      const { data: fr, error } = await supabase
        .from('friendships').select('*')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      if (error) setNotReady(true)
      setFriendships(fr || [])
    } catch {
      setNotReady(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const byId = useMemo(() => {
    const m = {}
    profiles.forEach(p => { m[p.id] = p })
    return m
  }, [profiles])

  const myFriends = useMemo(
    () => friendIds(friendships, userId).map(id => byId[id]).filter(Boolean),
    [friendships, userId, byId]
  )
  const incoming = useMemo(() => incomingRequests(friendships, userId), [friendships, userId])
  const outgoing = useMemo(() => outgoingRequests(friendships, userId), [friendships, userId])

  // Everyone else, with the people already sorted out of the way.
  const findable = useMemo(() => {
    const q = search.trim().toLowerCase()
    const handled = new Set([
      userId,
      ...friendships.map(f => otherSide(f, userId)),
    ])
    return profiles
      .filter(p => !handled.has(p.id))
      .filter(p => !q || String(p.username || '').toLowerCase().includes(q))
      .sort((a, b) => {
        // People from your own gym first: those are the ones you actually know.
        const ga = a.gym_id === myGymId ? 0 : 1
        const gb = b.gym_id === myGymId ? 0 : 1
        if (ga !== gb) return ga - gb
        return (Number(b.total_points) || 0) - (Number(a.total_points) || 0)
      })
      .slice(0, 30)
  }, [profiles, friendships, userId, search, myGymId])

  const addFriend = async (them) => {
    if (busy) return
    setBusy(them.id)
    try {
      const row = pairFor(userId, them.id)
      if (!row) return
      const { error } = await supabase.from('friendships').insert(row)
      if (error) throw error
      await fetchAll()
      showToast(`Request sent to ${them.username || 'them'}`)
    } catch {
      showToast('Could not send that (run migration 032)')
    } finally {
      setBusy(null)
    }
  }

  const respond = async (row, accept) => {
    if (busy) return
    setBusy(row.id)
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', row.id)
      if (error) throw error
      await fetchAll()
      showToast(accept ? "You're friends" : 'Declined')
    } catch {
      showToast('Could not do that')
    } finally {
      setBusy(null)
    }
  }

  const removeFriend = async (them) => {
    if (busy) return
    const { row } = friendState(friendships, userId, them.id)
    if (!row) return
    setBusy(them.id)
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', row.id)
      if (error) throw error
      await fetchAll()
      showToast(`Removed ${them.username || 'them'}`)
    } catch {
      showToast('Could not remove')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-arc-bg text-white flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-arc-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  const Row = ({ p, children }) => (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-arc-card border border-white/[0.04]">
      <Avatar src={p?.avatar_url} name={p?.username} size={32} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-white truncate">{p?.username || 'Member'}</div>
        <div className="text-[9px] text-arc-muted inline-flex items-center gap-1">
          {(Number(p?.total_points) || 0).toLocaleString()} pts
          {p?.current_streak > 0 && <><span>·</span><FlameIcon size={9} />{p.current_streak}d</>}
          {p?.gym_id && p.gym_id !== myGymId && <span>· another gym</span>}
        </div>
      </div>
      {children}
    </div>
  )

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 20 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-50 bg-arc-surface border border-white/10 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md"
          >
            <div className="w-2 h-2 rounded-full bg-arc-accent animate-pulse" />
            <span className="text-sm font-medium">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/leaderboard" className="p-2 -ml-2 text-arc-muted hover:text-white transition-colors">
              <ArrowLeftIcon />
            </Link>
            <h1 className="text-xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              FRIENDS
            </h1>
          </div>
          <Link href="/leaderboard" className="text-[10px] font-bold text-arc-accent uppercase tracking-[0.15em] hover:text-white transition-colors shrink-0">
            Board
          </Link>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-lg mx-auto space-y-5">
        {notReady && (
          <div className="bg-arc-card border border-amber-500/30 rounded-2xl p-5 text-center">
            <p className="text-sm text-amber-200">Friends aren&apos;t set up yet — migration 032 needs to be run.</p>
          </div>
        )}

        {/* Waiting on you */}
        {incoming.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[10px] font-bold text-arc-accent uppercase tracking-widest px-1">
              {incoming.length} request{incoming.length === 1 ? '' : 's'} for you
            </h2>
            {incoming.map(row => {
              const p = byId[otherSide(row, userId)]
              return (
                <Row key={row.id} p={p}>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => respond(row, true)} disabled={busy === row.id}
                      aria-label="Accept"
                      className="w-9 h-9 rounded-lg bg-arc-accent text-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                    >
                      <CheckIcon size={16} />
                    </button>
                    <button
                      onClick={() => respond(row, false)} disabled={busy === row.id}
                      aria-label="Decline"
                      className="w-9 h-9 rounded-lg bg-white/5 text-arc-muted hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      <CloseIcon size={16} />
                    </button>
                  </div>
                </Row>
              )
            })}
          </section>
        )}

        {/* Your people */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">
              Your friends {myFriends.length > 0 && `(${myFriends.length})`}
            </h2>
            {myFriends.length > 0 && (
              <Link href="/leaderboard" className="text-[9px] font-bold text-arc-accent uppercase tracking-wider">
                See the board
              </Link>
            )}
          </div>

          {myFriends.length === 0 ? (
            <div className="bg-arc-card border border-white/5 rounded-2xl p-6 text-center space-y-2">
              <div className="flex justify-center text-arc-muted"><UsersIcon size={32} /></div>
              <p className="text-sm text-arc-muted">
                No friends yet. Add someone below and you&apos;ll both show up on each other&apos;s board.
              </p>
            </div>
          ) : (
            myFriends.map(p => (
              <Row key={p.id} p={p}>
                {/* Straight into the create sheet with them already lined up */}
                <Link
                  href={`/challenges?invite=${p.id}`}
                  className="shrink-0 text-[10px] font-black uppercase tracking-wider text-arc-accent bg-arc-accent/15 hover:bg-arc-accent/25 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Challenge
                </Link>
                <button
                  onClick={() => removeFriend(p)} disabled={busy === p.id}
                  className="shrink-0 text-[10px] font-bold text-arc-muted hover:text-red-400 px-2 py-1.5 transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              </Row>
            ))
          )}
        </section>

        {/* Sent, not yet answered */}
        {outgoing.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest px-1">Waiting on them</h2>
            {outgoing.map(row => {
              const p = byId[otherSide(row, userId)]
              return (
                <Row key={row.id} p={p}>
                  <span className="shrink-0 text-[9px] font-bold text-arc-muted uppercase tracking-wider">Sent</span>
                </Row>
              )
            })}
          </section>
        )}

        {/* Find people */}
        <section className="space-y-2">
          <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest px-1">Find people</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className="w-full bg-arc-surface border border-white/10 p-3.5 rounded-xl text-white outline-none focus:border-arc-accent transition-colors text-sm"
          />
          {findable.length === 0 ? (
            <p className="text-sm text-arc-muted text-center py-4">
              {search ? 'Nobody by that name.' : "You've added everyone already."}
            </p>
          ) : (
            findable.map(p => (
              <Row key={p.id} p={p}>
                <button
                  onClick={() => addFriend(p)} disabled={busy === p.id}
                  className="shrink-0 bg-arc-surface border border-white/10 text-white text-[11px] font-bold px-3 py-2 rounded-lg hover:border-arc-accent/40 transition-colors disabled:opacity-50"
                >
                  {busy === p.id ? '…' : 'Add'}
                </button>
              </Row>
            ))
          )}
        </section>
      </main>

      <Nav />
    </div>
  )
}
