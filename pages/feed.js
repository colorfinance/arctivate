import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'

// Icons
const HighFiveIcon = ({ filled }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v5" />
    <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v6" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </svg>
)

const FireIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 23c-3.866 0-7-3.134-7-7 0-2.084.784-3.987 2.07-5.427l3.93-4.39 3.93 4.39C16.216 12.013 17 13.916 17 16c0 3.866-3.134 7-7 7z" />
  </svg>
)

const MessageIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const GroupIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const TwitterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)

const FacebookIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
  </svg>
)

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [messages, setMessages] = useState([])
  const [userLikes, setUserLikes] = useState(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [activeTab, setActiveTab] = useState('workouts')
  const [newMessage, setNewMessage] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [showComposer, setShowComposer] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        await Promise.all([fetchWorkoutFeed(), fetchCommunityMessages(), fetchUserLikes(user.id)])
      }
      setIsLoading(false)
    }
    load()
  }, [])

  async function fetchWorkoutFeed() {
    const { data } = await supabase
      .from('public_feed')
      .select(`*, profiles:user_id (username, avatar_url)`)
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setPosts(data)
  }

  async function fetchCommunityMessages() {
    try {
      const { data } = await supabase
        .from('community_messages')
        .select(`*, profiles:user_id (username, avatar_url)`)
        .is('group_id', null)
        .order('created_at', { ascending: false })
        .limit(50)
      if (data) setMessages(data)
    } catch (err) {
      // Table might not exist yet
      console.log('Community messages not available yet')
    }
  }

  async function fetchUserLikes(userId) {
    const { data: workoutLikes } = await supabase.from('high_fives').select('feed_id').eq('user_id', userId)
    const likes = new Set()
    workoutLikes?.forEach(l => likes.add(`workout:${l.feed_id}`))

    try {
      const { data: messageLikes } = await supabase.from('message_likes').select('message_id').eq('user_id', userId)
      messageLikes?.forEach(l => likes.add(`message:${l.message_id}`))
    } catch (err) {
      // Table might not exist yet
    }

    setUserLikes(likes)
  }

  async function handleHighFive(postId) {
    const { data } = await supabase.rpc('increment_high_five', { post_id: postId })
    if (data?.success) {
      setPosts(posts.map(post => post.id === postId ? { ...post, likes_count: data.likes_count } : post))
      const likeKey = `workout:${postId}`
      if (data.action === 'added') {
        setUserLikes(prev => new Set([...prev, likeKey]))
      } else {
        setUserLikes(prev => { const next = new Set(prev); next.delete(likeKey); return next })
      }
    }
  }

  async function handleMessageLike(messageId) {
    try {
      const { data } = await supabase.rpc('toggle_message_like', { p_message_id: messageId })
      if (data?.success) {
        setMessages(messages.map(msg => msg.id === messageId ? { ...msg, likes_count: data.likes_count } : msg))
        const likeKey = `message:${messageId}`
        if (data.action === 'liked') {
          setUserLikes(prev => new Set([...prev, likeKey]))
        } else {
          setUserLikes(prev => { const next = new Set(prev); next.delete(likeKey); return next })
        }
      }
    } catch (err) {
      console.error('Like error:', err)
    }
  }

  async function postMessage() {
    if (!newMessage.trim() || isPosting) return
    setIsPosting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('community_messages')
        .insert({ user_id: user.id, content: newMessage.trim(), message_type: 'text' })
        .select(`*, profiles:user_id (username, avatar_url)`)
        .single()

      if (data) {
        setMessages([data, ...messages])
        setNewMessage('')
        setShowComposer(false)
      }
    } catch (err) {
      console.error('Error posting:', err)
    } finally {
      setIsPosting(false)
    }
  }

  const shareToTwitter = (content) => {
    const text = encodeURIComponent(content)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(window.location.origin)}`, '_blank')
  }

  const shareToFacebook = (content) => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin)}&quote=${encodeURIComponent(content)}`, '_blank')
  }

  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString()
  }

  const getUnit = (metricType) => metricType === 'time' ? 'min' : 'kg'

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5">
        <div className="p-4 pb-0">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              COMMUNITY
            </h1>
            <div className="flex gap-2">
              <Link href="/groups" className="flex items-center gap-1.5 bg-arc-surface text-white text-xs font-bold px-3 py-2 rounded-full border border-white/10">
                <GroupIcon />
              </Link>
              <button onClick={() => setShowComposer(true)} className="flex items-center gap-1.5 bg-arc-accent text-white text-xs font-bold px-3 py-2 rounded-full">
                <MessageIcon />
                Post
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-arc-surface rounded-xl p-1">
            <button
              onClick={() => setActiveTab('workouts')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'workouts' ? 'bg-arc-accent text-white' : 'text-arc-muted hover:text-white'}`}
            >
              Workouts
            </button>
            <button
              onClick={() => setActiveTab('community')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${activeTab === 'community' ? 'bg-arc-accent text-white' : 'text-arc-muted hover:text-white'}`}
            >
              Messages
            </button>
          </div>
        </div>
      </header>

      <main className="pt-32 px-4 max-w-lg mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-2 border-arc-orange/30 border-t-arc-orange rounded-full" />
          </div>
        ) : (
          <div className="space-y-4 pb-10">
            {/* Workouts Tab */}
            {activeTab === 'workouts' && (
              <>
                {posts.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="text-4xl mb-4">🏋️</div>
                    <h3 className="text-lg font-bold text-white mb-2">No Workouts Yet</h3>
                    <p className="text-arc-muted text-sm">Be the first to share your workout!</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {posts.map((post, index) => {
                      const data = post.workout_data
                      const hasHighFived = userLikes.has(`workout:${post.id}`)
                      const isOwnPost = post.user_id === currentUserId
                      const isFood = data?.type === 'food'
                      const shareText = isFood
                        ? `Just logged ${data.item_name}: ${data.calories} calories on Arctivate!`
                        : `Just logged ${data.exercise_name}: ${data.value}${getUnit(data.metric_type)}${data.is_new_pb ? ' - NEW PB!' : ''} on Arctivate!`

                      return (
                        <motion.div key={post.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="bg-arc-card border border-white/5 rounded-2xl overflow-hidden">
                          <div className="flex items-center gap-3 p-4 border-b border-white/5">
                            <div className="w-10 h-10 bg-arc-surface rounded-full flex items-center justify-center text-arc-orange font-bold">
                              {post.profiles?.username?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1">
                              <span className="font-bold text-sm text-white">{post.profiles?.username || 'Anonymous'}</span>
                              <span className="block text-[11px] text-arc-muted">{formatTimeAgo(post.created_at)}</span>
                            </div>
                            {isFood ? (
                              <span className="flex items-center gap-1 text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-bold">
                                🥗 Food
                              </span>
                            ) : data.is_new_pb && (
                              <span className="flex items-center gap-1 text-[10px] bg-arc-orange/20 text-arc-orange px-2 py-1 rounded-full font-bold">
                                <FireIcon />PB
                              </span>
                            )}
                          </div>

                          <div className="p-5">
                            {isFood ? (
                              <>
                                <div className="text-center mb-4">
                                  <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Ate</span>
                                  <h3 className="text-lg font-bold text-white mt-1">{data.item_name}</h3>
                                </div>
                                <div className="flex justify-center gap-4">
                                  <div className="text-center">
                                    <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Calories</span>
                                    <div className="flex items-baseline justify-center gap-1 mt-1">
                                      <span className="text-2xl font-black font-mono text-green-400">{data.calories}</span>
                                    </div>
                                  </div>
                                  {data.macros && (
                                    <>
                                      <div className="text-center">
                                        <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Protein</span>
                                        <div className="flex items-baseline justify-center gap-1 mt-1">
                                          <span className="text-lg font-bold text-white">{data.macros.p || 0}g</span>
                                        </div>
                                      </div>
                                      <div className="text-center">
                                        <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Carbs</span>
                                        <div className="flex items-baseline justify-center gap-1 mt-1">
                                          <span className="text-lg font-bold text-white">{data.macros.c || 0}g</span>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-center mb-4">
                                  <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Logged</span>
                                  <h3 className="text-lg font-bold text-white mt-1">{data.exercise_name}</h3>
                                </div>
                                <div className="flex justify-center gap-6">
                                  <div className="text-center">
                                    <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">{data.metric_type === 'time' ? 'Time' : 'Weight'}</span>
                                    <div className="flex items-baseline justify-center gap-1 mt-1">
                                      <span className="text-2xl font-black font-mono text-arc-orange">{data.value}</span>
                                      <span className="text-sm text-arc-muted font-bold">{getUnit(data.metric_type)}</span>
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Points</span>
                                    <div className="flex items-baseline justify-center gap-1 mt-1">
                                      <span className="text-sm text-green-400 font-bold">+</span>
                                      <span className="text-2xl font-black font-mono text-white">{data.points_earned}</span>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="flex items-center justify-between px-4 py-3 bg-arc-bg/50 border-t border-white/5">
                            <button onClick={() => handleHighFive(post.id)} disabled={isOwnPost} className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${hasHighFived ? 'bg-arc-orange/20 text-arc-orange' : 'bg-arc-surface text-arc-muted hover:text-white'} ${isOwnPost ? 'opacity-50 cursor-not-allowed' : ''}`}>
                              <HighFiveIcon filled={hasHighFived} />
                              <span className="font-bold text-sm">{post.likes_count || 0}</span>
                            </button>
                            <div className="flex gap-2">
                              <button onClick={() => shareToTwitter(shareText)} className="p-2 rounded-lg bg-arc-surface text-arc-muted hover:text-white transition-colors">
                                <TwitterIcon />
                              </button>
                              <button onClick={() => shareToFacebook(shareText)} className="p-2 rounded-lg bg-arc-surface text-arc-muted hover:text-white transition-colors">
                                <FacebookIcon />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                )}
              </>
            )}

            {/* Community Tab */}
            {activeTab === 'community' && (
              <>
                {messages.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="text-4xl mb-4">💬</div>
                    <h3 className="text-lg font-bold text-white mb-2">No Messages Yet</h3>
                    <p className="text-arc-muted text-sm">Start the conversation!</p>
                    <button onClick={() => setShowComposer(true)} className="mt-4 bg-arc-accent text-white font-bold px-6 py-3 rounded-xl">
                      Post First Message
                    </button>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((msg, index) => {
                      const hasLiked = userLikes.has(`message:${msg.id}`)
                      const isOwnMessage = msg.user_id === currentUserId

                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="bg-arc-card border border-white/5 rounded-2xl p-4">
                          <div className="flex gap-3">
                            <div className="w-10 h-10 bg-arc-surface rounded-full flex items-center justify-center text-arc-orange font-bold shrink-0">
                              {msg.profiles?.username?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-sm text-white">{msg.profiles?.username || 'Anonymous'}</span>
                                <span className="text-[11px] text-arc-muted">{formatTimeAgo(msg.created_at)}</span>
                              </div>
                              <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                              <div className="flex items-center gap-4 mt-3">
                                <button onClick={() => handleMessageLike(msg.id)} disabled={isOwnMessage} className={`flex items-center gap-1 text-sm transition-colors ${hasLiked ? 'text-arc-orange' : 'text-arc-muted hover:text-white'} ${isOwnMessage ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                  <HighFiveIcon filled={hasLiked} />
                                  <span>{msg.likes_count || 0}</span>
                                </button>
                                <button onClick={() => shareToTwitter(msg.content)} className="flex items-center gap-1 text-sm text-arc-muted hover:text-white transition-colors">
                                  <TwitterIcon />
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Compose Modal */}
      <AnimatePresence>
        {showComposer && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowComposer(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-6 z-50 pb-safe">
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-black italic tracking-tighter text-center mb-6">POST TO COMMUNITY</h2>
              <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Share your thoughts, motivation, or progress..." rows={4} className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors resize-none" autoFocus />
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowComposer(false)} className="flex-1 bg-arc-surface text-white font-bold py-4 rounded-xl">Cancel</button>
                <button onClick={postMessage} disabled={!newMessage.trim() || isPosting} className="flex-1 bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow disabled:opacity-50 flex items-center justify-center gap-2">
                  {isPosting ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" /> : <><SendIcon /> Post</>}
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
