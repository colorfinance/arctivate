import '../styles/globals.css'
import Head from 'next/head'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { useEffect } from 'react'
import { initCapacitor } from '../lib/capacitor'
import { supabase } from '../lib/supabaseClient'
import { getStoredTheme, applyTheme } from '../lib/theme'

// Fonts ship with the app and are preloaded. They used to come from an
// @import at the top of the stylesheet, which made every first load wait on
// three requests in a row (our CSS, Google's CSS, then the font files) before
// any text could render.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })
const mono = JetBrains_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-mono' })

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Apply saved theme (the no-flash script in _document set the class for
    // first paint; this keeps meta/status-bar in sync and covers navigations).
    applyTheme(getStoredTheme())

    initCapacitor()

    // Auto-scroll focused inputs into view (handles iOS WKWebView keyboard).
    const handleFocus = (e) => {
      const target = e.target
      if (!target) return
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Delay to let the keyboard start appearing
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
      </Head>
      <div className={`${inter.className} ${inter.variable} ${mono.variable}`}>
        <Component {...pageProps} />
      </div>
    </>
  )
}

export default MyApp
