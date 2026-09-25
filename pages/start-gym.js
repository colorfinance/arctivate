import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabaseClient'
import LoadingState from '../components/LoadingState'
import BrandMark from '../components/BrandMark'
import Button from '../components/Button'
import Field from '../components/Field'

// The second step of signing up a gym: name it, and you are its owner.
// The member onboarding (age, weight, goal, rival) is for members; the
// owner skips it and lands on the pulse with a code to hand out.

export default function StartGym() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [yourName, setYourName] = useState('')
  const [gymName, setGymName] = useState('')
  const [city, setCity] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      const { data: staff } = await supabase.from('gym_staff').select('gym_id').eq('user_id', user.id).limit(1).maybeSingle()
      if (staff?.gym_id) { router.replace('/gym'); return }
      const { data: p } = await supabase.from('profiles').select('username').eq('id', user.id).single()
      if (p?.username) setYourName(p.username)
      setChecking(false)
    })()
  }, [router])

  const submit = async () => {
    if (busy) return
    setError('')
    if (yourName.trim().length < 2) { setError('Tell your members who you are.'); return }
    if (gymName.trim().length < 2) { setError('Give the gym a name.'); return }
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/'); return }
      const { error: pe } = await supabase.from('profiles')
        .update({ username: yourName.trim().slice(0, 40), completed_onboarding: true })
        .eq('id', user.id)
      if (pe) throw pe
      const { error: ge } = await supabase.rpc('create_gym', { p_name: gymName.trim(), p_city: city.trim() || null })
      if (ge) throw ge
      router.replace('/gym')
    } catch (e) {
      setError(e?.message?.includes('name') ? 'Give the gym a name.' : 'Could not set up the gym. Try again.')
      setBusy(false)
    }
  }

  if (checking) return <LoadingState label="One moment…" />

  return (
    <div className="min-h-[100dvh] bg-arc-bg text-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-14 pb-4 text-center">
        <BrandMark size={40} />
        <h1 className="t-display text-white mt-4" style={{ fontSize: 28 }}>Set up your gym</h1>
        <p className="t-body text-arc-muted mt-2 max-w-xs">Name it and you are the owner. You get a six-letter code your members join with, free for 30 days.</p>
      </div>
      <div className="w-full max-w-sm mx-auto px-6 pb-10 space-y-4">
        <Field label="Your name" value={yourName} onChange={(e) => setYourName(e.target.value.slice(0, 40))} placeholder="How members know you" autoFocus />
        <Field label="Gym name" value={gymName} onChange={(e) => setGymName(e.target.value.slice(0, 60))} placeholder="e.g. Iron & Oak Fitness" />
        <Field label="Suburb or city" value={city} onChange={(e) => setCity(e.target.value.slice(0, 60))} placeholder="Optional" />
        {error && <p role="alert" className="t-caption font-bold text-arc-danger">{error}</p>}
        <Button variant="hero" size="lg" block onClick={submit} disabled={busy}>{busy ? 'Setting up…' : 'Open the gym'}</Button>
        <p className="t-caption text-arc-muted text-center">Members stay free. When the pilot ends we will be in touch about the gym plan.</p>
      </div>
    </div>
  )
}
