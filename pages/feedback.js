import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/router'
import Nav from '../components/Nav'
import LoadingState from '../components/LoadingState'
import { supabase } from '../lib/supabaseClient'

const IMG_BUCKET = 'feedback-images'

// Resize an image File to a JPEG blob to keep uploads small.
function resizeToBlob(file, maxWidth = 1400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to load image'))
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          let { width, height } = img
          if (width > height) {
            if (width > maxWidth) { height *= maxWidth / width; width = maxWidth }
          } else {
            if (height > maxWidth) { width *= maxWidth / height; height = maxWidth }
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Canvas not supported'))
          ctx.drawImage(img, 0, 0, width, height)
          canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Failed to process image'))), 'image/jpeg', 0.85)
        } catch (err) {
          reject(err)
        }
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

const CATEGORIES = [
  { value: 'general', label: '💬 General' },
  { value: 'bug', label: '🐞 Bug' },
  { value: 'feature', label: '💡 Idea' },
  { value: 'praise', label: '❤️ Praise' },
]

const STATUS_LABEL = { new: 'Received', reviewed: 'Reviewed', resolved: 'Resolved' }

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

export default function Feedback() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const [category, setCategory] = useState('general')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [mine, setMine] = useState([])
  const fileRef = useRef(null)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  const showToast = (m) => setToast(m)

  const onPickImage = (e) => {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  const clearImage = () => { setImageFile(null); setImagePreview(null) }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      await loadMine(user.id)
      setIsLoading(false)
    }
    init()
  }, [])

  async function loadMine(userId) {
    const { data } = await supabase
      .from('feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setMine(data)
  }

  const submit = async () => {
    if (sending) return
    if (!message.trim()) { showToast('Please write a message first'); return }
    setSending(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('Please log in'); setSending(false); return }

      // Upload the screenshot first (best-effort — text still sends if it fails).
      let imageUrl = null
      if (imageFile) {
        try {
          const blob = await resizeToBlob(imageFile)
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
          const { error: upErr } = await supabase.storage
            .from(IMG_BUCKET)
            .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
          if (upErr) {
            showToast('Screenshot could not be attached — sending text only')
          } else {
            const { data: urlData } = supabase.storage.from(IMG_BUCKET).getPublicUrl(path)
            imageUrl = urlData?.publicUrl || null
          }
        } catch {
          showToast('Screenshot could not be attached — sending text only')
        }
      }

      const payload = { user_id: user.id, category, message: message.trim() }
      if (imageUrl) payload.image_url = imageUrl

      let { data, error } = await supabase.from('feedback').insert(payload).select('*').single()

      // If the image_url column doesn't exist yet, retry without it.
      if (error && error.message && error.message.includes('image_url')) {
        delete payload.image_url
        const retry = await supabase.from('feedback').insert(payload).select('*').single()
        data = retry.data
        error = retry.error
      }
      if (error) throw error

      setMine((prev) => [data, ...prev])
      setMessage('')
      setCategory('general')
      clearImage()
      showToast('Thanks! Your feedback was sent 🙌')
    } catch (err) {
      console.error('[Arctivate] feedback submit failed:', err)
      showToast(`Couldn't send: ${err.message || 'unknown error'}`)
    } finally {
      setSending(false)
    }
  }

  if (isLoading) return <LoadingState label="Loading…" />

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-28 font-sans">
      <AnimatePresence>{toast && <Toast message={toast} onClose={() => setToast(null)} />}</AnimatePresence>

      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="p-5 flex justify-between items-center max-w-lg mx-auto">
          <div>
            <h1 className="text-xl font-black italic tracking-tighter text-gradient-accent">ARCTIVATE</h1>
            <span className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em]">Feedback</span>
          </div>
          <button onClick={() => router.back()} className="text-[10px] font-bold text-arc-accent uppercase tracking-[0.15em] hover:text-white transition-colors">
            ← Back
          </button>
        </div>
      </header>

      <main className="pt-24 px-5 space-y-6 max-w-lg mx-auto">
        {/* Form */}
        <section className="relative">
          <div className="absolute -inset-[1px] bg-gradient-to-b from-arc-accent/20 via-arc-cyan/10 to-transparent rounded-[2rem] blur-sm opacity-60" />
          <div className="relative bg-arc-card border border-white/[0.06] rounded-[2rem] shadow-card overflow-hidden">
            <div className="h-[2px] bg-accent-gradient-r" />
            <div className="p-6 space-y-4">
              <div>
                <h2 className="font-black italic tracking-tight text-lg">Tell us what you think</h2>
                <p className="text-[11px] text-arc-muted mt-1">Found a bug, got an idea, or just want to say hi? We read every message.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      category === c.value
                        ? 'bg-accent-gradient text-white border-transparent shadow-glow-accent'
                        : 'bg-arc-surface text-arc-muted border-white/[0.06] hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your feedback…"
                rows={5}
                maxLength={2000}
                className="w-full bg-arc-surface border border-white/[0.06] text-white p-4 rounded-xl outline-none focus:border-arc-accent/40 resize-none text-sm placeholder-white/20"
              />

              {/* Screenshot attachment */}
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} className="hidden" />
              {imagePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-white/[0.06]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Screenshot preview" className="w-full max-h-56 object-contain bg-black/30" />
                  <button
                    onClick={clearImage}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
                    aria-label="Remove screenshot"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border border-dashed border-white/[0.12] rounded-xl py-3 flex items-center justify-center gap-2 text-arc-muted hover:border-arc-accent/40 hover:text-white transition-colors text-sm font-bold"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Attach a screenshot
                </button>
              )}

              <button
                onClick={submit}
                disabled={sending || !message.trim()}
                className="w-full bg-accent-gradient text-white font-black italic tracking-wider py-4 rounded-xl shadow-glow-accent disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                    <span>SENDING…</span>
                  </>
                ) : 'SEND FEEDBACK'}
              </button>
            </div>
          </div>
        </section>

        {/* My submissions */}
        {mine.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] px-1">Your feedback</h3>
            <div className="space-y-2">
              {mine.map((f) => {
                const cat = CATEGORIES.find((c) => c.value === f.category)
                return (
                  <div key={f.id} className="bg-arc-card/60 border border-white/[0.04] p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-arc-muted uppercase tracking-wider">{cat ? cat.label : f.category}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        f.status === 'resolved' ? 'bg-emerald-500/15 text-emerald-400'
                          : f.status === 'reviewed' ? 'bg-arc-cyan/15 text-arc-cyan'
                          : 'bg-white/5 text-arc-muted'
                      }`}>
                        {STATUS_LABEL[f.status] || f.status}
                      </span>
                    </div>
                    <p className="text-sm text-white/90 whitespace-pre-wrap break-words">{f.message}</p>
                    {f.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.image_url} alt="Attached screenshot" className="mt-2 w-full max-h-48 object-contain rounded-lg border border-white/[0.06] bg-black/20" />
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>

      <Nav />
    </div>
  )
}
