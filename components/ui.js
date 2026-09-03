import Link from 'next/link'

// The small shared pieces. Kept in one file because each is a few lines and
// what matters is that every screen uses the same few lines.

// A row in a list: icon, title, caption, something on the right. Settings,
// signposts and options are rows -- they are not cards.
export function ListRow({ icon, title, caption, trailing, href, onClick, tone = 'default', className = '' }) {
  const tones = {
    default: 'bg-arc-surface2/60 border-white/[0.05] hover:border-white/15',
    warning: 'bg-arc-warning/[0.08] border-arc-warning/30',
    accent: 'bg-arc-accent/[0.08] border-arc-accent/30',
  }
  const cls = `w-full flex items-center gap-3 px-4 py-3 rounded-control border text-left transition-colors duration-fast ${tones[tone] || tones.default} ${className}`
  const body = (
    <>
      {icon && <span className="shrink-0 w-9 h-9 rounded-full bg-white/[0.04] flex items-center justify-center text-arc-muted">{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-bold text-white truncate">{title}</span>
        {caption && <span className="block t-caption text-arc-muted truncate">{caption}</span>}
      </span>
      {trailing !== undefined ? (
        <span className="shrink-0 flex items-center">{trailing}</span>
      ) : (href || onClick) ? (
        <Chevron />
      ) : null}
    </>
  )
  if (href) return <Link href={href} className={cls}>{body}</Link>
  if (onClick) return <button onClick={onClick} className={cls}>{body}</button>
  return <div className={cls}>{body}</div>
}

export function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-arc-muted shrink-0" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// A message that isn't a card and isn't a modal: something to know, in the
// flow of the page, in one of three tones. Dismissible when it's informational.
export function Banner({ tone = 'info', title, body, action, onDismiss, icon, className = '' }) {
  const tones = {
    info: 'bg-arc-surface2/70 border-white/[0.06] text-white',
    warning: 'bg-arc-warning/[0.08] border-arc-warning/30 text-arc-warning',
    success: 'bg-arc-success/[0.08] border-arc-success/30 text-arc-success',
  }
  return (
    <div className={`flex items-start gap-3 rounded-control border px-4 py-3 ${tones[tone] || tones.info} ${className}`}>
      {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
      <div className="flex-1 min-w-0">
        {title && <p className="text-[14px] font-bold leading-snug">{title}</p>}
        {body && <p className="t-caption text-arc-muted mt-0.5 leading-snug">{body}</p>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 -mr-1 w-8 h-8 rounded-full flex items-center justify-center text-arc-muted hover:text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  )
}

// One control for "which of these", replacing the stacked toggle bars. The
// options share the width; the chosen one is raised.
export function SegmentedControl({ options, value, onChange, className = '', size = 'md' }) {
  const h = size === 'sm' ? 'h-9 text-[12px]' : 'h-10 text-[13px]'
  return (
    <div role="tablist" className={`flex p-1 rounded-control bg-arc-surface2/70 border border-white/[0.05] ${className}`}>
      {options.map(o => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`flex-1 min-w-0 ${h} px-2 rounded-[10px] font-bold truncate transition-colors duration-fast ${on ? 'bg-arc-surface1 text-white shadow-card' : 'text-arc-muted hover:text-white'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// Nothing here yet, said in a way that shows what "something" would look like
// and offers the one thing that gets you there.
export function EmptyState({ icon, title, body, action, className = '' }) {
  return (
    <div className={`text-center py-10 px-6 ${className}`}>
      {icon && <div className="w-12 h-12 rounded-full bg-arc-surface2 flex items-center justify-center mx-auto mb-3 text-arc-muted">{icon}</div>}
      <p className="t-title text-white">{title}</p>
      {body && <p className="t-body text-arc-muted mt-1 max-w-xs mx-auto">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

// A section label: the only small-caps in the system.
export function SectionLabel({ children, trailing, className = '' }) {
  return (
    <div className={`flex items-center justify-between px-1 mb-2 ${className}`}>
      <span className="t-label text-arc-muted">{children}</span>
      {trailing}
    </div>
  )
}
