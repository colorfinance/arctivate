// Group challenges: several can run at once and members choose which to join.
//
// Each member carries their own start_date inside a challenge, so a late joiner
// isn't judged on days before they arrived and a strict reset moves only them.
//
// Kept as plain functions with no Supabase in sight — the day maths and the
// missed-day rule are the parts worth being sure about.

export const fmtLocal = (d) => {
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

export const todayStr = () => fmtLocal(new Date())

// Day 1 is the start date itself, so someone who joins today is on Day 1.
export function challengeDay(startDate, today = todayStr()) {
  if (!startDate) return 0
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`)
  const now = new Date(`${String(today).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(now.getTime())) return 0
  const diff = Math.floor((now - start) / 86400000)
  return diff < 0 ? 0 : diff + 1 // 0 means it hasn't started yet
}

export function challengeProgress(day, lengthDays) {
  if (!lengthDays || lengthDays <= 0) return 0
  return Math.max(0, Math.min(100, (day / lengthDays) * 100))
}

export function daysRemaining(day, lengthDays) {
  return Math.max(0, (lengthDays || 0) - Math.max(0, day))
}

export function isFinished(day, lengthDays) {
  return day > 0 && lengthDays > 0 && day > lengthDays
}

// A challenge that hasn't begun yet — members can join early and wait.
export function hasStarted(startDate, today = todayStr()) {
  return challengeDay(startDate, today) > 0
}

// Whole days until a challenge begins; 0 once it has. Can't come from
// challengeDay, which floors at 0 before the start and so loses the distance.
export function daysUntilStart(startDate, today = todayStr()) {
  if (!startDate) return 0
  const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`)
  const now = new Date(`${String(today).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(now.getTime())) return 0
  return Math.max(0, Math.round((start - now) / 86400000))
}

// --- The strict rule -------------------------------------------------------

// Finds the first completed day on which the member didn't tick everything.
//
// Deliberately forgiving in three ways, because this wipes someone's progress:
//   - today is never judged, only days that have finished
//   - the first day is a grace day (you might join at 11pm)
//   - a day only requires the habits that already existed on it, so adding a
//     habit today can't fail you retrospectively
//
// `logs` is [{ habit_id, date }], `dailyHabits` is [{ id, created_at }].
// Returns a 'YYYY-MM-DD' string, or null when nothing was missed.
export function findFirstMissedDay({ dailyHabits, logs, startDate, today = todayStr() }) {
  if (!dailyHabits || dailyHabits.length === 0) return null
  if (!startDate) return null

  const first = new Date(`${String(startDate).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(first.getTime())) return null
  first.setDate(first.getDate() + 1) // grace day

  const doneByDay = {}
  ;(logs || []).forEach(l => {
    if (!l || !l.date) return
    const key = String(l.date).slice(0, 10)
    ;(doneByDay[key] || (doneByDay[key] = new Set())).add(l.habit_id)
  })

  for (let d = new Date(first); fmtLocal(d) < today; d.setDate(d.getDate() + 1)) {
    const key = fmtLocal(d)
    const endOfDay = new Date(`${key}T23:59:59`)
    const required = dailyHabits.filter(h => !h.created_at || new Date(h.created_at) <= endOfDay)
    if (required.length === 0) continue
    const done = doneByDay[key] || new Set()
    if (!required.every(h => done.has(h.id))) return key
  }
  return null
}

// --- Cohort figures --------------------------------------------------------

// What the challenge card shows: how many are in, and how they're faring.
export function cohortStats(members, challenge, today = todayStr()) {
  const rows = (members || []).filter(m => m.status !== 'left')
  const active = rows.filter(m => m.status === 'active')
  const days = active.map(m => challengeDay(m.start_date, today))
  return {
    total: rows.length,
    active: active.length,
    completed: rows.filter(m => m.status === 'completed').length,
    // A clean run is someone who has never had to restart.
    clean: active.filter(m => (m.restarts || 0) === 0).length,
    longestDay: days.length ? Math.max(...days) : 0,
    startsIn: challenge ? daysUntilStart(challenge.start_date, today) : 0,
  }
}

// Leaderboard order: furthest through first, then fewest restarts.
export function rankMembers(members, today = todayStr()) {
  return [...(members || [])]
    .filter(m => m.status !== 'left')
    .map(m => ({ ...m, day: challengeDay(m.start_date, today) }))
    .sort((a, b) => (b.day - a.day) || ((a.restarts || 0) - (b.restarts || 0)))
}
