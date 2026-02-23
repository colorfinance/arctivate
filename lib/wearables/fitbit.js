import crypto from 'crypto'
import { encrypt, decrypt } from './crypto'

const FITBIT_AUTH_BASE = 'https://www.fitbit.com/oauth2'
const FITBIT_API_BASE = 'https://api.fitbit.com'

// ─── PKCE Helpers ───────────────────────────────────

export function generatePKCE() {
  const verifier = crypto.randomBytes(64).toString('base64url')
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url')
  return { verifier, challenge }
}

export function generateState() {
  return crypto.randomBytes(32).toString('hex')
}

// ─── Authorization URL ──────────────────────────────

export function getAuthorizationUrl(codeChallenge, state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.FITBIT_CLIENT_ID,
    redirect_uri: process.env.FITBIT_CALLBACK_URL || `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/wearables/fitbit/callback`,
    scope: 'activity heartrate sleep oxygen_saturation',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })
  return `${FITBIT_AUTH_BASE}/authorize?${params.toString()}`
}

// ─── Token Exchange ─────────────────────────────────

export async function exchangeCodeForTokens(code, codeVerifier) {
  const basicAuth = Buffer.from(
    `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(`${FITBIT_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.FITBIT_CALLBACK_URL || `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/wearables/fitbit/callback`,
      code_verifier: codeVerifier,
    }).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Fitbit token exchange failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    userId: data.user_id,
  }
}

// ─── Token Refresh ──────────────────────────────────

export async function refreshAccessToken(refreshToken) {
  const basicAuth = Buffer.from(
    `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(`${FITBIT_API_BASE}/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Fitbit token refresh failed: ${res.status} ${text}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

// ─── Encrypt/Decrypt Tokens ─────────────────────────

export function encryptTokens(accessToken, refreshToken) {
  return {
    access_token: encrypt(accessToken),
    refresh_token: encrypt(refreshToken),
  }
}

export function decryptTokens(connection) {
  return {
    accessToken: decrypt(connection.access_token),
    refreshToken: decrypt(connection.refresh_token),
  }
}

// ─── Data Fetching ──────────────────────────────────

async function fitbitGet(accessToken, path) {
  const res = await fetch(`${FITBIT_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 401) throw new Error('TOKEN_EXPIRED')
  if (res.status === 429) throw new Error('RATE_LIMITED')
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Fitbit API error: ${res.status} ${text}`)
  }
  return res.json()
}

export async function fetchDailySummary(accessToken, date) {
  return fitbitGet(accessToken, `/1/user/-/activities/date/${date}.json`)
}

export async function fetchSleepData(accessToken, date) {
  return fitbitGet(accessToken, `/1.2/user/-/sleep/date/${date}.json`)
}

export async function fetchHeartRate(accessToken, date) {
  return fitbitGet(accessToken, `/1/user/-/activities/heart/date/${date}/1d.json`)
}

export async function fetchHRV(accessToken, date) {
  return fitbitGet(accessToken, `/1/user/-/hrv/date/${date}.json`)
}

export async function fetchSpO2(accessToken, date) {
  return fitbitGet(accessToken, `/1/user/-/spo2/date/${date}.json`)
}

// ─── Data Mapping ───────────────────────────────────

function mapSleepQuality(efficiency) {
  if (efficiency >= 90) return 'excellent'
  if (efficiency >= 80) return 'good'
  if (efficiency >= 70) return 'fair'
  return 'poor'
}

export function mapFitbitData(activityData, sleepData, heartData, hrvData, spo2Data, date) {
  const summary = activityData?.summary || {}
  const sleepSummary = sleepData?.summary || {}
  const sleepLog = sleepData?.sleep?.[0]
  const sleepLevels = sleepLog?.levels?.summary || {}

  const heartRest = heartData?.['activities-heart']?.[0]?.value?.restingHeartRate
  const hrvValue = hrvData?.hrv?.[0]?.value?.dailyRmssd
  const spo2Value = spo2Data?.value || spo2Data?.avg

  return {
    source: 'fitbit',
    logged_at: date,
    steps: summary.steps || null,
    calories_burned: summary.caloriesOut || null,
    active_minutes: (summary.fairlyActiveMinutes || 0) + (summary.veryActiveMinutes || 0) || null,
    distance_meters: summary.distances?.find(d => d.activity === 'total')?.distance
      ? summary.distances.find(d => d.activity === 'total').distance * 1000
      : null,
    rhr: heartRest || null,
    hrv: hrvValue ? +hrvValue.toFixed(1) : null,
    sleep_hours: sleepSummary.totalMinutesAsleep
      ? +(sleepSummary.totalMinutesAsleep / 60).toFixed(1)
      : null,
    sleep_deep_hours: sleepLevels.deep?.minutes
      ? +(sleepLevels.deep.minutes / 60).toFixed(1)
      : null,
    sleep_light_hours: sleepLevels.light?.minutes
      ? +(sleepLevels.light.minutes / 60).toFixed(1)
      : null,
    sleep_rem_hours: sleepLevels.rem?.minutes
      ? +(sleepLevels.rem.minutes / 60).toFixed(1)
      : null,
    sleep_quality: sleepLog?.efficiency ? mapSleepQuality(sleepLog.efficiency) : null,
    spo2: spo2Value || null,
    stress_score: null, // Fitbit doesn't provide stress score
    body_battery: null, // Garmin-only metric
    raw_data: { activityData, sleepData, heartData, hrvData, spo2Data },
  }
}
