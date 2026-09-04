import { WAGER_PRESETS, WAGER_MAX } from '../lib/newChallenge'

// What's on the line. Four things people actually say at a gym, and a line
// for anything else. Used when a challenge is created, when someone is
// called out on one, and when the owner changes their mind.

export default function WagerPicker({ value, onChange, autoFocus = false }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {WAGER_PRESETS.map(w => (
          <button
            key={w}
            type="button"
            onClick={() => onChange(value === w ? '' : w)}
            className={`h-9 px-3.5 rounded-full text-[13px] font-bold border transition-colors duration-fast ${
              value === w
                ? 'bg-arc-warning/[0.12] border-arc-warning/40 text-arc-warning'
                : 'bg-arc-surface2/70 border-white/[0.06] text-arc-muted hover:text-white'
            }`}
          >
            {w}
          </button>
        ))}
      </div>
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value.slice(0, WAGER_MAX))}
        placeholder="Or write your own"
        maxLength={WAGER_MAX}
        className="w-full h-12 px-4 rounded-control bg-arc-surface2 border border-white/[0.08] text-[15px] text-white outline-none focus:border-arc-accent transition-colors duration-fast placeholder:text-arc-muted/60"
      />
      <p className="t-caption text-arc-muted mt-1.5">
        Between you and them. Arctivate writes it down and says who won. It doesn&apos;t hold or move anything.
      </p>
    </div>
  )
}
