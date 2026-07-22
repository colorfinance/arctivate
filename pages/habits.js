import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import LoadingState from '../components/LoadingState'
import { supabase } from '../lib/supabaseClient'
// Lazy-load confetti to keep initial bundle small
const fireConfetti = async (opts) => {
  try {
    const confetti = (await import('canvas-confetti')).default
    confetti(opts)
  } catch {}
}
import { useRouter } from 'next/router'

// Helper for dates - use local date to avoid timezone issues
const fmtLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const getTodayStr = () => fmtLocal(new Date())

// Monday-based start of the current week (weekly habits reset each Monday).
const getWeekStartStr = () => {
  const d = new Date()
  const offset = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - offset)
  return fmtLocal(d)
}

// Preset challenge habits, seeded when a member starts (or restarts) the
// challenge. Weekly ones reset each Monday; daily ones reset each day.
const PRESET_HABITS = [
  { title: '45 minutes of movement every day', frequency: 'daily', points_reward: 10 },
  { title: '10,000+ steps every day', frequency: 'daily', points_reward: 10 },
  { title: '3+ litres of water every day', frequency: 'daily', points_reward: 10 },
  { title: '10+ minutes of self-development every day', frequency: 'daily', points_reward: 10 },
  { title: 'Track your food daily using the app', frequency: 'daily', points_reward: 10 },
  { title: '4+ ARC workouts per week', frequency: 'weekly', points_reward: 20 },
  { title: 'Weekly progress photo', frequency: 'weekly', points_reward: 15 },
  { title: 'Weekly weigh-in', frequency: 'weekly', points_reward: 15 },
]

export default function Habits() {
  const router = useRouter()
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState(new Set()) // Set of daily habit_ids completed today
  const [weeklyDone, setWeeklyDone] = useState(new Set()) // weekly habit_ids completed this week
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [customHabit, setCustomHabit] = useState('')

  // Challenge State
  const [challengeDay, setChallengeDay] = useState(1)
  const [challengeGoal, setChallengeGoal] = useState(30)
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [newGoal, setNewGoal] = useState(30)

  // Admin-published challenges (shown in the tick list) + today's completions
  const [challenges, setChallenges] = useState([])
  const [challengeLogs, setChallengeLogs] = useState(new Set()) // challenge_ids done today
  const [showWelcome, setShowWelcome] = useState(false)
  const [showCongrats, setShowCongrats] = useState(false)

  // Points State
  const [totalPoints, setTotalPoints] = useState(0)

  // Load Data
  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // 1. Fetch Challenge Info & Points
      const { data: profile } = await supabase.from('profiles').select('challenge_start_date, challenge_days_goal, total_points, completed_onboarding').eq('id', user.id).single()

      if (profile && profile.completed_onboarding === false) {
        router.push('/onboarding')
        return
      }

      if (profile) {
          if (profile.challenge_start_date) {
            const start = new Date(profile.challenge_start_date)
            const now = new Date()
            // Use UTC dates for consistent day calculation
            const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
            const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
            const diff = Math.floor((nowDay - startDay) / (1000 * 60 * 60 * 24)) + 1
            setChallengeDay(Math.max(1, diff))

            const goal = profile.challenge_days_goal || 30
            try {
              if (diff >= goal) {
                // Challenge complete — congratulate once per challenge start.
                const ackd = localStorage.getItem('arc_challenge_completed_ack')
                if (ackd !== profile.challenge_start_date) setShowCongrats(true)
              } else {
                // Otherwise show the welcome once per challenge start. Tying it
                // to the start date means an admin reset re-shows it.
                const seen = localStorage.getItem('arc_challenge_welcomed')
                if (seen !== profile.challenge_start_date) setShowWelcome(true)
              }
            } catch {}
          }
          setChallengeGoal(profile.challenge_days_goal || 30)
          setTotalPoints(profile.total_points || 0)
      }

      // Admin-published challenges + today's completions (defensive: the
      // tables may not exist yet on older DBs).
      const today0 = getTodayStr()
      try {
        // Coach challenges only stay up for 24 hours after they're posted.
        const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: chData } = await supabase
          .from('challenges')
          .select('*')
          .eq('is_active', true)
          .gte('created_at', cutoff24h)
          .order('created_at', { ascending: true })
        setChallenges(chData || [])

        const { data: chLogs } = await supabase
          .from('challenge_logs')
          .select('challenge_id')
          .eq('user_id', user.id)
          .eq('date', today0)
        setChallengeLogs(new Set(chLogs?.map(l => l.challenge_id) || []))
      } catch {
        setChallenges([])
      }

      // 2. Fetch Habits
      let { data: habitsData } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      habitsData = habitsData || []

      // Seed the challenge preset habits once per challenge start (also covers
      // an admin reset, which bumps the start date so presets refresh).
      if (profile?.challenge_start_date) {
        try {
          const seededFor = localStorage.getItem('arc_presets_seeded')
          if (seededFor !== profile.challenge_start_date) {
            const have = new Set(habitsData.map(h => h.title.toLowerCase()))
            const toAdd = PRESET_HABITS
              .filter(p => !have.has(p.title.toLowerCase()))
              .map(p => ({ user_id: user.id, title: p.title, frequency: p.frequency, points_reward: p.points_reward, is_preset: true }))
            if (toAdd.length) {
              const { data: inserted, error: seedErr } = await supabase.from('habits').insert(toAdd).select()
              if (inserted?.length) habitsData = [...habitsData, ...inserted]
              // Only mark done on success, so it retries after migration 019 lands.
              if (!seedErr) localStorage.setItem('arc_presets_seeded', profile.challenge_start_date)
            } else {
              localStorage.setItem('arc_presets_seeded', profile.challenge_start_date)
            }
          }
        } catch {}
      }

      // 3. Fetch this week's logs (covers daily = today and weekly = any day
      // since Monday).
      const today = getTodayStr()
      const weekStart = getWeekStartStr()
      const { data: logsData } = await supabase
        .from('habit_logs')
        .select('habit_id, date')
        .eq('user_id', user.id)
        .gte('date', weekStart)

      const freqById = new Map(habitsData.map(h => [h.id, h.frequency || 'daily']))
      const todaySet = new Set()
      const weekSet = new Set()
      ;(logsData || []).forEach(l => {
        if ((freqById.get(l.habit_id) || 'daily') === 'weekly') weekSet.add(l.habit_id)
        else if (l.date === today) todaySet.add(l.habit_id)
      })

      // Set State
      setHabits(habitsData)
      setLogs(todaySet)
      setWeeklyDone(weekSet)

      // Fetch progress photos
      await fetchProgressPhotos(user.id)
    } catch {
      // swallow
    } finally {
      setLoading(false)
    }
  }

  const [isUpdating, setIsUpdating] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Progress Photo State
  const [progressPhoto, setProgressPhoto] = useState(null) // today's photo URL
  const [photoGallery, setPhotoGallery] = useState([]) // last 7 days [{date, url}]
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const updateGoal = async (restart = false) => {
    const goal = parseInt(newGoal, 10)

    // Validate goal is a reasonable number
    if (isNaN(goal) || goal < 1 || goal > 365) {
      showToast('Please enter a goal between 1 and 365 days')
      return
    }

    setIsUpdating(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast('Please log in to continue')
        return
      }

      const updates = { challenge_days_goal: goal }

      // If restarting, reset the start date to NOW
      if (restart) {
        updates.challenge_start_date = new Date().toISOString()
      }

      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)

      if (error) {
        showToast('Failed to update goal')
        return
      }

      setChallengeGoal(goal)
      setNewGoal(goal)
      if (restart) {
        setChallengeDay(1)
        fireConfetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: ['#00D4AA', '#06B6D4', '#ffffff'] })
      }
      setIsEditingGoal(false)
    } catch {
      showToast('Something went wrong')
    } finally {
      setIsUpdating(false)
    }
  }

  const toggleHabit = async (habitId) => {
    const habit = habits.find(h => h.id === habitId)
    const isWeekly = (habit?.frequency || 'daily') === 'weekly'
    const doneSet = isWeekly ? weeklyDone : logs
    const setDone = isWeekly ? setWeeklyDone : setLogs
    const snapshot = new Set(doneSet)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast('Please log in to track habits')
        return
      }

      const today = getTodayStr()
      const isCompleted = snapshot.has(habitId)
      const newLogs = new Set(snapshot)

      if (isCompleted) {
        newLogs.delete(habitId)
        setDone(newLogs)

        // Weekly: clear any completion this week. Daily: clear today's.
        let del = supabase.from('habit_logs').delete()
          .eq('user_id', user.id).eq('habit_id', habitId)
        del = isWeekly ? del.gte('date', getWeekStartStr()) : del.eq('date', today)
        const { error } = await del

        if (error) {
          setDone(snapshot)
          showToast('Failed to update habit')
        } else {
          showToast('Habit unchecked')
        }
      } else {
        newLogs.add(habitId)
        setDone(newLogs)

        const logData = {
          user_id: user.id,
          habit_id: habitId,
          date: today,
          completed_at: new Date().toISOString()
        }

        // Try insert first; if duplicate constraint exists it will fail, then try upsert
        let insertError = null
        const { error: directError } = await supabase
          .from('habit_logs')
          .insert(logData)

        if (directError) {
          // If it's a duplicate/conflict error, try upsert
          if (directError.code === '23505') {
            const { error: upsertError } = await supabase
              .from('habit_logs')
              .upsert(logData, { onConflict: 'user_id,habit_id,date' })
            insertError = upsertError
          } else {
            insertError = directError
          }
        }

        if (insertError) {
          setDone(snapshot)
          showToast('Failed to update habit')
          return
        }

        // Award points for completing habit
        const pointsToAward = habit?.points_reward || 10
        showToast(`Habit completed! +${pointsToAward} pts`)
        await supabase.rpc('increment_points', { row_id: user.id, x: pointsToAward })
        setTotalPoints(prev => prev + pointsToAward)

        // Celebrate the "close" moments: daily ring closing (green) and, if the
        // weekly tasks are also done, the full gold finish.
        const dTotal = habits.filter(h => (h.frequency || 'daily') !== 'weekly').length + challenges.length
        const wTotal = habits.filter(h => (h.frequency || 'daily') === 'weekly').length
        const dDone = (isWeekly ? logs.size : newLogs.size) + challengeLogs.size
        const wDone = isWeekly ? newLogs.size : weeklyDone.size
        if (dTotal > 0 && dDone >= dTotal) {
          const goldFinish = wTotal > 0 && wDone >= wTotal
          fireConfetti({ particleCount: goldFinish ? 160 : 100, spread: goldFinish ? 90 : 70, origin: { y: 0.6 }, colors: goldFinish ? ['#FFD700', '#00D4AA', '#ffffff'] : ['#00D4AA', '#06B6D4', '#ffffff'] })
          showToast(goldFinish ? 'Daily + weekly complete! 🏆' : 'Daily tasks complete! 🔥')
        }
      }
    } catch {
      setDone(snapshot)
      showToast('Something went wrong')
    }
  }

  // Celebrate when the completion screen appears.
  useEffect(() => {
    if (!showCongrats) return
    fireConfetti({ particleCount: 220, spread: 120, origin: { y: 0.5 }, colors: ['#00D4AA', '#06B6D4', '#FFD700', '#ffffff'] })
    const t = setTimeout(() => fireConfetti({ particleCount: 120, spread: 90, origin: { y: 0.6 }, colors: ['#00D4AA', '#FFD700'] }), 600)
    return () => clearTimeout(t)
  }, [showCongrats])

  const dismissCongrats = () => {
    setShowCongrats(false)
    try {
      supabase.auth.getUser().then(({ data }) => {
        if (!data?.user) return
        supabase.from('profiles').select('challenge_start_date').eq('id', data.user.id).single()
          .then(({ data: p }) => { if (p?.challenge_start_date) localStorage.setItem('arc_challenge_completed_ack', p.challenge_start_date) })
      })
    } catch {}
  }

  const dismissWelcome = () => {
    setShowWelcome(false)
    try {
      // Persist against the current start date so it won't re-show until reset.
      supabase.auth.getUser().then(({ data }) => {
        if (!data?.user) return
        supabase.from('profiles').select('challenge_start_date').eq('id', data.user.id).single()
          .then(({ data: p }) => { if (p?.challenge_start_date) localStorage.setItem('arc_challenge_welcomed', p.challenge_start_date) })
      })
    } catch {}
  }

  const toggleChallenge = async (challengeId) => {
    const snapshot = new Set(challengeLogs)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('Please log in'); return }
      const today = getTodayStr()
      const isDone = snapshot.has(challengeId)
      const next = new Set(snapshot)

      if (isDone) {
        next.delete(challengeId)
        setChallengeLogs(next)
        const { error } = await supabase
          .from('challenge_logs')
          .delete()
          .eq('user_id', user.id).eq('challenge_id', challengeId).eq('date', today)
        if (error) { setChallengeLogs(snapshot); showToast('Failed to update') }
        else showToast('Challenge unchecked')
      } else {
        next.add(challengeId)
        setChallengeLogs(next)
        const row = { user_id: user.id, challenge_id: challengeId, date: today, completed_at: new Date().toISOString() }
        let insertError = null
        const { error: directError } = await supabase.from('challenge_logs').insert(row)
        if (directError) {
          if (directError.code === '23505') {
            const { error: upsertError } = await supabase.from('challenge_logs').upsert(row, { onConflict: 'user_id,challenge_id,date' })
            insertError = upsertError
          } else insertError = directError
        }
        if (insertError) { setChallengeLogs(snapshot); showToast('Failed to update'); return }

        const ch = challenges.find(c => c.id === challengeId)
        const pts = ch?.points_reward || 10
        await supabase.rpc('increment_points', { row_id: user.id, x: pts })
        setTotalPoints(prev => prev + pts)

        // If this closed the daily ring, celebrate that; otherwise a small pop.
        const dTotal = habits.filter(h => (h.frequency || 'daily') !== 'weekly').length + challenges.length
        const dDone = logs.size + next.size
        if (dTotal > 0 && dDone >= dTotal) {
          fireConfetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#00D4AA', '#06B6D4', '#ffffff'] })
          showToast('Daily tasks complete! 🔥')
        } else {
          showToast(`Challenge done! +${pts} pts`)
          fireConfetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ['#00D4AA', '#06B6D4', '#ffffff'] })
        }
      }
    } catch {
      setChallengeLogs(snapshot)
      showToast('Something went wrong')
    }
  }

  const addCustom = async () => {
    if (!customHabit.trim()) {
      showToast('Please enter a habit name')
      return
    }

    setIsUpdating(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast('Please log in to continue')
        return
      }

      const { data, error } = await supabase.from('habits').insert({
        user_id: user.id,
        title: customHabit.trim(),
        points_reward: 10
      }).select().single()

      if (error) {
        showToast('Failed to add habit')
        return
      }

      if (data) {
        setHabits([...habits, data])
        setCustomHabit('')
        setIsAdding(false)
      }
    } catch {
      showToast('Something went wrong')
    } finally {
      setIsUpdating(false)
    }
  }

  const deleteHabit = async (id) => {
    // Optimistic update
    const previousHabits = habits
    setHabits(habits.filter(h => h.id !== id))
    setConfirmDeleteId(null)

    try {
      const { error } = await supabase.from('habits').delete().eq('id', id)

      if (error) {
        setHabits(previousHabits)
        showToast('Failed to delete habit')
      } else {
        showToast('Habit removed')
      }
    } catch {
      setHabits(previousHabits)
      showToast('Something went wrong')
    }
  }

  // --- Progress Photo Functions ---

  async function fetchProgressPhotos(userId) {
    try {
      const today = getTodayStr()

      // Check if today's photo exists by trying to get its public URL
      const todayPath = `${userId}/${today}.jpg`
      const { data: todayData } = supabase.storage
        .from('progress-photos')
        .getPublicUrl(todayPath)

      // We need to verify the file actually exists by listing
      const { data: listData, error: listError } = await supabase.storage
        .from('progress-photos')
        .list(userId, { limit: 100, sortBy: { column: 'name', order: 'desc' } })

      if (listError) {
        setPhotoError('Could not load progress photos')
        return
      }

      if (!listData || listData.length === 0) {
        setProgressPhoto(null)
        setPhotoGallery([])
        return
      }

      // Filter to only .jpg files and get last 7 days
      const photoFiles = listData
        .filter(f => f.name.endsWith('.jpg'))
        .sort((a, b) => b.name.localeCompare(a.name))
        .slice(0, 7)

      // Check if today's photo exists in the list
      const todayFile = photoFiles.find(f => f.name === `${today}.jpg`)
      if (todayFile) {
        const { data: urlData } = supabase.storage
          .from('progress-photos')
          .getPublicUrl(`${userId}/${today}.jpg`)
        setProgressPhoto(urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : null)
      } else {
        setProgressPhoto(null)
      }

      // Build gallery
      const gallery = photoFiles.map(f => {
        const date = f.name.replace('.jpg', '')
        const { data: urlData } = supabase.storage
          .from('progress-photos')
          .getPublicUrl(`${userId}/${f.name}`)
        return {
          date,
          url: urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : null,
          name: f.name
        }
      }).filter(item => item.url)

      setPhotoGallery(gallery)
      setPhotoError(null)
    } catch {
      setPhotoError('Could not load progress photos')
    }
  }

  function resizeImage(file, maxWidth = 800) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const reader = new FileReader()

      reader.onload = (e) => {
        img.onload = () => {
          let width = img.width
          let height = img.height

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob)
              else reject(new Error('Failed to resize image'))
            },
            'image/jpeg',
            0.85
          )
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target.result
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  async function uploadProgressPhoto(file) {
    if (!file) return
    setIsUploadingPhoto(true)
    setPhotoError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast('Please log in to upload photos')
        return
      }

      // Resize image
      const resizedBlob = await resizeImage(file)

      const today = getTodayStr()
      const filePath = `${user.id}/${today}.jpg`

      // Upload (upsert: true will overwrite if same day)
      const { error: uploadError } = await supabase.storage
        .from('progress-photos')
        .upload(filePath, resizedBlob, {
          contentType: 'image/jpeg',
          upsert: true
        })

      if (uploadError) {
        setPhotoError('Upload failed. Make sure the storage bucket exists.')
        showToast('Photo upload failed')
        return
      }

      // Get public URL for the newly uploaded photo
      const { data: urlData } = supabase.storage
        .from('progress-photos')
        .getPublicUrl(filePath)

      if (urlData?.publicUrl) {
        setProgressPhoto(`${urlData.publicUrl}?t=${Date.now()}`)
      }

      // Refresh gallery
      await fetchProgressPhotos(user.id)

      showToast('Progress photo saved!')
      fireConfetti({ particleCount: 60, spread: 50, origin: { y: 0.7 }, colors: ['#00D4AA', '#22c55e'] })
    } catch {
      setPhotoError('Something went wrong during upload')
      showToast('Photo upload failed')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // Calc progress. The ring tracks DAILY tasks (daily habits + admin
  // challenges, both reset each day) so members can "close" it every day by
  // finishing their dailies — weekly tasks don't hold the ring open.
  const dailyHabits = habits.filter(h => (h.frequency || 'daily') !== 'weekly')
  const weeklyHabits = habits.filter(h => (h.frequency || 'daily') === 'weekly')

  const dailyTotal = dailyHabits.length + challenges.length
  const dailyDoneCount = logs.size + challengeLogs.size
  const weeklyTotal = weeklyHabits.length
  const weeklyDoneCount = weeklyDone.size

  const allDailyDone = dailyTotal > 0 && dailyDoneCount >= dailyTotal
  const allWeeklyDone = weeklyTotal > 0 && weeklyDoneCount >= weeklyTotal
  // Ring closes on daily completion; percent is daily progress.
  const dailyPercent = dailyTotal === 0 ? 0 : Math.round((dailyDoneCount / dailyTotal) * 100)
  const challengeProgress = Math.min((challengeDay / challengeGoal) * 100, 100)

  if (loading) {
    return <LoadingState label="Loading habits…" />
  }

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans selection:bg-arc-accent selection:text-white">

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 20 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-0 left-1/2 -translate-x-1/2 z-50 bg-arc-surface border border-white/10 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md"
            >
              <div className="w-2 h-2 rounded-full bg-arc-accent animate-pulse" />
              <span className="text-sm font-medium">{toast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5 p-6">
            <div className="flex justify-between items-center">
                <h1 className="text-xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                    PROTOCOL
                </h1>
                <button onClick={() => setIsAdding(true)} className="text-[10px] font-bold text-arc-accent uppercase tracking-widest border border-arc-accent/30 px-3 py-1.5 rounded-full hover:bg-arc-accent hover:text-white transition-colors">
                    + Add
                </button>
            </div>

            {/* Points Display */}
            <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Earned</span>
                <span className="text-lg font-black font-mono text-arc-cyan">{totalPoints.toLocaleString()}</span>
                <span className="text-xs text-arc-muted">PTS</span>
            </div>
        </header>

        <main className="pt-36 px-6 space-y-8 max-w-lg mx-auto">
            
            {/* Challenge Progress */}
            <section className="relative pt-2">
                 <div className="flex justify-between items-end mb-2 px-1">
                    <div>
                        <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Challenge Phase 1</span>
                        <div className="text-2xl font-black italic flex items-baseline gap-2">
                            DAY {challengeDay} 
                            <button onClick={() => setIsEditingGoal(true)} className="text-white/20 text-lg hover:text-white transition-colors border-b border-transparent hover:border-white/20">
                                / {challengeGoal}
                            </button>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-mono font-bold text-arc-accent">{Math.round(challengeProgress)}%</div>
                    </div>
                 </div>
                 
                 {/* Progress Bar */}
                 <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${challengeProgress}%` }} 
                        className="h-full bg-gradient-to-r from-arc-accent to-arc-cyan"
                    />
                 </div>
            </section>

            {/* Daily Grind Circle — closes when daily tasks are done, turns gold when weekly are too */}
            <section className="bg-glass-gradient border border-white/5 p-6 rounded-[2rem] flex items-center justify-between relative overflow-hidden">
                <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full pointer-events-none ${allDailyDone && allWeeklyDone ? 'bg-yellow-400/10' : allDailyDone ? 'bg-green-500/10' : 'bg-green-500/5'}`} />

                <div>
                    <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1">Daily Grind</h2>
                    <div className="text-4xl font-black italic tracking-tighter">
                        <span className={allDailyDone ? (allWeeklyDone ? "text-yellow-400" : "text-green-500") : "text-white"}>
                            {dailyDoneCount}
                        </span>
                        <span className="text-white/20">/{dailyTotal}</span>
                    </div>
                    <div className="text-[10px] font-bold mt-1 uppercase">
                        {allDailyDone
                            ? <span className={allWeeklyDone ? 'text-yellow-400' : 'text-green-500'}>{allWeeklyDone ? 'All done — daily + weekly 🏆' : 'Daily done! 🔥'}</span>
                            : <span className="text-arc-muted">Daily tasks</span>}
                    </div>
                    {weeklyTotal > 0 && (
                        <div className="text-[10px] font-bold mt-1.5 uppercase tracking-wider">
                            <span className={allWeeklyDone ? 'text-yellow-400' : 'text-arc-muted'}>Weekly {weeklyDoneCount}/{weeklyTotal}{allWeeklyDone ? ' ⭐' : ''}</span>
                        </div>
                    )}
                </div>

                {/* Ring Chart */}
                <div className="relative w-20 h-20">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle className="text-white/5 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                        <motion.circle
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: dailyPercent / 100 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`${allDailyDone && allWeeklyDone ? 'text-yellow-400' : allDailyDone ? 'text-green-500' : 'text-arc-accent'} stroke-current drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
                            strokeWidth="8"
                            strokeLinecap="round"
                            cx="50" cy="50" r="40"
                            fill="transparent"
                        ></motion.circle>
                    </svg>
                    {/* Centre check when the daily ring is closed */}
                    {allDailyDone && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <svg className={`w-7 h-7 ${allWeeklyDone ? 'text-yellow-400' : 'text-green-500'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                    )}
                </div>
            </section>

            {/* Admin Challenges */}
            {challenges.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <span className="text-[10px] font-bold text-arc-accent uppercase tracking-widest">Challenge</span>
                        <span className="text-[9px] font-bold text-arc-muted uppercase tracking-wider bg-arc-accent/10 border border-arc-accent/20 px-2 py-0.5 rounded-full">From the coaches</span>
                    </div>
                    {challenges.map(ch => {
                        const isDone = challengeLogs.has(ch.id)
                        return (
                            <motion.div
                                key={ch.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => toggleChallenge(ch.id)}
                                className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer relative overflow-hidden group transition-all duration-300 ${isDone ? 'bg-arc-accent/10 border-arc-accent/40' : 'bg-arc-surface border-arc-accent/20 hover:border-arc-accent/40'}`}
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-arc-accent/5 blur-2xl rounded-full pointer-events-none" />
                                <div className="flex items-center gap-4 z-10">
                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isDone ? 'bg-arc-accent border-arc-accent' : 'border-arc-accent/40 group-hover:border-arc-accent'}`}>
                                        {isDone && <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></motion.svg>}
                                    </div>
                                    <div>
                                        <div className={`font-bold text-sm transition-colors ${isDone ? 'text-arc-accent line-through decoration-2 opacity-70' : 'text-white'}`}>{ch.title}</div>
                                        <div className="text-[10px] text-arc-muted font-bold uppercase tracking-wider">{ch.points_reward || 10} PTS · Challenge</div>
                                    </div>
                                </div>
                            </motion.div>
                        )
                    })}
                </section>
            )}

            {/* Weekly Habits */}
            {weeklyHabits.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">This Week</span>
                        <span className="text-[9px] font-bold text-arc-cyan uppercase tracking-wider bg-arc-cyan/10 border border-arc-cyan/20 px-2 py-0.5 rounded-full">Resets Monday</span>
                    </div>
                    {weeklyHabits.map(habit => {
                        const isDone = weeklyDone.has(habit.id)
                        return (
                            <motion.div
                                key={habit.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => toggleHabit(habit.id)}
                                className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer relative overflow-hidden group transition-all duration-300 ${isDone ? 'bg-arc-cyan/10 border-arc-cyan/30' : 'bg-arc-surface border-white/5 hover:border-white/10'}`}
                            >
                                <div className="flex items-center gap-4 z-10">
                                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isDone ? 'bg-arc-cyan border-arc-cyan' : 'border-white/20 group-hover:border-white/40'}`}>
                                        {isDone && <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></motion.svg>}
                                    </div>
                                    <div>
                                        <div className={`font-bold text-sm transition-colors ${isDone ? 'text-arc-cyan line-through decoration-2 opacity-70' : 'text-white'}`}>{habit.title}</div>
                                        <div className="text-[10px] text-arc-muted font-bold uppercase tracking-wider">{habit.points_reward || 10} PTS · Weekly</div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(habit.id); }}
                                    className="z-10 text-white/20 hover:text-red-500 transition-colors p-2"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                            </motion.div>
                        )
                    })}
                </section>
            )}

            {/* Daily Habits */}
            <section className="space-y-3 pb-12">
                <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest px-1 block">Daily Habits</span>
                {dailyHabits.map(habit => {
                    const isDone = logs.has(habit.id)
                    return (
                        <motion.div
                            key={habit.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => toggleHabit(habit.id)}
                            className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer relative overflow-hidden group transition-all duration-300 ${isDone ? 'bg-green-500/10 border-green-500/30' : 'bg-arc-surface border-white/5 hover:border-white/10'}`}
                        >
                            <div className="flex items-center gap-4 z-10">
                                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isDone ? 'bg-green-500 border-green-500' : 'border-white/20 group-hover:border-white/40'}`}>
                                    {isDone && <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></motion.svg>}
                                </div>
                                <div>
                                    <div className={`font-bold text-sm transition-colors ${isDone ? 'text-green-500 line-through decoration-2 opacity-70' : 'text-white'}`}>{habit.title}</div>
                                    <div className="text-[10px] text-arc-muted font-bold uppercase tracking-wider">{habit.points_reward || 10} PTS</div>
                                </div>
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(habit.id); }}
                                className="z-10 text-white/20 hover:text-red-500 transition-colors p-2"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                        </motion.div>
                    )
                })}

                {dailyHabits.length === 0 && !loading && (
                    <div className="text-center py-6 opacity-50 text-sm">No daily habits. Add one!</div>
                )}

                {/* Nudge: the challenge asks for at least one personal habit */}
                <button onClick={() => setIsAdding(true)} className="w-full mt-1 border border-dashed border-white/10 rounded-xl py-3 text-xs font-bold text-arc-muted hover:text-white hover:border-arc-accent/30 transition-colors">
                    + Add your own personal habit
                </button>
            </section>

            {/* Progress Photo Section - 75 Hard Style */}
            <section className="space-y-4 pb-12">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1">Progress Photo</h2>
                        <p className="text-xs text-arc-muted">One photo per day. Stay accountable.</p>
                    </div>
                    {progressPhoto && (
                        <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest flex items-center gap-1">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Done Today
                        </span>
                    )}
                </div>

                {/* Today's Photo or Upload */}
                <div className="bg-glass-gradient border border-white/5 rounded-[2rem] p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-arc-accent/5 blur-3xl rounded-full pointer-events-none" />

                    {progressPhoto ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative"
                        >
                            <img
                                src={progressPhoto}
                                alt={`Progress photo for ${getTodayStr()}`}
                                className="w-full rounded-xl object-cover max-h-80"
                            />
                            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full">
                                <span className="text-[10px] font-bold text-white uppercase tracking-widest">
                                    {getTodayStr()}
                                </span>
                            </div>
                            {/* Allow re-upload / replace */}
                            <label className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full cursor-pointer hover:bg-black/80 transition-colors">
                                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Replace</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        if (e.target.files?.[0]) uploadProgressPhoto(e.target.files[0])
                                    }}
                                />
                            </label>
                        </motion.div>
                    ) : (
                        <label className={`flex flex-col items-center justify-center py-10 cursor-pointer group ${isUploadingPhoto ? 'pointer-events-none' : ''}`}>
                            {isUploadingPhoto ? (
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-2 border-arc-accent border-t-transparent rounded-full animate-spin" />
                                    <span className="text-xs text-arc-muted font-bold">Uploading...</span>
                                </div>
                            ) : (
                                <>
                                    <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/10 group-hover:border-arc-accent/50 flex items-center justify-center transition-colors mb-3">
                                        <svg className="w-7 h-7 text-white/20 group-hover:text-arc-accent/50 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                            <circle cx="8.5" cy="8.5" r="1.5"/>
                                            <polyline points="21 15 16 10 5 21"/>
                                        </svg>
                                    </div>
                                    <span className="text-sm font-bold text-white/40 group-hover:text-white/60 transition-colors">
                                        Tap to upload today&apos;s photo
                                    </span>
                                    <span className="text-[10px] text-arc-muted mt-1">
                                        Max 800px, compressed automatically
                                    </span>
                                </>
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={isUploadingPhoto}
                                onChange={(e) => {
                                    if (e.target.files?.[0]) uploadProgressPhoto(e.target.files[0])
                                }}
                            />
                        </label>
                    )}

                    {/* Error Message */}
                    {photoError && (
                        <motion.p
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-400 mt-3 text-center"
                        >
                            {photoError}
                        </motion.p>
                    )}
                </div>

                {/* Photo Gallery - Last 7 Days */}
                {photoGallery.length > 0 && (
                    <div>
                        <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-3">Recent Progress</h3>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                            {photoGallery.map((photo) => (
                                <motion.div
                                    key={photo.date}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex-shrink-0 relative group"
                                >
                                    <img
                                        src={photo.url}
                                        alt={`Progress ${photo.date}`}
                                        className="w-24 h-32 object-cover rounded-xl border border-white/5 group-hover:border-arc-accent/30 transition-colors"
                                    />
                                    <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                                        <span className="text-[8px] font-bold text-white/80 tracking-wider">
                                            {new Date(photo.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                    </div>
                                    {photo.date === getTodayStr() && (
                                        <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </main>

        {/* Challenge complete — congratulations */}
        <AnimatePresence>
            {showCongrats && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={dismissCongrats}
                        className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60]"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-6"
                    >
                        <div className="bg-arc-card border border-arc-accent/40 rounded-[2rem] p-8 w-full max-w-sm text-center space-y-5 relative overflow-hidden shadow-glow">
                            <div className="absolute -top-10 -left-10 w-40 h-40 bg-arc-accent/15 blur-3xl rounded-full pointer-events-none" />
                            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-arc-cyan/15 blur-3xl rounded-full pointer-events-none" />
                            <div className="text-5xl">🏆</div>
                            <div>
                                <div className="text-[10px] font-bold text-arc-accent uppercase tracking-[0.2em] mb-2">Challenge Complete</div>
                                <h2 className="text-2xl font-black italic tracking-tighter leading-tight">CONGRATULATIONS!</h2>
                            </div>
                            <p className="text-sm text-arc-muted leading-relaxed">
                                You finished the {challengeGoal}-day Arctivate Challenge. {challengeGoal} days of showing up — that&apos;s the hard part, and you did it. Take a moment to be proud, then keep the momentum going. 🔥
                            </p>
                            <button
                                onClick={dismissCongrats}
                                className="w-full bg-arc-accent text-white font-black italic py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform"
                            >
                                LET&apos;S KEEP GOING
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Welcome to the Challenge */}
        <AnimatePresence>
            {showWelcome && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={dismissWelcome}
                        className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60]"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-6"
                    >
                        <div className="bg-arc-card border border-arc-accent/30 rounded-[2rem] p-8 w-full max-w-sm text-center space-y-5 relative overflow-hidden shadow-glow">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-arc-accent/10 blur-3xl rounded-full pointer-events-none" />
                            <div className="text-4xl">🔥</div>
                            <div>
                                <div className="text-[10px] font-bold text-arc-accent uppercase tracking-[0.2em] mb-2">Day 1</div>
                                <h2 className="text-2xl font-black italic tracking-tighter leading-tight">WELCOME TO THE<br/>ARCTIVATE CHALLENGE</h2>
                            </div>
                            <p className="text-sm text-arc-muted leading-relaxed">
                                A fresh start. Tick off your daily habits and coach challenges, snap your progress photo, and lock in every day. Let&apos;s build the streak.
                            </p>
                            <button
                                onClick={dismissWelcome}
                                className="w-full bg-arc-accent text-white font-black italic py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform"
                            >
                                LET&apos;S GO
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Add Habit Sheet */}
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
                        <h2 className="text-xl font-black italic tracking-tighter text-center">ADD HABIT</h2>
                        
                        <input 
                            type="text" 
                            value={customHabit}
                            onChange={(e) => setCustomHabit(e.target.value)}
                            placeholder="e.g. Read 10 Pages"
                            className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
                            autoFocus
                        />

                        <button 
                            onClick={addCustom}
                            className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform"
                        >
                            SAVE HABIT
                        </button>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Edit Goal Sheet */}
        <AnimatePresence>
            {isEditingGoal && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setIsEditingGoal(false)}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    />
                    <motion.div 
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-8 z-50 space-y-6 pb-safe"
                    >
                        <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-4" />
                        <h2 className="text-xl font-black italic tracking-tighter text-center">SET CHALLENGE GOAL</h2>
                        
                        <div>
                            <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Duration (Days)</label>
                            <input 
                                type="number" 
                                value={newGoal}
                                onChange={(e) => setNewGoal(e.target.value)}
                                className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold text-center text-3xl"
                                autoFocus
                            />
                        </div>

                        <div className="space-y-3">
                            <button 
                                onClick={() => updateGoal(false)}
                                className="w-full bg-white/10 text-white font-bold py-4 rounded-xl text-lg hover:bg-white/20 transition-colors"
                            >
                                UPDATE GOAL ONLY
                            </button>
                            
                            <button 
                                onClick={() => { if(confirm("Restart challenge to Day 1?")) updateGoal(true) }}
                                className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform"
                            >
                                LOCK IN & RESTART
                            </button>
                        </div>
                        
                        <p className="text-center text-xs text-arc-muted">
                            "Lock In" resets your counter to Day 1.
                        </p>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Delete Confirmation */}
        <AnimatePresence>
            {confirmDeleteId && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setConfirmDeleteId(null)}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-6"
                    >
                        <div className="bg-arc-card border border-white/10 rounded-2xl p-6 w-full max-w-xs text-center space-y-4">
                            <h3 className="text-lg font-black italic">DELETE HABIT?</h3>
                            <p className="text-sm text-arc-muted">This action cannot be undone.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-3 rounded-xl border border-white/10 text-arc-muted font-bold">Cancel</button>
                                <button onClick={() => deleteHabit(confirmDeleteId)} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold">Delete</button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        <Nav />
    </div>
  )
}
