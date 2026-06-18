import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Nav() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let active = true
    const checkAdmin = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
        if (active && data?.is_admin) setIsAdmin(true)
      } catch {}
    }
    checkAdmin()
    return () => { active = false }
  }, [])

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
        {isAdmin && (
            <Link href="/admin/workouts" aria-label="Admin" aria-current={router.pathname === '/admin/workouts' ? 'page' : undefined} className={itemClasses('/admin/workouts')}>
                <span className="text-base" aria-hidden="true">🛠️</span>
                <span>Admin</span>
            </Link>
        )}
    </nav>
  )
}
