// Starting a challenge and calling someone out, as one data operation.
//
// Onboarding needs to do exactly what the challenges page does — create the
// challenge, attach its daily checklist, put the creator in it, and invite the
// people they picked — without dragging that page's UI state along. Keeping it
// here means the two entry points cannot drift apart on the parts that matter.

import { todayStr, hasStarted } from './challenges'

// The checklist a new member gets if they do not write their own. Short on
// purpose: three things you can finish on a bad day beat ten you cannot.
export const STARTER_TASKS = [
  '45 minutes of movement',
  '3 litres of water',
  '10 minutes of reading',
]

// What people actually play for. Not money and not a bet the app settles --
// a line the two of you agree on and sort out between yourselves, which is
// what already happens at a gym. Points are deliberately not on this list:
// they are still asserted by the client, so a points wager would put a real
// prize behind a lock that doesn't shut.
export const WAGER_PRESETS = [
  'Loser buys the coffees',
  'Loser buys lunch',
  'Loser does 100 burpees',
  'Bragging rights',
]

export const WAGER_MAX = 80

// A name nobody has to think of. Asking for one is the difference between
// starting a challenge and abandoning a form.
export function defaultChallengeTitle(date = new Date()) {
  return `${date.toLocaleDateString('en-US', { month: 'long' })} Grind`
}

/**
 * Create a challenge, add the creator, attach tasks, and invite opponents.
 *
 * Returns { challenge, invited } on success, or throws. Task and invite
 * failures are deliberately non-fatal: a challenge that exists without its
 * checklist still runs on personal habits, and one with nobody invited yet is
 * just a challenge you can invite to later. A challenge that failed to be
 * created at all is the only real failure.
 */
export async function startChallengeWith(supabase, {
  userId,
  gymId = null,
  title,
  description = null,
  lengthDays = 30,
  startDate = null,
  taskTitles = [],
  opponentIds = [],
  visibility = 'gym',
  strict = false,
  wager = null,
  gymVsGym = false,
  isOfficial = false,
  proofRequired = false,
}) {
  if (!userId) throw new Error('startChallengeWith: userId is required')
  const cleanTitle = (title || '').trim()
  if (!cleanTitle) throw new Error('startChallengeWith: title is required')

  const start = startDate || todayStr()

  const { data: challenge, error } = await supabase
    .from('group_challenges')
    .insert({
      title: cleanTitle,
      description: description || null,
      start_date: start,
      length_days: lengthDays,
      strict,
      visibility,
      wager: (wager || '').trim().slice(0, WAGER_MAX) || null,
      gym_vs_gym: gymVsGym,
      is_official: isOfficial,
      proof_required: !!proofRequired,
      gym_id: gymId,
      is_active: true,
      created_by: userId,
    })
    .select()
    .single()
  if (error) throw error

  const tasks = (taskTitles || []).map(t => (t || '').trim()).filter(Boolean)
  if (tasks.length) {
    await supabase.from('challenge_tasks').insert(
      tasks.map((t, i) => ({ challenge_id: challenge.id, title: t, position: i }))
    ).then(() => {}, () => {})
  }

  // Whoever starts it is in it. A challenge with nobody in it, not even its
  // owner, reads as broken.
  await supabase.from('group_challenge_members').insert({
    challenge_id: challenge.id,
    user_id: userId,
    start_date: hasStarted(start) ? todayStr() : start,
    last_checked: todayStr(),
  }).then(() => {}, () => {})

  let invited = 0
  const opponents = (opponentIds || []).filter(id => id && id !== userId)
  if (opponents.length) {
    const { error: invErr } = await supabase
      .from('challenge_invites')
      .upsert(
        opponents.map(id => ({
          challenge_id: challenge.id,
          inviter_id: userId,
          invitee_id: id,
        })),
        { onConflict: 'challenge_id,invitee_id', ignoreDuplicates: true }
      )
    if (!invErr) invited = opponents.length
  }

  return { challenge, invited }
}
