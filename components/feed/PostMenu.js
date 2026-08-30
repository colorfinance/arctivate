import { useState, useEffect, useRef } from 'react'

// Report and Block, one tap away instead of two permanent buttons.
//
// They used to sit in the action bar of every post in the feed, the same size
// as the high five, so every workout came with two ways to complain about it.
// Moderation has to stay reachable -- app stores require it and members need
// it -- but it is not what a feed is for.

export default function PostMenu({ onReport, onBlock, label = 'More options' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Tapping anywhere else closes it, including on another post's menu.
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  const choose = (fn) => { setOpen(false); fn?.() }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={label}
        aria-expanded={open}
        className="px-3 py-2 rounded-lg text-arc-muted hover:text-white transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-20 w-36 rounded-xl bg-arc-card border border-white/10 shadow-2xl overflow-hidden">
          <button
            onClick={() => choose(onReport)}
            className="w-full text-left px-3.5 py-2.5 text-[12px] font-bold text-arc-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            Report
          </button>
          <button
            onClick={() => choose(onBlock)}
            className="w-full text-left px-3.5 py-2.5 text-[12px] font-bold text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/[0.06]"
          >
            Block
          </button>
        </div>
      )}
    </div>
  )
}
