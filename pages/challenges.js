import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import {
  challengeDay, challengeProgress, daysRemaining, daysUntilStart,
  isFinished, hasStarted, findFirstMissedDay, cohortStats, rankMembers, todayStr,
} from '../lib/challenges'

const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
)

export default function Challenges() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [challenges, setChallenges] = useState([])
  const [members, setMembers] = useState([])       // every membership row, all challenges
  const [names, setNames] = useState({})           // user_id -> display name
  const [busy, setBusy] = useState(null)           // challenge id being joined/left
  const [toast, setToast] = useState(null)
  const [confirmJoin, setConfirmJoin] = useState(null)
  const [confirmLeave, setConfirmLeave] = useState(null)
  const [resetNotice, setResetNotice] = useState(null) // { title, missed }
  const [expanded, setExpanded] = useState(null)
  const [missingTables, setMissingTables] = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600) }

  const fetchAll = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data: chData, error: chErr } = await supabase
        .from('group_challenges')
        .select('*')
        .order('start_date', { ascending: false })

      if (chErr) { setMissingTables(true); setLoading(false); return }
      setChallenges(chData || [])

      const { data: memberData } = await supabase
        .from('group_challenge_members')
        .select('*')
      setMembers(memberData || [])

      // Names for the standings.
      const ids = [...new Set((memberData || []).map(m => m.user_id))]
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ids)
        const map = {}
        ;(profs || []).forEach(p => { map[p.id] = p.full_name || (p.email || '').split('@')[0] || 'Member' })
        setNames(map)
      }

      await enforceStrict(user.id, chData || [], memberData || [])
    } catch {
      setMissingTables(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Strict challenges send you back to your own Day 1 if you miss a day.
  // Checked here on load, using the same rule the personal challenge uses.
  const enforceStrict = async (uid, chList, memberList) => {
    const mine = memberList.filter(m => m.user_id === uid && m.status === 'active')
    const strictOnes = mine
      .map(m => ({ m, ch: chList.find(c => c.id === m.challenge_id) }))
      .filter(x => x.ch && x.ch.strict && hasStarted(x.ch.start_date))
    if (strictOnes.length === 0) return

    const { data: habitsData } = await supabase
      .from('habits')
      .select('id, created_at, frequency')
      .eq('user_id', uid)
    const dailyHabits = (habitsData || []).filter(h => (h.frequency || 'daily') !== 'weekly')
    if (dailyHabits.length === 0) return

    const earliest = strictOnes.map(x => x.m.start_date).sort()[0]
    const { data: logs } = await supabase
      .from('habit_logs')
      .select('habit_id, date')
      .eq('user_id', uid)
      .gte('date', earliest)

    for (const { m, ch } of strictOnes) {
      const missed = findFirstMissedDay({ dailyHabits, logs: logs || [], startDate: m.start_date })
      if (!missed) continue
      const today = todayStr()
      const { error } = await supabase
        .from('group_challenge_members')
        .update({ start_date: today, restarts: (m.restarts || 0) + 1, last_checked: today })
        .eq('id', m.id)
      if (!error) {
        setResetNotice({ title: ch.title, missed })
        setMembers(prev => prev.map(r => r.id === m.id
          ? { ...r, start_date: today, restarts: (r.restarts || 0) + 1 } : r))
      }
    }
  }

  const myRow = (challengeId) => members.find(m => m.challenge_id === challengeId && m.user_id === userId)

  const join = async (ch) => {
    if (busy) return
    setBusy(ch.id)
    try {
      // Someone joining before the start waits for it; joining later starts today.
      const start = hasStarted(ch.start_date) ? todayStr() : String(ch.start_date).slice(0, 10)
      const existing = myRow(ch.id)
      if (existing) {
        // Rejoining something they'd left.
        const { error } = await supabase
          .from('group_challenge_members')
          .update({ status: 'active', start_date: start, last_checked: todayStr() })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('group_challenge_members').insert({
          challenge_id: ch.id,
          user_id: userId,
          start_date: start,
          last_checked: todayStr(),
        })
        if (error) throw error
      }
      setConfirmJoin(null)
      await fetchAll()
      showToast(`You're in — ${ch.title}`)
    } catch {
      showToast('Could not join (run migration 031)')
    } finally {
      setBusy(null)
    }
  }

  const leave = async (ch) => {
    if (busy) return
    setBusy(ch.id)
    try {
      const row = myRow(ch.id)
      if (!row) return
      const { error } = await supabase
        .from('group_challenge_members')
        .update({ status: 'left' })
        .eq('id', row.id)
      if (error) throw error
      setConfirmLeave(null)
      await fetchAll()
      showToast(`Left ${ch.title}`)
    } catch {
      showToast('Could not leave')
    } finally {
      setBusy(null)
    }
  }

  const today = todayStr()

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
        <div className="flex items-center gap-3">
          <Link href="/habits" className="p-2 -ml-2 text-arc-muted hover:text-white transition-colors">
            <ArrowLeftIcon />
          </Link>
          <h1 className="text-xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            CHALLENGES
          </h1>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-lg mx-auto space-y-4">
        {missingTables && (
          <div className="bg-arc-card border border-amber-500/30 rounded-2xl p-5 text-center">
            <p className="text-sm text-amber-200">Challenges aren&apos;t set up yet — migration 031 needs to be run.</p>
          </div>
        )}

        {!missingTables && challenges.length === 0 && (
          <div className="bg-arc-card border border-white/5 rounded-2xl p-8 text-center space-y-2">
            <div className="text-4xl">🏁</div>
            <h2 className="text-lg font-black italic tracking-tighter">NOTHING RUNNING YET</h2>
            <p className="text-sm text-arc-muted">When your coach sets a challenge up, it&apos;ll appear here to join.</p>
          </div>
        )}

        {challenges.map(ch => {
          const all = members.filter(m => m.challenge_id === ch.id)
          const mine = all.find(m => m.user_id === userId)
          const joined = mine && mine.status !== 'left'
          const stats = cohortStats(all, ch, today)
          const started = hasStarted(ch.start_date, today)
          const day = joined ? challengeDay(mine.start_date, today) : 0
          const done = joined && isFinished(day, ch.length_days)
          const pct = challengeProgress(day, ch.length_days)
          const untilStart = daysUntilStart(ch.start_date, today)
          const standings = rankMembers(all, today)

          return (
            <motion.section
              key={ch.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`bg-arc-card border rounded-2xl overflow-hidden ${joined ? 'border-arc-accent/30' : 'border-white/5'}`}
            >
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-black italic tracking-tighter leading-tight">{ch.title}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-arc-muted font-bold uppercase tracking-wider">
                        {ch.length_days} days
                      </span>
                      {ch.strict && (
                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          🔒 Strict
                        </span>
                      )}
                      {!started && (
                        <span className="text-[9px] font-bold text-arc-cyan bg-arc-cyan/10 border border-arc-cyan/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Starts in {untilStart}d
                        </span>
                      )}
                      {!ch.is_active && (
                        <span className="text-[9px] font-bold text-arc-muted bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>
                  {joined && (
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-black italic text-arc-accent leading-none">
                        {done ? '✓' : started ? day : '—'}
                      </div>
                      <div className="text-[9px] text-arc-muted uppercase tracking-wider mt-0.5">
                        {done ? 'Done' : started ? 'Day' : 'Waiting'}
                      </div>
                    </div>
                  )}
                </div>

                {ch.description && (
                  <p className="text-[13px] text-arc-muted leading-relaxed">{ch.description}</p>
                )}

                {joined && started && !done && (
                  <>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        className="h-full bg-gradient-to-r from-arc-accent to-arc-cyan"
                      />
                    </div>
                    <p className="text-[10px] text-arc-muted">
                      {daysRemaining(day, ch.length_days)} days to go
                      {mine.restarts > 0 && ` · restarted ${mine.restarts}×`}
                    </p>
                  </>
                )}

                {done && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
                    <p className="text-sm font-bold text-green-400">Finished — all {ch.length_days} days 🏆</p>
                  </div>
                )}

                {/* How the group is doing */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'In', value: stats.total },
                    { label: 'Clean run', value: stats.clean },
                    { label: 'Furthest', value: stats.longestDay || '—' },
                  ].map(s => (
                    <div key={s.label} className="bg-arc-surface border border-white/5 rounded-xl py-2 text-center">
                      <div className="text-base font-black text-white leading-none">{s.value}</div>
                      <div className="text-[8px] text-arc-muted uppercase tracking-wider mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  {joined ? (
                    <>
                      <button
                        onClick={() => setExpanded(expanded === ch.id ? null : ch.id)}
                        className="flex-1 bg-arc-surface border border-white/5 text-arc-muted hover:text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
                      >
                        {expanded === ch.id ? 'Hide standings' : 'Standings'}
                      </button>
                      <button
                        onClick={() => setConfirmLeave(ch)}
                        disabled={busy === ch.id}
                        className="px-4 bg-white/5 text-arc-muted hover:text-white text-xs font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                      >
                        Leave
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => (ch.strict ? setConfirmJoin(ch) : join(ch))}
                      disabled={busy === ch.id || !ch.is_active}
                      className="flex-1 bg-accent-gradient text-white font-black italic py-3 rounded-xl shadow-glow active:scale-95 transition-transform disabled:opacity-40"
                    >
                      {busy === ch.id ? 'JOINING…' : !ch.is_active ? 'CLOSED' : mine ? 'REJOIN' : 'JOIN'}
                    </button>
                  )}
                </div>
              </div>

              {/* Standings */}
              <AnimatePresence>
                {expanded === ch.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-white/5"
                  >
                    <div className="p-4 space-y-1.5">
                      {standings.length === 0 && (
                        <p className="text-xs text-arc-muted text-center py-2">Nobody has joined yet.</p>
                      )}
                      {standings.map((m, i) => (
                        <div
                          key={m.id}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl ${m.user_id === userId ? 'bg-arc-accent/10 border border-arc-accent/20' : 'bg-arc-surface'}`}
                        >
                          <span className="text-[10px] font-black text-arc-muted w-5 shrink-0">{i + 1}</span>
                          <span className="text-[12px] font-bold text-white truncate flex-1">
                            {m.user_id === userId ? 'You' : (names[m.user_id] || 'Member')}
                          </span>
                          {m.restarts > 0 && (
                            <span className="text-[9px] text-arc-muted shrink-0">{m.restarts}× restart</span>
                          )}
                          <span className="text-[11px] font-black text-arc-accent shrink-0">
                            {m.status === 'completed' ? '🏆' : `D${m.day}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          )
        })}
      </main>

      {/* Joining something strict is worth spelling out */}
      <AnimatePresence>
        {confirmJoin && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmJoin(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-8 z-50 space-y-6 pb-safe"
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
              <div className="text-center">
                <div className="text-4xl mb-3">🔒</div>
                <h2 className="text-xl font-black italic tracking-tighter">{confirmJoin.title.toUpperCase()}</h2>
                <p className="text-sm text-arc-muted mt-2 leading-relaxed">
                  This one is strict. Miss a single day of your daily habits and you go{' '}
                  <span className="text-white font-bold">back to Day 1</span> of the challenge.
                </p>
              </div>
              <div className="bg-arc-surface border border-white/5 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2.5">
                  <span className="text-green-500 text-xs mt-0.5">✓</span>
                  <span className="text-[12px] text-arc-muted leading-snug">Your first day and today are safe — only finished days count against you</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="text-green-500 text-xs mt-0.5">✓</span>
                  <span className="text-[12px] text-arc-muted leading-snug">Points, photos and history are never lost, and you can leave anytime</span>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => join(confirmJoin)}
                  disabled={busy === confirmJoin.id}
                  className="w-full bg-amber-500 text-arc-bg font-bold py-4 rounded-xl text-lg active:scale-95 transition-transform disabled:opacity-50"
                >
                  {busy === confirmJoin.id ? 'JOINING…' : "I'M IN"}
                </button>
                <button
                  onClick={() => setConfirmJoin(null)}
                  className="w-full bg-white/5 text-arc-muted font-bold py-3 rounded-xl text-sm hover:text-white transition-colors"
                >
                  Not for me
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Leaving */}
      <AnimatePresence>
        {confirmLeave && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmLeave(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6"
            >
              <div className="bg-arc-card border border-white/10 rounded-[2rem] p-8 w-full max-w-sm text-center space-y-5">
                <h2 className="text-xl font-black italic tracking-tighter">LEAVE {confirmLeave.title.toUpperCase()}?</h2>
                <p className="text-sm text-arc-muted">
                  Your habits and points stay exactly as they are. You can rejoin later, but you&apos;ll start from Day 1.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => leave(confirmLeave)}
                    disabled={busy === confirmLeave.id}
                    className="w-full bg-red-500/90 text-white font-bold py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {busy === confirmLeave.id ? 'LEAVING…' : 'LEAVE'}
                  </button>
                  <button
                    onClick={() => setConfirmLeave(null)}
                    className="w-full bg-white/5 text-arc-muted font-bold py-3 rounded-xl text-sm hover:text-white transition-colors"
                  >
                    Stay in
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* A strict challenge reset them */}
      <AnimatePresence>
        {resetNotice && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setResetNotice(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60]"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-6"
            >
              <div className="bg-arc-card border border-amber-500/40 rounded-[2rem] p-8 w-full max-w-sm text-center space-y-5">
                <div className="text-5xl">🔒</div>
                <div>
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.2em] mb-2">{resetNotice.title}</div>
                  <h2 className="text-2xl font-black italic tracking-tighter leading-tight">BACK TO DAY 1</h2>
                </div>
                <p className="text-sm text-arc-muted leading-relaxed">
                  Your daily habits weren&apos;t all ticked on{' '}
                  <span className="text-white font-bold">
                    {new Date(resetNotice.missed + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                  . You knew the deal when you joined. Everything you&apos;ve earned is still yours.
                </p>
                <button
                  onClick={() => setResetNotice(null)}
                  className="w-full bg-arc-accent text-white font-black italic py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform"
                >
                  GO AGAIN
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Nav />
    </div>
  )
}
