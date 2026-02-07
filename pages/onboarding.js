import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'

// Steps configuration
const STEPS = {
  WELCOME: 0,
  PROFILE: 1,
  GOALS: 2,
  CONFIRM: 3,
  COMPLETE: 4
}

export default function Onboarding() {
  const router = useRouter()
  
  // State
  const [step, setStep] = useState(STEPS.WELCOME)
  const [loading, setLoading] = useState(false)
  const [checkingUser, setCheckingUser] = useState(true)

  // Form Data
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    weight: '',
    gender: '',
    fitness_level: '',
    goal: '',
    avatar_url: ''
  })

  // Check user status
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/') // Send to auth
        return
      }
      // Check if already onboarded
      const { data: profile } = await supabase.from('profiles').select('completed_onboarding').eq('id', data.user.id).single()
      if (profile?.completed_onboarding) {
        router.push('/train') // Skip onboarding
      }
      setCheckingUser(false)
    }
    checkUser()
  }, [])

  // Handlers
  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const nextStep = () => {
    if (step < STEPS.COMPLETE) setStep(prev => prev + 1)
  }

  const prevStep = () => {
    if (step > STEPS.WELCOME) setStep(prev => prev - 1)
  }

  const finishOnboarding = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    const updates = {
      username: formData.name,
      age: parseInt(formData.age),
      weight: parseFloat(formData.weight),
      gender: formData.gender,
      fitness_level: formData.fitness_level,
      goal: formData.goal,
      completed_onboarding: true
    }

    // RPC call or direct update
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id)

    if (!error) {
      router.push('/train')
    } else {
      alert("Error saving profile. Please try again.")
    }
    setLoading(false)
  }

  if (checkingUser) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-arc-accent border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="min-h-screen w-full bg-arc-bg text-white overflow-hidden relative flex flex-col items-center justify-center">
      {/* Background Gradients */}
      <div className="absolute inset-0 bg-gradient-radial from-arc-accent/10 via-transparent to-transparent opacity-50" />

      <div className="relative z-10 w-full max-w-md p-6">
        
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
                Step {step + 1} of 5
            </span>
        </div>

        {/* Content Area */}
        <motion.div 
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-arc-card border border-white/10 rounded-[2rem] p-8 shadow-2xl"
        >
            {step === STEPS.WELCOME && (
                <div className="text-center space-y-6">
                    <h1 className="text-3xl font-black italic tracking-tighter">WELCOME TO ARCTIVATE</h1>
                    <p className="text-arc-muted text-sm">Looks like it's your first time here. Let's set up your profile to get you on track.</p>
                    <motion.button whileTap={{ scale: 0.98 }} onClick={nextStep} className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl text-lg shadow-glow">
                        LET'S GO
                    </motion.button>
                </div>
            )}

            {step === STEPS.PROFILE && (
                <div className="space-y-6">
                    <h2 className="text-xl font-black italic">Your Basics</h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1">Name</label>
                            <input type="text" value={formData.name} onChange={(e) => updateFormData('name', e.target.value)} className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white font-bold outline-none focus:border-arc-accent" placeholder="Alex Smith" />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1">Age</label>
                                <input type="number" value={formData.age} onChange={(e) => updateFormData('age', e.target.value)} className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white font-bold outline-none focus:border-arc-accent" placeholder="0" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1">Weight (kg)</label>
                                <input type="number" value={formData.weight} onChange={(e) => updateFormData('weight', e.target.value)} className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white font-bold outline-none focus:border-arc-accent" placeholder="0" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2">Gender</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['Male', 'Female', 'Other'].map(g => (
                                    <button key={g} onClick={() => updateFormData('gender', g.toLowerCase())} 
                                        className={`p-3 rounded-xl text-sm font-bold border transition-all ${formData.gender === g.toLowerCase() ? 'bg-arc-accent border-arc-accent' : 'bg-arc-surface border-white/10 hover:border-white/20'}`}>
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button onClick={prevStep} className="flex-1 py-3 rounded-xl border border-white/10 text-arc-muted font-bold hover:border-white/20">Back</button>
                        <button onClick={nextStep} disabled={!formData.name || !formData.age} className="flex-[2] bg-arc-accent text-white font-bold py-3 rounded-xl shadow-glow disabled:opacity-50">Next</button>
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
                                    className={`w-full p-4 rounded-xl text-left font-bold text-sm border transition-all ${formData.fitness_level === lvl ? 'bg-white text-black border-white' : 'bg-arc-surface border-white/10 hover:border-white/20'}`}>
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
                                    className={`w-full p-4 rounded-xl text-left font-bold text-sm border transition-all ${formData.goal === g ? 'bg-arc-accent border-arc-accent' : 'bg-arc-surface border-white/10 hover:border-white/20'}`}>
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                         <button onClick={prevStep} className="flex-1 py-3 rounded-xl border border-white/10 text-arc-muted font-bold hover:border-white/20">Back</button>
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

                     <button onClick={finishOnboarding} className="w-full bg-arc-accent text-white font-bold py-4 rounded-xl text-lg shadow-glow">
                        {loading ? 'SAVING...' : 'LOCK IN PROFILE'}
                     </button>
                     <button onClick={prevStep} className="w-full text-center text-xs text-arc-muted py-2">Back</button>
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