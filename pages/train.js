import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import confetti from 'canvas-confetti'

// Components
const NumberTicker = ({ value }) => {
  return (
    <motion.span
      key={value}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="font-mono font-bold"
    >
      {value.toLocaleString()}
    </motion.span>
  )
}

const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, x: '-50%' }}
      animate={{ opacity: 1, y: 20, x: '-50%' }}
      exit={{ opacity: 0, y: -20, x: '-50%' }}
      className="fixed top-0 left-1/2 z-50 bg-arc-surface border border-white/10 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md"
    >
      <div className="w-2 h-2 rounded-full bg-arc-accent animate-pulse" />
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  )
}

export default function Train() {
  const [exercises, setExercises] = useState([])
  const [selectedExId, setSelectedExId] = useState('')
  const [value, setValue] = useState('')
  const [currentPB, setCurrentPB] = useState(0)
  const [logs, setLogs] = useState([])
  const [points, setPoints] = useState(0)
  const [streak, setStreak] = useState(0)
  
  // UI States
  const [isAdding, setIsAdding] = useState(false)
  const [newExName, setNewExName] = useState('')
  const [newExType, setNewExType] = useState('weight')
  const [toast, setToast] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load Data
  useEffect(() => {
    const load = async () => {
        await Promise.all([fetchProfile(), fetchExercises()])
        setIsLoading(false)
    }
    load()
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
    const { data } = await supabase
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
    const ex = exercises.find(e => e.id === exId)
    const isTime = ex?.metric_type === 'time'
    
    const { data } = await supabase
        .from('workout_logs')
        .select('value')
        .eq('user_id', user.id)
        .eq('exercise_id', exId)
        .order('value', { ascending: !isTime })
        .limit(1)
        .single()

    setCurrentPB(data?.value || 0)
  }

  const showToast = (msg) => setToast(msg)

  const createExercise = async () => {
    if(!newExName) return
    const { data: { user } } = await supabase.auth.getUser()
    
    const { data, error } = await supabase.from('exercises').insert({
        user_id: user.id,
        name: newExName,
        metric_type: newExType
    }).select().single()

    if (error) {
        showToast(`Error: ${error.message}`)
        return
    }

    if (data) {
        setExercises([...exercises, data])
        setSelectedExId(data.id)
        setIsAdding(false)
        setNewExName('')
        showToast("Exercise Created")
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
        if ((valNum < currentPB || currentPB === 0) && valNum > 0) isPB = true
    } else {
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
    const fullTimestamp = `${timeString}`

    // Optimistic UI Update
    setPoints(prev => prev + pointsEarned)
    setLogs(prev => [{ 
        name: ex.name, 
        val: valNum, 
        points: pointsEarned, 
        time: fullTimestamp,
        isPB: isPB
    }, ...prev])
    
    showToast(`Logged! +${pointsEarned} PTS`)

    // Save to DB
    await supabase.from('workout_logs').insert({
        user_id: user.id,
        exercise_id: selectedExId,
        value: valNum,
        is_new_pb: isPB,
        points_awarded: pointsEarned
    })
    
    await supabase.rpc('increment_points', { row_id: user.id, x: pointsEarned })
    setValue('')
  }

  const triggerCelebration = () => {
    const duration = 2 * 1000
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0, colors: ['#FF3B00', '#ffffff'] }
    confetti({ ...defaults, particleCount: 50, origin: { y: 0.6 } })
    setTimeout(() => confetti({ ...defaults, particleCount: 50, origin: { y: 0.6 } }), 200)
  }

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans selection:bg-arc-accent selection:text-white">
        <AnimatePresence>
            {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        </AnimatePresence>

        {/* Header */}
        <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5 p-6 flex justify-between items-center">
            <h1 className="text-xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                ARCTIVATE
            </h1>
            <div className="flex items-center gap-2 bg-arc-card px-4 py-1.5 rounded-full border border-white/5 shadow-inner">
                <span className="text-arc-accent text-lg drop-shadow-[0_0_8px_rgba(255,59,0,0.5)]">★</span>
                <NumberTicker value={points} />
            </div>
        </header>

        <main className="pt-28 px-6 space-y-8 max-w-lg mx-auto">
            
            {/* Stats Cards */}
            <section className="grid grid-cols-2 gap-4">
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-glass-gradient border border-white/5 p-5 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-arc-muted text-[10px] font-bold uppercase tracking-widest mb-1">Streak</span>
                    <span className="text-4xl font-black font-mono tracking-tighter">{streak}</span>
                    <span className="text-[10px] text-green-500 font-bold tracking-wider mt-1">DAYS ACTIVE</span>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-glass-gradient border border-white/5 p-5 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden"
                >
                     <div className="absolute top-0 right-0 w-16 h-16 bg-arc-accent/10 blur-2xl rounded-full" />
                    <span className="text-arc-muted text-[10px] font-bold uppercase tracking-widest mb-1">Today</span>
                    <div className="flex items-baseline gap-1 text-arc-accent">
                        <span className="text-lg font-bold">+</span>
                        <span className="text-4xl font-black font-mono tracking-tighter">{logs.reduce((acc, curr) => acc + curr.points, 0)}</span>
                    </div>
                    <span className="text-[10px] text-arc-muted font-bold tracking-wider mt-1">EARNED</span>
                </motion.div>
            </section>

            {/* Logger Input */}
            <motion.section 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
                className="bg-arc-card border border-white/5 p-1 rounded-[2rem] shadow-2xl relative"
            >
                <div className="bg-arc-bg rounded-[1.8rem] p-6 space-y-6 border border-white/5 relative z-10">
                    
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Select Movement</label>
                        <button onClick={() => setIsAdding(true)} className="text-[10px] font-bold text-arc-accent uppercase tracking-widest hover:text-white transition-colors">
                            + Create New
                        </button>
                    </div>

                    <div className="relative">
                        <select 
                            value={selectedExId} 
                            onChange={(e) => setSelectedExId(e.target.value)} 
                            className="w-full bg-arc-surface border border-white/5 text-white p-4 rounded-xl font-bold appearance-none outline-none focus:border-arc-accent/50 transition-colors"
                        >
                            {exercises.map(ex => (
                                <option key={ex.id} value={ex.id}>{ex.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-arc-muted">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-2">
                         <span className="text-xs text-arc-muted font-medium">Personal Best</span>
                         <span className="font-mono font-bold text-arc-accent text-lg">{currentPB} <span className="text-xs text-arc-muted">kg</span></span>
                    </div>

                    <div className="relative group">
                         <input 
                            type="number" 
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="0.0" 
                            className="w-full bg-transparent border-b-2 border-white/10 text-center font-mono text-5xl font-black text-white py-4 outline-none focus:border-arc-accent transition-colors placeholder-white/5"
                        />
                        <span className="absolute right-0 bottom-6 text-arc-muted font-bold text-sm">KG</span>
                    </div>

                    <motion.button 
                        whileTap={{ scale: 0.98 }}
                        onClick={handleLog} 
                        disabled={!value}
                        className="w-full bg-arc-accent text-white font-black italic tracking-wider py-5 rounded-xl shadow-glow text-lg disabled:opacity-50 disabled:shadow-none transition-all hover:bg-[#ff5522]"
                    >
                        LOG SET
                    </motion.button>
                </div>
                
                {/* Glow behind card */}
                <div className="absolute -inset-1 bg-gradient-to-b from-arc-accent/20 to-transparent blur-xl opacity-30 rounded-[2rem] -z-10" />
            </motion.section>

            {/* Recent Activity Feed */}
            <section className="space-y-4">
                 <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest px-2">Recent Activity</h3>
                 <div className="space-y-3 pb-10">
                    <AnimatePresence initial={false}>
                        {logs.map((log, i) => (
                            <motion.div 
                                key={i} // Use a real ID in prod
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className={`bg-arc-surface/50 border ${log.isPB ? 'border-arc-accent/50 shadow-glow' : 'border-white/5'} p-4 rounded-xl flex justify-between items-center backdrop-blur-md`}
                            >
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-sm text-white">{log.name}</span>
                                        {log.isPB && <span className="text-[9px] bg-arc-accent text-black px-1.5 py-0.5 rounded font-black tracking-tighter uppercase">NEW PB</span>}
                                    </div>
                                    <div className="text-[11px] text-arc-muted font-mono">{log.time} • <span className="text-white">{log.val}</span></div>
                                </div>
                                <div className="font-mono text-arc-accent font-bold text-sm bg-arc-accent/10 px-2 py-1 rounded">+{log.points}</div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                 </div>
            </section>
        </main>

        {/* Add Exercise Modal / Bottom Sheet */}
        <AnimatePresence>
            {isAdding && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setIsAdding(false)}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    />
                    <motion.div 
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-8 z-50 space-y-6 pb-safe"
                    >
                        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-4" />
                        <h2 className="text-xl font-black italic tracking-tighter text-center">NEW MOVEMENT</h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Name</label>
                                <input 
                                    type="text" 
                                    value={newExName}
                                    onChange={(e) => setNewExName(e.target.value)}
                                    placeholder="e.g. Incline Dumbbell Press"
                                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
                                    autoFocus
                                />
                            </div>
                            
                            <div>
                                <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Metric</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={() => setNewExType('weight')}
                                        className={`p-4 rounded-xl font-bold text-sm transition-all ${newExType === 'weight' ? 'bg-white text-black' : 'bg-arc-surface text-arc-muted border border-white/5'}`}
                                    >
                                        Weight (KG)
                                    </button>
                                    <button 
                                        onClick={() => setNewExType('time')}
                                        className={`p-4 rounded-xl font-bold text-sm transition-all ${newExType === 'time' ? 'bg-white text-black' : 'bg-arc-surface text-arc-muted border border-white/5'}`}
                                    >
                                        Time (Min)
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={createExercise}
                            className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform"
                        >
                            CREATE EXERCISE
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        <Nav />
    </div>
  )
}
