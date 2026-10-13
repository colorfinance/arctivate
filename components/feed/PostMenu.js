import { useState, useEffect, useRef } from 'react'

// The ⋯ on a card. Your own post gets Delete; anyone else's gets Report and
// Block. Moderation has to stay reachable (app stores require it and members
// need it), but it is not what a feed is for, so it lives behind one tap.

export default function PostMenu({ onReport, onBlock, onDelete, label = 'More options' }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const ref = useRef(null)

  // Tapping anywhere else closes it, including on another post's menu.
  useEffect(() => {
    if (!open) { setConfirming(false); return }
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [open])

  const choose = (fn) => { setOpen(false); fn?.() }
  const item = 'w-full text-left px-3.5 py-3 text-[13px] font-bold transition-colors'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={label}
        aria-expanded={open}
        className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-arc-muted hover:text-white transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-control bg-arc-card border border-white/10 shadow-2xl overflow-hidden">
          {onDelete ? (
            confirming ? (
              <button onClick={() => choose(onDelete)} className={`${item} text-arc-danger hover:bg-arc-danger/10`}>Yes, delete it</button>
            ) : (
              <button onClick={() => setConfirming(true)} className={`${item} text-arc-danger hover:bg-arc-danger/10`}>Delete</button>
            )
          ) : (
            <>
              <button onClick={() => choose(onReport)} className={`${item} text-arc-muted hover:text-white hover:bg-white/5`}>Report</button>
              <button onClick={() => choose(onBlock)} className={`${item} text-arc-danger hover:bg-arc-danger/10 border-t border-white/[0.06]`}>Block</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
