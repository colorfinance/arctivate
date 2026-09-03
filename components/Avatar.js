// A face.
//
// The old fallback was two initials on one of eight hues picked by hashing
// the name -- RT orange, CH brown, EB green, GN purple -- which made a
// leaderboard look like a contacts app. And a member with no name at all got
// a "?", which in the header read as a help button.
//
// Now: the photo if there is one. Otherwise initials in ONE treatment, the
// brand's own, so every face without a photo belongs to the same app. No
// name at all is a person, not a question mark.

function initials(name) {
  const parts = String(name || '').trim().split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
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
        className={`rounded-full object-cover shrink-0 bg-arc-surface2 ${className}`}
      />
    )
  }
  const text = initials(name)
  return (
    <span
      style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.36)) }}
      className={`rounded-full shrink-0 flex items-center justify-center font-black bg-arc-accent/[0.14] text-arc-accent ring-1 ring-inset ring-arc-accent/25 ${className}`}
      aria-hidden="true"
    >
      {text || (
        <svg width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      )}
    </span>
  )
}
