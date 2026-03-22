import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Head from 'next/head'

export default function Download() {
  const [platform, setPlatform] = useState('unknown')

  useEffect(() => {
    const ua = navigator.userAgent || ''
    if (/android/i.test(ua)) {
      setPlatform('android')
    } else if (/iPad|iPhone|iPod/.test(ua)) {
      setPlatform('ios')
    } else {
      setPlatform('desktop')
    }
  }, [])

  return (
    <>
      <Head>
        <title>Download Arctivate</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
        {/* Logo / Title */}
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

        {/* Android Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '1rem',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '400px',
            marginBottom: '1rem',
          }}
        >
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Android
          </h2>
          <a
            href="https://github.com/colorfinance/arctivate/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
              color: '#000',
              fontWeight: 700,
              fontSize: '1.1rem',
              padding: '0.875rem',
              borderRadius: '0.75rem',
              textAlign: 'center',
              textDecoration: 'none',
              marginBottom: '1rem',
            }}
          >
            Download APK
          </a>
          <div style={{ color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '0.5rem', fontWeight: 600, color: '#d1d5db' }}>How to install:</p>
            <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Tap "Download APK" above</li>
              <li>Open the downloaded file</li>
              <li>Allow "Install from unknown sources" if prompted</li>
              <li>Tap Install</li>
            </ol>
          </div>
        </motion.div>

        {/* iOS Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '1rem',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '400px',
            marginBottom: '1rem',
          }}
        >
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            iPhone / iPad
          </h2>
          <a
            href="https://arctivate-repo.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              background: 'linear-gradient(135deg, #2dd4bf, #06b6d4)',
              color: '#000',
              fontWeight: 700,
              fontSize: '1.1rem',
              padding: '0.875rem',
              borderRadius: '0.75rem',
              textAlign: 'center',
              textDecoration: 'none',
              marginBottom: '1rem',
            }}
          >
            Open Web App
          </a>
          <div style={{ color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '0.5rem', fontWeight: 600, color: '#d1d5db' }}>Add to Home Screen:</p>
            <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Open the link above in <strong>Safari</strong></li>
              <li>Tap the <strong>Share</strong> button (square with arrow)</li>
              <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
              <li>Tap <strong>Add</strong> — it will appear as an app icon</li>
            </ol>
          </div>
        </motion.div>

        {/* Web Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '1rem',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '400px',
            marginBottom: '2rem',
          }}
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

        {/* Footer note */}
        <p style={{ color: '#6b7280', fontSize: '0.8rem', textAlign: 'center', maxWidth: '350px' }}>
          This is a test build. Please report any bugs or feedback to the team.
        </p>
      </div>
    </>
  )
}
