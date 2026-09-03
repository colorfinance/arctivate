// The mark, as an inline SVG so it can sit in a header or a login screen
// without a request and takes its colour from the brand gradient. The path
// is the one in public/brand/logo-set; keep them the same.

export default function BrandMark({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size * 2}
      viewBox="0 0 120 160"
      className={className}
      role="img"
      aria-label="Arctivate"
    >
      <defs>
        <linearGradient id="arcMarkGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5EE7D6" />
          <stop offset="55%" stopColor="#15B8AE" />
          <stop offset="100%" stopColor="#0E8F88" />
        </linearGradient>
      </defs>
      <path d="M88 0 L20 84 L56 84 L32 160 L100 76 L64 76 Z" fill="url(#arcMarkGrad)" />
    </svg>
  )
}
