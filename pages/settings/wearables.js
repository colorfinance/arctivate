import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Nav from '../../components/Nav'
import WearableConnectionCard from '../../components/WearableConnectionCard'
import { supabase } from '../../lib/supabaseClient'
import { useRouter } from 'next/router'

// Icons
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
)

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16" />
    <line x1="12" y1="12" x2="12" y2="21" />
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export default function WearableSettings() {
  const router = useRouter()
  const fileInputRef = useRef(null)

  const [isLoading, setIsLoading] = useState(true)
  const [status, setStatus] = useState({
    garmin: { connected: false },
    fitbit: { connected: false },
    apple: { connected: false, comingSoon: true },
  })
  const [recentSyncs, setRecentSyncs] = useState([])
  const [connectingProvider, setConnectingProvider] = useState(null)
  const [toast, setToast] = useState(null)
  const [importResults, setImportResults] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    loadStatus()

    // Handle query params from OAuth callbacks
    const { connected, error } = router.query
    if (connected) {
      showToast(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected successfully! +50 pts`)
      router.replace('/settings/wearables', undefined, { shallow: true })
    }
    if (error) {
      const errorMessages = {
        missing_params: 'Connection failed: missing parameters',
        expired_session: 'Session expired. Please try again.',
        invalid_state: 'Invalid session. Please try again.',
        save_failed: 'Failed to save connection. Please try again.',
        connection_failed: 'Connection failed. Please try again.',
      }
      showToast(errorMessages[error] || 'Connection error')
      router.replace('/settings/wearables', undefined, { shallow: true })
    }
  }, [router.query])

  async function loadStatus() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    try {
      const res = await fetch('/api/wearables/status')
      if (res.ok) {
        const data = await res.json()
        setStatus(data.status)
        setRecentSyncs(data.recentSyncs)
      }
    } catch (err) {
      console.error('Failed to load wearable status:', err)
    }
    setIsLoading(false)
  }

  function handleConnect(provider) {
    setConnectingProvider(provider)
    // Redirect to OAuth init endpoint
    window.location.href = `/api/wearables/${provider}/auth-init`
  }

  async function handleDisconnect(provider) {
    setConnectingProvider(provider)
    try {
      const res = await fetch('/api/wearables/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      if (res.ok) {
        setStatus(prev => ({
          ...prev,
          [provider]: { connected: false, lastSync: null, error: null, streak: 0 },
        }))
        showToast(`${provider.charAt(0).toUpperCase() + provider.slice(1)} disconnected`)
      }
    } catch (err) {
      showToast('Failed to disconnect')
    }
    setConnectingProvider(null)
  }

  async function handleFileImport(e) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      let rows = []

      if (file.name.endsWith('.json')) {
        rows = JSON.parse(text)
        if (!Array.isArray(rows)) rows = [rows]
      } else {
        // Parse CSV
        const lines = text.trim().split('\n')
        const headers = lines[0].split(',').map(h => h.trim())
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim())
          const row = {}
          headers.forEach((h, idx) => { row[h] = values[idx] || null })
          rows.push(row)
        }
      }

      const res = await fetch('/api/wearables/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: rows, format: file.name.endsWith('.json') ? 'json' : 'csv' }),
      })

      const result = await res.json()
      setImportResults(result)
      if (result.imported > 0) {
        showToast(`Imported ${result.imported} day(s) of data! +${result.imported * 3} pts`)
      }
    } catch (err) {
      showToast('Failed to parse file')
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function formatSyncTime(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-arc-bg flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-arc-accent/30 border-t-arc-accent rounded-full" />
      </div>
    )
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
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => router.push('/profile')}
            className="p-2 -ml-2 text-arc-muted hover:text-white transition-colors"
          >
            <ArrowLeftIcon />
          </button>
          <div>
            <h1 className="text-lg font-black italic tracking-tighter">WEARABLE CONNECTIONS</h1>
            <span className="text-[10px] text-arc-muted font-bold uppercase tracking-widest">Auto-sync your health data</span>
          </div>
        </div>
      </header>

      <main className="pt-24 px-4 max-w-lg mx-auto space-y-4">
        {/* Provider Cards */}
        <WearableConnectionCard
          provider="garmin"
          isConnected={status.garmin.connected}
          lastSync={status.garmin.lastSync}
          syncError={status.garmin.error}
          streak={status.garmin.streak}
          onConnect={() => handleConnect('garmin')}
          onDisconnect={() => handleDisconnect('garmin')}
          isLoading={connectingProvider === 'garmin'}
          delay={0}
        />

        <WearableConnectionCard
          provider="fitbit"
          isConnected={status.fitbit.connected}
          lastSync={status.fitbit.lastSync}
          syncError={status.fitbit.error}
          streak={status.fitbit.streak}
          onConnect={() => handleConnect('fitbit')}
          onDisconnect={() => handleDisconnect('fitbit')}
          isLoading={connectingProvider === 'fitbit'}
          delay={0.05}
        />

        <WearableConnectionCard
          provider="apple"
          isConnected={false}
          comingSoon={true}
          delay={0.1}
        />

        {/* CSV/JSON Import */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-arc-card border border-white/5 rounded-2xl p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-arc-surface flex items-center justify-center text-arc-muted">
              <UploadIcon />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Manual Import</h3>
              <p className="text-[10px] text-arc-muted">Upload CSV or JSON from any source</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json"
            onChange={handleFileImport}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-arc-surface border border-dashed border-white/10 rounded-xl py-4 text-sm text-arc-muted hover:text-white hover:border-arc-accent/30 transition-colors"
          >
            Choose CSV or JSON file
          </button>

          {importResults && (
            <div className="mt-3 bg-arc-surface rounded-lg p-3">
              <div className="flex items-center gap-2">
                <CheckIcon />
                <span className="text-xs font-bold text-white">
                  {importResults.imported} day(s) imported
                </span>
              </div>
              {importResults.errors?.length > 0 && (
                <p className="text-[10px] text-red-400 mt-1">
                  {importResults.errors.length} row(s) had errors
                </p>
              )}
            </div>
          )}

          <div className="mt-3 bg-arc-surface rounded-lg p-3">
            <p className="text-[10px] text-arc-muted font-bold uppercase tracking-wider mb-1">CSV Format</p>
            <code className="text-[9px] text-white/60 block whitespace-pre leading-relaxed">
              date,hrv,rhr,sleep_hours,sleep_quality,steps{'\n'}
              2026-02-20,62,58,7.5,good,8500
            </code>
          </div>
        </motion.div>

        {/* Recent Sync Activity */}
        {recentSyncs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-arc-card border border-white/5 rounded-2xl p-5"
          >
            <h3 className="text-[10px] font-bold text-arc-muted uppercase tracking-widest mb-3">Recent Activity</h3>
            <div className="space-y-2">
              {recentSyncs.map((sync, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      sync.event_type === 'error' ? 'bg-red-400' : 'bg-green-400'
                    }`} />
                    <span className="text-xs text-white capitalize">{sync.provider}</span>
                    <span className="text-[10px] text-arc-muted">{sync.event_type.replace('_', ' ')}</span>
                  </div>
                  <span className="text-[10px] text-arc-muted">{formatSyncTime(sync.created_at)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Points Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-arc-accent/5 border border-arc-accent/20 rounded-2xl p-5"
        >
          <h3 className="text-[10px] font-bold text-arc-accent uppercase tracking-widest mb-2">Sync Rewards</h3>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/70">First connection</span>
              <span className="font-bold text-arc-accent">+50 pts</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/70">Daily auto-sync</span>
              <span className="font-bold text-arc-accent">+5 pts</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/70">7-day streak bonus</span>
              <span className="font-bold text-arc-accent">+25 pts</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/70">30-day streak bonus</span>
              <span className="font-bold text-arc-accent">+100 pts</span>
            </div>
          </div>
        </motion.div>
      </main>

      <Nav />
    </div>
  )
}
