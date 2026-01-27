import { useState, useEffect } from 'react'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import confetti from 'canvas-confetti'

export default function Train() {
  const [exercise, setExercise] = useState('bench_press')
  const [value, setValue] = useState('')
  const [currentPB, setCurrentPB] = useState(0)
  const [logs, setLogs] = useState([])
  const [points, setPoints] = useState(0)
  const [streak, setStreak] = useState(0)

  // Load Data
  useEffect(() => {
    fetchProfile()
    fetchPB(exercise)
    // Also fetch recent logs for this session if we wanted
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
    // Mock PB for now (100 for bench, 140 for deadlift, 25 for run)
    const mocks = { bench_press: 100, deadlift: 140, '5k_run': 25 }
    setCurrentPB(mocks[exName] || 0)
  }

  const handleLog = async () => {
    if (!value) return
    const valNum = parseFloat(value)
    
    // Check PB Logic
    let isPB = false
    let pointsEarned = 50

    // For runs, lower is usually better, but keeping simple "Higher is better" logic for MVP demo
    // or specifically handling run:
    if (exercise === '5k_run') {
        if (valNum < currentPB && currentPB > 0) isPB = true
    } else {
        if (valNum > currentPB) isPB = true
    }

    if (isPB) {
        pointsEarned += 100
        triggerCelebration()
        setCurrentPB(valNum) // Update local PB instantly
    }
    
    // Formatted Date
    const now = new Date()
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const dateString = now.toLocaleDateString([], { month: 'short', day: 'numeric' })
    const fullTimestamp = `${dateString} at ${timeString}`

    // Optimistic UI Update
    setPoints(prev => prev + pointsEarned)
    setLogs(prev => [{ 
        name: exercise, 
        val: valNum, 
        points: pointsEarned, 
        time: fullTimestamp,
        isPB: isPB
    }, ...prev])
    
    // Save to DB
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        await supabase.from('workout_logs').insert({
            user_id: user.id,
            value: valNum,
            is_new_pb: isPB,
            points_awarded: pointsEarned
        })
        
        // Update total points
        await supabase.rpc('increment_points', { row_id: user.id, x: pointsEarned })
    }

    setValue('')
  }

  const triggerCelebration = () => {
    const duration = 3 * 1000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    const randomInRange = (min, max) => Math.random() * (max - min) + min

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
      // since particles fall down, start a bit higher than random
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } })
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } })
    }, 250)
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
                    <span className="text-3xl font-black font-mono text-arc-accent">+{logs.reduce((acc, curr) => acc + curr.points, 0)}</span>
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
                    <div key={i} className={`glass-panel p-3 rounded-lg flex justify-between items-center border ${log.isPB ? 'border-arc-accent/50 bg-arc-accent/10' : 'border-transparent'}`}>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm capitalize">{log.name.replace('_', ' ')}</span>
                                {log.isPB && <span className="text-[10px] bg-arc-accent text-white px-1 rounded font-bold">PB 🏆</span>}
                            </div>
                            <div className="text-xs text-arc-muted">{log.time} • {log.val}</div>
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
