import { SunriseIcon, SunIcon, MoonIcon, SnackIcon, CheckIcon, DownloadIcon, StarIcon } from '../components/icons'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import Masthead, { MastheadAction } from '../components/Masthead'
import LoadingState from '../components/LoadingState'
import { supabase } from '../lib/supabaseClient'
import { parseCsv, detectColumns, detectDateOrder, buildEntries, summarise, toLogRow, MAX_ROWS, MAX_BYTES } from '../lib/csvImport'
// Lazy-load confetti
const fireConfetti = async (opts) => {
  try {
    const confetti = (await import('canvas-confetti')).default
    confetti(opts)
  } catch {}
}
import { useRouter } from 'next/router'

const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack']
const mealLabels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }
const mealIcons = { breakfast: SunriseIcon, lunch: SunIcon, dinner: MoonIcon, snack: SnackIcon }
const MealIcon = ({ meal, size = 14 }) => {
  const I = mealIcons[meal]
  return I ? <I size={size} /> : null
}

const SERVING_PRESETS = [0.5, 1, 1.5, 2]
const servingLabel = (s) => (s === 0.5 ? '½' : s === 1.5 ? '1½' : `${s}`)

// Nutrition fields, calories first (members asked for cals as the first box).
const NUTRITION_FIELDS = [
  { key: 'cals', label: 'Cals' },
  { key: 'p', label: 'Protein' },
  { key: 'c', label: 'Carbs' },
  { key: 'f', label: 'Fat' },
]

// Shared field layout so ADD FOOD and EDIT FOOD are the same screen.
// Defined at module scope so typing doesn't remount it (which would drop focus).
function FoodFormFields({ form, setField, servings, onServings, toNum }) {
  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-2 block">Name</label>
        <input
          type="text" value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="e.g. Chicken Breast"
          className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
        />
      </div>

      {/* Meal */}
      <div>
        <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-2 block">Meal</label>
        <div className="grid grid-cols-4 gap-2">
          {mealOrder.map((mt) => (
            <button
              key={mt} type="button"
              onClick={() => setField('meal_type', mt)}
              className={`py-2.5 rounded-xl text-[11px] font-bold transition-all ${form.meal_type === mt ? 'bg-accent-gradient text-white' : 'bg-arc-surface text-arc-muted border border-white/5'}`}
            >
              <span className="inline-flex items-center justify-center gap-1.5"><MealIcon meal={mt} size={12} /> {mealLabels[mt]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Serving size */}
      <div>
        <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-2 block">Serving size</label>
        <div className="flex gap-2 mb-2">
          {SERVING_PRESETS.map((s) => (
            <button
              key={s} type="button"
              onClick={() => onServings(s)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${toNum(servings) === s ? 'bg-arc-accent/20 border border-arc-accent/50 text-arc-accent' : 'bg-arc-surface text-arc-muted border border-white/5'}`}
            >
              {servingLabel(s)}×
            </button>
          ))}
        </div>
        <input
          type="number" min="0" step="0.25" value={servings}
          onChange={(e) => onServings(e.target.value)}
          placeholder="Custom servings"
          className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-mono text-center"
        />
        <p className="text-[10px] text-arc-muted mt-1.5 text-center">Changing servings rescales the calories &amp; macros below.</p>
      </div>

      {/* Nutrition — calories first */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] block">Nutrition</label>
          <span className="text-[9px] text-arc-muted">All optional</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {NUTRITION_FIELDS.map((fld) => (
            <div key={fld.key}>
              <label className="text-[8px] font-bold text-arc-muted uppercase tracking-[0.15em] mb-1.5 block text-center">{fld.label}</label>
              <input
                type="number" min="0" value={form[fld.key]}
                onChange={(e) => setField(fld.key, e.target.value)}
                placeholder="0"
                className="w-full bg-arc-surface border border-white/5 text-center font-mono font-bold text-white py-2.5 rounded-xl outline-none focus:border-arc-accent/40"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Café menu favourites — one-tap add. Calories/macros are approximate
// estimates based on the listed ingredients.
const FAVOURITES = [
  { group: 'Bowls', items: [
    { name: 'Yogurt & Granola Bowl', cals: 350, p: 20, c: 45, f: 10 },
    { name: 'Açai Bowl', cals: 450, p: 8, c: 80, f: 12 },
    { name: 'The Glow Up Bowl', cals: 480, p: 30, c: 65, f: 12 },
    { name: 'Snickers Bowl', cals: 800, p: 35, c: 110, f: 28 },
  ] },
  { group: 'Smoothies', items: [
    { name: 'The Ange', cals: 400, p: 25, c: 45, f: 10 },
    { name: 'Ken-ergizer', cals: 350, p: 8, c: 68, f: 6 },
    { name: 'Refuel', cals: 420, p: 12, c: 62, f: 14 },
    { name: 'Oreo', cals: 450, p: 8, c: 80, f: 13 },
    { name: 'Energise', cals: 250, p: 4, c: 58, f: 4 },
    { name: 'Simply Açai', cals: 250, p: 5, c: 50, f: 6 },
    { name: 'Berry Sweet', cals: 150, p: 2, c: 36, f: 1 },
    { name: 'The Reload', cals: 350, p: 20, c: 58, f: 6 },
    { name: 'Dirty Chai', cals: 250, p: 5, c: 48, f: 4 },
    { name: 'Biscoff Blast', cals: 450, p: 28, c: 60, f: 14 },
    { name: 'Green Goddess', cals: 200, p: 3, c: 46, f: 2 },
    { name: 'Rocket Fuel', cals: 400, p: 22, c: 55, f: 9 },
  ] },
  { group: 'Juices', items: [
    { name: 'Adapt Juice', cals: 180, p: 2, c: 44, f: 1 },
    { name: 'Reset Juice', cals: 120, p: 2, c: 30, f: 0 },
    { name: 'Conquer Juice', cals: 200, p: 2, c: 50, f: 1 },
  ] },
  { group: 'Slushies', items: [
    { name: 'BCAA Slushie', cals: 30, p: 0, c: 5, f: 0 },
    { name: 'Collagen Slushie', cals: 60, p: 10, c: 4, f: 0 },
  ] },
]

// Units a pantry item can be defined/logged in.
const FOOD_UNITS = ['g', 'ml', 'unit', 'serving']
// How the unit reads in the "how much?" prompt (singular label).
const unitLabel = (u, qty) => {
  if (u === 'unit') return qty === 1 ? 'unit' : 'units'
  if (u === 'serving') return qty === 1 ? 'serving' : 'servings'
  return u // g / ml
}
// Normalise a café item or a saved pantry row into one shape for logging.
const normalizeFav = (fav) => {
  if (fav && (fav.macros || fav.calories != null || fav.base_unit)) {
    // Saved pantry row (from food_favourites)
    return {
      id: fav.id || null,
      name: fav.name,
      brand: fav.brand || null,
      base_qty: Number(fav.base_qty) > 0 ? Number(fav.base_qty) : 1,
      base_unit: fav.base_unit || 'serving',
      cals: fav.calories || 0,
      p: fav.macros?.p || 0, c: fav.macros?.c || 0, f: fav.macros?.f || 0,
    }
  }
  // Café menu item ({ name, cals, p, c, f }) — treated as per 1 serving.
  return {
    id: null, name: fav.name, brand: null, base_qty: 1, base_unit: 'serving',
    cals: fav.cals || 0, p: fav.p || 0, c: fav.c || 0, f: fav.f || 0,
  }
}

// Local calendar day as YYYY-MM-DD. Deliberately not toISOString(), which
// shifts to UTC and can land a late-evening meal on the wrong day.
const fmtDay = (d) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const todayKey = () => fmtDay(new Date())

// The timestamp to store for a log on `day`. Today keeps the real clock time so
// the diary stays in order; a past day is stamped at midday, far enough from
// both midnight boundaries that no timezone shift can move it to the day either
// side.
const stampFor = (day) => {
  if (day === todayKey()) return new Date().toISOString()
  return new Date(`${day}T12:00:00`).toISOString()
}

const dayLabel = (day) => {
  if (day === todayKey()) return 'Today'
  const d = new Date(`${day}T12:00:00`)
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  if (day === fmtDay(yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function Food() {
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [isLogging, setIsLogging] = useState(false)
  const [dailyCalories, setDailyCalories] = useState(0)
  const [dailyGoal, setDailyGoal] = useState(2800)
  const [dailyMacros, setDailyMacros] = useState({ protein: 0, carbs: 0, fat: 0 })
  // Per-user macro goals (null = not set → no target shown for that macro)
  const [goals, setGoals] = useState({ cals: null, carbs: null, protein: null, fat: null })
  const [showGoals, setShowGoals] = useState(false)
  const [goalsForm, setGoalsForm] = useState({ cals: '', carbs: '', protein: '', fat: '' })
  const [savingGoals, setSavingGoals] = useState(false)
  const [copying, setCopying] = useState(false)
  const [showFavourites, setShowFavourites] = useState(false)
  const [addingFav, setAddingFav] = useState(null)
  const [myFavourites, setMyFavourites] = useState([])
  const [favForm, setFavForm] = useState({ name: '', brand: '', baseQty: '100', baseUnit: 'g', cals: '', p: '', c: '', f: '' })
  const [showFavForm, setShowFavForm] = useState(false)
  // Quantity prompt when logging a pantry item: { item: normalized, qty: string }
  const [qtyPrompt, setQtyPrompt] = useState(null)
  const [showManualEntry, setShowManualEntry] = useState(false)
  // Importing a food diary exported from another app
  const [importState, setImportState] = useState(null) // { fileName, headers, rows, mapping, dateOrder, ambiguous, decimalComma }
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(null)
  const csvInputRef = useRef(null)
  const [showImportHelp, setShowImportHelp] = useState(false)
  // Which day the diary is showing and writing to. Until now the page only ever
  // read today and always wrote eaten_at = now(), so something eaten earlier in
  // the week simply could not be recorded.
  const [logDate, setLogDate] = useState(todayKey())
  const [showDayPicker, setShowDayPicker] = useState(false)
  const [manualFood, setManualFood] = useState({ name: '', cals: '', p: '', c: '', f: '', meal_type: 'snack', servings: 1 })
  const [todayLogs, setTodayLogs] = useState([])
  const [toast, setToast] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [cameraActive, setCameraActive] = useState(false)
  const [lastLoggedResult, setLastLoggedResult] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceProcessing, setVoiceProcessing] = useState(false)
  const [voiceResult, setVoiceResult] = useState(null)
  // Edit an already-logged food entry (name, meal, serving size, macros)
  const [editingLog, setEditingLog] = useState(null)
  const [editForm, setEditForm] = useState(null)   // { name, meal_type, servings, cals, p, c, f }
  const [editBase, setEditBase] = useState(null)   // per-serving base { cals, p, c, f }
  const [savingEdit, setSavingEdit] = useState(false)
  const fileInputRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Determine meal type based on current time
  const getDefaultMealType = () => {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 11) return 'breakfast'
    if (hour >= 11 && hour < 15) return 'lunch'
    if (hour >= 15 && hour < 20) return 'dinner'
    return 'snack'
  }

  // Fetch daily calories on mount
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('completed_onboarding').eq('id', user.id).single()
      if (profile && profile.completed_onboarding === false) {
        router.push('/onboarding')
        return
      }
      setPageLoading(false)
      // The day effect below owns loading the diary, so it is not fetched here
      // as well -- two fetches on mount was half of the race.
      fetchMyFavourites(user.id)
    }
    init()

    // Cleanup camera on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [])

  const isToday = logDate === todayKey()

  // You cannot eat tomorrow's dinner, so forward stops at today. Backwards is
  // deliberately unbounded: the CSV importer already writes arbitrary past
  // dates, and an artificial cut-off would just be a second bug to explain.
  const shiftDay = (delta) => {
    const d = new Date(`${logDate}T12:00:00`)
    d.setDate(d.getDate() + delta)
    const next = fmtDay(d)
    if (next > todayKey()) return
    setLogDate(next)
  }

  // Deep link, so tapping a day in the calendar can drop you straight into
  // logging for it.
  useEffect(() => {
    const q = router.query?.date
    if (typeof q === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q) && q <= todayKey()) {
      setLogDate(q)
    }
  }, [router.query?.date])

  // Changing the day reloads that day's diary and totals.
  useEffect(() => {
    fetchDailyCalories(logDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logDate])

  // Which day the newest in-flight fetch is for. Two fetches can be running at
  // once (page load, then a day change or a ?date= deep link), and without this
  // the slower one wins -- which showed an empty diary for a day that had food
  // in it.
  const fetchingDay = useRef(todayKey())

  async function fetchDailyCalories(day = logDate) {
    fetchingDay.current = day
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch user's calorie + macro goals (columns may not exist yet)
      try {
        let { data: profile, error: goalErr } = await supabase
          .from('profiles')
          .select('daily_calorie_goal, daily_carb_goal, daily_protein_goal, daily_fat_goal')
          .eq('id', user.id)
          .single()
        // Older DBs may not have the macro columns — fall back to calorie only.
        if (goalErr) {
          const fb = await supabase.from('profiles').select('daily_calorie_goal').eq('id', user.id).single()
          profile = fb.data
        }
        if (profile?.daily_calorie_goal) setDailyGoal(profile.daily_calorie_goal)
        setGoals({
          cals: profile?.daily_calorie_goal ?? null,
          carbs: profile?.daily_carb_goal ?? null,
          protein: profile?.daily_protein_goal ?? null,
          fat: profile?.daily_fat_goal ?? null,
        })
      } catch (e) {
        // goal columns may not exist yet — use defaults
      }

      // Fetch the selected day's food logs. Bounded at both ends now: an open
      // "everything since midnight" range only ever worked because the page
      // could not look at any day but today.
      const dayStart = new Date(`${day}T00:00:00`)
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1)

      const { data: logs, error: logsError } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('eaten_at', dayStart.toISOString())
        .lt('eaten_at', dayEnd.toISOString())
        .order('eaten_at', { ascending: false })

      // A newer day was requested while this was in flight — drop the result.
      if (fetchingDay.current !== day) return

      if (logs && !logsError) {
        setTodayLogs(logs)
        const totalCals = logs.reduce((sum, log) => sum + (log.calories || 0), 0)
        const totalProtein = logs.reduce((sum, log) => sum + (log.macros?.p || 0), 0)
        const totalCarbs = logs.reduce((sum, log) => sum + (log.macros?.c || 0), 0)
        const totalFat = logs.reduce((sum, log) => sum + (log.macros?.f || 0), 0)

        setDailyCalories(totalCals)
        setDailyMacros({ protein: totalProtein, carbs: totalCarbs, fat: totalFat })
      }
    } catch {}
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
      } catch {
        setError('Failed to process image')
        setScanning(false)
      }
    }

    img.src = base64Str
  }

  const analyzeImage = async (base64Image) => {
    try {
      const res = await fetch('/api/analyze/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image }),
      })

      let responseData
      try {
        responseData = await res.json()
      } catch {
        throw new Error('Server returned an invalid response')
      }

      if (!res.ok) {
        throw new Error(responseData?.error || `Analysis failed (${res.status})`)
      }

      if (!responseData || !responseData.name) {
        throw new Error('Could not identify food in image')
      }

      if (responseData.name === 'Unknown') {
        // Show result for manual editing instead of auto-logging unknown food
        setResult(responseData)
        setScanning(false)
        return
      }

      // Auto-log the scanned food immediately
      await autoLog(responseData)
    } catch (err) {
      if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.name === 'TypeError') {
        setError('Network error. Check your connection and try again.')
      } else {
        setError(err.message || 'Failed to identify food. Please try again.')
      }
    } finally {
      setScanning(false)
    }
  }

  const autoLog = async (data) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setResult(data)
        return
      }

      const mealType = data.meal_type || getDefaultMealType()

      const { data: newLog, error: insertError } = await supabase.from('food_logs').insert({
        user_id: user.id,
        item_name: data.name,
        calories: data.cals,
        macros: { p: data.p, c: data.c, f: data.f, meal_type: mealType },
        eaten_at: stampFor(logDate),
      }).select().single()

      if (insertError) {
        setResult(data)
        return
      }

      setDailyCalories(prev => prev + data.cals)
      setDailyMacros(prev => ({
        protein: prev.protein + data.p,
        carbs: prev.carbs + data.c,
        fat: prev.fat + data.f
      }))
      if (newLog) setTodayLogs(prev => [newLog, ...prev])

      fireConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#ffffff'] })
      setLastLoggedResult({ ...data })
    } catch {
      setResult(data)
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

      const mealType = result.meal_type || getDefaultMealType()

      const { data: newLog, error: insertError } = await supabase.from('food_logs').insert({
        user_id: user.id,
        item_name: result.name,
        calories: result.cals,
        macros: { p: result.p, c: result.c, f: result.f, meal_type: mealType },
        eaten_at: stampFor(logDate),
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
      fireConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#ffffff'] })
      showToast('Food logged! Share it to the feed?')

      setLastLoggedResult({ ...result })
      setResult(null)
    } catch {
      setError('Failed to save food. Please try again.')
    } finally {
      setIsLogging(false)
    }
  }

  const shareToFeed = async (food) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const content = `Just logged ${food.name} — ${food.cals} cal | P:${food.p}g C:${food.c}g F:${food.f}g`

      const insertData = {
        user_id: user.id,
        content,
        message_type: 'text',
        metadata: { type: 'meal', name: food.name, cals: food.cals, p: food.p, c: food.c, f: food.f }
      }

      const { error } = await supabase.from('community_messages').insert(insertData)

      if (error) {
        // If metadata column causes issues, retry without it
        await supabase.from('community_messages').insert({
          user_id: user.id,
          content,
          message_type: 'text'
        })
      }

      showToast('Shared to feed!')
      setLastLoggedResult(null)
    } catch {
      showToast('Failed to share. Try again.')
    }
  }

  const addManualEntry = async () => {
    if (!manualFood.name.trim()) {
      showToast('Please enter a food name')
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
      const mealType = manualFood.meal_type || getDefaultMealType()
      const servings = num(manualFood.servings) > 0 ? num(manualFood.servings) : 1
      // Keep the per-serving base so serving changes rescale cleanly on edit.
      const base = { cals: cals / servings, p: p / servings, c: c / servings, f: f / servings }

      const { data: newLog, error: insertError } = await supabase.from('food_logs').insert({
        user_id: user.id,
        item_name: manualFood.name.trim(),
        calories: cals,
        macros: { p, c, f, meal_type: mealType, servings, base },
        eaten_at: stampFor(logDate),
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

      fireConfetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#ffffff'] })
      showToast('Food logged! Share it to the feed?')

      setLastLoggedResult({ name: manualFood.name.trim(), cals, p, c, f, desc: 'Manual entry' })
      setManualFood({ name: '', cals: '', p: '', c: '', f: '', meal_type: 'snack', servings: 1 })
      setShowManualEntry(false)
    } catch {
      showToast('Failed to save food. Please try again.')
    } finally {
      setIsLogging(false)
    }
  }

  // Quick-add a café favourite to today's log.
  // Tapping a pantry / café item opens the "how much?" prompt.
  const openQtyPrompt = (fav) => {
    const item = normalizeFav(fav)
    setQtyPrompt({ item, qty: String(item.base_qty) })
  }

  // Scale the pantry item's per-base macros by the amount eaten and log it,
  // recording the quantity so the meal is replicable later.
  const logWithQuantity = async () => {
    if (!qtyPrompt || addingFav) return
    const { item } = qtyPrompt
    const qty = parseFloat(qtyPrompt.qty)
    if (isNaN(qty) || qty <= 0) { showToast('Enter how much you ate'); return }

    setAddingFav(item.name)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('Please log in'); setAddingFav(null); return }

      const factor = qty / (item.base_qty || 1)
      const cals = Math.round(item.cals * factor)
      const p = Math.round(item.p * factor)
      const c = Math.round(item.c * factor)
      const f = Math.round(item.f * factor)
      const mealType = getDefaultMealType()
      const displayName = item.brand ? `${item.name} (${item.brand})` : item.name

      const { data: newLog, error } = await supabase
        .from('food_logs')
        .insert({
          user_id: user.id,
          item_name: displayName,
          calories: cals,
          macros: { p, c, f, meal_type: mealType },
          quantity: qty,
          unit: item.base_unit,
          favourite_id: item.id || null,
          eaten_at: stampFor(logDate),
        })
        .select()
        .single()
      if (error) throw error

      if (newLog) setTodayLogs((prev) => [newLog, ...prev])
      setDailyCalories((prev) => prev + cals)
      setDailyMacros((prev) => ({
        protein: prev.protein + p,
        carbs: prev.carbs + c,
        fat: prev.fat + f,
      }))
      showToast(`Added ${qty}${item.base_unit === 'g' || item.base_unit === 'ml' ? item.base_unit : ' ' + unitLabel(item.base_unit, qty)} ${item.name} · ${cals} cal`)
      setQtyPrompt(null)
    } catch {
      showToast('Failed to add. Please try again.')
    } finally {
      setAddingFav(null)
    }
  }

  // Café items and saved pantry items both open the quantity prompt.
  const logFavourite = (fav) => openQtyPrompt(fav)

  async function fetchMyFavourites(uid) {
    try {
      const { data, error } = await supabase
        .from('food_favourites')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
      if (error) return // table not created yet — hide the section
      setMyFavourites(data || [])
    } catch {}
  }

  // Add a pantry item: macros are entered PER the reference amount + unit.
  const addCustomFavourite = async () => {
    const name = favForm.name.trim()
    if (!name) { showToast('Enter a food name'); return }
    const baseQty = parseFloat(favForm.baseQty)
    if (isNaN(baseQty) || baseQty <= 0) { showToast('Enter the reference amount'); return }
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('Please log in'); return }
      const row = {
        user_id: user.id,
        name,
        brand: favForm.brand.trim() || null,
        base_qty: baseQty,
        base_unit: favForm.baseUnit || 'g',
        calories: parseInt(favForm.cals, 10) || 0,
        macros: { p: parseInt(favForm.p, 10) || 0, c: parseInt(favForm.c, 10) || 0, f: parseInt(favForm.f, 10) || 0 },
      }
      const { data, error } = await supabase.from('food_favourites').insert(row).select().single()
      if (error) throw error
      setMyFavourites((prev) => [data, ...prev])
      setFavForm({ name: '', brand: '', baseQty: '100', baseUnit: 'g', cals: '', p: '', c: '', f: '' })
      setShowFavForm(false)
      showToast('Saved to pantry')
    } catch (e) {
      showToast('Could not save (run migration 022)')
    }
  }

  // Save an already-logged food as a favourite (star button).
  const saveLogAsFavourite = async (log) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('Please log in'); return }
      // Avoid obvious duplicates by name.
      if (myFavourites.some((f) => f.name.toLowerCase() === (log.item_name || '').toLowerCase())) {
        showToast('Already in favourites'); return
      }
      const row = {
        user_id: user.id,
        name: log.item_name || 'Food',
        // Use the amount that was logged as this item's reference amount, so
        // re-logging scales correctly (falls back to 1 serving).
        base_qty: Number(log.quantity) > 0 ? Number(log.quantity) : 1,
        base_unit: log.unit || 'serving',
        calories: log.calories || 0,
        macros: { p: log.macros?.p || 0, c: log.macros?.c || 0, f: log.macros?.f || 0 },
      }
      const { data, error } = await supabase.from('food_favourites').insert(row).select().single()
      if (error) throw error
      setMyFavourites((prev) => [data, ...prev])
      showToast('Saved to pantry ⭐')
    } catch {
      showToast('Could not save (run migration 017)')
    }
  }

  const deleteFavourite = async (id) => {
    try {
      await supabase.from('food_favourites').delete().eq('id', id)
      setMyFavourites((prev) => prev.filter((f) => f.id !== id))
    } catch {
      showToast('Could not remove favourite')
    }
  }

  // Quick-add a saved pantry item — opens the quantity prompt.
  const logMyFavourite = (fav) => openQtyPrompt(fav)

  // Open the goals editor pre-filled with current values.
  const openGoals = () => {
    setGoalsForm({
      cals: goals.cals != null ? String(goals.cals) : '',
      carbs: goals.carbs != null ? String(goals.carbs) : '',
      protein: goals.protein != null ? String(goals.protein) : '',
      fat: goals.fat != null ? String(goals.fat) : '',
    })
    setShowGoals(true)
  }

  const saveGoals = async () => {
    if (savingGoals) return
    setSavingGoals(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('Please log in'); setSavingGoals(false); return }

      const toIntOrNull = (v) => (v === '' || v == null ? null : (parseInt(v, 10) || 0))
      const next = {
        cals: toIntOrNull(goalsForm.cals),
        carbs: toIntOrNull(goalsForm.carbs),
        protein: toIntOrNull(goalsForm.protein),
        fat: toIntOrNull(goalsForm.fat),
      }

      const payload = {
        id: user.id,
        daily_calorie_goal: next.cals,
        daily_carb_goal: next.carbs,
        daily_protein_goal: next.protein,
        daily_fat_goal: next.fat,
      }

      let { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
      // Strip macro columns if the migration hasn't been applied yet.
      if (error && error.message && /daily_(carb|protein|fat)_goal/.test(error.message)) {
        const { error: e2 } = await supabase.from('profiles')
          .upsert({ id: user.id, daily_calorie_goal: next.cals }, { onConflict: 'id' })
        error = e2
        if (!e2) showToast('Saved calorie goal (run migration 015 for macro goals)')
      }
      if (error) throw error

      setGoals(next)
      if (next.cals) setDailyGoal(next.cals)
      setShowGoals(false)
      showToast('Goals updated')
    } catch (e) {
      showToast('Failed to save goals')
    } finally {
      setSavingGoals(false)
    }
  }

  // Copy every food entry from a given day (default: yesterday) onto today.
  // --- Importing a diary from another app ------------------------------------

  const handleCsvFile = async (file) => {
    if (!file) return
    setImportDone(null)
    if (file.size > MAX_BYTES) {
      showToast('That file is too big (max 5MB)')
      return
    }
    try {
      const text = await file.text()
      const { rows, delimiter } = parseCsv(text)
      if (rows.length < 2) {
        showToast("That file doesn't have any rows in it")
        return
      }
      const headers = rows[0]
      const mapping = detectColumns(headers)
      // Detection is English-header based, so a diary in another language may
      // match nothing. Still open the sheet — the column pickers are there for
      // exactly this, and bailing out would leave no way to fix it.
      const dateValues = mapping.date !== undefined ? rows.slice(1).map(r => r[mapping.date]) : []
      const detected = detectDateOrder(dateValues)
      setImportState({
        fileName: file.name,
        headers,
        rows: rows.length - 1 > MAX_ROWS ? rows.slice(0, MAX_ROWS + 1) : rows,
        truncated: rows.length - 1 > MAX_ROWS,
        mapping,
        dateOrder: detected || 'dmy',
        ambiguous: mapping.date !== undefined && detected === null,
        decimalComma: delimiter === ';',
        needsMapping: mapping.name === undefined || mapping.calories === undefined,
      })
    } catch {
      showToast("Couldn't read that file")
    }
  }

  // Recomputed whenever the member corrects a column or the date order.
  const importPreview = useMemo(() => {
    if (!importState) return null
    const { entries, skipped } = buildEntries(importState.rows, importState.mapping, {
      dateOrder: importState.dateOrder,
      decimalComma: importState.decimalComma,
    })
    return { entries, skipped, summary: summarise(entries) }
  }, [importState])

  const setImportColumn = (field, idx) => {
    setImportState(prev => {
      if (!prev) return prev
      const mapping = { ...prev.mapping }
      if (idx === '') delete mapping[field]
      else mapping[field] = Number(idx)
      return {
        ...prev,
        mapping,
        needsMapping: mapping.name === undefined || mapping.calories === undefined,
      }
    })
  }

  const runImport = async () => {
    if (!importPreview || !importPreview.entries.length || importing) return
    setImporting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('Please log in'); return }

      const rows = importPreview.entries.map(e => toLogRow(e, user.id))
      // Chunked so a big diary doesn't go over the request limit.
      let saved = 0
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from('food_logs').insert(rows.slice(i, i + 200))
        if (error) throw error
        saved += Math.min(200, rows.length - i)
      }

      const summary = importPreview.summary
      setImportState(null)
      setImportDone({ count: saved, days: summary?.days || 0 })
      await fetchDailyCalories()
    } catch {
      showToast('Import failed — nothing was changed for the remaining rows')
    } finally {
      setImporting(false)
    }
  }

  const copyDayToToday = async (fromDateKey) => {
    if (copying) return
    setCopying(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('Please log in'); setCopying(false); return }

      let sourceKey = fromDateKey
      if (!sourceKey) {
        const y = new Date(); y.setDate(y.getDate() - 1)
        const tz = y.getTimezoneOffset() * 60000
        sourceKey = new Date(y - tz).toISOString().slice(0, 10)
      }
      const start = new Date(sourceKey + 'T00:00:00')
      const end = new Date(start); end.setDate(end.getDate() + 1)

      const { data: src } = await supabase
        .from('food_logs')
        .select('item_name, calories, macros')
        .eq('user_id', user.id)
        .gte('eaten_at', start.toISOString())
        .lt('eaten_at', end.toISOString())

      if (!src || src.length === 0) { showToast('No food found for that day'); setCopying(false); return }

      const rows = src.map((r) => ({
        user_id: user.id,
        item_name: r.item_name,
        calories: r.calories,
        macros: r.macros,
        eaten_at: stampFor(logDate),
      }))
      const { error } = await supabase.from('food_logs').insert(rows)
      if (error) throw error

      await fetchDailyCalories()
      showToast(`Copied ${rows.length} item${rows.length > 1 ? 's' : ''} to ${dayLabel(logDate)}`)
    } catch (e) {
      showToast('Failed to copy day')
    } finally {
      setCopying(false)
    }
  }

  const deleteLog = async (logId, calories, macros) => {
    try {
      const { error } = await supabase.from('food_logs').delete().eq('id', logId)

      if (error) throw error

      setTodayLogs(prev => prev.filter(l => l.id !== logId))
      setDailyCalories(prev => Math.max(0, prev - (calories || 0)))
      setDailyMacros(prev => ({
        protein: Math.max(0, prev.protein - (macros?.p || 0)),
        carbs: Math.max(0, prev.carbs - (macros?.c || 0)),
        fat: Math.max(0, prev.fat - (macros?.f || 0))
      }))

      showToast('Food removed')
    } catch {
      showToast('Failed to remove food')
    }
  }

  const num = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  // Open the edit sheet for a logged food entry.
  const openEdit = (log) => {
    const m = log.macros || {}
    const servings = num(m.servings) > 0 ? num(m.servings) : 1
    const cals = num(log.calories)
    const p = num(m.p), c = num(m.c), f = num(m.f)
    // Base = nutrition for ONE serving, so serving-size changes scale cleanly.
    const base = m.base && typeof m.base === 'object'
      ? { cals: num(m.base.cals), p: num(m.base.p), c: num(m.base.c), f: num(m.base.f) }
      : { cals: cals / servings, p: p / servings, c: c / servings, f: f / servings }
    setEditBase(base)
    setEditForm({ name: log.item_name || '', meal_type: m.meal_type || 'snack', servings, cals, p, c, f })
    setEditingLog(log)
  }

  const closeEdit = () => { setEditingLog(null); setEditForm(null); setEditBase(null) }

  // Change serving size — rescales calories & macros from the per-serving base.
  const applyServings = (s) => {
    setEditForm((prev) => {
      if (!prev || !editBase) return prev
      const n = num(s)
      return {
        ...prev,
        servings: s,
        cals: Math.round(editBase.cals * n),
        p: Math.round(editBase.p * n),
        c: Math.round(editBase.c * n),
        f: Math.round(editBase.f * n),
      }
    })
  }

  // Add sheet: changing servings rescales the typed numbers by the ratio, so
  // what you see is always what gets logged (same feel as the edit sheet).
  const applyManualServings = (s) => {
    setManualFood((prev) => {
      const from = num(prev.servings) > 0 ? num(prev.servings) : 1
      const to = num(s)
      if (!(to > 0)) return { ...prev, servings: s }
      const scale = (v) => (v === '' || v === null || v === undefined ? v : String(Math.round(num(v) * (to / from))))
      return { ...prev, servings: s, cals: scale(prev.cals), p: scale(prev.p), c: scale(prev.c), f: scale(prev.f) }
    })
  }

  const saveEdit = async () => {
    if (!editingLog || !editForm || savingEdit) return
    setSavingEdit(true)
    try {
      const servings = num(editForm.servings) > 0 ? num(editForm.servings) : 1
      const cals = Math.round(num(editForm.cals))
      const p = Math.round(num(editForm.p))
      const c = Math.round(num(editForm.c))
      const f = Math.round(num(editForm.f))
      // Recompute the per-serving base from the final values so future edits stay consistent.
      const base = { cals: cals / servings, p: p / servings, c: c / servings, f: f / servings }
      const macros = { p, c, f, meal_type: editForm.meal_type || 'snack', servings, base }

      const { error } = await supabase
        .from('food_logs')
        .update({ item_name: (editForm.name || '').trim() || 'Food', calories: cals, macros })
        .eq('id', editingLog.id)
      if (error) throw error

      await fetchDailyCalories()
      closeEdit()
      showToast('Food updated')
    } catch {
      showToast('Failed to update food')
    } finally {
      setSavingEdit(false)
    }
  }

  // Voice recording — uses MediaRecorder (works in iOS WKWebView),
  // then sends audio to /api/parse-voice-food for Gemini transcription.
  const startVoiceRecording = async () => {
    try {
      setError(null)
      transcriptRef.current = ''
      audioChunksRef.current = []

      // Request mic
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      streamRef.current = stream

      // Pick a supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone permissions in Settings.')
      } else if (err?.name === 'NotFoundError') {
        setError('No microphone found.')
      } else {
        setError('Could not start voice recording.')
      }
      setIsRecording(false)
    }
  }

  const stopVoiceRecording = async () => {
    setIsRecording(false)
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    // Wait for final chunk
    const stopped = new Promise((resolve) => {
      recorder.onstop = () => resolve()
    })
    try { recorder.stop() } catch {}
    await stopped

    // Stop mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
    if (!blob.size) {
      showToast('No audio captured. Please try again.')
      return
    }

    // Convert to base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result || ''
        resolve(typeof result === 'string' ? result.split(',')[1] : '')
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    if (!base64) {
      showToast('Could not process audio. Please try again.')
      return
    }

    setVoiceProcessing(true)
    try {
      const res = await fetch('/api/parse-voice-food/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType: recorder.mimeType || 'audio/webm' }),
      })

      let data
      try {
        data = await res.json()
      } catch {
        throw new Error('Server returned an invalid response')
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to parse food description')
      }

      setVoiceResult({ ...data, transcript: data.transcript || '' })
    } catch (err) {
      setError(err.message || 'Failed to process voice note. Please try again.')
    } finally {
      setVoiceProcessing(false)
    }
  }

  const confirmVoiceLog = async () => {
    if (!voiceResult) return
    // Log it like a normal food entry
    await autoLog(voiceResult)
    setVoiceResult(null)
  }

  const dismissVoiceResult = () => {
    setVoiceResult(null)
  }

  // Camera functions
  const startCamera = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraActive(true)
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setError('Camera access denied. Please allow camera permissions.')
      } else if (err.name === 'NotFoundError') {
        setError('No camera found. Use the upload button instead.')
      } else {
        setError('Could not start camera. Try uploading an image instead.')
      }
    }
  }

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }, [])

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const base64Image = canvas.toDataURL('image/jpeg', 0.7)

    stopCamera()
    setScanning(true)
    setResult(null)
    setError(null)

    resizeImage(base64Image, 800, async (resizedImage) => {
      await analyzeImage(resizedImage)
    })
  }

  const dismissResult = () => {
    setResult(null)
    setError(null)
  }

  const calorieProgress = Math.min((dailyCalories / dailyGoal) * 100, 100)

  // Default denominators used only when the user hasn't set a goal for a macro.
  const MACRO_DEFAULT = { protein: 150, carbs: 300, fat: 80 }
  const macroRows = [
    { key: 'protein', label: 'Protein', current: dailyMacros.protein, goal: goals.protein, bar: 'bg-blue-500' },
    { key: 'carbs', label: 'Carbs', current: dailyMacros.carbs, goal: goals.carbs, bar: 'bg-yellow-500' },
    { key: 'fat', label: 'Fat', current: dailyMacros.fat, goal: goals.fat, bar: 'bg-orange-500' },
  ]

  const groupedLogs = mealOrder.reduce((acc, type) => {
    const logs = todayLogs.filter(log => (log.macros?.meal_type || 'snack') === type)
    if (logs.length > 0) {
      acc[type] = logs
    }
    return acc
  }, {})

  // Also collect any logs without a recognized meal_type
  const ungroupedLogs = todayLogs.filter(log => {
    const mt = log.macros?.meal_type
    return mt && !mealOrder.includes(mt)
  })
  if (ungroupedLogs.length > 0) {
    groupedLogs['other'] = ungroupedLogs
  }

  if (pageLoading) {
    return <LoadingState label="Loading food log…" />
  }

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
      {/* Hidden canvas for camera capture */}
      <canvas ref={canvasRef} className="hidden" />

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

      <Masthead
        title="Food"
        actions={
          <>
            <MastheadAction onClick={openGoals} label="Goals">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            </MastheadAction>
            <MastheadAction onClick={() => router.push('/calendar?from=food')} label="Calendar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </MastheadAction>
          </>
        }
      />

      <main className="pt-20 px-4 max-w-lg mx-auto">
        {/* Which day you are logging to. A food diary that can only ever write
            to today is not a diary -- you cannot record Wednesday's dinner on
            Thursday morning. */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => shiftDay(-1)}
            aria-label="Previous day"
            className="shrink-0 w-9 h-9 rounded-xl bg-arc-card border border-white/5 text-arc-muted hover:text-white hover:border-white/20 flex items-center justify-center transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <button
            onClick={() => setShowDayPicker(true)}
            className={`flex-1 min-w-0 h-9 rounded-xl border flex items-center justify-center gap-2 px-3 transition-colors ${
              isToday ? 'bg-arc-card border-white/5 text-white' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span className="text-[12px] font-bold truncate">{dayLabel(logDate)}</span>
          </button>

          <button
            onClick={() => shiftDay(1)}
            disabled={isToday}
            aria-label="Next day"
            className="shrink-0 w-9 h-9 rounded-xl bg-arc-card border border-white/5 text-arc-muted hover:text-white hover:border-white/20 flex items-center justify-center transition-colors disabled:opacity-30 disabled:hover:text-arc-muted disabled:hover:border-white/5"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        {!isToday && (
          <button
            onClick={() => setLogDate(todayKey())}
            className="mt-2 w-full text-center text-[11px] font-bold text-amber-400/90 hover:text-amber-300 transition-colors"
          >
            Adding to {dayLabel(logDate)}. Tap to go back to today.
          </button>
        )}

        {/* Calorie Summary Card */}
        <div className="mt-4 bg-arc-card border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-6">
            {/* Progress Ring */}
            <div className="relative shrink-0">
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
                <div className="text-center">
                  <span className="text-lg font-black">{dailyCalories}</span>
                  <span className="block text-[10px] text-arc-muted font-bold">/ {dailyGoal}</span>
                </div>
              </div>
            </div>

            {/* Macros */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">{isToday ? "Today's" : dayLabel(logDate)} Macros</h2>
                <button onClick={openGoals} className="text-[9px] font-bold text-arc-accent uppercase tracking-wider hover:text-white transition-colors">Set goals</button>
              </div>
              <div className="space-y-1.5">
                {macroRows.map((m) => {
                  const denom = m.goal || MACRO_DEFAULT[m.key]
                  const pct = denom > 0 ? Math.min((m.current / denom) * 100, 100) : 0
                  const hit = m.goal != null && m.current >= m.goal
                  return (
                    <div key={m.key}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-arc-muted flex items-center gap-1">
                          {m.label}
                          {hit && <CheckIcon size={12} className="text-emerald-400" title="Goal reached" />}
                        </span>
                        <span className={`text-sm font-bold ${hit ? 'text-emerald-400' : ''}`}>
                          {m.current}{m.goal != null ? <span className="text-arc-muted font-normal"> / {m.goal}</span> : ''}g
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${hit ? 'bg-emerald-500' : m.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons - Scan, Voice, Manual */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {/* Scan Food */}
          <button
            onClick={() => {
              setError(null)
              if (cameraActive) stopCamera()
              fileInputRef.current?.click()
            }}
            disabled={scanning || voiceProcessing}
            className="bg-arc-card border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition hover:border-arc-accent/30 disabled:opacity-50"
          >
            {scanning ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 border-2 border-arc-accent/30 border-t-arc-accent rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-arc-accent/10 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            )}
            <span className="text-[10px] font-bold text-arc-muted uppercase tracking-wider">Scan</span>
          </button>

          {/* Voice Note */}
          <button
            onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
            disabled={scanning || voiceProcessing}
            className={`bg-arc-card border rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition disabled:opacity-50 ${isRecording ? 'border-red-500/50 bg-red-500/5' : 'border-white/5 hover:border-arc-accent/30'}`}
          >
            {voiceProcessing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 border-2 border-arc-accent/30 border-t-arc-accent rounded-full"
              />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isRecording ? 'bg-red-500/20' : 'bg-purple-500/10'}`}>
                {isRecording ? (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  </motion.div>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8" y1="23" x2="16" y2="23"/>
                  </svg>
                )}
              </div>
            )}
            <span className="text-[10px] font-bold text-arc-muted uppercase tracking-wider">
              {isRecording ? 'Stop' : voiceProcessing ? 'Processing' : 'Voice'}
            </span>
          </button>

          {/* Manual Entry */}
          <button
            onClick={() => {
              setManualFood(prev => ({ ...prev, meal_type: getDefaultMealType() }))
              setShowManualEntry(true)
            }}
            disabled={scanning || voiceProcessing}
            className="bg-arc-card border border-white/5 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition hover:border-arc-accent/30 disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            <span className="text-[10px] font-bold text-arc-muted uppercase tracking-wider">Manual</span>
          </button>
        </div>

        {/* Quick adds: café favourites + copy yesterday */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowFavourites(true)}
            className="bg-arc-card border border-white/5 rounded-2xl py-3 flex items-center justify-center gap-2 text-arc-muted hover:text-white hover:border-arc-accent/30 transition-colors text-sm font-bold"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Favourites
          </button>
          <button
            onClick={() => copyDayToToday()}
            disabled={copying}
            className="bg-arc-card border border-white/5 rounded-2xl py-3 flex items-center justify-center gap-2 text-arc-muted hover:text-white hover:border-arc-accent/30 transition-colors text-sm font-bold disabled:opacity-50"
          >
            {copying ? 'Copying…' : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy yesterday
              </>
            )}
          </button>
        </div>

        {/* Bring a diary across from another app */}
        <button
          onClick={() => csvInputRef.current?.click()}
          className="mt-3 w-full bg-arc-card border border-white/5 rounded-2xl py-3 flex items-center justify-center gap-2 text-arc-muted hover:text-white hover:border-arc-accent/30 transition-colors text-sm font-bold"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Import a food diary
        </button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
          className="hidden"
          onChange={(e) => { handleCsvFile(e.target.files?.[0]); e.target.value = '' }}
        />

        {/* A member asked how to sync MyFitnessPal and there was nowhere in the
            app that answered. The importer only ever showed a file picker, so
            "import a diary" was a dead end unless you already knew where the
            file came from. */}
        <button
          onClick={() => setShowImportHelp(true)}
          className="mt-2 w-full text-center text-[11px] text-arc-muted hover:text-white transition-colors underline underline-offset-2"
        >
          Where do I get the file?
        </button>

        <AnimatePresence>
          {showDayPicker && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowDayPicker(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] z-50"
              >
                <div className="p-6 space-y-4 pb-safe">
                  <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
                  <h2 className="text-xl font-black italic tracking-tighter">WHICH DAY?</h2>
                  <p className="text-[12px] text-arc-muted leading-relaxed">
                    Pick the day you ate it. Anything you add lands on that day, not today.
                  </p>
                  <input
                    type="date"
                    value={logDate}
                    max={todayKey()}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v && v <= todayKey()) { setLogDate(v); setShowDayPicker(false) }
                    }}
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold text-center text-lg [color-scheme:dark]"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map(back => {
                      const d = new Date(); d.setDate(d.getDate() - back)
                      const key = fmtDay(d)
                      return (
                        <button
                          key={key}
                          onClick={() => { setLogDate(key); setShowDayPicker(false) }}
                          className={`py-2.5 px-2 rounded-xl text-[11px] font-bold transition-colors border ${
                            logDate === key ? 'bg-arc-accent text-white border-transparent' : 'bg-arc-surface text-arc-muted border-white/5 hover:text-white'
                          }`}
                        >
                          {dayLabel(key)}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setShowDayPicker(false)}
                    className="w-full bg-white/5 text-arc-muted font-bold py-3 rounded-xl text-sm hover:text-white transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showImportHelp && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowImportHelp(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] z-50 max-h-[85vh] overflow-y-auto"
              >
                <div className="p-6 space-y-4 pb-safe">
                  <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
                  <h2 className="text-xl font-black italic tracking-tighter">BRINGING A DIARY ACROSS</h2>
                  <p className="text-[12px] text-arc-muted leading-relaxed">
                    There is no live sync with other food apps. What there is: export your
                    diary from them, then import the file here. It reads the columns and
                    lets you check everything before a single row is saved.
                  </p>

                  <div className="space-y-3">
                    <div className="bg-arc-surface rounded-xl p-4 space-y-1.5">
                      <p className="text-[11px] font-bold text-white uppercase tracking-widest">MyFitnessPal</p>
                      <p className="text-[12px] text-arc-muted leading-relaxed">
                        On the website (not the phone app): <span className="text-white font-bold">My Home → Reports → Export Data</span>, or Settings.
                      </p>
                      <p className="text-[12px] text-amber-400/90 leading-relaxed">
                        Heads up: CSV export is a Premium feature. On a free account you can
                        usually still print or save the diary as a PDF — send it to us and
                        we&apos;ll sort it out rather than have you retype a month of meals.
                      </p>
                    </div>

                    <div className="bg-arc-surface rounded-xl p-4 space-y-1.5">
                      <p className="text-[11px] font-bold text-white uppercase tracking-widest">Cronometer</p>
                      <p className="text-[12px] text-arc-muted leading-relaxed">
                        Settings → Account → Export Data. Free accounts can export.
                      </p>
                    </div>

                    <div className="bg-arc-surface rounded-xl p-4 space-y-1.5">
                      <p className="text-[11px] font-bold text-white uppercase tracking-widest">Anything else</p>
                      <p className="text-[12px] text-arc-muted leading-relaxed">
                        Any CSV works, including one you keep yourself. A date column and a
                        calories column are enough; protein, carbs and fat come across too
                        if they are there. Commas, semicolons and tabs are all fine.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => { setShowImportHelp(false); csvInputRef.current?.click() }}
                    className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow active:scale-95 transition-transform"
                  >
                    PICK A FILE
                  </button>
                  <button
                    onClick={() => setShowImportHelp(false)}
                    className="w-full bg-white/5 text-arc-muted font-bold py-3 rounded-xl text-sm hover:text-white transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Check the diary before anything is saved */}
        <AnimatePresence>
          {importState && importPreview && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => !importing && setImportState(null)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] z-50 max-h-[88vh] overflow-y-auto"
              >
                <div className="p-6 space-y-5 pb-safe">
                  <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />

                  <div>
                    <h2 className="text-xl font-black italic tracking-tighter">CHECK THIS LOOKS RIGHT</h2>
                    <p className="text-[11px] text-arc-muted mt-1 truncate">{importState.fileName}</p>
                  </div>

                  {importPreview.entries.length === 0 ? (
                    <p className="text-sm text-arc-muted bg-arc-surface border border-white/5 rounded-xl p-4">
                      {importState.needsMapping
                        ? "We couldn't tell which columns are which — this happens when the diary isn't in English. Set the food name and calories below and the rest will follow."
                        : 'No rows came through. Check the food name and calories are pointing at the right columns below.'}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Items', value: importPreview.summary.count },
                        { label: 'Days', value: importPreview.summary.days || '—' },
                        { label: 'Calories', value: importPreview.summary.calories.toLocaleString() },
                      ].map(s => (
                        <div key={s.label} className="bg-arc-surface border border-white/5 rounded-xl p-3 text-center">
                          <div className="text-lg font-black text-white leading-none">{s.value}</div>
                          <div className="text-[9px] text-arc-muted uppercase tracking-wider mt-1">{s.label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {importPreview.summary?.from && (
                    <p className="text-[11px] text-arc-muted text-center -mt-2">
                      {importPreview.summary.from.toLocaleDateString()} → {importPreview.summary.to.toLocaleDateString()}
                    </p>
                  )}

                  {/* Dates like 03/04 are unreadable without knowing the format */}
                  {importState.ambiguous && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3">
                      <p className="text-[11px] text-amber-200 leading-snug">
                        The dates in this file could be read either way round. Which is it?
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'dmy', label: 'Day / Month', hint: '15/08 = 15 Aug' },
                          { key: 'mdy', label: 'Month / Day', hint: '08/15 = 15 Aug' },
                        ].map(o => (
                          <button
                            key={o.key}
                            onClick={() => setImportState(prev => ({ ...prev, dateOrder: o.key }))}
                            className={`rounded-lg py-2 px-2 text-left transition-colors ${importState.dateOrder === o.key ? 'bg-amber-500 text-arc-bg' : 'bg-arc-surface text-arc-muted border border-white/5'}`}
                          >
                            <span className="block text-[11px] font-bold">{o.label}</span>
                            <span className="block text-[9px] opacity-80">{o.hint}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* First few rows, so a wrong column is obvious at a glance */}
                  {importPreview.entries.length > 0 && (
                    <div className="space-y-1.5">
                      {importPreview.entries.slice(0, 3).map((e, i) => (
                        <div key={i} className="bg-arc-surface border border-white/5 rounded-xl px-3 py-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[12px] font-bold text-white truncate">{e.name}</div>
                            <div className="text-[9px] text-arc-muted">
                              {e.eatenAt ? e.eatenAt.toLocaleDateString() : 'no date'} · {e.meal} · P{e.p} C{e.c} F{e.f}
                            </div>
                          </div>
                          <div className="text-[12px] font-black text-arc-accent shrink-0">{e.calories}</div>
                        </div>
                      ))}
                      {importPreview.entries.length > 3 && (
                        <p className="text-[10px] text-arc-muted text-center pt-1">
                          and {importPreview.entries.length - 3} more
                        </p>
                      )}
                    </div>
                  )}

                  {/* Say plainly what won't come across */}
                  {(importPreview.skipped.noName + importPreview.skipped.noCalories + importPreview.skipped.badDate > 0 || importState.truncated) && (
                    <div className="bg-arc-surface border border-white/5 rounded-xl p-3 space-y-1">
                      {importState.truncated && (
                        <p className="text-[10px] text-amber-400">Only the first {MAX_ROWS.toLocaleString()} rows will be imported.</p>
                      )}
                      {importPreview.skipped.noCalories > 0 && (
                        <p className="text-[10px] text-arc-muted">{importPreview.skipped.noCalories} row(s) skipped — no calories.</p>
                      )}
                      {importPreview.skipped.noName > 0 && (
                        <p className="text-[10px] text-arc-muted">{importPreview.skipped.noName} row(s) skipped — no food name.</p>
                      )}
                      {importPreview.skipped.badDate > 0 && (
                        <p className="text-[10px] text-arc-muted">{importPreview.skipped.badDate} row(s) skipped — unreadable date.</p>
                      )}
                    </div>
                  )}

                  {/* Fix the guesses */}
                  <details open={importState.needsMapping} className="bg-arc-surface border border-white/5 rounded-xl overflow-hidden">
                    <summary className="px-4 py-3 text-[11px] font-bold text-arc-muted cursor-pointer select-none">
                      {importState.needsMapping ? 'Tell us which columns are which' : 'Columns look wrong?'}
                    </summary>
                    <div className="px-4 pb-4 space-y-2">
                      {[
                        { field: 'name', label: 'Food name' },
                        { field: 'calories', label: 'Calories' },
                        { field: 'protein', label: 'Protein' },
                        { field: 'carbs', label: 'Carbs' },
                        { field: 'fat', label: 'Fat' },
                        { field: 'date', label: 'Date' },
                        { field: 'meal', label: 'Meal' },
                      ].map(({ field, label }) => (
                        <label key={field} className="flex items-center justify-between gap-3">
                          <span className="text-[11px] text-arc-muted shrink-0">{label}</span>
                          <select
                            value={importState.mapping[field] ?? ''}
                            onChange={(e) => setImportColumn(field, e.target.value)}
                            className="flex-1 min-w-0 bg-arc-bg border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white"
                          >
                            <option value="">Not in this file</option>
                            {importState.headers.map((h, idx) => (
                              <option key={idx} value={idx}>{h || `Column ${idx + 1}`}</option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </details>

                  <div className="space-y-2">
                    <button
                      onClick={runImport}
                      disabled={importing || importPreview.entries.length === 0}
                      className="w-full bg-accent-gradient text-white font-black italic py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform disabled:opacity-40"
                    >
                      {importing ? 'IMPORTING…' : `IMPORT ${importPreview.entries.length} ITEM${importPreview.entries.length === 1 ? '' : 'S'}`}
                    </button>
                    <button
                      onClick={() => setImportState(null)}
                      disabled={importing}
                      className="w-full bg-white/5 text-arc-muted font-bold py-3 rounded-xl text-sm hover:text-white transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Imported */}
        <AnimatePresence>
          {importDone && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setImportDone(null)}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="fixed inset-0 z-[60] flex items-center justify-center p-6"
              >
                <div className="bg-arc-card border border-white/10 rounded-[2rem] p-8 w-full max-w-sm text-center space-y-5">
                  <div className="flex justify-center text-arc-accent"><DownloadIcon size={48} /></div>
                  <div>
                    <h2 className="text-2xl font-black italic tracking-tighter leading-tight">DIARY IMPORTED</h2>
                    <p className="text-sm text-arc-muted mt-2">
                      {importDone.count.toLocaleString()} item{importDone.count === 1 ? '' : 's'}
                      {importDone.days > 0 && ` across ${importDone.days} day${importDone.days === 1 ? '' : 's'}`} — you&apos;ll find them on the days they were eaten.
                    </p>
                  </div>
                  <button
                    onClick={() => setImportDone(null)}
                    className="w-full bg-accent-gradient text-white font-black italic py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform"
                  >
                    NICE
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Voice Recording Indicator */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-center overflow-hidden"
            >
              <div className="flex items-center justify-center gap-2 mb-2">
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-red-500"
                />
                <span className="text-sm font-bold text-red-400">Listening...</span>
              </div>
              <p className="text-xs text-arc-muted">Describe what you ate, e.g. "I had two eggs and toast with butter for breakfast"</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error display */}
        {error && !scanning && (
          <div className="mt-3 bg-red-500/5 border border-red-500/20 rounded-2xl p-4 text-center">
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Today's Food Log - Grouped by Meal */}
        {todayLogs.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-3 px-1">{isToday ? "Today's Meals" : `${dayLabel(logDate)} · Meals`}</h3>
            <div className="space-y-4">
              {mealOrder.map((mealType) => {
                const logs = groupedLogs[mealType]
                if (!logs || logs.length === 0) return null

                const mealCals = logs.reduce((sum, log) => sum + (log.calories || 0), 0)

                return (
                  <div key={mealType}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-arc-muted"><MealIcon meal={mealType} size={15} /></span>
                        <span className="text-xs font-bold text-white uppercase tracking-wider">{mealLabels[mealType]}</span>
                      </div>
                      <span className="text-xs font-bold text-arc-muted">{mealCals} cal</span>
                    </div>
                    <div className="space-y-2">
                      {logs.map((log) => (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-arc-card border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-white truncate block">{log.item_name}</span>
                            <span className="text-[10px] text-arc-muted">
                              {log.quantity != null && (
                                <span className="text-arc-cyan/80">{log.quantity}{log.unit === 'g' || log.unit === 'ml' ? log.unit : ' ' + unitLabel(log.unit, log.quantity)} · </span>
                              )}
                              P:{log.macros?.p || 0}g  C:{log.macros?.c || 0}g  F:{log.macros?.f || 0}g
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-arc-cyan">{log.calories} cal</span>
                            <button
                              onClick={() => saveLogAsFavourite(log)}
                              className="text-white/20 hover:text-yellow-400 transition-colors p-1"
                              title="Save to favourites"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            </button>
                            <button
                              onClick={() => openEdit(log)}
                              className="text-white/20 hover:text-arc-cyan transition-colors p-1"
                              title="Edit"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                            </button>
                            <button
                              onClick={() => shareToFeed({ name: log.item_name, cals: log.calories, p: log.macros?.p || 0, c: log.macros?.c || 0, f: log.macros?.f || 0 })}
                              className="text-white/20 hover:text-arc-accent transition-colors p-1"
                              title="Share to feed"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                            </button>
                            <button
                              onClick={() => deleteLog(log.id, log.calories, log.macros)}
                              className="text-white/20 hover:text-red-500 transition-colors p-1"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {todayLogs.length === 0 && !scanning && (
          <div className="mt-6 text-center">
            <p className="text-arc-muted text-sm">{isToday ? 'No food logged today. Scan, speak, or add food to start tracking!' : `Nothing logged for ${dayLabel(logDate)} yet. Add it below and it lands on that day.`}</p>
          </div>
        )}
      </main>

      {/* Edit Food Modal */}
      <AnimatePresence>
        {editingLog && editForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeEdit}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 bg-arc-card rounded-t-3xl z-50 border-t border-white/10 p-6 pb-safe max-h-[90vh] overflow-y-auto"
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-5" />
              <h2 className="text-lg font-black italic tracking-tight text-center mb-5">EDIT FOOD</h2>

              <div className="space-y-4">
                <FoodFormFields
                  form={editForm}
                  setField={(k, v) => setEditForm((prev) => ({ ...prev, [k]: v }))}
                  servings={editForm.servings}
                  onServings={applyServings}
                  toNum={num}
                />

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={closeEdit}
                    className="flex-1 bg-arc-surface text-white font-bold py-4 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={savingEdit}
                    className="flex-1 bg-accent-gradient text-white font-black italic tracking-wider py-4 rounded-xl shadow-glow-accent disabled:opacity-50"
                  >
                    {savingEdit ? 'SAVING…' : 'SAVE'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Result Modal (from image scan) */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 bg-arc-card rounded-t-3xl z-50 border-t border-white/10"
          >
            <div className="p-6 pb-8">
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
                className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl shadow-lg shadow-black/20 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
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

      {/* Voice Result Confirmation Modal */}
      <AnimatePresence>
        {voiceResult && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 bg-arc-card rounded-t-3xl z-50 border-t border-white/10"
          >
            <div className="p-6 pb-8">
              <div
                className="w-12 h-1 bg-gray-700 rounded-full mx-auto mb-6 cursor-pointer"
                onClick={dismissVoiceResult}
              ></div>

              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold">{voiceResult.name}</h2>
                  <p className="text-arc-muted text-sm">{voiceResult.desc}</p>
                </div>
                <div className="bg-purple-500/10 text-purple-400 text-xs font-bold px-2 py-1 rounded">
                  Voice
                </div>
              </div>

              {voiceResult.transcript && (
                <div className="bg-white/5 rounded-xl p-3 mb-4">
                  <p className="text-xs text-arc-muted italic">"{voiceResult.transcript}"</p>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <div className="text-xs text-arc-muted mb-1">Cals</div>
                  <div className="font-black text-xl">{voiceResult.cals}</div>
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <div className="text-xs text-arc-muted mb-1">Prot</div>
                  <div className="font-bold text-lg">{voiceResult.p}g</div>
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <div className="text-xs text-arc-muted mb-1">Carb</div>
                  <div className="font-bold text-lg">{voiceResult.c}g</div>
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                  <div className="text-xs text-arc-muted mb-1">Fat</div>
                  <div className="font-bold text-lg">{voiceResult.f}g</div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-arc-muted">Meal:</span>
                <span className="text-xs font-bold text-white capitalize inline-flex items-center gap-1.5"><MealIcon meal={voiceResult.meal_type} size={13} /> {voiceResult.meal_type}</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={dismissVoiceResult}
                  className="flex-1 bg-arc-surface text-white font-bold py-4 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmVoiceLog}
                  className="flex-1 bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow active:scale-95 transition"
                >
                  Log Food
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share to Feed Prompt */}
      <AnimatePresence>
        {lastLoggedResult && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 bg-arc-card rounded-t-3xl z-50 border-t border-white/10"
          >
            <div className="p-6 pb-8">
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
              <div className="text-center mb-4">
                <div className="text-2xl mb-2">&#127860;</div>
                <h3 className="text-lg font-bold text-white">{lastLoggedResult.name} logged!</h3>
                <p className="text-arc-muted text-sm mt-1">{lastLoggedResult.cals} cal | P:{lastLoggedResult.p}g C:{lastLoggedResult.c}g F:{lastLoggedResult.f}g</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setLastLoggedResult(null)}
                  className="flex-1 bg-arc-surface text-white font-bold py-4 rounded-xl"
                >
                  Done
                </button>
                <button
                  onClick={() => shareToFeed(lastLoggedResult)}
                  className="flex-1 bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow flex items-center justify-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  Share to Feed
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quantity prompt — "how much did you eat?" scales the macros */}
      <AnimatePresence>
        {qtyPrompt && (() => {
          const it = qtyPrompt.item
          const q = parseFloat(qtyPrompt.qty)
          const factor = !isNaN(q) && q > 0 ? q / (it.base_qty || 1) : 0
          const uLong = it.base_unit === 'g' || it.base_unit === 'ml' ? it.base_unit : ' ' + unitLabel(it.base_unit, q || 0)
          return (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setQtyPrompt(null)} className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60]" />
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-6 z-[60] pb-safe space-y-4">
                <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
                <div className="text-center">
                  <h2 className="text-lg font-black italic tracking-tight">{it.name}{it.brand ? <span className="text-arc-muted font-normal"> · {it.brand}</span> : null}</h2>
                  <p className="text-[11px] text-arc-muted mt-0.5">{it.cals} cal · P:{it.p} C:{it.c} F:{it.f} per {it.base_qty}{uLong}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1.5 block text-center">How much did you eat?</label>
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="number" inputMode="decimal" autoFocus value={qtyPrompt.qty}
                      onChange={(e) => setQtyPrompt({ ...qtyPrompt, qty: e.target.value })}
                      className="w-32 bg-transparent border-b-2 border-white/[0.08] text-center font-mono text-4xl font-black text-white py-2 outline-none focus:border-arc-accent/60"
                    />
                    <span className="text-lg font-bold text-arc-muted">{it.base_unit === 'g' || it.base_unit === 'ml' ? it.base_unit : unitLabel(it.base_unit, q || 0)}</span>
                  </div>
                </div>
                {/* Live scaled macros */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    { l: 'Cals', v: Math.round(it.cals * factor), col: 'text-arc-cyan' },
                    { l: 'P', v: Math.round(it.p * factor), col: 'text-white' },
                    { l: 'C', v: Math.round(it.c * factor), col: 'text-white' },
                    { l: 'F', v: Math.round(it.f * factor), col: 'text-white' },
                  ].map((m) => (
                    <div key={m.l} className="bg-arc-surface border border-white/5 rounded-xl py-2">
                      <div className={`text-lg font-black font-mono ${m.col}`}>{m.v}</div>
                      <div className="text-[9px] font-bold text-arc-muted uppercase tracking-wider">{m.l}</div>
                    </div>
                  ))}
                </div>
                <button onClick={logWithQuantity} disabled={addingFav != null} className="w-full bg-arc-accent text-white font-black italic py-4 rounded-xl shadow-glow disabled:opacity-50">
                  {addingFav != null ? 'ADDING…' : 'ADD TO TODAY'}
                </button>
              </motion.div>
            </>
          )
        })()}
      </AnimatePresence>

      {/* Café Favourites Modal */}
      <AnimatePresence>
        {showFavourites && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowFavourites(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-6 z-50 pb-safe max-h-[85vh] overflow-y-auto"
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-4" />
              <div className="text-center mb-4">
                <h2 className="text-xl font-black italic tracking-tighter">PANTRY</h2>
                <p className="text-[11px] text-arc-muted mt-1">Tap a food, enter how much you ate — the app scales the macros.</p>
              </div>

              {/* My favourites (user-created) */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-bold text-arc-accent uppercase tracking-widest">My Pantry</h3>
                  <button onClick={() => setShowFavForm((v) => !v)} className="text-[10px] font-bold text-arc-accent uppercase tracking-wider hover:text-white transition-colors">
                    {showFavForm ? 'Close' : '+ Add food'}
                  </button>
                </div>

                <AnimatePresence>
                  {showFavForm && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-3"
                    >
                      <div className="bg-arc-surface border border-white/10 rounded-xl p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text" value={favForm.name} onChange={(e) => setFavForm({ ...favForm, name: e.target.value })}
                            placeholder="Food (e.g. Chicken breast)"
                            className="w-full bg-arc-bg border border-white/10 p-2.5 rounded-lg text-white outline-none focus:border-arc-accent text-sm font-bold"
                          />
                          <input
                            type="text" value={favForm.brand} onChange={(e) => setFavForm({ ...favForm, brand: e.target.value })}
                            placeholder="Brand (optional)"
                            className="w-full bg-arc-bg border border-white/10 p-2.5 rounded-lg text-white outline-none focus:border-arc-accent text-sm font-bold placeholder-white/30"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-arc-muted uppercase tracking-wider shrink-0">Macros per</span>
                          <input
                            type="number" inputMode="decimal" value={favForm.baseQty} onChange={(e) => setFavForm({ ...favForm, baseQty: e.target.value })}
                            className="w-16 bg-arc-bg border border-white/10 p-2 rounded-lg text-white outline-none focus:border-arc-accent text-center text-sm font-bold"
                          />
                          <select
                            value={favForm.baseUnit} onChange={(e) => setFavForm({ ...favForm, baseUnit: e.target.value })}
                            className="flex-1 bg-arc-bg border border-white/10 p-2 rounded-lg text-white outline-none focus:border-arc-accent text-sm font-bold"
                          >
                            {FOOD_UNITS.map((u) => <option key={u} value={u}>{u === 'unit' ? 'unit (e.g. 1 wrap)' : u === 'serving' ? 'serving' : u}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {[
                            { k: 'cals', ph: 'Cals' }, { k: 'p', ph: 'P' }, { k: 'c', ph: 'C' }, { k: 'f', ph: 'F' },
                          ].map((fld) => (
                            <input
                              key={fld.k} type="number" inputMode="numeric" value={favForm[fld.k]}
                              onChange={(e) => setFavForm({ ...favForm, [fld.k]: e.target.value })}
                              placeholder={fld.ph}
                              className="w-full bg-arc-bg border border-white/10 p-2 rounded-lg text-white outline-none focus:border-arc-accent text-center text-sm font-bold placeholder-white/30"
                            />
                          ))}
                        </div>
                        <p className="text-[10px] text-arc-muted">Enter the macros for that amount — when you log it, tell the app how much you ate and it scales them.</p>
                        <button onClick={addCustomFavourite} className="w-full bg-arc-accent text-white font-bold py-2.5 rounded-lg text-sm">Save to pantry</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {myFavourites.length === 0 ? (
                  <p className="text-[11px] text-arc-muted">
                    Your pantry is empty. Add a food above (with its macros per 100 g, per wrap, etc.), or tap
                    <StarIcon size={11} className="inline mx-1 -mt-0.5" /> on a logged food.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {myFavourites.map((fav) => (
                      <div key={fav.id} className="w-full flex items-center justify-between gap-2 bg-arc-surface border border-white/5 rounded-xl px-4 py-3">
                        <button onClick={() => logMyFavourite(fav)} disabled={addingFav === fav.name} className="flex-1 flex items-center justify-between gap-3 min-w-0 text-left disabled:opacity-50">
                          <div className="min-w-0">
                            <span className="text-sm font-bold text-white truncate block">{fav.name}{fav.brand ? <span className="text-arc-muted font-normal"> · {fav.brand}</span> : null}</span>
                            <span className="text-[10px] text-arc-muted">{fav.calories} cal · P:{fav.macros?.p || 0} C:{fav.macros?.c || 0} F:{fav.macros?.f || 0} <span className="text-arc-muted/60">/ {Number(fav.base_qty) || 1}{fav.base_unit === 'g' || fav.base_unit === 'ml' ? fav.base_unit : ' ' + unitLabel(fav.base_unit, Number(fav.base_qty) || 1)}</span></span>
                          </div>
                          <span className="w-6 h-6 rounded-full bg-arc-accent/15 text-arc-accent flex items-center justify-center font-bold shrink-0">+</span>
                        </button>
                        <button onClick={() => deleteFavourite(fav.id)} aria-label="Remove from pantry" className="text-white/20 hover:text-red-400 transition-colors p-1 shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-5">
                <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest -mb-2">Café menu</h3>
                {FAVOURITES.map((section) => (
                  <div key={section.group}>
                    <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2">{section.group}</h3>
                    <div className="space-y-2">
                      {section.items.map((fav) => (
                        <button
                          key={fav.name}
                          onClick={() => logFavourite(fav)}
                          disabled={addingFav === fav.name}
                          className="w-full flex items-center justify-between gap-3 bg-arc-surface border border-white/5 rounded-xl px-4 py-3 hover:border-arc-accent/30 transition-colors disabled:opacity-50 text-left"
                        >
                          <div className="min-w-0">
                            <span className="text-sm font-bold text-white truncate block">{fav.name}</span>
                            <span className="text-[10px] text-arc-muted">P:{fav.p}g C:{fav.c}g F:{fav.f}g</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-black text-arc-cyan">{fav.cals} cal</span>
                            <span className="w-6 h-6 rounded-full bg-arc-accent/15 text-arc-accent flex items-center justify-center font-bold">
                              {addingFav === fav.name ? '…' : '+'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowFavourites(false)}
                className="w-full mt-5 bg-arc-surface text-white font-bold py-4 rounded-xl"
              >
                Done
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Goals Modal */}
      <AnimatePresence>
        {showGoals && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowGoals(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-6 z-50 pb-safe max-h-[90vh] overflow-y-auto"
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-5" />
              <h2 className="text-xl font-black italic tracking-tighter text-center">DAILY GOALS</h2>
              <p className="text-[11px] text-arc-muted text-center mt-1 mb-5">Set any of these. Leave blank to skip — e.g. track carbs only.</p>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Calorie goal</label>
                  <input
                    type="number" inputMode="numeric" value={goalsForm.cals}
                    onChange={(e) => setGoalsForm({ ...goalsForm, cals: e.target.value })}
                    placeholder="e.g. 2000"
                    className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'carbs', label: 'Carbs (g)', calPerG: 4 },
                    { key: 'protein', label: 'Protein (g)', calPerG: 4 },
                    { key: 'fat', label: 'Fat (g)', calPerG: 9 },
                  ].map((m) => {
                    const cals = parseInt(goalsForm.cals, 10)
                    const grams = parseInt(goalsForm[m.key], 10)
                    const pct = cals > 0 && grams > 0 ? Math.round((grams * m.calPerG / cals) * 100) : null
                    return (
                      <div key={m.key}>
                        <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">{m.label}</label>
                        <input
                          type="number" inputMode="numeric" value={goalsForm[m.key]}
                          onChange={(e) => setGoalsForm({ ...goalsForm, [m.key]: e.target.value })}
                          placeholder="0"
                          className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold text-center"
                        />
                        {pct != null && <span className="block text-center text-[9px] text-arc-cyan mt-1">{pct}% of cals</span>}
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-arc-muted">Tip: for a 35/35/30 split at 2000 cals that's ~175g carbs, 150g protein, 78g fat.</p>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowGoals(false)} className="flex-1 bg-arc-surface text-white font-bold py-4 rounded-xl">Cancel</button>
                <button
                  onClick={saveGoals}
                  disabled={savingGoals}
                  className="flex-1 bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow disabled:opacity-50"
                >
                  {savingGoals ? 'Saving…' : 'Save Goals'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

              <FoodFormFields
                form={manualFood}
                setField={(k, v) => setManualFood((prev) => ({ ...prev, [k]: v }))}
                servings={manualFood.servings}
                onServings={applyManualServings}
                toNum={num}
              />

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="flex-1 bg-arc-surface text-white font-bold py-4 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={addManualEntry}
                  disabled={isLogging || !manualFood.name.trim()}
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
