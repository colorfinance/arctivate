import { supabase } from './supabaseClient'

// The few things about you that every screen's chrome needs: your name and
// face for the header, whether simple mode is on, whether you are an admin.
//
// The header, the tab bar and simple mode each used to fetch these on every
// screen -- four profile reads per tap before the page's own data. Now it is
// one read per app session, shared, and refreshed when you change it.

let mePromise = null

export function loadMe() {
  if (!mePromise) {
    mePromise = (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, simple_mode, is_admin')
        .eq('id', user.id)
        .single()
      return data || { id: user.id }
    })().catch(() => { mePromise = null; return null })
  }
  return mePromise
}

// After you edit your profile, or sign in as someone else.
export function refreshMe() {
  mePromise = null
  return loadMe()
}

// Keep the cached copy in step with a change made on this device.
export function patchMe(fields) {
  if (!mePromise) return
  mePromise = mePromise.then(me => (me ? { ...me, ...fields } : me))
}
