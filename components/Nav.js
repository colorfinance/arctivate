import Link from 'next/link'
import { useRouter } from 'next/router'

export default function Nav() {
  const router = useRouter()
  
  const isActive = (path) => router.pathname === path ? "text-arc-accent" : "hover:text-white transition"

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/5 p-4 flex justify-around text-xs font-bold text-arc-muted z-40">
        <Link href="/train" className={`flex flex-col items-center gap-1 ${isActive('/train')}`}>
            <span>💪</span>
            <span>Train</span>
        </Link>
        <Link href="/feed" className={`flex flex-col items-center gap-1 ${isActive('/feed')}`}>
            <span>👥</span>
            <span>Feed</span>
        </Link>
        <Link href="/habits" className={`flex flex-col items-center gap-1 ${isActive('/habits')}`}>
            <span>✅</span>
            <span>Habits</span>
        </Link>
        <Link href="/food" className={`flex flex-col items-center gap-1 ${isActive('/food')}`}>
            <span>🥗</span>
            <span>Food</span>
        </Link>
    </nav>
  )
}
