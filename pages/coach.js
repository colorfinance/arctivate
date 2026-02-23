import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'

// ─── Icons ───────────────────────────────────────────
const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)

const BrainIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A5.5 5.5 0 0 0 4 7.5c0 1.58.67 3 1.74 4.01L4 13l1.5 1.5L4 16l2 2 1.5-1.5L9 18l1.49-1.74A5.5 5.5 0 0 0 9.5 2z"/>
    <path d="M14.5 2A5.5 5.5 0 0 1 20 7.5c0 1.58-.67 3-1.74 4.01L20 13l-1.5 1.5L20 16l-2 2-1.5-1.5L15 18l-1.49-1.74A5.5 5.5 0 0 1 14.5 2z"/>
  </svg>
)

const HeartIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 7.65l.78.77L12 20.64l7.64-7.64.78-.77a5.4 5.4 0 0 0 0-7.65z"/>
  </svg>
)

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const ActivityIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)

const ZapIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)

// ─── Readiness Score Ring ────────────────────────────
const ReadinessRing = ({ score, size = 120, strokeWidth = 8 }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const progress = ((score || 0) / 100) * circumference

  const getColor = (s) => {
    if (s >= 75) return '#22c55e'
    if (s >= 50) return '#00D4AA'
    if (s >= 25) return '#f59e0b'
    return '#ef4444'
  }

  const getLabel = (s) => {
    if (s >= 75) return 'READY'
    if (s >= 50) return 'MODERATE'
    if (s >= 25) return 'CAUTION'
    return 'REST'
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <motion.span
          key={score}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-3xl font-black font-mono"
          style={{ color: getColor(score) }}
        >
          {score || '—'}
        </motion.span>
        <span className="text-[9px] font-bold tracking-widest text-arc-muted mt-0.5">{getLabel(score)}</span>
      </div>
    </div>
  )
}

// ─── Muscle Recovery Map ─────────────────────────────
const MUSCLE_GROUPS = [
  { key: 'chest', label: 'Chest', keywords: ['bench', 'chest', 'press', 'fly', 'pec'] },
  { key: 'back', label: 'Back', keywords: ['row', 'pull', 'lat', 'back', 'deadlift'] },
  { key: 'shoulders', label: 'Shoulders', keywords: ['shoulder', 'ohp', 'military', 'lateral', 'delt'] },
  { key: 'legs', label: 'Legs', keywords: ['squat', 'leg', 'lunge', 'calf', 'hamstring', 'quad', 'glute'] },
  { key: 'arms', label: 'Arms', keywords: ['curl', 'tricep', 'bicep', 'arm', 'extension'] },
  { key: 'core', label: 'Core', keywords: ['ab', 'core', 'plank', 'crunch', 'sit-up'] },
]

function getMuscleRecovery(workoutLogs) {
  const now = Date.now()
  const recoveryHours = 48 // Full recovery baseline
  const results = {}

  MUSCLE_GROUPS.forEach(group => {
    const relevantLogs = workoutLogs.filter(log => {
      const name = (log.exercises?.name || log.name || '').toLowerCase()
      return group.keywords.some(kw => name.includes(kw))
    })

    if (relevantLogs.length === 0) {
      results[group.key] = { label: group.label, recovery: 100, lastTrained: null }
      return
    }

    const lastLog = relevantLogs[0] // Logs are sorted by created_at DESC
    const lastDate = new Date(lastLog.created_at || lastLog.time)
    const hoursSince = (now - lastDate.getTime()) / (1000 * 60 * 60)
    const recovery = Math.min(100, Math.round((hoursSince / recoveryHours) * 100))

    results[group.key] = { label: group.label, recovery, lastTrained: lastDate }
  })

  return results
}

// ─── Readiness Score Calculator ──────────────────────
function calculateReadiness(wearableData, workoutLogs) {
  let score = 50 // Base score

  if (wearableData) {
    // HRV component (0-30): Higher HRV = better recovery
    if (wearableData.hrv) {
      const hrvScore = Math.min(30, Math.round((wearableData.hrv / 80) * 30))
      score = score - 15 + hrvScore
    }

    // RHR component (0-20): Lower RHR = better recovery
    if (wearableData.rhr) {
      const rhrScore = Math.min(20, Math.max(0, Math.round(((80 - wearableData.rhr) / 30) * 20)))
      score = score - 10 + rhrScore
    }

    // Sleep component (0-30): More sleep + better quality = better recovery
    if (wearableData.sleep_hours) {
      const sleepBase = Math.min(20, Math.round((wearableData.sleep_hours / 8) * 20))
      const qualityMap = { excellent: 10, good: 7, fair: 4, poor: 1 }
      const qualityScore = qualityMap[wearableData.sleep_quality] || 5
      score = score - 15 + sleepBase + qualityScore
    }

    // Stress score component: Lower stress = better recovery (Garmin)
    if (wearableData.stress_score) {
      const stressBonus = wearableData.stress_score < 30 ? 5
        : wearableData.stress_score < 50 ? 2
        : wearableData.stress_score > 70 ? -5 : 0
      score += stressBonus
    }

    // Body Battery component (Garmin): Higher = better readiness
    if (wearableData.body_battery) {
      const batteryBonus = wearableData.body_battery > 75 ? 5
        : wearableData.body_battery > 50 ? 2
        : wearableData.body_battery < 25 ? -5 : 0
      score += batteryBonus
    }
  }

  // Training load component: Recent volume reduces readiness
  const recentLogs = (workoutLogs || []).filter(log => {
    const logDate = new Date(log.created_at)
    const daysSince = (Date.now() - logDate.getTime()) / (1000 * 60 * 60 * 24)
    return daysSince <= 2
  })

  if (recentLogs.length > 3) {
    score -= (recentLogs.length - 3) * 5
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

// ─── Quick Prompts ───────────────────────────────────
const QUICK_PROMPTS = [
  { label: 'Plateau check', prompt: 'Am I plateauing on any exercises? Check my recent workout history.' },
  { label: 'Program update', prompt: "Based on my recent training and recovery data, suggest updates to my program." },
  { label: 'Recovery advice', prompt: "How should I train today based on my readiness and recovery data?" },
  { label: 'Form tips', prompt: "Give me tips to improve my weakest lifts based on my workout history." },
]

// ─── Main Component ──────────────────────────────────
export default function Coach() {
  const router = useRouter()
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  // Data
  const [userId, setUserId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [workoutLogs, setWorkoutLogs] = useState([])
  const [wearableData, setWearableData] = useState(null)
  const [wearableHistory, setWearableHistory] = useState([])

  // Chat
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)

  // UI
  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'readiness'
  const [isLoading, setIsLoading] = useState(true)
  const [showWearableModal, setShowWearableModal] = useState(false)

  // Wearable form
  const [wearableForm, setWearableForm] = useState({ hrv: '', rhr: '', sleep_hours: '', sleep_quality: 'good' })

  // Computed
  const muscleRecovery = getMuscleRecovery(workoutLogs)
  const readinessScore = calculateReadiness(wearableData, workoutLogs)

  // ─── Load Data ───────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof && prof.completed_onboarding === false) { router.push('/onboarding'); return }

      setUserId(user.id)
      setProfile(prof)

      await Promise.all([
        fetchWorkoutHistory(user.id),
        fetchWearableData(user.id),
        fetchChatHistory(user.id),
      ])
      setIsLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchWorkoutHistory(uid) {
    const { data } = await supabase
      .from('workout_logs')
      .select('*, exercises(name, metric_type, muscle_group)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) setWorkoutLogs(data)
  }

  async function fetchWearableData(uid) {
    const { data } = await supabase
      .from('wearable_logs')
      .select('*')
      .eq('user_id', uid)
      .order('logged_at', { ascending: false })
      .limit(14)
    if (data && data.length > 0) {
      setWearableData(data[0])
      setWearableHistory(data)
    }
  }

  async function fetchChatHistory(uid) {
    const { data } = await supabase
      .from('coach_messages')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: true })
      .limit(50)
    if (data && data.length > 0) {
      setMessages(data.map(m => ({ role: m.role, content: m.content })))
    }
  }

  // ─── Build Context for AI ────────────────────────
  function buildContext() {
    const recentWorkouts = workoutLogs.slice(0, 20).map(w => ({
      exercise: w.exercises?.name,
      weight: w.value,
      sets: w.sets,
      reps: w.reps,
      rpe: w.rpe,
      isPB: w.is_new_pb,
      date: w.created_at,
      muscleGroup: w.exercises?.muscle_group
    }))

    return {
      profile: profile ? {
        fitnessLevel: profile.fitness_level,
        goal: profile.goal,
        weight: profile.weight,
        age: profile.age,
        streak: profile.current_streak,
        points: profile.total_points
      } : null,
      recentWorkouts,
      readinessScore,
      muscleRecovery,
      wearableData: wearableData ? {
        hrv: wearableData.hrv,
        rhr: wearableData.rhr,
        sleepHours: wearableData.sleep_hours,
        sleepQuality: wearableData.sleep_quality,
        sleepDeep: wearableData.sleep_deep_hours,
        sleepLight: wearableData.sleep_light_hours,
        sleepRem: wearableData.sleep_rem_hours,
        steps: wearableData.steps,
        caloriesBurned: wearableData.calories_burned,
        stressScore: wearableData.stress_score,
        bodyBattery: wearableData.body_battery,
        spo2: wearableData.spo2,
        activeMinutes: wearableData.active_minutes,
        source: wearableData.source,
        date: wearableData.logged_at
      } : null,
      wearableTrend: wearableHistory.slice(0, 7).map(w => ({
        hrv: w.hrv, rhr: w.rhr, sleep: w.sleep_hours,
        steps: w.steps, stress: w.stress_score,
        bodyBattery: w.body_battery, date: w.logged_at
      }))
    }
  }

  // ─── Send Message ────────────────────────────────
  const sendMessage = async (text) => {
    const msg = text || input.trim()
    if (!msg || isSending) return

    setInput('')
    const userMsg = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setIsSending(true)

    try {
      // Save user message
      if (userId) {
        await supabase.from('coach_messages').insert({ user_id: userId, role: 'user', content: msg })
      }

      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context: buildContext() })
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to get response')

      const assistantMsg = { role: 'assistant', content: data.reply }
      setMessages(prev => [...prev, assistantMsg])

      // Save assistant message
      if (userId) {
        await supabase.from('coach_messages').insert({ user_id: userId, role: 'assistant', content: data.reply })
      }
    } catch (err) {
      console.error('Coach error:', err)
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.' }])
    } finally {
      setIsSending(false)
    }
  }

  // ─── Save Wearable Data ──────────────────────────
  const saveWearableData = async () => {
    if (!userId) return

    const payload = {
      user_id: userId,
      hrv: wearableForm.hrv ? parseFloat(wearableForm.hrv) : null,
      rhr: wearableForm.rhr ? parseFloat(wearableForm.rhr) : null,
      sleep_hours: wearableForm.sleep_hours ? parseFloat(wearableForm.sleep_hours) : null,
      sleep_quality: wearableForm.sleep_quality,
    }

    const { error } = await supabase.from('wearable_logs').insert(payload)
    if (!error) {
      setWearableData(payload)
      setWearableHistory(prev => [payload, ...prev])
      setShowWearableModal(false)
      setWearableForm({ hrv: '', rhr: '', sleep_hours: '', sleep_quality: 'good' })
    }
  }

  // ─── Handle Key Press ────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-arc-bg flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-2 border-arc-accent/30 border-t-arc-accent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5">
        <div className="p-4 flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-arc-accent to-arc-cyan flex items-center justify-center">
              <BrainIcon />
            </div>
            <div>
              <h1 className="text-sm font-black italic tracking-tight">ARC COACH</h1>
              <span className="text-[10px] text-arc-muted font-medium">AI-Powered Training</span>
            </div>
          </div>
          <ReadinessRing score={readinessScore} size={48} strokeWidth={4} />
        </div>

        {/* Tabs */}
        <div className="flex border-t border-white/5 max-w-lg mx-auto">
          {['chat', 'readiness'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                activeTab === tab ? 'text-arc-accent border-b-2 border-arc-accent' : 'text-arc-muted'
              }`}
            >
              {tab === 'chat' ? 'AI Coach' : 'Readiness'}
            </button>
          ))}
        </div>
      </header>

      <main className="pt-32 max-w-lg mx-auto">
        {activeTab === 'chat' ? (
          /* ─── Chat Tab ─────────────────────────── */
          <div className="flex flex-col h-[calc(100vh-14rem)]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-4">
              {messages.length === 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-12 space-y-6">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-arc-accent/20 to-transparent border border-arc-accent/30 flex items-center justify-center">
                    <BrainIcon />
                  </div>
                  <div>
                    <h2 className="text-lg font-black italic tracking-tight mb-2">Your AI Training Partner</h2>
                    <p className="text-sm text-arc-muted max-w-xs mx-auto">I can analyze your workouts, identify plateaus, and suggest program updates based on your recovery data.</p>
                  </div>

                  {/* Quick Prompts */}
                  <div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">
                    {QUICK_PROMPTS.map((qp, i) => (
                      <motion.button
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * i }}
                        onClick={() => sendMessage(qp.prompt)}
                        className="bg-arc-surface border border-white/5 rounded-xl px-3 py-3 text-left hover:border-arc-accent/30 transition-colors"
                      >
                        <span className="text-xs font-bold text-white">{qp.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-arc-accent text-white rounded-br-md'
                      : 'bg-arc-surface border border-white/5 rounded-bl-md'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </motion.div>
              ))}

              {isSending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-arc-surface border border-white/5 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -6, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                          className="w-2 h-2 bg-arc-muted rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 pb-2 pt-2 border-t border-white/5 bg-arc-bg">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask your coach..."
                  rows={1}
                  className="flex-1 bg-arc-surface border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none resize-none focus:border-arc-accent/50 transition-colors placeholder-arc-muted"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isSending}
                  className="bg-arc-accent p-3 rounded-xl text-white disabled:opacity-30 transition-opacity"
                >
                  <SendIcon />
                </motion.button>
              </div>
            </div>
          </div>
        ) : (
          /* ─── Readiness Tab ────────────────────── */
          <div className="px-4 space-y-6 pb-8">
            {/* Readiness Score Card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-arc-card border border-white/5 rounded-3xl p-6 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-arc-accent/5 blur-3xl rounded-full" />
              <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Today&apos;s Readiness</span>
              <div className="my-4">
                <ReadinessRing score={readinessScore} size={140} strokeWidth={10} />
              </div>

              {/* Wearable Metrics */}
              {wearableData ? (
                <>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="bg-arc-surface rounded-xl p-3">
                      <ActivityIcon />
                      <span className="block text-lg font-black font-mono mt-1">{wearableData.hrv || '—'}</span>
                      <span className="text-[9px] text-arc-muted font-bold uppercase tracking-wider">HRV ms</span>
                    </div>
                    <div className="bg-arc-surface rounded-xl p-3">
                      <HeartIcon />
                      <span className="block text-lg font-black font-mono mt-1">{wearableData.rhr || '—'}</span>
                      <span className="text-[9px] text-arc-muted font-bold uppercase tracking-wider">RHR bpm</span>
                    </div>
                    <div className="bg-arc-surface rounded-xl p-3">
                      <MoonIcon />
                      <span className="block text-lg font-black font-mono mt-1">{wearableData.sleep_hours || '—'}</span>
                      <span className="text-[9px] text-arc-muted font-bold uppercase tracking-wider">Sleep hrs</span>
                    </div>
                  </div>
                  {/* Extended metrics from wearables */}
                  {(wearableData.steps || wearableData.stress_score || wearableData.body_battery) && (
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      {wearableData.steps != null && (
                        <div className="bg-arc-surface rounded-xl p-3">
                          <span className="block text-lg font-black font-mono mt-1">{wearableData.steps?.toLocaleString() || '—'}</span>
                          <span className="text-[9px] text-arc-muted font-bold uppercase tracking-wider">Steps</span>
                        </div>
                      )}
                      {wearableData.stress_score != null && (
                        <div className="bg-arc-surface rounded-xl p-3">
                          <span className="block text-lg font-black font-mono mt-1">{wearableData.stress_score || '—'}</span>
                          <span className="text-[9px] text-arc-muted font-bold uppercase tracking-wider">Stress</span>
                        </div>
                      )}
                      {wearableData.body_battery != null && (
                        <div className="bg-arc-surface rounded-xl p-3">
                          <ZapIcon />
                          <span className="block text-lg font-black font-mono mt-1">{wearableData.body_battery || '—'}</span>
                          <span className="text-[9px] text-arc-muted font-bold uppercase tracking-wider">Battery</span>
                        </div>
                      )}
                    </div>
                  )}
                  {wearableData.source && wearableData.source !== 'manual' && (
                    <div className="flex items-center justify-center gap-1.5 mt-3">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-[9px] text-arc-muted capitalize">Auto-synced from {wearableData.source}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-xs text-arc-muted">No wearable data logged yet.</p>
                  <a
                    href="/settings/wearables"
                    className="block text-xs font-bold text-arc-accent bg-arc-accent/10 border border-arc-accent/20 rounded-xl py-3 text-center hover:bg-arc-accent/20 transition-colors"
                  >
                    Connect Garmin or Fitbit for auto-tracking
                  </a>
                </div>
              )}

              <button
                onClick={() => setShowWearableModal(true)}
                className="mt-4 text-xs font-bold text-arc-accent hover:text-white transition-colors"
              >
                + Log Manually
              </button>
            </motion.div>

            {/* Muscle Recovery Map */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-arc-card border border-white/5 rounded-3xl p-6"
            >
              <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-4">Muscle Recovery</h3>
              <div className="space-y-3">
                {Object.values(muscleRecovery).map((muscle, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-white w-20">{muscle.label}</span>
                    <div className="flex-1 bg-arc-surface rounded-full h-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${muscle.recovery}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: muscle.recovery >= 75 ? '#22c55e' : muscle.recovery >= 50 ? '#00D4AA' : muscle.recovery >= 25 ? '#f59e0b' : '#ef4444'
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold w-10 text-right" style={{
                      color: muscle.recovery >= 75 ? '#22c55e' : muscle.recovery >= 50 ? '#00D4AA' : muscle.recovery >= 25 ? '#f59e0b' : '#ef4444'
                    }}>
                      {muscle.recovery}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Suggestion */}
              {(() => {
                const lowRecovery = Object.values(muscleRecovery).filter(m => m.recovery < 50)
                const highRecovery = Object.values(muscleRecovery).filter(m => m.recovery >= 75)
                if (lowRecovery.length > 0 && highRecovery.length > 0) {
                  return (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                      className="mt-4 bg-arc-accent/10 border border-arc-accent/20 rounded-xl p-3 flex gap-2 items-start"
                    >
                      <ZapIcon />
                      <p className="text-xs text-white leading-relaxed">
                        <strong>{lowRecovery.map(m => m.label).join(', ')}</strong> {lowRecovery.length === 1 ? 'is' : 'are'} still recovering.
                        Consider training <strong>{highRecovery.map(m => m.label).join(', ')}</strong> today.
                      </p>
                    </motion.div>
                  )
                }
                return null
              })()}
            </motion.div>

            {/* Wearable Trend */}
            {wearableHistory.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-arc-card border border-white/5 rounded-3xl p-6"
              >
                <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-4">7-Day Trend</h3>
                <div className="flex gap-1 items-end h-20">
                  {wearableHistory.slice(0, 7).reverse().map((w, i) => {
                    const height = w.hrv ? Math.max(10, (w.hrv / 100) * 100) : 10
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: i * 0.1, duration: 0.5 }}
                          className="w-full rounded-t bg-gradient-to-t from-arc-accent/50 to-arc-accent max-h-full"
                        />
                        <span className="text-[8px] text-arc-muted">{new Date(w.logged_at).toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[9px] text-arc-muted">HRV Trend</span>
                  <span className="text-[9px] text-arc-muted">Last 7 days</span>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </main>

      {/* Wearable Input Modal */}
      <AnimatePresence>
        {showWearableModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowWearableModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-8 z-50 space-y-5 pb-safe"
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
              <h2 className="text-xl font-black italic tracking-tighter text-center">LOG METRICS</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">HRV (ms)</label>
                  <input
                    type="number" value={wearableForm.hrv}
                    onChange={(e) => setWearableForm(p => ({ ...p, hrv: e.target.value }))}
                    placeholder="e.g. 65"
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Resting Heart Rate (bpm)</label>
                  <input
                    type="number" value={wearableForm.rhr}
                    onChange={(e) => setWearableForm(p => ({ ...p, rhr: e.target.value }))}
                    placeholder="e.g. 58"
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Sleep Duration (hours)</label>
                  <input
                    type="number" step="0.5" value={wearableForm.sleep_hours}
                    onChange={(e) => setWearableForm(p => ({ ...p, sleep_hours: e.target.value }))}
                    placeholder="e.g. 7.5"
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Sleep Quality</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['poor', 'fair', 'good', 'excellent'].map(q => (
                      <button
                        key={q}
                        onClick={() => setWearableForm(p => ({ ...p, sleep_quality: q }))}
                        className={`p-3 rounded-xl font-bold text-xs transition-all capitalize ${
                          wearableForm.sleep_quality === q ? 'bg-white text-black' : 'bg-arc-surface text-arc-muted border border-white/5'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={saveWearableData}
                className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform"
              >
                SAVE METRICS
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Nav />
    </div>
  )
}
