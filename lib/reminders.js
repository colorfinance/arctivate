// Habit reminder alarms.
// On the native app (Capacitor) these become real repeating local
// notifications that fire even when the app is closed. On the web they fall
// back to the Notifications API and fire best-effort while a tab is open.
import { isNative } from './capacitor'

// The one daily nudge gets a fixed id of its own, outside the range idFor()
// can produce, so habit syncing and nudge syncing never cancel each other.
const DAILY_NUDGE_ID = 2000000001

// Stable positive 32-bit int id from a habit uuid (native ids must be ints).
const idFor = (uuid) => {
  let h = 0
  for (let i = 0; i < String(uuid).length; i++) h = (h * 31 + String(uuid).charCodeAt(i)) | 0
  return (Math.abs(h) % 2000000000) + 1
}

// "07:00" or "07:00:00" -> { hour, minute } (or null).
const parseHM = (t) => {
  if (!t || typeof t !== 'string') return null
  const [hh, mm] = t.split(':')
  const hour = parseInt(hh, 10)
  const minute = parseInt(mm, 10)
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null
  return { hour, minute }
}

// Ask the user to allow notifications. Returns true if granted. Call this at
// the moment a member sets a reminder (a real user gesture).
export async function ensureReminderPermission() {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const p = await LocalNotifications.checkPermissions()
      if (p.display === 'granted') return true
      const r = await LocalNotifications.requestPermissions()
      return r.display === 'granted'
    } catch {
      return false
    }
  }
  try {
    if (typeof Notification === 'undefined') return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    const r = await Notification.requestPermission()
    return r === 'granted'
  } catch {
    return false
  }
}

// Has the OS actually granted us permission to fire these? A reminder can be
// saved without it -- the row is written either way -- so the habits page needs
// to know when it is holding reminders that can never fire.
// Returns 'granted' | 'denied' | 'default' | 'unsupported'.
export async function reminderPermissionState() {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const p = await LocalNotifications.checkPermissions()
      if (p.display === 'granted') return 'granted'
      if (p.display === 'denied') return 'denied'
      return 'default'
    } catch {
      return 'unsupported'
    }
  }
  try {
    if (typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission // 'granted' | 'denied' | 'default'
  } catch {
    return 'unsupported'
  }
}

// Web fallback timers (cleared and rebuilt on every sync).
let nudgeTimer = null
const clearNudgeTimer = () => {
  if (nudgeTimer) clearTimeout(nudgeTimer)
  nudgeTimer = null
}
let webTimers = []
const clearWebTimers = () => {
  webTimers.forEach((t) => clearTimeout(t))
  webTimers = []
}

// (Re)schedule reminders for the given habits. Safe to call on every load and
// after any change — it cancels what it previously scheduled first. Does not
// prompt for permission (call ensureReminderPermission at set-time for that).
export async function syncHabitReminders(habits) {
  const due = (habits || [])
    .map((h) => ({ id: h.id, title: h.title, hm: parseHM(h.reminder_time) }))
    .filter((h) => h.hm)

  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      const perm = await LocalNotifications.checkPermissions()
      // Always clear our previously scheduled reminders.
      // Cancel only what habit syncing scheduled -- clearing everything would
      // silently wipe the daily nudge every time this ran.
      const pending = await LocalNotifications.getPending()
      const ours = (pending?.notifications || []).filter((n) => n.id !== DAILY_NUDGE_ID)
      if (ours.length) {
        await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
      }
      if (perm.display !== 'granted' || due.length === 0) return
      await LocalNotifications.schedule({
        notifications: due.map((h) => ({
          id: idFor(h.id),
          title: 'Arctivate',
          body: `Time to: ${h.title}`,
          schedule: { on: { hour: h.hm.hour, minute: h.hm.minute }, repeats: true, allowWhileIdle: true },
        })),
      })
    } catch {
      // plugin not present until the native app is rebuilt — ignore
    }
    return
  }

  // Web: best-effort — fire today's reminders while a tab stays open.
  clearWebTimers()
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const now = new Date()
    due.forEach((h) => {
      const when = new Date()
      when.setHours(h.hm.hour, h.hm.minute, 0, 0)
      const ms = when.getTime() - now.getTime()
      if (ms <= 0) return // already passed today
      const t = setTimeout(() => {
        try {
          new Notification('Arctivate', { body: `Time to: ${h.title}` })
        } catch {}
      }, ms)
      webTimers.push(t)
    })
  } catch {}
}

// One nudge a day, at a time the member picks.
//
// Deliberately not one alarm per habit: five preset habits would mean five
// notifications every morning, and the reliable result of that is a member who
// turns notifications off altogether. `timeStr` is 'HH:MM' or 'HH:MM:SS';
// pass null/undefined to turn the nudge off.
export async function syncDailyNudge(timeStr) {
  const hm = parseHM(timeStr)

  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      // Always clear the previous one first, so changing the time doesn't leave
      // the old alarm behind.
      await LocalNotifications.cancel({ notifications: [{ id: DAILY_NUDGE_ID }] }).catch(() => {})
      if (!hm) return
      const perm = await LocalNotifications.checkPermissions()
      if (perm.display !== 'granted') return
      await LocalNotifications.schedule({
        notifications: [{
          id: DAILY_NUDGE_ID,
          title: 'Arctivate',
          // Fixed at schedule time, so it cannot quote a live count without
          // going stale. Keep it true whenever it fires.
          body: 'Tick off today before the day gets away from you.',
          schedule: { on: { hour: hm.hour, minute: hm.minute }, repeats: true, allowWhileIdle: true },
        }],
      })
    } catch {
      // plugin not present until the native app is rebuilt -- ignore
    }
    return
  }

  // Web: same best-effort caveat as habit reminders -- only fires while a tab
  // is open, which is why the native shell is where this actually earns its keep.
  clearNudgeTimer()
  try {
    if (!hm) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const when = new Date()
    when.setHours(hm.hour, hm.minute, 0, 0)
    const ms = when.getTime() - Date.now()
    if (ms <= 0) return
    nudgeTimer = setTimeout(() => {
      try {
        new Notification('Arctivate', { body: 'Tick off today before the day gets away from you.' })
      } catch {}
    }, ms)
  } catch {}
}
