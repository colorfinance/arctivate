import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Head from 'next/head'

// Share icon SVG (iOS share button)
const ShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginBottom: '2px' }}>
    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
)

// Plus icon for Add to Home Screen
const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginBottom: '2px' }}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const cardStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '1rem',
  padding: '1.5rem',
  width: '100%',
  maxWidth: '400px',
  marginBottom: '1rem',
}

const buttonStyle = {
  display: 'block',
  background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
  color: '#000',
  fontWeight: 700,
  fontSize: '1.1rem',
  padding: '0.875rem',
  borderRadius: '0.75rem',
  textAlign: 'center',
  textDecoration: 'none',
  border: 'none',
  cursor: 'pointer',
  width: '100%',
}

export default function Download() {
  const [platform, setPlatform] = useState('unknown')
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [guideStep, setGuideStep] = useState(1)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isSafari, setIsSafari] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent || ''
    if (/android/i.test(ua)) {
      setPlatform('android')
    } else if (/iPad|iPhone|iPod/.test(ua)) {
      setPlatform('ios')
    } else {
      setPlatform('desktop')
    }

    // Check if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsStandalone(true)
    }

    // Check if Safari
    const isSaf = /^((?!chrome|android|CriOS|FxiOS|OPiOS).)*safari/i.test(ua)
    setIsSafari(isSaf)
  }, [])

  const startIOSGuide = () => {
    setGuideStep(1)
    setShowIOSGuide(true)
  }

  return (
    <>
      <Head>
        <title>Download Arctivate</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Arctivate" />
        <link rel="manifest" href="/manifest.json" />
      </Head>

      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #111827 50%, #0a0a0a 100%)',
        color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: '2rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: '2rem', marginTop: '2rem' }}
        >
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.5rem',
          }}>
            Arctivate
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '1.1rem' }}>
            Your AI-powered fitness companion
          </p>
        </motion.div>

        {/* Already installed message */}
        {isStandalone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              background: 'rgba(45, 212, 191, 0.1)',
              border: '1px solid rgba(45, 212, 191, 0.3)',
              borderRadius: '0.75rem',
              padding: '1rem 1.5rem',
              marginBottom: '1.5rem',
              maxWidth: '400px',
              textAlign: 'center',
              color: '#2dd4bf',
              fontWeight: 600,
            }}
          >
            Arctivate is installed on your device!
          </motion.div>
        )}

        {/* iOS Card - shown first on iPhone */}
        {platform === 'ios' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={cardStyle}
          >
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              Install on iPhone
            </h2>

            {!isSafari ? (
              <>
                <div style={{
                  background: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  marginBottom: '1rem',
                  color: '#fbbf24',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                }}>
                  <strong>Open this page in Safari</strong> to install. Copy this link and paste it in Safari:
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  fontSize: '0.85rem',
                  color: '#2dd4bf',
                  wordBreak: 'break-all',
                  textAlign: 'center',
                  marginBottom: '1rem',
                }}>
                  arctivate-repo.vercel.app/download
                </div>
              </>
            ) : (
              <>
                <button onClick={startIOSGuide} style={buttonStyle}>
                  Install App
                </button>
                <p style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center', marginTop: '0.75rem' }}>
                  We'll walk you through 2 quick steps
                </p>
              </>
            )}
          </motion.div>
        )}

        {/* Android Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: platform === 'android' ? 0.1 : 0.2 }}
          style={{
            ...cardStyle,
            display: platform === 'ios' ? 'none' : 'block',
          }}
        >
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            {platform === 'android' ? 'Install on Android' : 'Android'}
          </h2>
          <a
            href="https://github.com/colorfinance/arctivate/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            style={buttonStyle}
          >
            Download APK
          </a>
          <div style={{ color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.6, marginTop: '1rem' }}>
            <p style={{ marginBottom: '0.5rem', fontWeight: 600, color: '#d1d5db' }}>How to install:</p>
            <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Tap "Download APK" above</li>
              <li>Open the downloaded file</li>
              <li>Allow "Install from unknown sources" if prompted</li>
              <li>Tap Install</li>
            </ol>
          </div>
        </motion.div>

        {/* iOS Card (for non-iOS users) */}
        {platform !== 'ios' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={cardStyle}
          >
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              iPhone / iPad
            </h2>
            <a
              href="https://arctivate-repo.vercel.app/download"
              target="_blank"
              rel="noopener noreferrer"
              style={buttonStyle}
            >
              Open Install Page on iPhone
            </a>
            <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginTop: '0.75rem' }}>
              Open this link on your iPhone in Safari to install
            </p>
          </motion.div>
        )}

        {/* Web Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={cardStyle}
        >
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Web Browser
          </h2>
          <a
            href="https://arctivate-repo.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(45, 212, 191, 0.3)',
              color: '#2dd4bf',
              fontWeight: 700,
              fontSize: '1.1rem',
              padding: '0.875rem',
              borderRadius: '0.75rem',
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            Use in Browser
          </a>
        </motion.div>

        <p style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center', maxWidth: '350px', marginTop: '1rem' }}>
          This is a test build. Please report any bugs or feedback to the team.
        </p>
      </div>

      {/* iOS Install Guide Overlay */}
      <AnimatePresence>
        {showIOSGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            {/* Backdrop */}
            <div
              onClick={() => setShowIOSGuide(false)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.85)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
              }}
            />

            {/* Guide Content */}
            <div style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '2rem',
            }}>
              {/* Step indicator */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '2rem',
              }}>
                {[1, 2, 3].map(s => (
                  <div key={s} style={{
                    width: s === guideStep ? '2rem' : '0.5rem',
                    height: '0.5rem',
                    borderRadius: '0.25rem',
                    background: s === guideStep ? '#2dd4bf' : 'rgba(255,255,255,0.2)',
                    transition: 'all 0.3s',
                  }} />
                ))}
              </div>

              <AnimatePresence mode="wait">
                {/* Step 1: Tap Share */}
                {guideStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    style={{ textAlign: 'center', maxWidth: '320px' }}
                  >
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '1rem',
                      background: 'rgba(0, 122, 255, 0.15)',
                      border: '2px solid rgba(0, 122, 255, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1.5rem',
                    }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                        <polyline points="16 6 12 2 8 6" />
                        <line x1="12" y1="2" x2="12" y2="15" />
                      </svg>
                    </div>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>
                      Step 1: Tap Share
                    </h2>
                    <p style={{ color: '#9ca3af', fontSize: '1rem', lineHeight: 1.6 }}>
                      Tap the <ShareIcon /> <strong style={{ color: '#fff' }}>Share</strong> button at the bottom of Safari
                    </p>

                    {/* Arrow pointing down to Safari toolbar */}
                    <motion.div
                      animate={{ y: [0, 10, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      style={{ marginTop: '3rem', color: '#007AFF' }}
                    >
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <polyline points="19 12 12 19 5 12" />
                      </svg>
                    </motion.div>

                    <button
                      onClick={() => setGuideStep(2)}
                      style={{
                        ...buttonStyle,
                        marginTop: '2rem',
                        maxWidth: '280px',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                      }}
                    >
                      I tapped Share — Next
                    </button>
                  </motion.div>
                )}

                {/* Step 2: Add to Home Screen */}
                {guideStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    style={{ textAlign: 'center', maxWidth: '320px' }}
                  >
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '1rem',
                      background: 'rgba(45, 212, 191, 0.15)',
                      border: '2px solid rgba(45, 212, 191, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1.5rem',
                    }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </div>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>
                      Step 2: Add to Home Screen
                    </h2>
                    <p style={{ color: '#9ca3af', fontSize: '1rem', lineHeight: 1.6 }}>
                      Scroll down in the share menu and tap{' '}
                      <strong style={{ color: '#fff' }}><PlusIcon /> Add to Home Screen</strong>
                    </p>

                    {/* Mock iOS share sheet option */}
                    <div style={{
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: '0.75rem',
                      padding: '1rem 1.25rem',
                      marginTop: '1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      border: '1px solid rgba(45, 212, 191, 0.3)',
                    }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <PlusIcon />
                      </div>
                      <span style={{ color: '#fff', fontSize: '1rem' }}>Add to Home Screen</span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem', justifyContent: 'center' }}>
                      <button
                        onClick={() => setGuideStep(1)}
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '1rem',
                          padding: '0.75rem 1.5rem',
                          borderRadius: '0.75rem',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Back
                      </button>
                      <button
                        onClick={() => setGuideStep(3)}
                        style={{
                          ...buttonStyle,
                          width: 'auto',
                          padding: '0.75rem 1.5rem',
                        }}
                      >
                        Done — Next
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Tap Add */}
                {guideStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    style={{ textAlign: 'center', maxWidth: '320px' }}
                  >
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '1rem',
                      background: 'rgba(45, 212, 191, 0.15)',
                      border: '2px solid rgba(45, 212, 191, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1.5rem',
                    }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>
                      Step 3: Tap "Add"
                    </h2>
                    <p style={{ color: '#9ca3af', fontSize: '1rem', lineHeight: 1.6 }}>
                      Tap <strong style={{ color: '#007AFF' }}>Add</strong> in the top-right corner.
                      Arctivate will appear on your home screen as an app!
                    </p>

                    <div style={{
                      background: 'rgba(45, 212, 191, 0.1)',
                      border: '1px solid rgba(45, 212, 191, 0.2)',
                      borderRadius: '0.75rem',
                      padding: '1.25rem',
                      marginTop: '1.5rem',
                      color: '#2dd4bf',
                      fontSize: '0.9rem',
                      lineHeight: 1.6,
                    }}>
                      The app will work offline, send notifications, and feel just like a native app.
                    </div>

                    <button
                      onClick={() => setShowIOSGuide(false)}
                      style={{
                        ...buttonStyle,
                        marginTop: '2rem',
                        maxWidth: '280px',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                      }}
                    >
                      Got it!
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Close button */}
              <button
                onClick={() => setShowIOSGuide(false)}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#9ca3af',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                x
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
