import { useState, useEffect } from 'react'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import confetti from 'canvas-confetti'

export default function Train() {
  const [exercises, setExercises] = useState([])
  const [selectedExId, setSelectedExId] = useState('')
  const [value, setValue] = useState('')
  const [currentPB, setCurrentPB] = useState(0)
  const [logs, setLogs] = useState([])
  const [points, setPoints] = useState(0)
  const [streak, setStreak] = useState(0)
  
  // New Exercise State
  const [isAdding, setIsAdding] = useState(false)
  const [newExName, setNewExName] = useState('')
  const [newExType, setNewExType] = useState('weight')

  // Load Data
  useEffect(() => {
    fetchProfile()
    fetchExercises()
  }, [])

  useEffect(() => {
    if(selectedExId) fetchPB(selectedExId)
  }, [selectedExId])

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase.from('profiles').select('total_points, current_streak').eq('id', user.id).single()
    if (data) {
        setPoints(data.total_points || 0)
        setStreak(data.current_streak || 0)
    }
  }

  async function fetchExercises() {
    const { data: { user } } = await supabase.auth.getUser()
    
    // Fetch Global (user_id is null) OR Own (user_id = me)
    const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order('name', { ascending: true })

    if (data && data.length > 0) {
        setExercises(data)
        setSelectedExId(data[0].id)
    }
  }

  async function fetchPB(exId) {
    const { data: { user } } = await supabase.auth.getUser()
    
    // Get the exercise details to know if we want MAX (weight) or MIN (time)
    const ex = exercises.find(e => e.id === exId)
    const isTime = ex?.metric_type === 'time'
    
    // Simple PB fetch: Get best single log
    const { data } = await supabase
        .from('workout_logs')
        .select('value')
        .eq('user_id', user.id)
        .eq('exercise_id', exId)
        .order('value', { ascending: !isTime }) // Ascending for time (lower is better), Descending for weight
        .limit(1)
        .single()

    setCurrentPB(data?.value || 0)
  }

  const createExercise = async () => {
    if(!newExName) return
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error } = await supabase.from('exercises').insert({
        user_id: user.id,
        name: newExName,
        metric_type: newExType
    }).select().single()

    if (error) {
        alert("Error saving: " + error.message)
        console.error(error)
        return
    }

    if (data) {
        setExercises([...exercises, data])
        setSelectedExId(data.id)
        setIsAdding(false)
        setNewExName('')
    }
  }

  const handleLog = async () => {
    if (!value) return
    const valNum = parseFloat(value)
    const { data: { user } } = await supabase.auth.getUser()
    const ex = exercises.find(e => e.id === selectedExId)
    
    // Check PB Logic
    let isPB = false
    let pointsEarned = 50

    if (ex.metric_type === 'time') {
        // Lower is better for time, assuming currentPB > 0 (otherwise first run is PB)
        if ((valNum < currentPB || currentPB === 0) && valNum > 0) isPB = true
    } else {
        // Higher is better for weight/reps
        if (valNum > currentPB) isPB = true
    }

    if (isPB) {
        pointsEarned += 100
        triggerCelebration()
        setCurrentPB(valNum)
    }
    
    // Formatted Date
    const now = new Date()
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const dateString = now.toLocaleDateString([], { month: 'short', day: 'numeric' })
    const fullTimestamp = `${dateString} at ${timeString}`

    // Optimistic UI Update
    setPoints(prev => prev + pointsEarned)
    setLogs(prev => [{ 
        name: ex.name, 
        val: valNum, 
        points: pointsEarned, 
        time: fullTimestamp,
        isPB: isPB
    }, ...prev])
    
    // Save to DB
    await supabase.from('workout_logs').insert({
        user_id: user.id,
        exercise_id: selectedExId,
        value: valNum,
        is_new_pb: isPB,
        points_awarded: pointsEarned
    })
    
    // Update total points
    await supabase.rpc('increment_points', { row_id: user.id, x: pointsEarned })

    setValue('')
  }

  const triggerCelebration = () => {
    const duration = 3 * 1000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }
    const randomInRange = (min, max) => Math.random() * (max - min) + min
    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now()
      if (timeLeft <= 0) return clearInterval(interval)
      const particleCount = 50 * (timeLeft / duration)
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
                    
                    {/* Exercise Select Header */}
                    <div className="flex justify-between items-end">
                        <label className="block text-xs font-bold text-arc-muted uppercase">Movement</label>
                        {!isAdding && (
                            <button onClick={() => setIsAdding(true)} className="text-xs text-arc-accent font-bold uppercase hover:text-white transition">
                                + New
                            </button>
                        )}
                    </div>

                    {isAdding ? (
                        <div className="bg-black/30 p-3 rounded-lg border border-arc-accent/50 space-y-2 animate-in fade-in slide-in-from-top-2">
                            <input 
                                type="text" 
                                placeholder="Exercise Name (e.g. Pull Ups)"
                                className="w-full bg-transparent border-b border-white/10 p-2 text-white outline-none font-bold placeholder-gray-600"
                                value={newExName}
                                onChange={(e) => setNewExName(e.target.value)}
                                autoFocus
                            />
                            <div className="flex gap-2 text-xs">
                                <button 
                                    onClick={() => setNewExType('weight')}
                                    className={`px-3 py-1 rounded-full border ${newExType === 'weight' ? 'bg-white text-black border-white' : 'border-white/20 text-gray-400'}`}
                                >
                                    Weight (kg)
                                </button>
                                <button 
                                    onClick={() => setNewExType('time')}
                                    className={`px-3 py-1 rounded-full border ${newExType === 'time' ? 'bg-white text-black border-white' : 'border-white/20 text-gray-400'}`}
                                >
                                    Time (min)
                                </button>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={createExercise} className="flex-1 bg-arc-accent text-white text-xs font-bold py-2 rounded">SAVE</button>
                                <button onClick={() => setIsAdding(false)} className="flex-1 bg-white/10 text-white text-xs font-bold py-2 rounded">CANCEL</button>
                            </div>
                        </div>
                    ) : (
                        <select 
                            value={selectedExId} 
                            onChange={(e) => setSelectedExId(e.target.value)} 
                            className="w-full bg-[#27272a] border border-[#3f3f46] text-white p-3 rounded-lg font-bold"
                        >
                            {exercises.map(ex => (
                                <option key={ex.id} value={ex.id}>{ex.name}</option>
                            ))}
                        </select>
                    )}

                    <div className="flex justify-between items-center bg-black/30 p-3 rounded-lg border border-white/5">
                        <span className="text-xs text-arc-muted">Current PB:</span>
                        <span className="font-mono font-bold text-arc-accent">
                            {currentPB} 
                            <span className="text-[10px] text-gray-500 ml-1">
                                {exercises.find(e => e.id === selectedExId)?.metric_type === 'time' ? 'min' : 'kg'}
                            </span>
                        </span>
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
                                <span className="font-bold text-sm capitalize">{log.name}</span>
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
