// A face for a leaderboard row.
//
// Falls back to initials on the person's own colour rather than a generic
// silhouette, so a board of people without photos still reads as a board of
// people. The colour is derived from the name, so someone looks the same
// everywhere they appear.

const COLOURS = [
  'bg-rose-500/20 text-rose-300',
  'bg-amber-500/20 text-amber-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-cyan-500/20 text-cyan-300',
  'bg-indigo-500/20 text-indigo-300',
  'bg-fuchsia-500/20 text-fuchsia-300',
  'bg-lime-500/20 text-lime-300',
  'bg-orange-500/20 text-orange-300',
]

function initials(name) {
  const parts = String(name || '').trim().split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function colourFor(name) {
  const s = String(name || '')
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return COLOURS[h % COLOURS.length]
}

export default function Avatar({ src, name, size = 28, className = '' }) {
  const style = { width: size, height: size }
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        style={style}
        className={`rounded-full object-cover shrink-0 bg-arc-surface ${className}`}
      />
    )
  }
  return (
    <span
      style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.36)) }}
      className={`rounded-full shrink-0 flex items-center justify-center font-black ${colourFor(name)} ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}
