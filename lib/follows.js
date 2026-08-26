// Following, not friending.
//
// The old model needed both sides to agree: one requests, the other accepts.
// After a year it had zero rows -- nobody ever finished the handshake. Follows
// are one-sided and need no approval, which is why a Strava graph fills and
// this one did not.
//
// Following changes whose sessions the feed shows you. It does not change what
// you are allowed to see: session visibility is still 'gym' or 'private' and is
// still enforced by the database.

export async function fetchMyFollowing(supabase, userId) {
  if (!userId) return new Set()
  const { data, error } = await supabase
    .from('follows').select('following_id').eq('follower_id', userId)
  if (error) return new Set()
  return new Set((data || []).map(r => r.following_id))
}

export async function fetchCounts(supabase, userId) {
  if (!userId) return { followers: 0, following: 0 }
  const { data, error } = await supabase.rpc('follow_counts', { p_user_id: userId })
  if (error || !data?.length) return { followers: 0, following: 0 }
  return { followers: data[0].followers || 0, following: data[0].following || 0 }
}

/**
 * Follow or unfollow, returning whether the write landed.
 *
 * A duplicate is treated as success: the state the caller wanted is the state
 * the database is in, and surfacing an error there would only be confusing.
 */
export async function toggleFollow(supabase, meId, themId, currentlyFollowing) {
  if (!meId || !themId || meId === themId) return false
  if (currentlyFollowing) {
    const { error } = await supabase
      .from('follows').delete().eq('follower_id', meId).eq('following_id', themId)
    return !error
  }
  const { error } = await supabase
    .from('follows').insert({ follower_id: meId, following_id: themId })
  return !error || error.code === '23505'
}
