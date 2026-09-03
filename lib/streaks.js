// How many days in a row you showed up.
//
// A day counts if you did any of: logged a set, ticked a workout complete,
// ticked a habit, or ticked a challenge task. Showing up is showing up --
// counting only the lifting meant a month of ticking five habits every day was
// worth nothing, which is exactly backwards for the number we use to ask
// people to come back.
//
// Worked out in the database at read time by member_streaks(). It used to live
// in a `profiles.current_streak` column that nothing ever wrote, so every
// member read as zero; a cached one would also keep showing 12 days for
// somebody who stopped a fortnight ago, and that is the one number a streak
// must never get wrong.

// The viewer's own day boundary. Two people in different timezones can
// disagree about whether it is still Tuesday, and each should see their own
// answer rather than the server's.
export function localTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

const EMPTY = { current: 0, longest: 0, activeToday: false }

/**
 * Streaks for everyone, as a Map of user id -> { current, longest, activeToday }.
 *
 * Returns an empty Map on an older database without the function, so a caller
 * can render without a streak rather than not render at all.
 */
export async function fetchStreaks(supabase) {
  try {
    const { data, error } = await supabase.rpc('member_streaks', { p_tz: localTimezone() })
    if (error || !Array.isArray(data)) return new Map()
    return new Map(data.map(r => [r.user_id, {
      current: r.current_streak || 0,
      longest: r.longest_streak || 0,
      activeToday: !!r.active_today,
    }]))
  } catch {
    return new Map()
  }
}

export function streakFor(map, userId) {
  return (map && map.get(userId)) || EMPTY
}

/**
 * What to say about a streak, and how loudly.
 *
 * The interesting state is a live streak with today not yet done: that is the
 * only moment the number is actually at risk, and saying so is the difference
 * between a statistic and a reason to open the app.
 */
export function streakMessage({ current, longest, activeToday }) {
  if (current > 0 && activeToday) {
    return { tone: 'safe', headline: `${current} day${current === 1 ? '' : 's'} in a row`, detail: 'You showed up today. Streak safe.' }
  }
  if (current > 0) {
    return {
      tone: 'at-risk',
      headline: `${current} day${current === 1 ? '' : 's'} in a row`,
      detail: current === 1 ? 'Do one thing today to make it two.' : 'Today decides whether it survives.',
    }
  }
  if (longest > 0) {
    return { tone: 'restart', headline: 'No streak running', detail: `Your best was ${longest} days. Today is day one.` }
  }
  return { tone: 'new', headline: 'No streak yet', detail: 'Tick one thing today and it starts.' }
}
