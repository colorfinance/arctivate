import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Initialize native plugins when running on iOS/Android
      import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
      })
      import('@capacitor/keyboard').then(({ Keyboard }) => {
        Keyboard.setAccessoryBarVisible({ isVisible: true }).catch(() => {})
      })
      import('@capacitor/splash-screen').then(({ SplashScreen }) => {
        SplashScreen.hide().catch(() => {})
      })
    }
  }, [])

  return (
    <>
      <Head>
        <title>Arctivate</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>
      <div className={Capacitor.isNativePlatform() ? 'safe-area-wrapper' : ''}>
        <Component {...pageProps} />
      </div>
    </>
  )
}

export default MyApp
