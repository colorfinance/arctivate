// Friends, gyms and leaderboards.
//
// The ranking rules live here as plain functions because they're the part
// people will argue about in the gym, and they need to be right.

// --- Friendships ------------------------------------------------------------

// One row per pair, with the ids stored in a fixed order so A→B and B→A can't
// both exist. Callers should always build rows through this.
export function pairFor(me, them, requesterId = me) {
  if (!me || !them || me === them) return null
  const [user_a, user_b] = me < them ? [me, them] : [them, me]
  return { user_a, user_b, requester_id: requesterId, status: 'pending' }
}

export function otherSide(row, me) {
  if (!row) return null
  return row.user_a === me ? row.user_b : row.user_a
}

// Everyone whose friendship with me is accepted.
export function friendIds(friendships, me) {
  return (friendships || [])
    .filter(f => f.status === 'accepted')
    .map(f => otherSide(f, me))
    .filter(Boolean)
}

// Requests waiting on me — ones I didn't send.
export function incomingRequests(friendships, me) {
  return (friendships || []).filter(f => f.status === 'pending' && f.requester_id !== me)
}

// Requests I sent that haven't been answered.
export function outgoingRequests(friendships, me) {
  return (friendships || []).filter(f => f.status === 'pending' && f.requester_id === me)
}

// What the button on someone's row should say.
export function friendState(friendships, me, them) {
  const row = (friendships || []).find(f =>
    (f.user_a === me && f.user_b === them) || (f.user_a === them && f.user_b === me))
  if (!row) return { state: 'none' }
  if (row.status === 'accepted') return { state: 'friends', row }
  if (row.status === 'pending') {
    return { state: row.requester_id === me ? 'requested' : 'incoming', row }
  }
  return { state: 'declined', row }
}

// --- Leaderboards -----------------------------------------------------------

export const METRICS = {
  points: { key: 'total_points', label: 'Points', short: 'pts' },
  streak: { key: 'current_streak', label: 'Streak', short: 'days' },
}

// Ranks people, giving equal scores the same position — two people on 400
// points are both 2nd, and the next is 4th. Getting this wrong is the sort of
// thing members notice immediately.
export function rankPeople(people, metric = 'points') {
  const field = (METRICS[metric] || METRICS.points).key
  const sorted = [...(people || [])]
    .map(p => ({ ...p, score: Number(p[field]) || 0 }))
    .sort((a, b) => (b.score - a.score) || String(a.username || '').localeCompare(String(b.username || '')))

  let lastScore = null
  let lastRank = 0
  return sorted.map((p, i) => {
    const rank = p.score === lastScore ? lastRank : i + 1
    lastScore = p.score
    lastRank = rank
    return { ...p, rank }
  })
}

// Where someone sits in a ranked list, or null if they're not in it.
export function findRank(ranked, userId) {
  const row = (ranked || []).find(r => r.id === userId)
  return row ? row.rank : null
}

// Gym vs gym, scored on the average per member rather than the total.
//
// Totals would just rank gyms by headcount: a 200-member gym beats a 20-member
// one without anybody training harder. Average makes it a fair fight, and the
// member count is shown alongside so nobody thinks it's hiding anything.
//
// Gyms below `minMembers` are held out, because a single keen member would
// otherwise top the table on their own.
export function rankGyms(profiles, gyms, metric = 'points', minMembers = 3) {
  const field = (METRICS[metric] || METRICS.points).key
  const byGym = new Map()

  ;(profiles || []).forEach(p => {
    if (!p.gym_id) return
    const entry = byGym.get(p.gym_id) || { total: 0, members: 0, best: 0 }
    const v = Number(p[field]) || 0
    entry.total += v
    entry.members += 1
    if (v > entry.best) entry.best = v
    byGym.set(p.gym_id, entry)
  })

  const rows = (gyms || [])
    .map(g => {
      const e = byGym.get(g.id) || { total: 0, members: 0, best: 0 }
      return {
        ...g,
        members: e.members,
        total: e.total,
        best: e.best,
        average: e.members ? Math.round(e.total / e.members) : 0,
        eligible: e.members >= minMembers,
      }
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
      return (b.average - a.average) || (b.members - a.members)
    })

  let lastAvg = null
  let lastRank = 0
  return rows.map((r, i) => {
    if (!r.eligible) return { ...r, rank: null }
    const rank = r.average === lastAvg ? lastRank : i + 1
    lastAvg = r.average
    lastRank = rank
    return { ...r, rank }
  })
}

// --- Challenge visibility ---------------------------------------------------

export const VISIBILITY = {
  public: { label: 'Anyone', hint: 'Any Arctivate member can find and join' },
  gym: { label: 'My gym', hint: 'Only people at your gym' },
  invite: { label: 'Invite only', hint: 'Only people you invite' },
}

// What each visibility setting means is decided by the row level security
// policy in migration 032 — the browse list only ever receives rows the
// database already agreed to hand over.
