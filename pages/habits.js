import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import confetti from 'canvas-confetti'

// Helper for dates
const getTodayStr = () => new Date().toISOString().split('T')[0]

export default function Habits() {
  const [habits, setHabits] = useState([])
  const [logs, setLogs] = useState(new Set()) // Set of habit_ids completed today
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAdding, setIsAdding] = useState(false)
  const [customHabit, setCustomHabit] = useState('')

  // Challenge State
  const [challengeDay, setChallengeDay] = useState(1)
  const [challengeGoal, setChallengeGoal] = useState(75)
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [newGoal, setNewGoal] = useState(75)
  const [currentStreak, setCurrentStreak] = useState(0)

  // Points State
  const [totalPoints, setTotalPoints] = useState(0)

  // Load Data
  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Please log in to view your habits')
        setLoading(false)
        return
      }

      // Batch fetch all data in parallel for performance
      const today = getTodayStr()
      const [profileResult, habitsResult, logsResult] = await Promise.all([
        supabase.from('profiles').select('challenge_start_date, challenge_days_goal, total_points, current_streak').eq('id', user.id).single(),
        supabase.from('habits').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('habit_logs').select('habit_id').eq('user_id', user.id).eq('date', today)
      ])

      // Handle profile data
      if (profileResult.data) {
        const profile = profileResult.data
        const start = new Date(profile.challenge_start_date || new Date())
        const now = new Date()
        const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1
        setChallengeDay(Math.max(1, diff))
        setChallengeGoal(profile.challenge_days_goal || 75)
        setTotalPoints(profile.total_points || 0)
        setCurrentStreak(profile.current_streak || 0)
      }

      // Handle habits data
      if (habitsResult.error) throw habitsResult.error
      setHabits(habitsResult.data || [])

      // Handle logs data
      if (logsResult.error) throw logsResult.error
      setLogs(new Set(logsResult.data?.map(l => l.habit_id) || []))

      // Calculate streak in background (don't block UI)
      supabase.rpc('calculate_streak', { p_user_id: user.id }).then(({ data }) => {
        if (data !== null) setCurrentStreak(data)
      }).catch(() => {})

    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load habits. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const [isUpdating, setIsUpdating] = useState(false)
  const [toast, setToast] = useState(null)

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

        // Check if already logged today (to prevent duplicates)
        const { data: existingLog } = await supabase
          .from('habit_logs')
          .select('id')
          .eq('user_id', user.id)
          .eq('habit_id', habitId)
          .eq('date', today)
          .maybeSingle()

        if (existingLog) {
          // Already logged, just update UI
          showToast('Habit already completed!')
          return
        }

        // Insert new log
        const { error } = await supabase
          .from('habit_logs')
          .insert({
            user_id: user.id,
            habit_id: habitId,
            date: today,
            completed_at: new Date().toISOString()
          })

        if (error) {
          console.error('Error adding habit log:', error)
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
          // Use direct update as fallback if RPC doesn't exist
          try {
            await supabase.rpc('increment_points', { row_id: user.id, x: pointsToAward })
          } catch {
            // Fallback: direct update
            await supabase
              .from('profiles')
              .update({ total_points: totalPoints + pointsToAward })
              .eq('id', user.id)
          }
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
    if (!confirm("Delete this habit?")) return

    // Optimistic update
    const previousHabits = habits
    setHabits(habits.filter(h => h.id !== id))

    try {
      const { error } = await supabase.from('habits').delete().eq('id', id)

      if (error) {
        console.error('Error deleting habit:', error)
        setHabits(previousHabits) // Revert
        showToast('Failed to delete habit')
      }
    } catch (err) {
      console.error('Delete habit error:', err)
      setHabits(previousHabits) // Revert
      showToast('Something went wrong')
    }
  }

  // Calc progress
  const completedCount = logs.size
  const totalCount = habits.length
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)
  const challengeProgress = Math.min((challengeDay / challengeGoal) * 100, 100)

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

            {/* Points & Streak Display */}
            <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Earned</span>
                    <span className="text-lg font-black font-mono text-arc-orange">{totalPoints.toLocaleString()}</span>
                    <span className="text-xs text-arc-muted">PTS</span>
                </div>
                {currentStreak > 0 && (
                    <div className="flex items-center gap-1.5 bg-arc-orange/20 px-3 py-1 rounded-full">
                        <span className="text-arc-orange">🔥</span>
                        <span className="text-sm font-bold text-arc-orange">{currentStreak} day streak</span>
                    </div>
                )}
            </div>
        </header>

        <main className="pt-36 px-6 space-y-8 max-w-lg mx-auto">

            {/* Loading State */}
            {loading && (
                <div className="space-y-6">
                    {/* Skeleton for challenge progress */}
                    <div className="animate-pulse">
                        <div className="h-4 bg-white/10 rounded w-32 mb-2" />
                        <div className="h-8 bg-white/10 rounded w-48 mb-4" />
                        <div className="h-2 bg-white/10 rounded-full" />
                    </div>
                    {/* Skeleton for daily grind */}
                    <div className="bg-arc-surface rounded-[2rem] p-6 animate-pulse">
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="h-3 bg-white/10 rounded w-20 mb-2" />
                                <div className="h-10 bg-white/10 rounded w-24" />
                            </div>
                            <div className="w-20 h-20 bg-white/10 rounded-full" />
                        </div>
                    </div>
                    {/* Skeleton for habits */}
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-arc-surface rounded-xl p-4 animate-pulse">
                            <div className="flex items-center gap-4">
                                <div className="w-6 h-6 bg-white/10 rounded" />
                                <div className="flex-1">
                                    <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                                    <div className="h-3 bg-white/10 rounded w-16" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="text-center py-20">
                    <div className="text-5xl mb-4">😕</div>
                    <h3 className="text-lg font-bold text-white mb-2">Something went wrong</h3>
                    <p className="text-arc-muted text-sm mb-6">{error}</p>
                    <button
                        onClick={fetchData}
                        className="bg-arc-accent text-white font-bold px-6 py-3 rounded-xl"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {!loading && !error && (
            <>
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
                                    <div className="text-[10px] text-arc-muted font-bold uppercase tracking-wider">10 PTS</div>
                                </div>
                            </div>
                            
                            <button 
                                onClick={(e) => { e.stopPropagation(); deleteHabit(habit.id); }}
                                className="z-10 text-white/20 hover:text-red-500 transition-colors p-2"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                        </motion.div>
                    )
                })}
                
                {habits.length === 0 && (
                    <div className="text-center py-10 opacity-50 text-sm">No habits set. Add one!</div>
                )}
            </section>
            </>
            )}
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

        <Nav />
    </div>
  )
}
