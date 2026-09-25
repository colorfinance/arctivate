import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Nav from '../components/Nav'
import Masthead, { MastheadAction } from '../components/Masthead'
import Button from '../components/Button'
import Avatar from '../components/Avatar'
import LoadingState from '../components/LoadingState'
import { Banner, ListRow, EmptyState, SectionLabel } from '../components/ui'
import { supabase } from '../lib/supabaseClient'
import { localTimezone } from '../lib/streaks'
import Field from '../components/Field'

// The gym's pulse.
//
// This is the screen a gym owner is paying for: is the app working on my
// members. Four numbers, then the two lists that turn into a text message
// at the front desk -- who is about to lose a streak today, and who has gone
// quiet this week. Everything else (the challenge, the join code) is here
// because the owner acts on it, not because it exists.
//
// Members never see this. The pulse comes from gym_pulse(), which refuses
// anyone who is not staff of the gym.

const fmtDay = (iso) => {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

function Stat({ label, value, sub, tone = 'default' }) {
  const tones = { default: 'text-white', good: 'text-arc-success', warn: 'text-arc-warning' }
  return (
    <div className="rounded-container bg-arc-surface2/60 border border-white/[0.05] px-4 py-3">
      <span className="t-label text-arc-muted block">{label}</span>
      <span className={`t-num block text-[28px] font-black leading-none mt-1.5 ${tones[tone] || tones.default}`}>{value}</span>
      {sub && <span className="t-caption text-arc-muted block mt-1">{sub}</span>}
    </div>
  )
}

export default function GymPulse() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [gym, setGym] = useState(null)
  const [isStaff, setIsStaff] = useState(false)
  const [pulse, setPulse] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  // The members list, with who has not signed in yet, and the sheet that
  // adds one. Emails come from auth, so both go through a route.
  const [clients, setClients] = useState(null)
  const [adding, setAdding] = useState(false)
  const [cName, setCName] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cBusy, setCBusy] = useState(false)
  const [cError, setCError] = useState('')
  const [cNotice, setCNotice] = useState('')
  const [showAllClients, setShowAllClients] = useState(false)

  const authHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  const loadClients = async () => {
    try {
      const res = await fetch('/api/gym/clients/', { headers: await authHeaders() })
      const body = await res.json().catch(() => ({}))
      if (res.ok) setClients(body.members || [])
    } catch {}
  }

  const addClient = async () => {
    if (cBusy) return
    setCBusy(true); setCError(''); setCNotice('')
    try {
      const res = await fetch('/api/gym/invite/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ name: cName, email: cEmail }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setCError(body.error || 'Could not send the invite'); return }
      setCNotice(`Invite sent to ${cEmail.trim()}.`)
      setCName(''); setCEmail('')
      loadClients()
    } catch {
      setCError('Could not reach the server')
    } finally {
      setCBusy(false)
    }
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/'); return }
    const { data: me } = await supabase.from('profiles').select('gym_id, is_admin').eq('id', user.id).single()
    if (!me?.gym_id) { setLoading(false); return }
    const { data: g } = await supabase.from('gyms').select('id, name, city, join_code, plan, pilot_ends_at').eq('id', me.gym_id).single()
    setGym(g || null)
    const { data: staff } = await supabase.rpc('is_gym_staff', { p_gym: me.gym_id })
    setIsStaff(!!staff)
    if (staff) {
      const { data, error } = await supabase.rpc('gym_pulse', { p_gym: me.gym_id, p_tz: localTimezone() })
      if (error) setError('Could not load the pulse. Pull to try again.')
      else setPulse(data)
      loadClients()
    }
    setLoading(false)
  }, [router])

  useEffect(() => { load() }, [load])

  const copyCode = async () => {
    if (!gym?.join_code) return
    try {
      await navigator.clipboard.writeText(gym.join_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  const shareCode = async () => {
    if (!gym?.join_code) return
    const text = `Join ${gym.name} on Arctivate. Open the app, go to Profile, and enter the gym code ${gym.join_code}.`
    if (navigator.share) { try { await navigator.share({ text }) } catch {} }
    else copyCode()
  }

  const saveName = async () => {
    const clean = nameDraft.trim().slice(0, 60)
    if (clean.length < 2 || !gym) return
    const { error } = await supabase.from('gyms').update({ name: clean }).eq('id', gym.id)
    if (!error) { setGym(g => ({ ...g, name: clean })); setRenaming(false) }
  }

  if (loading) return <LoadingState label="Loading your gym…" />

  // A member without a gym, or a member who is not staff, does not get the
  // numbers. They get the one thing that is theirs: how to get a gym in.
  if (!gym || !isStaff) {
    return (
      <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
        <Masthead title="Your gym" back />
        <main className="pt-20 px-4 max-w-lg mx-auto">
          <EmptyState
            title={gym ? `${gym.name} is run by someone else` : 'You are not in a gym yet'}
            body={gym
              ? 'Only the people who run the gym see its numbers. If that is you, ask whoever set it up to add you.'
              : 'Ask your gym for its code and enter it on your profile. Run a gym? Start one and your members join with a code.'}
            action={<Button variant="primary" href="/profile">Go to profile</Button>}
          />
        </main>
        <Nav />
      </div>
    )
  }

  const p = pulse || {}
  const pct = (n) => (p.members ? Math.round((n / p.members) * 100) : 0)
  const pilotDays = gym.pilot_ends_at ? Math.ceil((new Date(gym.pilot_ends_at + 'T00:00:00') - new Date()) / 86400000) : null

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
      <Masthead
        title={gym.name}
        subtitle={gym.city || 'Your gym'}
        back
        actions={
          <MastheadAction onClick={() => { setNameDraft(gym.name); setRenaming(true) }} label="Rename gym">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
          </MastheadAction>
        }
      />

      <main className="pt-20 px-4 max-w-lg mx-auto space-y-6">
        {error && <Banner tone="warning" title={error} />}

        {gym.plan === 'pilot' && (
          <Banner
            tone="info"
            title={pilotDays > 0 ? `Free pilot · ${pilotDays} day${pilotDays === 1 ? '' : 's'} left` : 'Free pilot'}
            body="Members stay free. When the pilot ends we will be in touch about the gym plan."
          />
        )}

        {renaming && (
          <div className="rounded-container bg-arc-surface2/60 border border-white/[0.06] p-4 space-y-3">
            <label className="t-label text-arc-muted block">Gym name</label>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={60}
              autoFocus
              className="w-full h-12 px-4 rounded-control bg-arc-surface2 border border-white/[0.08] text-[15px] text-white outline-none focus:border-arc-accent"
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={saveName} disabled={nameDraft.trim().length < 2}>Save</Button>
              <Button variant="tertiary" size="sm" onClick={() => setRenaming(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* The four numbers. Active today is the one that moves; the rest say
            whether it is a good day or a good gym. */}
        <section>
          <SectionLabel trailing={<span className="t-caption text-arc-muted">{fmtDay(p.today)}</span>}>Pulse</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Active today" value={p.active_today ?? 0} sub={`${pct(p.active_today ?? 0)}% of members`} tone={p.active_today > 0 ? 'good' : 'default'} />
            <Stat label="This week" value={p.active_7d ?? 0} sub={`${pct(p.active_7d ?? 0)}% active`} />
            <Stat label="This month" value={p.active_30d ?? 0} sub={`${pct(p.active_30d ?? 0)}% active`} />
            <Stat label="Members" value={p.members ?? 0} sub={p.signups_30d ? `+${p.signups_30d} this month` : 'No new sign-ups this month'} />
          </div>
        </section>

        {/* Who to text. A streak that ends today is a member you can still
            keep with one message; the quiet list is who you have already
            half lost. */}
        <section>
          <SectionLabel trailing={<span className="t-caption text-arc-muted">{(p.at_risk || []).length}</span>}>Streak at risk today</SectionLabel>
          {(p.at_risk || []).length === 0 ? (
            <p className="t-body text-arc-muted px-1">Nobody. Everyone with a streak has already shown up today.</p>
          ) : (
            <div className="space-y-1.5">
              {p.at_risk.map(m => (
                <ListRow
                  key={m.id}
                  tone="warning"
                  icon={<Avatar src={m.avatar} name={m.name} size={36} />}
                  title={m.name}
                  caption={`${m.streak}-day streak · nothing yet today`}
                  trailing={<span className="t-caption font-bold text-arc-warning">🔥 {m.streak}</span>}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionLabel trailing={<span className="t-caption text-arc-muted">{(p.quiet || []).length}</span>}>Gone quiet</SectionLabel>
          {(p.quiet || []).length === 0 ? (
            <p className="t-body text-arc-muted px-1">Nobody has dropped off this week.</p>
          ) : (
            <div className="space-y-1.5">
              {p.quiet.map(m => (
                <ListRow
                  key={m.id}
                  icon={<Avatar src={m.avatar} name={m.name} size={36} />}
                  title={m.name}
                  caption={`Last active ${fmtDay(m.last_active)}`}
                  trailing={<span className="t-caption text-arc-muted">{m.days}d</span>}
                />
              ))}
            </div>
          )}
          {p.never_started > 0 && (
            <p className="t-caption text-arc-muted px-1 mt-2">
              {p.never_started} member{p.never_started === 1 ? ' has' : 's have'} logged nothing in the last 60 days.
            </p>
          )}
        </section>

        {p.challenge && (
          <section>
            <SectionLabel>Gym challenge</SectionLabel>
            <ListRow
              href="/challenges"
              icon={<span className="text-base" aria-hidden>🏁</span>}
              title={p.challenge.title}
              caption={`${p.challenge.in_it} in it · ${p.challenge.done_today} banked today`}
            />
          </section>
        )}

        {/* Your clients. Add one by email and they get a sign-in link that
            lands them in this gym with their name already on the profile. */}
        <section>
          <SectionLabel trailing={<span className="t-caption text-arc-muted">{clients ? clients.length : ''}</span>}>Members</SectionLabel>
          <Button variant="primary" block onClick={() => { setAdding(true); setCError(''); setCNotice('') }}>Add a client</Button>
          {clients && clients.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {(showAllClients ? clients : clients.slice(0, 6)).map(c => (
                <ListRow
                  key={c.id}
                  icon={<Avatar name={c.name} size={36} />}
                  title={c.name || 'Member'}
                  caption={c.email || ''}
                  trailing={
                    c.invited
                      ? <span className="t-caption font-bold text-arc-warning">Invited</span>
                      : <span className="t-caption font-bold text-arc-success">In</span>
                  }
                />
              ))}
              {clients.length > 6 && (
                <button onClick={() => setShowAllClients(v => !v)} className="w-full t-caption font-bold text-arc-muted hover:text-white py-2">
                  {showAllClients ? 'Show fewer' : `Show all ${clients.length}`}
                </button>
              )}
            </div>
          )}
          <p className="t-caption text-arc-muted px-1 mt-2">Or put the code below on the wall and let them join themselves.</p>
        </section>

        {/* The code on the front desk. */}
        <section>
          <SectionLabel>Members join with this code</SectionLabel>
          <div className="rounded-container bg-arc-surface2/60 border border-white/[0.06] p-4 flex items-center gap-4">
            <span className="t-num text-[30px] font-black tracking-[0.2em] text-white">{gym.join_code}</span>
            <div className="flex-1 min-w-0" />
            <Button variant="secondary" size="sm" onClick={copyCode}>{copied ? 'Copied' : 'Copy'}</Button>
            <Button variant="primary" size="sm" onClick={shareCode}>Share</Button>
          </div>
          <p className="t-caption text-arc-muted px-1 mt-2">Profile → Your gym → Enter a code. Put it on the wall.</p>
        </section>

        <p className="t-caption text-arc-muted px-1 pb-4">Only staff see this page. Members are never shown each other&apos;s absence.</p>
      </main>

      {adding && (
        <>
          <div onClick={() => !cBusy && setAdding(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
          <div className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] z-50">
            <div className="p-6 space-y-4 pb-safe max-w-lg mx-auto">
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
              <div>
                <h2 className="t-title text-white" style={{ fontSize: 20 }}>Add a client</h2>
                <p className="t-caption text-arc-muted mt-0.5">They get an email with a sign-in link and land in {gym.name} with their name on the profile.</p>
              </div>
              <Field label="Name" value={cName} onChange={(e) => setCName(e.target.value.slice(0, 60))} placeholder="Their first and last name" autoFocus />
              <Field label="Email" type="email" inputMode="email" autoCapitalize="off" autoCorrect="off" spellCheck="false" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="them@example.com" error={cError} hint={cNotice} />
              <div className="flex gap-2">
                <Button variant="primary" className="flex-1" onClick={addClient} disabled={cBusy || cName.trim().length < 2 || !cEmail.includes('@')}>{cBusy ? 'Sending…' : 'Send invite'}</Button>
                <Button variant="tertiary" onClick={() => setAdding(false)} disabled={cBusy}>{cNotice ? 'Done' : 'Cancel'}</Button>
              </div>
            </div>
          </div>
        </>
      )}
      <Nav />
    </div>
  )
}
