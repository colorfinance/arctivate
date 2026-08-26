import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Avatar from '../Avatar'
import FollowButton from '../FollowButton'
import { summariseLogs, sessionStats, sessionDuration, unitFor } from '../../lib/sessions'

// A gym session as other people see it: what you did, what was a PB, and two
// ways to say something about it. The old feed card showed a single exercise
// with a points total, which is a receipt rather than a workout.

const timeAgo = (iso) => {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const fmtValue = (n) => {
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  return Number.isInteger(num) ? String(num) : num.toFixed(1)
}

export default function SessionCard({
  session,
  currentUserId,
  hasKudos,
  onKudos,
  onComment,
  onDelete,
  comments = [],
  onLoadComments,
  isFollowing,
  onToggleFollow,
}) {
  const [showComments, setShowComments] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const isMine = session.user_id === currentUserId
  const exercises = summariseLogs(session.logs || [])
  const stats = sessionStats(session.logs || [])
  const mins = sessionDuration(session)
  const name = session.profiles?.username || 'Member'

  const openComments = async () => {
    const next = !showComments
    setShowComments(next)
    if (next && onLoadComments) await onLoadComments(session.id)
  }

  const send = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    const ok = await onComment(session.id, body)
    if (ok) setDraft('')
    setSending(false)
  }

  return (
    <div className="bg-arc-card border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-3">
        <Avatar src={session.profiles?.avatar_url} name={name} size={38} />
        <div className="flex-1 min-w-0">
          <span className="block font-bold text-sm text-white truncate">{name}</span>
          <span className="block text-[11px] text-arc-muted">
            {timeAgo(session.started_at)}
            {mins ? ` · ${mins} min` : ''}
            {session.visibility === 'private' ? ' · Private' : ''}
          </span>
        </div>
        {stats.pbs > 0 && (
          <span className="shrink-0 flex items-center gap-1 text-[10px] bg-arc-accent/20 text-arc-accent px-2.5 py-1 rounded-full font-black">
            {stats.pbs} PB{stats.pbs > 1 ? 's' : ''}
          </span>
        )}
        {/* Following someone from the workout that made you want to is the
            whole point -- it is a worse feature behind a search box. */}
        {onToggleFollow && (
          <FollowButton
            targetId={session.user_id}
            currentUserId={currentUserId}
            isFollowing={isFollowing}
            onToggle={onToggleFollow}
          />
        )}
      </div>

      <div className="px-4 pb-3">
        <h3 className="text-lg font-black italic tracking-tighter text-white leading-tight">
          {session.title || 'Session'}
        </h3>
        {session.notes && (
          <p className="text-[12px] text-arc-muted leading-snug mt-1">{session.notes}</p>
        )}
      </div>

      {exercises.length > 0 && (
        <div className="px-4 pb-3 space-y-1.5">
          {exercises.slice(0, 6).map((e) => (
            <div key={e.name} className="flex items-center gap-2 text-[13px]">
              <span className={`flex-1 min-w-0 truncate font-bold ${e.isPB ? 'text-arc-accent' : 'text-white'}`}>
                {e.name}
              </span>
              <span className="shrink-0 text-arc-muted font-mono text-[12px]">
                {e.sets > 1 ? `${e.sets}×` : ''}{e.reps ? `${e.reps} ` : ''}
                {fmtValue(e.best)}{unitFor(e.metricType)}
              </span>
              {e.isPB && <span className="shrink-0 text-[9px] font-black text-arc-accent">PB</span>}
            </div>
          ))}
          {exercises.length > 6 && (
            <p className="text-[11px] text-arc-muted pt-0.5">+{exercises.length - 6} more</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-px bg-white/[0.04] border-y border-white/[0.04]">
        {[
          { label: stats.exercises === 1 ? 'Exercise' : 'Exercises', value: stats.exercises },
          { label: stats.sets === 1 ? 'Set' : 'Sets', value: stats.sets },
          // Volume is only meaningful for weight, so a time or distance session
          // shows a dash rather than a number that would be nonsense.
          { label: 'Volume', value: stats.volume > 0 ? `${Math.round(stats.volume).toLocaleString()}kg` : '—' },
        ].map((s) => (
          <div key={s.label} className="bg-arc-card py-2.5 text-center">
            <span className="block text-sm font-black font-mono text-white">{s.value}</span>
            <span className="block text-[9px] font-bold text-arc-muted uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onKudos(session.id, hasKudos)}
            disabled={isMine}
            aria-label={hasKudos ? 'Take back your kudos' : 'Give kudos'}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
              hasKudos ? 'bg-arc-accent/20 text-arc-accent' : 'bg-arc-surface text-arc-muted hover:text-white'
            } ${isMine ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={hasKudos ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            <span className="font-bold text-sm">{session.kudos_count || 0}</span>
          </button>

          <button
            onClick={openComments}
            aria-label="Comments"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-arc-surface text-arc-muted hover:text-white transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="font-bold text-sm">{session.comments_count || 0}</span>
          </button>
        </div>

        {isMine && onDelete && (
          <button
            onClick={() => onDelete(session.id)}
            className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-[10px] font-bold"
          >
            Delete
          </button>
        )}
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/[0.04]"
          >
            <div className="p-4 space-y-3">
              {comments.length === 0 ? (
                <p className="text-[12px] text-arc-muted text-center py-1">No comments yet. Say something.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <Avatar src={c.profiles?.avatar_url} name={c.profiles?.username} size={26} />
                    <div className="min-w-0 flex-1">
                      <span className="text-[12px] font-bold text-white">{c.profiles?.username || 'Member'}</span>
                      <span className="text-[10px] text-arc-muted ml-2">{timeAgo(c.created_at)}</span>
                      <p className="text-[13px] text-arc-muted leading-snug break-words">{c.body}</p>
                    </div>
                  </div>
                ))
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') send() }}
                  placeholder="Add a comment"
                  maxLength={500}
                  className="flex-1 bg-arc-surface border border-white/10 px-3 py-2.5 rounded-xl text-white outline-none focus:border-arc-accent transition-colors text-[13px]"
                />
                <button
                  onClick={send}
                  disabled={!draft.trim() || sending}
                  className="shrink-0 px-4 py-2.5 rounded-xl bg-arc-accent text-white text-[12px] font-bold disabled:opacity-40 transition-opacity"
                >
                  {sending ? '…' : 'Post'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
