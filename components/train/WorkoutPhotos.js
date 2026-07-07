import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'

const BUCKET = 'workout-photos'
const SIGNED_TTL = 60 * 60 // 1 hour

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

const CameraIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

const LockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

export default function WorkoutPhotos({ onToast }) {
  const fileRef = useRef(null)
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true) // table/bucket present
  const [uploading, setUploading] = useState(false)
  const [viewer, setViewer] = useState(null)

  const toast = (m) => onToast && onToast(m)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data, error } = await supabase
        .from('workout_photos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(60)

      // Table not created yet (migration not applied) — hide the section.
      if (error) { setAvailable(false); setLoading(false); return }

      const rows = data || []
      const withUrls = await signRows(rows)
      setPhotos(withUrls)
    } catch {
      setAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  async function signRows(rows) {
    if (!rows.length) return []
    const paths = rows.map((r) => r.storage_path)
    const urlByPath = {}
    try {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL)
      ;(signed || []).forEach((s, i) => { if (s?.signedUrl) urlByPath[paths[i]] = s.signedUrl })
    } catch {}
    return rows.map((r) => ({ ...r, url: urlByPath[r.storage_path] || null }))
  }

  const pick = () => fileRef.current?.click()

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast('Please log in'); return }

      const blob = await resizeToBlob(file)
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (upErr) {
        setAvailable(true)
        toast('Upload failed — is the workout-photos bucket set up?')
        return
      }

      const { data: row, error: insErr } = await supabase
        .from('workout_photos')
        .insert({ user_id: user.id, storage_path: path })
        .select('*')
        .single()
      if (insErr) { toast('Saved the image but could not record it'); return }

      let url = null
      try {
        const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL)
        url = signed?.signedUrl || null
      } catch {}

      setPhotos((prev) => [{ ...row, url }, ...prev])
      toast('Photo added — only you can see it')
    } catch {
      toast('Could not add photo')
    } finally {
      setUploading(false)
    }
  }

  const remove = async (photo) => {
    try {
      await supabase.storage.from(BUCKET).remove([photo.storage_path])
      await supabase.from('workout_photos').delete().eq('id', photo.id)
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
      setViewer(null)
      toast('Photo deleted')
    } catch {
      toast('Delete failed')
    }
  }

  // Hide entirely until the migration is applied.
  if (!available) return null
  if (loading) return null

  return (
    <section className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-[9px] font-bold text-arc-muted uppercase tracking-[0.2em] flex items-center gap-1.5">
          My Workout Photos
          <span className="flex items-center gap-0.5 text-arc-cyan normal-case tracking-normal font-medium"><LockIcon /> Private</span>
        </h3>
        <button
          onClick={pick}
          disabled={uploading}
          className="text-[9px] font-bold text-arc-accent uppercase tracking-[0.15em] hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : <><CameraIcon /> Add Photo</>}
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />

      {photos.length === 0 ? (
        <button
          onClick={pick}
          disabled={uploading}
          className="w-full border border-dashed border-white/[0.12] rounded-2xl py-8 flex flex-col items-center justify-center gap-2 text-arc-muted hover:border-arc-accent/40 hover:text-white transition-colors"
        >
          <CameraIcon />
          <span className="text-xs font-bold">Snap a photo of your workout</span>
          <span className="text-[10px] text-arc-muted">Only you will see it</span>
        </button>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button
              key={p.id}
              onClick={() => setViewer(p)}
              className="relative aspect-square rounded-xl overflow-hidden bg-arc-surface border border-white/[0.05] group"
            >
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={p.caption || 'Workout photo'} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-arc-muted text-[9px]">image</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen viewer */}
      <AnimatePresence>
        {viewer && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setViewer(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[60] flex flex-col items-center justify-center p-5 pointer-events-none"
            >
              <div className="pointer-events-auto max-w-md w-full space-y-4">
                {viewer.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={viewer.url} alt={viewer.caption || 'Workout photo'} className="w-full rounded-2xl border border-white/10" />
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-arc-muted font-mono">
                    {new Date(viewer.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => remove(viewer)} className="text-xs font-bold px-4 py-2.5 rounded-xl bg-arc-surface border border-white/[0.06] text-red-400 hover:bg-red-500/10 transition-colors">
                      Delete
                    </button>
                    <button onClick={() => setViewer(null)} className="text-xs font-bold px-4 py-2.5 rounded-xl bg-accent-gradient text-white shadow-glow-accent">
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  )
}
