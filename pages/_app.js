import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'
import { initCapacitor } from '../lib/capacitor'

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    initCapacitor()
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
