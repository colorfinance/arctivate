import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import confetti from 'canvas-confetti'

export default function Food() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [isLogging, setIsLogging] = useState(false)
  const [dailyCalories, setDailyCalories] = useState(0)
  const [dailyGoal, setDailyGoal] = useState(2800)
  const [dailyMacros, setDailyMacros] = useState({ protein: 0, carbs: 0, fat: 0 })
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualFood, setManualFood] = useState({ name: '', cals: '', p: '', c: '', f: '' })
  const [todayLogs, setTodayLogs] = useState([])
  const [toast, setToast] = useState(null)
  const fileInputRef = useRef(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Fetch daily calories on mount
  useEffect(() => {
    fetchDailyCalories()
  }, [])

  async function fetchDailyCalories() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch user's calorie goal
      const { data: profile } = await supabase
        .from('profiles')
        .select('daily_calorie_goal')
        .eq('id', user.id)
        .single()

      if (profile?.daily_calorie_goal) {
        setDailyGoal(profile.daily_calorie_goal)
      }

      // Fetch today's food logs directly
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const { data: logs, error: logsError } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('eaten_at', today.toISOString())
        .order('eaten_at', { ascending: false })

      if (logs && !logsError) {
        setTodayLogs(logs)
        const totalCals = logs.reduce((sum, log) => sum + (log.calories || 0), 0)
        const totalProtein = logs.reduce((sum, log) => sum + (log.macros?.p || 0), 0)
        const totalCarbs = logs.reduce((sum, log) => sum + (log.macros?.c || 0), 0)
        const totalFat = logs.reduce((sum, log) => sum + (log.macros?.f || 0), 0)

        setDailyCalories(totalCals)
        setDailyMacros({ protein: totalProtein, carbs: totalCarbs, fat: totalFat })
      }
    } catch (err) {
      console.error('Error fetching daily calories:', err)
    }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setScanning(true)
    setResult(null)
    setError(null)

    // Convert to Base64
    const reader = new FileReader()

    reader.onerror = () => {
      setError('Failed to read image file')
      setScanning(false)
    }

    reader.onloadend = async () => {
      const base64Image = reader.result
      // Resize before sending to avoid 4.5MB Vercel limit
      resizeImage(base64Image, 800, async (resizedImage) => {
        await analyzeImage(resizedImage)
      })
    }

    reader.readAsDataURL(file)
  }

  // Helper to resize image with error handling
  const resizeImage = (base64Str, maxWidth = 800, callback) => {
    const img = new Image()

    // Set a timeout for image loading
    const timeout = setTimeout(() => {
      setError('Image took too long to load')
      setScanning(false)
    }, 10000)

    img.onerror = () => {
      clearTimeout(timeout)
      setError('Failed to load image. Please try a different image.')
      setScanning(false)
    }

    img.onload = () => {
      clearTimeout(timeout)

      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          setError('Canvas not supported')
          setScanning(false)
          return
        }

        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width
            width = maxWidth
          }
        } else {
          if (height > maxWidth) {
            width *= maxWidth / height
            height = maxWidth
          }
        }

        canvas.width = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        // Compress to JPEG 0.7 quality
        callback(canvas.toDataURL('image/jpeg', 0.7))
      } catch (err) {
        console.error('Image resize error:', err)
        setError('Failed to process image')
        setScanning(false)
      }
    }

    img.src = base64Str
  }

  const analyzeImage = async (base64Image) => {
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Analysis failed')
      }

      const data = await res.json()

      if (!data || !data.name) {
        throw new Error('Could not identify food in image')
      }

      setResult(data)
    } catch (err) {
      console.error('Analyze error:', err)
      setError(err.message || 'Failed to identify food. Please try again.')
    } finally {
      setScanning(false)
    }
  }

  const addToLog = async () => {
    if (!result || isLogging) return

    setIsLogging(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('Please log in to save food')
        return
      }

      const { data: newLog, error: insertError } = await supabase.from('food_logs').insert({
        user_id: user.id,
        item_name: result.name,
        calories: result.cals,
        macros: { p: result.p, c: result.c, f: result.f }
      }).select().single()

      if (insertError) {
        throw insertError
      }

      // Update local state with new totals
      setDailyCalories(prev => prev + result.cals)
      setDailyMacros(prev => ({
        protein: prev.protein + result.p,
        carbs: prev.carbs + result.c,
        fat: prev.fat + result.f
      }))

      if (newLog) {
        setTodayLogs(prev => [newLog, ...prev])
      }

      // Celebration
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#ffffff'] })
      showToast('Food logged successfully!')

      setResult(null)
    } catch (err) {
      console.error('Error logging food:', err)
      setError('Failed to save food. Please try again.')
    } finally {
      setIsLogging(false)
    }
  }

  const addManualEntry = async () => {
    if (!manualFood.name.trim() || !manualFood.cals) {
      showToast('Please enter food name and calories')
      return
    }

    setIsLogging(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        showToast('Please log in to save food')
        return
      }

      const cals = parseInt(manualFood.cals, 10) || 0
      const p = parseInt(manualFood.p, 10) || 0
      const c = parseInt(manualFood.c, 10) || 0
      const f = parseInt(manualFood.f, 10) || 0

      const { data: newLog, error: insertError } = await supabase.from('food_logs').insert({
        user_id: user.id,
        item_name: manualFood.name.trim(),
        calories: cals,
        macros: { p, c, f }
      }).select().single()

      if (insertError) {
        throw insertError
      }

      // Update local state
      setDailyCalories(prev => prev + cals)
      setDailyMacros(prev => ({
        protein: prev.protein + p,
        carbs: prev.carbs + c,
        fat: prev.fat + f
      }))

      if (newLog) {
        setTodayLogs(prev => [newLog, ...prev])
      }

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#ffffff'] })
      showToast('Food logged successfully!')

      setManualFood({ name: '', cals: '', p: '', c: '', f: '' })
      setShowManualEntry(false)
    } catch (err) {
      console.error('Error logging food:', err)
      showToast('Failed to save food. Please try again.')
    } finally {
      setIsLogging(false)
    }
  }

  const deleteLog = async (logId, calories, macros) => {
    try {
      const { error } = await supabase.from('food_logs').delete().eq('id', logId)

      if (error) throw error

      setTodayLogs(prev => prev.filter(l => l.id !== logId))
      setDailyCalories(prev => prev - (calories || 0))
      setDailyMacros(prev => ({
        protein: prev.protein - (macros?.p || 0),
        carbs: prev.carbs - (macros?.c || 0),
        fat: prev.fat - (macros?.f || 0)
      }))

      showToast('Food removed')
    } catch (err) {
      console.error('Error deleting log:', err)
      showToast('Failed to remove food')
    }
  }

  const dismissResult = () => {
    setResult(null)
    setError(null)
  }

  const calorieProgress = Math.min((dailyCalories / dailyGoal) * 100, 100)

  return (
    <div className="min-h-screen flex flex-col pb-20 relative overflow-hidden bg-arc-bg text-white">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-50 bg-arc-surface border border-white/10 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md"
          >
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-medium">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="p-6 flex justify-between items-center absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-arc-bg via-arc-bg/80 to-transparent">
        <h1 className="text-xl font-black tracking-tighter italic drop-shadow-md">NUTRITION</h1>
        <button
          onClick={() => setShowManualEntry(true)}
          className="text-[10px] font-bold text-arc-accent uppercase tracking-widest border border-arc-accent/30 px-3 py-1.5 rounded-full hover:bg-arc-accent hover:text-white transition-colors"
        >
          + Manual
        </button>
      </header>

      {/* Viewport */}
      <main className="flex-1 relative bg-gray-900 flex flex-col items-center justify-center">
        {/* BG Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-arc-bg via-gray-900 to-arc-bg"></div>

        {/* Scanner Frame */}
        <div className="relative z-10 w-64 h-64 border-2 border-white/20 rounded-3xl flex items-center justify-center overflow-hidden">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-arc-accent rounded-tl-xl"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-arc-accent rounded-tr-xl"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-arc-accent rounded-bl-xl"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-arc-accent rounded-br-xl"></div>

          {scanning && (
            <motion.div
              animate={{ top: ['10%', '90%', '10%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-0 right-0 h-0.5 bg-arc-accent shadow-[0_0_10px_#ff4d00]"
            />
          )}

          {!scanning && !result && !error && (
            <p className="text-xs text-white/70 font-bold mt-32 tracking-widest uppercase">Tap to Snap</p>
          )}

          {error && !scanning && (
            <div className="text-center p-4">
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}
        </div>

        {/* Calorie Progress Ring */}
        <div className="mt-8 relative z-10">
          <svg className="w-24 h-24 -rotate-90">
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-white/10"
            />
            <circle
              cx="48"
              cy="48"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${2 * Math.PI * 40}`}
              strokeDashoffset={`${2 * Math.PI * 40 * (1 - calorieProgress / 100)}`}
              className="text-arc-accent transition-all duration-500"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold">{Math.round(calorieProgress)}%</span>
          </div>
        </div>

        {/* Macro Summary */}
        <div className="mt-4 flex gap-4 text-xs text-arc-muted relative z-10">
          <span>P: <span className="text-white font-bold">{dailyMacros.protein}g</span></span>
          <span>C: <span className="text-white font-bold">{dailyMacros.carbs}g</span></span>
          <span>F: <span className="text-white font-bold">{dailyMacros.fat}g</span></span>
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Controls */}
        <div className="absolute bottom-24 w-full px-8 flex justify-between items-center z-20">
          <div className="w-12"></div>

          <button
            onClick={() => {
              setError(null)
              fileInputRef.current?.click()
            }}
            disabled={scanning}
            className={`bg-arc-accent w-20 h-20 rounded-full border-4 border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(255,77,0,0.5)] active:scale-95 transition ${scanning ? 'animate-pulse opacity-50' : ''}`}
          >
            {scanning ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            )}
          </button>

          <div className="w-12"></div>
        </div>
      </main>

      {/* Result Modal */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 bg-arc-card rounded-t-3xl z-30 border-t border-white/10"
          >
            <div className="p-6 pb-24">
              <div
                className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6 cursor-pointer"
                onClick={dismissResult}
              ></div>

              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl font-bold">{result.name}</h2>
                  <p className="text-arc-muted text-sm">{result.desc}</p>
                </div>
                <div className="bg-blue-500/10 text-blue-500 text-xs font-bold px-2 py-1 rounded">
                  AI Analyzed
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-6 text-center">
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <div className="text-xs text-arc-muted mb-1">Cals</div>
                  <div className="font-black text-xl">{result.cals}</div>
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <div className="text-xs text-arc-muted mb-1">Prot</div>
                  <div className="font-bold text-lg">{result.p}g</div>
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <div className="text-xs text-arc-muted mb-1">Carb</div>
                  <div className="font-bold text-lg">{result.c}g</div>
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <div className="text-xs text-arc-muted mb-1">Fat</div>
                  <div className="font-bold text-lg">{result.f}g</div>
                </div>
              </div>

              <button
                onClick={addToLog}
                disabled={isLogging}
                className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-900/20 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
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
                  'ADD TO LOG'
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Today's Food Log */}
      {todayLogs.length > 0 && (
        <div className="absolute bottom-24 left-0 right-0 px-4 max-h-40 overflow-y-auto z-10">
          <div className="bg-arc-card/90 backdrop-blur-lg rounded-2xl border border-white/5 p-4">
            <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-3">Today's Log</h3>
            <div className="space-y-2">
              {todayLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center justify-between bg-arc-surface/50 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-white truncate block">{log.item_name}</span>
                    <span className="text-[10px] text-arc-muted">
                      P:{log.macros?.p || 0}g C:{log.macros?.c || 0}g F:{log.macros?.f || 0}g
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-arc-orange">{log.calories}</span>
                    <button
                      onClick={() => deleteLog(log.id, log.calories, log.macros)}
                      className="text-white/20 hover:text-red-500 transition-colors p-1"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      <AnimatePresence>
        {showManualEntry && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManualEntry(false)}
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
              <h2 className="text-xl font-black italic tracking-tighter text-center mb-6">ADD FOOD</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Food Name</label>
                  <input
                    type="text"
                    value={manualFood.name}
                    onChange={(e) => setManualFood({ ...manualFood, name: e.target.value })}
                    placeholder="e.g. Chicken Breast"
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Cals</label>
                    <input
                      type="number"
                      value={manualFood.cals}
                      onChange={(e) => setManualFood({ ...manualFood, cals: e.target.value })}
                      placeholder="0"
                      className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Protein</label>
                    <input
                      type="number"
                      value={manualFood.p}
                      onChange={(e) => setManualFood({ ...manualFood, p: e.target.value })}
                      placeholder="0"
                      className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Carbs</label>
                    <input
                      type="number"
                      value={manualFood.c}
                      onChange={(e) => setManualFood({ ...manualFood, c: e.target.value })}
                      placeholder="0"
                      className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Fat</label>
                    <input
                      type="number"
                      value={manualFood.f}
                      onChange={(e) => setManualFood({ ...manualFood, f: e.target.value })}
                      placeholder="0"
                      className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="flex-1 bg-arc-surface text-white font-bold py-4 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={addManualEntry}
                  disabled={isLogging || !manualFood.name.trim() || !manualFood.cals}
                  className="flex-1 bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLogging ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    'Add Food'
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
