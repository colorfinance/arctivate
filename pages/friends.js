import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Masthead, { MastheadAction } from '../components/Masthead'
import Nav from '../components/Nav'
import Avatar from '../components/Avatar'
import { supabase } from '../lib/supabaseClient'
import FollowButton from '../components/FollowButton'
import { fetchMyFollowing, toggleFollow } from '../lib/follows'
import { CheckIcon, CloseIcon, UsersIcon, FlameIcon } from '../components/icons'
import { otherSide, incomingRequests, outgoingRequests } from '../lib/social'
import { fetchStreaks, streakFor } from '../lib/streaks'

export default function Friends() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [myGymId, setMyGymId] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [friendships, setFriendships] = useState([])
  const [search, setSearch] = useState('')
  // Following sits alongside the older friend request. One is a tap; the other
  // needs the other person to agree, which after a year nobody ever did.
  const [following, setFollowing] = useState(new Set())
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
      // The column is never written, so the flame never appeared for anyone.
      const streaks = await fetchStreaks(supabase)
      setProfiles((profs || []).map(p => ({ ...p, current_streak: streakFor(streaks, p.id).current })))

      const { data: fr, error } = await supabase
        .from('friendships').select('*')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      if (error) setNotReady(true)
      setFriendships(fr || [])
      setFollowing(await fetchMyFollowing(supabase, user.id))
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

  const incoming = useMemo(() => incomingRequests(friendships, userId), [friendships, userId])
  const outgoing = useMemo(() => outgoingRequests(friendships, userId), [friendships, userId])

  // Everyone else, with the people already sorted out of the way.
  const handleFollow = async (targetId, already) => {
    setFollowing(prev => {
      const next = new Set(prev)
      if (already) next.delete(targetId); else next.add(targetId)
      return next
    })
    const ok = await toggleFollow(supabase, userId, targetId, already)
    if (!ok) {
      setFollowing(prev => {
        const next = new Set(prev)
        if (already) next.add(targetId); else next.delete(targetId)
        return next
      })
    }
  }

  const followedPeople = useMemo(
    () => profiles.filter(p => following.has(p.id)),
    [profiles, following]
  )

  const findable = useMemo(() => {
    const q = search.trim().toLowerCase()
    const handled = new Set([
      userId,
      // Declined rows are deleted now, but any left over from before must
      // not keep hiding people from each other.
      ...friendships.filter(f => f.status !== 'declined').map(f => otherSide(f, userId)),
    ])
    return profiles
      .filter(p => !handled.has(p.id) && p.username)
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


  const respond = async (row, accept) => {
    if (busy) return
    setBusy(row.id)
    try {
      // Declining removes the row rather than marking it. A kept 'declined'
      // row occupied the unique pair forever: both people vanished from each
      // other's Find list and neither could ever ask again.
      const { error } = accept
        ? await supabase.from('friendships').update({ status: 'accepted' }).eq('id', row.id)
        : await supabase.from('friendships').delete().eq('id', row.id)
      if (error) throw error
      await fetchAll()
      showToast(accept ? "You're friends" : 'Declined')
    } catch {
      showToast('Could not do that')
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

      <Masthead
        title="People"
        back
        actions={
          <MastheadAction href="/leaderboard" label="Leaderboard">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
          </MastheadAction>
        }
      />

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

        {/* Who you follow. Replaces the accepted-friends list: following needs
            no approval, which is why that list was empty for a year. */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">
              Following {followedPeople.length > 0 && `(${followedPeople.length})`}
            </h2>
            {followedPeople.length > 0 && (
              <Link href="/leaderboard" className="text-[9px] font-bold text-arc-accent uppercase tracking-wider">
                See the board
              </Link>
            )}
          </div>

          {followedPeople.length === 0 ? (
            <div className="bg-arc-card border border-white/5 rounded-2xl p-6 text-center space-y-2">
              <div className="flex justify-center text-arc-muted"><UsersIcon size={32} /></div>
              <p className="text-sm text-arc-muted">
                Not following anyone yet. Follow someone below and their workouts show up in your feed.
              </p>
            </div>
          ) : (
            followedPeople.map(p => (
              <Row key={p.id} p={p}>
                {/* Straight into the create sheet with them already lined up */}
                <Link
                  href={`/challenges?invite=${p.id}`}
                  className="shrink-0 text-[10px] font-black uppercase tracking-wider text-arc-accent bg-arc-accent/15 hover:bg-arc-accent/25 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Challenge
                </Link>
                <FollowButton
                  targetId={p.id}
                  currentUserId={userId}
                  isFollowing
                  onToggle={handleFollow}
                />
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
                <FollowButton
                  targetId={p.id}
                  currentUserId={userId}
                  isFollowing={following.has(p.id)}
                  onToggle={handleFollow}
                />
              </Row>
            ))
          )}
        </section>
      </main>

      <Nav />
    </div>
  )
}
