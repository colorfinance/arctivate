import { motion } from 'framer-motion'
import SyncStatusIndicator from './SyncStatusIndicator'

const PROVIDER_CONFIG = {
  garmin: {
    name: 'Garmin',
    color: '#00B4D8',
    description: 'Sync HRV, sleep, steps, stress, body battery and more',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  fitbit: {
    name: 'Fitbit',
    color: '#00B0B9',
    description: 'Sync heart rate, sleep stages, activity and SpO2',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  apple: {
    name: 'Apple Watch',
    color: '#A3A3A3',
    description: 'Coming soon with native mobile app',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="2" width="12" height="20" rx="3" />
        <line x1="12" y1="18" x2="12" y2="18.01" />
      </svg>
    ),
  },
}

function timeAgo(dateStr) {
  if (!dateStr) return null
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function WearableConnectionCard({
  provider,
  isConnected,
  lastSync,
  syncError,
  streak,
  onConnect,
  onDisconnect,
  isLoading,
  comingSoon,
  delay = 0,
}) {
  const config = PROVIDER_CONFIG[provider]
  if (!config) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-arc-card border rounded-2xl p-5 relative overflow-hidden ${
        comingSoon ? 'border-white/5 opacity-50' : 'border-white/5'
      }`}
    >
      <div className="absolute top-0 right-0 w-24 h-24 blur-3xl rounded-full pointer-events-none"
        style={{ backgroundColor: `${config.color}10` }}
      />

      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${config.color}20`, color: config.color }}
          >
            {config.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-white">{config.name}</h3>
              {isConnected && <SyncStatusIndicator lastSync={lastSync} error={syncError} />}
            </div>
            <p className="text-[10px] text-arc-muted mt-0.5">{config.description}</p>
          </div>
        </div>
      </div>

      {/* Status Details */}
      {isConnected && !comingSoon && (
        <div className="mt-3 flex items-center gap-4">
          {lastSync && (
            <span className="text-[10px] text-arc-muted">
              Last sync: <span className="text-white font-bold">{timeAgo(lastSync)}</span>
            </span>
          )}
          {streak > 0 && (
            <span className="text-[10px] text-arc-muted">
              Streak: <span className="text-arc-accent font-bold">{streak} days</span>
            </span>
          )}
        </div>
      )}

      {/* Error State */}
      {syncError && (
        <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <p className="text-[10px] text-red-400 font-bold">{syncError}</p>
        </div>
      )}

      {/* Action Button */}
      <div className="mt-4">
        {comingSoon ? (
          <div className="text-[10px] font-bold text-arc-muted uppercase tracking-widest text-center py-3 border border-white/5 rounded-xl">
            Coming Soon
          </div>
        ) : isConnected ? (
          <button
            onClick={onDisconnect}
            disabled={isLoading}
            className="w-full text-[10px] font-bold text-red-400 uppercase tracking-widest py-3 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Disconnecting...' : 'Disconnect'}
          </button>
        ) : (
          <button
            onClick={onConnect}
            disabled={isLoading}
            className="w-full bg-arc-accent text-white font-bold text-sm py-3 rounded-xl shadow-glow active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {isLoading ? 'Connecting...' : `Connect ${config.name}`}
          </button>
        )}
      </div>
    </motion.div>
  )
}
