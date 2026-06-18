import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/router'
import Nav from '../components/Nav'
import LoadingState from '../components/LoadingState'
import { supabase } from '../lib/supabaseClient'

const TrophyIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
)

const unitFor = (metric) => (metric === 'time' ? 'min' : metric === 'distance' ? 'km' : metric === 'reps' ? 'reps' : 'kg')

const dayKey = (d) => {
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

const formatDayLabel = (key) => {
  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 86400000))
  if (key === today) return 'Today'
  if (key === yesterday) return 'Yesterday'
  const d = new Date(key + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function History() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [days, setDays] = useState([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data } = await supabase
        .from('workout_logs')
        .select('*, exercises(name, metric_type)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(400)

      const grouped = {}
      ;(data || []).forEach((log) => {
        const dt = new Date(log.created_at)
        const key = dayKey(dt)
        if (!grouped[key]) grouped[key] = []
        grouped[key].push({
          id: log.id,
          name: log.exercises?.name || 'Workout',
          metric: log.exercises?.metric_type || 'weight',
          value: log.value,
          reps: log.reps ?? null,
          sets: log.sets ?? null,
          rpe: log.rpe ?? null,
          isPB: log.is_new_pb || false,
          points: log.points_awarded || 0,
          time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        })
      })

      const ordered = Object.keys(grouped)
        .sort((a, b) => (a < b ? 1 : -1))
        .map((key) => {
          const entries = grouped[key]
          return {
            key,
            label: formatDayLabel(key),
            entries,
            totalSets: entries.length,
            totalPoints: entries.reduce((s, e) => s + e.points, 0),
            pbs: entries.filter((e) => e.isPB).length,
          }
        })

      setDays(ordered)
      setIsLoading(false)
    }
    load()
  }, [])

  if (isLoading) return <LoadingState label="Loading your history…" />

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-28 font-sans">
      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="p-5 flex justify-between items-center max-w-lg mx-auto">
          <div>
            <h1 className="text-xl font-black italic tracking-tighter text-gradient-accent">ARCTIVATE</h1>
            <span className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em]">Training History</span>
          </div>
          <button onClick={() => router.push('/train')} className="text-[10px] font-bold text-arc-accent uppercase tracking-[0.15em] hover:text-white transition-colors">
            ← Train
          </button>
        </div>
      </header>

      <main className="pt-24 px-5 space-y-6 max-w-lg mx-auto">
        {days.length === 0 && (
          <div className="text-center py-20">
            <p className="text-arc-muted text-sm">No workouts logged yet.</p>
            <button onClick={() => router.push('/train')} className="mt-4 bg-accent-gradient text-white font-bold px-6 py-3 rounded-xl shadow-glow-accent text-sm">
              Log your first set
            </button>
          </div>
        )}

        {days.map((day, di) => (
          <motion.section
            key={day.key}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(di * 0.04, 0.4) }}
            className="space-y-3"
          >
            {/* Day header */}
            <div className="flex items-end justify-between px-1">
              <h2 className="text-sm font-black italic tracking-tight">{day.label}</h2>
              <div className="flex items-center gap-3 text-[10px] font-bold text-arc-muted">
                <span>{day.totalSets} set{day.totalSets !== 1 ? 's' : ''}</span>
                <span className="text-arc-accent">+{day.totalPoints} pts</span>
                {day.pbs > 0 && (
                  <span className="flex items-center gap-1 text-arc-cyan"><TrophyIcon /> {day.pbs}</span>
                )}
              </div>
            </div>

            {/* Entries */}
            <div className="space-y-2">
              {day.entries.map((e) => {
                const unit = unitFor(e.metric)
                const scheme = [
                  e.sets != null ? `${e.sets}×` : '',
                  e.reps != null ? `${e.reps}` : '',
                ].join('')
                return (
                  <div
                    key={e.id}
                    className={`bg-arc-card/60 border ${e.isPB ? 'border-arc-accent/30 shadow-glow' : 'border-white/[0.04]'} p-4 rounded-xl flex justify-between items-center backdrop-blur-sm`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-white truncate">{e.name}</span>
                        {e.isPB && (
                          <span className="text-[8px] bg-accent-gradient text-arc-bg px-2 py-0.5 rounded-md font-black tracking-tight uppercase shrink-0">NEW PB</span>
                        )}
                      </div>
                      <div className="text-[11px] text-arc-muted font-mono">
                        {scheme && <span className="text-white/80">{scheme} · </span>}
                        <span className="text-white font-bold">{e.value}</span>
                        <span className="text-arc-muted ml-0.5">{unit}</span>
                        {e.rpe != null && <span className="ml-2 text-arc-muted">RPE {e.rpe}</span>}
                        <span className="ml-2 text-arc-muted/70">{e.time}</span>
                      </div>
                    </div>
                    <div className="font-mono text-arc-accent font-bold text-sm bg-arc-accent/10 px-2.5 py-1 rounded-lg shrink-0">+{e.points}</div>
                  </div>
                )
              })}
            </div>
          </motion.section>
        ))}
      </main>

      <Nav />
    </div>
  )
}
