// A gym session, and getting it in front of people.
//
// Before this, logging a lift wrote a row nobody would ever see. Sharing was an
// opt-in toggle on a single exercise buried in a success modal: 741 logs went
// in and six of them ever reached the feed. The unit was wrong too -- one lift
// is not a workout, a session of four or five is.
//
// So a session is opened the first time you log something on a given day, every
// lift after that joins it, and when you are done it is visible to your gym
// unless you said otherwise.

// How long an open session stays open. Log something six hours after your last
// set and that is a second workout, not a continuation of the first.
export const SESSION_GAP_HOURS = 6

export const VISIBILITY = {
  gym: { label: 'Gym', hint: 'Everyone at your gym can see this' },
  private: { label: 'Private', hint: 'Only you can see this' },
}

// "Tuesday session" beats "Untitled". A coach-published workout brings its own
// name, which is always better than anything we can guess.
export function defaultSessionTitle(date = new Date(), dailyWorkoutTitle = null) {
  if (dailyWorkoutTitle) return dailyWorkoutTitle
  return `${date.toLocaleDateString('en-US', { weekday: 'long' })} session`
}

/**
 * The session a lift logged right now belongs to, creating one if needed.
 *
 * Returns the session row, or null if sessions are not available yet (an older
 * database without migration 041). Callers must treat null as "carry on without
 * a session" rather than as a failure -- a lift that saves without a session is
 * exactly the old behaviour, which is worse but not broken.
 */
export async function currentSession(supabase, { userId, gymId = null, dailyWorkoutId = null, dailyWorkoutTitle = null }) {
  if (!userId) return null
  try {
    const cutoff = new Date(Date.now() - SESSION_GAP_HOURS * 3600 * 1000).toISOString()

    // An open session is one that has not been finished and is still recent.
    let q = supabase
      .from('workout_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('ended_at', null)
      .gte('started_at', cutoff)
      .order('started_at', { ascending: false })
      .limit(1)

    const { data: open, error } = await q
    // The table is missing entirely -- older database, nothing to do.
    if (error) return null
    if (open && open.length) {
      const s = open[0]
      // A session started freehand then continued inside a coach workout should
      // adopt its name rather than stay "Tuesday session".
      if (dailyWorkoutId && !s.daily_workout_id) {
        const patch = { daily_workout_id: dailyWorkoutId }
        if (dailyWorkoutTitle) patch.title = dailyWorkoutTitle
        const { data: updated } = await supabase
          .from('workout_sessions').update(patch).eq('id', s.id).select().single()
        return updated || s
      }
      return s
    }

    const { data: created, error: createErr } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: userId,
        gym_id: gymId,
        daily_workout_id: dailyWorkoutId,
        title: defaultSessionTitle(new Date(), dailyWorkoutTitle),
      })
      .select()
      .single()
    if (createErr) return null
    return created
  } catch {
    return null
  }
}

/**
 * Mark a session finished. Visibility is already on the row -- this only stamps
 * the end so it stops collecting lifts and starts reading as a completed
 * workout in the feed.
 */
export async function finishSession(supabase, sessionId, { visibility } = {}) {
  if (!sessionId) return null
  const patch = { ended_at: new Date().toISOString() }
  if (visibility) patch.visibility = visibility
  const { data, error } = await supabase
    .from('workout_sessions').update(patch).eq('id', sessionId).select().single()
  if (error) return null
  return data
}

export async function setSessionVisibility(supabase, sessionId, visibility) {
  if (!sessionId || !VISIBILITY[visibility]) return null
  const { data, error } = await supabase
    .from('workout_sessions').update({ visibility }).eq('id', sessionId).select().single()
  if (error) return null
  return data
}

// Kudos are a toggle, and the count is maintained by a trigger rather than by
// the client, so nobody can hand themselves a hundred of them.
export async function toggleKudos(supabase, sessionId, userId, alreadyGiven) {
  if (!sessionId || !userId) return false
  if (alreadyGiven) {
    const { error } = await supabase
      .from('session_kudos').delete().eq('session_id', sessionId).eq('user_id', userId)
    return !error
  }
  const { error } = await supabase
    .from('session_kudos').insert({ session_id: sessionId, user_id: userId })
  // A duplicate means it was already there, which is the state we wanted.
  return !error || error.code === '23505'
}

export async function addComment(supabase, sessionId, userId, body) {
  const text = (body || '').trim()
  if (!sessionId || !userId || !text) return null
  const { data, error } = await supabase
    .from('session_comments')
    .insert({ session_id: sessionId, user_id: userId, body: text.slice(0, 500) })
    .select('*, profiles:user_id (username, avatar_url)')
    .single()
  if (error) return null
  return data
}

// --- Reading a session for display ------------------------------------------

// One line per exercise: "Bench press 3x8 @ 80kg". Sets that share an exercise
// are folded together, because five rows of "Bench press" is a database view,
// not a workout summary.
export function summariseLogs(logs = []) {
  const byExercise = new Map()
  for (const l of logs) {
    const name = l.exercise?.name || l.exercise_name || 'Exercise'
    const cur = byExercise.get(name) || { name, best: null, sets: 0, reps: null, isPB: false, metricType: l.exercise?.metric_type || null }
    cur.sets += l.sets || 1
    if (l.reps != null) cur.reps = l.reps
    if (l.is_new_pb) cur.isPB = true
    const isTime = cur.metricType === 'time'
    if (cur.best == null) cur.best = Number(l.value)
    else cur.best = isTime ? Math.min(cur.best, Number(l.value)) : Math.max(cur.best, Number(l.value))
    byExercise.set(name, cur)
  }
  return [...byExercise.values()]
}

export function unitFor(metricType) {
  if (metricType === 'time') return 'min'
  if (metricType === 'distance') return 'km'
  if (metricType === 'distance_m') return 'm'
  if (metricType === 'reps') return 'reps'
  return 'kg'
}

export function sessionStats(logs = []) {
  const exercises = summariseLogs(logs)
  return {
    exercises: exercises.length,
    sets: logs.reduce((n, l) => n + (l.sets || 1), 0),
    pbs: exercises.filter(e => e.isPB).length,
    // Volume only means anything for weight, so anything else is left out
    // rather than added to a number that would then be a lie.
    volume: logs.reduce((n, l) => {
      const mt = l.exercise?.metric_type
      if (mt && mt !== 'weight') return n
      return n + Number(l.value || 0) * (l.sets || 1) * (l.reps || 1)
    }, 0),
  }
}

export function sessionDuration(session) {
  if (!session?.started_at || !session?.ended_at) return null
  const mins = Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000)
  if (mins < 1 || mins > 8 * 60) return null
  return mins
}
