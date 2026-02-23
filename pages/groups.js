import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import Link from 'next/link'
import { useRouter } from 'next/router'

// Icons
const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
)

const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

const ChatIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const HeartIcon = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
)

export default function Groups() {
  const router = useRouter()
  const [groups, setGroups] = useState([])
  const [myGroups, setMyGroups] = useState(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [toast, setToast] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)

  // Group chat state
  const [activeGroup, setActiveGroup] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [groupMembers, setGroupMembers] = useState([])
  const [showMembers, setShowMembers] = useState(false)
  const [myLikes, setMyLikes] = useState(new Set())
  const chatEndRef = useRef(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }
    const { data: profile } = await supabase.from('profiles').select('completed_onboarding').eq('id', user.id).single()
    if (profile && profile.completed_onboarding === false) {
      router.push('/onboarding')
      return
    }
    setCurrentUserId(user.id)
    await Promise.all([fetchGroups(), fetchMyGroups(user.id)])
    setIsLoading(false)
  }

  async function fetchGroups() {
    try {
      const { data } = await supabase
        .from('groups')
        .select(`*, profiles:created_by (username)`)
        .eq('is_public', true)
        .order('member_count', { ascending: false })
        .limit(50)
      if (data) setGroups(data)
    } catch (err) {
      console.log('Groups not available yet')
    }
  }

  async function fetchMyGroups(userId) {
    try {
      const { data } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userId)
      if (data) setMyGroups(new Set(data.map(m => m.group_id)))
    } catch (err) {
      console.log('Group members not available yet')
    }
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function createGroup() {
    if (!newGroupName.trim() || isCreating) return

    setIsCreating(true)
    try {
      const { data } = await supabase.rpc('create_group', {
        p_name: newGroupName.trim(),
        p_description: newGroupDesc.trim() || null,
        p_is_public: isPublic
      })

      if (data?.success) {
        showToast('Group created!')
        setShowCreateModal(false)
        setNewGroupName('')
        setNewGroupDesc('')
        await Promise.all([fetchGroups(), fetchMyGroups(currentUserId)])
      } else {
        showToast(data?.error || 'Failed to create group')
      }
    } catch (err) {
      console.error('Create group error:', err)
      showToast('Something went wrong')
    } finally {
      setIsCreating(false)
    }
  }

  async function joinGroup(groupId) {
    try {
      const { data } = await supabase.rpc('join_group', { p_group_id: groupId })

      if (data?.success) {
        setMyGroups(prev => new Set([...prev, groupId]))
        setGroups(groups.map(g => g.id === groupId ? { ...g, member_count: g.member_count + 1 } : g))
        showToast('Joined group!')
      } else {
        showToast(data?.error || 'Failed to join')
      }
    } catch (err) {
      console.error('Join error:', err)
      showToast('Something went wrong')
    }
  }

  async function leaveGroup(groupId) {
    try {
      const { data } = await supabase.rpc('leave_group', { p_group_id: groupId })

      if (data?.success) {
        setMyGroups(prev => { const next = new Set(prev); next.delete(groupId); return next })
        setGroups(groups.map(g => g.id === groupId ? { ...g, member_count: Math.max(0, g.member_count - 1) } : g))
        showToast('Left group')
        if (activeGroup?.id === groupId) {
          setActiveGroup(null)
          setChatMessages([])
        }
      } else {
        showToast(data?.error || 'Failed to leave')
      }
    } catch (err) {
      console.error('Leave error:', err)
      showToast('Something went wrong')
    }
  }

  // --- Group Chat Functions ---

  async function openGroupChat(group) {
    setActiveGroup(group)
    setChatMessages([])
    setShowMembers(false)
    await Promise.all([
      fetchGroupMessages(group.id),
      fetchGroupMembers(group.id)
    ])
  }

  async function fetchGroupMessages(groupId) {
    try {
      const { data } = await supabase
        .from('community_messages')
        .select(`*, profiles:user_id (username, avatar_url)`)
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })
        .limit(100)
      if (data) setChatMessages(data)

      // Fetch my likes for these messages
      if (data && data.length > 0) {
        const msgIds = data.map(m => m.id)
        const { data: likes } = await supabase
          .from('message_likes')
          .select('message_id')
          .eq('user_id', currentUserId)
          .in('message_id', msgIds)
        if (likes) setMyLikes(new Set(likes.map(l => l.message_id)))
      }
    } catch (err) {
      console.log('Messages not available yet')
    }
  }

  async function fetchGroupMembers(groupId) {
    try {
      const { data } = await supabase
        .from('group_members')
        .select(`*, profiles:user_id (username, avatar_url)`)
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true })
      if (data) setGroupMembers(data)
    } catch (err) {
      console.log('Members not available yet')
    }
  }

  async function sendGroupMessage() {
    if (!chatInput.trim() || isSending || !activeGroup) return

    setIsSending(true)
    const content = chatInput.trim()
    setChatInput('')

    try {
      const { error } = await supabase
        .from('community_messages')
        .insert({
          user_id: currentUserId,
          group_id: activeGroup.id,
          content,
          message_type: 'text'
        })

      if (!error) {
        await fetchGroupMessages(activeGroup.id)
      } else {
        showToast('Failed to send message')
        setChatInput(content)
      }
    } catch (err) {
      console.error('Send error:', err)
      showToast('Something went wrong')
      setChatInput(content)
    } finally {
      setIsSending(false)
    }
  }

  async function toggleLike(messageId) {
    try {
      const { data } = await supabase.rpc('toggle_message_like', { p_message_id: messageId })
      if (data?.success) {
        setChatMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, likes_count: data.likes_count } : m
        ))
        setMyLikes(prev => {
          const next = new Set(prev)
          if (data.action === 'liked') next.add(messageId)
          else next.delete(messageId)
          return next
        })
      }
    } catch (err) {
      console.error('Like error:', err)
    }
  }

  function formatTime(ts) {
    const d = new Date(ts)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  // --- Render: Group Chat View ---
  if (activeGroup) {
    return (
      <div className="min-h-screen bg-arc-bg text-white flex flex-col font-sans">
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

        {/* Chat Header */}
        <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5 p-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setActiveGroup(null); setChatMessages([]); setShowMembers(false) }}
              className="p-2 -ml-2 text-arc-muted hover:text-white transition-colors"
            >
              <ArrowLeftIcon />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-black italic tracking-tighter truncate">{activeGroup.name}</h1>
              <p className="text-xs text-arc-muted">{activeGroup.member_count} {activeGroup.member_count === 1 ? 'member' : 'members'}</p>
            </div>
            <button
              onClick={() => setShowMembers(!showMembers)}
              className={`p-2 rounded-lg transition-colors ${showMembers ? 'bg-arc-accent/20 text-arc-accent' : 'text-arc-muted hover:text-white'}`}
            >
              <UsersIcon />
            </button>
          </div>
        </header>

        {/* Members Panel */}
        <AnimatePresence>
          {showMembers && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="fixed top-[72px] inset-x-0 z-30 bg-arc-card border-b border-white/5 overflow-hidden"
            >
              <div className="p-4 max-h-48 overflow-y-auto">
                <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-3">Members</h3>
                <div className="space-y-2">
                  {groupMembers.map(m => (
                    <div key={m.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-arc-surface flex items-center justify-center text-xs font-bold text-arc-accent overflow-hidden">
                        {m.profiles?.avatar_url ? (
                          <img src={m.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          m.profiles?.username?.[0]?.toUpperCase() || '?'
                        )}
                      </div>
                      <span className="text-sm font-medium flex-1">{m.profiles?.username || 'Unknown'}</span>
                      {m.role === 'owner' && (
                        <span className="text-[10px] font-bold text-arc-accent bg-arc-accent/10 px-2 py-0.5 rounded-full">Owner</span>
                      )}
                      {m.role === 'admin' && (
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">Admin</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Messages */}
        <main className="flex-1 pt-20 pb-20 px-4 max-w-lg mx-auto w-full overflow-y-auto">
          {chatMessages.length === 0 ? (
            <div className="text-center py-20">
              <ChatIcon />
              <p className="text-arc-muted text-sm mt-4">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              {chatMessages.map((msg) => {
                const isMe = msg.user_id === currentUserId
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {!isMe && (
                        <span className="text-[10px] text-arc-muted font-bold mb-1 px-1">
                          {msg.profiles?.username || 'Unknown'}
                        </span>
                      )}
                      <div className={`px-4 py-2.5 rounded-2xl ${isMe
                        ? 'bg-arc-accent text-white rounded-br-md'
                        : 'bg-arc-card border border-white/5 text-white rounded-bl-md'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-[10px] text-arc-muted">{formatTime(msg.created_at)}</span>
                        <button
                          onClick={() => toggleLike(msg.id)}
                          className={`flex items-center gap-1 text-[10px] transition-colors ${
                            myLikes.has(msg.id) ? 'text-red-400' : 'text-arc-muted hover:text-red-400'
                          }`}
                        >
                          <HeartIcon filled={myLikes.has(msg.id)} />
                          {msg.likes_count > 0 && msg.likes_count}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
              <div ref={chatEndRef} />
            </div>
          )}
        </main>

        {/* Chat Input */}
        <div className="fixed bottom-0 inset-x-0 bg-arc-bg/80 backdrop-blur-xl border-t border-white/5 p-4">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendGroupMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-arc-surface border border-white/10 px-4 py-3 rounded-xl text-white text-sm outline-none focus:border-arc-accent transition-colors"
            />
            <button
              onClick={sendGroupMessage}
              disabled={!chatInput.trim() || isSending}
              className="bg-arc-accent text-white p-3 rounded-xl disabled:opacity-50 transition-opacity"
            >
              {isSending ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Render: Groups List View ---
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
      <header className="fixed top-0 inset-x-0 z-40 bg-arc-bg/80 backdrop-blur-xl border-b border-white/5 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/feed" className="p-2 -ml-2 text-arc-muted hover:text-white transition-colors">
              <ArrowLeftIcon />
            </Link>
            <h1 className="text-xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              GROUPS
            </h1>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 bg-arc-accent text-white text-xs font-bold px-3 py-2 rounded-full"
          >
            <PlusIcon />
            Create
          </button>
        </div>
      </header>

      <main className="pt-20 px-4 max-w-lg mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-arc-accent/30 border-t-arc-accent rounded-full"
            />
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-bold text-white mb-2">No Groups Yet</h3>
            <p className="text-arc-muted text-sm mb-6">Create the first fitness group!</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-arc-accent text-white font-bold px-6 py-3 rounded-xl"
            >
              Create Group
            </button>
          </div>
        ) : (
          <div className="space-y-4 pb-10">
            {/* My Groups Section */}
            {myGroups.size > 0 && (
              <div className="mb-6">
                <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-3 px-1">My Groups</h2>
                <div className="space-y-3">
                  {groups.filter(g => myGroups.has(g.id)).map((group) => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      isMember={true}
                      onLeave={() => leaveGroup(group.id)}
                      onChat={() => openGroupChat(group)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Discover Section */}
            <div>
              <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-3 px-1">Discover</h2>
              <div className="space-y-3">
                {groups.filter(g => !myGroups.has(g.id)).map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    isMember={false}
                    onJoin={() => joinGroup(group.id)}
                  />
                ))}
                {groups.filter(g => !myGroups.has(g.id)).length === 0 && (
                  <p className="text-center text-arc-muted text-sm py-8">You've joined all available groups!</p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Group Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] p-6 z-50 pb-safe"
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-black italic tracking-tighter text-center mb-6">CREATE GROUP</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Group Name</label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Morning Warriors"
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Description (Optional)</label>
                  <textarea
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="What's this group about?"
                    rows={2}
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors resize-none"
                  />
                </div>

                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className="w-full flex items-center justify-between p-4 bg-arc-surface border border-white/10 rounded-xl"
                >
                  <span className="font-bold text-sm">Public Group</span>
                  <div className={`w-12 h-7 rounded-full transition-colors relative ${isPublic ? 'bg-arc-accent' : 'bg-white/10'}`}>
                    <motion.div
                      animate={{ x: isPublic ? 22 : 2 }}
                      className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                    />
                  </div>
                </button>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-arc-surface text-white font-bold py-4 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={createGroup}
                  disabled={!newGroupName.trim() || isCreating}
                  className="flex-1 bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    'Create'
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

function GroupCard({ group, isMember, onJoin, onLeave, onChat }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-arc-card border border-white/5 rounded-2xl p-4"
    >
      <div className="flex items-start gap-4">
        <div
          onClick={isMember && onChat ? onChat : undefined}
          className={`w-12 h-12 bg-arc-surface rounded-xl flex items-center justify-center text-arc-accent font-bold text-lg shrink-0 ${isMember ? 'cursor-pointer hover:bg-arc-surface/80' : ''}`}
        >
          {group.name[0]?.toUpperCase()}
        </div>
        <div
          className={`flex-1 min-w-0 ${isMember ? 'cursor-pointer' : ''}`}
          onClick={isMember && onChat ? onChat : undefined}
        >
          <h3 className="font-bold text-white">{group.name}</h3>
          {group.description && (
            <p className="text-arc-muted text-sm mt-0.5 line-clamp-2">{group.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-xs text-arc-muted">
              <UsersIcon />
              {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
            </span>
            {group.profiles?.username && (
              <span className="text-xs text-arc-muted">by {group.profiles.username}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isMember && onChat && (
            <button
              onClick={onChat}
              className="text-xs font-bold text-arc-accent bg-arc-accent/10 p-2 rounded-lg hover:bg-arc-accent/20 transition-colors"
              title="Open chat"
            >
              <ChatIcon />
            </button>
          )}
          {isMember ? (
            <button
              onClick={onLeave}
              className="flex items-center gap-1 text-xs font-bold text-green-400 bg-green-400/10 px-3 py-2 rounded-lg"
            >
              <CheckIcon />
              Joined
            </button>
          ) : (
            <button
              onClick={onJoin}
              className="text-xs font-bold text-arc-accent bg-arc-accent/10 px-4 py-2 rounded-lg hover:bg-arc-accent hover:text-white transition-colors"
            >
              Join
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
