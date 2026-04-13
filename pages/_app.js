import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'
import { initCapacitor, isNative } from '../lib/capacitor'
import { supabase } from '../lib/supabaseClient'

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    initCapacitor()

    // Auto-scroll focused inputs into view (web fallback only).
    // On native, the Capacitor keyboard plugin handles this via keyboardWillShow.
    const handleFocus = (e) => {
      if (isNative()) return
      const target = e.target
      if (!target) return
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        setTimeout(() => {
          try {
            target.scrollIntoView({ block: 'center', behavior: 'smooth' })
          } catch {}
        }, 300)
      }
    }
    document.addEventListener('focusin', handleFocus)

    // Keep session alive: listen for token refresh and sign-out events.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        window.location.href = '/'
      }
    })

    return () => {
      document.removeEventListener('focusin', handleFocus)
      subscription.unsubscribe()
    }
  }, [])

  return (
    <>
      <Head>
        <title>Arctivate</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="theme-color" content="#030808" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
        <meta name="apple-mobile-web-app-title" content="Arctivate" />
        {/* Preconnect to speed up first API call */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
