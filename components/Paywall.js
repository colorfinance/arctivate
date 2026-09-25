import { useState } from 'react'
import { Banner } from './ui'
import Button from './Button'
import { PREMIUM_PRICE, startCheckout } from '../lib/plan'

// The one place a paywall appears: a banner that says what is behind it
// and what it costs. Never on the streak, never on the challenge.
export default function Paywall({ feature, className = '' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const go = async () => {
    setBusy(true); setError('')
    const err = await startCheckout()
    if (err) { setError(err); setBusy(false) }
  }
  return (
    <Banner
      tone="info"
      className={className}
      icon={<span aria-hidden>✨</span>}
      title={`${feature} is part of Premium`}
      body={error || `${PREMIUM_PRICE} a month, cancel any time. Free through a gym that is on Arctivate.`}
      action={<Button variant="primary" size="sm" onClick={go} disabled={busy}>{busy ? 'Opening…' : `Go Premium · ${PREMIUM_PRICE}/mo`}</Button>}
    />
  )
}
