import { useState } from 'react'

// One tap, no request, no waiting for someone to accept.
export default function FollowButton({
  targetId,
  currentUserId,
  isFollowing,
  onToggle,
  size = 'sm',
}) {
  const [busy, setBusy] = useState(false)
  if (!targetId || !currentUserId || targetId === currentUserId) return null

  const click = async (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try { await onToggle(targetId, isFollowing) } finally { setBusy(false) }
  }

  const pad = size === 'lg' ? 'px-5 py-2.5 text-[13px]' : 'px-3 py-1.5 text-[11px]'

  return (
    <button
      onClick={click}
      disabled={busy}
      aria-pressed={isFollowing}
      aria-label={isFollowing ? 'Unfollow' : 'Follow'}
      className={`shrink-0 rounded-full font-bold transition-all disabled:opacity-50 ${pad} ${
        isFollowing
          ? 'bg-arc-surface text-arc-muted border border-white/10 hover:text-white'
          : 'bg-arc-accent text-white'
      }`}
    >
      {busy ? '…' : isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}
