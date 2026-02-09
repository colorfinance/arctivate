import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'

// Icons
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
)

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const LogOutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const StarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

const FireIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 23c-3.866 0-7-3.134-7-7 0-2.084.784-3.987 2.07-5.427l3.93-4.39 3.93 4.39C16.216 12.013 17 13.916 17 16c0 3.866-3.134 7-7 7z" />
  </svg>
)

// Helper for dates
const getTodayStr = () => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
}

export default function Profile() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [userId, setUserId] = useState(null)

  // Stats
  const [challengeDay, setChallengeDay] = useState(1)
  const [habitsCompletedToday, setHabitsCompletedToday] = useState(0)
  const [totalHabitsToday, setTotalHabitsToday] = useState(0)
  const [dailyCalories, setDailyCalories] = useState(0)

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editCalorieGoal, setEditCalorieGoal] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Sign out
  const [isSigningOut, setIsSigningOut] = useState(false)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, total_points, challenge_start_date, challenge_days_goal, completed_onboarding, daily_calorie_goal')
        .eq('id', user.id)
        .single()

      if (profileData && profileData.completed_onboarding === false) {
        router.push('/onboarding')
        return
      }

      setUserId(user.id)
      setProfile(profileData)

      // Calculate challenge day
      if (profileData?.challenge_start_date) {
        const start = new Date(profileData.challenge_start_date)
        const now = new Date()
        const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
        const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
        const diff = Math.floor((nowDay - startDay) / (1000 * 60 * 60 * 24)) + 1
        setChallengeDay(Math.max(1, diff))
      }

      // Fetch today's habits
      await fetchTodayHabits(user.id)

      // Fetch today's calories
      await fetchTodayCalories(user.id)
    } catch (err) {
      console.error('Error loading profile:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchTodayHabits(uid) {
    try {
      const now = new Date()
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      const { data: habits } = await supabase
        .from('habits')
        .select('id')
        .eq('user_id', uid)

      const { data: logs } = await supabase
        .from('habit_logs')
        .select('habit_id')
        .eq('user_id', uid)
        .eq('date', todayStr)

      setTotalHabitsToday(habits?.length || 0)
      setHabitsCompletedToday(logs?.length || 0)
    } catch (err) {
      console.error('Error fetching habits:', err)
    }
  }

  async function fetchTodayCalories(uid) {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: logs } = await supabase
        .from('food_logs')
        .select('calories')
        .eq('user_id', uid)
        .gte('eaten_at', today.toISOString())

      if (logs) {
        const totalCals = logs.reduce((sum, log) => sum + (log.calories || 0), 0)
        setDailyCalories(totalCals)
      }
    } catch (err) {
      console.error('Error fetching calories:', err)
    }
  }

  async function handleSaveProfile() {
    if (!editUsername.trim()) {
      showToast('Username cannot be empty')
      return
    }

    setIsSaving(true)
    try {
      const updates = {
        username: editUsername.trim()
      }

      const parsedGoal = parseInt(editCalorieGoal, 10)
      if (!isNaN(parsedGoal) && parsedGoal > 0) {
        updates.daily_calorie_goal = parsedGoal
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)

      if (error) {
        console.error('Error updating profile:', error)
        showToast('Failed to update profile')
        return
      }

      setProfile(prev => ({ ...prev, ...updates }))
      setShowEditModal(false)
      showToast('Profile updated!')
    } catch (err) {
      console.error('Save profile error:', err)
      showToast('Something went wrong')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/')
    } catch (err) {
      console.error('Sign out error:', err)
      showToast('Failed to sign out')
      setIsSigningOut(false)
    }
  }

  function openEditModal() {
    setEditUsername(profile?.username || '')
    setEditCalorieGoal(String(profile?.daily_calorie_goal || 2800))
    setShowEditModal(true)
  }

  const calorieGoal = profile?.daily_calorie_goal || 2800
  const calorieProgress = Math.min((dailyCalories / calorieGoal) * 100, 100)
  const challengeGoal = profile?.challenge_days_goal || 75
  const challengeProgress = Math.min((challengeDay / challengeGoal) * 100, 100)

  if (loading) {
    return (
      <div className="min-h-screen bg-arc-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-arc-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
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
      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/feed')}
              className="p-2 -ml-2 text-arc-muted hover:text-white transition-colors"
            >
              <ArrowLeftIcon />
            </button>
            <h1 className="text-xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              PROFILE
            </h1>
          </div>
          <button
            onClick={openEditModal}
            className="flex items-center gap-1.5 text-[10px] font-bold text-arc-accent uppercase tracking-widest border border-arc-accent/30 px-3 py-1.5 rounded-full hover:bg-arc-accent hover:text-white transition-colors"
          >
            <EditIcon />
            Edit
          </button>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-lg mx-auto">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-arc-card border border-white/5 rounded-2xl p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-arc-accent/5 blur-3xl rounded-full pointer-events-none" />

          <div className="flex items-center gap-5 relative z-10">
            {/* Avatar */}
            <div className="shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username || 'User'}
                  className="w-20 h-20 rounded-full object-cover border-2 border-arc-accent/30"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-arc-surface border-2 border-arc-accent/30 flex items-center justify-center">
                  <span className="text-3xl font-black text-arc-orange">
                    {profile?.username?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-black italic tracking-tight text-white truncate">
                {profile?.username || 'Anonymous'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Total Points</span>
                <span className="text-lg font-black font-mono text-arc-orange">
                  {(profile?.total_points || 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {/* Points Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-arc-card border border-white/5 rounded-2xl p-4 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-arc-orange/10 blur-2xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-2 mb-2 text-arc-orange">
              <StarIcon />
              <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Points</span>
            </div>
            <div className="text-3xl font-black font-mono text-white">
              {(profile?.total_points || 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-arc-muted font-bold mt-1">LIFETIME EARNED</div>
          </motion.div>

          {/* Challenge Day Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-arc-card border border-white/5 rounded-2xl p-4 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-arc-accent/10 blur-2xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-2 mb-2 text-arc-accent">
              <CalendarIcon />
              <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Challenge</span>
            </div>
            <div className="text-3xl font-black font-mono text-white">
              {challengeDay}
              <span className="text-lg text-white/20">/{challengeGoal}</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${challengeProgress}%` }}
                className="h-full bg-gradient-to-r from-arc-accent to-orange-400 rounded-full"
              />
            </div>
          </motion.div>

          {/* Habits Today Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-arc-card border border-white/5 rounded-2xl p-4 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 blur-2xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-2 mb-2 text-green-400">
              <CheckCircleIcon />
              <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Habits</span>
            </div>
            <div className="text-3xl font-black font-mono text-white">
              <span className={habitsCompletedToday === totalHabitsToday && totalHabitsToday > 0 ? 'text-green-400' : ''}>
                {habitsCompletedToday}
              </span>
              <span className="text-lg text-white/20">/{totalHabitsToday}</span>
            </div>
            <div className="text-[10px] text-arc-muted font-bold mt-1">COMPLETED TODAY</div>
          </motion.div>

          {/* Calorie Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-arc-card border border-white/5 rounded-2xl p-4 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/10 blur-2xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-2 mb-2 text-yellow-400">
              <FireIcon />
              <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Calories</span>
            </div>
            <div className="text-3xl font-black font-mono text-white">
              {dailyCalories}
            </div>
            <div className="text-[10px] text-arc-muted font-bold mt-1">/ {calorieGoal} GOAL</div>
          </motion.div>
        </div>

        {/* Calorie Progress Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-arc-card border border-white/5 rounded-2xl p-5 mt-4"
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Today&apos;s Calorie Progress</span>
            <span className="text-xs font-mono font-bold text-arc-accent">{Math.round(calorieProgress)}%</span>
          </div>
          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${calorieProgress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full rounded-full transition-colors ${calorieProgress >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-arc-accent to-orange-400'}`}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-arc-muted">{dailyCalories} cal consumed</span>
            <span className="text-xs text-arc-muted">{Math.max(0, calorieGoal - dailyCalories)} cal remaining</span>
          </div>
        </motion.div>

        {/* Sign Out */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 mb-4"
        >
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full bg-arc-surface border border-white/5 text-arc-muted font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:text-white hover:border-white/10 transition-colors disabled:opacity-50"
          >
            {isSigningOut ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <>
                <LogOutIcon />
                <span>Sign Out</span>
              </>
            )}
          </button>
        </motion.div>
      </main>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-6 z-50 pb-safe"
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-black italic tracking-tighter text-center mb-6">EDIT PROFILE</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">
                    Username
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="Your username"
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">
                    Daily Calorie Goal
                  </label>
                  <input
                    type="number"
                    value={editCalorieGoal}
                    onChange={(e) => setEditCalorieGoal(e.target.value)}
                    placeholder="2800"
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold text-center text-2xl"
                  />
                  <p className="text-[10px] text-arc-muted mt-2 text-center">
                    Recommended: 1800-3500 calories per day
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-arc-surface text-white font-bold py-4 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving || !editUsername.trim()}
                  className="flex-1 bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Nav />
    </div>
  )
}
