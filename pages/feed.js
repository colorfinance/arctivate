import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/router'
import Nav from '../components/Nav'
import Masthead from '../components/Masthead'
import Button from '../components/Button'
import { EmptyState } from '../components/ui'
import LoadingState from '../components/LoadingState'
import Avatar from '../components/Avatar'
import SessionCard, { timeAgo } from '../components/feed/SessionCard'
import PostMenu from '../components/feed/PostMenu'
import { supabase } from '../lib/supabaseClient'
import { filterContent } from '../lib/contentFilter'

// The feed: what your gym has been doing, newest first.
//
// It used to be two tabs, a Following filter, direct messages, groups, high
// fives, kudos and comments. In a year nobody sent a message, followed anyone,
// gave kudos or wrote a comment, and groups had not been touched since
// February. So it is one list: workouts people shared and posts people wrote,
// with one Post button.

// Session photos sit in the same private bucket Train uses; the feed only
// reads them, through short-lived signed URLs.
const SESSION_PHOTO_BUCKET = 'workout-photos'
const SESSION_PHOTO_TTL = 60 * 60

const unitOf = (m) => (m === 'time' ? 'min' : m === 'distance' ? 'km' : m === 'reps' ? ' reps' : 'kg')

export default function Feed() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState(null)
  const [sessions, setSessions] = useState([])
  const [sessionPhotos, setSessionPhotos] = useState({})
  const [messages, setMessages] = useState([])
  const [legacy, setLegacy] = useState([]) // single-lift posts from before sessions
  const [blocked, setBlocked] = useState(new Set())
  const [toast, setToast] = useState(null)

  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [posting, setPosting] = useState(false)
  const imageInputRef = useRef(null)

  const [reporting, setReporting] = useState(null) // { type, id }
  const [reportReason, setReportReason] = useState('inappropriate')
  const [reportBusy, setReportBusy] = useState(false)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase.from('profiles').select('completed_onboarding').eq('id', user.id).single()
      if (profile && profile.completed_onboarding === false) { router.push('/onboarding'); return }
      setMe(user.id)
      await Promise.all([fetchSessions(), fetchMessages(), fetchLegacy(), fetchBlocked(user.id)])
      setLoading(false)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // content_reports only takes 'feed', 'message', 'user' and 'dm'. The old
  // feed sent 'feed_post' and 'community_message', every report bounced off
  // the check constraint, and the member was told it had been sent.

  // RLS decides what comes back: your own sessions, plus gym-visible ones from
  // your gym. A session shows once it has a lift in it, finished or not --
  // almost nobody taps Finish, and waiting for it meant the feed stayed empty.
  async function fetchSessions() {
    try {
      const { data, error } = await supabase
        .from('workout_sessions')
        .select(`
          id, user_id, title, started_at, ended_at, visibility,
          profiles:user_id (username, avatar_url),
          logs:workout_logs (id, value, sets, reps, is_new_pb, exercise:exercise_id (name, metric_type))
        `)
        .order('started_at', { ascending: false })
        .limit(40)
      if (error) { console.error('[Arctivate] session feed failed:', error); return }
      // Only sessions shared with the gym. RLS also returns your own private
      // ones; those stay in your history on Train, not here.
      const withLifts = (data || []).filter(s => s.visibility === 'gym' && (s.logs || []).length > 0)
      setSessions(withLifts)
      if (withLifts.length) fetchSessionPhotos(withLifts.map(s => s.id))
    } catch {}
  }

  async function fetchSessionPhotos(ids) {
    try {
      const { data } = await supabase.from('workout_photos').select('storage_path, session_id').in('session_id', ids)
      if (!data?.length) return
      const paths = data.map(r => r.storage_path)
      const { data: signed } = await supabase.storage.from(SESSION_PHOTO_BUCKET).createSignedUrls(paths, SESSION_PHOTO_TTL)
      const byPath = {}
      ;(signed || []).forEach((sg, i) => { if (sg?.signedUrl) byPath[paths[i]] = sg.signedUrl })
      const map = {}
      data.forEach(r => { if (byPath[r.storage_path]) (map[r.session_id] ||= []).push(byPath[r.storage_path]) })
      setSessionPhotos(map)
    } catch {}
  }

  async function fetchMessages() {
    try {
      const { data } = await supabase
        .from('community_messages')
        .select('*, profiles:user_id (username, avatar_url)')
        .is('group_id', null)
        .order('created_at', { ascending: false })
        .limit(40)
      setMessages(data || [])
    } catch {}
  }

  async function fetchLegacy() {
    try {
      const { data } = await supabase
        .from('public_feed')
        .select('*, profiles:user_id (username, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(20)
      setLegacy(data || [])
    } catch {}
  }

  async function fetchBlocked(uid) {
    try {
      const { data } = await supabase.from('blocked_users').select('blocked_id').eq('user_id', uid)
      setBlocked(new Set((data || []).map(b => b.blocked_id)))
    } catch {}
  }

  // One timeline, newest first.
  const items = useMemo(() => {
    const list = [
      ...sessions.map(s => ({ kind: 'session', id: `s:${s.id}`, at: s.started_at, user: s.user_id, row: s })),
      ...messages.map(m => ({ kind: 'post', id: `m:${m.id}`, at: m.created_at, user: m.user_id, row: m })),
      ...legacy.map(p => ({ kind: 'lift', id: `l:${p.id}`, at: p.created_at, user: p.user_id, row: p })),
    ]
    return list.filter(i => !blocked.has(i.user)).sort((a, b) => new Date(b.at) - new Date(a.at))
  }, [sessions, messages, legacy, blocked])

  async function blockUser(uid) {
    if (!me || uid === me) return
    const { error } = await supabase.from('blocked_users').insert({ user_id: me, blocked_id: uid })
    if (error && error.code !== '23505') { showToast('Could not block them'); return }
    setBlocked(prev => new Set([...prev, uid]))
    showToast('Blocked. You will not see their posts.')
  }

  async function submitReport() {
    if (!reporting || reportBusy) return
    setReportBusy(true)
    const { error } = await supabase.from('content_reports').insert({
      reporter_id: me, content_type: reporting.type, content_id: reporting.id, reason: reportReason,
    })
    setReportBusy(false)
    if (error) { showToast('Could not send the report'); return }
    setReporting(null)
    showToast('Reported. We will review it.')
  }

  async function deleteSession(id) {
    const snapshot = sessions
    setSessions(prev => prev.filter(s => s.id !== id))
    const { error } = await supabase.from('workout_sessions').delete().eq('id', id)
    if (error) { setSessions(snapshot); showToast('Could not delete that') }
  }

  async function deletePost(kind, id) {
    const table = kind === 'lift' ? 'public_feed' : 'community_messages'
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', me)
    if (error) { showToast('Could not delete that'); return }
    if (kind === 'lift') setLegacy(prev => prev.filter(p => p.id !== id))
    else setMessages(prev => prev.filter(m => m.id !== id))
  }

  function pickImage(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { showToast('That photo is over 5MB'); return }
    setImage(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  function closeComposer() {
    if (posting) return
    setComposing(false)
    setDraft('')
    setImage(null)
    setImagePreview(null)
  }

  async function post() {
    const text = draft.trim()
    if ((!text && !image) || posting) return
    if (text && !filterContent(text).clean) { showToast('That has words we do not allow. Change them and try again.'); return }
    setPosting(true)
    try {
      let imageUrl = null
      if (image) {
        const ext = (image.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${me}/${Date.now()}.${ext}`
        const { data, error } = await supabase.storage.from('post-images').upload(path, image, { cacheControl: '3600', upsert: false })
        if (error) { showToast('Could not upload the photo'); return }
        imageUrl = supabase.storage.from('post-images').getPublicUrl(data.path).data?.publicUrl || null
      }
      const row = { user_id: me, content: text || 'Shared a photo', message_type: 'text' }
      if (imageUrl) row.image_url = imageUrl
      const { data, error } = await supabase.from('community_messages').insert(row)
        .select('*, profiles:user_id (username, avatar_url)').single()
      if (error) { showToast('Could not post. Try again.'); return }
      setMessages(prev => [data, ...prev])
      setPosting(false)
      closeComposer()
      showToast('Posted')
    } finally {
      setPosting(false)
    }
  }

  if (loading) return <LoadingState label="Loading the feed…" />

  return (
    <div className="min-h-screen bg-arc-bg text-white pb-24 font-sans">
      {toast && (
        <div role="status" className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] bg-arc-surface border border-white/10 text-white px-5 py-2.5 rounded-full shadow-2xl text-sm font-medium">
          {toast}
        </div>
      )}

      <Masthead
        title="Feed"
        actions={<Button variant="primary" size="sm" onClick={() => setComposing(true)}>Post</Button>}
      />

      <main className="pt-20 px-4 max-w-lg mx-auto space-y-3 pb-6">
        {items.length === 0 && (
          <EmptyState
            title="Nothing here yet"
            body="Workouts you log on Train show up here for your gym. Say hello with a post."
            action={<Button variant="primary" size="sm" onClick={() => setComposing(true)}>Write a post</Button>}
          />
        )}

        {items.map(item => {
          if (item.kind === 'session') {
            return (
              <SessionCard
                key={item.id}
                session={item.row}
                currentUserId={me}
                photos={sessionPhotos[item.row.id]}
                onDelete={deleteSession}
                onReport={(id) => setReporting({ type: 'feed', id })}
                onBlock={blockUser}
              />
            )
          }
          const r = item.row
          const mine = r.user_id === me
          const name = r.profiles?.username || 'Member'
          const w = item.kind === 'lift' ? (r.workout_data || {}) : null
          return (
            <article key={item.id} className="bg-arc-card border border-white/[0.06] rounded-container overflow-hidden">
              <div className="flex items-center gap-3 p-4 pb-2">
                <Avatar src={r.profiles?.avatar_url} name={name} size={38} />
                <div className="flex-1 min-w-0">
                  <span className="block font-bold text-sm text-white truncate">{name}</span>
                  <span className="block t-caption text-arc-muted">{timeAgo(r.created_at)}{w ? ' · logged a lift' : r.metadata?.type === 'meal' ? ' · ate' : ''}</span>
                </div>
                {w?.is_new_pb && <span className="shrink-0 t-caption font-black bg-arc-accent/20 text-arc-accent px-2.5 py-1 rounded-full">PB</span>}
                <PostMenu
                  onDelete={mine ? () => deletePost(item.kind, r.id) : undefined}
                  onReport={mine ? undefined : () => setReporting({ type: w ? 'feed' : 'message', id: r.id })}
                  onBlock={mine ? undefined : () => blockUser(r.user_id)}
                />
              </div>
              <div className="px-4 pb-4">
                {w ? (
                  <div className="flex items-center gap-2 text-[14px]">
                    <span className={`flex-1 min-w-0 truncate font-bold ${w.is_new_pb ? 'text-arc-accent' : 'text-white'}`}>{w.exercise_name}</span>
                    <span className="shrink-0 t-num text-arc-muted">{w.value}{unitOf(w.metric_type)}</span>
                  </div>
                ) : (
                  <>
                    {/* A shared meal carries its numbers in metadata; the text
                        version repeats them, so show the meal once. */}
                    {r.metadata?.type === 'meal' ? (
                      <div className="flex items-baseline gap-2">
                        <span className="flex-1 min-w-0 font-bold text-[14px] text-white break-words">{r.metadata.name || 'A meal'}</span>
                        <span className="shrink-0 t-num text-arc-muted text-[13px]">{r.metadata.cals} cal</span>
                      </div>
                    ) : r.content && !(r.image_url && r.content === 'Shared a photo') && (
                      <p className="t-body text-white/90 whitespace-pre-wrap break-words">{r.content}</p>
                    )}
                    {r.metadata?.type === 'meal' && (
                      <p className="t-caption text-arc-muted mt-1">
                        Protein {r.metadata.p}g · Carbs {r.metadata.c}g · Fat {r.metadata.f}g
                      </p>
                    )}
                    {r.image_url && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={r.image_url} alt="" loading="lazy" className="mt-3 w-full max-h-80 object-cover rounded-control" />
                    )}
                  </>
                )}
              </div>
            </article>
          )
        })}
      </main>

      {composing && (
        <>
          <div onClick={closeComposer} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
          <div role="dialog" aria-label="Write a post" className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] z-50 max-h-[85vh] overflow-y-auto">
            <div className="p-6 space-y-4 pb-safe max-w-lg mx-auto">
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
              <h2 className="t-title text-white" style={{ fontSize: 20 }}>Post to your gym</h2>
              <textarea
                id="f-post"
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
                placeholder="How did it go?"
                rows={4}
                autoFocus
                className="w-full p-4 rounded-control bg-arc-surface2 border border-white/[0.08] text-[15px] text-white outline-none focus:border-arc-accent resize-none"
              />
              {imagePreview && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="" className="w-full max-h-48 object-cover rounded-control" />
                  <button onClick={() => { setImage(null); setImagePreview(null) }} aria-label="Remove photo" className="absolute top-2 right-2 w-8 h-8 bg-black/70 rounded-full flex items-center justify-center text-white">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              )}
              <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => imageInputRef.current?.click()} disabled={posting}>{image ? 'Change photo' : 'Add a photo'}</Button>
                <Button variant="primary" className="flex-1" onClick={post} disabled={posting || (!draft.trim() && !image)}>{posting ? 'Posting…' : 'Post'}</Button>
              </div>
            </div>
          </div>
        </>
      )}

      {reporting && (
        <>
          <div onClick={() => !reportBusy && setReporting(null)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
          <div role="dialog" aria-label="Report" className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] z-50">
            <div className="p-6 space-y-3 pb-safe max-w-lg mx-auto">
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
              <div>
                <h2 className="t-title text-white" style={{ fontSize: 20 }}>Report this</h2>
                <p className="t-caption text-arc-muted mt-0.5">We review every report.</p>
              </div>
              {[
                ['spam', 'Spam'],
                ['harassment', 'Harassment or bullying'],
                ['hate_speech', 'Hate speech'],
                ['inappropriate', 'Inappropriate'],
                ['other', 'Something else'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setReportReason(value)}
                  aria-pressed={reportReason === value}
                  className={`w-full text-left px-4 py-3 rounded-control text-[14px] font-bold border transition-colors ${reportReason === value ? 'border-arc-danger/40 bg-arc-danger/10 text-white' : 'border-white/[0.06] bg-arc-surface2/60 text-arc-muted'}`}
                >
                  {label}
                </button>
              ))}
              <div className="flex gap-2 pt-1">
                <Button variant="danger" className="flex-1" onClick={submitReport} disabled={reportBusy}>{reportBusy ? 'Sending…' : 'Send report'}</Button>
                <Button variant="tertiary" onClick={() => setReporting(null)} disabled={reportBusy}>Cancel</Button>
              </div>
            </div>
          </div>
        </>
      )}

      <Nav />
    </div>
  )
}
