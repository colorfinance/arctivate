// Habit reminder alarms.
// On the native app (Capacitor) these become real repeating local
// notifications that fire even when the app is closed. On the web they fall
// back to the Notifications API and fire best-effort while a tab is open.
import { isNative } from './capacitor'

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

// Web fallback timers (cleared and rebuilt on every sync).
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
      const pending = await LocalNotifications.getPending()
      if (pending?.notifications?.length) {
        await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
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
