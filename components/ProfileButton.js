// Your own face, top right, on every screen that used to reach Profile
// through the tab bar.
//
// Sitting in the header rather than the nav keeps the bottom row short
// enough for the tabs that are actually part of the daily loop.

import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Avatar from './Avatar'

export default function ProfileButton({ size = 32 }) {
  const router = useRouter()
  const [me, setMe] = useState(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('profiles').select('username, avatar_url').eq('id', user.id).single()
        if (active) setMe(data || null)
      } catch {}
    }
    load()
    return () => { active = false }
  }, [])

  return (
    <Link
      href="/profile"
      aria-label="Your profile"
      aria-current={router.pathname === '/profile' ? 'page' : undefined}
      className="shrink-0 rounded-full ring-2 ring-white/10 hover:ring-arc-accent/50 transition-all"
    >
      <Avatar src={me?.avatar_url} name={me?.username} size={size} />
    </Link>
  )
}
