import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import Nav from '../components/Nav'
import LoadingState from '../components/LoadingState'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'
// Static import so the parent can call its picker via ref
import WorkoutPhotos from '../components/train/WorkoutPhotos'

// Lazy-load heavy/modal components to keep initial bundle small
const ShareActionCard = dynamic(() => import('../components/train/ShareActionCard'), { ssr: false })
const VoiceInput = dynamic(() => import('../components/train/VoiceInput'), { ssr: false })
const VoiceMemo = dynamic(() => import('../components/train/VoiceMemo'), { ssr: false })
const WorkoutArt = dynamic(() => import('../components/train/WorkoutArt'), { ssr: false })

// Confetti is only loaded on demand when a user hits a PB
const fireConfetti = async (opts) => {
  try {
    const confetti = (await import('canvas-confetti')).default
    confetti(opts)
  } catch {}
}

// Short unit label for a movement's metric type (kg / min / km / m).
// distance_m = metres, used for erg-style cardio (rower / bike / ski, e.g. 500m).
const unitShort = (mt) => (
  mt === 'time' ? 'min' : mt === 'distance' ? 'km' : mt === 'distance_m' ? 'm' : 'kg'
)
// Numeric input step appropriate to the unit.
const unitStep = (mt) => (
  mt === 'time' ? '0.1' : mt === 'distance' ? '0.1' : mt === 'distance_m' ? '1' : '0.5'
)

// Resize a picked image file to a compressed data URL (keeps under the API limit).
const resizeToDataUrl = (file, maxWidth = 1400) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('no ctx'))
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => reject(new Error('bad image'))
    img.src = e.target.result
  }
  reader.onerror = () => reject(new Error('read failed'))
  reader.readAsDataURL(file)
})

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

  // Log a whole session/class as one entry (e.g. "45min HIIT class")
  const [showSession, setShowSession] = useState(false)
  const [sessionName, setSessionName] = useState('')
  const [sessionDuration, setSessionDuration] = useState('')
  const [sessionNotes, setSessionNotes] = useState('')
  const [savingSession, setSavingSession] = useState(false)

  // Private workout photos (add-photo trigger lives in the logger header)
  const photosRef = useRef(null)
  const [photosAvailable, setPhotosAvailable] = useState(false)

  // Edit an already-logged set
  const [editingLog, setEditingLog] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [editReps, setEditReps] = useState('')
  const [editSets, setEditSets] = useState('')
  const [editRpe, setEditRpe] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Workout(s) of the Day (admin-programmed) — a day can have several
  const [todayWorkouts, setTodayWorkouts] = useState([]) // [{ ...workout, exercises: [] }]
  const [currentUserId, setCurrentUserId] = useState(null)
  const [scanning, setScanning] = useState(false) // scanning a personal workout photo
  const scanInputRef = useRef(null)
  const [completedPrescribed, setCompletedPrescribed] = useState(() => new Set())
  const [expandedWorkouts, setExpandedWorkouts] = useState(() => new Set()) // workout ids expanded
  const [pInputs, setPInputs] = useState({}) // inline per-movement inputs { [dweId]: {value,reps,sets,rpe} }
  const [expandedId, setExpandedId] = useState(null) // which movement's inline form is open
  const [loggingFull, setLoggingFull] = useState(null) // workout id currently being bulk-logged

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
  const unitLabelLower = unitShort(currentExercise?.metric_type)
  const unitLabel = unitLabelLower.toUpperCase()

  // Load Data
  useEffect(() => {
    const load = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/')
          return
        }
        setCurrentUserId(user.id)

        // CHECK ONBOARDING STATUS
        const { data: profile } = await supabase.from('profiles').select('completed_onboarding').eq('id', user.id).single()

        if (profile && profile.completed_onboarding === false) {
            router.push('/onboarding')
            return
        }

        await Promise.all([fetchProfile(), fetchExercises(), fetchWorkoutHistory(user.id), fetchTodayWorkout(user.id)])
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

      if (error) return

      if (data) {
        setPoints(data.total_points || 0)
        setStreak(data.current_streak || 0)
      }
    } catch {}
  }

  async function fetchExercises() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let { data, error } = await supabase
        .from('exercises')
        .select('*')
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .order('name', { ascending: true })

      // If user_id column doesn't exist yet (migration not applied), fetch all exercises
      if (error) {
        const fallback = await supabase
          .from('exercises')
          .select('*')
          .order('name', { ascending: true })
        data = fallback.data
        error = fallback.error
      }

      if (error) {
        showToast('Failed to load exercises')
        return
      }

      if (data && data.length > 0) {
        setExercises(data)
        setSelectedExId(data[0].id)
      }
    } catch {}
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
            reps: log.reps ?? null,
            sets: log.sets ?? null,
            rpe: log.rpe ?? null,
            points: log.points_awarded || 50,
            time: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isPB: log.is_new_pb || false,
            metricType: log.exercises?.metric_type || 'weight',
            voiceMemoUrl: log.voice_memo_url || null
          }
        })
        setLogs(history)
      }
    } catch {}
  }

  // Fetch the admin-programmed Workout of the Day (if any) for today, plus
  // which prescribed movements this user has already logged.
  async function fetchTodayWorkout(userId) {
    try {
      const tz = new Date().getTimezoneOffset() * 60000
      const today = new Date(Date.now() - tz).toISOString().slice(0, 10)

      const { data: workouts, error } = await supabase
        .from('daily_workouts')
        .select('*')
        .eq('workout_date', today)
        .eq('is_published', true)
        .order('created_at', { ascending: true })

      // Table may not exist yet (migration not applied) — fail silently.
      if (error || !workouts || workouts.length === 0) return

      const ids = workouts.map((w) => w.id)
      const { data: exs } = await supabase
        .from('daily_workout_exercises')
        .select('*')
        .in('daily_workout_id', ids)
        .order('position', { ascending: true })

      const grouped = workouts.map((w) => ({
        ...w,
        exercises: (exs || []).filter((e) => e.daily_workout_id === w.id),
      }))
      setTodayWorkouts(grouped)
      // Auto-open when there's just one; otherwise let the user tap to expand.
      setExpandedWorkouts(new Set(grouped.length === 1 ? [grouped[0].id] : []))

      // Determine which prescribed movements are already done.
      try {
        const { data: doneLogs } = await supabase
          .from('workout_logs')
          .select('daily_workout_exercise_id')
          .eq('user_id', userId)
          .in('daily_workout_id', ids)

        if (doneLogs) {
          setCompletedPrescribed(new Set(doneLogs.map((l) => l.daily_workout_exercise_id).filter(Boolean)))
        }
      } catch {}
    } catch {}
  }

  // Scan a photo of a workout → parse it → load it onto the member's account
  // as a personal workout they can log against.
  async function handleScanWorkout(file) {
    if (!file || scanning) return
    setScanning(true)
    try {
      const dataUrl = await resizeToDataUrl(file)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { showToast('Please log in'); setScanning(false); return }

      const res = await fetch('/api/scan-my-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ image: dataUrl }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { showToast(json.error || 'Could not read that workout'); setScanning(false); return }

      const w = json.workout
      if (w) {
        setTodayWorkouts((prev) => [...prev, { ...w, exercises: w.exercises || [] }])
        setExpandedWorkouts((prev) => new Set([...prev, w.id]))
        showToast(`Loaded "${w.title}" — tap to log it 💪`)
        fireConfetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#00D4AA', '#06B6D4', '#ffffff'] })
      } else if (currentUserId) {
        fetchTodayWorkout(currentUserId)
      }
    } catch {
      showToast('Could not process that photo. Try a clearer shot.')
    } finally {
      setScanning(false)
    }
  }

  async function deletePersonalWorkout(id) {
    const prev = todayWorkouts
    setTodayWorkouts((p) => p.filter((w) => w.id !== id))
    const { error } = await supabase.from('daily_workouts').delete().eq('id', id)
    if (error) { setTodayWorkouts(prev); showToast('Could not remove workout') }
    else showToast('Workout removed')
  }

  const toggleWorkout = (id) => {
    setExpandedWorkouts((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const showToast = (msg) => setToast(msg)

  // Log a single prescribed movement (used by the inline row form and by
  // "Log entire workout"). Returns { ok }.
  const setPInput = (id, key, val) => setPInputs((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [key]: val } }))

  const toggleExpand = (dwe) => {
    setExpandedId((prev) => (prev === dwe.id ? null : dwe.id))
    setPInputs((prev) => prev[dwe.id] ? prev : {
      ...prev,
      [dwe.id]: {
        value: '',
        reps: dwe.target_reps != null ? String(dwe.target_reps) : '',
        sets: dwe.target_sets != null ? String(dwe.target_sets) : '',
        rpe: '',
      },
    })
  }

  async function logMovement(dwe, vals) {
    // Weight optional: allow a bodyweight set when reps are entered.
    const isBodyweight = !vals?.value
    const valNum = isBodyweight ? 0 : parseFloat(vals.value)
    if (isBodyweight ? !vals?.reps : (isNaN(valNum) || valNum <= 0)) return { ok: false }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { ok: false }

      // Find or create the matching exercise.
      let ex = exercises.find((e) => e.name.trim().toLowerCase() === dwe.name.trim().toLowerCase())
      if (!ex) {
        const insertData = { user_id: user.id, name: dwe.name, metric_type: dwe.metric_type || 'weight' }
        let { data, error } = await supabase.from('exercises').insert(insertData).select().single()
        if (error && error.message?.includes('user_id')) {
          delete insertData.user_id
          const retry = await supabase.from('exercises').insert(insertData).select().single()
          data = retry.data; error = retry.error
        }
        if (error) return { ok: false }
        ex = data
        setExercises((prev) => [...prev, data])
      }

      const isTime = (ex.metric_type || dwe.metric_type) === 'time'
      const { data: pbRow } = await supabase
        .from('workout_logs').select('value')
        .eq('user_id', user.id).eq('exercise_id', ex.id)
        .order('value', { ascending: isTime }).limit(1).maybeSingle()
      const pb = pbRow?.value || 0
      const isPB = isBodyweight ? false : (isTime ? (valNum < pb || pb === 0) : (valNum > pb))
      const points = 50 + (isPB ? 100 : 0)

      const payload = {
        user_id: user.id,
        exercise_id: ex.id,
        value: valNum,
        is_new_pb: isPB,
        points_awarded: points,
        daily_workout_id: dwe.daily_workout_id,
        daily_workout_exercise_id: dwe.id,
      }
      const repsNum = vals.reps ? parseInt(vals.reps, 10) : null
      const setsNum = vals.sets ? parseInt(vals.sets, 10) : null
      const rpeNum = vals.rpe ? parseInt(vals.rpe, 10) : null
      if (repsNum) payload.reps = repsNum
      if (setsNum) payload.sets = setsNum
      if (rpeNum) payload.rpe = rpeNum

      let { error: logError, data: inserted } = await supabase.from('workout_logs').insert(payload).select('id').single()
      for (const field of ['reps', 'sets', 'rpe', 'daily_workout_id', 'daily_workout_exercise_id']) {
        if (logError && logError.message && payload[field] !== undefined && logError.message.includes(field)) {
          delete payload[field]
          const retry = await supabase.from('workout_logs').insert(payload).select('id').single()
          logError = retry.error; inserted = retry.data
        }
      }
      if (logError) { showToast('Failed to save set'); return { ok: false } }

      await supabase.rpc('increment_points', { row_id: user.id, x: points })
      if (isPB) triggerCelebration()

      const now = new Date()
      setLogs((prev) => [{
        id: inserted?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: ex.name, val: valNum, reps: repsNum, sets: setsNum, rpe: rpeNum,
        points, time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isPB, metricType: ex.metric_type, voiceMemoUrl: null,
      }, ...prev])
      setPoints((p) => p + points)
      setCompletedPrescribed((prev) => new Set(prev).add(dwe.id))
      setPInputs((prev) => { const n = { ...prev }; delete n[dwe.id]; return n })
      setExpandedId((prev) => (prev === dwe.id ? null : prev))
      return { ok: true, isPB }
    } catch {
      return { ok: false }
    }
  }

  const logOneMovement = async (dwe) => {
    const vals = pInputs[dwe.id]
    if (!vals?.value && !vals?.reps) { showToast('Enter a weight or reps'); return }
    const r = await logMovement(dwe, vals)
    if (r.ok) showToast(r.isPB ? 'New PB! 🎉' : `Logged ${dwe.name}`)
  }

  const logFullWorkout = async (workout) => {
    if (loggingFull) return
    setLoggingFull(workout.id)
    let count = 0
    try {
      for (const dwe of workout.exercises) {
        if (completedPrescribed.has(dwe.id)) continue
        const vals = pInputs[dwe.id]
        // Include weighted sets AND bodyweight sets (reps entered, no weight).
        const hasWeight = vals?.value && parseFloat(vals.value) > 0
        const hasReps = vals?.reps && parseInt(vals.reps, 10) > 0
        if (!hasWeight && !hasReps) continue
        const r = await logMovement(dwe, vals)
        if (r.ok) count++
      }
      showToast(count === 0 ? 'Enter a weight or reps on at least one movement' : `Logged ${count} movement${count > 1 ? 's' : ''} 🎉`)
    } finally {
      setLoggingFull(null)
    }
  }

  const createExercise = async () => {
    if(!newExName) return
    const { data: { user } } = await supabase.auth.getUser()

    const insertData = {
        user_id: user.id,
        name: newExName,
        metric_type: newExType
    }

    let { data, error } = await supabase.from('exercises').insert(insertData).select().single()

    // If user_id column doesn't exist yet, retry without it
    if (error && error.message?.includes('user_id')) {
        delete insertData.user_id
        const retry = await supabase.from('exercises').insert(insertData).select().single()
        data = retry.data
        error = retry.error
    }

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
    // Allow logging with just reps/sets (bodyweight) — weight is optional.
    if ((!value && !reps) || isLogging) return

    setIsLogging(true)
    const isBodyweight = !value
    const valNum = isBodyweight ? 0 : parseFloat(value)

    if (!isBodyweight && (isNaN(valNum) || valNum <= 0)) {
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

      // Check PB Logic (weighted only — bodyweight sets don't set a weight PB)
      let isPB = false
      let pointsEarned = 50

      if (isBodyweight) {
        isPB = false
      } else if (ex.metric_type === 'time') {
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
      if (reps) {
        const parsed = parseInt(reps, 10)
        if (!isNaN(parsed)) logPayload.reps = parsed
      }
      if (sets) {
        const parsed = parseInt(sets, 10)
        if (!isNaN(parsed)) logPayload.sets = parsed
      }
      if (rpe) {
        const parsed = parseInt(rpe, 10)
        if (!isNaN(parsed)) logPayload.rpe = parsed
      }

      const optionalFields = ['rpe', 'reps', 'sets', 'daily_workout_id', 'daily_workout_exercise_id']
      let { error: logError, data: insertedLog } = await supabase
        .from('workout_logs')
        .insert(logPayload)
        .select('id')
        .single()

      // If insert fails due to unknown column(s), strip optional fields and
      // retry — looping so multiple missing columns (e.g. on a DB where the
      // Workout-of-the-Day migration hasn't run) are all handled.
      for (const field of optionalFields) {
        if (logError && logError.message && logPayload[field] !== undefined && logError.message.includes(field)) {
          delete logPayload[field]
          const retry = await supabase
            .from('workout_logs')
            .insert(logPayload)
            .select('id')
            .single()
          logError = retry.error
          insertedLog = retry.data
        }
      }

      // If the error is a foreign-key violation on user_id, the profile row
      // is missing — create a minimal one on the fly so the user is never
      // blocked from logging a workout.
      if (logError && /foreign key|violates|profiles_id/i.test(logError.message || '')) {
        await supabase.from('profiles').upsert(
          { id: user.id, completed_onboarding: true },
          { onConflict: 'id' }
        )
        const retry = await supabase
          .from('workout_logs')
          .insert(logPayload)
          .select('id')
          .single()
        logError = retry.error
        insertedLog = retry.data
      }

      if (logError) {
        console.error('[Arctivate] workout_logs insert failed:', logError)
        showToast(`Failed to save: ${logError.message || 'unknown error'}`)
        setIsLogging(false)
        return
      }

      await supabase.rpc('increment_points', { row_id: user.id, x: pointsEarned })

      const savedLogId = insertedLog?.id || logId

      if (isPB) setCurrentPB(valNum)
      setPoints(prev => prev + pointsEarned)
      setLogs(prev => [{
        id: savedLogId,
        name: ex.name,
        val: valNum,
        reps: logPayload.reps ?? null,
        sets: logPayload.sets ?? null,
        rpe: logPayload.rpe ?? null,
        points: pointsEarned,
        time: timeString,
        isPB: isPB,
        metricType: ex.metric_type,
        voiceMemoUrl: null
      }, ...prev])

      setLastWorkoutData({
        id: savedLogId,
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
    } catch {
      showToast('Something went wrong')
    } finally {
      setIsLogging(false)
    }
  }

  // Open the edit sheet for a logged set.
  const openEditLog = (log) => {
    setEditingLog(log)
    setEditVal(log.val != null ? String(log.val) : '')
    setEditReps(log.reps != null ? String(log.reps) : '')
    setEditSets(log.sets != null ? String(log.sets) : '')
    setEditRpe(log.rpe != null ? String(log.rpe) : '')
  }

  const closeEditLog = () => setEditingLog(null)

  const saveEditLog = async () => {
    if (!editingLog || savingEdit) return
    // Weight optional: leave it empty to keep the set as bodyweight.
    const isBw = !editVal
    const valNum = isBw ? 0 : parseFloat(editVal)
    if (isBw ? !editReps : (isNaN(valNum) || valNum <= 0)) {
      showToast('Enter a weight, or reps for a bodyweight set'); return
    }

    setSavingEdit(true)
    try {
      const repsNum = editReps === '' ? null : parseInt(editReps, 10)
      const setsNum = editSets === '' ? null : parseInt(editSets, 10)
      const rpeNum = editRpe === '' ? null : parseInt(editRpe, 10)

      const payload = { value: valNum }
      if (repsNum !== null && !isNaN(repsNum)) payload.reps = repsNum
      if (setsNum !== null && !isNaN(setsNum)) payload.sets = setsNum
      if (rpeNum !== null && !isNaN(rpeNum)) payload.rpe = rpeNum

      let { error } = await supabase.from('workout_logs').update(payload).eq('id', editingLog.id)

      // Strip unknown columns (older DBs) and retry.
      for (const field of ['reps', 'sets', 'rpe']) {
        if (error && error.message && payload[field] !== undefined && error.message.includes(field)) {
          delete payload[field]
          const retry = await supabase.from('workout_logs').update(payload).eq('id', editingLog.id)
          error = retry.error
        }
      }
      if (error) throw error

      setLogs((prev) => prev.map((l) => l.id === editingLog.id
        ? { ...l, val: valNum, reps: repsNum, sets: setsNum, rpe: rpeNum }
        : l))

      // Keep the PB display fresh if we edited the current exercise's set.
      if (selectedExId) fetchPB(selectedExId)

      closeEditLog()
      showToast('Set updated')
    } catch {
      showToast('Failed to update set')
    } finally {
      setSavingEdit(false)
    }
  }

  // Delete a logged set (from the edit sheet) — works for any day's entry.
  const deleteLog = async () => {
    if (!editingLog || savingEdit) return
    setSavingEdit(true)
    const id = editingLog.id
    try {
      const { error } = await supabase.from('workout_logs').delete().eq('id', id)
      if (error) throw error
      setLogs((prev) => prev.filter((l) => l.id !== id))
      if (selectedExId) fetchPB(selectedExId)
      closeEditLog()
      showToast('Set deleted')
    } catch {
      showToast('Failed to delete set')
    } finally {
      setSavingEdit(false)
    }
  }

  // Log a whole session / class as a single time-based entry.
  const logSession = async () => {
    if (savingSession) return
    const name = sessionName.trim()
    const mins = parseFloat(sessionDuration)
    if (!name) { showToast('Name your session'); return }
    if (isNaN(mins) || mins <= 0) { showToast('Enter a duration in minutes'); return }

    setSavingSession(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('Please log in'); setSavingSession(false); return }

      // Find or create a time-based "exercise" named after the session.
      let ex = exercises.find((e) => e.name.trim().toLowerCase() === name.toLowerCase())
      if (!ex) {
        const insertData = { user_id: user.id, name, metric_type: 'time' }
        let { data, error } = await supabase.from('exercises').insert(insertData).select().single()
        if (error && error.message?.includes('user_id')) {
          delete insertData.user_id
          const retry = await supabase.from('exercises').insert(insertData).select().single()
          data = retry.data; error = retry.error
        }
        if (error) { showToast('Could not save session'); setSavingSession(false); return }
        ex = data
        setExercises((prev) => [...prev, data])
      }

      const points = 100
      const payload = {
        user_id: user.id,
        exercise_id: ex.id,
        value: mins,
        is_new_pb: false,
        points_awarded: points,
      }
      if (sessionNotes.trim()) payload.notes = sessionNotes.trim()

      let { error: logError, data: inserted } = await supabase.from('workout_logs').insert(payload).select('id').single()
      if (logError && logError.message && payload.notes !== undefined && logError.message.includes('notes')) {
        delete payload.notes
        const retry = await supabase.from('workout_logs').insert(payload).select('id').single()
        logError = retry.error; inserted = retry.data
      }
      if (logError) { showToast('Failed to save session'); setSavingSession(false); return }

      await supabase.rpc('increment_points', { row_id: user.id, x: points })
      triggerCelebration()

      const now = new Date()
      setLogs((prev) => [{
        id: inserted?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: ex.name, val: mins, reps: null, sets: null, rpe: null,
        points, time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isPB: false, metricType: 'time', voiceMemoUrl: null,
      }, ...prev])
      setPoints((p) => p + points)

      setSessionName(''); setSessionDuration(''); setSessionNotes('')
      setShowSession(false)
      showToast(`Logged ${name} · ${mins} min 🎉`)
    } catch {
      showToast('Something went wrong')
    } finally {
      setSavingSession(false)
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

  // Voice Memo Saved Handler — persist the memo URL onto the most recent
  // workout log so it's available on replays / profile / etc.
  const handleVoiceMemoSaved = async (memoData) => {
    setShowVoiceMemo(false)
    if (!memoData?.url || !lastWorkoutData?.id) {
      showToast('Voice memo saved')
      return
    }

    try {
      const { error } = await supabase
        .from('workout_logs')
        .update({ voice_memo_url: memoData.url })
        .eq('id', lastWorkoutData.id)

      if (error) {
        // Column may not exist yet in older DBs — fall back to notes.
        if (/voice_memo_url/.test(error.message || '')) {
          await supabase
            .from('workout_logs')
            .update({ notes: `voice:${memoData.url}` })
            .eq('id', lastWorkoutData.id)
        } else {
          console.error('[Arctivate] voice memo persist failed:', error)
        }
      }

      // Reflect in local state
      setLogs(prev => prev.map(l => l.id === lastWorkoutData.id ? { ...l, voiceMemoUrl: memoData.url } : l))
      showToast('Voice memo saved to workout')
    } catch (err) {
      console.error('[Arctivate] voice memo persist error:', err)
      showToast('Voice memo saved (local only)')
    }
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
    fireConfetti({ particleCount: 50, spread: 360, startVelocity: 30, ticks: 60, zIndex: 0, colors: ['#00D4AA', '#06B6D4', '#ffffff'], origin: { y: 0.6 } })
    setTimeout(() => fireConfetti({ particleCount: 50, spread: 360, startVelocity: 30, ticks: 60, zIndex: 0, colors: ['#00D4AA', '#06B6D4', '#ffffff'], origin: { y: 0.6 } }), 200)
  }

  // Today's stats
  const todayPoints = logs.reduce((acc, curr) => acc + curr.points, 0)
  const todaySets = logs.length
  const todayPBs = logs.filter(l => l.isPB).length

  if (isLoading) {
    return <LoadingState label="Loading your training…" />
  }

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

            {/* Quick actions: scan a workout, or log a whole class/session */}
            <input
                ref={scanInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScanWorkout(f); e.target.value = '' }}
            />
            <section className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => !scanning && scanInputRef.current?.click()}
                    disabled={scanning}
                    className="bg-arc-card border border-white/[0.06] rounded-2xl py-3.5 flex items-center justify-center gap-2 text-arc-muted hover:text-white hover:border-arc-accent/30 transition-colors disabled:opacity-60"
                >
                    {scanning ? (
                        <>
                            <span className="w-4 h-4 border-2 border-arc-accent border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-bold">Reading…</span>
                        </>
                    ) : (
                        <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            <span className="text-xs font-bold">Scan a workout</span>
                        </>
                    )}
                </button>
                <button
                    onClick={() => setShowSession(true)}
                    className="bg-arc-card border border-white/[0.06] rounded-2xl py-3.5 flex items-center justify-center gap-2 text-arc-muted hover:text-white hover:border-arc-accent/30 transition-colors"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span className="text-xs font-bold">Log a session</span>
                </button>
            </section>

            {/* Today's Workout(s) — a day can have more than one */}
            {todayWorkouts.map((workout, wIdx) => {
                const wOpen = expandedWorkouts.has(workout.id)
                const wDone = workout.exercises.filter((e) => completedPrescribed.has(e.id)).length
                const allDone = workout.exercises.length > 0 && wDone === workout.exercises.length
                return (
                    <motion.section
                        key={workout.id}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 + wIdx * 0.05 }}
                        className="relative"
                    >
                        <div className="absolute -inset-[1px] bg-gradient-to-b from-arc-cyan/20 via-arc-accent/10 to-transparent rounded-[2rem] blur-sm opacity-60" />
                        <div className="relative bg-arc-card border border-white/[0.06] rounded-[2rem] shadow-card overflow-hidden">
                            <div className="h-[2px] bg-accent-gradient-r" />

                            {/* Workout header — tap to expand its exercises */}
                            <button onClick={() => toggleWorkout(workout.id)} className="w-full text-left p-5 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${workout.owner_id ? 'text-arc-accent' : 'text-arc-cyan'}`}>
                                        {workout.owner_id ? 'Your workout · scanned' : (todayWorkouts.length > 1 ? `Workout ${wIdx + 1}` : "Today's Workout")}
                                    </span>
                                    <h2 className="text-lg font-black italic tracking-tight mt-0.5 truncate">{workout.title}</h2>
                                    {workout.description && (
                                        <p className="text-[11px] text-arc-muted mt-1 leading-snug">{workout.description}</p>
                                    )}
                                </div>
                                <div className="shrink-0 text-right flex flex-col items-end">
                                    <span className={`font-mono text-sm font-bold ${allDone ? 'text-emerald-400' : 'text-arc-accent'}`}>
                                        {wDone}/{workout.exercises.length}
                                    </span>
                                    <span className="block text-[8px] text-arc-muted uppercase tracking-wider">{allDone ? 'Complete' : 'Done'}</span>
                                    <span className="text-[9px] font-bold text-arc-muted uppercase tracking-wider mt-1">{wOpen ? 'Hide ▲' : 'Open ▾'}</span>
                                </div>
                            </button>

                            <AnimatePresence initial={false}>
                                {wOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                        className="px-5 pb-5 space-y-4"
                                    >
                                        <div className="space-y-2">
                                            {workout.exercises.map((dwe) => {
                                                const done = completedPrescribed.has(dwe.id)
                                                const open = expandedId === dwe.id
                                                // Bodyweight/reps movements don't take a load — log reps/sets only.
                                                const isBw = dwe.metric_type === 'reps'
                                                // First column is always the load unit (KG / MIN / KM / M) —
                                                // never "Reps", so it doesn't collide with the Reps field.
                                                const unit = unitShort(dwe.metric_type).toUpperCase()
                                                const unitLower = isBw ? '' : unit.toLowerCase()
                                                const vals = pInputs[dwe.id] || {}
                                                const scheme = [
                                                    dwe.target_sets != null ? `${dwe.target_sets}×` : '',
                                                    dwe.target_reps != null ? `${dwe.target_reps}` : '',
                                                ].join('')
                                                return (
                                                    <div
                                                        key={dwe.id}
                                                        className={`rounded-xl border transition-all overflow-hidden ${
                                                            open ? 'border-arc-accent/50 bg-arc-accent/[0.06] shadow-glow'
                                                                : done ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                                                                    : 'border-white/[0.05] bg-arc-surface'
                                                        }`}
                                                    >
                                                        <button onClick={() => !done && toggleExpand(dwe)} className="w-full text-left flex items-center gap-3 p-3">
                                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'}`}>
                                                                {done && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className={`text-sm font-bold truncate ${done ? 'text-arc-muted line-through' : 'text-white'}`}>{dwe.name}</div>
                                                                <div className="text-[10px] text-arc-muted font-mono">
                                                                    {scheme && <span>{scheme} </span>}
                                                                    {dwe.target_value != null && <span className="text-arc-cyan">@ {dwe.target_value}{unitLower} </span>}
                                                                    {dwe.notes && <span className="text-arc-muted/80">· {dwe.notes}</span>}
                                                                </div>
                                                            </div>
                                                            {!done && (
                                                                <span className={`text-[9px] font-bold uppercase tracking-wider shrink-0 transition-colors ${open ? 'text-white' : 'text-arc-accent'}`}>
                                                                    {open ? 'Close' : 'Log →'}
                                                                </span>
                                                            )}
                                                        </button>

                                                        <AnimatePresence>
                                                            {open && !done && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                                                    className="px-3 pb-3"
                                                                >
                                                                    <div className="flex items-end gap-2">
                                                                        {!isBw && (
                                                                            <div className="flex-1">
                                                                                <label className="text-[8px] font-bold text-arc-muted uppercase tracking-[0.15em] mb-1 block">{unit} <span className="text-arc-muted/60 normal-case">· optional</span></label>
                                                                                <input
                                                                                    type="number" inputMode="decimal" autoFocus
                                                                                    value={vals.value || ''} onChange={(e) => setPInput(dwe.id, 'value', e.target.value)}
                                                                                    placeholder="0" step={unitStep(dwe.metric_type)} min="0"
                                                                                    className="w-full bg-arc-bg border border-white/[0.08] text-center font-mono text-xl font-black text-white py-2 rounded-lg outline-none focus:border-arc-accent/60"
                                                                                />
                                                                            </div>
                                                                        )}
                                                                        <div className={isBw ? 'flex-1' : 'w-14'}>
                                                                            <label className="text-[8px] font-bold text-arc-muted uppercase tracking-[0.15em] mb-1 block text-center">Reps</label>
                                                                            <input type="number" inputMode="numeric" autoFocus={isBw} value={vals.reps || ''} onChange={(e) => setPInput(dwe.id, 'reps', e.target.value)} placeholder="—" min="1"
                                                                                className="w-full bg-arc-bg border border-white/[0.06] text-center font-mono font-bold text-white py-2 rounded-lg outline-none focus:border-arc-accent/40 placeholder-white/10" />
                                                                        </div>
                                                                        <div className={isBw ? 'flex-1' : 'w-14'}>
                                                                            <label className="text-[8px] font-bold text-arc-muted uppercase tracking-[0.15em] mb-1 block text-center">Sets</label>
                                                                            <input type="number" inputMode="numeric" value={vals.sets || ''} onChange={(e) => setPInput(dwe.id, 'sets', e.target.value)} placeholder="—" min="1"
                                                                                className="w-full bg-arc-bg border border-white/[0.06] text-center font-mono font-bold text-white py-2 rounded-lg outline-none focus:border-arc-accent/40 placeholder-white/10" />
                                                                        </div>
                                                                        <button
                                                                            onClick={() => logOneMovement(dwe)}
                                                                            disabled={!vals.value && !vals.reps}
                                                                            className="bg-accent-gradient text-white font-black italic text-xs tracking-wider px-4 py-2.5 rounded-lg shadow-glow-accent disabled:opacity-40"
                                                                        >
                                                                            LOG
                                                                        </button>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {!allDone && (
                                            <button
                                                onClick={() => logFullWorkout(workout)}
                                                disabled={loggingFull === workout.id}
                                                className="w-full bg-arc-surface border border-arc-accent/30 text-arc-accent font-black italic tracking-wider py-3 rounded-xl hover:bg-arc-accent/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {loggingFull === workout.id ? 'LOGGING…' : 'LOG ENTIRE WORKOUT'}
                                            </button>
                                        )}
                                        {workout.owner_id && (
                                            <button
                                                onClick={() => deletePersonalWorkout(workout.id)}
                                                className="w-full text-[10px] font-bold text-arc-muted/70 hover:text-red-400 uppercase tracking-wider py-1 transition-colors"
                                            >
                                                Remove this workout
                                            </button>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.section>
                )
            })}

            {/* Logger Input - Main Card */}
            <motion.section
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 }}
                className="relative"
            >
                <h3 className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] px-1 mb-2">Log a set</h3>
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
                                <button onClick={() => setShowSession(true)} className="text-[9px] font-bold text-arc-cyan uppercase tracking-[0.15em] hover:text-white transition-colors flex items-center gap-1">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    Session
                                </button>
                                <button onClick={() => setShowVoiceMemo(true)} className="text-[9px] font-bold text-arc-cyan uppercase tracking-[0.15em] hover:text-white transition-colors flex items-center gap-1">
                                    <VoiceMemoIcon /> Memo
                                </button>
                                {photosAvailable && (
                                    <button onClick={() => photosRef.current?.openPicker()} className="text-[9px] font-bold text-arc-cyan uppercase tracking-[0.15em] hover:text-white transition-colors flex items-center gap-1">
                                        <ImageIcon /> Photo
                                    </button>
                                )}
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
                                step={unitStep(currentExercise?.metric_type)}
                                min="0"
                                className="w-full bg-transparent border-b-2 border-white/[0.08] text-center font-mono text-5xl font-black text-white py-4 outline-none focus:border-arc-accent/60 transition-colors placeholder-white/[0.04]"
                             />
                             <span className="absolute right-0 bottom-6 text-arc-muted font-bold text-sm">{unitLabel}</span>
                             {/* Glow line under input on focus */}
                             <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 group-focus-within:w-full h-[2px] bg-accent-gradient transition-all duration-300" />
                        </div>
                        <p className="text-[10px] text-arc-muted text-center -mt-2">Leave {unitLabelLower} empty for a bodyweight set — just log reps.</p>

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
                            disabled={(!value && !reps) || isLogging}
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
                     <div className="flex items-center gap-4">
                         <button
                             onClick={() => router.push('/calendar')}
                             className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.15em] hover:text-white transition-colors"
                         >
                             Calendar
                         </button>
                         <button
                             onClick={() => router.push('/history')}
                             className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.15em] hover:text-white transition-colors"
                         >
                             History →
                         </button>
                         {logs.length > 0 && (
                             <button
                                 onClick={() => setShowWorkoutArt(true)}
                                 className="text-[9px] font-bold text-arc-accent uppercase tracking-[0.15em] hover:text-white transition-colors flex items-center gap-1"
                             >
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                                 Share
                             </button>
                         )}
                     </div>
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
                                        {log.time} • {(log.sets != null || log.reps != null) && (
                                            <span className="text-white/80">{log.sets != null ? `${log.sets}×` : ''}{log.reps != null ? log.reps : ''} · </span>
                                        )}
                                        {log.val ? (
                                            <><span className="text-white/80">{log.val}</span><span className="text-arc-muted ml-0.5">{unitShort(log.metricType)}</span></>
                                        ) : (
                                            <span className="text-white/80">Bodyweight</span>
                                        )}
                                        {log.rpe != null && <span className="text-arc-muted ml-2">RPE {log.rpe}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openEditLog(log)}
                                        className="text-white/20 hover:text-arc-cyan transition-colors p-1"
                                        title="Edit set"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                                    </button>
                                    <div className="font-mono text-arc-accent font-bold text-sm bg-arc-accent/10 px-2.5 py-1 rounded-lg">+{log.points}</div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                 </div>
            </section>

            {/* Private workout photos */}
            <WorkoutPhotos ref={photosRef} onToast={showToast} onAvailabilityChange={setPhotosAvailable} />
        </main>

        {/* Log Session / Class Modal */}
        <AnimatePresence>
            {showSession && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setShowSession(false)}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-8 z-50 space-y-5 pb-safe"
                    >
                        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-2" />
                        <div className="text-center">
                            <h2 className="text-xl font-black italic tracking-tighter">LOG A SESSION</h2>
                            <p className="text-[11px] text-arc-muted mt-1">A whole class or session as one entry — e.g. a 45min HIIT class.</p>
                        </div>

                        {/* Type presets */}
                        <div>
                            <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-2 block">Session</label>
                            <div className="grid grid-cols-3 gap-2 mb-2">
                                {['HIIT Class', 'Spin', 'CrossFit', 'Yoga', 'Bootcamp', 'Run'].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setSessionName(s)}
                                        className={`py-2 rounded-xl text-[11px] font-bold transition-all border ${sessionName === s ? 'bg-accent-gradient text-white border-transparent' : 'bg-arc-surface text-arc-muted border-white/[0.06]'}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text" value={sessionName} onChange={(e) => setSessionName(e.target.value)}
                                placeholder="Or type a name…"
                                className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
                            />
                        </div>

                        {/* Duration */}
                        <div>
                            <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-2 block">Duration (minutes)</label>
                            <div className="flex gap-2 mb-2">
                                {[20, 30, 45, 60].map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => setSessionDuration(String(m))}
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${parseFloat(sessionDuration) === m ? 'bg-arc-accent/20 border border-arc-accent/50 text-arc-accent' : 'bg-arc-surface text-arc-muted border border-white/5'}`}
                                    >
                                        {m}m
                                    </button>
                                ))}
                            </div>
                            <input
                                type="number" inputMode="numeric" value={sessionDuration} onChange={(e) => setSessionDuration(e.target.value)}
                                placeholder="Minutes" min="1"
                                className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-mono text-center text-xl font-black"
                            />
                        </div>

                        <input
                            type="text" value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)}
                            placeholder="Notes (optional)"
                            className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors text-sm placeholder-white/20"
                        />

                        <button
                            onClick={logSession}
                            disabled={savingSession || !sessionName.trim() || !sessionDuration}
                            className="w-full bg-accent-gradient text-white font-black italic tracking-wider py-4 rounded-xl shadow-glow-accent disabled:opacity-50"
                        >
                            {savingSession ? 'LOGGING…' : 'LOG SESSION'}
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Edit Set Modal / Bottom Sheet */}
        <AnimatePresence>
            {editingLog && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={closeEditLog}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-8 z-50 space-y-6 pb-safe"
                    >
                        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-2" />
                        <div className="text-center">
                            <h2 className="text-xl font-black italic tracking-tighter">EDIT SET</h2>
                            <p className="text-[11px] text-arc-muted mt-1">{editingLog.name}</p>
                        </div>

                        {/* Value */}
                        <div>
                            <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-2 block text-center">
                                {editingLog.metricType === 'time' ? 'Time (min)' : editingLog.metricType === 'distance' ? 'Distance (km)' : editingLog.metricType === 'distance_m' ? 'Distance (m)' : 'Weight (kg)'}
                            </label>
                            <input
                                type="number" value={editVal} onChange={(e) => setEditVal(e.target.value)}
                                placeholder="0" step={unitStep(editingLog.metricType)} min="0"
                                className="w-full bg-transparent border-b-2 border-white/[0.08] text-center font-mono text-4xl font-black text-white py-3 outline-none focus:border-arc-accent/60 transition-colors placeholder-white/10"
                                autoFocus
                            />
                            <p className="text-[10px] text-arc-muted text-center mt-1.5">Leave empty for a bodyweight set — just enter reps.</p>
                        </div>

                        {/* Reps / Sets / RPE */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-[8px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-1.5 block text-center">Reps</label>
                                <input type="number" value={editReps} onChange={(e) => setEditReps(e.target.value)} placeholder="—" min="1"
                                    className="w-full bg-arc-surface border border-white/[0.05] text-center font-mono text-lg font-bold text-white py-2.5 rounded-xl outline-none focus:border-arc-accent/40 placeholder-white/10" />
                            </div>
                            <div>
                                <label className="text-[8px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-1.5 block text-center">Sets</label>
                                <input type="number" value={editSets} onChange={(e) => setEditSets(e.target.value)} placeholder="—" min="1"
                                    className="w-full bg-arc-surface border border-white/[0.05] text-center font-mono text-lg font-bold text-white py-2.5 rounded-xl outline-none focus:border-arc-accent/40 placeholder-white/10" />
                            </div>
                            <div>
                                <label className="text-[8px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-1.5 block text-center">RPE</label>
                                <input type="number" value={editRpe} onChange={(e) => setEditRpe(e.target.value)} placeholder="—" min="1" max="10"
                                    className="w-full bg-arc-surface border border-white/[0.05] text-center font-mono text-lg font-bold text-white py-2.5 rounded-xl outline-none focus:border-arc-accent/40 placeholder-white/10" />
                            </div>
                        </div>

                        <button
                            onClick={saveEditLog}
                            disabled={savingEdit || (!editVal && !editReps)}
                            className="w-full bg-accent-gradient text-white font-black italic tracking-wider py-4 rounded-xl shadow-glow-accent disabled:opacity-50"
                        >
                            {savingEdit ? 'SAVING…' : 'SAVE CHANGES'}
                        </button>
                        <button
                            onClick={deleteLog}
                            disabled={savingEdit}
                            className="w-full text-[11px] font-bold text-arc-muted hover:text-red-400 uppercase tracking-wider py-1 transition-colors disabled:opacity-50"
                        >
                            Delete this set
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

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
                                    <button
                                        onClick={() => setNewExType('distance_m')}
                                        className={`p-4 rounded-xl font-bold text-sm transition-all ${newExType === 'distance_m' ? 'bg-accent-gradient text-white' : 'bg-arc-surface text-arc-muted border border-white/5'}`}
                                    >
                                        Distance (M)
                                    </button>
                                    <button
                                        onClick={() => setNewExType('distance')}
                                        className={`p-4 rounded-xl font-bold text-sm transition-all ${newExType === 'distance' ? 'bg-accent-gradient text-white' : 'bg-arc-surface text-arc-muted border border-white/5'}`}
                                    >
                                        Distance (KM)
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
