import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'
import { initCapacitor } from '../lib/capacitor'
import { supabase } from '../lib/supabaseClient'

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    initCapacitor()

    // Keep session alive: listen for token refresh and sign-out events.
    // Supabase auto-refreshes tokens in the background when persistSession
    // is enabled — this listener ensures the UI reacts to auth changes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') {
        // Session refreshed silently — user stays logged in
      }
      if (event === 'SIGNED_OUT') {
        window.location.href = '/'
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <>
      <Head>
        <title>Arctivate</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#030808" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.svg" />
        <meta name="apple-mobile-web-app-title" content="Arctivate" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}

export default MyApp
