import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'

// Facebook Share SDK helper
const shareFacebook = (workoutData) => {
  const { exerciseName, value, metricType, isNewPB, date } = workoutData

  const unit = metricType === 'time' ? 'min' : 'kg'
  const pbText = isNewPB ? ' - NEW PERSONAL BEST!' : ''
  const shareText = `Just logged ${exerciseName}: ${value}${unit}${pbText} on Arctivate!`

  // Facebook Share Dialog URL
  const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin)}&quote=${encodeURIComponent(shareText)}`

  // Open in popup window for better UX
  window.open(
    shareUrl,
    'facebook-share',
    'width=580,height=400,scrollbars=no,resizable=no'
  )
}

// Icons
const ShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/>
    <circle cx="6" cy="12" r="3"/>
    <circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
)

const FacebookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
  </svg>
)

const CommunityIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

export default function ShareActionCard({
  workoutData,
  onClose,
  onShareComplete
}) {
  const [shareToFeed, setShareToFeed] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)

  const { exerciseName, value, metricType, isNewPB, pointsEarned, date } = workoutData

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const getUnit = () => metricType === 'time' ? 'min' : 'kg'

  const handleShareToCommunity = async () => {
    if (!shareToFeed) return

    setIsSharing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('public_feed').insert({
        user_id: user.id,
        workout_data: {
          exercise_name: exerciseName,
          value: value,
          metric_type: metricType,
          is_new_pb: isNewPB,
          points_earned: pointsEarned,
          date: date
        }
      })

      if (error) throw error

      setShareSuccess(true)
      if (onShareComplete) onShareComplete()
    } catch (err) {
      console.error('Error sharing to community:', err)
    } finally {
      setIsSharing(false)
    }
  }

  const handleFacebookShare = () => {
    shareFacebook(workoutData)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-sm bg-arc-card border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 text-arc-muted hover:text-white transition-colors"
        >
          <CloseIcon />
        </button>

        {/* Success Header */}
        <div className="relative bg-gradient-to-br from-arc-orange/20 to-transparent p-6 pb-8 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-arc-orange/10 via-transparent to-transparent" />

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', damping: 15 }}
            className="relative inline-flex items-center justify-center w-16 h-16 bg-arc-orange/20 border-2 border-arc-orange rounded-full mb-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', damping: 12 }}
            >
              <CheckIcon />
            </motion.div>
          </motion.div>

          <h2 className="relative text-xl font-black italic tracking-tight text-white mb-1">
            SET LOGGED!
          </h2>

          {isNewPB && (
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-block text-xs bg-arc-orange text-black px-3 py-1 rounded-full font-black tracking-wider mt-2"
            >
              NEW PERSONAL BEST
            </motion.span>
          )}
        </div>

        {/* Workout Summary Card */}
        <div className="px-6 -mt-4">
          <div className="bg-arc-bg border border-white/10 rounded-2xl p-5 space-y-4">
            {/* Exercise Name */}
            <div className="text-center">
              <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Movement</span>
              <h3 className="text-lg font-bold text-white mt-1">{exerciseName}</h3>
            </div>

            {/* Stats Row */}
            <div className="flex justify-center gap-8">
              <div className="text-center">
                <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">
                  {metricType === 'time' ? 'Time' : 'Weight'}
                </span>
                <div className="flex items-baseline justify-center gap-1 mt-1">
                  <span className="text-2xl font-black font-mono text-arc-orange">{value}</span>
                  <span className="text-sm text-arc-muted font-bold">{getUnit()}</span>
                </div>
              </div>

              <div className="text-center">
                <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Points</span>
                <div className="flex items-baseline justify-center gap-1 mt-1">
                  <span className="text-sm text-arc-orange font-bold">+</span>
                  <span className="text-2xl font-black font-mono text-white">{pointsEarned}</span>
                </div>
              </div>
            </div>

            {/* Date */}
            <div className="text-center pt-2 border-t border-white/5">
              <span className="text-xs text-arc-muted font-medium">{formatDate(date)}</span>
            </div>
          </div>
        </div>

        {/* Share Options */}
        <div className="p-6 space-y-4">
          {/* Share to Community Toggle */}
          <button
            onClick={() => setShareToFeed(!shareToFeed)}
            disabled={shareSuccess}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
              shareToFeed
                ? 'bg-arc-orange/10 border-arc-orange/50'
                : 'bg-arc-surface border-white/5 hover:border-white/10'
            } ${shareSuccess ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${shareToFeed ? 'bg-arc-orange/20 text-arc-orange' : 'bg-white/5 text-arc-muted'}`}>
                <CommunityIcon />
              </div>
              <div className="text-left">
                <span className="block text-sm font-bold text-white">Share to Community</span>
                <span className="text-[11px] text-arc-muted">Post to the Arctivate feed</span>
              </div>
            </div>

            {/* Toggle */}
            <div className={`relative w-12 h-7 rounded-full transition-colors ${
              shareToFeed ? 'bg-arc-orange' : 'bg-arc-surface'
            }`}>
              <motion.div
                animate={{ x: shareToFeed ? 22 : 2 }}
                className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
              />
            </div>
          </button>

          {/* Share to Feed Button (if toggle is on) */}
          <AnimatePresence>
            {shareToFeed && !shareSuccess && (
              <motion.button
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onClick={handleShareToCommunity}
                disabled={isSharing}
                className="w-full flex items-center justify-center gap-2 bg-arc-orange text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(255,69,0,0.3)] hover:bg-[#ff5500] transition-all disabled:opacity-50"
              >
                {isSharing ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <>
                    <ShareIcon />
                    <span>Post to Feed</span>
                  </>
                )}
              </motion.button>
            )}

            {shareSuccess && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-3 text-green-400 text-sm font-bold"
              >
                Posted to Community Feed!
              </motion.div>
            )}
          </AnimatePresence>

          {/* Divider */}
          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Or share to</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Facebook Share Button */}
          <button
            onClick={handleFacebookShare}
            className="w-full flex items-center justify-center gap-3 bg-[#1877F2] text-white font-bold py-4 rounded-xl hover:bg-[#166FE5] transition-colors"
          >
            <FacebookIcon />
            <span>Share on Facebook</span>
          </button>

          {/* Done Button */}
          <button
            onClick={onClose}
            className="w-full text-arc-muted font-bold py-3 hover:text-white transition-colors text-sm"
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
