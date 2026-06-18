import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/router'
import Nav from '../../components/Nav'
import LoadingState from '../../components/LoadingState'
import { supabase } from '../../lib/supabaseClient'

const METRICS = [
  { value: 'weight', label: 'Weight (kg)' },
  { value: 'reps', label: 'Reps' },
  { value: 'time', label: 'Time (min)' },
  { value: 'distance', label: 'Distance (km)' },
]

const emptyRow = () => ({
  name: '',
  metric_type: 'weight',
  target_sets: '',
  target_reps: '',
  target_value: '',
  notes: '',
})

// Resize an image data URL before upload (keeps us under the 4.5MB API limit).
const resizeImage = (base64Str, maxWidth, callback, onError) => {
  const img = new Image()
  const timeout = setTimeout(() => onError('Image took too long to load'), 10000)
  img.onerror = () => { clearTimeout(timeout); onError('Failed to load image') }
  img.onload = () => {
    clearTimeout(timeout)
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return onError('Canvas not supported')
      let { width, height } = img
      if (width > height) {
        if (width > maxWidth) { height *= maxWidth / width; width = maxWidth }
      } else {
        if (height > maxWidth) { width *= maxWidth / height; height = maxWidth }
      }
      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)
      callback(canvas.toDataURL('image/jpeg', 0.7))
    } catch {
      onError('Failed to process image')
    }
  }
  img.src = base64Str
}

const Toast = ({ message, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <motion.div
      initial={{ opacity: 0, y: -50, x: '-50%' }} animate={{ opacity: 1, y: 20, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }}
      className="fixed top-0 left-1/2 z-50 bg-arc-surface/90 border border-arc-accent/20 text-white px-6 py-3 rounded-full shadow-glow flex items-center gap-3 backdrop-blur-xl"
    >
      <div className="w-2 h-2 rounded-full bg-arc-accent animate-pulse" />
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  )
}

const todayStr = () => {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

export default function AdminWorkouts() {
  const router = useRouter()
  const fileRef = useRef(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [toast, setToast] = useState(null)

  const [workoutId, setWorkoutId] = useState(null) // existing row for the date
  const [date, setDate] = useState(todayStr())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [source, setSource] = useState('manual')
  const [rows, setRows] = useState([emptyRow()])

  const [scanning, setScanning] = useState(false)
  const [saving, setSaving] = useState(false)

  const showToast = (m) => setToast(m)

  // --- Auth / admin guard ---------------------------------------------------
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profile?.is_admin) { router.push('/train'); return }
      setIsAdmin(true)
      setIsLoading(false)
    }
    init()
  }, [])

  // --- Load any existing workout for the selected date ----------------------
  useEffect(() => {
    if (!isAdmin) return
    loadForDate(date)
  }, [date, isAdmin])

  async function loadForDate(d) {
    const { data: existing } = await supabase
      .from('daily_workouts')
      .select('*')
      .eq('workout_date', d)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      setWorkoutId(existing.id)
      setTitle(existing.title || '')
      setDescription(existing.description || '')
      setSource(existing.source || 'manual')
      const { data: exs } = await supabase
        .from('daily_workout_exercises')
        .select('*')
        .eq('daily_workout_id', existing.id)
        .order('position', { ascending: true })
      setRows(exs && exs.length ? exs.map(e => ({
        name: e.name || '',
        metric_type: e.metric_type || 'weight',
        target_sets: e.target_sets ?? '',
        target_reps: e.target_reps ?? '',
        target_value: e.target_value ?? '',
        notes: e.notes || '',
      })) : [emptyRow()])
    } else {
      setWorkoutId(null)
      setTitle('')
      setDescription('')
      setSource('manual')
      setRows([emptyRow()])
    }
  }

  // --- Photo → AI parse -----------------------------------------------------
  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (file) await scanFile(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const scanFile = async (file) => {
    setScanning(true)
    const reader = new FileReader()
    reader.onerror = () => { setScanning(false); showToast('Failed to read image') }
    reader.onloadend = () => {
      resizeImage(reader.result, 1100, (resized) => parseWorkout(resized), (msg) => { setScanning(false); showToast(msg) })
    }
    reader.readAsDataURL(file)
  }

  const parseWorkout = async (image) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setScanning(false); showToast('Session expired, please re-login'); return }

      const res = await fetch('/api/admin/parse-workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `Scan failed (${res.status})`)

      if (!data.exercises || data.exercises.length === 0) {
        showToast('No exercises detected — add them manually')
      } else {
        if (data.title && !title) setTitle(data.title)
        if (data.description && !description) setDescription(data.description)
        setSource('photo')
        setRows(data.exercises.map(ex => ({
          name: ex.name || '',
          metric_type: ex.metric_type || 'weight',
          target_sets: ex.sets ?? '',
          target_reps: ex.reps ?? '',
          target_value: ex.target ?? '',
          notes: ex.notes || '',
        })))
        showToast(`Loaded ${data.exercises.length} movement${data.exercises.length > 1 ? 's' : ''}`)
      }
    } catch (err) {
      showToast(err.message || 'Failed to scan workout')
    } finally {
      setScanning(false)
    }
  }

  // --- Row helpers ----------------------------------------------------------
  const updateRow = (i, key, val) => setRows(rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r))
  const addRow = () => setRows([...rows, emptyRow()])
  const removeRow = (i) => setRows(rows.length > 1 ? rows.filter((_, idx) => idx !== i) : [emptyRow()])

  // --- Save / publish -------------------------------------------------------
  const handleSave = async (publish) => {
    if (saving) return
    const cleanRows = rows.filter(r => r.name.trim())
    if (!title.trim()) { showToast('Add a workout title'); return }
    if (cleanRows.length === 0) { showToast('Add at least one movement'); return }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        workout_date: date,
        source,
        is_published: publish,
        created_by: user?.id || null,
        updated_at: new Date().toISOString(),
      }

      let wid = workoutId
      if (wid) {
        const { error } = await supabase.from('daily_workouts').update(payload).eq('id', wid)
        if (error) throw error
        await supabase.from('daily_workout_exercises').delete().eq('daily_workout_id', wid)
      } else {
        const { data, error } = await supabase.from('daily_workouts').insert(payload).select('id').single()
        if (error) throw error
        wid = data.id
        setWorkoutId(wid)
      }

      const exRows = cleanRows.map((r, idx) => ({
        daily_workout_id: wid,
        name: r.name.trim(),
        metric_type: r.metric_type || 'weight',
        target_sets: r.target_sets === '' ? null : parseInt(r.target_sets, 10),
        target_reps: r.target_reps === '' ? null : parseInt(r.target_reps, 10),
        target_value: r.target_value === '' ? null : parseFloat(r.target_value),
        notes: r.notes?.trim() || null,
        position: idx,
      }))
      const { error: exErr } = await supabase.from('daily_workout_exercises').insert(exRows)
      if (exErr) throw exErr

      showToast(publish ? 'Workout published to all users 🎉' : 'Saved as draft')
    } catch (err) {
      console.error('[Arctivate] save workout failed:', err)
      showToast(`Failed to save: ${err.message || 'unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <LoadingState label="Checking access…" />

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-28 font-sans">
      <AnimatePresence>{toast && <Toast message={toast} onClose={() => setToast(null)} />}</AnimatePresence>

      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="p-5 flex justify-between items-center max-w-lg mx-auto">
          <div>
            <h1 className="text-xl font-black italic tracking-tighter text-gradient-accent">ARCTIVATE</h1>
            <span className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em]">Admin · Workout of the Day</span>
          </div>
        </div>
      </header>

      <main className="pt-24 px-5 space-y-6 max-w-lg mx-auto">

        {/* Photo scan */}
        <section className="relative">
          <div className="absolute -inset-[1px] bg-gradient-to-b from-arc-accent/20 via-arc-cyan/10 to-transparent rounded-[2rem] blur-sm opacity-60" />
          <div className="relative bg-arc-card border border-white/[0.06] rounded-[2rem] shadow-card overflow-hidden">
            <div className="h-[2px] bg-accent-gradient-r" />
            <div className="p-6 space-y-4">
              <div>
                <h2 className="font-black italic tracking-tight text-lg">Snap a workout</h2>
                <p className="text-[11px] text-arc-muted mt-1">Take a photo of a whiteboard or written plan — AI turns it into a workout you can edit.</p>
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={scanning}
                className="w-full bg-accent-gradient text-white font-black italic tracking-wider py-4 rounded-xl shadow-glow-accent disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {scanning ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                    <span>READING…</span>
                  </>
                ) : '📸 SCAN WORKOUT PHOTO'}
              </button>
            </div>
          </div>
        </section>

        {/* Date + meta */}
        <section className="bg-arc-card border border-white/[0.04] rounded-2xl p-5 space-y-4">
          <div>
            <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-2 block">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full bg-arc-surface border border-white/[0.06] text-white p-3 rounded-xl outline-none focus:border-arc-accent/40" />
            {workoutId && <p className="text-[10px] text-arc-cyan mt-1.5">Editing the existing workout for this date.</p>}
          </div>
          <div>
            <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-2 block">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Leg Day"
              className="w-full bg-arc-surface border border-white/[0.06] text-white p-3 rounded-xl outline-none focus:border-arc-accent/40 font-bold" />
          </div>
          <div>
            <label className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] mb-2 block">Description / scheme</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. AMRAP 20 — keep moving" rows={2}
              className="w-full bg-arc-surface border border-white/[0.06] text-white p-3 rounded-xl outline-none focus:border-arc-accent/40 resize-none" />
          </div>
        </section>

        {/* Movements */}
        <section className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em]">Movements</h3>
            <button onClick={addRow} className="text-[9px] font-bold text-arc-accent uppercase tracking-[0.15em] hover:text-white transition-colors">+ Add</button>
          </div>

          {rows.map((row, i) => (
            <div key={i} className="bg-arc-card border border-white/[0.04] rounded-2xl p-4 space-y-3">
              <div className="flex gap-2">
                <input type="text" value={row.name} onChange={(e) => updateRow(i, 'name', e.target.value)} placeholder="Movement name"
                  className="flex-1 bg-arc-surface border border-white/[0.06] text-white p-3 rounded-xl outline-none focus:border-arc-accent/40 font-bold text-sm" />
                <button onClick={() => removeRow(i)} aria-label="Remove" className="px-3 rounded-xl bg-arc-surface border border-white/[0.06] text-arc-muted hover:text-red-400 transition-colors">✕</button>
              </div>
              <select value={row.metric_type} onChange={(e) => updateRow(i, 'metric_type', e.target.value)}
                className="w-full bg-arc-surface border border-white/[0.06] text-white p-2.5 rounded-xl outline-none focus:border-arc-accent/40 text-sm">
                {METRICS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[8px] font-bold text-arc-muted uppercase tracking-[0.15em] mb-1 block text-center">Sets</label>
                  <input type="number" min="1" value={row.target_sets} onChange={(e) => updateRow(i, 'target_sets', e.target.value)} placeholder="—"
                    className="w-full bg-arc-surface border border-white/[0.05] text-center font-mono font-bold text-white py-2 rounded-xl outline-none focus:border-arc-accent/40 placeholder-white/10" />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-arc-muted uppercase tracking-[0.15em] mb-1 block text-center">Reps</label>
                  <input type="number" min="1" value={row.target_reps} onChange={(e) => updateRow(i, 'target_reps', e.target.value)} placeholder="—"
                    className="w-full bg-arc-surface border border-white/[0.05] text-center font-mono font-bold text-white py-2 rounded-xl outline-none focus:border-arc-accent/40 placeholder-white/10" />
                </div>
                <div>
                  <label className="text-[8px] font-bold text-arc-muted uppercase tracking-[0.15em] mb-1 block text-center">Target</label>
                  <input type="number" min="0" step="0.5" value={row.target_value} onChange={(e) => updateRow(i, 'target_value', e.target.value)} placeholder="—"
                    className="w-full bg-arc-surface border border-white/[0.05] text-center font-mono font-bold text-white py-2 rounded-xl outline-none focus:border-arc-accent/40 placeholder-white/10" />
                </div>
              </div>
              <input type="text" value={row.notes} onChange={(e) => updateRow(i, 'notes', e.target.value)} placeholder="Notes (tempo, rest, RPE…)"
                className="w-full bg-arc-surface border border-white/[0.06] text-white p-2.5 rounded-xl outline-none focus:border-arc-accent/40 text-sm placeholder-white/20" />
            </div>
          ))}
        </section>

        {/* Actions */}
        <section className="grid grid-cols-2 gap-3 pt-2">
          <button onClick={() => handleSave(false)} disabled={saving}
            className="bg-arc-surface border border-white/[0.06] text-white font-bold py-4 rounded-xl disabled:opacity-50">
            Save Draft
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="bg-accent-gradient text-white font-black italic tracking-wider py-4 rounded-xl shadow-glow-accent disabled:opacity-50">
            {saving ? 'SAVING…' : 'PUBLISH'}
          </button>
        </section>
      </main>

      <Nav />
    </div>
  )
}
