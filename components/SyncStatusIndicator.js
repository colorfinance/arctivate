import { motion } from 'framer-motion'

export default function SyncStatusIndicator({ lastSync, error, size = 'sm' }) {
  const getStatus = () => {
    if (error) return { color: '#ef4444', label: 'Error' }
    if (!lastSync) return { color: '#6b7280', label: 'Never synced' }

    const hoursSince = (Date.now() - new Date(lastSync).getTime()) / (1000 * 60 * 60)
    if (hoursSince < 6) return { color: '#22c55e', label: 'Synced recently' }
    if (hoursSince < 24) return { color: '#f59e0b', label: 'Synced today' }
    return { color: '#ef4444', label: 'Stale' }
  }

  const { color, label } = getStatus()
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'

  return (
    <div className="flex items-center gap-1.5">
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className={`${dotSize} rounded-full`}
        style={{ backgroundColor: color }}
      />
      {size !== 'sm' && (
        <span className="text-[10px] font-bold text-arc-muted uppercase tracking-wider">{label}</span>
      )}
    </div>
  )
}
