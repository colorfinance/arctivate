import OAuth from 'oauth-1.0a'
import crypto from 'crypto'
import { encrypt, decrypt } from './crypto'

const GARMIN_BASE = 'https://connectapi.garmin.com'
const GARMIN_OAUTH_BASE = `${GARMIN_BASE}/oauth-service/oauth`

function getOAuthClient() {
  return OAuth({
    consumer: {
      key: process.env.GARMIN_CONSUMER_KEY,
      secret: process.env.GARMIN_CONSUMER_SECRET,
    },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64')
    },
  })
}

// ─── OAuth 1.0a: Get Request Token ──────────────────

export async function getRequestToken(callbackUrl) {
  const oauth = getOAuthClient()
  const requestData = {
    url: `${GARMIN_OAUTH_BASE}/request_token`,
    method: 'POST',
    data: { oauth_callback: callbackUrl },
  }

  const headers = oauth.toHeader(oauth.authorize(requestData))
  const res = await fetch(requestData.url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `oauth_callback=${encodeURIComponent(callbackUrl)}`,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Garmin request token failed: ${res.status} ${text}`)
  }

  const body = await res.text()
  const params = new URLSearchParams(body)
  return {
    token: params.get('oauth_token'),
    tokenSecret: params.get('oauth_token_secret'),
  }
}

export function getAuthorizationUrl(requestToken) {
  return `https://connect.garmin.com/oauthConfirm?oauth_token=${requestToken}`
}

// ─── OAuth 1.0a: Exchange for Access Token ──────────

export async function exchangeForAccessToken(requestToken, requestTokenSecret, verifier) {
  const oauth = getOAuthClient()
  const requestData = {
    url: `${GARMIN_OAUTH_BASE}/access_token`,
    method: 'POST',
    data: { oauth_verifier: verifier },
  }

  const token = { key: requestToken, secret: requestTokenSecret }
  const headers = oauth.toHeader(oauth.authorize(requestData, token))

  const res = await fetch(requestData.url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `oauth_verifier=${encodeURIComponent(verifier)}`,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Garmin access token exchange failed: ${res.status} ${text}`)
  }

  const body = await res.text()
  const params = new URLSearchParams(body)
  return {
    accessToken: params.get('oauth_token'),
    accessTokenSecret: params.get('oauth_token_secret'),
  }
}

// ─── Encrypt tokens for storage ─────────────────────

export function encryptTokens(accessToken, accessTokenSecret) {
  return {
    access_token: encrypt(accessToken),
    access_token_secret: encrypt(accessTokenSecret),
  }
}

export function decryptTokens(connection) {
  return {
    accessToken: decrypt(connection.access_token),
    accessTokenSecret: decrypt(connection.access_token_secret),
  }
}

// ─── Webhook Payload Mapping ────────────────────────

function mapSleepQuality(score) {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'fair'
  return 'poor'
}

export function mapDailySummary(daily) {
  return {
    steps: daily.steps || null,
    calories_burned: daily.activeKilocalories || null,
    active_minutes: (daily.moderateIntensityDurationInSeconds || 0) / 60 +
      (daily.vigorousIntensityDurationInSeconds || 0) / 60 || null,
    rhr: daily.restingHeartRateInBeatsPerMinute || null,
    stress_score: daily.averageStressLevel || null,
    distance_meters: daily.distanceInMeters || null,
    logged_at: daily.calendarDate || new Date().toISOString().split('T')[0],
  }
}

export function mapSleepData(sleep) {
  const totalSeconds = sleep.durationInSeconds || 0
  const deepSeconds = sleep.deepSleepDurationInSeconds || 0
  const lightSeconds = sleep.lightSleepDurationInSeconds || 0
  const remSeconds = sleep.remSleepDurationInSeconds || 0

  return {
    sleep_hours: totalSeconds ? +(totalSeconds / 3600).toFixed(1) : null,
    sleep_deep_hours: deepSeconds ? +(deepSeconds / 3600).toFixed(1) : null,
    sleep_light_hours: lightSeconds ? +(lightSeconds / 3600).toFixed(1) : null,
    sleep_rem_hours: remSeconds ? +(remSeconds / 3600).toFixed(1) : null,
    sleep_quality: sleep.overallSleepScore
      ? mapSleepQuality(sleep.overallSleepScore.value || 0)
      : null,
    logged_at: sleep.calendarDate || new Date().toISOString().split('T')[0],
  }
}

export function mapUserMetrics(metrics) {
  return {
    hrv: metrics.hrvValue || null,
    body_battery: metrics.bodyBatteryChargedValue || null,
    spo2: metrics.averageSpo2 || null,
  }
}

// ─── Merge multiple Garmin payloads into one wearable_log row ───

export function mergeGarminData(dailySummary, sleepData, userMetrics, rawPayload) {
  return {
    source: 'garmin',
    ...mapDailySummary(dailySummary || {}),
    ...(sleepData ? mapSleepData(sleepData) : {}),
    ...(userMetrics ? mapUserMetrics(userMetrics) : {}),
    raw_data: rawPayload || null,
  }
}
