import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import { FlagIcon, LockIcon, CheckIcon, TrophyIcon, UsersIcon } from '../components/icons'
import Avatar from '../components/Avatar'
import ProfileButton from '../components/ProfileButton'
import { friendIds, VISIBILITY } from '../lib/social'
import {
  challengeDay, challengeProgress, daysRemaining, daysUntilStart,
  isFinished, hasStarted, findFirstMissedDay, cohortStats, rankMembers, todayStr, daysDone, backfillFrom,
} from '../lib/challenges'
import { STARTER_TASKS, defaultChallengeTitle, startChallengeWith, WAGER_PRESETS, WAGER_MAX } from '../lib/newChallenge'
import { fetchStreaks, streakFor } from '../lib/streaks'
import StreakBanner from '../components/StreakBanner'

export default function Challenges() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)
  const [challenges, setChallenges] = useState([])
  const [members, setMembers] = useState([])       // every membership row, all challenges
  const [names, setNames] = useState({})           // user_id -> display name
  const [busy, setBusy] = useState(null)           // challenge id being joined/left
  const [toast, setToast] = useState(null)
  const [confirmJoin, setConfirmJoin] = useState(null)
  const [confirmLeave, setConfirmLeave] = useState(null)
  const [resetNotice, setResetNotice] = useState(null) // { title, missed }
  const [expanded, setExpanded] = useState(null)
  const [missingTables, setMissingTables] = useState(false)

  // Starting your own and challenging people to it
  const [myGymId, setMyGymId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [people, setPeople] = useState([])        // everyone, for the invite picker
  const [friendships, setFriendships] = useState([])
  const [invites, setInvites] = useState([])      // invites involving me
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', start_date: '', length_days: '30',
    strict: false, visibility: 'gym', gym_vs_gym: false, is_official: false,
    wager: '',
  })
  // Searching the gym from inside the create sheet, so picking who you're up
  // against happens on the same screen as everything else.
  const [createSearch, setCreateSearch] = useState('')
  // Opening the create sheet fills in every answer that has an obvious one.
  // The old sheet asked for nine decisions before anything existed, which is
  // why, across 49 members, only the admin account ever made one.
  const openCreate = (targets = []) => {
    setPrePicked(targets)
    setForm({
      title: '', description: '', start_date: '', length_days: '30',
      strict: false, visibility: 'gym', gym_vs_gym: false, is_official: false,
      wager: '',
    })
    setTaskList([...STARTER_TASKS])
    setTaskDraft('')
    setShowAdvanced(false)
    setCreateSearch('')
    setShowCreate(true)
  }

  const [inviteFor, setInviteFor] = useState(null) // challenge being invited to
  const [invitePicked, setInvitePicked] = useState([])
  // Who the new challenge is aimed at, carried from the hero or from a
  // "Challenge" button on the friends page through to the invite picker.
  const [prePicked, setPrePicked] = useState([])
  const [inviteSearch, setInviteSearch] = useState('')
  const [sendingInvites, setSendingInvites] = useState(false)

  // Each challenge's own checklist
  const [chTasks, setChTasks] = useState([])          // every task I'm allowed to see
  const [myTicks, setMyTicks] = useState(new Set())   // `${task_id}:${date}` I've ticked
  const [taskBusy, setTaskBusy] = useState(null)      // `${task_id}:${date}` in flight
  // Editing a checklist after creation (creator or coach only)
  const [editTasksFor, setEditTasksFor] = useState(null)  // the challenge being edited
  const [editRows, setEditRows] = useState([])            // [{ id?, title }]
  const [editDraft, setEditDraft] = useState('')
  const [savingTasks, setSavingTasks] = useState(false)
  // Tasks being drafted in the create sheet
  const [taskList, setTaskList] = useState([])
  const [taskDraft, setTaskDraft] = useState('')

  // Badges
  const [myBadges, setMyBadges] = useState([])       // everything earned so far
  const [justEarned, setJustEarned] = useState([])   // earned on this load, worth a cheer
  const [showHow, setShowHow] = useState(false)      // "how this works" sheet
  // challenge id -> { members, done_today, ticked_today }. How the rest of the
  // gym is doing today, which is the part a browser cannot work out for itself.
  const [gymToday, setGymToday] = useState({})
  // The create sheet asks one question by default; the rest is behind this.
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [myStreak, setMyStreak] = useState({ current: 0, longest: 0, activeToday: false })

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600) }

  const fetchAll = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      // Every gym has one challenge that is always running, made the first
      // time somebody from that gym opens this page. Before it, a member's
      // first tab read "nothing running yet" and the only way forward was to
      // start one yourself — which is why, across 49 members, nobody had.
      await supabase.rpc('ensure_gym_challenge').then(() => {}, () => {})

      const { data: chData, error: chErr } = await supabase
        .from('group_challenges')
        .select('*')
        .order('start_date', { ascending: false })

      if (chErr) { setMissingTables(true); setLoading(false); return }
      setChallenges(chData || [])

      const { data: memberData } = await supabase
        .from('group_challenge_members')
        .select('*')
      setMembers(memberData || [])

      // Names and faces for the standings. profiles carries `username`; there
      // is no full_name/email column, and asking for one errors the whole
      // query, which is what left every entrant showing as "Member".
      const ids = [...new Set((memberData || []).map(m => m.user_id))]
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', ids)
        const map = {}
        ;(profs || []).forEach(p => { map[p.id] = { name: p.username || 'Member', avatar: p.avatar_url } })
        setNames(map)
      }

      // Everything the create and invite flows need.
      const { data: me } = await supabase
        .from('profiles').select('gym_id, is_admin').eq('id', user.id).single()
      setMyGymId(me?.gym_id || null)
      setIsAdmin(!!me?.is_admin)

      const { data: everyone } = await supabase
        .from('profiles').select('id, username, avatar_url, total_points, gym_id')
      setPeople(everyone || [])

      const { data: fr } = await supabase
        .from('friendships').select('*')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      setFriendships(fr || [])

      const { data: inv } = await supabase
        .from('challenge_invites').select('*')
        .or(`invitee_id.eq.${user.id},inviter_id.eq.${user.id}`)
      setInvites(inv || [])

      // The checklists, and my ticks on the days still open for editing.
      const { data: taskData } = await supabase
        .from('challenge_tasks').select('*').order('position')
      setChTasks(taskData || [])

      const { data: tickData } = await supabase
        .from('challenge_task_logs')
        .select('task_id, date')
        .eq('user_id', user.id)
        .gte('date', backfillFrom(todayStr()))
      setMyTicks(new Set((tickData || []).map(t => `${t.task_id}:${t.date}`)))

      await enforceStrict(user.id, chData || [], memberData || [], taskData || [])

      // The database counts completed days — a browser can only see its own
      // owner's ticks, so it is in no position to score anyone. Runs after the
      // strict check so a reset is reflected in the same pass.
      await supabase.rpc('recalc_my_challenge_progress')
      const { data: scored } = await supabase.from('group_challenge_members').select('*')
      if (scored) setMembers(scored)

      const { data: fresh } = await supabase.rpc('award_my_badges')
      if (fresh?.length) setJustEarned(fresh)

      await refreshGymToday(user.id, chData || [], memberData || [])
      setMyStreak(streakFor(await fetchStreaks(supabase), user.id))

      const { data: mine } = await supabase
        .from('user_badges')
        .select('badge_key, earned_at, badges(key, name, description, icon, sort_order)')
        .eq('user_id', user.id)
      setMyBadges((mine || []).map(r => r.badges).filter(Boolean)
        .sort((a, b) => a.sort_order - b.sort_order))
    } catch {
      setMissingTables(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Arriving from "Challenge" on someone's row opens the create sheet with
  // them already lined up. The query is cleared so a refresh doesn't reopen it.
  const router = useRouter()
  useEffect(() => {
    const target = router.query.invite
    if (!target || loading) return
    openCreate([target])
    router.replace('/challenges', undefined, { shallow: true })
  }, [router, loading])

  // How many people at your gym have ticked today, per challenge you're in.
  // Nobody comes back for a checklist; they come back to see whether the rest
  // of the gym did it too.
  const refreshGymToday = async (uid, chList, memberList) => {
    const mineIds = (memberList || [])
      .filter(m => m.user_id === uid && m.status !== 'left')
      .map(m => m.challenge_id)
    const wanted = (chList || []).filter(c => mineIds.includes(c.id))
    if (!wanted.length) { setGymToday({}); return }
    const pairs = await Promise.all(wanted.map(async (c) => {
      const { data } = await supabase.rpc('challenge_today', { p_challenge_id: c.id })
      const row = Array.isArray(data) ? data[0] : data
      return [c.id, row || null]
    }))
    setGymToday(Object.fromEntries(pairs.filter(([, v]) => v)))
  }

  // Strict challenges send you back to your own Day 1 if you miss a day.
  // Checked here on load, using the same rule the personal challenge uses.
  const enforceStrict = async (uid, chList, memberList, taskData = []) => {
    const mine = memberList.filter(m => m.user_id === uid && m.status === 'active')
    const strictOnes = mine
      .map(m => ({ m, ch: chList.find(c => c.id === m.challenge_id) }))
      .filter(x => x.ch && x.ch.strict && hasStarted(x.ch.start_date))
    if (strictOnes.length === 0) return

    const { data: habitsData } = await supabase
      .from('habits')
      .select('id, created_at, frequency')
      .eq('user_id', uid)
    const dailyHabits = (habitsData || []).filter(h => (h.frequency || 'daily') !== 'weekly')

    const earliest = strictOnes.map(x => x.m.start_date).sort()[0]
    const { data: logs } = await supabase
      .from('habit_logs')
      .select('habit_id, date')
      .eq('user_id', uid)
      .gte('date', earliest)

    // A challenge with its own tasks is judged on those; findFirstMissedDay
    // only needs {id, created_at} rows and {habit_id, date} logs, and tasks
    // fit that shape exactly.
    const { data: taskLogs } = await supabase
      .from('challenge_task_logs')
      .select('task_id, date')
      .eq('user_id', uid)
      .gte('date', earliest)
    const taskLogRows = (taskLogs || []).map(l => ({ habit_id: l.task_id, date: l.date }))

    for (const { m, ch } of strictOnes) {
      // Someone who has completed the whole thing is done — the days after
      // their finish line are not misses.
      if (daysDone(m) >= ch.length_days) continue
      const ownTasks = taskData.filter(t => t.challenge_id === ch.id)
      const judge = ownTasks.length
        ? { dailyHabits: ownTasks, logs: taskLogRows }
        : { dailyHabits, logs: logs || [] }
      if (judge.dailyHabits.length === 0) continue
      const missed = findFirstMissedDay({
        ...judge, startDate: m.start_date, lengthDays: ch.length_days,
      })
      if (!missed) continue
      const today = todayStr()
      const { error } = await supabase
        .from('group_challenge_members')
        .update({ start_date: today, restarts: (m.restarts || 0) + 1, last_checked: today })
        .eq('id', m.id)
      if (!error) {
        setResetNotice({ title: ch.title, missed })
        setMembers(prev => prev.map(r => r.id === m.id
          ? { ...r, start_date: today, restarts: (r.restarts || 0) + 1 } : r))
      }
    }
  }

  const myRow = (challengeId) => members.find(m => m.challenge_id === challengeId && m.user_id === userId)

  // The actual joining, with no busy-guard of its own so that accepting an
  // invite can reuse it. Guarding here would depend on when React had flushed
  // `busy`, and the invite would quietly not join.
  const doJoin = async (ch) => {
    // Someone joining before the start waits for it; joining later starts today.
    const start = hasStarted(ch.start_date) ? todayStr() : String(ch.start_date).slice(0, 10)
    const existing = myRow(ch.id)
    if (existing) {
      // Rejoining something they'd left.
      const { error } = await supabase
        .from('group_challenge_members')
        .update({ status: 'active', start_date: start, last_checked: todayStr() })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('group_challenge_members').insert({
        challenge_id: ch.id,
        user_id: userId,
        start_date: start,
        last_checked: todayStr(),
      })
      if (error) throw error
    }
  }

  const join = async (ch) => {
    if (busy) return
    setBusy(ch.id)
    try {
      await doJoin(ch)
      setConfirmJoin(null)
      await fetchAll()
      showToast(`You're in — ${ch.title}`)
    } catch {
      showToast('Could not join (run migration 031)')
    } finally {
      setBusy(null)
    }
  }

  const leave = async (ch) => {
    if (busy) return
    setBusy(ch.id)
    try {
      const row = myRow(ch.id)
      if (!row) return
      const { error } = await supabase
        .from('group_challenge_members')
        .update({ status: 'left' })
        .eq('id', row.id)
      if (error) throw error
      setConfirmLeave(null)
      await fetchAll()
      showToast(`Left ${ch.title}`)
    } catch {
      showToast('Could not leave')
    } finally {
      setBusy(null)
    }
  }

  // --- Starting your own -----------------------------------------------------

  const createChallenge = async () => {
    if (creating) return
    // A name is the one thing worth asking for, and even that has an answer
    // if they'd rather just start.
    const title = form.title.trim() || defaultChallengeTitle()
    const length = parseInt(form.length_days, 10)
    if (!length || length < 1 || length > 400) { showToast('Length must be 1 to 400 days'); return }

    setCreating(true)
    try {
      // One operation: the challenge, its checklist, you in it, and the
      // invites. Tapping someone's face used to create a challenge and then
      // ask again who it was for, which is the same question twice.
      const { challenge, invited } = await startChallengeWith(supabase, {
        userId,
        gymId: myGymId,
        title,
        description: form.description.trim() || null,
        lengthDays: length,
        startDate: form.start_date || todayStr(),
        taskTitles: taskList,
        opponentIds: prePicked,
        visibility: form.visibility,
        strict: form.strict,
        wager: form.wager,
        gymVsGym: form.gym_vs_gym,
        isOfficial: isAdmin ? form.is_official : false,
      })

      setShowCreate(false)
      setForm({
        title: '', description: '', start_date: '', length_days: '30',
        strict: false, visibility: 'gym', gym_vs_gym: false, is_official: false,
        wager: '',
      })
      setTaskList([])
      setTaskDraft('')
      setCreateSearch('')
      setPrePicked([])
      await fetchAll()

      if (invited > 0) {
        showToast(invited === 1 ? 'Challenge sent 🥊' : `Challenge sent to ${invited} people 🥊`)
      } else {
        // Nobody named yet, so the picker is the obvious next thing rather
        // than an interruption.
        showToast('Started. Now pick who you\u2019re up against.')
        setInviteFor(challenge)
        setInvitePicked([])
      }
    } catch {
      showToast('Could not create (run migration 032)')
    } finally {
      setCreating(false)
    }
  }

  const sendInvites = async () => {
    if (sendingInvites || !inviteFor || invitePicked.length === 0) return
    setSendingInvites(true)
    try {
      const rows = invitePicked.map(id => ({
        challenge_id: inviteFor.id,
        inviter_id: userId,
        invitee_id: id,
      }))
      // A declined invite blocks the unique key, and the invitee is the only
      // one allowed to update it — so asking again means clearing the old
      // answer first. Without this the toast said "Challenged" while the
      // database quietly kept the decline.
      const declined = invites
        .filter(i => i.challenge_id === inviteFor.id && i.status === 'declined'
          && invitePicked.includes(i.invitee_id))
        .map(i => i.id)
      if (declined.length) {
        await supabase.from('challenge_invites').delete().in('id', declined)
      }
      // Someone already invited shouldn't block the rest of the batch.
      const { error } = await supabase
        .from('challenge_invites')
        .upsert(rows, { onConflict: 'challenge_id,invitee_id', ignoreDuplicates: true })
      if (error) throw error

      const n = invitePicked.length
      setInviteFor(null)
      setInvitePicked([])
      setInviteSearch('')
      await fetchAll()
      showToast(`Challenged ${n} ${n === 1 ? 'person' : 'people'}`)
    } catch {
      showToast('Could not send those')
    } finally {
      setSendingInvites(false)
    }
  }

  const respondInvite = async (invite, accept) => {
    if (busy) return
    setBusy(invite.id)
    try {
      // Join first. If the join fails the invite stays pending and the card
      // stays on screen — the other order consumed the invite with nothing
      // to show for it and no way to accept again.
      if (accept) {
        const ch = challenges.find(c => c.id === invite.challenge_id)
        if (ch) await doJoin(ch)
      }
      const { error } = await supabase
        .from('challenge_invites')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', invite.id)
      if (error) throw error
      await fetchAll()
      showToast(accept ? "You're in" : 'Declined')
    } catch {
      showToast('Could not do that')
    } finally {
      setBusy(null)
    }
  }

  const today = todayStr()
  const myFriendIds = friendIds(friendships, userId)
  const pendingForMe = invites.filter(i => i.invitee_id === userId && i.status === 'pending')

  // The invite picker puts friends first, then people from your own gym.
  // Who a brand new challenge can be aimed at. Same ordering as the invite
  // picker -- friends, then your gym, then everyone -- because "who would I
  // call out" has the same answer in both places.
  const createTargets = (() => {
    const q = createSearch.trim().toLowerCase()
    return people
      .filter(p => p.id !== userId && p.username)
      .filter(p => !q || String(p.username || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const fa = myFriendIds.includes(a.id) ? 0 : 1
        const fb = myFriendIds.includes(b.id) ? 0 : 1
        if (fa !== fb) return fa - fb
        const ga = a.gym_id === myGymId ? 0 : 1
        const gb = b.gym_id === myGymId ? 0 : 1
        if (ga !== gb) return ga - gb
        return (Number(b.total_points) || 0) - (Number(a.total_points) || 0)
      })
      .slice(0, 30)
  })()

  const togglePrePicked = (id) => {
    setPrePicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const invitable = (() => {
    if (!inviteFor) return []
    const q = inviteSearch.trim().toLowerCase()
    const alreadyIn = new Set(
      members.filter(m => m.challenge_id === inviteFor.id && m.status !== 'left').map(m => m.user_id)
    )
    const alreadyAsked = new Set(
      invites.filter(i => i.challenge_id === inviteFor.id && i.status !== 'declined').map(i => i.invitee_id)
    )
    return people
      .filter(p => p.id !== userId && p.username && !alreadyIn.has(p.id) && !alreadyAsked.has(p.id))
      .filter(p => !q || String(p.username || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const fa = myFriendIds.includes(a.id) ? 0 : 1
        const fb = myFriendIds.includes(b.id) ? 0 : 1
        if (fa !== fb) return fa - fb
        const ga = a.gym_id === myGymId ? 0 : 1
        const gb = b.gym_id === myGymId ? 0 : 1
        if (ga !== gb) return ga - gb
        return (Number(b.total_points) || 0) - (Number(a.total_points) || 0)
      })
      .slice(0, 40)
  })()

  // The faces on the hero: friends first, then your own gym, so the commonest
  // move — calling out someone you actually train with — is one tap.
  const quickTargets = people
    .filter(p => p.id !== userId && p.username)
    .filter(p => myFriendIds.includes(p.id) || (myGymId && p.gym_id === myGymId))
    .sort((a, b) => {
      const fa = myFriendIds.includes(a.id) ? 0 : 1
      const fb = myFriendIds.includes(b.id) ? 0 : 1
      if (fa !== fb) return fa - fb
      return (Number(b.total_points) || 0) - (Number(a.total_points) || 0)
    })
    .slice(0, 8)

  if (loading) {
    return (
      <div className="min-h-screen bg-arc-bg text-white flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-arc-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  // Ticking one task on one day. Points move with the tick both ways, and
  // when the last task of the day goes green the day is banked immediately —
  // the recount runs so the card and standings agree without a reload.
  const tickTask = async (task, date, tasksForDay) => {
    const key = `${task.id}:${date}`
    if (taskBusy) return
    setTaskBusy(key)
    const had = myTicks.has(key)
    const next = new Set(myTicks)
    had ? next.delete(key) : next.add(key)
    setMyTicks(next)
    try {
      if (had) {
        const { error } = await supabase
          .from('challenge_task_logs')
          .delete().eq('task_id', task.id).eq('user_id', userId).eq('date', date)
        if (error) throw error
        await supabase.rpc('increment_points', { row_id: userId, x: -10 })
      } else {
        const { error } = await supabase.from('challenge_task_logs').insert({
          task_id: task.id, user_id: userId, date,
        })
        if (error && error.code !== '23505') throw error
        await supabase.rpc('increment_points', { row_id: userId, x: 10 })
      }

      const dayComplete = !had && tasksForDay.every(t => next.has(`${t.id}:${date}`))
      if (dayComplete) {
        await supabase.rpc('recalc_my_challenge_progress')
        const { data: scored } = await supabase.from('group_challenge_members').select('*')
        if (scored) setMembers(scored)
        const { data: fresh } = await supabase.rpc('award_my_badges')
        if (fresh?.length) setJustEarned(fresh)
        showToast(date === todayStr() ? 'Day banked 🔥' : 'Caught up — day banked')
      }
    } catch {
      setMyTicks(myTicks)
      showToast('Could not save that')
    } finally {
      setTaskBusy(null)
    }
  }

  // --- Editing a checklist after creation ------------------------------------

  const openTaskEditor = (ch) => {
    setEditTasksFor(ch)
    setEditRows(chTasks.filter(t => t.challenge_id === ch.id).map(t => ({ id: t.id, title: t.title })))
    setEditDraft('')
  }

  // Applies the difference between what's on screen and what's stored.
  // Renames are cosmetic. An added task only exists from now, so the
  // created_at guard means it can't fail anyone's yesterday. Removing a task
  // deletes its ticks with it, which only ever makes past days easier.
  const saveTasks = async () => {
    if (savingTasks || !editTasksFor) return
    setSavingTasks(true)
    try {
      const chId = editTasksFor.id
      const orig = chTasks.filter(t => t.challenge_id === chId)
      const keep = editRows.map(r => ({ ...r, title: r.title.trim() })).filter(r => r.title)

      const removed = orig.filter(o => !keep.some(k => k.id === o.id)).map(o => o.id)
      if (removed.length) {
        const { error } = await supabase.from('challenge_tasks').delete().in('id', removed)
        if (error) throw error
      }
      for (let i = 0; i < keep.length; i++) {
        const r = keep[i]
        if (!r.id) continue
        const was = orig.find(o => o.id === r.id)
        if (was && (was.title !== r.title || was.position !== i)) {
          const { error } = await supabase
            .from('challenge_tasks').update({ title: r.title, position: i }).eq('id', r.id)
          if (error) throw error
        }
      }
      const added = keep.map((r, i) => ({ r, i })).filter(x => !x.r.id)
      if (added.length) {
        const { error } = await supabase.from('challenge_tasks').insert(
          added.map(x => ({ challenge_id: chId, title: x.r.title, position: x.i }))
        )
        if (error) throw error
      }

      // The definition of "a day" just changed, so recount and refresh.
      const { data: taskData } = await supabase
        .from('challenge_tasks').select('*').order('position')
      setChTasks(taskData || [])
      await supabase.rpc('recalc_my_challenge_progress')
      const { data: scored } = await supabase.from('group_challenge_members').select('*')
      if (scored) setMembers(scored)

      setEditTasksFor(null)
      showToast('Checklist updated')
    } catch {
      showToast('Could not save the checklist')
    } finally {
      setSavingTasks(false)
    }
  }

  // The ones you're in lead the page; everything else is something to join.
  const amIn = (ch) => {
    const row = myRow(ch.id)
    return !!row && row.status !== 'left'
  }
  const joinedChallenges = challenges.filter(amIn)

  // Your gym's own challenge, when you haven't joined it. One tap, no form,
  // nobody to call out.
  const gymChallenge = challenges.find(ch => ch.is_official && ch.gym_id && ch.gym_id === myGymId)
  const gymChallengeToJoin = gymChallenge && !amIn(gymChallenge) ? gymChallenge : null

  // It leads the page in its own card, so listing it again under "open to
  // join" would offer the same thing twice.
  const openChallenges = challenges.filter(ch => !amIn(ch) && ch.id !== gymChallengeToJoin?.id)

  // Everything you have to tick today, across everything you're in. Usually
  // one challenge with three lines on it — which is the point.
  const todayRows = joinedChallenges.map(ch => {
    const mine = myRow(ch.id)
    if (!mine || !hasStarted(ch.start_date, today)) return null
    const day = daysDone(mine)
    if (isFinished(day, ch.length_days)) return null
    const tasks = chTasks.filter(t => t.challenge_id === ch.id)
    if (!tasks.length) return null
    const doneToday = tasks.filter(t => myTicks.has(`${t.id}:${today}`)).length
    return { ch, mine, day, tasks, doneToday }
  }).filter(Boolean)

  // One challenge card. Lifted out of the list so the page can show the
  // ones you are in separately from the ones you could join, without
  // keeping two copies of the card.
  const renderChallenge = (ch) => {
    const all = members.filter(m => m.challenge_id === ch.id)
    const mine = all.find(m => m.user_id === userId)
    const joined = mine && mine.status !== 'left'
    const stats = cohortStats(all, ch, today)
    const started = hasStarted(ch.start_date, today)
    const day = joined ? daysDone(mine) : 0
    const ownTasks = chTasks.filter(t => t.challenge_id === ch.id)
    const done = joined && isFinished(day, ch.length_days)
    const pct = challengeProgress(day, ch.length_days)
    const untilStart = daysUntilStart(ch.start_date, today)
    const standings = rankMembers(all)

    return (
      <motion.section
        key={ch.id}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className={`bg-arc-card border rounded-2xl overflow-hidden ${joined ? 'border-arc-accent/30' : 'border-white/5'}`}
      >
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-black italic tracking-tighter leading-tight">{ch.title}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] text-arc-muted font-bold uppercase tracking-wider">
                  {ch.length_days} days
                </span>
                {ch.strict && (
                  <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                    <LockIcon size={9} /> Strict
                  </span>
                )}
                {!started && (
                  <span className="text-[9px] font-bold text-arc-cyan bg-arc-cyan/10 border border-arc-cyan/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Starts in {untilStart}d
                  </span>
                )}
                {!ch.is_active && (
                  <span className="text-[9px] font-bold text-arc-muted bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Closed
                  </span>
                )}
                {ch.gym_vs_gym && (
                  <span className="text-[9px] font-bold text-arc-cyan bg-arc-cyan/10 border border-arc-cyan/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Gym vs gym
                  </span>
                )}
                {ch.is_official ? (
                  <span className="text-[9px] font-bold text-arc-accent bg-arc-accent/10 border border-arc-accent/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Official
                  </span>
                ) : ch.created_by && ch.created_by !== userId ? (
                  <span className="text-[9px] font-bold text-arc-muted uppercase tracking-wider">
                    by {names[ch.created_by]?.name || people.find(p => p.id === ch.created_by)?.username || 'a member'}
                  </span>
                ) : ch.created_by === userId ? (
                  <span className="text-[9px] font-bold text-arc-muted uppercase tracking-wider">Yours</span>
                ) : null}
              </div>
            </div>
            {joined && (
              <div className="text-right shrink-0">
                <div className="text-2xl font-black italic text-arc-accent leading-none">
                  {done ? <CheckIcon size={22} className="inline" /> : started ? day : '—'}
                </div>
                <div className="text-[9px] text-arc-muted uppercase tracking-wider mt-0.5">
                  {done ? 'Done' : started ? (day === 1 ? 'Day done' : 'Days done') : 'Waiting'}
                </div>
              </div>
            )}
          </div>

          {ch.description && (
            <p className="text-[13px] text-arc-muted leading-relaxed">{ch.description}</p>
          )}

          {/* The stake, stated. Half the point of agreeing one is that it is
              written down where both of you can see it. */}
          {ch.wager && (
            <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/[0.07] border border-amber-500/25 px-3 py-2.5">
              <span aria-hidden className="text-base leading-none">🤝</span>
              <span className="min-w-0">
                <span className="block text-[9px] font-bold text-amber-400/80 uppercase tracking-widest">On the line</span>
                <span className="block text-[12px] font-bold text-amber-200 leading-snug">{ch.wager}</span>
              </span>
            </div>
          )}

          {joined && started && !done && (
            <>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  className="h-full bg-gradient-to-r from-arc-accent to-arc-cyan"
                />
              </div>
              <p className="text-[10px] text-arc-muted">
                {daysRemaining(day, ch.length_days)} days to go
                {mine.restarts > 0 && ` · restarted ${mine.restarts}×`}
              </p>
            </>
          )}

          {/* The checklist itself lives in TODAY at the top of the page, where
              it is the first thing a member sees rather than something behind
              an expander. This card is the standings and the shape of the run. */}
          {joined && !done && ownTasks.length === 0 && (ch.created_by === userId || isAdmin) && (
            <button
              onClick={() => openTaskEditor(ch)}
              className="w-full border border-dashed border-white/15 hover:border-arc-accent/40 text-arc-muted hover:text-white text-[11px] font-bold py-2.5 rounded-xl transition-colors"
            >
              + Give it a daily checklist
            </button>
          )}

          {done && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center space-y-1">
              <p className="text-sm font-bold text-green-400 flex items-center justify-center gap-2"><TrophyIcon size={16} /> Finished — all {ch.length_days} days</p>
              {ch.wager && (
                <p className="text-[11px] text-amber-300 font-bold">
                  {standings[0]?.user_id === userId
                    ? `You won. They owe you: ${ch.wager}`
                    : `${names[standings[0]?.user_id]?.name || 'The winner'} takes it: ${ch.wager}`}
                </p>
              )}
            </div>
          )}

          {/* How the group is doing */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'In', value: stats.total },
              { label: 'Clean run', value: stats.clean },
              { label: 'Furthest', value: stats.longestDay || '—' },
            ].map(s => (
              <div key={s.label} className="bg-arc-surface border border-white/5 rounded-xl py-2 text-center">
                <div className="text-base font-black text-white leading-none">{s.value}</div>
                <div className="text-[8px] text-arc-muted uppercase tracking-wider mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            {joined ? (
              <>
                <button
                  onClick={() => setExpanded(expanded === ch.id ? null : ch.id)}
                  className="flex-1 bg-arc-surface border border-white/5 text-arc-muted hover:text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
                >
                  {expanded === ch.id ? 'Hide standings' : 'Standings'}
                </button>
                <button
                  onClick={() => { setInviteFor(ch); setInvitePicked([]); setInviteSearch('') }}
                  className="px-4 bg-arc-accent/15 text-arc-accent hover:bg-arc-accent/25 text-xs font-bold py-2.5 rounded-xl transition-colors"
                >
                  Challenge
                </button>
                <button
                  onClick={() => setConfirmLeave(ch)}
                  disabled={busy === ch.id}
                  className="px-4 bg-white/5 text-arc-muted hover:text-white text-xs font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  Leave
                </button>
              </>
            ) : (
              <button
                onClick={() => (ch.strict ? setConfirmJoin(ch) : join(ch))}
                disabled={busy === ch.id || !ch.is_active}
                className="flex-1 bg-accent-gradient text-white font-black italic py-3 rounded-xl shadow-glow active:scale-95 transition-transform disabled:opacity-40"
              >
                {busy === ch.id ? 'JOINING…' : !ch.is_active ? 'CLOSED' : mine ? 'REJOIN' : 'JOIN'}
              </button>
            )}
          </div>
        </div>

        {/* Standings */}
        <AnimatePresence>
          {expanded === ch.id && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-white/5"
            >
              <div className="p-4 space-y-1.5">
                {standings.length === 0 && (
                  <p className="text-xs text-arc-muted text-center py-2">Nobody has joined yet.</p>
                )}
                {standings.map((m, i) => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl ${m.user_id === userId ? 'bg-arc-accent/10 border border-arc-accent/20' : 'bg-arc-surface'}`}
                  >
                    <span className="text-[10px] font-black text-arc-muted w-5 shrink-0">{i + 1}</span>
                    <Avatar
                      src={names[m.user_id]?.avatar}
                      name={names[m.user_id]?.name}
                      size={24}
                    />
                    <span className="text-[12px] font-bold text-white truncate flex-1">
                      {m.user_id === userId ? 'You' : (names[m.user_id]?.name || 'Member')}
                    </span>
                    {m.restarts > 0 && (
                      <span className="text-[9px] text-arc-muted shrink-0">{m.restarts}× restart</span>
                    )}
                    <span className="text-[11px] font-black text-arc-accent shrink-0">
                      {m.day >= ch.length_days ? <TrophyIcon size={14} className="inline" /> : `D${m.day}`}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    )
  }

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 20 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-50 bg-arc-surface border border-white/10 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md"
          >
            <div className="w-2 h-2 rounded-full bg-arc-accent animate-pulse" />
            <span className="text-sm font-medium">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top level now, so no back arrow — the two places you'd go next
          instead are the people you'd challenge and where you stand. */}
      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            CHALLENGES
          </h1>
          <div className="flex items-center gap-1">
            <Link
              href="/friends" aria-label="Friends"
              className="w-9 h-9 rounded-full bg-white/5 text-arc-muted hover:text-white flex items-center justify-center transition-colors"
            >
              <UsersIcon size={17} />
            </Link>
            <Link
              href="/leaderboard" aria-label="Leaderboard"
              className="w-9 h-9 rounded-full bg-white/5 text-arc-muted hover:text-white flex items-center justify-center transition-colors"
            >
              <TrophyIcon size={17} />
            </Link>
            <ProfileButton />
          </div>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-lg mx-auto space-y-4">
        {/* What you stand to lose today, before what you have to do about it. */}
        <StreakBanner streak={myStreak} />

        {/* The reason to open this tab tomorrow. Three lines, tickable where
            you land, and what the rest of the gym did with the same three. */}
        {todayRows.map(({ ch, mine, day, tasks, doneToday }) => {
          const all = tasks.length
          const banked = doneToday === all
          const gym = gymToday[ch.id]
          const yesterday = backfillFrom(today)
          const missedYesterday = tasks.filter(t => !myTicks.has(`${t.id}:${yesterday}`))
          const canFixYesterday = yesterday >= String(mine.start_date).slice(0, 10)
            && missedYesterday.length > 0

          return (
            <section
              key={`today-${ch.id}`}
              className={`relative overflow-hidden rounded-2xl border p-5 space-y-3 ${
                banked ? 'bg-green-500/[0.07] border-green-500/30' : 'bg-arc-card border-arc-accent/25'
              }`}
            >
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-2xl font-black italic tracking-tighter leading-none">
                    {banked ? 'DAY BANKED' : 'TODAY'}
                  </h2>
                  <p className="text-[11px] text-arc-muted mt-1 truncate">
                    {ch.title}
                    {todayRows.length === 1 && day > 0 ? ` · day ${day} done` : ''}
                  </p>
                </div>
                <span className={`shrink-0 text-[11px] font-black tabular-nums ${banked ? 'text-green-400' : 'text-arc-accent'}`}>
                  {doneToday}/{all}
                </span>
              </div>

              <div className="space-y-1.5">
                {tasks.map(t => {
                  const ticked = myTicks.has(`${t.id}:${today}`)
                  return (
                    <button
                      key={t.id}
                      onClick={() => tickTask(t, today, tasks)}
                      disabled={!!taskBusy}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-colors text-left disabled:opacity-60 ${
                        ticked ? 'bg-green-500/10 border-green-500/30' : 'bg-arc-surface border-white/[0.06] hover:border-arc-accent/40'
                      }`}
                    >
                      <span className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center ${
                        ticked ? 'bg-green-500 border-green-500 text-white' : 'border-white/25 text-transparent'
                      }`}>
                        <CheckIcon size={12} />
                      </span>
                      <span className={`text-[13px] font-bold truncate ${
                        ticked ? 'text-green-300 line-through decoration-green-500/50' : 'text-white'
                      }`}>
                        {t.title}
                      </span>
                    </button>
                  )
                })}
              </div>

              {canFixYesterday && (
                <div className="space-y-1.5 pt-0.5">
                  <span className="block px-1 text-[9px] font-bold text-amber-400 uppercase tracking-widest">
                    Yesterday — fix it before today ends
                  </span>
                  {missedYesterday.map(t => (
                    <button
                      key={`${t.id}-y`}
                      onClick={() => tickTask(t, yesterday, tasks)}
                      disabled={!!taskBusy}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-amber-500/25 bg-amber-500/5 hover:border-amber-500/50 transition-colors text-left disabled:opacity-60"
                    >
                      <span className="shrink-0 w-5 h-5 rounded-md border border-amber-500/50" />
                      <span className="flex-1 min-w-0 text-[12px] font-bold text-amber-200 truncate">{t.title}</span>
                      <span className="shrink-0 text-[9px] font-black text-amber-400/70 uppercase tracking-wider">Tap to fix</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Nobody comes back for a checklist. They come back to see
                  whether everyone else did it too. */}
              {gym && gym.members > 1 && (
                <p className="text-[11px] text-arc-muted leading-snug">
                  {banked
                    ? `${gym.done_today} of ${gym.members} at your gym have finished today.`
                    : gym.done_today > 0
                      ? `${gym.done_today} of ${gym.members} at your gym have already finished today.`
                      : `${gym.members} people at your gym are on this. Nobody's finished today yet.`}
                </p>
              )}
            </section>
          )
        })}

        {/* Your gym's challenge, when you're not in it yet. One tap. */}
        {gymChallengeToJoin && (
          <section className="relative overflow-hidden bg-arc-card border border-arc-accent/25 rounded-2xl p-5 space-y-3">
            <div className="absolute -top-16 -right-12 w-40 h-40 rounded-full bg-arc-accent/10 blur-2xl pointer-events-none" />
            <div className="relative space-y-1">
              <span className="text-[9px] font-bold text-arc-accent uppercase tracking-widest">Your gym is doing this</span>
              <h2 className="text-2xl font-black italic tracking-tighter leading-none">{gymChallengeToJoin.title.toUpperCase()}</h2>
              <p className="text-[12px] text-arc-muted leading-relaxed">
                {gymChallengeToJoin.description}
              </p>
            </div>
            <div className="relative flex flex-wrap gap-1.5">
              {chTasks.filter(t => t.challenge_id === gymChallengeToJoin.id).map(t => (
                <span key={t.id} className="text-[10px] font-bold text-white bg-arc-surface border border-white/[0.06] px-2.5 py-1 rounded-full">
                  {t.title}
                </span>
              ))}
            </div>
            <button
              onClick={() => join(gymChallengeToJoin)}
              disabled={busy === gymChallengeToJoin.id}
              className="relative w-full bg-accent-gradient text-white font-black italic py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform disabled:opacity-50"
            >
              {busy === gymChallengeToJoin.id ? 'JOINING…' : "I'M IN"}
            </button>
            <p className="relative text-[10px] text-arc-muted text-center">
              Your thirty days start today. No start line to miss.
            </p>
          </section>
        )}

        {/* Somebody has challenged you */}
        {pendingForMe.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[10px] font-bold text-arc-accent uppercase tracking-widest px-1">
              {pendingForMe.length === 1 ? "You've been challenged" : `${pendingForMe.length} challenges for you`}
            </h2>
            {pendingForMe.map(inv => {
              const ch = challenges.find(c => c.id === inv.challenge_id)
              const from = names[inv.inviter_id] || people.find(p => p.id === inv.inviter_id)
              return (
                <div key={inv.id} className="bg-arc-card border border-arc-accent/30 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={from?.avatar || from?.avatar_url} name={from?.name || from?.username} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-white truncate">
                        {from?.name || from?.username || 'Someone'} challenged you
                      </p>
                      <p className="text-[11px] text-arc-muted truncate">
                        {ch ? `${ch.title} · ${ch.length_days} days${ch.strict ? ' · strict' : ''}` : 'A challenge'}
                      </p>
                      {ch?.wager && (
                        <p className="text-[11px] font-bold text-amber-300 truncate">🤝 {ch.wager}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => respondInvite(inv, true)} disabled={busy === inv.id}
                      className="flex-1 bg-accent-gradient text-white font-black italic py-2.5 rounded-xl text-sm shadow-glow active:scale-95 transition-transform disabled:opacity-50"
                    >
                      ACCEPT
                    </button>
                    <button
                      onClick={() => respondInvite(inv, false)} disabled={busy === inv.id}
                      className="px-4 bg-white/5 text-arc-muted hover:text-white font-bold py-2.5 rounded-xl text-xs transition-colors disabled:opacity-50"
                    >
                      No thanks
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* The thing the app is for */}
        <section className="relative overflow-hidden bg-arc-card border border-arc-accent/20 rounded-2xl p-5 space-y-4">
          <div className="absolute -top-20 -right-14 w-44 h-44 rounded-full bg-arc-accent/10 blur-2xl pointer-events-none" />
          <div className="relative space-y-1">
            <h2 className="text-2xl font-black italic tracking-tighter leading-none">CALL SOMEONE OUT</h2>
            <p className="text-[12px] text-arc-muted leading-relaxed">
              Set the rules, pick who you&apos;re up against, and see who&apos;s still standing at the end.
            </p>
          </div>

          <button
            onClick={() => openCreate([])}
            className="relative w-full bg-accent-gradient text-white font-black italic py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform"
          >
            CHALLENGE SOMEONE
          </button>

          {quickTargets.length > 0 && (
            <div className="relative space-y-2">
              <p className="text-[9px] font-bold text-arc-muted uppercase tracking-widest">Or go straight at</p>
              {/* -mx-5 px-5 lets the row bleed to the card edges as it scrolls */}
              <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
                {quickTargets.map(p => (
                  <button
                    key={p.id}
                    onClick={() => openCreate([p.id])}
                    className="shrink-0 w-14 flex flex-col items-center gap-1.5 group"
                  >
                    <span className="rounded-full ring-2 ring-transparent group-hover:ring-arc-accent/50 transition-all">
                      <Avatar src={p.avatar_url} name={p.username} size={44} />
                    </span>
                    <span className="text-[9px] text-arc-muted group-hover:text-white transition-colors truncate w-full text-center">
                      {p.username || 'Member'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* What you've earned */}
        {myBadges.length > 0 && (
          <section className="bg-arc-card border border-white/[0.06] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Your badges</span>
              <span className="text-[10px] font-bold text-arc-muted">{myBadges.length} of 8</span>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
              {myBadges.map(bg => (
                <div key={bg.key} className="shrink-0 w-16 flex flex-col items-center gap-1 text-center" title={bg.description}>
                  <span className="w-12 h-12 rounded-full bg-arc-surface border border-arc-accent/25 flex items-center justify-center text-xl">
                    {bg.icon}
                  </span>
                  <span className="text-[9px] text-arc-muted leading-tight">{bg.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Plain English, because nobody reads a challenge they don't understand */}
        <button
          onClick={() => setShowHow(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-arc-card border border-white/[0.06] hover:border-arc-accent/30 transition-colors text-left"
        >
          <span className="w-7 h-7 rounded-full bg-arc-accent/10 text-arc-accent flex items-center justify-center text-sm font-black shrink-0">?</span>
          <span className="text-[12px] font-bold text-white flex-1">How challenges work</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-arc-muted shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        {missingTables && (
          <div className="bg-arc-card border border-amber-500/30 rounded-2xl p-5 text-center">
            <p className="text-sm text-amber-200">Challenges aren&apos;t set up yet — migration 031 needs to be run.</p>
          </div>
        )}

        {!missingTables && challenges.length === 0 && (
          <div className="bg-arc-card border border-white/5 rounded-2xl p-8 text-center space-y-2">
            <div className="flex justify-center text-arc-muted"><FlagIcon size={40} /></div>
            <h2 className="text-lg font-black italic tracking-tighter">NOTHING RUNNING YET</h2>
            {/* With a gym you always have your gym's challenge, so this is now
                only reached by a member who isn't in one yet. */}
            <p className="text-sm text-arc-muted">
              {myGymId
                ? 'Start one above and call someone out.'
                : 'Join a gym in your profile and your gym\u2019s challenge shows up here.'}
            </p>
          </div>
        )}

        {joinedChallenges.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest px-1">
              {joinedChallenges.length === 1 ? 'Your challenge' : 'Your challenges'}
            </h2>
            {joinedChallenges.map(renderChallenge)}
          </section>
        )}

        {openChallenges.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest px-1">
              Open to join
            </h2>
            {openChallenges.map(renderChallenge)}
          </section>
        )}
      </main>

      {/* Start your own */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !creating && setShowCreate(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] z-50 max-h-[92vh] overflow-y-auto"
            >
              <div className="p-6 space-y-4 pb-safe">
                <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
                <h2 className="text-xl font-black italic tracking-tighter">START A CHALLENGE</h2>

                <input
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={defaultChallengeTitle()}
                  className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
                />

                {/* Who you're up against, on the same screen. This used to be
                    a second sheet after the challenge already existed, so
                    tapping someone's face asked who it was for twice. */}
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">
                    Who are you up against?
                  </label>
                  {prePicked.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {prePicked.map(id => {
                        const person = people.find(x => x.id === id)
                        return (
                          <button
                            key={id}
                            onClick={() => togglePrePicked(id)}
                            className="flex items-center gap-1.5 bg-arc-accent/15 border border-arc-accent/30 text-arc-accent pl-1 pr-2.5 py-1 rounded-full text-[11px] font-bold"
                          >
                            <Avatar src={person?.avatar_url} name={person?.username} size={18} />
                            {person?.username || 'Member'}
                            <span aria-hidden className="opacity-70">✕</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <input
                    value={createSearch}
                    onChange={(e) => setCreateSearch(e.target.value)}
                    placeholder="Search your gym"
                    className="w-full bg-arc-surface border border-white/10 px-4 py-2.5 rounded-xl text-white outline-none focus:border-arc-accent transition-colors text-sm mb-2"
                  />
                  <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                    {createTargets.map(person => {
                      const picked = prePicked.includes(person.id)
                      return (
                        <button
                          key={person.id}
                          onClick={() => togglePrePicked(person.id)}
                          className="shrink-0 w-14 flex flex-col items-center gap-1.5"
                        >
                          <span className={`rounded-full ring-2 transition-all ${picked ? 'ring-arc-accent' : 'ring-transparent'}`}>
                            <Avatar src={person.avatar_url} name={person.username} size={44} />
                          </span>
                          <span className={`text-[9px] truncate w-full text-center ${picked ? 'text-arc-accent font-bold' : 'text-arc-muted'}`}>
                            {person.username}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-arc-muted mt-1.5">
                    {prePicked.length
                      ? `${prePicked.length} ${prePicked.length === 1 ? 'person gets' : 'people get'} the callout the moment you start it.`
                      : 'Leave it empty and anyone at your gym can join.'}
                  </p>
                </div>

                {/* What you're actually playing for. You two settle it -- the
                    app records it and names the winner, nothing more. */}
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">
                    What&apos;s on the line?
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {WAGER_PRESETS.map(w => (
                      <button
                        key={w}
                        onClick={() => setForm(f => ({ ...f, wager: f.wager === w ? '' : w }))}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${
                          form.wager === w
                            ? 'bg-arc-accent/15 border-arc-accent/40 text-arc-accent'
                            : 'bg-arc-surface border-white/[0.06] text-arc-muted hover:text-white'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  <input
                    value={form.wager}
                    onChange={(e) => setForm(f => ({ ...f, wager: e.target.value.slice(0, WAGER_MAX) }))}
                    placeholder="Or write your own"
                    maxLength={WAGER_MAX}
                    className="w-full bg-arc-surface border border-white/10 px-4 py-2.5 rounded-xl text-white outline-none focus:border-arc-accent transition-colors text-sm"
                  />
                  <p className="text-[10px] text-arc-muted mt-1.5">
                    Between you and them. Arctivate writes it down and says who won — it doesn&apos;t hold or move anything.
                  </p>
                </div>

                {/* Everything below is already answered. It is here to be
                    changed, not to be filled in. */}
                <div className="rounded-xl bg-arc-surface/60 border border-white/[0.06] px-4 py-3 space-y-1">
                  <p className="text-[11px] text-white font-bold">
                    {taskList.length
                      ? `${taskList.length} things a day, 30 days, your gym can join.`
                      : 'Their own daily habits, 30 days, your gym can join.'}
                  </p>
                  <p className="text-[10px] text-arc-muted leading-snug">
                    Everyone&apos;s thirty days start the day they join.
                  </p>
                </div>

                <button
                  onClick={() => setShowAdvanced(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-arc-muted hover:text-white transition-colors"
                >
                  <span className="text-[11px] font-bold">{showAdvanced ? 'Hide options' : 'Change the details'}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showAdvanced && (
                <div className="space-y-4">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What it involves (optional)"
                  rows={2}
                  className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors text-sm resize-none"
                />

                {/* The daily checklist everyone in the challenge will tick */}
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">
                    Daily tasks
                  </label>
                  {taskList.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 mb-1.5">
                      <span className="flex-1 bg-arc-surface border border-white/[0.06] px-4 py-2.5 rounded-xl text-[13px] font-bold text-white truncate">
                        {t}
                      </span>
                      <button
                        onClick={() => setTaskList(prev => prev.filter((_, j) => j !== i))}
                        aria-label={`Remove ${t}`}
                        className="shrink-0 w-9 h-9 rounded-xl bg-white/5 text-arc-muted hover:text-red-400 flex items-center justify-center transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {taskList.length < 10 && (
                    <div className="flex items-center gap-2">
                      <input
                        value={taskDraft}
                        onChange={(e) => setTaskDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && taskDraft.trim()) {
                            setTaskList(prev => [...prev, taskDraft.trim()])
                            setTaskDraft('')
                          }
                        }}
                        placeholder="e.g. 3L of water"
                        className="flex-1 bg-arc-surface border border-white/10 px-4 py-2.5 rounded-xl text-white outline-none focus:border-arc-accent transition-colors text-sm"
                      />
                      <button
                        onClick={() => {
                          if (!taskDraft.trim()) return
                          setTaskList(prev => [...prev, taskDraft.trim()])
                          setTaskDraft('')
                        }}
                        className="shrink-0 px-4 py-2.5 rounded-xl bg-arc-accent/15 text-arc-accent text-xs font-bold hover:bg-arc-accent/25 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-arc-muted mt-1.5">
                    {taskList.length === 0
                      ? 'Everyone ticks these off each day, right on the challenge. Leave empty and it counts their own daily habits instead.'
                      : `Tick all ${taskList.length} in a day and the day is banked.`}
                  </p>
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1 block">Starts</label>
                    <input
                      type="date" value={form.start_date}
                      onChange={(e) => setForm(f => ({ ...f, start_date: e.target.value }))}
                      className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent text-sm"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-1 block">Days</label>
                    <input
                      type="number" inputMode="numeric" min="1" max="400" value={form.length_days}
                      onChange={(e) => setForm(f => ({ ...f, length_days: e.target.value }))}
                      className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent text-center font-bold"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-arc-muted -mt-2">Leave the date blank to start today.</p>

                {/* Who can see it */}
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Who can join</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(VISIBILITY).map(([key, v]) => (
                      <button
                        key={key}
                        onClick={() => setForm(f => ({ ...f, visibility: key }))}
                        className={`py-2.5 px-2 rounded-xl text-[11px] font-bold transition-all border ${
                          form.visibility === key
                            ? 'bg-accent-gradient text-white border-transparent'
                            : 'bg-arc-surface text-arc-muted border-white/[0.06] hover:text-white'
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-arc-muted mt-1.5">{VISIBILITY[form.visibility].hint}</p>
                </div>

                {/* Strict */}
                <button
                  onClick={() => setForm(f => ({ ...f, strict: !f.strict }))}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    form.strict ? 'bg-amber-500/10 border-amber-500/30' : 'bg-arc-surface border-white/[0.06]'
                  }`}
                >
                  <span className="text-left min-w-0 flex items-center gap-2">
                    <LockIcon size={14} className={form.strict ? 'text-amber-400' : 'text-arc-muted'} />
                    <span>
                      <span className={`block text-[11px] font-bold ${form.strict ? 'text-amber-400' : 'text-white'}`}>
                        Strict
                      </span>
                      <span className="block text-[9px] text-arc-muted leading-snug">Miss a day, back to Day 1</span>
                    </span>
                  </span>
                  <span className={`shrink-0 w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${form.strict ? 'bg-amber-500 justify-end' : 'bg-white/10 justify-start'}`}>
                    <span className="w-4 h-4 rounded-full bg-white" />
                  </span>
                </button>

                {/* Gym vs gym */}
                <button
                  onClick={() => setForm(f => ({ ...f, gym_vs_gym: !f.gym_vs_gym, visibility: !f.gym_vs_gym ? 'public' : f.visibility }))}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                    form.gym_vs_gym ? 'bg-arc-cyan/10 border-arc-cyan/30' : 'bg-arc-surface border-white/[0.06]'
                  }`}
                >
                  <span className="text-left min-w-0 flex items-center gap-2">
                    <TrophyIcon size={14} className={form.gym_vs_gym ? 'text-arc-cyan' : 'text-arc-muted'} />
                    <span>
                      <span className={`block text-[11px] font-bold ${form.gym_vs_gym ? 'text-arc-cyan' : 'text-white'}`}>
                        Gym vs gym
                      </span>
                      <span className="block text-[9px] text-arc-muted leading-snug">Scored on each gym&apos;s average, so size doesn&apos;t decide it</span>
                    </span>
                  </span>
                  <span className={`shrink-0 w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${form.gym_vs_gym ? 'bg-arc-cyan justify-end' : 'bg-white/10 justify-start'}`}>
                    <span className="w-4 h-4 rounded-full bg-white" />
                  </span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => setForm(f => ({ ...f, is_official: !f.is_official }))}
                    className={`w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      form.is_official ? 'bg-arc-accent/10 border-arc-accent/30' : 'bg-arc-surface border-white/[0.06]'
                    }`}
                  >
                    <span className="text-left">
                      <span className={`block text-[11px] font-bold ${form.is_official ? 'text-arc-accent' : 'text-white'}`}>
                        Official gym challenge
                      </span>
                      <span className="block text-[9px] text-arc-muted leading-snug">Marks it as run by the gym, not a member</span>
                    </span>
                    <span className={`shrink-0 w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${form.is_official ? 'bg-arc-accent justify-end' : 'bg-white/10 justify-start'}`}>
                      <span className="w-4 h-4 rounded-full bg-white" />
                    </span>
                  </button>
                )}
                </div>
                )}

                <div className="space-y-2 pt-1">
                  <button
                    onClick={createChallenge} disabled={creating}
                    className="w-full bg-accent-gradient text-white font-black italic py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {creating ? 'STARTING…' : 'START IT'}
                  </button>
                  <button
                    onClick={() => setShowCreate(false)} disabled={creating}
                    className="w-full bg-white/5 text-arc-muted font-bold py-3 rounded-xl text-sm hover:text-white transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Challenge people to it */}
      <AnimatePresence>
        {inviteFor && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !sendingInvites && setInviteFor(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] z-50 max-h-[85vh] flex flex-col"
            >
              <div className="p-6 pb-3 space-y-3 shrink-0">
                <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
                <div>
                  <h2 className="text-xl font-black italic tracking-tighter">CHALLENGE WHO?</h2>
                  <p className="text-[11px] text-arc-muted mt-0.5 truncate">{inviteFor.title}</p>
                </div>
                <input
                  value={inviteSearch}
                  onChange={(e) => setInviteSearch(e.target.value)}
                  placeholder="Search by name"
                  className="w-full bg-arc-surface border border-white/10 p-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors text-sm"
                />
              </div>

              <div className="flex-1 overflow-y-auto px-6 space-y-1.5 min-h-0">
                {invitable.length === 0 && (
                  <p className="text-sm text-arc-muted text-center py-6">
                    {inviteSearch ? 'Nobody by that name.' : "Everyone's already in or invited."}
                  </p>
                )}
                {invitable.map(p => {
                  const picked = invitePicked.includes(p.id)
                  const isFriend = myFriendIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => setInvitePicked(prev =>
                        picked ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors text-left ${
                        picked ? 'bg-arc-accent/10 border-arc-accent/30' : 'bg-arc-surface border-white/[0.04]'
                      }`}
                    >
                      <Avatar src={p.avatar_url} name={p.username} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-bold text-white truncate">{p.username || 'Member'}</span>
                        <span className="block text-[9px] text-arc-muted">
                          {isFriend ? 'Friend' : p.gym_id === myGymId ? 'Your gym' : 'Another gym'}
                          {' · '}{(Number(p.total_points) || 0).toLocaleString()} pts
                        </span>
                      </span>
                      <span className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center ${
                        picked ? 'bg-arc-accent border-arc-accent text-white' : 'border-white/20 text-transparent'
                      }`}>
                        <CheckIcon size={13} />
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="p-6 pt-3 space-y-2 shrink-0 border-t border-white/5">
                <button
                  onClick={sendInvites}
                  disabled={sendingInvites || invitePicked.length === 0}
                  className="w-full bg-accent-gradient text-white font-black italic py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform disabled:opacity-40"
                >
                  {sendingInvites
                    ? 'SENDING…'
                    : invitePicked.length === 0
                      ? 'PICK SOMEONE'
                      : `CHALLENGE ${invitePicked.length}`}
                </button>
                <button
                  onClick={() => setInviteFor(null)} disabled={sendingInvites}
                  className="w-full bg-white/5 text-arc-muted font-bold py-3 rounded-xl text-sm hover:text-white transition-colors disabled:opacity-50"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* How this works, in plain English */}
      <AnimatePresence>
        {showHow && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowHow(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] z-50 max-h-[88vh] overflow-y-auto"
            >
              <div className="p-6 space-y-5 pb-safe">
                <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
                <h2 className="text-xl font-black italic tracking-tighter">HOW CHALLENGES WORK</h2>

                {[
                  { n: '1', t: 'Your gym always has one running',
                    d: 'The Daily 3 is there whenever you want it \u2014 three things, thirty days, one tap to join. Your thirty days start the day you join, so you can never be too late.' },
                  { n: '2', t: 'Today is the top of this page',
                    d: 'Whatever you have to tick today is the first thing you see, wherever it came from. Tick it there \u2014 you never have to go looking for it.' },
                  { n: '3', t: 'Tick everything and the day is banked',
                    d: 'Finish the whole list on a day and that day counts. Miss one and it doesn\u2019t.' },
                  { n: '4', t: 'Forgot a day? You get one more',
                    d: 'Until the end of the next day you can still fill it in from the Catch up list. After that the day is settled.' },
                  { n: '5', t: 'Standings rank on days done',
                    d: 'Not on who joined first. Level pegging goes to whoever has needed the fewest restarts.' },
                  { n: '6', t: 'Strict means strict',
                    d: 'In a strict challenge, a day you never filled in sends you back to Day 1. Non-strict challenges just stop counting that day.' },
                  { n: '7', t: 'Challenges are separate, habits are yours',
                    d: 'Each challenge scores its own checklist. Only challenges without tasks fall back to your personal habits \u2014 those share one list.' },
                ].map(step => (
                  <div key={step.n} className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-arc-accent/15 text-arc-accent text-[11px] font-black flex items-center justify-center">
                      {step.n}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-white leading-snug">{step.t}</p>
                      <p className="text-[11px] text-arc-muted leading-relaxed mt-0.5">{step.d}</p>
                    </div>
                  </div>
                ))}

                <div className="bg-arc-surface border border-white/5 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2">Badges</p>
                  <p className="text-[11px] text-arc-muted leading-relaxed">
                    Earned for real work \u2014 days actually completed, challenges finished, people called out.
                    They\u2019re awarded by the app, not claimed, and once earned they\u2019re yours for good.
                  </p>
                </div>

                <button
                  onClick={() => setShowHow(false)}
                  className="w-full bg-accent-gradient text-white font-black italic py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform"
                >
                  GOT IT
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Something new earned */}
      <AnimatePresence>
        {justEarned.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setJustEarned([])}
              className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 260 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-6 pointer-events-none"
            >
              <div className="bg-arc-card border border-arc-accent/40 rounded-[2rem] p-8 w-full max-w-sm text-center space-y-5 shadow-glow pointer-events-auto">
                <p className="text-[10px] font-bold text-arc-accent uppercase tracking-widest">
                  {justEarned.length === 1 ? 'Badge earned' : `${justEarned.length} badges earned`}
                </p>
                <div className="flex justify-center gap-4 flex-wrap">
                  {justEarned.map(bg => (
                    <div key={bg.key} className="flex flex-col items-center gap-2 w-24">
                      <span className="w-16 h-16 rounded-full bg-arc-surface border border-arc-accent/40 flex items-center justify-center text-3xl">
                        {bg.icon}
                      </span>
                      <span className="text-[12px] font-black italic text-white leading-tight">{bg.name}</span>
                      <span className="text-[9px] text-arc-muted leading-snug">{bg.description}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setJustEarned([])}
                  className="w-full bg-accent-gradient text-white font-black italic py-3.5 rounded-xl shadow-glow active:scale-95 transition-transform"
                >
                  NICE
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit a challenge's checklist */}
      <AnimatePresence>
        {editTasksFor && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !savingTasks && setEditTasksFor(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] z-50 max-h-[88vh] overflow-y-auto"
            >
              <div className="p-6 space-y-4 pb-safe">
                <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
                <div>
                  <h2 className="text-xl font-black italic tracking-tighter">DAILY TASKS</h2>
                  <p className="text-[11px] text-arc-muted mt-0.5 truncate">{editTasksFor.title}</p>
                </div>

                {editRows.map((r, i) => (
                  <div key={r.id || `new-${i}`} className="flex items-center gap-2">
                    <input
                      value={r.title}
                      onChange={(e) => setEditRows(prev => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                      className="flex-1 bg-arc-surface border border-white/10 px-4 py-2.5 rounded-xl text-white outline-none focus:border-arc-accent transition-colors text-[13px] font-bold"
                    />
                    <button
                      onClick={() => setEditRows(prev => prev.filter((_, j) => j !== i))}
                      aria-label={`Remove ${r.title}`}
                      className="shrink-0 w-9 h-9 rounded-xl bg-white/5 text-arc-muted hover:text-red-400 flex items-center justify-center transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {editRows.length < 10 && (
                  <div className="flex items-center gap-2">
                    <input
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editDraft.trim()) {
                          setEditRows(prev => [...prev, { title: editDraft.trim() }])
                          setEditDraft('')
                        }
                      }}
                      placeholder="Add a task"
                      className="flex-1 bg-arc-surface border border-white/10 px-4 py-2.5 rounded-xl text-white outline-none focus:border-arc-accent transition-colors text-sm"
                    />
                    <button
                      onClick={() => {
                        if (!editDraft.trim()) return
                        setEditRows(prev => [...prev, { title: editDraft.trim() }])
                        setEditDraft('')
                      }}
                      className="shrink-0 px-4 py-2.5 rounded-xl bg-arc-accent/15 text-arc-accent text-xs font-bold hover:bg-arc-accent/25 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                )}

                <p className="text-[10px] text-arc-muted leading-relaxed">
                  Changes apply to everyone in the challenge. A task added today only
                  counts from today — it can&apos;t fail anyone&apos;s yesterday. Removing a
                  task deletes its ticks too.
                  {editRows.length === 0 && ' With no tasks, the challenge counts each person\u2019s own daily habits.'}
                </p>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={saveTasks} disabled={savingTasks}
                    className="w-full bg-accent-gradient text-white font-black italic py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {savingTasks ? 'SAVING…' : 'SAVE'}
                  </button>
                  <button
                    onClick={() => setEditTasksFor(null)} disabled={savingTasks}
                    className="w-full bg-white/5 text-arc-muted font-bold py-3 rounded-xl text-sm hover:text-white transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Joining something strict is worth spelling out */}
      <AnimatePresence>
        {confirmJoin && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmJoin(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-8 z-50 space-y-6 pb-safe"
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
              <div className="text-center">
                <div className="mb-3 flex justify-center text-amber-400"><LockIcon size={36} /></div>
                <h2 className="text-xl font-black italic tracking-tighter">{confirmJoin.title.toUpperCase()}</h2>
                <p className="text-sm text-arc-muted mt-2 leading-relaxed">
                  This one is strict. Miss a single day of your daily habits and you go{' '}
                  <span className="text-white font-bold">back to Day 1</span> of the challenge.
                </p>
              </div>
              <div className="bg-arc-surface border border-white/5 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-2.5">
                  <CheckIcon size={13} className="text-green-500 mt-0.5 shrink-0" />
                  <span className="text-[12px] text-arc-muted leading-snug">Your first day and today are safe — only finished days count against you</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckIcon size={13} className="text-green-500 mt-0.5 shrink-0" />
                  <span className="text-[12px] text-arc-muted leading-snug">Points, photos and history are never lost, and you can leave anytime</span>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => join(confirmJoin)}
                  disabled={busy === confirmJoin.id}
                  className="w-full bg-amber-500 text-arc-bg font-bold py-4 rounded-xl text-lg active:scale-95 transition-transform disabled:opacity-50"
                >
                  {busy === confirmJoin.id ? 'JOINING…' : "I'M IN"}
                </button>
                <button
                  onClick={() => setConfirmJoin(null)}
                  className="w-full bg-white/5 text-arc-muted font-bold py-3 rounded-xl text-sm hover:text-white transition-colors"
                >
                  Not for me
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Leaving */}
      <AnimatePresence>
        {confirmLeave && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmLeave(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6"
            >
              <div className="bg-arc-card border border-white/10 rounded-[2rem] p-8 w-full max-w-sm text-center space-y-5">
                <h2 className="text-xl font-black italic tracking-tighter">LEAVE {confirmLeave.title.toUpperCase()}?</h2>
                <p className="text-sm text-arc-muted">
                  Your habits and points stay exactly as they are. You can rejoin later, but you&apos;ll start from Day 1.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => leave(confirmLeave)}
                    disabled={busy === confirmLeave.id}
                    className="w-full bg-red-500/90 text-white font-bold py-3.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                  >
                    {busy === confirmLeave.id ? 'LEAVING…' : 'LEAVE'}
                  </button>
                  <button
                    onClick={() => setConfirmLeave(null)}
                    className="w-full bg-white/5 text-arc-muted font-bold py-3 rounded-xl text-sm hover:text-white transition-colors"
                  >
                    Stay in
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* A strict challenge reset them */}
      <AnimatePresence>
        {resetNotice && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setResetNotice(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60]"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-6"
            >
              <div className="bg-arc-card border border-amber-500/40 rounded-[2rem] p-8 w-full max-w-sm text-center space-y-5">
                <div className="flex justify-center text-amber-400"><LockIcon size={48} /></div>
                <div>
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.2em] mb-2">{resetNotice.title}</div>
                  <h2 className="text-2xl font-black italic tracking-tighter leading-tight">BACK TO DAY 1</h2>
                </div>
                <p className="text-sm text-arc-muted leading-relaxed">
                  Your daily habits weren&apos;t all ticked on{' '}
                  <span className="text-white font-bold">
                    {new Date(resetNotice.missed + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </span>
                  . You knew the deal when you joined. Everything you&apos;ve earned is still yours.
                </p>
                <button
                  onClick={() => setResetNotice(null)}
                  className="w-full bg-arc-accent text-white font-black italic py-4 rounded-xl text-lg shadow-glow active:scale-95 transition-transform"
                >
                  GO AGAIN
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Nav />
    </div>
  )
}
