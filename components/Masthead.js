import Link from 'next/link'
import { useRouter } from 'next/router'
import ProfileButton from './ProfileButton'

// The one header.
//
// Every page used to invent its own: TODAY, ARCTIVATE / TRAINING, COMMUNITY,
// CHALLENGES, ARC COACH / AI-Powered Training, NUTRITION. The tab bar said
// Train, Feed, Food. A member tapping "Feed" and landing on "COMMUNITY" has
// to work out whether they are in the right place.
//
// So: the title is the tab's name, at most two actions, and your face. The
// display face is not used here -- it is reserved for one moment per screen,
// and a header on every screen is not a moment.

export default function Masthead({ title, back = false, actions = null, subtitle = null, showProfile = true }) {
  const router = useRouter()
  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/85 backdrop-blur-xl border-b border-white/[0.05]">
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
        {back && (
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push('/habits'))}
            aria-label="Back"
            className="shrink-0 -ml-1 w-10 h-10 rounded-full flex items-center justify-center text-arc-muted hover:text-white transition-colors duration-fast"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="t-title text-white truncate" style={{ fontSize: 20 }}>{title}</h1>
          {subtitle && <p className="t-caption text-arc-muted truncate">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
        {showProfile && <ProfileButton size={32} />}
      </div>
    </header>
  )
}

// A round icon action for the masthead. Two of these at most.
export function MastheadAction({ href, onClick, label, children, badge = 0 }) {
  const cls = 'relative w-10 h-10 rounded-full flex items-center justify-center text-arc-muted hover:text-white hover:bg-white/5 transition-colors duration-fast'
  const inner = (
    <>
      {children}
      {badge > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-arc-accent text-white text-[9px] font-black leading-4 text-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </>
  )
  if (href) return <Link href={href} aria-label={label} className={cls}>{inner}</Link>
  return <button onClick={onClick} aria-label={label} className={cls}>{inner}</button>
}
