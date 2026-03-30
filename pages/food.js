import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import confetti from 'canvas-confetti'
import { useRouter } from 'next/router'

export default function Food() {
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [isLogging, setIsLogging] = useState(false)
  const [dailyCalories, setDailyCalories] = useState(0)
  const [dailyGoal, setDailyGoal] = useState(2800)
  const [dailyMacros, setDailyMacros] = useState({ protein: 0, carbs: 0, fat: 0 })
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualFood, setManualFood] = useState({ name: '', cals: '', p: '', c: '', f: '', meal_type: 'snack' })
  const [todayLogs, setTodayLogs] = useState([])
  const [toast, setToast] = useState(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [cameraActive, setCameraActive] = useState(false)
  const [lastLoggedResult, setLastLoggedResult] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [voiceProcessing, setVoiceProcessing] = useState(false)
  const [voiceResult, setVoiceResult] = useState(null)
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
      fetchDailyCalories()
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

  async function fetchDailyCalories() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Fetch user's calorie goal (column may not exist yet)
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('daily_calorie_goal')
          .eq('id', user.id)
          .single()
        if (profile?.daily_calorie_goal) {
          setDailyGoal(profile.daily_calorie_goal)
        }
      } catch (e) {
        // daily_calorie_goal column may not exist yet — use default
      }

      // Fetch today's food logs
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
      console.error('Analyze error:', err)
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
        macros: { p: data.p, c: data.c, f: data.f, meal_type: mealType }
      }).select().single()

      if (insertError) {
        console.error('Auto-log error:', insertError)
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

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#ffffff'] })
      setLastLoggedResult({ ...data })
    } catch (err) {
      console.error('Auto-log failed:', err)
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
        macros: { p: result.p, c: result.c, f: result.f, meal_type: mealType }
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
      showToast('Food logged! Share it to the feed?')

      setLastLoggedResult({ ...result })
      setResult(null)
    } catch (err) {
      console.error('Error logging food:', err)
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
    } catch (err) {
      console.error('Share error:', err)
      showToast('Failed to share. Try again.')
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
      const mealType = manualFood.meal_type || getDefaultMealType()

      const { data: newLog, error: insertError } = await supabase.from('food_logs').insert({
        user_id: user.id,
        item_name: manualFood.name.trim(),
        calories: cals,
        macros: { p, c, f, meal_type: mealType }
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
      showToast('Food logged! Share it to the feed?')

      setLastLoggedResult({ name: manualFood.name.trim(), cals, p, c, f, desc: 'Manual entry' })
      setManualFood({ name: '', cals: '', p: '', c: '', f: '', meal_type: 'snack' })
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
      setDailyCalories(prev => Math.max(0, prev - (calories || 0)))
      setDailyMacros(prev => ({
        protein: Math.max(0, prev.protein - (macros?.p || 0)),
        carbs: Math.max(0, prev.carbs - (macros?.c || 0)),
        fat: Math.max(0, prev.fat - (macros?.f || 0))
      }))

      showToast('Food removed')
    } catch (err) {
      console.error('Error deleting log:', err)
      showToast('Failed to remove food')
    }
  }

  // Voice recording functions
  const startVoiceRecording = async () => {
    try {
      setError(null)
      transcriptRef.current = ''

      // Use Web Speech API for real-time transcription
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (!SpeechRecognition) {
        // Fallback: use MediaRecorder for audio capture
        showToast('Speech recognition not supported. Try typing instead.')
        return
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event) => {
        let finalTranscript = ''
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          }
        }
        if (finalTranscript) {
          transcriptRef.current = finalTranscript
        }
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please allow microphone permissions.')
        }
        setIsRecording(false)
      }

      recognition.onend = () => {
        // If we're still supposed to be recording, the user hasn't stopped yet
        // This can fire naturally, so we handle it in stopVoiceRecording
      }

      recognitionRef.current = recognition
      recognition.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Voice recording error:', err)
      setError('Could not start voice recording.')
    }
  }

  const stopVoiceRecording = async () => {
    setIsRecording(false)

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    // Small delay to let final results come in
    await new Promise(resolve => setTimeout(resolve, 500))

    const transcript = transcriptRef.current.trim()
    if (!transcript) {
      showToast('No speech detected. Please try again.')
      return
    }

    setVoiceProcessing(true)

    try {
      const res = await fetch('/api/parse-voice-food/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
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

      // Show the result for confirmation before logging
      setVoiceResult({ ...data, transcript })
    } catch (err) {
      console.error('Voice food parse error:', err)
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
      console.error('Camera error:', err)
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

  // Group logs by meal type
  const mealOrder = ['breakfast', 'lunch', 'dinner', 'snack']
  const mealLabels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' }
  const mealIcons = { breakfast: '\u2600\uFE0F', lunch: '\uD83C\uDF1E', dinner: '\uD83C\uDF19', snack: '\u26A1' }

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
    return (
      <div className="min-h-screen bg-arc-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-arc-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
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

      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-black tracking-tighter italic">NUTRITION</h1>
        </div>
      </header>

      <main className="pt-16 px-4 max-w-lg mx-auto">
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
              <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Today's Macros</h2>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-arc-muted">Protein</span>
                  <span className="text-sm font-bold">{dailyMacros.protein}g</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((dailyMacros.protein / 150) * 100, 100)}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-arc-muted">Carbs</span>
                  <span className="text-sm font-bold">{dailyMacros.carbs}g</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((dailyMacros.carbs / 300) * 100, 100)}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-arc-muted">Fat</span>
                  <span className="text-sm font-bold">{dailyMacros.fat}g</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full transition-all duration-500" style={{ width: `${Math.min((dailyMacros.fat / 80) * 100, 100)}%` }} />
                </div>
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
            <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-3 px-1">Today's Meals</h3>
            <div className="space-y-4">
              {mealOrder.map((mealType) => {
                const logs = groupedLogs[mealType]
                if (!logs || logs.length === 0) return null

                const mealCals = logs.reduce((sum, log) => sum + (log.calories || 0), 0)

                return (
                  <div key={mealType}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{mealIcons[mealType]}</span>
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
                              P:{log.macros?.p || 0}g  C:{log.macros?.c || 0}g  F:{log.macros?.f || 0}g
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-arc-cyan">{log.calories} cal</span>
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
            <p className="text-arc-muted text-sm">No food logged today. Scan, speak, or add food to start tracking!</p>
          </div>
        )}
      </main>

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
                <span className="text-xs font-bold text-white capitalize">{mealIcons[voiceResult.meal_type]} {voiceResult.meal_type}</span>
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

                {/* Meal Type Selector */}
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Meal</label>
                  <div className="grid grid-cols-4 gap-2">
                    {mealOrder.map((type) => (
                      <button
                        key={type}
                        onClick={() => setManualFood({ ...manualFood, meal_type: type })}
                        className={`py-2 px-2 rounded-xl text-xs font-bold transition-colors ${manualFood.meal_type === type ? 'bg-arc-accent text-white' : 'bg-arc-surface text-arc-muted border border-white/10'}`}
                      >
                        {mealIcons[type]} {mealLabels[type]}
                      </button>
                    ))}
                  </div>
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
