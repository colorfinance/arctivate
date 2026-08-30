import { streakMessage } from '../lib/streaks'

// The reason to open the app tomorrow.
//
// A streak is only motivating at the moment it is at risk. "5 days in a row"
// is a statistic; "5 days in a row, and today decides whether it survives" is
// a reason to tick something. So the banner changes with the state rather than
// printing the same number in the same colour every day.
//
// It stays quiet once the day is banked -- having already done the thing is
// not a moment that needs shouting at.

const TONES = {
  'at-risk': {
    box: 'bg-amber-500/[0.08] border-amber-500/30',
    figure: 'text-amber-400',
    detail: 'text-amber-200/90',
  },
  safe: {
    box: 'bg-green-500/[0.07] border-green-500/25',
    figure: 'text-green-400',
    detail: 'text-green-300/80',
  },
  restart: {
    box: 'bg-arc-card border-white/[0.06]',
    figure: 'text-white',
    detail: 'text-arc-muted',
  },
  new: {
    box: 'bg-arc-card border-white/[0.06]',
    figure: 'text-white',
    detail: 'text-arc-muted',
  },
}

export default function StreakBanner({ streak, className = '' }) {
  const info = streak || { current: 0, longest: 0, activeToday: false }
  const { tone, headline, detail } = streakMessage(info)
  const style = TONES[tone] || TONES.new
  const showFlame = info.current > 0

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${style.box} ${className}`}>
      <span className={`shrink-0 text-2xl leading-none ${showFlame ? '' : 'opacity-30 grayscale'}`} aria-hidden>
        🔥
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-black italic tracking-tight ${style.figure}`}>{headline}</p>
        <p className={`text-[11px] leading-snug ${style.detail}`}>{detail}</p>
      </div>
      {/* Your own best, once there is one worth beating. */}
      {info.longest > 0 && info.current < info.longest && (
        <div className="shrink-0 text-right">
          <span className="block text-[13px] font-black font-mono text-white leading-none">{info.longest}</span>
          <span className="block text-[8px] font-bold text-arc-muted uppercase tracking-wider mt-0.5">Best</span>
        </div>
      )}
    </div>
  )
}
