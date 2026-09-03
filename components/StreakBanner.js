import { streakMessage } from '../lib/streaks'

// The hero of Today.
//
// A streak is only motivating at the moment it is at risk. "5 days in a row"
// is a statistic; "5 days in a row, and today decides whether it survives" is
// a reason to tick something. So this changes with the state rather than
// printing the same number in the same colour every day, and it is the one
// place on the screen the display face is used.
//
// It goes quiet once the day is banked -- having already done the thing is not
// a moment that needs shouting at.

const TONES = {
  'at-risk': { ring: 'border-arc-warning/40', figure: 'text-arc-warning', wash: 'from-arc-warning/[0.12]' },
  safe:      { ring: 'border-arc-success/35', figure: 'text-arc-success', wash: 'from-arc-success/[0.10]' },
  restart:   { ring: 'border-white/[0.08]',  figure: 'text-white',       wash: 'from-white/[0.03]' },
  new:       { ring: 'border-white/[0.08]',  figure: 'text-white',       wash: 'from-arc-accent/[0.06]' },
}

export default function StreakBanner({ streak, className = '' }) {
  const info = streak || { current: 0, longest: 0, activeToday: false }
  const { tone, headline, detail } = streakMessage(info)
  const t = TONES[tone] || TONES.new
  const live = info.current > 0

  return (
    <section
      aria-label="Your streak"
      className={`relative overflow-hidden rounded-container border ${t.ring} bg-gradient-to-br ${t.wash} to-transparent px-5 py-5 ${className}`}
    >
      <div className="flex items-center gap-4">
        <span className={`shrink-0 text-[40px] leading-none ${live ? '' : 'opacity-25 grayscale'}`} aria-hidden>🔥</span>
        <div className="min-w-0 flex-1">
          {live ? (
            <p className={`t-display ${t.figure}`} style={{ fontSize: 34 }}>
              {info.current}<span className="text-[18px] not-italic font-black tracking-normal ml-1.5 align-middle opacity-90">
                {info.current === 1 ? 'day' : 'days'}
              </span>
            </p>
          ) : (
            <p className={`t-title ${t.figure}`} style={{ fontSize: 20 }}>{headline}</p>
          )}
          <p className={`t-body mt-1 ${tone === 'at-risk' ? 'text-arc-warning/90' : tone === 'safe' ? 'text-arc-success/85' : 'text-arc-muted'}`}>
            {detail}
          </p>
        </div>
        {info.longest > 0 && info.current < info.longest && (
          <div className="shrink-0 text-right pl-2">
            <span className="block t-num text-[18px] font-bold text-white leading-none">{info.longest}</span>
            <span className="block t-label text-arc-muted mt-1" style={{ fontSize: 9 }}>Best</span>
          </div>
        )}
      </div>
    </section>
  )
}
