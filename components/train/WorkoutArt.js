import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

// ─── Canvas Renderer ─────────────────────────────────
function renderWorkoutArt(canvas, workoutData, style) {
  const ctx = canvas.getContext('2d')
  const W = 1080
  const H = 1080
  canvas.width = W
  canvas.height = H

  const { exercises, totalPoints, totalSets, date, username, isPB, duration } = workoutData

  const styles = {
    dark: {
      bg: '#050505',
      card: '#121214',
      accent: '#FF3B00',
      text: '#FFFFFF',
      muted: '#71717A',
      surface: '#1E1E22',
    },
    fire: {
      bg: '#0A0000',
      card: '#1A0505',
      accent: '#FF6B35',
      text: '#FFFFFF',
      muted: '#8B6B5A',
      surface: '#1F0E0A',
    },
    ice: {
      bg: '#000510',
      card: '#050E1A',
      accent: '#00B4D8',
      text: '#FFFFFF',
      muted: '#5A7B8B',
      surface: '#0A1520',
    },
  }

  const s = styles[style] || styles.dark

  // ─── Background ────
  ctx.fillStyle = s.bg
  ctx.fillRect(0, 0, W, H)

  // Gradient overlay
  const grad = ctx.createRadialGradient(W / 2, 200, 0, W / 2, 200, 600)
  grad.addColorStop(0, s.accent + '15')
  grad.addColorStop(1, 'transparent')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Grid pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.02)'
  ctx.lineWidth = 1
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  // ─── Top Bar ────
  ctx.fillStyle = s.card
  roundRect(ctx, 40, 40, W - 80, 70, 16)
  ctx.fill()

  ctx.font = '700 italic 24px Inter, sans-serif'
  ctx.fillStyle = s.accent
  ctx.textAlign = 'left'
  ctx.fillText('ARCTIVATE', 70, 85)

  ctx.font = '600 18px Inter, sans-serif'
  ctx.fillStyle = s.muted
  ctx.textAlign = 'right'
  ctx.fillText(formatArtDate(date), W - 70, 85)

  // ─── Main Stats ────
  const statsY = 160
  ctx.fillStyle = s.card
  roundRect(ctx, 40, statsY, W - 80, 180, 24)
  ctx.fill()

  // Accent glow
  const glowGrad = ctx.createLinearGradient(40, statsY, W - 40, statsY)
  glowGrad.addColorStop(0, s.accent + '10')
  glowGrad.addColorStop(0.5, s.accent + '20')
  glowGrad.addColorStop(1, s.accent + '10')
  ctx.fillStyle = glowGrad
  roundRect(ctx, 40, statsY, W - 80, 180, 24)
  ctx.fill()

  // Points
  ctx.textAlign = 'center'
  ctx.font = '900 64px "JetBrains Mono", monospace'
  ctx.fillStyle = s.accent
  ctx.fillText(`+${totalPoints}`, W / 2, statsY + 80)

  ctx.font = '800 14px Inter, sans-serif'
  ctx.fillStyle = s.muted
  ctx.letterSpacing = '4px'
  ctx.fillText('POINTS EARNED', W / 2, statsY + 115)

  // Sub-stats row
  const subY = statsY + 145
  ctx.font = '700 20px "JetBrains Mono", monospace'
  ctx.fillStyle = s.text

  const subStats = [
    { label: 'EXERCISES', value: exercises.length.toString() },
    { label: 'SETS', value: totalSets.toString() },
  ]
  if (duration) subStats.push({ label: 'DURATION', value: duration })

  const subW = (W - 120) / subStats.length
  subStats.forEach((stat, i) => {
    const x = 60 + subW * i + subW / 2
    ctx.textAlign = 'center'
    ctx.font = '700 22px "JetBrains Mono", monospace'
    ctx.fillStyle = s.text
    ctx.fillText(stat.value, x, subY)
    ctx.font = '700 10px Inter, sans-serif'
    ctx.fillStyle = s.muted
    ctx.fillText(stat.label, x, subY + 18)
  })

  // ─── Exercise List ────
  const listY = 380
  const maxExercises = Math.min(exercises.length, 6)
  const rowHeight = 80
  const listHeight = maxExercises * rowHeight + 40

  ctx.fillStyle = s.card
  roundRect(ctx, 40, listY, W - 80, listHeight, 24)
  ctx.fill()

  ctx.textAlign = 'left'
  ctx.font = '800 12px Inter, sans-serif'
  ctx.fillStyle = s.muted
  ctx.fillText('MOVEMENTS', 80, listY + 30)

  exercises.slice(0, maxExercises).forEach((ex, i) => {
    const y = listY + 55 + i * rowHeight

    // Separator
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(80, y - 15)
      ctx.lineTo(W - 80, y - 15)
      ctx.stroke()
    }

    // Exercise name
    ctx.font = '700 22px Inter, sans-serif'
    ctx.fillStyle = s.text
    ctx.textAlign = 'left'
    ctx.fillText(truncateText(ctx, ex.name, 500), 80, y + 10)

    // PB badge
    if (ex.isPB) {
      const nameWidth = ctx.measureText(truncateText(ctx, ex.name, 500)).width
      ctx.fillStyle = s.accent
      roundRect(ctx, 90 + nameWidth, y - 5, 60, 22, 4)
      ctx.fill()
      ctx.font = '900 10px Inter, sans-serif'
      ctx.fillStyle = '#000'
      ctx.fillText('NEW PB', 95 + nameWidth, y + 10)
    }

    // Stats
    ctx.textAlign = 'right'
    ctx.font = '700 22px "JetBrains Mono", monospace'
    ctx.fillStyle = s.accent
    const unit = ex.metricType === 'time' ? 'min' : 'kg'
    ctx.fillText(`${ex.value}${unit}`, W - 80, y + 10)

    // Reps/Sets
    if (ex.reps || ex.sets) {
      ctx.font = '600 14px Inter, sans-serif'
      ctx.fillStyle = s.muted
      const details = [ex.sets && `${ex.sets}s`, ex.reps && `${ex.reps}r`, ex.rpe && `RPE ${ex.rpe}`].filter(Boolean).join(' / ')
      ctx.fillText(details, W - 80, y + 32)
    }
  })

  if (exercises.length > maxExercises) {
    ctx.textAlign = 'center'
    ctx.font = '600 14px Inter, sans-serif'
    ctx.fillStyle = s.muted
    ctx.fillText(`+${exercises.length - maxExercises} more exercises`, W / 2, listY + listHeight - 10)
  }

  // ─── PB Banner ────
  if (isPB) {
    const bannerY = listY + listHeight + 20
    ctx.fillStyle = s.accent + '15'
    roundRect(ctx, 40, bannerY, W - 80, 60, 16)
    ctx.fill()
    ctx.strokeStyle = s.accent + '40'
    ctx.lineWidth = 1
    roundRect(ctx, 40, bannerY, W - 80, 60, 16)
    ctx.stroke()

    ctx.textAlign = 'center'
    ctx.font = '900 italic 20px Inter, sans-serif'
    ctx.fillStyle = s.accent
    ctx.fillText('PERSONAL BEST ACHIEVED', W / 2, bannerY + 38)
  }

  // ─── Username/Footer ────
  const footerY = H - 80
  ctx.fillStyle = s.surface + '80'
  roundRect(ctx, 40, footerY, W - 80, 50, 12)
  ctx.fill()

  if (username) {
    ctx.textAlign = 'left'
    ctx.font = '700 16px Inter, sans-serif'
    ctx.fillStyle = s.text
    ctx.fillText(`@${username}`, 70, footerY + 32)
  }

  ctx.textAlign = 'right'
  ctx.font = '600 14px Inter, sans-serif'
  ctx.fillStyle = s.muted
  ctx.fillText('arctivate.app', W - 70, footerY + 32)

  // ─── Corner Accent ────
  ctx.fillStyle = s.accent + '08'
  ctx.beginPath()
  ctx.moveTo(W, 0)
  ctx.lineTo(W, 300)
  ctx.lineTo(W - 300, 0)
  ctx.closePath()
  ctx.fill()
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (ctx.measureText(t + '...').width > maxWidth && t.length > 0) {
    t = t.slice(0, -1)
  }
  return t + '...'
}

function formatArtDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// ─── Main Component ──────────────────────────────────
export default function WorkoutArt({ workoutData, onClose }) {
  const canvasRef = useRef(null)
  const [selectedStyle, setSelectedStyle] = useState('dark')
  const [isRendered, setIsRendered] = useState(false)

  const styleOptions = [
    { key: 'dark', label: 'DARK', color: '#FF3B00' },
    { key: 'fire', label: 'FIRE', color: '#FF6B35' },
    { key: 'ice', label: 'ICE', color: '#00B4D8' },
  ]

  useEffect(() => {
    if (canvasRef.current && workoutData) {
      renderWorkoutArt(canvasRef.current, workoutData, selectedStyle)
      setIsRendered(true)
    }
  }, [workoutData, selectedStyle])

  const downloadImage = () => {
    if (!canvasRef.current) return
    const link = document.createElement('a')
    link.download = `arctivate-workout-${Date.now()}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  const shareImage = async () => {
    if (!canvasRef.current) return

    try {
      const blob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/png'))
      const file = new File([blob], 'arctivate-workout.png', { type: 'image/png' })

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Arctivate Workout',
          text: 'Check out my workout session!'
        })
      } else {
        // Fallback: download
        downloadImage()
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        downloadImage()
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
      />

      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-sm bg-arc-card border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-arc-muted hover:text-white transition-colors"
        >
          <CloseIcon />
        </button>

        {/* Header */}
        <div className="p-5 pb-3">
          <h2 className="text-lg font-black italic tracking-tight text-center">SHARE YOUR SESSION</h2>
          <p className="text-[10px] text-arc-muted text-center mt-1 uppercase tracking-widest">Export for social media</p>
        </div>

        {/* Canvas Preview */}
        <div className="px-4 pb-3">
          <div className="relative rounded-2xl overflow-hidden border border-white/10">
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
              style={{ aspectRatio: '1/1' }}
            />
            {!isRendered && (
              <div className="absolute inset-0 flex items-center justify-center bg-arc-bg">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-6 h-6 border-2 border-arc-accent/30 border-t-arc-accent rounded-full"
                />
              </div>
            )}
          </div>
        </div>

        {/* Style Picker */}
        <div className="px-4 pb-3">
          <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Style</span>
          <div className="flex gap-2">
            {styleOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSelectedStyle(opt.key)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  selectedStyle === opt.key
                    ? 'border-2 text-white'
                    : 'bg-arc-surface text-arc-muted border border-white/5'
                }`}
                style={selectedStyle === opt.key ? { borderColor: opt.color, backgroundColor: opt.color + '15', color: opt.color } : {}}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 pt-2 space-y-2">
          <button
            onClick={shareImage}
            className="w-full flex items-center justify-center gap-2 bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow hover:bg-[#ff5522] transition-all"
          >
            <ShareIcon /> Share to Instagram
          </button>
          <button
            onClick={downloadImage}
            className="w-full flex items-center justify-center gap-2 bg-arc-surface text-white font-bold py-3 rounded-xl border border-white/5 hover:border-white/10 transition-all"
          >
            <DownloadIcon /> Save Image
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
