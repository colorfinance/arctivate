import Link from 'next/link'
import { useRouter } from 'next/router'
import { useSimpleMode } from '../lib/simpleMode'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { loadMe } from '../lib/me'
import { DumbbellIcon, UsersIcon, HabitsIcon, FoodIcon, AdminIcon, FlagIcon } from './icons'

// Survives navigation between tabs (the module stays loaded); a reload or a
// sign-out starts it again.
const navCache = { isAdmin: false, invites: 0, at: 0 }

export default function Nav() {
  const { simple } = useSimpleMode()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(navCache.isAdmin)
  const [pendingInvites, setPendingInvites] = useState(navCache.invites)

  // The badge and the admin tab, kept between tabs. They used to be two
  // queries on every tap of the tab bar, on top of whatever the page itself
  // loads. Now they refresh at most once a minute, and always on Challenge,
  // where invites get dealt with, so the badge still clears straight away.
  useEffect(() => {
    let active = true
    const fresh = Date.now() - navCache.at < 60000
    if (fresh && router.pathname !== '/challenges') return
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const [data, { count }] = await Promise.all([
          loadMe(),
          supabase.from('challenge_invites').select('id', { count: 'exact', head: true })
            .eq('invitee_id', user.id).eq('status', 'pending'),
        ])
        navCache.isAdmin = !!data?.is_admin
        navCache.invites = count || 0
        navCache.at = Date.now()
        if (active) { setIsAdmin(navCache.isAdmin); setPendingInvites(navCache.invites) }
      } catch {}
    })()
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
        {/* Today leads: it is the only tab with something on it that has to be
            done today, and it is the one 48 of 49 members already use. */}
        <Link href="/habits" aria-label="Today" aria-current={router.pathname === '/habits' ? 'page' : undefined} className={itemClasses('/habits')}>
            <HabitsIcon size={20} />
            <span className="truncate max-w-full">Today</span>
        </Link>
        <Link href="/train" aria-label="Train" aria-current={router.pathname === '/train' ? 'page' : undefined} className={itemClasses('/train')}>
            <DumbbellIcon size={20} />
            <span className="truncate max-w-full">Train</span>
        </Link>
        {!simple && (
        <Link href="/food" aria-label="Food" aria-current={router.pathname === '/food' ? 'page' : undefined} className={itemClasses('/food')}>
            <FoodIcon size={20} />
            <span className="truncate max-w-full">Food</span>
        </Link>
        )}
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
        <Link href="/feed" aria-label="Feed" aria-current={router.pathname === '/feed' ? 'page' : undefined} className={itemClasses('/feed')}>
            <UsersIcon size={20} />
            <span className="truncate max-w-full">Feed</span>
        </Link>
        {/* Profile lives top-right in each page header now — see ProfileButton */}
        {isAdmin && (
            <Link href="/admin/workouts" aria-label="Admin" aria-current={router.pathname === '/admin/workouts' ? 'page' : undefined} className={itemClasses('/admin/workouts')}>
                <AdminIcon size={20} />
                <span className="truncate max-w-full">Admin</span>
            </Link>
        )}
    </nav>
  )
}
