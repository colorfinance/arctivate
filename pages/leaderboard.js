import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Nav from '../components/Nav'
import Avatar from '../components/Avatar'
import { supabase } from '../lib/supabaseClient'
import { ArrowLeftIcon, TrophyIcon, FlameIcon, UsersIcon } from '../components/icons'
import { friendIds, rankPeople, findRank, rankGyms, METRICS } from '../lib/social'

const TABS = [
  { key: 'friends', label: 'Friends' },
  { key: 'gym', label: 'My gym' },
  { key: 'gyms', label: 'Gym vs gym' },
]

const medal = (rank) => (rank === 1 ? 'text-yellow-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600' : 'text-arc-muted')

export default function Leaderboard() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [myGymId, setMyGymId] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [gyms, setGyms] = useState([])
  const [friendships, setFriendships] = useState([])
  const [tab, setTab] = useState('gym')
  const [metric, setMetric] = useState('points')
  const [notReady, setNotReady] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data: me } = await supabase
        .from('profiles').select('gym_id').eq('id', user.id).single()
      setMyGymId(me?.gym_id || null)

      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, total_points, current_streak, gym_id')
      setProfiles(profs || [])

      const { data: gymRows, error: gymErr } = await supabase.from('gyms').select('*')
      if (gymErr) setNotReady(true)
      setGyms(gymRows || [])

      const { data: fr } = await supabase
        .from('friendships').select('*')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      setFriendships(fr || [])
    } catch {
      setNotReady(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const myFriendIds = useMemo(() => friendIds(friendships, userId), [friendships, userId])

  const rows = useMemo(() => {
    if (tab === 'gyms') return []
    let pool = profiles
    if (tab === 'friends') {
      // You're always on your own friends board, otherwise it reads as if you
      // aren't competing.
      const ids = new Set([...myFriendIds, userId])
      pool = profiles.filter(p => ids.has(p.id))
    } else if (tab === 'gym') {
      pool = profiles.filter(p => p.gym_id && p.gym_id === myGymId)
    }
    return rankPeople(pool, metric)
  }, [tab, profiles, myFriendIds, userId, myGymId, metric])

  const gymRows = useMemo(
    () => (tab === 'gyms' ? rankGyms(profiles, gyms, metric) : []),
    [tab, profiles, gyms, metric]
  )

  const myRank = findRank(rows, userId)
  const unit = METRICS[metric].short

  // The gap to whoever is directly above me in the list. Taken by position
  // rather than by rank, so a tie above me reads as 0 behind rather than
  // skipping past everyone on the same score.
  const gapAhead = useMemo(() => {
    const i = rows.findIndex(r => r.id === userId)
    if (i <= 0) return null
    return Math.max(0, rows[i - 1].score - rows[i].score)
  }, [rows, userId])

  if (loading) {
    return (
      <div className="min-h-screen bg-arc-bg text-white flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-arc-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/habits" className="p-2 -ml-2 text-arc-muted hover:text-white transition-colors">
              <ArrowLeftIcon />
            </Link>
            <h1 className="text-xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              LEADERBOARD
            </h1>
          </div>
          <Link href="/friends" className="text-[10px] font-bold text-arc-accent uppercase tracking-[0.15em] hover:text-white transition-colors shrink-0">
            Friends
          </Link>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-lg mx-auto space-y-4">
        {notReady && (
          <div className="bg-arc-card border border-amber-500/30 rounded-2xl p-5 text-center">
            <p className="text-sm text-amber-200">Leaderboards aren&apos;t set up yet — migration 032 needs to be run.</p>
          </div>
        )}

        {/* Who you're up against */}
        <div className="grid grid-cols-3 gap-2">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-2.5 rounded-xl text-[11px] font-bold transition-all border ${
                tab === t.key
                  ? 'bg-accent-gradient text-white border-transparent shadow-glow-accent'
                  : 'bg-arc-card text-arc-muted border-white/[0.06] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* What you're ranked on */}
        <div className="flex gap-2">
          {Object.entries(METRICS).map(([key, m]) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5 ${
                metric === key ? 'bg-arc-surface text-white border border-white/10' : 'text-arc-muted hover:text-white'
              }`}
            >
              {key === 'points' ? <TrophyIcon size={12} /> : <FlameIcon size={12} />}
              {m.label}
            </button>
          ))}
        </div>

        {/* Where you sit, without scrolling for it */}
        {tab !== 'gyms' && myRank && rows.length > 0 && (
          <div className="bg-arc-card border border-arc-accent/30 rounded-2xl p-4 flex items-center gap-4">
            <div className="text-center shrink-0">
              <div className={`text-2xl font-black italic leading-none ${medal(myRank)}`}>#{myRank}</div>
              <div className="text-[8px] text-arc-muted uppercase tracking-wider mt-1">of {rows.length}</div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-arc-muted">
                {myRank === 1
                  ? `Top of the ${tab === 'friends' ? 'friends' : 'gym'} board. Keep it.`
                  : gapAhead === 0
                    ? 'Level with the person above you. One session decides it.'
                    : `${gapAhead?.toLocaleString()} ${unit} behind the person above you.`}
              </p>
            </div>
          </div>
        )}

        {/* People */}
        {tab !== 'gyms' && (
          <div className="space-y-1.5">
            {rows.length === 0 && (
              <div className="bg-arc-card border border-white/5 rounded-2xl p-8 text-center space-y-2">
                <div className="flex justify-center text-arc-muted"><UsersIcon size={36} /></div>
                <h2 className="text-lg font-black italic tracking-tighter">
                  {tab === 'friends' ? 'NO FRIENDS YET' : 'NOBODY HERE YET'}
                </h2>
                <p className="text-sm text-arc-muted">
                  {tab === 'friends'
                    ? 'Add a few people and see who actually turns up.'
                    : 'Nobody at your gym has any points on the board yet.'}
                </p>
                {tab === 'friends' && (
                  <Link href="/friends" className="inline-block mt-2 bg-accent-gradient text-white font-black italic px-6 py-3 rounded-xl text-sm shadow-glow active:scale-95 transition-transform">
                    FIND PEOPLE
                  </Link>
                )}
              </div>
            )}

            {rows.map(r => (
              <div
                key={r.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                  r.id === userId ? 'bg-arc-accent/10 border-arc-accent/25' : 'bg-arc-card border-white/[0.04]'
                }`}
              >
                <span className={`text-[12px] font-black w-7 shrink-0 ${medal(r.rank)}`}>#{r.rank}</span>
                <Avatar src={r.avatar_url} name={r.username} size={30} />
                <span className="text-[13px] font-bold text-white truncate flex-1">
                  {r.id === userId ? 'You' : (r.username || 'Member')}
                </span>
                <span className="text-[13px] font-black text-arc-accent shrink-0">
                  {r.score.toLocaleString()}
                  <span className="text-[9px] text-arc-muted font-bold ml-1">{unit}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Gym vs gym */}
        {tab === 'gyms' && (
          <div className="space-y-3">
            <p className="text-[11px] text-arc-muted bg-arc-surface border border-white/5 rounded-xl p-3 leading-relaxed">
              Ranked on the <span className="text-white font-bold">average per member</span>, not the total, so a big
              gym can&apos;t win on numbers alone. Gyms with fewer than 3 members sit out.
            </p>

            <div className="space-y-1.5">
              {gymRows.map(g => (
                <div
                  key={g.id}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl border ${
                    g.id === myGymId ? 'bg-arc-accent/10 border-arc-accent/25' : 'bg-arc-card border-white/[0.04]'
                  } ${g.eligible ? '' : 'opacity-50'}`}
                >
                  <span className={`text-[12px] font-black w-7 shrink-0 ${medal(g.rank)}`}>
                    {g.rank ? `#${g.rank}` : '–'}
                  </span>
                  <Avatar src={g.avatar_url} name={g.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-white truncate">
                      {g.name}{g.id === myGymId && <span className="text-arc-accent text-[9px] ml-2 uppercase tracking-wider">Yours</span>}
                    </div>
                    <div className="text-[9px] text-arc-muted">
                      {g.members} member{g.members === 1 ? '' : 's'} · {g.total.toLocaleString()} {unit} total
                      {!g.eligible && ' · needs 3 to rank'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[13px] font-black text-arc-accent">{g.average.toLocaleString()}</div>
                    <div className="text-[8px] text-arc-muted uppercase tracking-wider">avg</div>
                  </div>
                </div>
              ))}
              {gymRows.length === 0 && (
                <p className="text-sm text-arc-muted text-center py-6">No gyms set up yet.</p>
              )}
            </div>
          </div>
        )}
      </main>

      <Nav />
    </div>
  )
}
