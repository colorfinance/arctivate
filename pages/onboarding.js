import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'
import Avatar from '../components/Avatar'
import { startChallengeWith, STARTER_TASKS } from '../lib/newChallenge'

// Steps configuration
const STEPS = {
  WELCOME: 0,
  PROFILE: 1,
  GOALS: 2,
  CONFIRM: 3,
  // Nineteen of the first forty-eight members finished onboarding and never
  // logged a single thing. They arrived alone and left alone. This step is the
  // fix: nobody leaves onboarding without someone to beat.
  RIVAL: 4,
  COMPLETE: 5
}

export default function Onboarding() {
  const router = useRouter()

  const [step, setStep] = useState(STEPS.WELCOME)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingUser, setCheckingUser] = useState(true)
  const [checkingName, setCheckingName] = useState(false)
  // Rival step
  const [gymMates, setGymMates] = useState([])
  const [loadingMates, setLoadingMates] = useState(false)
  const [picked, setPicked] = useState([])
  const [startingChallenge, setStartingChallenge] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    weight: '',
    gender: '',
    fitness_level: '',
    goal: '',
  })

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('completed_onboarding').eq('id', data.user.id).single()
      if (profile?.completed_onboarding) {
        router.push('/habits')
        return
      }
      setCheckingUser(false)
    }
    checkUser()
  }, [])

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Postgres 23505 on the profiles.username unique index. Checked by code
  // rather than message text so a Supabase wording change can't break it.
  const isNameTaken = (err) =>
    err?.code === '23505' && /username/i.test(err?.message || '')

  // Catch the clash on the step that owns the name field, so nobody fills in
  // three more screens before being told to change it.
  const checkNameFree = async (name) => {
    const { data, error: qErr } = await supabase
      .from('profiles').select('id').eq('username', name).limit(1)
    if (qErr) return true // can't tell — let the save be the judge
    return !data?.length
  }

  // Everyone at the same gym, most active first, so the names on offer are
  // people who will actually show up rather than the alphabetical top of the list.
  const loadGymMates = async (userId) => {
    setLoadingMates(true)
    try {
      const { data: me } = await supabase
        .from('profiles').select('gym_id').eq('id', userId).single()
      let q = supabase
        .from('profiles')
        .select('id, username, avatar_url, total_points')
        .neq('id', userId)
        .not('username', 'is', null)
        .order('total_points', { ascending: false, nullsFirst: false })
        .limit(24)
      if (me?.gym_id) q = q.eq('gym_id', me.gym_id)
      const { data } = await q
      setGymMates(data || [])
    } catch {
      setGymMates([])
    } finally {
      setLoadingMates(false)
    }
  }

  const togglePicked = (id) =>
    setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const finish = async () => {
    setStep(STEPS.COMPLETE)
    try {
      const confetti = (await import('canvas-confetti')).default
      confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 }, colors: ['#00D4AA', '#06B6D4', '#ffffff'] })
    } catch {}
    // Straight to the challenge you just started -- that is the thing you
    // just did. Every other entry point lands on Today.
    setTimeout(() => router.push('/challenges'), 2000)
  }

  const startChallenge = async () => {
    if (startingChallenge || picked.length === 0) return
    setStartingChallenge(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: me } = await supabase
        .from('profiles').select('gym_id').eq('id', user.id).single()

      await startChallengeWith(supabase, {
        userId: user.id,
        gymId: me?.gym_id || null,
        title: `${formData.name}'s 30 day challenge`,
        lengthDays: 30,
        taskTitles: STARTER_TASKS,
        opponentIds: picked,
      })
      await finish()
    } catch {
      // The profile is already saved, so a failure here must not trap them on
      // this screen — say so and let them carry on into the app.
      setError('Could not start that challenge. You can start one any time from Challenges.')
      setStartingChallenge(false)
    }
  }

  const nextStep = async () => {
    if (step === STEPS.PROFILE) {
      setCheckingName(true)
      const free = await checkNameFree(formData.name)
      setCheckingName(false)
      if (!free) {
        setError(`"${formData.name}" is already taken. Pick another name.`)
        return
      }
    }
    setError('')
    if (step < STEPS.COMPLETE) setStep(prev => prev + 1)
  }

  const prevStep = () => {
    if (step > STEPS.WELCOME) setStep(prev => prev - 1)
  }

  const finishOnboarding = async () => {
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // Try full update first, fall back to minimal if columns don't exist
      const fullUpdates = {
        username: formData.name || null,
        age: parseInt(formData.age) || null,
        weight: parseFloat(formData.weight) || null,
        gender: formData.gender || null,
        fitness_level: formData.fitness_level || null,
        goal: formData.goal || null,
        completed_onboarding: true,
        challenge_start_date: new Date().toISOString()
      }

      // Save in order of importance so the username is never lost:
      // 1) Always save id + username + completed_onboarding first (these
      //    columns have been in the schema since day one).
      // 2) Then attempt to add optional fields (age/weight/gender/etc.)
      //    individually — each one is additive, so a failure on one column
      //    doesn't wipe out the ones that already saved.
      let saveError = null

      const { error: baseErr } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: formData.name || null,
          completed_onboarding: true,
          challenge_start_date: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (baseErr) {
        // Retry without challenge_start_date in case column is missing.
        const { error: err2 } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            username: formData.name || null,
            completed_onboarding: true,
          }, { onConflict: 'id' })

        if (err2) {
          console.error('[Arctivate] onboarding base save failed:', err2)
          saveError = err2
        }
      }

      // Optional demographic fields — try each, ignore individual failures.
      if (!saveError) {
        const optional = {
          age: parseInt(formData.age) || null,
          weight: parseFloat(formData.weight) || null,
          gender: formData.gender || null,
          fitness_level: formData.fitness_level || null,
          goal: formData.goal || null,
        }
        const { error: optErr } = await supabase
          .from('profiles')
          .update(optional)
          .eq('id', user.id)
        if (optErr) {
          // Schema may not have these columns yet — not fatal.
          console.warn('[Arctivate] onboarding optional fields skipped:', optErr.message)
        }
      }

      if (saveError) {
        // A taken name is the one failure "try again" can never fix. Say so and
        // put them back on the step with the name field, or they are stuck on
        // this screen for good and never reach the app.
        if (isNameTaken(saveError)) {
          setError(`"${formData.name}" is already taken. Pick another name.`)
          setStep(STEPS.PROFILE)
        } else {
          setError('Failed to save profile. Please try again.')
        }
        setLoading(false)
        return
      }

      // Verify the flag actually persisted before navigating.
      const { data: verify } = await supabase
        .from('profiles')
        .select('completed_onboarding')
        .eq('id', user.id)
        .single()

      if (!verify?.completed_onboarding) {
        setError('Profile saved but onboarding state could not be confirmed. Please try again.')
        setLoading(false)
        return
      }

      // Profile is saved. Before dropping them into the app on their own, give
      // them someone to go up against — that is the whole retention bet.
      setLoading(false)
      setStep(STEPS.RIVAL)
      loadGymMates(user.id)
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (checkingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-arc-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen w-full bg-arc-bg text-white relative flex flex-col items-center justify-center"
      style={{ overscrollBehavior: 'contain' }}
    >
      <div className="fixed inset-0 bg-gradient-radial from-arc-accent/10 via-transparent to-transparent opacity-50 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md p-6 py-10">

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="h-1 w-full bg-white/5 rounded-full mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(step / STEPS.COMPLETE) * 100}%` }}
              className="h-full bg-arc-accent rounded-full"
            />
          </div>
          <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">
            Step {Math.min(step + 1, STEPS.COMPLETE)} of {STEPS.COMPLETE}
          </span>
        </div>

        {/* Content */}
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-arc-card border border-white/10 rounded-[2rem] p-8 shadow-2xl"
        >
          {error && step !== STEPS.CONFIRM && (
            <p className="text-red-400 text-sm text-center font-bold mb-4">{error}</p>
          )}

          {step === STEPS.WELCOME && (
            <div className="text-center space-y-6">
              <h1 className="text-3xl font-black italic tracking-tighter">WELCOME TO ARCTIVATE</h1>
              <p className="text-arc-muted text-sm">Let's set up your profile to get you on track.</p>
              <button onClick={nextStep} className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl text-lg shadow-glow active:scale-95 transition">
                LET'S GO
              </button>
            </div>
          )}

          {step === STEPS.PROFILE && (
            <div className="space-y-6">
              <h2 className="text-xl font-black italic">Your Basics</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1">Name</label>
                  <input type="text" value={formData.name} onChange={(e) => { setError(''); updateFormData('name', e.target.value) }}
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white font-bold outline-none focus:border-arc-accent" placeholder="Alex Smith"
                    autoCapitalize="words" autoCorrect="off" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1">Age</label>
                    <input type="number" inputMode="numeric" value={formData.age} onChange={(e) => updateFormData('age', e.target.value)}
                      className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white font-bold outline-none focus:border-arc-accent" placeholder="25" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1">Weight (kg)</label>
                    <input type="number" inputMode="decimal" value={formData.weight} onChange={(e) => updateFormData('weight', e.target.value)}
                      className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white font-bold outline-none focus:border-arc-accent" placeholder="75" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2">Gender</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Male', 'Female', 'Other'].map(g => (
                      <button key={g} onClick={() => updateFormData('gender', g.toLowerCase())}
                        className={`p-3 rounded-xl text-sm font-bold border transition-all ${formData.gender === g.toLowerCase() ? 'bg-arc-accent border-arc-accent' : 'bg-arc-surface border-white/10'}`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={prevStep} className="flex-1 py-3 rounded-xl border border-white/10 text-arc-muted font-bold">Back</button>
                <button onClick={nextStep} disabled={!formData.name || !formData.age || checkingName} className="flex-[2] bg-arc-accent text-white font-bold py-3 rounded-xl shadow-glow disabled:opacity-50">{checkingName ? 'Checking…' : 'Next'}</button>
              </div>
            </div>
          )}

          {step === STEPS.GOALS && (
            <div className="space-y-6">
              <h2 className="text-xl font-black italic">Your Mission</h2>
              <div>
                <label className="block text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2">Fitness Level</label>
                <div className="space-y-2">
                  {['Beginner', 'Intermediate', 'Advanced'].map(lvl => (
                    <button key={lvl} onClick={() => updateFormData('fitness_level', lvl)}
                      className={`w-full p-4 rounded-xl text-left font-bold text-sm border transition-all ${formData.fitness_level === lvl ? 'bg-white text-black border-white' : 'bg-arc-surface border-white/10'}`}>
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2">Primary Goal</label>
                <div className="space-y-2">
                  {['Lose Fat', 'Gain Muscle', 'Maintain/Health', 'Performance'].map(g => (
                    <button key={g} onClick={() => updateFormData('goal', g)}
                      className={`w-full p-4 rounded-xl text-left font-bold text-sm border transition-all ${formData.goal === g ? 'bg-arc-accent border-arc-accent' : 'bg-arc-surface border-white/10'}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={prevStep} className="flex-1 py-3 rounded-xl border border-white/10 text-arc-muted font-bold">Back</button>
                <button onClick={nextStep} disabled={!formData.goal || !formData.fitness_level} className="flex-[2] bg-arc-accent text-white font-bold py-3 rounded-xl shadow-glow disabled:opacity-50">Next</button>
              </div>
            </div>
          )}

          {step === STEPS.CONFIRM && (
            <div className="space-y-6">
              <h2 className="text-xl font-black italic text-center">LOOKS GOOD</h2>
              <div className="bg-arc-surface/50 border border-white/5 rounded-xl p-4 space-y-3 text-sm">
                {formData.name && <div className="flex justify-between"><span className="text-arc-muted">Name</span> <span className="font-bold">{formData.name}</span></div>}
                {formData.age && <div className="flex justify-between"><span className="text-arc-muted">Age</span> <span className="font-bold">{formData.age} yrs</span></div>}
                {formData.weight && <div className="flex justify-between"><span className="text-arc-muted">Weight</span> <span className="font-bold">{formData.weight} kg</span></div>}
                {formData.gender && <div className="flex justify-between"><span className="text-arc-muted">Gender</span> <span className="font-bold capitalize">{formData.gender}</span></div>}
                {formData.fitness_level && <div className="flex justify-between"><span className="text-arc-muted">Level</span> <span className="font-bold">{formData.fitness_level}</span></div>}
                {formData.goal && <div className="flex justify-between"><span className="text-arc-muted">Goal</span> <span className="font-bold text-arc-accent">{formData.goal}</span></div>}
              </div>
              <button onClick={finishOnboarding} disabled={loading} className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl text-lg shadow-glow disabled:opacity-50 active:scale-95 transition">
                {loading ? 'SAVING...' : 'LOCK IN PROFILE'}
              </button>
              {error && <p className="text-red-400 text-sm text-center font-bold">{error}</p>}
              <button onClick={prevStep} disabled={loading} className="w-full text-center text-xs text-arc-muted py-2">Back</button>
            </div>
          )}

          {step === STEPS.RIVAL && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-black italic tracking-tighter">WHO ARE YOU UP AGAINST?</h2>
                <p className="text-arc-muted text-[13px] leading-snug">
                  Pick someone from your gym. You both get the same 30 days and the same
                  three things to tick off. Last one standing wins.
                </p>
              </div>

              {loadingMates ? (
                <div className="py-10 flex justify-center">
                  <div className="w-6 h-6 border-2 border-arc-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : gymMates.length === 0 ? (
                <p className="text-center text-arc-muted text-sm py-6">
                  Nobody else here yet. You can call someone out from Challenges once they join.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto -mx-2 px-2 space-y-2">
                  {gymMates.map(m => {
                    const on = picked.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        onClick={() => togglePicked(m.id)}
                        aria-pressed={on}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${on ? 'bg-arc-accent/15 border-arc-accent' : 'bg-arc-surface border-white/[0.06] hover:border-white/20'}`}
                      >
                        <Avatar src={m.avatar_url} name={m.username} size={38} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-bold text-white truncate">{m.username}</span>
                          <span className="block text-[10px] text-arc-muted">{(m.total_points || 0).toLocaleString()} pts</span>
                        </span>
                        <span className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${on ? 'bg-arc-accent border-arc-accent' : 'border-white/20'}`}>
                          {on && <svg className="w-3 h-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="space-y-2 pt-1">
                <button
                  onClick={startChallenge}
                  disabled={picked.length === 0 || startingChallenge}
                  className="w-full bg-arc-accent text-white font-black italic py-4 rounded-xl text-lg shadow-glow active:scale-95 transition disabled:opacity-40"
                >
                  {startingChallenge
                    ? 'STARTING…'
                    : picked.length === 0
                      ? 'PICK SOMEONE'
                      : `CHALLENGE ${picked.length === 1 ? 'THEM' : `THESE ${picked.length}`}`}
                </button>
                {/* Never a dead end: the profile is already saved by this point. */}
                <button
                  onClick={finish}
                  disabled={startingChallenge}
                  className="w-full text-center text-xs text-arc-muted py-2 hover:text-white transition-colors disabled:opacity-50"
                >
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {step === STEPS.COMPLETE && (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <h2 className="text-2xl font-black italic mb-2">YOU'RE SET</h2>
              <p className="text-arc-muted text-sm">Redirecting to dashboard...</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
