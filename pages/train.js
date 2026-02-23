import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import confetti from 'canvas-confetti'
import ShareActionCard from '../components/train/ShareActionCard'
import VoiceInput from '../components/train/VoiceInput'
import VoiceMemo from '../components/train/VoiceMemo'
import WorkoutArt from '../components/train/WorkoutArt'
import { useRouter } from 'next/router'

// Icons
const MicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
)

const ImageIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const VoiceMemoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <circle cx="12" cy="21" r="2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
  </svg>
)

const FireIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-arc-accent">
    <path d="M12 23c-3.6 0-7-2.4-7-7 0-3.1 2.1-5.7 3.5-7.1L12 5.5l3.5 3.4C16.9 10.3 19 12.9 19 16c0 4.6-3.4 7-7 7z"/>
  </svg>
)

const TrophyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
    <path d="M4 22h16"/>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
  </svg>
)

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
      className="fixed top-0 left-1/2 z-50 bg-arc-surface/90 border border-arc-accent/20 text-white px-6 py-3 rounded-full shadow-glow flex items-center gap-3 backdrop-blur-xl"
    >
      <div className="w-2 h-2 rounded-full bg-arc-accent animate-pulse" />
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  )
}

export default function Train() {
  const router = useRouter()
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
  const [isLogging, setIsLogging] = useState(false)

  // Success/Share Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [lastWorkoutData, setLastWorkoutData] = useState(null)

  // Voice Input, Voice Memo & Art States
  const [showVoiceInput, setShowVoiceInput] = useState(false)
  const [showVoiceMemo, setShowVoiceMemo] = useState(false)
  const [showWorkoutArt, setShowWorkoutArt] = useState(false)
  const [reps, setReps] = useState('')
  const [sets, setSets] = useState('')
  const [rpe, setRpe] = useState('')

  // Get current exercise for unit display
  const currentExercise = exercises.find(e => e.id === selectedExId)
  const isTimeExercise = currentExercise?.metric_type === 'time'
  const unitLabel = isTimeExercise ? 'MIN' : 'KG'
  const unitLabelLower = isTimeExercise ? 'min' : 'kg'

  // Load Data
  useEffect(() => {
    const load = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }

        // CHECK ONBOARDING STATUS
        const { data: profile } = await supabase.from('profiles').select('completed_onboarding').eq('id', user.id).single()

        if (profile && profile.completed_onboarding === false) {
            console.log("Onboarding redirect from Train page")
            router.push('/onboarding')
            return
        }

        await Promise.all([fetchProfile(), fetchExercises(), fetchWorkoutHistory(user.id)])
        setIsLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (selectedExId && exercises.length > 0) fetchPB(selectedExId)
  }, [selectedExId, exercises])

  async function fetchProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('total_points, current_streak')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      if (data) {
        setPoints(data.total_points || 0)
        setStreak(data.current_streak || 0)
      }
    } catch (err) {
      console.error('Profile fetch error:', err)
    }
  }

  async function fetchExercises() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching exercises:', error)
        showToast('Failed to load exercises')
        return
      }

      if (data && data.length > 0) {
        setExercises(data)
        setSelectedExId(data[0].id)
      }
    } catch (err) {
      console.error('Exercise fetch error:', err)
    }
  }

  async function fetchPB(exId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const ex = exercises.find(e => e.id === exId)
      if (!ex) return

      const isTime = ex.metric_type === 'time'

      const { data } = await supabase
        .from('workout_logs')
        .select('value')
        .eq('user_id', user.id)
        .eq('exercise_id', exId)
        .order('value', { ascending: isTime })
        .limit(1)
        .single()

      setCurrentPB(data?.value || 0)
    } catch (err) {
      setCurrentPB(0)
    }
  }

  async function fetchWorkoutHistory(userId) {
    try {
      const { data } = await supabase
        .from('workout_logs')
        .select('*, exercises(name, metric_type)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (data && data.length > 0) {
        const history = data.map(log => {
          const d = new Date(log.created_at)
          return {
            id: log.id,
            name: log.exercises?.name || 'Unknown',
            val: log.value,
            points: log.points_awarded || 50,
            time: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isPB: log.is_new_pb || false,
            metricType: log.exercises?.metric_type || 'weight',
            voiceMemoUrl: log.voice_memo_url || null
          }
        })
        setLogs(history)
      }
    } catch (err) {
      console.error('Workout history fetch error:', err)
    }
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
    if (!value || isLogging) return

    setIsLogging(true)
    const valNum = parseFloat(value)

    if (isNaN(valNum) || valNum <= 0) {
      showToast('Please enter a valid number')
      setIsLogging(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast('Please log in to continue')
        setIsLogging(false)
        return
      }

      const ex = exercises.find(e => e.id === selectedExId)
      if (!ex) {
        showToast('Please select an exercise')
        setIsLogging(false)
        return
      }

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
      }

      const logId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const now = new Date()
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      const logPayload = {
        user_id: user.id,
        exercise_id: selectedExId,
        value: valNum,
        is_new_pb: isPB,
        points_awarded: pointsEarned,
      }
      if (reps) logPayload.reps = parseInt(reps, 10)
      if (sets) logPayload.sets = parseInt(sets, 10)
      if (rpe) logPayload.rpe = parseInt(rpe, 10)

      const { error: logError } = await supabase.from('workout_logs').insert(logPayload)

      if (logError) {
        console.error('Error logging workout:', logError)
        showToast('Failed to save workout')
        setIsLogging(false)
        return
      }

      const { error: pointsError } = await supabase.rpc('increment_points', { row_id: user.id, x: pointsEarned })

      if (pointsError) {
        console.error('Error updating points:', pointsError)
      }

      if (isPB) setCurrentPB(valNum)
      setPoints(prev => prev + pointsEarned)
      setLogs(prev => [{
        id: logId,
        name: ex.name,
        val: valNum,
        points: pointsEarned,
        time: timeString,
        isPB: isPB,
        metricType: ex.metric_type,
        voiceMemoUrl: null
      }, ...prev])

      setLastWorkoutData({
        exerciseName: ex.name,
        value: valNum,
        metricType: ex.metric_type,
        isNewPB: isPB,
        pointsEarned: pointsEarned,
        date: now.toISOString()
      })
      setShowSuccessModal(true)

      setValue('')
      setReps('')
      setSets('')
      setRpe('')
    } catch (err) {
      console.error('Unexpected error:', err)
      showToast('Something went wrong')
    } finally {
      setIsLogging(false)
    }
  }

  // Voice Input Result Handler
  const handleVoiceResult = (parsed) => {
    if (parsed.matched && parsed.exercise) {
      const match = exercises.find(e => e.name.toLowerCase() === parsed.exercise.toLowerCase())
      if (match) setSelectedExId(match.id)
    }
    if (parsed.weight !== null) setValue(String(parsed.weight))
    if (parsed.reps !== null) setReps(String(parsed.reps))
    if (parsed.sets !== null) setSets(String(parsed.sets))
    if (parsed.rpe !== null) setRpe(String(parsed.rpe))
    setShowVoiceInput(false)
    showToast('Voice data loaded')
  }

  // Voice Memo Saved Handler
  const handleVoiceMemoSaved = (memoData) => {
    showToast('Voice memo saved to workout')
    setShowVoiceMemo(false)
  }

  // Build session data for Workout Art
  const buildSessionArt = () => {
    const sessionExercises = logs.map(log => ({
      name: log.name,
      value: log.val,
      metricType: log.metricType,
      isPB: log.isPB,
      reps: null,
      sets: null,
      rpe: null,
    }))

    const unique = []
    const seen = new Set()
    for (const ex of sessionExercises) {
      if (!seen.has(ex.name)) {
        seen.add(ex.name)
        unique.push(ex)
      }
    }

    return {
      exercises: unique,
      totalPoints: logs.reduce((acc, l) => acc + l.points, 0),
      totalSets: logs.length,
      date: new Date().toISOString(),
      username: null,
      isPB: logs.some(l => l.isPB),
      duration: null,
    }
  }

  const triggerCelebration = () => {
    confetti({ particleCount: 50, spread: 360, startVelocity: 30, ticks: 60, zIndex: 0, colors: ['#00D4AA', '#06B6D4', '#ffffff'], origin: { y: 0.6 } })
    setTimeout(() => confetti({ particleCount: 50, spread: 360, startVelocity: 30, ticks: 60, zIndex: 0, colors: ['#00D4AA', '#06B6D4', '#ffffff'], origin: { y: 0.6 } }), 200)
  }

  // Today's stats
  const todayPoints = logs.reduce((acc, curr) => acc + curr.points, 0)
  const todaySets = logs.length
  const todayPBs = logs.filter(l => l.isPB).length

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans selection:bg-arc-accent/30 selection:text-white">
        <AnimatePresence>
            {toast && <Toast message={toast} onClose={() => setToast(null)} />}
        </AnimatePresence>

        {/* Success/Share Modal */}
        <AnimatePresence>
            {showSuccessModal && lastWorkoutData && (
                <ShareActionCard
                    workoutData={lastWorkoutData}
                    onClose={() => setShowSuccessModal(false)}
                    onShareComplete={() => showToast('Shared to Community!')}
                    onCreateArt={() => setShowWorkoutArt(true)}
                />
            )}
        </AnimatePresence>

        {/* Header */}
        <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/[0.04]">
            <div className="p-5 flex justify-between items-center max-w-lg mx-auto">
                <div>
                    <h1 className="text-xl font-black italic tracking-tighter text-gradient-accent">
                        ARCTIVATE
                    </h1>
                    <span className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em]">Training</span>
                </div>
                <div className="flex items-center gap-2 bg-arc-card/80 px-4 py-2 rounded-2xl border border-arc-accent/10 shadow-inner-glow">
                    <span className="text-arc-accent text-sm drop-shadow-[0_0_8px_rgba(0,212,170,0.5)]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </span>
                    <NumberTicker value={points} />
                </div>
            </div>
        </header>

        <main className="pt-24 px-5 space-y-6 max-w-lg mx-auto">

            {/* Stats Row - Three Cards */}
            <section className="grid grid-cols-3 gap-3">
                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-arc-card border border-white/[0.04] p-4 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-arc-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-arc-muted text-[9px] font-bold uppercase tracking-[0.15em] mb-1">Streak</span>
                    <span className="text-3xl font-black font-mono tracking-tighter">{streak}</span>
                    <span className="text-[9px] text-emerald-400 font-bold tracking-wider mt-0.5">DAYS</span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="bg-arc-card border border-white/[0.04] p-4 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-12 h-12 bg-arc-accent/5 blur-2xl rounded-full" />
                    <span className="text-arc-muted text-[9px] font-bold uppercase tracking-[0.15em] mb-1">Today</span>
                    <div className="flex items-baseline gap-0.5 text-arc-accent">
                        <span className="text-sm font-bold">+</span>
                        <span className="text-3xl font-black font-mono tracking-tighter">{todayPoints}</span>
                    </div>
                    <span className="text-[9px] text-arc-muted font-bold tracking-wider mt-0.5">PTS</span>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-arc-card border border-white/[0.04] p-4 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden"
                >
                    <span className="text-arc-muted text-[9px] font-bold uppercase tracking-[0.15em] mb-1">Sets</span>
                    <span className="text-3xl font-black font-mono tracking-tighter">{todaySets}</span>
                    <span className="text-[9px] text-arc-cyan font-bold tracking-wider mt-0.5 flex items-center gap-0.5">
                        {todayPBs > 0 && <><TrophyIcon /> {todayPBs} PB{todayPBs > 1 ? 's' : ''}</>}
                        {todayPBs === 0 && 'LOGGED'}
                    </span>
                </motion.div>
            </section>

            {/* Logger Input - Main Card */}
            <motion.section
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}
                className="relative"
            >
                {/* Outer glow */}
                <div className="absolute -inset-[1px] bg-gradient-to-b from-arc-accent/20 via-arc-cyan/10 to-transparent rounded-[2rem] blur-sm opacity-60" />

                <div className="relative bg-arc-card border border-white/[0.06] rounded-[2rem] shadow-card overflow-hidden">
                    {/* Subtle top gradient line */}
                    <div className="h-[2px] bg-accent-gradient-r" />

                    <div className="p-6 space-y-5">

                        {/* Exercise Selection Header */}
                        <div className="flex justify-between items-center">
                            <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em]">Movement</label>
                            <div className="flex gap-3">
                                <button onClick={() => setShowVoiceMemo(true)} className="text-[9px] font-bold text-arc-cyan uppercase tracking-[0.15em] hover:text-white transition-colors flex items-center gap-1">
                                    <VoiceMemoIcon /> Memo
                                </button>
                                <button onClick={() => setShowVoiceInput(true)} className="text-[9px] font-bold text-arc-accent uppercase tracking-[0.15em] hover:text-white transition-colors flex items-center gap-1">
                                    <MicIcon /> Voice
                                </button>
                                <button onClick={() => setIsAdding(true)} className="text-[9px] font-bold text-arc-accent uppercase tracking-[0.15em] hover:text-white transition-colors">
                                    + New
                                </button>
                            </div>
                        </div>

                        {/* Exercise Dropdown */}
                        <div className="relative">
                            <select
                                value={selectedExId}
                                onChange={(e) => setSelectedExId(e.target.value)}
                                className="w-full bg-arc-surface border border-white/[0.06] text-white p-4 rounded-xl font-bold appearance-none outline-none focus:border-arc-accent/40 transition-colors"
                            >
                                {exercises.map(ex => (
                                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-arc-muted">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
                            </div>
                        </div>

                        {/* Personal Best Display */}
                        <div className="flex items-center justify-between px-1">
                             <span className="text-[10px] text-arc-muted font-medium uppercase tracking-wider">Personal Best</span>
                             <div className="flex items-center gap-1.5">
                                {currentPB > 0 && <TrophyIcon />}
                                <span className="font-mono font-bold text-arc-accent text-lg">{currentPB} <span className="text-xs text-arc-muted">{unitLabelLower}</span></span>
                             </div>
                        </div>

                        {/* Main Value Input */}
                        <div className="relative group">
                             <input
                                type="number"
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder="0.0"
                                step={isTimeExercise ? '0.1' : '0.5'}
                                min="0"
                                className="w-full bg-transparent border-b-2 border-white/[0.08] text-center font-mono text-5xl font-black text-white py-4 outline-none focus:border-arc-accent/60 transition-colors placeholder-white/[0.04]"
                             />
                             <span className="absolute right-0 bottom-6 text-arc-muted font-bold text-sm">{unitLabel}</span>
                             {/* Glow line under input on focus */}
                             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 group-focus-within:w-full h-[2px] bg-accent-gradient transition-all duration-300" />
                        </div>

                        {/* Reps / Sets / RPE Row */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-[8px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-1.5 block text-center">Reps</label>
                                <input
                                    type="number" value={reps} onChange={(e) => setReps(e.target.value)}
                                    placeholder="—" min="1"
                                    className="w-full bg-arc-surface border border-white/[0.05] text-center font-mono text-lg font-bold text-white py-2.5 rounded-xl outline-none focus:border-arc-accent/40 transition-colors placeholder-white/10"
                                />
                            </div>
                            <div>
                                <label className="text-[8px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-1.5 block text-center">Sets</label>
                                <input
                                    type="number" value={sets} onChange={(e) => setSets(e.target.value)}
                                    placeholder="—" min="1"
                                    className="w-full bg-arc-surface border border-white/[0.05] text-center font-mono text-lg font-bold text-white py-2.5 rounded-xl outline-none focus:border-arc-accent/40 transition-colors placeholder-white/10"
                                />
                            </div>
                            <div>
                                <label className="text-[8px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-1.5 block text-center">RPE</label>
                                <input
                                    type="number" value={rpe} onChange={(e) => setRpe(e.target.value)}
                                    placeholder="—" min="1" max="10"
                                    className="w-full bg-arc-surface border border-white/[0.05] text-center font-mono text-lg font-bold text-white py-2.5 rounded-xl outline-none focus:border-arc-accent/40 transition-colors placeholder-white/10"
                                />
                            </div>
                        </div>

                        {/* Log Button */}
                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            onClick={handleLog}
                            disabled={!value || isLogging}
                            className="w-full bg-accent-gradient text-white font-black italic tracking-wider py-5 rounded-xl shadow-glow-accent text-lg disabled:opacity-40 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                        >
                            {isLogging ? (
                              <>
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                                />
                                <span>LOGGING...</span>
                              </>
                            ) : (
                              'LOG SET'
                            )}
                        </motion.button>
                    </div>
                </div>
            </motion.section>

            {/* Recent Activity Feed */}
            <section className="space-y-4">
                 <div className="flex justify-between items-center px-1">
                     <h3 className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em]">Recent Activity</h3>
                     {logs.length > 0 && (
                         <button
                             onClick={() => setShowWorkoutArt(true)}
                             className="text-[9px] font-bold text-arc-accent uppercase tracking-[0.15em] hover:text-white transition-colors flex items-center gap-1"
                         >
                             <ImageIcon /> Create Art
                         </button>
                     )}
                 </div>
                 <div className="space-y-2.5 pb-10">
                    <AnimatePresence initial={false}>
                        {logs.map((log, index) => (
                            <motion.div
                                key={log.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className={`bg-arc-card/60 border ${log.isPB ? 'border-arc-accent/30 shadow-glow' : 'border-white/[0.04]'} p-4 rounded-xl flex justify-between items-center backdrop-blur-sm`}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-sm text-white">{log.name}</span>
                                        {log.isPB && (
                                            <span className="text-[8px] bg-accent-gradient text-arc-bg px-2 py-0.5 rounded-md font-black tracking-tight uppercase">
                                                NEW PB
                                            </span>
                                        )}
                                        {log.voiceMemoUrl && (
                                            <span className="text-arc-cyan">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/></svg>
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-[10px] text-arc-muted font-mono">
                                        {log.time} • <span className="text-white/80">{log.val}</span>
                                        <span className="text-arc-muted ml-0.5">{log.metricType === 'time' ? 'min' : 'kg'}</span>
                                    </div>
                                </div>
                                <div className="font-mono text-arc-accent font-bold text-sm bg-arc-accent/10 px-2.5 py-1 rounded-lg">+{log.points}</div>
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
                                <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-2 block">Name</label>
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
                                <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-2 block">Metric</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setNewExType('weight')}
                                        className={`p-4 rounded-xl font-bold text-sm transition-all ${newExType === 'weight' ? 'bg-accent-gradient text-white' : 'bg-arc-surface text-arc-muted border border-white/5'}`}
                                    >
                                        Weight (KG)
                                    </button>
                                    <button
                                        onClick={() => setNewExType('time')}
                                        className={`p-4 rounded-xl font-bold text-sm transition-all ${newExType === 'time' ? 'bg-accent-gradient text-white' : 'bg-arc-surface text-arc-muted border border-white/5'}`}
                                    >
                                        Time (Min)
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={createExercise}
                            className="w-full bg-accent-gradient text-white font-bold py-4 rounded-xl text-lg shadow-glow-accent active:scale-95 transition-transform"
                        >
                            CREATE EXERCISE
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Voice Input Modal */}
        <AnimatePresence>
            {showVoiceInput && (
                <VoiceInput
                    exercises={exercises}
                    onResult={handleVoiceResult}
                    onClose={() => setShowVoiceInput(false)}
                />
            )}
        </AnimatePresence>

        {/* Voice Memo Modal */}
        <AnimatePresence>
            {showVoiceMemo && (
                <VoiceMemo
                    exercises={exercises}
                    selectedExercise={currentExercise}
                    onSaved={handleVoiceMemoSaved}
                    onClose={() => setShowVoiceMemo(false)}
                />
            )}
        </AnimatePresence>

        {/* Workout Art Modal */}
        <AnimatePresence>
            {showWorkoutArt && logs.length > 0 && (
                <WorkoutArt
                    workoutData={buildSessionArt()}
                    onClose={() => setShowWorkoutArt(false)}
                />
            )}
        </AnimatePresence>

        <Nav />
    </div>
  )
}
