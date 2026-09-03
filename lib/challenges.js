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

// How long you get to fill in a day you forgot. Members asked for the chance
// to add yesterday's ticks, so a day isn't judged the moment it ends — it's
// judged once this window has closed behind it. One day means "you have until
// the end of tomorrow to put yesterday right".
export const BACKFILL_DAYS = 1

// How many of your daily habits bank the day.
//
// It used to be all of them. Across 189 days where somebody actually ticked
// something, only 77 counted -- members average 4.9 ticks out of 6.7 habits,
// a good day's work, and 59% of those days scored zero. Worse, adding a habit
// made every future day harder, so the keenest members were punished hardest.
// One member sat on nine habits and zero banked days while being active enough
// to be in three challenges.
//
// Three counts 82% of the days people really showed up, and it needs no rules
// page: your gym's challenge is already called The Daily 3.
export const DAILY_GOAL = 3

// Somebody with fewer habits than the goal still has to be able to finish a
// day, so the bar is never higher than what they actually keep.
export function goalFor(habitCount) {
  return Math.max(1, Math.min(DAILY_GOAL, habitCount || 0))
}

// Strict mode is meant to hurt, but it should hurt for the right reason.
// Forgetting to tick is not the same as not doing the work, and the app cannot
// tell those apart on its own -- so once per run it stops and asks instead of
// resetting. One, not more: a second free pass is just strict mode switched off
// with extra steps.
export const STRICT_SAVES_PER_RUN = 1

// How many settled incomplete days one last chance can cover. Three is
// deliberate: it is enough for "I did it and forgot to tick over the weekend",
// and not enough to erase a fortnight off. Someone who genuinely stopped for
// longer than this has taken a break, and strict mode should say so rather than
// let them tick a claim they cannot honestly make.
export const LAST_CHANCE_MAX_DAYS = 3

// The first day still open for editing. Anything on or after this is yours to
// fix; anything before it is settled.
export function backfillFrom(today = todayStr()) {
  const d = new Date(`${String(today).slice(0, 10)}T00:00:00`)
  d.setDate(d.getDate() - BACKFILL_DAYS)
  return fmtLocal(d)
}

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
  // day is days completed now, so finishing all of them IS the finish —
  // under the old calendar meaning the number climbed past the end, and the
  // strict > worked; with days_done it made "Finished" unreachable.
  return day > 0 && lengthDays > 0 && day >= lengthDays
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
// Deliberately forgiving in four ways, because this wipes someone's progress:
//   - today is never judged, only days that have finished
//   - nor is any day still inside the backfill window, so a day you forgot can
//     be put right before it counts against you
//   - the first day is a grace day (you might join at 11pm)
//   - a day only requires the habits that already existed on it, so adding a
//     habit today can't fail you retrospectively
//
// `logs` is [{ habit_id, date }], `dailyHabits` is [{ id, created_at }].
// Returns a 'YYYY-MM-DD' string, or null when nothing was missed.
export function findFirstMissedDay({ dailyHabits, logs, startDate, lengthDays, today = todayStr() }) {
  if (!dailyHabits || dailyHabits.length === 0) return null
  if (!startDate) return null

  const first = new Date(`${String(startDate).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(first.getTime())) return null

  // Days after the challenge has ended are nobody's business. Without this,
  // someone who finished and then rested was reset for "missing" the day
  // after their own finish line.
  let judgeUntil = today
  if (lengthDays > 0) {
    const end = new Date(first)
    end.setDate(end.getDate() + lengthDays) // first day NOT in the window
    const endStr = fmtLocal(end)
    if (endStr < judgeUntil) judgeUntil = endStr
  }

  first.setDate(first.getDate() + 1) // grace day

  const doneByDay = {}
  ;(logs || []).forEach(l => {
    if (!l || !l.date) return
    const key = String(l.date).slice(0, 10)
    ;(doneByDay[key] || (doneByDay[key] = new Set())).add(l.habit_id)
  })

  // Stop at the backfill window rather than at today: a day you can still fix
  // hasn't been missed yet.
  const settledBefore = backfillFrom(today)
  const walkUntil = judgeUntil < settledBefore ? judgeUntil : settledBefore
  for (let d = new Date(first); fmtLocal(d) < walkUntil; d.setDate(d.getDate() + 1)) {
    const key = fmtLocal(d)
    const endOfDay = new Date(`${key}T23:59:59`)
    const required = dailyHabits.filter(h => !h.created_at || new Date(h.created_at) <= endOfDay)
    if (required.length === 0) continue
    const done = doneByDay[key] || new Set()
    // Hitting the goal is the day, not perfection.
    const hit = required.filter(h => done.has(h.id)).length
    if (hit < goalFor(required.length)) return key
  }
  return null
}

// --- Cohort figures --------------------------------------------------------

// What the challenge card shows: how many are in, and how they're faring.
export function cohortStats(members, challenge, today = todayStr()) {
  const rows = (members || []).filter(m => m.status !== 'left')
  const active = rows.filter(m => m.status === 'active')
  const days = active.map(daysDone)
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
// Days you actually completed, as counted by the database. The count lives on
// the membership row because habits and habit_logs are readable only by their
// owner — nobody's browser can see anyone else's ticks, so the standings have
// to read a number the server put there.
export function daysDone(member) {
  return Number(member?.days_done) || 0
}

// Ranked on work done, not on who joined first. Ties go to whoever has needed
// the fewest restarts.
export function rankMembers(members) {
  return [...(members || [])]
    .filter(m => m.status !== 'left')
    .map(m => ({ ...m, day: daysDone(m) }))
    .sort((a, b) => (b.day - a.day) || ((a.restarts || 0) - (b.restarts || 0)))
}
