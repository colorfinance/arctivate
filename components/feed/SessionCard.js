import Avatar from '../Avatar'
import PostMenu from './PostMenu'
import { summariseLogs, sessionStats, unitFor } from '../../lib/sessions'

// A workout as the gym sees it: who, when, what they did, and what was a PB.

export const timeAgo = (iso) => {
  const secs = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

const fmtValue = (n) => {
  const num = Number(n)
  if (!Number.isFinite(num)) return '—'
  return Number.isInteger(num) ? String(num) : num.toFixed(1)
}

export default function SessionCard({ session, currentUserId, photos = [], onDelete, onReport, onBlock }) {
  const isMine = session.user_id === currentUserId
  const exercises = summariseLogs(session.logs || [])
  const stats = sessionStats(session.logs || [])
  const name = session.profiles?.username || 'Member'

  return (
    <article className="bg-arc-card border border-white/[0.06] rounded-container overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-2">
        <Avatar src={session.profiles?.avatar_url} name={name} size={38} />
        <div className="flex-1 min-w-0">
          <span className="block font-bold text-sm text-white truncate">{name}</span>
          <span className="block t-caption text-arc-muted">{timeAgo(session.started_at)} · trained</span>
        </div>
        {stats.pbs > 0 && (
          <span className="shrink-0 t-caption font-black bg-arc-accent/20 text-arc-accent px-2.5 py-1 rounded-full">
            {stats.pbs} PB{stats.pbs > 1 ? 's' : ''}
          </span>
        )}
        <PostMenu
          onDelete={isMine ? () => onDelete?.(session.id) : undefined}
          onReport={isMine ? undefined : () => onReport?.(session.id)}
          onBlock={isMine ? undefined : () => onBlock?.(session.user_id)}
        />
      </div>

      <div className="px-4 pb-4">
        <h3 className="t-title text-white leading-tight">{session.title || 'Workout'}</h3>
        {exercises.length > 0 && (
          <div className="mt-2 space-y-1">
            {exercises.slice(0, 5).map((e) => (
              <div key={e.name} className="flex items-center gap-2 text-[13px]">
                <span className={`flex-1 min-w-0 truncate font-bold ${e.isPB ? 'text-arc-accent' : 'text-white'}`}>{e.name}</span>
                <span className="shrink-0 text-arc-muted t-num text-[12px]">
                  {e.sets > 1 ? `${e.sets}×` : ''}{e.reps ? `${e.reps} ` : ''}{fmtValue(e.best)}{unitFor(e.metricType)}
                </span>
              </div>
            ))}
            {exercises.length > 5 && <p className="t-caption text-arc-muted">+{exercises.length - 5} more</p>}
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <div className={`px-4 pb-4 ${photos.length > 1 ? 'flex gap-2 overflow-x-auto scrollbar-hide' : ''}`}>
          {photos.map((url, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={url}
              src={url}
              alt={i === 0 ? `${name}'s workout` : ''}
              loading="lazy"
              className={`rounded-control object-cover ${photos.length > 1 ? 'h-44 w-auto shrink-0' : 'w-full max-h-80'}`}
            />
          ))}
        </div>
      )}
    </article>
  )
}
