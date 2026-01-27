import { useState, useEffect } from 'react'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'

export default function Habits() {
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)
  const [customHabit, setCustomHabit] = useState('')
  const [streak, setStreak] = useState(0)

  // Fetch initial habits from DB
  useEffect(() => {
    fetchHabits()
    fetchStreak()
  }, [])

  async function fetchStreak() {
    const { data: { user } } = await supabase.auth.getUser()
    if(!user) return
    const { data } = await supabase.from('profiles').select('current_streak').eq('id', user.id).single()
    if(data) setStreak(data.current_streak)
  }

  async function fetchHabits() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      // For Phase 1 MVP, we will just use a hardcoded list for "System Habits" and only fetch custom ones.
      // Or better: Let's fetch everything from the 'habits' table.
      
      const { data, error } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: true })

      if (data && data.length > 0) {
        // Merge with daily logs to check "checked" state
        // This is complex for a 1-shot. Let's start with local state for the checklist today.
        // Ideally: Join habit_logs where date = today.
        
        // Simplified for MVP: Just load habits, unchecked by default on reload (unless we check logs)
        setHabits(data.map(h => ({ ...h, checked: false })))
      } else {
        // Seed default habits if empty
        const defaults = [
          { title: 'No Sugar', points_reward: 10 },
          { title: 'Gallon of Water', points_reward: 10 },
          { title: 'Read 10 Pages', points_reward: 10 },
          { title: 'Cold Plunge / Shower', points_reward: 10 },
          { title: 'Visualise Goals', points_reward: 10 }
        ]
        
        // Insert defaults
        for (const d of defaults) {
           await supabase.from('habits').insert({ ...d, user_id: user.id })
        }
        // Refetch
        const { data: refreshed } = await supabase.from('habits').select('*')
        setHabits(refreshed.map(h => ({ ...h, checked: false })))
      }
    }
    setLoading(false)
  }

  const toggleHabit = (id) => {
    setHabits(habits.map(h => h.id === id ? { ...h, checked: !h.checked } : h))
    // Trigger "save" to habit_logs here in real app
  }

  const addCustom = async () => {
    if(!customHabit) return
    const { data: { user } } = await supabase.auth.getUser()
    if(user) {
        const { data } = await supabase.from('habits').insert({
            user_id: user.id,
            title: customHabit,
            points_reward: 10
        }).select().single()
        
        if(data) setHabits([...habits, { ...data, checked: false }])
        setCustomHabit('')
    }
  }

  const deleteHabit = async (id) => {
    await supabase.from('habits').delete().eq('id', id)
    setHabits(habits.filter(h => h.id !== id))
  }

  // Calc progress
  const completedCount = habits.filter(h => h.checked).length
  const totalCount = habits.length
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)
  
  // Radial Progress Props
  const radius = 40
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference

  return (
    <div className="min-h-screen flex flex-col pb-20">
        <header className="p-6 flex justify-between items-center border-b border-white/5 bg-arc-bg/90 backdrop-blur sticky top-0 z-10">
            <h1 className="text-xl font-black tracking-tighter italic">HABITS</h1>
            <div className="flex items-center gap-1">
                <span className="text-orange-500 text-sm">🔥</span>
                <span className="font-mono font-bold text-sm">{streak} Day Streak</span>
            </div>
        </header>

        <main className="flex-1 p-6 space-y-8">

            {/* Daily Progress */}
            <section className="glass-panel p-6 rounded-2xl flex items-center justify-between">
                <div>
                    <h2 className="text-xs font-bold text-arc-muted uppercase tracking-widest mb-1">Daily Grind</h2>
                    <div className={`text-3xl font-black italic ${completedCount === totalCount && totalCount > 0 ? 'text-arc-success' : ''}`}>
                        {completedCount}/{totalCount}
                    </div>
                    <div className="text-xs text-arc-muted mt-1">Tasks Completed</div>
                </div>
                
                {/* Radial Chart */}
                <div className="relative w-20 h-20">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                        <circle className="text-gray-800 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                        <circle 
                            className={`progress-ring__circle stroke-current transition-all duration-300 ${completedCount === totalCount && totalCount > 0 ? 'text-arc-success' : 'text-arc-accent'}`}
                            strokeWidth="8" 
                            strokeLinecap="round" 
                            cx="50" cy="50" r="40" 
                            fill="transparent" 
                            strokeDasharray={`${circumference} ${circumference}`} 
                            style={{ strokeDashoffset }}
                            transform="rotate(-90 50 50)"
                        ></circle>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-bold text-xs">
                        {progressPercent}%
                    </div>
                </div>
            </section>

            {/* Add Custom */}
            <section className="glass-panel p-4 rounded-xl flex items-center gap-2">
                <input 
                    type="text" 
                    placeholder="Add custom habit..." 
                    className="bg-transparent border-none outline-none text-white w-full placeholder-gray-600 font-bold text-sm"
                    value={customHabit}
                    onChange={(e) => setCustomHabit(e.target.value)}
                />
                <button onClick={addCustom} className="bg-arc-accent text-white rounded-lg p-2 hover:bg-orange-600 transition">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </section>

            {/* List */}
            <section className="space-y-4">
                <h3 className="text-xs font-bold text-arc-muted uppercase tracking-widest">Today's Protocol</h3>
                
                {loading && <div className="text-center text-arc-muted text-xs">Loading habits...</div>}

                {habits.map(habit => (
                    <label key={habit.id} className={`glass-panel p-4 rounded-xl flex items-center justify-between cursor-pointer group hover:border-white/10 transition ${habit.checked ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-4">
                            <input 
                                type="checkbox" 
                                className="appearance-none w-6 h-6 border-2 border-[#3f3f46] rounded-md checked:bg-arc-accent checked:border-arc-accent transition cursor-pointer relative"
                                checked={habit.checked}
                                onChange={() => toggleHabit(habit.id)}
                            />
                            <div>
                                <div className="font-bold text-sm">{habit.title}</div>
                                <div className="text-xs text-arc-muted">10 pts</div>
                            </div>
                        </div>
                        <button onClick={(e) => { e.preventDefault(); deleteHabit(habit.id); }} className="text-gray-600 hover:text-red-500 text-xs uppercase font-bold px-2 py-1">
                            Del
                        </button>
                    </label>
                ))}
            </section>

        </main>
        <Nav />
    </div>
  )
}
