import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../lib/supabaseClient'
import confetti from 'canvas-confetti'

// Icons
const QRIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
)

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const CameraIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

export default function QRScanner({ onPointsEarned }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [error, setError] = useState(null)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)

  // Cleanup scanner on unmount or close
  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  const startScanner = async () => {
    setIsScanning(true)
    setError(null)
    setScanResult(null)

    try {
      html5QrCodeRef.current = new Html5Qrcode('qr-reader')

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        async (decodedText) => {
          // Successfully scanned
          await stopScanner()
          await handleScan(decodedText)
        },
        (errorMessage) => {
          // Ignore scan errors (happens continuously while scanning)
        }
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
      } catch (e) {
        // Ignore errors when stopping
      }
      html5QrCodeRef.current = null
    }
    setIsScanning(false)
  }

  const handleScan = async (code) => {
    setIsRedeeming(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Please log in to redeem codes')
        setIsRedeeming(false)
        return
      }

      const response = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          user_id: user.id
        })
      })

      const result = await response.json()

      if (result.success) {
        setScanResult(result)

        // Trigger celebration
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#00D4AA', '#06B6D4', '#ffffff']
        })

        // Notify parent about points earned
        if (result.type === 'points' && onPointsEarned) {
          onPointsEarned(result.points_awarded)
        }
      } else {
        setError(result.error || 'Failed to redeem code')
      }
    } catch (err) {
      console.error('Redeem error:', err)
      setError('Network error. Please try again.')
    } finally {
      setIsRedeeming(false)
    }
  }

  const handleClose = () => {
    stopScanner()
    setIsOpen(false)
    setScanResult(null)
    setError(null)
  }

  const handleOpen = () => {
    setIsOpen(true)
    setScanResult(null)
    setError(null)
  }

  return (
    <>
      {/* QR Scanner Button */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 text-[10px] font-bold text-arc-accent uppercase tracking-widest border border-arc-accent/30 px-3 py-1.5 rounded-full hover:bg-arc-accent hover:text-white transition-colors"
      >
        <QRIcon />
        <span>Scan</span>
      </button>

      {/* Scanner Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 50 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-arc-card border border-white/10 rounded-3xl overflow-hidden z-50"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/5">
                <h2 className="text-lg font-black italic tracking-tight text-white">
                  SCAN QR CODE
                </h2>
                <button
                  onClick={handleClose}
                  className="p-2 text-arc-muted hover:text-white transition-colors"
                >
                  <CloseIcon />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Success State */}
                {scanResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 10 }}
                      className="inline-flex items-center justify-center w-24 h-24 bg-arc-accent/20 rounded-full mb-6"
                    >
                      <GiftIcon />
                    </motion.div>

                    <h3 className="text-2xl font-black italic text-white mb-2">
                      {scanResult.type === 'points' ? 'POINTS EARNED!' : 'ACCESS GRANTED!'}
                    </h3>

                    {scanResult.type === 'points' && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', damping: 12 }}
                        className="text-5xl font-black font-mono text-arc-accent mb-4"
                      >
                        +{scanResult.points_awarded}
                      </motion.div>
                    )}

                    <p className="text-arc-muted font-medium">
                      {scanResult.description}
                    </p>

                    <button
                      onClick={handleClose}
                      className="mt-8 w-full bg-arc-accent text-white font-bold py-4 rounded-xl shadow-glow-accent hover:brightness-110 transition-all"
                    >
                      AWESOME!
                    </button>
                  </motion.div>
                )}

                {/* Error State */}
                {error && !scanResult && (
                  <div className="text-center py-8">
                    <div className="text-5xl mb-4">😕</div>
                    <h3 className="text-xl font-bold text-white mb-2">Oops!</h3>
                    <p className="text-red-400 mb-6">{error}</p>
                    <button
                      onClick={() => {
                        setError(null)
                        startScanner()
                      }}
                      className="w-full bg-arc-surface text-white font-bold py-4 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {/* Scanner View */}
                {!scanResult && !error && (
                  <>
                    {/* Scanner Container */}
                    <div className="relative">
                      <div
                        id="qr-reader"
                        ref={scannerRef}
                        className="w-full aspect-square bg-black rounded-2xl overflow-hidden"
                      />

                      {/* Scanner Overlay */}
                      {isScanning && (
                        <div className="absolute inset-0 pointer-events-none">
                          {/* Corner brackets */}
                          <div className="absolute top-4 left-4 w-12 h-12 border-l-4 border-t-4 border-arc-accent rounded-tl-lg" />
                          <div className="absolute top-4 right-4 w-12 h-12 border-r-4 border-t-4 border-arc-accent rounded-tr-lg" />
                          <div className="absolute bottom-4 left-4 w-12 h-12 border-l-4 border-b-4 border-arc-accent rounded-bl-lg" />
                          <div className="absolute bottom-4 right-4 w-12 h-12 border-r-4 border-b-4 border-arc-accent rounded-br-lg" />

                          {/* Scanning line animation */}
                          <motion.div
                            animate={{ top: ['10%', '90%', '10%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-arc-accent to-transparent"
                          />
                        </div>
                      )}

                      {/* Loading/Redeeming Overlay */}
                      {isRedeeming && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-2xl">
                          <div className="text-center">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="w-12 h-12 border-4 border-arc-accent/30 border-t-arc-accent rounded-full mx-auto mb-4"
                            />
                            <p className="text-white font-bold">Redeeming...</p>
                          </div>
                        </div>
                      )}

                      {/* Start Camera Button */}
                      {!isScanning && !isRedeeming && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <button
                            onClick={startScanner}
                            className="flex flex-col items-center gap-3 text-arc-muted hover:text-white transition-colors"
                          >
                            <div className="p-6 bg-arc-surface rounded-full">
                              <CameraIcon />
                            </div>
                            <span className="font-bold text-sm">Tap to Start Camera</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Instructions */}
                    <p className="text-center text-arc-muted text-sm mt-4">
                      Point your camera at a QR code to scan
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
