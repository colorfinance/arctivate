import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/router'
import Nav from '../components/Nav'
import LoadingState from '../components/LoadingState'
import { supabase } from '../lib/supabaseClient'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const fmtDate = (d) => {
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}
const todayKey = () => fmtDate(new Date())
const unitFor = (metric) => (metric === 'time' ? 'min' : metric === 'distance' ? 'km' : metric === 'reps' ? 'reps' : 'kg')

// Monday-based month grid (array of Date|null cells).
function buildMonth(year, month) {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function CalendarPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const now = new Date()
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [byDay, setByDay] = useState({}) // { key: { workouts:[], food:[] } }
  const [selected, setSelected] = useState(todayKey())
  const [copying, setCopying] = useState(false)

  const copyFoodToToday = async () => {
    if (copying) return
    const src = (byDay[selected]?.food) || []
    if (src.length === 0) return
    setCopying(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const rows = src.map((f) => ({ user_id: user.id, item_name: f.item_name, calories: f.calories, macros: f.macros }))
      const { error } = await supabase.from('food_logs').insert(rows)
      if (error) throw error
      router.push('/food')
    } catch {
      setCopying(false)
    }
  }

  useEffect(() => {
    const gate = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setIsLoading(false)
    }
    gate()
  }, [])

  useEffect(() => {
    if (!isLoading) loadMonth(cursor.year, cursor.month)
  }, [cursor, isLoading])

  async function loadMonth(year, month) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 1)
    const startIso = start.toISOString()
    const endIso = end.toISOString()

    const map = {}
    const ensure = (k) => (map[k] || (map[k] = { workouts: [], food: [] }))

    // Workouts
    try {
      const { data: workouts } = await supabase
        .from('workout_logs')
        .select('id, value, reps, sets, rpe, is_new_pb, created_at, exercises(name, metric_type)')
        .eq('user_id', user.id)
        .gte('created_at', startIso)
        .lt('created_at', endIso)
        .order('created_at', { ascending: false })
      ;(workouts || []).forEach((w) => {
        ensure(fmtDate(new Date(w.created_at))).workouts.push(w)
      })
    } catch {}

    // Food
    try {
      const { data: food } = await supabase
        .from('food_logs')
        .select('id, item_name, calories, macros, eaten_at')
        .eq('user_id', user.id)
        .gte('eaten_at', startIso)
        .lt('eaten_at', endIso)
        .order('eaten_at', { ascending: false })
      ;(food || []).forEach((f) => {
        ensure(fmtDate(new Date(f.eaten_at))).food.push(f)
      })
    } catch {}

    setByDay(map)
  }

  const goMonth = (delta) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  if (isLoading) return <LoadingState label="Loading your calendar…" />

  const cells = buildMonth(cursor.year, cursor.month)
  const sel = byDay[selected] || { workouts: [], food: [] }
  const selFoodCals = sel.food.reduce((s, f) => s + (f.calories || 0), 0)
  const selLabel = new Date(selected + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-28 font-sans">
      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="p-5 flex justify-between items-center max-w-lg mx-auto">
          <div>
            <h1 className="text-xl font-black italic tracking-tighter text-gradient-accent">ARCTIVATE</h1>
            <span className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em]">Calendar</span>
          </div>
          <button onClick={() => router.push(router.query.from === 'food' ? '/food' : '/train')} className="text-[10px] font-bold text-arc-accent uppercase tracking-[0.15em] hover:text-white transition-colors">
            ← {router.query.from === 'food' ? 'Food' : 'Train'}
          </button>
        </div>
      </header>

      <main className="pt-24 px-5 space-y-6 max-w-lg mx-auto">
        {/* Month grid */}
        <section className="bg-arc-card border border-white/[0.04] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <button onClick={() => goMonth(-1)} aria-label="Previous month"
              className="w-8 h-8 rounded-lg bg-arc-surface border border-white/[0.06] text-arc-muted hover:text-white transition-colors flex items-center justify-center">‹</button>
            <span className="text-sm font-black italic tracking-tight">{MONTHS[cursor.month]} {cursor.year}</span>
            <button onClick={() => goMonth(1)} aria-label="Next month"
              className="w-8 h-8 rounded-lg bg-arc-surface border border-white/[0.06] text-arc-muted hover:text-white transition-colors flex items-center justify-center">›</button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[8px] font-bold text-arc-muted uppercase tracking-wider py-1">{w}</div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />
              const key = fmtDate(d)
              const data = byDay[key]
              const hasWorkout = data && data.workouts.length > 0
              const hasFood = data && data.food.length > 0
              const isSelected = key === selected
              const isToday = key === todayKey()
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`relative flex flex-col items-center justify-center py-2 rounded-lg border transition-all ${
                    isSelected ? 'border-arc-accent/60 bg-arc-accent/10' : 'border-transparent hover:bg-arc-surface'
                  }`}
                >
                  <span className={`text-xs font-bold font-mono ${isToday ? 'text-arc-cyan' : 'text-white/90'}`}>{d.getDate()}</span>
                  <span className="flex gap-0.5 mt-1 h-1.5">
                    {hasWorkout && <span className="w-1.5 h-1.5 rounded-full bg-arc-accent" title="Workout" />}
                    {hasFood && <span className="w-1.5 h-1.5 rounded-full bg-arc-cyan" title="Food" />}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-center gap-4 text-[9px] text-arc-muted pt-1">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-arc-accent" /> Workout</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-arc-cyan" /> Food</span>
          </div>
        </section>

        {/* Selected day detail */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-black italic tracking-tight">{selLabel}</h2>
          </div>

          {/* Workouts */}
          <div className="space-y-2">
            <h3 className="text-[9px] font-bold text-arc-accent uppercase tracking-[0.2em] px-1">💪 Workouts</h3>
            {sel.workouts.length === 0 ? (
              <p className="text-[11px] text-arc-muted px-1">No workouts logged.</p>
            ) : (
              sel.workouts.map((w) => {
                const unit = unitFor(w.exercises?.metric_type)
                const scheme = [w.sets != null ? `${w.sets}×` : '', w.reps != null ? `${w.reps}` : ''].join('')
                return (
                  <div key={w.id} className={`bg-arc-card/60 border ${w.is_new_pb ? 'border-arc-accent/30' : 'border-white/[0.04]'} p-3 rounded-xl flex justify-between items-center`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-bold text-white truncate">{w.exercises?.name || 'Workout'}</span>
                      {w.is_new_pb && <span className="text-[8px] bg-accent-gradient text-arc-bg px-2 py-0.5 rounded-md font-black uppercase shrink-0">PB</span>}
                    </div>
                    <span className="text-[11px] text-arc-muted font-mono shrink-0">
                      {scheme && <span className="text-white/80">{scheme} · </span>}
                      <span className="text-white/90">{w.value}</span>{unit}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* Food */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[9px] font-bold text-arc-cyan uppercase tracking-[0.2em]">🥗 Food</h3>
              {sel.food.length > 0 && <span className="text-[10px] font-bold text-arc-muted">{selFoodCals} cal</span>}
            </div>
            {sel.food.length === 0 ? (
              <p className="text-[11px] text-arc-muted px-1">No food logged.</p>
            ) : (
              sel.food.map((f) => (
                <div key={f.id} className="bg-arc-card/60 border border-white/[0.04] p-3 rounded-xl flex justify-between items-center">
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white truncate block">{f.item_name}</span>
                    <span className="text-[10px] text-arc-muted capitalize">{f.macros?.meal_type || 'snack'}</span>
                  </div>
                  <span className="text-sm font-black text-arc-cyan shrink-0">{f.calories} cal</span>
                </div>
              ))
            )}
          </div>

          {/* Copy this day's food to today */}
          {sel.food.length > 0 && selected !== todayKey() && (
            <button
              onClick={copyFoodToToday}
              disabled={copying}
              className="w-full bg-arc-cyan/10 border border-arc-cyan/30 text-arc-cyan font-bold py-3 rounded-xl text-sm hover:bg-arc-cyan/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              {copying ? 'Copying…' : "Copy this day's food to today"}
            </button>
          )}

          {/* Quick add */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button onClick={() => router.push('/train')} className="bg-arc-surface border border-white/[0.06] text-white font-bold py-3 rounded-xl text-sm hover:border-arc-accent/30 transition-colors">
              Log a workout
            </button>
            <button onClick={() => router.push('/food')} className="bg-arc-surface border border-white/[0.06] text-white font-bold py-3 rounded-xl text-sm hover:border-arc-cyan/30 transition-colors">
              Log food
            </button>
          </div>
        </section>
      </main>

      <Nav />
    </div>
  )
}
