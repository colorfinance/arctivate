import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import confetti from 'canvas-confetti'
import { useRouter } from 'next/router'

// Helper for dates - use local date to avoid timezone issues
const getTodayStr = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function Habits() {
  const router = useRouter()
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState(new Set()) // Set of habit_ids completed today
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [customHabit, setCustomHabit] = useState('')

  // Challenge State
  const [challengeDay, setChallengeDay] = useState(1)
  const [challengeGoal, setChallengeGoal] = useState(75)
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [newGoal, setNewGoal] = useState(75)

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
          }
          setChallengeGoal(profile.challenge_days_goal || 75)
          setTotalPoints(profile.total_points || 0)
      }

      // 2. Fetch Habits
      const { data: habitsData } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      // 3. Fetch Today's Logs
      const today = getTodayStr()
      const { data: logsData } = await supabase
        .from('habit_logs')
        .select('habit_id')
        .eq('user_id', user.id)
        .eq('date', today)

      // Set State
      setHabits(habitsData || [])
      setLogs(new Set(logsData?.map(l => l.habit_id) || []))

      // Fetch progress photos
      await fetchProgressPhotos(user.id)
    } catch (err) {
      console.error('Error loading habits data:', err)
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
        console.error('Error updating goal:', error)
        showToast('Failed to update goal')
        return
      }

      setChallengeGoal(goal)
      setNewGoal(goal)
      if (restart) {
        setChallengeDay(1)
        confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: ['#FF3B00', '#ffffff'] })
      }
      setIsEditingGoal(false)
    } catch (err) {
      console.error('Unexpected error:', err)
      showToast('Something went wrong')
    } finally {
      setIsUpdating(false)
    }
  }

  const toggleHabit = async (habitId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast('Please log in to track habits')
        return
      }

      const today = getTodayStr()

      // Optimistic Update
      const isCompleted = logs.has(habitId)
      const newLogs = new Set(logs)

      if (isCompleted) {
        newLogs.delete(habitId)
        setLogs(newLogs)

        // Remove from DB
        const { error } = await supabase
          .from('habit_logs')
          .delete()
          .eq('user_id', user.id)
          .eq('habit_id', habitId)
          .eq('date', today)

        if (error) {
          console.error('Error removing habit log:', error)
          // Revert optimistic update
          setLogs(logs)
          showToast('Failed to update habit')
        } else {
          showToast('Habit unchecked')
        }
      } else {
        newLogs.add(habitId)
        setLogs(newLogs)

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

        const error = insertError

        if (error) {
          console.error('Error adding habit log:', error)
          console.log('SUPABASE ERROR OBJECT:', error)
          // Revert optimistic update
          setLogs(logs)
          showToast('Failed to update habit')
          return
        }

        showToast('Habit completed! +10 pts')

        // Award points for completing habit
        const habit = habits.find(h => h.id === habitId)
        if (habit) {
          const pointsToAward = habit.points_reward || 10
          await supabase.rpc('increment_points', { row_id: user.id, x: pointsToAward })
          setTotalPoints(prev => prev + pointsToAward)
        }

        // Mini celebration if all done
        if (newLogs.size === habits.length && habits.length > 0) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#ffffff'] })
          showToast('All habits complete! Great job!')
        }
      }
    } catch (err) {
      console.error('Toggle habit error:', err)
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
        console.error('Error adding habit:', error)
        showToast('Failed to add habit')
        return
      }

      if (data) {
        setHabits([...habits, data])
        setCustomHabit('')
        setIsAdding(false)
      }
    } catch (err) {
      console.error('Add habit error:', err)
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
        console.error('Error deleting habit:', error)
        setHabits(previousHabits)
        showToast('Failed to delete habit')
      } else {
        showToast('Habit removed')
      }
    } catch (err) {
      console.error('Delete habit error:', err)
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
        console.error('Error listing progress photos:', listError)
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
    } catch (err) {
      console.error('Error fetching progress photos:', err)
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
        console.error('Upload error:', uploadError)
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
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 }, colors: ['#FF3B00', '#22c55e'] })
    } catch (err) {
      console.error('Upload error:', err)
      setPhotoError('Something went wrong during upload')
      showToast('Photo upload failed')
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  // Calc progress
  const completedCount = logs.size
  const totalCount = habits.length
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)
  const challengeProgress = Math.min((challengeDay / challengeGoal) * 100, 100)

  if (loading) {
    return (
      <div className="min-h-screen bg-arc-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-arc-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
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
                <span className="text-lg font-black font-mono text-arc-orange">{totalPoints.toLocaleString()}</span>
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
                        className="h-full bg-gradient-to-r from-arc-accent to-orange-400"
                    />
                 </div>
            </section>

            {/* Daily Grind Circle */}
            <section className="bg-glass-gradient border border-white/5 p-6 rounded-[2rem] flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-3xl rounded-full pointer-events-none" />
                
                <div>
                    <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1">Daily Grind</h2>
                    <div className="text-4xl font-black italic tracking-tighter">
                        <span className={completedCount === totalCount && totalCount > 0 ? "text-green-500" : "text-white"}>
                            {completedCount}
                        </span>
                        <span className="text-white/20">/{totalCount}</span>
                    </div>
                    <div className="text-[10px] text-arc-muted font-bold mt-1 uppercase">Tasks Complete</div>
                </div>

                {/* Ring Chart */}
                <div className="relative w-20 h-20">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        <circle className="text-white/5 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                        <motion.circle 
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: progressPercent / 100 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={`${completedCount === totalCount ? 'text-green-500' : 'text-arc-accent'} stroke-current drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
                            strokeWidth="8" 
                            strokeLinecap="round" 
                            cx="50" cy="50" r="40" 
                            fill="transparent"
                        ></motion.circle>
                    </svg>
                </div>
            </section>

            {/* Habit List */}
            <section className="space-y-3 pb-12">
                {habits.map(habit => {
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
                
                {habits.length === 0 && !loading && (
                    <div className="text-center py-10 opacity-50 text-sm">No habits set. Add one!</div>
                )}
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
