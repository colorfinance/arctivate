import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'
import { useRouter } from 'next/router'

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

const ImageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
)

const InboxIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
  </svg>
)

const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
)

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

export default function Feed() {
  const router = useRouter()
  const [posts, setPosts] = useState([])
  const [messages, setMessages] = useState([])
  const [userLikes, setUserLikes] = useState(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [activeTab, setActiveTab] = useState('workouts')
  const [newMessage, setNewMessage] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [showComposer, setShowComposer] = useState(false)
  const [toast, setToast] = useState(null)

  // Image upload state
  const [composerImage, setComposerImage] = useState(null)
  const [composerImagePreview, setComposerImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const imageInputRef = useRef(null)

  // DM state
  const [showDMs, setShowDMs] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeDM, setActiveDM] = useState(null)
  const [dmMessages, setDmMessages] = useState([])
  const [newDM, setNewDM] = useState('')
  const [sendingDM, setSendingDM] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const dmScrollRef = useRef(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data: profile } = await supabase.from('profiles').select('completed_onboarding, username, avatar_url').eq('id', user.id).single()
      if (profile && profile.completed_onboarding === false) {
        router.push('/onboarding')
        return
      }

      setCurrentUserId(user.id)
      await Promise.all([fetchWorkoutFeed(), fetchCommunityMessages(), fetchUserLikes(user.id), fetchUnreadCount(user.id)])
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
      const { data, error } = await supabase
        .from('community_messages')
        .select(`*, profiles:user_id (username, avatar_url)`)
        .is('group_id', null)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) {
        console.error('Community messages error:', error)
        return
      }
      if (data) setMessages(data)
    } catch (err) {
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
    } catch (err) {}

    setUserLikes(likes)
  }

  async function fetchUnreadCount(userId) {
    try {
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    } catch (err) {}
  }

  // --- DM Functions ---
  async function fetchConversations() {
    try {
      const { data: sent } = await supabase
        .from('direct_messages')
        .select('*, profiles:receiver_id (username, avatar_url)')
        .eq('sender_id', currentUserId)
        .order('created_at', { ascending: false })

      const { data: received } = await supabase
        .from('direct_messages')
        .select('*, profiles:sender_id (username, avatar_url)')
        .eq('receiver_id', currentUserId)
        .order('created_at', { ascending: false })

      const convMap = new Map()

      const processDM = (dm, otherUserId, otherProfile, isSent) => {
        if (!convMap.has(otherUserId)) {
          convMap.set(otherUserId, {
            userId: otherUserId,
            username: otherProfile?.username || 'User',
            avatar_url: otherProfile?.avatar_url,
            lastMessage: dm.content,
            lastTime: dm.created_at,
            unread: !isSent && !dm.is_read ? 1 : 0
          })
        } else {
          const conv = convMap.get(otherUserId)
          if (new Date(dm.created_at) > new Date(conv.lastTime)) {
            conv.lastMessage = dm.content
            conv.lastTime = dm.created_at
          }
          if (!isSent && !dm.is_read) conv.unread++
        }
      }

      sent?.forEach(dm => processDM(dm, dm.receiver_id, dm.profiles, true))
      received?.forEach(dm => processDM(dm, dm.sender_id, dm.profiles, false))

      const sorted = [...convMap.values()].sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime))
      setConversations(sorted)
    } catch (err) {
      console.error('Error fetching conversations:', err)
    }
  }

  async function openDM(userId, username, avatarUrl) {
    setActiveDM({ userId, username, avatarUrl })
    await fetchDMThread(userId)

    try {
      await supabase.rpc('mark_dms_read', { p_sender_id: userId })
      setUnreadCount(prev => Math.max(0, prev - (conversations.find(c => c.userId === userId)?.unread || 0)))
    } catch (err) {}
  }

  async function fetchDMThread(otherUserId) {
    try {
      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true })
        .limit(100)

      setDmMessages(data || [])
      setTimeout(() => {
        if (dmScrollRef.current) {
          dmScrollRef.current.scrollTop = dmScrollRef.current.scrollHeight
        }
      }, 100)
    } catch (err) {
      console.error('Error fetching DM thread:', err)
    }
  }

  async function sendDirectMessage() {
    if (!newDM.trim() || sendingDM || !activeDM) return
    setSendingDM(true)
    try {
      const { data, error } = await supabase.rpc('send_dm', {
        p_receiver_id: activeDM.userId,
        p_content: newDM.trim()
      })

      if (error) throw error

      if (data?.success) {
        const newMsg = {
          id: data.dm_id,
          sender_id: currentUserId,
          receiver_id: activeDM.userId,
          content: newDM.trim(),
          created_at: new Date().toISOString(),
          is_read: false
        }
        setDmMessages(prev => [...prev, newMsg])
        setNewDM('')
        setTimeout(() => {
          if (dmScrollRef.current) {
            dmScrollRef.current.scrollTop = dmScrollRef.current.scrollHeight
          }
        }, 50)
      }
    } catch (err) {
      console.error('Send DM error:', err)
      showToast('Failed to send message')
    } finally {
      setSendingDM(false)
    }
  }

  // --- Post Functions ---
  async function handleHighFive(postId) {
    try {
      const { data, error } = await supabase.rpc('increment_high_five', { post_id: postId })
      if (error) {
        console.error('High five error:', error)
        showToast('Failed to high five')
        return
      }
      if (data?.success) {
        setPosts(posts.map(post => post.id === postId ? { ...post, likes_count: data.likes_count } : post))
        const likeKey = `workout:${postId}`
        if (data.action === 'added') {
          setUserLikes(prev => new Set([...prev, likeKey]))
        } else {
          setUserLikes(prev => { const next = new Set(prev); next.delete(likeKey); return next })
        }
      }
    } catch (err) {
      console.error('High five error:', err)
      showToast('Something went wrong')
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

  // Image handling for composer
  function handleComposerImage(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB')
      return
    }

    setComposerImage(file)
    const reader = new FileReader()
    reader.onloadend = () => setComposerImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  function removeComposerImage() {
    setComposerImage(null)
    setComposerImagePreview(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  async function uploadImage(file) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const ext = file.name.split('.').pop()
    const fileName = `${user.id}/${Date.now()}.${ext}`

    const { data, error } = await supabase.storage
      .from('post-images')
      .upload(fileName, file, { cacheControl: '3600', upsert: false })

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('post-images')
      .getPublicUrl(data.path)

    return urlData?.publicUrl || null
  }

  async function postMessage() {
    if ((!newMessage.trim() && !composerImage) || isPosting) return
    setIsPosting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast('Please log in to post')
        return
      }

      let imageUrl = null
      if (composerImage) {
        setUploadingImage(true)
        imageUrl = await uploadImage(composerImage)
        setUploadingImage(false)
      }

      const insertData = {
        user_id: user.id,
        content: newMessage.trim() || (imageUrl ? 'Shared a photo' : ''),
        message_type: 'text'
      }

      if (imageUrl) {
        insertData.image_url = imageUrl
      }

      const { data, error } = await supabase
        .from('community_messages')
        .insert(insertData)
        .select(`*, profiles:user_id (username, avatar_url)`)
        .single()

      if (error) {
        console.error('Error posting message:', error)
        // If image_url column doesn't exist yet, retry without it
        if (error.message?.includes('image_url')) {
          const { data: retryData, error: retryError } = await supabase
            .from('community_messages')
            .insert({ user_id: user.id, content: newMessage.trim() || 'Shared a post', message_type: 'text' })
            .select(`*, profiles:user_id (username, avatar_url)`)
            .single()

          if (retryError) {
            showToast('Failed to post. Please try again.')
            return
          }
          if (retryData) {
            setMessages([retryData, ...messages])
          }
        } else {
          showToast('Failed to post. Please try again.')
          return
        }
      } else if (data) {
        setMessages([data, ...messages])
      }

      setNewMessage('')
      setShowComposer(false)
      removeComposerImage()
      showToast('Posted!')
    } catch (err) {
      console.error('Error posting:', err)
      showToast('Something went wrong')
    } finally {
      setIsPosting(false)
      setUploadingImage(false)
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

  // --- DM Inbox View ---
  if (showDMs && !activeDM) {
    return (
      <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
        <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5 p-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowDMs(false)} className="p-2 -ml-2 text-arc-muted hover:text-white transition-colors">
              <ArrowLeftIcon />
            </button>
            <h1 className="text-xl font-black italic tracking-tighter">MESSAGES</h1>
          </div>
        </header>

        <main className="pt-20 px-4 max-w-lg mx-auto">
          {conversations.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-arc-surface rounded-full flex items-center justify-center mx-auto mb-4 text-arc-muted">
                <InboxIcon />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No Messages Yet</h3>
              <p className="text-arc-muted text-sm">Tap on a user&apos;s avatar in the feed to start a conversation</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <motion.button
                  key={conv.userId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => openDM(conv.userId, conv.username, conv.avatar_url)}
                  className="w-full flex items-center gap-3 bg-arc-card border border-white/5 rounded-2xl p-4 text-left hover:border-white/10 transition-colors"
                >
                  <div className="w-12 h-12 bg-arc-surface rounded-full flex items-center justify-center text-arc-accent font-bold shrink-0">
                    {conv.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-white">{conv.username}</span>
                      <span className="text-[11px] text-arc-muted">{formatTimeAgo(conv.lastTime)}</span>
                    </div>
                    <p className="text-sm text-arc-muted truncate mt-0.5">{conv.lastMessage}</p>
                  </div>
                  {conv.unread > 0 && (
                    <div className="w-5 h-5 bg-arc-accent rounded-full flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-white">{conv.unread}</span>
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </main>
        <Nav />
      </div>
    )
  }

  // --- Active DM Thread View ---
  if (showDMs && activeDM) {
    return (
      <div className="min-h-screen bg-arc-bg text-white font-sans flex flex-col">
        <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5 p-4">
          <div className="flex items-center gap-3">
            <button onClick={() => { setActiveDM(null); fetchConversations() }} className="p-2 -ml-2 text-arc-muted hover:text-white transition-colors">
              <ArrowLeftIcon />
            </button>
            <div className="w-8 h-8 bg-arc-surface rounded-full flex items-center justify-center text-arc-accent font-bold text-sm">
              {activeDM.username?.[0]?.toUpperCase() || '?'}
            </div>
            <span className="font-bold text-white">{activeDM.username}</span>
          </div>
        </header>

        <div ref={dmScrollRef} className="flex-1 overflow-y-auto pt-20 pb-24 px-4 max-w-lg mx-auto w-full">
          {dmMessages.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-arc-muted text-sm">Start a conversation with {activeDM.username}</p>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              {dmMessages.map((msg) => {
                const isMine = msg.sender_id === currentUserId
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[75%] px-4 py-3 rounded-2xl ${isMine ? 'bg-arc-accent text-white rounded-br-md' : 'bg-arc-card border border-white/5 text-white rounded-bl-md'}`}>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <span className={`text-[10px] mt-1 block ${isMine ? 'text-white/60' : 'text-arc-muted'}`}>
                        {formatTimeAgo(msg.created_at)}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 inset-x-0 bg-arc-bg/90 backdrop-blur-xl border-t border-white/5 p-4">
          <div className="flex gap-2 max-w-lg mx-auto">
            <input
              type="text"
              value={newDM}
              onChange={(e) => setNewDM(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDirectMessage() } }}
              placeholder="Type a message..."
              className="flex-1 bg-arc-surface border border-white/10 px-4 py-3 rounded-xl text-white outline-none focus:border-arc-accent transition-colors text-sm"
            />
            <button
              onClick={sendDirectMessage}
              disabled={!newDM.trim() || sendingDM}
              className="bg-arc-accent text-white p-3 rounded-xl disabled:opacity-50 shrink-0"
            >
              {sendingDM ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Main Feed View ---
  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-50 bg-arc-surface border border-white/10 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md"
          >
            <div className="w-2 h-2 rounded-full bg-arc-accent animate-pulse" />
            <span className="text-sm font-medium">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5">
        <div className="p-4 pb-0">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              COMMUNITY
            </h1>
            <div className="flex gap-2">
              <Link href="/profile" className="flex items-center gap-1.5 bg-arc-surface text-white text-xs font-bold px-3 py-2 rounded-full border border-white/10">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </Link>
              <button
                onClick={() => { setShowDMs(true); fetchConversations() }}
                className="relative flex items-center gap-1.5 bg-arc-surface text-white text-xs font-bold px-3 py-2 rounded-full border border-white/10"
              >
                <InboxIcon />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-arc-accent rounded-full flex items-center justify-center text-[9px] font-bold">{unreadCount}</span>
                )}
              </button>
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
              Feed
            </button>
          </div>
        </div>
      </header>

      <main className="pt-32 px-4 max-w-lg mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-2 border-arc-accent/30 border-t-arc-accent rounded-full" />
          </div>
        ) : (
          <div className="space-y-4 pb-10">
            {/* Workouts Tab */}
            {activeTab === 'workouts' && (
              <>
                {posts.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-arc-surface rounded-full flex items-center justify-center mx-auto mb-4 text-arc-muted">
                      <HighFiveIcon />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">No Workouts Yet</h3>
                    <p className="text-arc-muted text-sm">Be the first to share your workout!</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {posts.map((post, index) => {
                      const workout = post.workout_data
                      const hasHighFived = userLikes.has(`workout:${post.id}`)
                      const isOwnPost = post.user_id === currentUserId
                      const shareText = `Just logged ${workout.exercise_name}: ${workout.value}${getUnit(workout.metric_type)}${workout.is_new_pb ? ' - NEW PB!' : ''} on Arctivate!`

                      return (
                        <motion.div key={post.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="bg-arc-card border border-white/5 rounded-2xl overflow-hidden">
                          <div className="flex items-center gap-3 p-4 border-b border-white/5">
                            <button
                              onClick={() => {
                                if (!isOwnPost) {
                                  setShowDMs(true)
                                  openDM(post.user_id, post.profiles?.username, post.profiles?.avatar_url)
                                }
                              }}
                              disabled={isOwnPost}
                              className="w-10 h-10 bg-arc-surface rounded-full flex items-center justify-center text-arc-accent font-bold disabled:cursor-default"
                            >
                              {post.profiles?.username?.[0]?.toUpperCase() || '?'}
                            </button>
                            <div className="flex-1">
                              <span className="font-bold text-sm text-white">{post.profiles?.username || 'Anonymous'}</span>
                              <span className="block text-[11px] text-arc-muted">{formatTimeAgo(post.created_at)}</span>
                            </div>
                            {workout.is_new_pb && (
                              <span className="flex items-center gap-1 text-[10px] bg-arc-accent/20 text-arc-accent px-2 py-1 rounded-full font-bold">
                                <FireIcon />PB
                              </span>
                            )}
                          </div>

                          <div className="p-5">
                            <div className="text-center mb-4">
                              <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Logged</span>
                              <h3 className="text-lg font-bold text-white mt-1">{workout.exercise_name}</h3>
                            </div>
                            <div className="flex justify-center gap-6">
                              <div className="text-center">
                                <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">{workout.metric_type === 'time' ? 'Time' : 'Weight'}</span>
                                <div className="flex items-baseline justify-center gap-1 mt-1">
                                  <span className="text-2xl font-black font-mono text-arc-accent">{workout.value}</span>
                                  <span className="text-sm text-arc-muted font-bold">{getUnit(workout.metric_type)}</span>
                                </div>
                              </div>
                              <div className="text-center">
                                <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Points</span>
                                <div className="flex items-baseline justify-center gap-1 mt-1">
                                  <span className="text-sm text-green-400 font-bold">+</span>
                                  <span className="text-2xl font-black font-mono text-white">{workout.points_earned}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between px-4 py-3 bg-arc-bg/50 border-t border-white/5">
                            <div className="flex items-center gap-3">
                              <button onClick={() => handleHighFive(post.id)} disabled={isOwnPost} className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${hasHighFived ? 'bg-arc-accent/20 text-arc-accent' : 'bg-arc-surface text-arc-muted hover:text-white'} ${isOwnPost ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <HighFiveIcon filled={hasHighFived} />
                                <span className="font-bold text-sm">{post.likes_count || 0}</span>
                              </button>
                              {!isOwnPost && (
                                <button
                                  onClick={() => { setShowDMs(true); openDM(post.user_id, post.profiles?.username, post.profiles?.avatar_url) }}
                                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-arc-surface text-arc-muted hover:text-white transition-all"
                                >
                                  <MessageIcon />
                                </button>
                              )}
                            </div>
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
                    <div className="w-16 h-16 bg-arc-surface rounded-full flex items-center justify-center mx-auto mb-4 text-arc-muted">
                      <MessageIcon />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">No Posts Yet</h3>
                    <p className="text-arc-muted text-sm">Start the conversation!</p>
                    <button onClick={() => setShowComposer(true)} className="mt-4 bg-arc-accent text-white font-bold px-6 py-3 rounded-xl">
                      Create Post
                    </button>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((msg, index) => {
                      const hasLiked = userLikes.has(`message:${msg.id}`)
                      const isOwnMessage = msg.user_id === currentUserId

                      return (
                        <motion.div key={msg.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} className="bg-arc-card border border-white/5 rounded-2xl overflow-hidden">
                          <div className="p-4">
                            <div className="flex gap-3">
                              <button
                                onClick={() => {
                                  if (!isOwnMessage) {
                                    setShowDMs(true)
                                    openDM(msg.user_id, msg.profiles?.username, msg.profiles?.avatar_url)
                                  }
                                }}
                                disabled={isOwnMessage}
                                className="w-10 h-10 bg-arc-surface rounded-full flex items-center justify-center text-arc-accent font-bold shrink-0 disabled:cursor-default"
                              >
                                {msg.profiles?.username?.[0]?.toUpperCase() || '?'}
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-sm text-white">{msg.profiles?.username || 'Anonymous'}</span>
                                  <span className="text-[11px] text-arc-muted">{formatTimeAgo(msg.created_at)}</span>
                                  {msg.metadata?.type === 'meal' && (
                                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold">Meal</span>
                                  )}
                                </div>
                                <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                                {/* Meal macro card */}
                                {msg.metadata?.type === 'meal' && (
                                  <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                                    <div className="bg-arc-surface/50 p-2 rounded-lg">
                                      <div className="text-[10px] text-arc-muted">Cal</div>
                                      <div className="font-bold text-sm text-white">{msg.metadata.cals}</div>
                                    </div>
                                    <div className="bg-arc-surface/50 p-2 rounded-lg">
                                      <div className="text-[10px] text-arc-muted">Prot</div>
                                      <div className="font-bold text-sm text-blue-400">{msg.metadata.p}g</div>
                                    </div>
                                    <div className="bg-arc-surface/50 p-2 rounded-lg">
                                      <div className="text-[10px] text-arc-muted">Carb</div>
                                      <div className="font-bold text-sm text-yellow-400">{msg.metadata.c}g</div>
                                    </div>
                                    <div className="bg-arc-surface/50 p-2 rounded-lg">
                                      <div className="text-[10px] text-arc-muted">Fat</div>
                                      <div className="font-bold text-sm text-orange-400">{msg.metadata.f}g</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Image attachment */}
                            {msg.image_url && (
                              <div className="mt-3 ml-13 rounded-xl overflow-hidden">
                                <img src={msg.image_url} alt="" className="w-full max-h-80 object-cover rounded-xl" />
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                            <div className="flex items-center gap-3">
                              <button onClick={() => handleMessageLike(msg.id)} disabled={isOwnMessage} className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm transition-all ${hasLiked ? 'bg-arc-accent/20 text-arc-accent' : 'bg-arc-surface text-arc-muted hover:text-white'} ${isOwnMessage ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <HighFiveIcon filled={hasLiked} />
                                <span className="font-bold">{msg.likes_count || 0}</span>
                              </button>
                              {!isOwnMessage && (
                                <button
                                  onClick={() => { setShowDMs(true); openDM(msg.user_id, msg.profiles?.username, msg.profiles?.avatar_url) }}
                                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-arc-surface text-arc-muted hover:text-white transition-all text-sm"
                                >
                                  <MessageIcon />
                                </button>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => shareToTwitter(msg.content)} className="p-2 rounded-lg bg-arc-surface text-arc-muted hover:text-white transition-colors">
                                <TwitterIcon />
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
          </div>
        )}
      </main>

      {/* Compose Modal */}
      <AnimatePresence>
        {showComposer && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowComposer(false); removeComposerImage() }} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-6 z-50 max-h-[85vh] overflow-y-auto">
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-black italic tracking-tighter text-center mb-6">CREATE POST</h2>

              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Share your thoughts, motivation, or progress..."
                rows={4}
                className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors resize-none"
                autoFocus
              />

              {/* Image Preview */}
              {composerImagePreview && (
                <div className="mt-3 relative">
                  <img src={composerImagePreview} alt="Preview" className="w-full max-h-48 object-cover rounded-xl" />
                  <button
                    onClick={removeComposerImage}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/70 rounded-full flex items-center justify-center text-white"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              )}

              {/* Toolbar */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-2">
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleComposerImage} />
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-arc-surface border border-white/10 rounded-xl text-arc-muted hover:text-white transition-colors text-sm"
                  >
                    <ImageIcon />
                    Photo
                  </button>
                  <button
                    onClick={() => {
                      if (imageInputRef.current) {
                        imageInputRef.current.setAttribute('capture', 'environment')
                        imageInputRef.current.click()
                        imageInputRef.current.removeAttribute('capture')
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-arc-surface border border-white/10 rounded-xl text-arc-muted hover:text-white transition-colors text-sm"
                  >
                    <CameraIcon />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={() => { setShowComposer(false); removeComposerImage() }} className="flex-1 bg-arc-surface text-white font-bold py-4 rounded-xl">Cancel</button>
                <button
                  onClick={postMessage}
                  disabled={(!newMessage.trim() && !composerImage) || isPosting}
                  className="flex-1 bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isPosting ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                  ) : uploadingImage ? (
                    <span>Uploading...</span>
                  ) : (
                    <><SendIcon /> Post</>
                  )}
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
