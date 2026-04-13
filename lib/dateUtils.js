/**
 * Date utilities for consistent timezone-safe queries.
 */

/**
 * Returns local date as YYYY-MM-DD string.
 * Use for `date` columns (e.g., habit_logs.date).
 */
export function getLocalDateStr(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Returns { start, end } ISO strings bounding "today" in the user's local timezone.
 * Use for timestamptz range queries (e.g., food_logs.eaten_at).
 *   start = local midnight today  (as UTC ISO string)
 *   end   = local midnight tomorrow (as UTC ISO string)
 */
export function getTodayRange(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}
