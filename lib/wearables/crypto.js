import crypto from 'crypto'

const COOKIE_SECRET = process.env.WEARABLE_COOKIE_SECRET
const ENCRYPTION_KEY = process.env.WEARABLE_ENCRYPTION_KEY
  ? Buffer.from(process.env.WEARABLE_ENCRYPTION_KEY, 'hex')
  : null

// ─── Cookie State Signing ───────────────────────────

export function signState(data) {
  const json = JSON.stringify(data)
  const hmac = crypto.createHmac('sha256', COOKIE_SECRET).update(json).digest('hex')
  return Buffer.from(`${json}.${hmac}`).toString('base64')
}

export function verifyState(signed) {
  const decoded = Buffer.from(signed, 'base64').toString()
  const lastDot = decoded.lastIndexOf('.')
  const json = decoded.slice(0, lastDot)
  const hmac = decoded.slice(lastDot + 1)
  const expected = crypto.createHmac('sha256', COOKIE_SECRET).update(json).digest('hex')
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
    throw new Error('Invalid state signature')
  }
  const data = JSON.parse(json)
  // Check expiry (10 minute window)
  if (data.timestamp && Date.now() - data.timestamp > 10 * 60 * 1000) {
    throw new Error('State expired')
  }
  return data
}

// ─── Token Encryption (AES-256-GCM) ─────────────────

export function encrypt(text) {
  if (!ENCRYPTION_KEY) return text
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${tag}:${encrypted}`
}

export function decrypt(data) {
  if (!ENCRYPTION_KEY) return data
  // If data doesn't look encrypted, return as-is
  if (!data.includes(':')) return data
  const [ivHex, tagHex, encrypted] = data.split(':')
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
