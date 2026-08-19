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
      gym_vs_gym: false,
      is_official: false,
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
