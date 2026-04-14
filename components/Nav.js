import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Nav() {
  const router = useRouter()

  const isActive = (path) => router.pathname === path ? "text-arc-accent" : "hover:text-white transition"

  // min-w-[44px]/min-h-[44px] keeps every tap target ≥ Apple's 44pt guideline.
  const itemClasses = (path) =>
    `flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[44px] ${isActive(path)}`

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 bg-arc-card/90 backdrop-blur-xl border-t border-white/[0.04] p-3 flex justify-around text-[10px] font-bold text-arc-muted z-40 safe-area-bottom"
    >
        <Link href="/train" aria-label="Train" aria-current={router.pathname === '/train' ? 'page' : undefined} className={itemClasses('/train')}>
            <span className="text-base" aria-hidden="true">💪</span>
            <span>Train</span>
        </Link>
        <Link href="/coach" aria-label="Coach" aria-current={router.pathname === '/coach' ? 'page' : undefined} className={itemClasses('/coach')}>
            <span className="text-base" aria-hidden="true">🧑‍🏫</span>
            <span>Coach</span>
        </Link>
        <Link href="/feed" aria-label="Feed" aria-current={router.pathname === '/feed' ? 'page' : undefined} className={itemClasses('/feed')}>
            <span className="text-base" aria-hidden="true">👥</span>
            <span>Feed</span>
        </Link>
        <Link href="/habits" aria-label="Habits" aria-current={router.pathname === '/habits' ? 'page' : undefined} className={itemClasses('/habits')}>
            <span className="text-base" aria-hidden="true">✅</span>
            <span>Habits</span>
        </Link>
        <Link href="/food" aria-label="Food" aria-current={router.pathname === '/food' ? 'page' : undefined} className={itemClasses('/food')}>
            <span className="text-base" aria-hidden="true">🥗</span>
            <span>Food</span>
        </Link>
        <Link href="/profile" aria-label="Profile" aria-current={router.pathname === '/profile' ? 'page' : undefined} className={itemClasses('/profile')}>
            <span className="text-base" aria-hidden="true">👤</span>
            <span>Profile</span>
        </Link>
    </nav>
  )
}
