import { useState, useEffect } from 'react'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'

export default function Train() {
  const [exercise, setExercise] = useState('bench_press')
  const [value, setValue] = useState('')
  const [currentPB, setCurrentPB] = useState(0)
  const [logs, setLogs] = useState([])
  const [points, setPoints] = useState(0)
  const [streak, setStreak] = useState(0)
  const [notif, setNotif] = useState(false)

  // Load Data
  useEffect(() => {
    fetchProfile()
    fetchPB(exercise)
  }, [exercise])

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.from('profiles').select('total_points, current_streak').eq('id', user.id).single()
    if (data) {
        setPoints(data.total_points || 0)
        setStreak(data.current_streak || 0)
    }
  }

  async function fetchPB(exName) {
    // In real app, we'd join with 'exercises' table. For MVP, we mock or query directly if we inserted exercises.
    // Simplifying: we'll just check local state or a simplified DB query for now to save time setting up Exercise seed data.
    // TODO: Connect to real DB for PBs
    setCurrentPB(100) // Mock
  }

  const handleLog = async () => {
    if (!value) return
    
    // Optimistic UI Update
    const pointsEarned = 50
    setPoints(prev => prev + pointsEarned)
    setLogs(prev => [{ name: exercise, val: value, points: pointsEarned, time: 'Just now' }, ...prev])
    
    // Save to DB (Fire & Forget for prototype speed)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        await supabase.from('workout_logs').insert({
            user_id: user.id,
            value: value,
            points_awarded: pointsEarned
        })
        
        // Update total points
        await supabase.rpc('increment_points', { row_id: user.id, x: pointsEarned })
    }

    setValue('')
  }

  return (
    <div className="min-h-screen flex flex-col pb-20">
        <header className="p-6 flex justify-between items-center border-b border-white/5">
            <h1 className="text-2xl font-black tracking-tighter italic">ARCTIVATE</h1>
            <div className="flex items-center gap-2 bg-arc-card px-3 py-1 rounded-full border border-white/10">
                <span className="text-arc-accent text-lg">★</span>
                <span className="font-mono font-bold">{points}</span>
            </div>
        </header>

        <main className="flex-1 p-6 space-y-8">
            {/* Stats */}
            <section className="grid grid-cols-2 gap-4">
                <div className="glass-panel p-4 rounded-xl flex flex-col items-center justify-center">
                    <span className="text-arc-muted text-xs uppercase tracking-widest mb-1">Streak</span>
                    <span className="text-3xl font-black font-mono">{streak}</span>
                    <span className="text-xs text-green-500 font-bold">DAYS 🔥</span>
                </div>
                <div className="glass-panel p-4 rounded-xl flex flex-col items-center justify-center">
                    <span className="text-arc-muted text-xs uppercase tracking-widest mb-1">Today</span>
                    <span className="text-3xl font-black font-mono text-arc-accent">+50</span>
                    <span className="text-xs text-arc-muted">POINTS</span>
                </div>
            </section>

            {/* Logger */}
            <section>
                <div className="glass-panel p-5 rounded-2xl space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-arc-muted mb-2 uppercase">Movement</label>
                        <select 
                            value={exercise} 
                            onChange={(e) => setExercise(e.target.value)} 
                            className="w-full bg-[#27272a] border border-[#3f3f46] text-white p-3 rounded-lg font-bold"
                        >
                            <option value="bench_press">Bench Press (kg)</option>
                            <option value="deadlift">Deadlift (kg)</option>
                            <option value="5k_run">5k Run (min)</option>
                        </select>
                    </div>

                    <div className="flex justify-between items-center bg-black/30 p-3 rounded-lg border border-white/5">
                        <span className="text-xs text-arc-muted">Current PB:</span>
                        <span className="font-mono font-bold text-arc-accent">{currentPB}</span>
                    </div>

                    <input 
                        type="number" 
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="Value" 
                        className="w-full bg-[#27272a] border border-[#3f3f46] text-white p-3 rounded-lg font-mono text-xl text-center"
                    />

                    <button onClick={handleLog} className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-900/20 text-lg active:scale-95 transition">
                        LOG ACTIVITY
                    </button>
                </div>
            </section>

            {/* Feed */}
            <section className="space-y-3">
                {logs.map((log, i) => (
                    <div key={i} className="glass-panel p-3 rounded-lg flex justify-between items-center">
                        <div>
                            <div className="font-bold text-sm capitalize">{log.name.replace('_', ' ')}</div>
                            <div className="text-xs text-arc-muted">{log.time}</div>
                        </div>
                        <div className="font-mono text-arc-accent font-bold text-sm">+{log.points}</div>
                    </div>
                ))}
            </section>
        </main>

        <Nav />
    </div>
  )
}
