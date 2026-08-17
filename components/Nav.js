import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { DumbbellIcon, CoachIcon, UsersIcon, HabitsIcon, FoodIcon, UserIcon, AdminIcon, FlagIcon } from './icons'

export default function Nav() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendingInvites, setPendingInvites] = useState(0)

  // Refetched on every navigation so the badge clears as soon as someone deals
  // with the invite, rather than sitting there until a reload.
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
        if (active && data?.is_admin) setIsAdmin(true)

        const { count } = await supabase
          .from('challenge_invites')
          .select('id', { count: 'exact', head: true })
          .eq('invitee_id', user.id)
          .eq('status', 'pending')
        if (active) setPendingInvites(count || 0)
      } catch {}
    }
    load()
    return () => { active = false }
  }, [router.pathname])

  const isActive = (path) => router.pathname === path ? "text-arc-accent" : "hover:text-white transition"

  // min-h-[44px] holds Apple's 44pt guideline vertically; the tabs share the
  // width evenly rather than each claiming 44px, because a coach sees an
  // eighth tab and a fixed width would push it off a 320px screen.
  const itemClasses = (path) =>
    `relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 min-h-[44px] ${isActive(path)}`

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 bg-arc-card/90 backdrop-blur-xl border-t border-white/[0.04] px-1 py-3 flex justify-around text-[10px] font-bold text-arc-muted z-40 safe-area-bottom"
    >
        <Link
          href="/challenges"
          aria-label={pendingInvites > 0 ? `Challenges, ${pendingInvites} waiting for you` : 'Challenges'}
          aria-current={router.pathname === '/challenges' ? 'page' : undefined}
          className={itemClasses('/challenges')}
        >
            <span className="relative">
              <FlagIcon size={20} />
              {pendingInvites > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-arc-accent text-white text-[9px] font-black leading-4 text-center shadow-glow">
                  {pendingInvites > 9 ? '9+' : pendingInvites}
                </span>
              )}
            </span>
            <span className="truncate max-w-full">Challenge</span>
        </Link>
        <Link href="/train" aria-label="Train" aria-current={router.pathname === '/train' ? 'page' : undefined} className={itemClasses('/train')}>
            <DumbbellIcon size={20} />
            <span className="truncate max-w-full">Train</span>
        </Link>
        <Link href="/coach" aria-label="Coach" aria-current={router.pathname === '/coach' ? 'page' : undefined} className={itemClasses('/coach')}>
            <CoachIcon size={20} />
            <span className="truncate max-w-full">Coach</span>
        </Link>
        <Link href="/feed" aria-label="Feed" aria-current={router.pathname === '/feed' ? 'page' : undefined} className={itemClasses('/feed')}>
            <UsersIcon size={20} />
            <span className="truncate max-w-full">Feed</span>
        </Link>
        <Link href="/habits" aria-label="Habits" aria-current={router.pathname === '/habits' ? 'page' : undefined} className={itemClasses('/habits')}>
            <HabitsIcon size={20} />
            <span className="truncate max-w-full">Habits</span>
        </Link>
        <Link href="/food" aria-label="Food" aria-current={router.pathname === '/food' ? 'page' : undefined} className={itemClasses('/food')}>
            <FoodIcon size={20} />
            <span className="truncate max-w-full">Food</span>
        </Link>
        <Link href="/profile" aria-label="Profile" aria-current={router.pathname === '/profile' ? 'page' : undefined} className={itemClasses('/profile')}>
            <UserIcon size={20} />
            <span className="truncate max-w-full">Profile</span>
        </Link>
        {isAdmin && (
            <Link href="/admin/workouts" aria-label="Admin" aria-current={router.pathname === '/admin/workouts' ? 'page' : undefined} className={itemClasses('/admin/workouts')}>
                <AdminIcon size={20} />
                <span className="truncate max-w-full">Admin</span>
            </Link>
        )}
    </nav>
  )
}
