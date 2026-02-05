import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../components/Nav'
import { supabase } from '../lib/supabaseClient'
import { Html5Qrcode } from 'html5-qrcode'
import confetti from 'canvas-confetti'

// Icons
const QRIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
)

const CameraIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
)

const GiftIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
)

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

export default function CheckIn() {
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [error, setError] = useState(null)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [toast, setToast] = useState(null)

  // User state
  const [currentUser, setCurrentUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [totalPoints, setTotalPoints] = useState(0)

  // Check-in history
  const [recentCheckIns, setRecentCheckIns] = useState([])

  // Admin state
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [rewardCodes, setRewardCodes] = useState([])
  const [showCreateCode, setShowCreateCode] = useState(false)
  const [newCode, setNewCode] = useState({ code: '', points: '', name: '', description: '' })
  const [isCreating, setIsCreating] = useState(false)

  // Scanner refs
  const html5QrCodeRef = useRef(null)

  useEffect(() => {
    loadData()
    return () => stopScanner()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setCurrentUser(user)

      // Fetch profile with admin status and points
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, total_points')
        .eq('id', user.id)
        .single()

      if (profile) {
        setIsAdmin(profile.is_admin || false)
        setTotalPoints(profile.total_points || 0)
      }

      // Fetch recent check-ins
      const { data: checkIns } = await supabase
        .from('check_ins')
        .select('*, partners(name)')
        .eq('user_id', user.id)
        .order('checked_in_at', { ascending: false })
        .limit(10)

      if (checkIns) setRecentCheckIns(checkIns)

      // If admin, fetch reward codes
      if (profile?.is_admin) {
        fetchRewardCodes()
      }
    }
  }

  async function fetchRewardCodes() {
    const { data } = await supabase
      .from('rewards_ledger')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (data) setRewardCodes(data)
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const startScanner = async () => {
    setIsScanning(true)
    setError(null)
    setScanResult(null)

    try {
      html5QrCodeRef.current = new Html5Qrcode('qr-reader')

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        async (decodedText) => {
          await stopScanner()
          await handleScan(decodedText)
        },
        () => {}
      )
    } catch (err) {
      console.error('Scanner error:', err)
      setError('Could not access camera. Please check permissions.')
      setIsScanning(false)
    }
  }

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current.clear()
      } catch (e) {}
      html5QrCodeRef.current = null
    }
    setIsScanning(false)
  }

  const handleScan = async (code) => {
    setIsRedeeming(true)
    setError(null)

    try {
      if (!currentUser) {
        setError('Please log in to redeem codes')
        setIsRedeeming(false)
        return
      }

      // Use the RPC function for redemption
      const { data, error: rpcError } = await supabase.rpc('redeem_code', {
        p_code: code,
        p_user_id: currentUser.id
      })

      if (rpcError) throw rpcError

      if (data?.success) {
        setScanResult(data)

        // Update points
        if (data.points_awarded) {
          setTotalPoints(prev => prev + data.points_awarded)
        }

        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#FF4500', '#FFD700', '#ffffff']
        })

        // Refresh check-ins
        loadData()
      } else {
        setError(data?.error || 'Failed to redeem code')
      }
    } catch (err) {
      console.error('Redeem error:', err)
      setError('Network error. Please try again.')
    } finally {
      setIsRedeeming(false)
    }
  }

  const createRewardCode = async () => {
    if (!newCode.code.trim() || !newCode.points) {
      showToast('Please enter code and points value')
      return
    }

    setIsCreating(true)

    try {
      const { data, error } = await supabase.rpc('create_reward_code', {
        p_code: newCode.code.trim().toUpperCase(),
        p_code_type: 'points',
        p_points_value: parseInt(newCode.points, 10),
        p_name: newCode.name.trim() || null,
        p_description: newCode.description.trim() || null
      })

      if (error) throw error

      if (data?.success) {
        showToast('Reward code created!')
        setNewCode({ code: '', points: '', name: '', description: '' })
        setShowCreateCode(false)
        fetchRewardCodes()
      } else {
        showToast(data?.error || 'Failed to create code')
      }
    } catch (err) {
      console.error('Create code error:', err)
      showToast('Failed to create code')
    } finally {
      setIsCreating(false)
    }
  }

  const deleteRewardCode = async (id) => {
    if (!confirm('Delete this reward code?')) return

    try {
      const { error } = await supabase.from('rewards_ledger').delete().eq('id', id)
      if (error) throw error

      setRewardCodes(prev => prev.filter(c => c.id !== id))
      showToast('Code deleted')
    } catch (err) {
      console.error('Delete error:', err)
      showToast('Failed to delete code')
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setNewCode({ ...newCode, code })
  }

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
          <div>
            <h1 className="text-xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
              CHECK-IN
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Points</span>
              <span className="text-lg font-black font-mono text-arc-orange">{totalPoints.toLocaleString()}</span>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAdminPanel(!showAdminPanel)}
              className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors ${showAdminPanel ? 'bg-arc-accent text-white' : 'text-arc-accent border border-arc-accent/30 hover:bg-arc-accent hover:text-white'}`}
            >
              Admin
            </button>
          )}
        </div>
      </header>

      <main className="pt-24 px-4 max-w-lg mx-auto">
        {/* Scanner Section */}
        {!showAdminPanel && (
          <section className="mb-8">
            <div className="bg-arc-card border border-white/5 rounded-3xl overflow-hidden">
              {/* Scanner Container */}
              <div className="relative aspect-square">
                <div id="qr-reader" className="w-full h-full bg-black" />

                {/* Scanner Overlay */}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-8 left-8 w-16 h-16 border-l-4 border-t-4 border-arc-orange rounded-tl-lg" />
                    <div className="absolute top-8 right-8 w-16 h-16 border-r-4 border-t-4 border-arc-orange rounded-tr-lg" />
                    <div className="absolute bottom-8 left-8 w-16 h-16 border-l-4 border-b-4 border-arc-orange rounded-bl-lg" />
                    <div className="absolute bottom-8 right-8 w-16 h-16 border-r-4 border-b-4 border-arc-orange rounded-br-lg" />
                    <motion.div
                      animate={{ top: ['15%', '85%', '15%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-arc-orange to-transparent"
                    />
                  </div>
                )}

                {/* Redeeming Overlay */}
                {isRedeeming && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                    <div className="text-center">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-12 h-12 border-4 border-arc-orange/30 border-t-arc-orange rounded-full mx-auto mb-4"
                      />
                      <p className="text-white font-bold">Redeeming...</p>
                    </div>
                  </div>
                )}

                {/* Success State */}
                {scanResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 bg-arc-card flex items-center justify-center"
                  >
                    <div className="text-center p-8">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 10 }}
                        className="inline-flex items-center justify-center w-24 h-24 bg-arc-orange/20 rounded-full mb-6 text-arc-orange"
                      >
                        <GiftIcon />
                      </motion.div>
                      <h3 className="text-2xl font-black italic text-white mb-2">
                        {scanResult.type === 'points' ? 'POINTS EARNED!' : 'CHECK-IN SUCCESS!'}
                      </h3>
                      {scanResult.points_awarded && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: 'spring' }}
                          className="text-5xl font-black font-mono text-arc-orange mb-4"
                        >
                          +{scanResult.points_awarded}
                        </motion.div>
                      )}
                      <p className="text-arc-muted">{scanResult.description}</p>
                      <button
                        onClick={() => setScanResult(null)}
                        className="mt-6 w-full bg-arc-orange text-white font-bold py-4 rounded-xl"
                      >
                        AWESOME!
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Error State */}
                {error && !scanResult && (
                  <div className="absolute inset-0 bg-arc-card flex items-center justify-center">
                    <div className="text-center p-8">
                      <div className="text-5xl mb-4">😕</div>
                      <h3 className="text-xl font-bold text-white mb-2">Oops!</h3>
                      <p className="text-red-400 mb-6">{error}</p>
                      <button
                        onClick={() => { setError(null); startScanner() }}
                        className="w-full bg-arc-surface text-white font-bold py-4 rounded-xl"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}

                {/* Start Camera Button */}
                {!isScanning && !isRedeeming && !scanResult && !error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-arc-surface">
                    <button
                      onClick={startScanner}
                      className="flex flex-col items-center gap-4 text-arc-muted hover:text-white transition-colors"
                    >
                      <div className="p-8 bg-arc-bg rounded-full">
                        <CameraIcon />
                      </div>
                      <span className="font-bold">Tap to Scan QR Code</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="p-4 text-center">
                <p className="text-arc-muted text-sm">
                  Scan QR codes at partner locations to earn points!
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Admin Panel */}
        {showAdminPanel && isAdmin && (
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-black italic">Reward Codes</h2>
              <button
                onClick={() => setShowCreateCode(true)}
                className="flex items-center gap-1.5 bg-arc-accent text-white text-xs font-bold px-3 py-2 rounded-full"
              >
                <PlusIcon />
                Create
              </button>
            </div>

            {rewardCodes.length === 0 ? (
              <div className="text-center py-12 text-arc-muted">
                No reward codes yet. Create one!
              </div>
            ) : (
              <div className="space-y-3">
                {rewardCodes.map(code => (
                  <div key={code.id} className="bg-arc-card border border-white/5 rounded-xl p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-mono font-bold text-white text-lg">{code.code}</div>
                        {code.name && <div className="text-sm text-arc-muted">{code.name}</div>}
                        <div className="flex items-center gap-3 mt-2 text-xs">
                          <span className="text-arc-orange font-bold">{code.points_value} PTS</span>
                          <span className={code.is_used ? 'text-red-400' : 'text-green-400'}>
                            {code.is_used ? 'Used' : 'Active'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteRewardCode(code.id)}
                        className="p-2 text-arc-muted hover:text-red-500 transition-colors"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Recent Check-ins */}
        {!showAdminPanel && recentCheckIns.length > 0 && (
          <section>
            <h2 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-3 px-1">
              Recent Check-ins
            </h2>
            <div className="space-y-2">
              {recentCheckIns.map(checkIn => (
                <div key={checkIn.id} className="bg-arc-card border border-white/5 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white">{checkIn.partners?.name || 'Unknown'}</div>
                    <div className="text-xs text-arc-muted">{formatDate(checkIn.checked_in_at)}</div>
                  </div>
                  <div className="text-arc-orange font-bold">+{checkIn.awarded_points}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Create Code Modal */}
      <AnimatePresence>
        {showCreateCode && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateCode(false)}
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
              <h2 className="text-xl font-black italic tracking-tighter text-center mb-6">CREATE REWARD CODE</h2>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest">Code</label>
                    <button
                      onClick={generateRandomCode}
                      className="text-[10px] font-bold text-arc-accent uppercase tracking-widest"
                    >
                      Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newCode.code}
                    onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. WELCOME100"
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Points Value</label>
                  <input
                    type="number"
                    value={newCode.points}
                    onChange={(e) => setNewCode({ ...newCode, points: e.target.value })}
                    placeholder="100"
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Name (Optional)</label>
                  <input
                    type="text"
                    value={newCode.name}
                    onChange={(e) => setNewCode({ ...newCode, name: e.target.value })}
                    placeholder="e.g. Welcome Bonus"
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-2 block">Description (Optional)</label>
                  <input
                    type="text"
                    value={newCode.description}
                    onChange={(e) => setNewCode({ ...newCode, description: e.target.value })}
                    placeholder="e.g. New member welcome bonus"
                    className="w-full bg-arc-surface border border-white/10 p-4 rounded-xl text-white outline-none focus:border-arc-accent transition-colors"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCreateCode(false)}
                  className="flex-1 bg-arc-surface text-white font-bold py-4 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={createRewardCode}
                  disabled={isCreating || !newCode.code.trim() || !newCode.points}
                  className="flex-1 bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    'Create Code'
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
