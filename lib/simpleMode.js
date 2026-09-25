import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// One switch that hides everything that is not the day's list, the workout
// and the challenge. The profile is the source of truth; localStorage is a
// cache so the first paint does not flash the full app before it hides.

const KEY = 'arc_simple_mode'
const EVENT = 'arc:simple-mode'

export function readCachedSimpleMode() {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

export function useSimpleMode() {
  const [simple, setSimple] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSimple(readCachedSimpleMode())
    // Every instance of this hook (the nav, the page) hears a flip at once.
    const onFlip = (e) => setSimple(!!e.detail)
    window.addEventListener(EVENT, onFlip)
    let alive = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (alive) setReady(true); return }
        const { data } = await supabase.from('profiles').select('simple_mode').eq('id', user.id).single()
        if (!alive) return
        const on = !!data?.simple_mode
        setSimple(on)
        try { localStorage.setItem(KEY, on ? '1' : '0') } catch {}
      } catch {}
      if (alive) setReady(true)
    })()
    return () => { alive = false; window.removeEventListener(EVENT, onFlip) }
  }, [])

  const update = async (on) => {
    setSimple(on)
    try { localStorage.setItem(KEY, on ? '1' : '0') } catch {}
    try { window.dispatchEvent(new CustomEvent(EVENT, { detail: on })) } catch {}
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ simple_mode: on }).eq('id', user.id)
  }

  return { simple, ready, setSimpleMode: update }
}
