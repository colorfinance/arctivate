import { ChatIcon } from '../components/icons'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'
import Masthead from '../components/Masthead'
import Button from '../components/Button'
import Avatar from '../components/Avatar'
import { useSimpleMode } from '../lib/simpleMode'
import { patchMe } from '../lib/me'
import { usePlan, gymCovers, PREMIUM_PRICE, startCheckout, openBillingPortal } from '../lib/plan'
import { ListRow, SectionLabel } from '../components/ui'
import Field from '../components/Field'
import { getStoredTheme, setTheme as applyStoredTheme } from '../lib/theme'
import { ensureReminderPermission, reminderPermissionState, syncDailyNudge } from '../lib/reminders'

// Icons
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
)

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const LogOutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const StarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const CheckCircleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
)

const FireIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 23c-3.866 0-7-3.134-7-7 0-2.084.784-3.987 2.07-5.427l3.93-4.39 3.93 4.39C16.216 12.013 17 13.916 17 16c0 3.866-3.134 7-7 7z" />
  </svg>
)

// Helper for dates
const getTodayStr = () => {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
}

export default function Profile() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  // Your gym: which one, whether you run it, and the two ways to change it.
  const [gym, setGym] = useState(null)
  const [isStaff, setIsStaff] = useState(false)
  const [gymSheet, setGymSheet] = useState(null) // 'join' | 'create'
  const [gymCode, setGymCode] = useState('')
  const [gymName, setGymName] = useState('')
  const [gymCity, setGymCity] = useState('')
  const [gymBusy, setGymBusy] = useState(false)
  const [gymError, setGymError] = useState('')
  const { simple, setSimpleMode } = useSimpleMode()
  const plan = usePlan()
  const [billingBusy, setBillingBusy] = useState(false)
  const [billingMsg, setBillingMsg] = useState('')

  useEffect(() => {
    if (router.query?.billing === 'success') {
      setBillingMsg('Thanks. Premium is on its way to your account; it can take a few seconds.')
      router.replace('/profile', undefined, { shallow: true })
    }
  }, [router])

  const goPremium = async () => {
    setBillingBusy(true); setBillingMsg('')
    const err = await startCheckout()
    if (err) { setBillingMsg(err); setBillingBusy(false) }
  }
  const manageBilling = async () => {
    setBillingBusy(true); setBillingMsg('')
    const err = await openBillingPortal()
    if (err) { setBillingMsg(err); setBillingBusy(false) }
  }

  useEffect(() => {
    const gid = profile?.gym_id
    if (!gid) { setGym(null); setIsStaff(false); return }
    let alive = true
    ;(async () => {
      const { data: g } = await supabase.from('gyms').select('id, name, city, join_code').eq('id', gid).single()
      const { data: staff } = await supabase.rpc('is_gym_staff', { p_gym: gid })
      if (!alive) return
      setGym(g || null)
      setIsStaff(!!staff)
    })()
    return () => { alive = false }
  }, [profile?.gym_id])

  const joinGym = async () => {
    if (gymBusy) return
    setGymBusy(true); setGymError('')
    const { data, error } = await supabase.rpc('join_gym', { p_code: gymCode })
    setGymBusy(false)
    if (error) { setGymError(error.message?.includes('No gym') ? 'No gym has that code. Check it with the front desk.' : 'Could not join. Try again.'); return }
    setProfile(prev => ({ ...prev, gym_id: data.id }))
    setGymSheet(null); setGymCode('')
  }

  const createGym = async () => {
    if (gymBusy) return
    setGymBusy(true); setGymError('')
    const { data, error } = await supabase.rpc('create_gym', { p_name: gymName, p_city: gymCity || null })
    setGymBusy(false)
    if (error) { setGymError(error.message?.includes('name') ? 'Give the gym a name.' : 'Could not create the gym. Try again.'); return }
    setProfile(prev => ({ ...prev, gym_id: data.id }))
    setGymSheet(null); setGymName(''); setGymCity('')
    router.push('/gym')
  }

  // Progress: the challenge day, the weigh-ins and the photos. Today asks
  // for them; this is where you look back at them.
  const [challengeDay, setChallengeDay] = useState(1)
  const [weights, setWeights] = useState([]) // newest first
  const [photos, setPhotos] = useState([]) // [{ date, url, name }] newest first
  const [viewPhoto, setViewPhoto] = useState(null)

  // The one reminder: a daily nudge to tick today off.
  const [nudgeTime, setNudgeTime] = useState(null)
  const [nudgeInput, setNudgeInput] = useState('07:00')
  const [editingNudge, setEditingNudge] = useState(false)
  const [savingNudge, setSavingNudge] = useState(false)
  const [notifyPermission, setNotifyPermission] = useState(null)

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editCalorieGoal, setEditCalorieGoal] = useState('')
  const [editAvatarUrl, setEditAvatarUrl] = useState('')
  const [editAge, setEditAge] = useState('')
  const [editWeight, setEditWeight] = useState('')
  const [editHeight, setEditHeight] = useState('')
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Sign out & delete
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [theme, setThemeState] = useState('dark')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => { setThemeState(getStoredTheme()) }, [])

  const chooseTheme = (next) => {
    setThemeState(next)
    applyStoredTheme(next)
  }

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      // Weigh-ins and photos only need your id, so they load alongside the
      // profile instead of after it.
      const sideLoads = Promise.all([fetchWeights(user.id), fetchPhotos(user.id)])

      // Fetch profile (fall back if the newer body-metric columns aren't there)
      let { data: profileData, error: profErr } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, total_points, challenge_start_date, challenge_days_goal, completed_onboarding, daily_calorie_goal, age, weight, height, gym_id, daily_reminder_time')
        .eq('id', user.id)
        .single()
      if (profErr) {
        const fb = await supabase
          .from('profiles')
          .select('id, username, avatar_url, total_points, challenge_start_date, challenge_days_goal, completed_onboarding, daily_calorie_goal, gym_id')
          .eq('id', user.id)
          .single()
        profileData = fb.data
      }

      if (profileData && profileData.completed_onboarding === false) {
        router.push('/onboarding')
        return
      }

      setUserId(user.id)
      setUserEmail(user.email || '')
      setProfile(profileData)

      // Calculate challenge day
      if (profileData?.challenge_start_date) {
        const start = new Date(profileData.challenge_start_date)
        const now = new Date()
        const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
        const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
        const diff = Math.floor((nowDay - startDay) / (1000 * 60 * 60 * 24)) + 1
        setChallengeDay(Math.max(1, diff))
      }

      const nudge = profileData?.daily_reminder_time ? profileData.daily_reminder_time.slice(0, 5) : null
      setNudgeTime(nudge)
      setNudgeInput(nudge || '07:00')
      reminderPermissionState().then(setNotifyPermission).catch(() => {})

      await sideLoads
    } catch (err) {
      // swallow — handled via UI state
    } finally {
      setLoading(false)
    }
  }

  async function fetchWeights(uid) {
    try {
      const { data } = await supabase.from('weight_logs')
        .select('date, weight').eq('user_id', uid).order('date', { ascending: false }).limit(60)
      setWeights(data || [])
    } catch {}
  }

  async function fetchPhotos(uid) {
    try {
      const { data } = await supabase.storage.from('progress-photos')
        .list(uid, { limit: 100, sortBy: { column: 'name', order: 'desc' } })
      const list = (data || [])
        .filter(f => f.name.endsWith('.jpg'))
        .sort((x, y) => y.name.localeCompare(x.name))
        .slice(0, 24)
        .map(f => ({
          name: f.name,
          date: f.name.replace('.jpg', ''),
          url: supabase.storage.from('progress-photos').getPublicUrl(`${uid}/${f.name}`).data?.publicUrl,
        }))
        .filter(x => x.url)
      setPhotos(list)
    } catch {}
  }

  async function deletePhoto(photo) {
    try {
      const { error } = await supabase.storage.from('progress-photos').remove([`${userId}/${photo.name}`])
      if (error) throw error
      setPhotos(prev => prev.filter(x => x.name !== photo.name))
      setViewPhoto(null)
      showToast('Photo deleted')
    } catch {
      showToast('Could not delete the photo')
    }
  }

  const fmtTime = (t) => {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  }

  async function saveNudge(turnOff = false) {
    if (savingNudge) return
    setSavingNudge(true)
    const value = turnOff ? null : (nudgeInput || null)
    try {
      if (value) {
        const granted = await ensureReminderPermission()
        setNotifyPermission(await reminderPermissionState())
        if (!granted) showToast('Saved. Allow notifications to get it.')
      }
      const { error } = await supabase.from('profiles').update({ daily_reminder_time: value }).eq('id', userId)
      if (error) { showToast('Could not save'); return }
      setNudgeTime(value)
      setEditingNudge(false)
      syncDailyNudge(value)
      if (!value || notifyPermission === 'granted') showToast(turnOff ? 'Reminder off' : `Reminder set for ${fmtTime(value)}`)
    } catch {
      showToast('Something went wrong')
    } finally {
      setSavingNudge(false)
    }
  }

  async function handleSaveProfile() {
    if (!editUsername.trim()) {
      showToast('Username cannot be empty')
      return
    }

    setIsSaving(true)
    try {
      // Build the full payload. Optional columns are stripped one-by-one if the
      // DB doesn't have them yet, so a missing age/height column can never stop
      // the name (or anything else) from saving.
      const payload = { username: editUsername.trim() }
      if (editAvatarUrl) payload.avatar_url = editAvatarUrl
      const parsedGoal = parseInt(editCalorieGoal, 10)
      if (!isNaN(parsedGoal) && parsedGoal > 0) payload.daily_calorie_goal = parsedGoal
      payload.age = editAge === '' ? null : (parseInt(editAge, 10) || null)
      payload.weight = editWeight === '' ? null : (parseFloat(editWeight) || null)
      payload.height = editHeight === '' ? null : (parseFloat(editHeight) || null)

      const OPTIONAL = ['height', 'age', 'weight', 'daily_calorie_goal', 'avatar_url']
      let attempt = { ...payload }
      let res = await supabase.from('profiles').update(attempt).eq('id', userId).select('id')

      // Drop any column the DB reports as unknown, then retry.
      let guard = 0
      while (res.error && guard < OPTIONAL.length + 1) {
        const msg = res.error.message || ''
        const missing = OPTIONAL.find((c) => attempt[c] !== undefined && msg.includes(c))
        if (!missing) break
        delete attempt[missing]
        res = await supabase.from('profiles').update(attempt).eq('id', userId).select('id')
        guard++
      }

      if (res.error) {
        console.error('[Arctivate] profile save failed:', res.error)
        showToast(`Save failed: ${res.error.message || 'try again'}`)
        return
      }

      // Update returned no rows → the profile row is missing or an RLS policy
      // is blocking the write. Try an upsert, then surface a clear message.
      if (!res.data || res.data.length === 0) {
        const up = await supabase.from('profiles').upsert({ id: userId, ...attempt }, { onConflict: 'id' }).select('id')
        if (up.error) {
          console.error('[Arctivate] profile upsert failed:', up.error)
          showToast(`Save failed: ${up.error.message}`)
          return
        }
        if (!up.data || up.data.length === 0) {
          showToast("Couldn't save — check the profiles update RLS policy")
          return
        }
      }

      const dropped = Object.keys(payload).filter((k) => attempt[k] === undefined)
      setProfile((prev) => ({ ...prev, ...attempt }))
      patchMe({ username: attempt.username, ...(attempt.avatar_url ? { avatar_url: attempt.avatar_url } : {}) })
      setShowEditModal(false)
      showToast(dropped.length ? `Saved — run migration 016 for: ${dropped.join(', ')}` : 'Profile updated!')
    } catch (err) {
      showToast('Something went wrong')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAvatarPick(event) {
    const file = event.target.files?.[0]
    if (!file || !userId) return
    if (!file.type.startsWith('image/')) {
      showToast('Please pick an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image is too large (max 5MB)')
      return
    }

    setIsUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${userId}/avatar-${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (upErr) {
        console.error('[Arctivate] avatar upload failed:', upErr)
        showToast(`Upload failed: ${upErr.message || 'check avatars bucket'}`)
        return
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = urlData?.publicUrl
      if (!publicUrl) {
        showToast('Uploaded but no public URL — check bucket is public')
        return
      }

      setEditAvatarUrl(publicUrl)
      showToast('Photo ready — tap Save to apply')
    } catch (err) {
      console.error('[Arctivate] avatar pick error:', err)
      showToast('Could not upload photo')
    } finally {
      setIsUploadingAvatar(false)
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      showToast('Failed to sign out')
      setIsSigningOut(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return
    setIsDeleting(true)
    try {
      // Use server-side admin API to delete all user data and auth user
      const res = await fetch('/api/auth/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', userId }),
      })

      const result = await res.json()
      if (!res.ok) {
        showToast(result.error || 'Failed to delete account')
        setIsDeleting(false)
        return
      }

      // Sign out and redirect
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      showToast('Failed to delete account. Please try again.')
      setIsDeleting(false)
    }
  }

  function openEditModal() {
    setEditUsername(profile?.username || '')
    setEditCalorieGoal(String(profile?.daily_calorie_goal || 2800))
    setEditAvatarUrl(profile?.avatar_url || '')
    setEditAge(profile?.age != null ? String(profile.age) : '')
    setEditWeight(profile?.weight != null ? String(profile.weight) : '')
    setEditHeight(profile?.height != null ? String(profile.height) : '')
    setShowEditModal(true)
  }

  const challengeGoal = profile?.challenge_days_goal || 75
  const challengeProgress = Math.min((challengeDay / challengeGoal) * 100, 100)

  if (loading) {
    return (
      <div className="min-h-screen bg-arc-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-arc-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-50 bg-arc-surface border border-white/10 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md"
          >
            <div className="w-2 h-2 rounded-full bg-arc-accent animate-pulse" />
            <span className="text-sm font-medium">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Masthead
        title="Profile"
        back
        showProfile={false}
        actions={<Button variant="secondary" size="sm" onClick={openEditModal}><EditIcon />Edit</Button>}
      />

      <main className="pt-20 px-4 max-w-lg mx-auto">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-arc-card border border-white/5 rounded-2xl p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-40 h-40 bg-arc-accent/5 blur-3xl rounded-full pointer-events-none" />

          <div className="flex items-center gap-5 relative z-10">
            {/* Avatar */}
            <div className="shrink-0">
              <Avatar src={profile?.avatar_url} name={profile?.username} size={80} />
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-black italic tracking-tight text-white truncate">
                {profile?.username || (userEmail ? userEmail.split('@')[0] : 'Set your name')}
              </h2>
              {userEmail && <p className="t-caption text-arc-muted truncate mt-0.5">{userEmail}</p>}
            </div>
          </div>
        </motion.div>

        {/* Progress: how far in, and what has changed. */}
        <section className="mt-6">
          <SectionLabel>Progress</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-container bg-arc-surface2/60 border border-white/[0.05] px-4 py-3">
              <span className="t-label text-arc-muted block">Challenge</span>
              <span className="t-num block text-[26px] font-black leading-none mt-1.5 text-white">
                Day {challengeDay}<span className="text-[15px] text-arc-muted"> / {challengeGoal}</span>
              </span>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-2.5">
                <div className="h-full bg-arc-accent rounded-full" style={{ width: `${challengeProgress}%` }} />
              </div>
            </div>
            <div className="rounded-container bg-arc-surface2/60 border border-white/[0.05] px-4 py-3">
              <span className="t-label text-arc-muted block">Weight</span>
              {weights.length > 0 ? (
                <>
                  <span className="t-num block text-[26px] font-black leading-none mt-1.5 text-white">
                    {weights[0].weight}<span className="text-[15px] text-arc-muted"> kg</span>
                  </span>
                  {weights.length > 1 ? (() => {
                    const diff = Number(weights[0].weight) - Number(weights[weights.length - 1].weight)
                    return <span className={`t-caption block mt-2 font-bold ${diff < 0 ? 'text-arc-success' : 'text-arc-muted'}`}>{diff > 0 ? '+' : ''}{diff.toFixed(1)} kg since {weights[weights.length - 1].weight} kg</span>
                  })() : <span className="t-caption block mt-2 text-arc-muted">First weigh-in</span>}
                </>
              ) : (
                <span className="t-caption block mt-2 text-arc-muted">Tick the weekly weigh-in on Today.</span>
              )}
            </div>
          </div>

          <div className="mt-2">
            {photos.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {photos.map(ph => (
                  <button key={ph.name} onClick={() => setViewPhoto(ph)} aria-label={`Progress photo ${ph.date}`} className="shrink-0 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt="" className="w-20 h-28 object-cover rounded-control border border-white/[0.06]" />
                    <span className="absolute bottom-1 left-1 right-1 t-caption text-[9px] font-bold text-white bg-black/60 rounded px-1 py-0.5">
                      {new Date(ph.date + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="t-caption text-arc-muted px-1">Progress photos show here once you take the weekly one on Today.</p>
            )}
          </div>
        </section>

        {/* The one reminder. */}
        <section className="mt-8">
          <SectionLabel>Reminder</SectionLabel>
          <ListRow
            onClick={() => { setNudgeInput(nudgeTime || '07:00'); setEditingNudge(true) }}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={nudgeTime ? 'text-arc-accent' : ''} aria-hidden><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}
            title="Daily reminder"
            caption={!nudgeTime
              ? 'Off. Tap to get one reminder a day.'
              : notifyPermission === 'denied'
                ? `${fmtTime(nudgeTime)}, but notifications are blocked in your settings`
                : `Every day at ${fmtTime(nudgeTime)}`}
          />
        </section>

        {/* Your plan. A member in a gym is covered; a member on their own can pay. */}
        <section className="mt-8">
          <SectionLabel>Your plan</SectionLabel>
          <div className="space-y-1.5">
            {!plan.ready ? null : gymCovers(plan.gymPlan) ? (
              <ListRow
                icon={<span aria-hidden>✅</span>}
                title={`Covered by ${plan.gymName || 'your gym'}`}
                caption="Everything is included through your gym."
              />
            ) : plan.plan === 'premium' ? (
              <ListRow
                icon={<span aria-hidden>✨</span>}
                title={`Premium · ${PREMIUM_PRICE} a month`}
                caption={plan.renewsAt ? `Renews ${new Date(plan.renewsAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : 'Coach, food scanning and history.'}
                trailing={<Button variant="secondary" size="sm" onClick={manageBilling} disabled={billingBusy}>Manage</Button>}
              />
            ) : plan.plan === 'past_due' ? (
              <ListRow
                tone="warning"
                icon={<span aria-hidden>⚠️</span>}
                title="Payment did not go through"
                caption="Update your card to keep Premium."
                trailing={<Button variant="primary" size="sm" onClick={manageBilling} disabled={billingBusy}>Fix</Button>}
              />
            ) : (
              <ListRow
                tone="accent"
                onClick={goPremium}
                icon={<span aria-hidden>✨</span>}
                title={`Go Premium · ${PREMIUM_PRICE} a month`}
                caption={plan.gymPlan === 'lapsed'
                  ? `${plan.gymName || 'Your gym'}'s plan has ended. Coach and food scanning come back when it renews, or go Premium on your own.`
                  : 'Coach, food scanning and history. Cancel any time. Free through a gym on Arctivate.'}
              />
            )}
            {billingMsg && <p className="t-caption text-arc-muted px-1">{billingMsg}</p>}
          </div>
        </section>

        {/* Simple mode: only what is necessary. */}
        <section className="mt-8">
          <SectionLabel>Simple mode</SectionLabel>
          <ListRow
            onClick={() => setSimpleMode(!simple)}
            tone={simple ? 'accent' : 'default'}
            icon={<span aria-hidden>🧘</span>}
            title="Simple mode"
            caption={simple ? 'On. Just Today, Train, Challenge and Feed.' : 'Hide Food, the coach, the weekly habits, and workout photos and notes.'}
            trailing={
              <span role="switch" aria-checked={simple} className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors duration-fast ${simple ? 'bg-arc-accent justify-end' : 'bg-white/10 justify-start'}`}>
                <span className="w-5 h-5 rounded-full bg-white shadow" />
              </span>
            }
          />
        </section>

        {/* Your gym: who you are ranked against, and how to run one. */}
        <section className="mt-8">
          <SectionLabel>Your gym</SectionLabel>
          <div className="space-y-1.5">
            {gym ? (
              isStaff ? (
                <ListRow
                  href="/gym"
                  tone="accent"
                  icon={<span aria-hidden>🏋️</span>}
                  title={gym.name}
                  caption="You run this gym. See who is active, at risk and quiet."
                />
              ) : (
                <ListRow
                  icon={<span aria-hidden>🏋️</span>}
                  title={gym.name}
                  caption={gym.city ? `${gym.city} · your leaderboard and challenges` : 'Your leaderboard and challenges'}
                />
              )
            ) : (
              <ListRow icon={<span aria-hidden>🏋️</span>} title="No gym yet" caption="Join one with a code from the front desk." />
            )}
            <ListRow
              onClick={() => { setGymSheet('join'); setGymError('') }}
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>}
              title={gym ? 'Join a different gym' : 'Join a gym'}
              caption="Enter the six-letter code"
            />
            {!isStaff && (
              <ListRow
                onClick={() => { setGymSheet('create'); setGymError('') }}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>}
                title="Run a gym? Start one"
                caption="Free 30-day pilot. Your members join with a code."
              />
            )}
          </div>
        </section>

        {/* Appearance — light / dark mode */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.27 }}
          className="bg-arc-card border border-white/5 rounded-2xl p-5 mt-8"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Appearance</span>
            <span className="text-[10px] font-bold text-arc-accent uppercase tracking-widest">{theme === 'light' ? 'Light' : 'Dark'}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-arc-surface rounded-xl p-1 border border-white/5">
            <button
              onClick={() => chooseTheme('dark')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-colors ${theme === 'dark' ? 'bg-arc-accent text-white shadow-glow' : 'text-arc-muted hover:text-white'}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              Dark
            </button>
            <button
              onClick={() => chooseTheme('light')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-colors ${theme === 'light' ? 'bg-arc-accent text-white shadow-glow' : 'text-arc-muted hover:text-white'}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              Light
            </button>
          </div>
        </motion.div>

        {/* Send Feedback */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="mt-4"
        >
          <button
            onClick={() => router.push('/feedback')}
            className="w-full bg-arc-surface border border-white/5 text-arc-muted font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:text-white hover:border-white/10 transition-colors"
          >
            <ChatIcon size={15} />
            <span>Send Feedback</span>
          </button>
        </motion.div>

        {/* Sign Out */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 mb-4"
        >
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full bg-arc-surface border border-white/5 text-arc-muted font-bold py-4 rounded-2xl flex items-center justify-center gap-3 hover:text-white hover:border-white/10 transition-colors disabled:opacity-50"
          >
            {isSigningOut ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
              />
            ) : (
              <>
                <LogOutIcon />
                <span>Sign Out</span>
              </>
            )}
          </button>
        </motion.div>

        {/* Delete Account */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-4"
        >
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full text-red-400/60 text-xs font-medium py-3 hover:text-red-400 transition-colors"
            >
              Delete Account
            </button>
          ) : (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 space-y-3">
              <p className="text-sm text-red-400 font-bold">This will permanently delete your account and all data.</p>
              <p className="text-xs text-arc-muted">Type <span className="font-bold text-white">DELETE</span> to confirm:</p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full bg-black/30 border border-red-500/20 p-3 rounded-xl text-white outline-none focus:border-red-500 transition text-sm"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-arc-muted text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-30 transition"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* App Version */}
        <div className="text-center text-[10px] text-arc-muted/40 pb-4">
          Arctivate v1.0.0
        </div>
      </main>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-6 z-50 pb-safe"
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-black italic tracking-tighter text-center mb-6">EDIT PROFILE</h2>

              <div className="space-y-4">
                {/* Avatar upload */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-24 h-24 rounded-full overflow-hidden bg-arc-surface border border-white/10">
                    {editAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={editAvatarUrl} alt="Profile preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl font-black text-arc-muted">
                        {editUsername?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    {isUploadingAvatar && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <label className="text-[10px] font-bold text-arc-accent uppercase tracking-widest cursor-pointer hover:text-white transition-colors min-h-[44px] flex items-center">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarPick}
                      disabled={isUploadingAvatar}
                      className="hidden"
                    />
                    {isUploadingAvatar ? 'Uploading…' : 'Change photo'}
                  </label>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
                    autoFocus
                  />
                </div>

                {/* Body metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Age</label>
                    <input
                      type="number" inputMode="numeric" value={editAge}
                      onChange={(e) => setEditAge(e.target.value)} placeholder="—"
                      className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Weight kg</label>
                    <input
                      type="number" inputMode="decimal" value={editWeight}
                      onChange={(e) => setEditWeight(e.target.value)} placeholder="—"
                      className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Height cm</label>
                    <input
                      type="number" inputMode="decimal" value={editHeight}
                      onChange={(e) => setEditHeight(e.target.value)} placeholder="—"
                      className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">
                    Daily Calorie Goal
                  </label>
                  <input
                    type="number"
                    value={editCalorieGoal}
                    onChange={(e) => setEditCalorieGoal(e.target.value)}
                    placeholder="2800"
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold text-center text-2xl"
                  />
                  <p className="text-[10px] text-arc-muted mt-2 text-center">
                    Recommended: 1800-3500 calories per day
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-arc-surface text-white font-bold py-4 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving || !editUsername.trim()}
                  className="flex-1 bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {gymSheet && (
        <>
          <div onClick={() => !gymBusy && setGymSheet(null)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
          <div className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] z-50">
            <div className="p-6 space-y-4 pb-safe max-w-lg mx-auto">
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
              {gymSheet === 'join' ? (
                <>
                  <div>
                    <h2 className="t-title text-white" style={{ fontSize: 20 }}>Join a gym</h2>
                    <p className="t-caption text-arc-muted mt-0.5">The code is on the wall or at the front desk. Everything you have logged comes with you.</p>
                  </div>
                  <Field
                    label="Gym code"
                    value={gymCode}
                    onChange={(e) => setGymCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                    placeholder="ABC123"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck="false"
                    autoFocus
                    error={gymError}
                    className="[&_input]:tracking-[0.3em] [&_input]:font-black [&_input]:text-[20px]"
                  />
                  <div className="flex gap-2">
                    <Button variant="primary" className="flex-1" onClick={joinGym} disabled={gymBusy || gymCode.length < 6}>{gymBusy ? 'Joining…' : 'Join'}</Button>
                    <Button variant="tertiary" onClick={() => setGymSheet(null)} disabled={gymBusy}>Cancel</Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h2 className="t-title text-white" style={{ fontSize: 20 }}>Start a gym</h2>
                    <p className="t-caption text-arc-muted mt-0.5">You become its owner and move into it. You get a code your members join with, and a page that shows who is active, at risk and quiet. Free for 30 days.</p>
                  </div>
                  <Field label="Gym name" value={gymName} onChange={(e) => setGymName(e.target.value.slice(0, 60))} placeholder="e.g. Iron & Oak Fitness" autoFocus error={gymError} />
                  <Field label="Suburb or city" value={gymCity} onChange={(e) => setGymCity(e.target.value.slice(0, 60))} placeholder="Optional" />
                  <div className="flex gap-2">
                    <Button variant="primary" className="flex-1" onClick={createGym} disabled={gymBusy || gymName.trim().length < 2}>{gymBusy ? 'Starting…' : 'Start the gym'}</Button>
                    <Button variant="tertiary" onClick={() => setGymSheet(null)} disabled={gymBusy}>Cancel</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {editingNudge && (
        <>
          <div onClick={() => !savingNudge && setEditingNudge(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
          <div role="dialog" aria-label="Daily reminder" className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] z-50">
            <div className="p-6 space-y-4 pb-safe max-w-lg mx-auto">
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
              <div>
                <h2 className="t-title text-white" style={{ fontSize: 20 }}>Daily reminder</h2>
                <p className="t-caption text-arc-muted mt-0.5">One nudge a day to tick today off.</p>
              </div>
              <input
                id="f-nudge"
                type="time"
                value={nudgeInput}
                onChange={(e) => setNudgeInput(e.target.value)}
                aria-label="Remind me at"
                className="w-full h-16 px-4 rounded-control bg-arc-surface2 border border-white/[0.08] text-white text-center text-3xl font-bold outline-none focus:border-arc-accent [color-scheme:dark]"
              />
              <div className="flex gap-2">
                <Button variant="primary" className="flex-1" onClick={() => saveNudge(false)} disabled={savingNudge}>{savingNudge ? 'Saving…' : 'Save'}</Button>
                {nudgeTime
                  ? <Button variant="tertiary" onClick={() => saveNudge(true)} disabled={savingNudge}>Turn off</Button>
                  : <Button variant="tertiary" onClick={() => setEditingNudge(false)} disabled={savingNudge}>Cancel</Button>}
              </div>
            </div>
          </div>
        </>
      )}

      {viewPhoto && (
        <div role="dialog" aria-label="Progress photo" className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex items-center gap-2 px-4 h-14 pt-safe">
            <span className="flex-1 t-body font-bold text-white">
              {new Date(viewPhoto.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <Button variant="tertiary" size="sm" onClick={() => deletePhoto(viewPhoto)}>Delete</Button>
            <Button variant="secondary" size="sm" onClick={() => setViewPhoto(null)}>Close</Button>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-4" onClick={() => setViewPhoto(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewPhoto.url} alt="" className="max-w-full max-h-full object-contain rounded-control" />
          </div>
        </div>
      )}

      <Nav />
    </div>
  )
}
