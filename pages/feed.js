import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'

// Icons
const HighFiveIcon = ({ filled }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v5" />
    <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v6" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </svg>
)

const FireIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 23c-3.866 0-7-3.134-7-7 0-2.084.784-3.987 2.07-5.427l3.93-4.39 3.93 4.39C16.216 12.013 17 13.916 17 16c0 3.866-3.134 7-7 7z" />
  </svg>
)

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [userHighFives, setUserHighFives] = useState(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        await Promise.all([fetchFeed(), fetchUserHighFives(user.id)])
      }
      setIsLoading(false)
    }
    load()
  }, [])

  async function fetchFeed() {
    const { data, error } = await supabase
      .from('public_feed')
      .select(`
        *,
        profiles:user_id (
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) {
      setPosts(data)
    }
  }

  async function fetchUserHighFives(userId) {
    const { data } = await supabase
      .from('high_fives')
      .select('feed_id')
      .eq('user_id', userId)

    if (data) {
      setUserHighFives(new Set(data.map(hf => hf.feed_id)))
    }
  }

  async function handleHighFive(postId) {
    const { data } = await supabase.rpc('increment_high_five', { post_id: postId })

    if (data?.success) {
      // Update local state
      setPosts(posts.map(post => {
        if (post.id === postId) {
          return { ...post, likes_count: data.likes_count }
        }
        return post
      }))

      // Update high fives set
      if (data.action === 'added') {
        setUserHighFives(prev => new Set([...prev, postId]))
      } else {
        setUserHighFives(prev => {
          const next = new Set(prev)
          next.delete(postId)
          return next
        })
      }
    }
  }

  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getUnit = (metricType) => metricType === 'time' ? 'min' : 'kg'

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5 p-6">
        <h1 className="text-xl font-black italic tracking-tighter text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          COMMUNITY FEED
        </h1>
      </header>

      <main className="pt-24 px-4 max-w-lg mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-arc-orange/30 border-t-arc-orange rounded-full"
            />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🏋️</div>
            <h3 className="text-lg font-bold text-white mb-2">No Posts Yet</h3>
            <p className="text-arc-muted text-sm">Be the first to share your workout!</p>
          </div>
        ) : (
          <div className="space-y-4 pb-10">
            <AnimatePresence initial={false}>
              {posts.map((post, index) => {
                const workout = post.workout_data
                const hasHighFived = userHighFives.has(post.id)
                const isOwnPost = post.user_id === currentUserId

                return (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-arc-card border border-white/5 rounded-2xl overflow-hidden"
                  >
                    {/* User Header */}
                    <div className="flex items-center gap-3 p-4 border-b border-white/5">
                      <div className="w-10 h-10 bg-arc-surface rounded-full flex items-center justify-center text-arc-orange font-bold">
                        {post.profiles?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1">
                        <span className="font-bold text-sm text-white">
                          {post.profiles?.username || 'Anonymous'}
                        </span>
                        <span className="block text-[11px] text-arc-muted">
                          {formatTimeAgo(post.created_at)}
                        </span>
                      </div>
                      {workout.is_new_pb && (
                        <span className="flex items-center gap-1 text-[10px] bg-arc-orange/20 text-arc-orange px-2 py-1 rounded-full font-bold">
                          <FireIcon />
                          NEW PB
                        </span>
                      )}
                    </div>

                    {/* Workout Content */}
                    <div className="p-5">
                      <div className="text-center mb-4">
                        <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">
                          Logged
                        </span>
                        <h3 className="text-lg font-bold text-white mt-1">
                          {workout.exercise_name}
                        </h3>
                      </div>

                      <div className="flex justify-center gap-6">
                        <div className="text-center">
                          <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">
                            {workout.metric_type === 'time' ? 'Time' : 'Weight'}
                          </span>
                          <div className="flex items-baseline justify-center gap-1 mt-1">
                            <span className="text-2xl font-black font-mono text-arc-orange">
                              {workout.value}
                            </span>
                            <span className="text-sm text-arc-muted font-bold">
                              {getUnit(workout.metric_type)}
                            </span>
                          </div>
                        </div>

                        <div className="text-center">
                          <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">
                            Points
                          </span>
                          <div className="flex items-baseline justify-center gap-1 mt-1">
                            <span className="text-sm text-green-400 font-bold">+</span>
                            <span className="text-2xl font-black font-mono text-white">
                              {workout.points_earned}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between px-4 py-3 bg-arc-bg/50 border-t border-white/5">
                      <button
                        onClick={() => handleHighFive(post.id)}
                        disabled={isOwnPost}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                          hasHighFived
                            ? 'bg-arc-orange/20 text-arc-orange'
                            : 'bg-arc-surface text-arc-muted hover:text-white'
                        } ${isOwnPost ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <HighFiveIcon filled={hasHighFived} />
                        <span className="font-bold text-sm">High Five</span>
                      </button>

                      <span className="text-sm font-mono text-arc-muted">
                        {post.likes_count > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="text-arc-orange">{post.likes_count}</span>
                            <span>{post.likes_count === 1 ? 'high five' : 'high fives'}</span>
                          </span>
                        )}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </main>

      <Nav />
    </div>
  )
}
