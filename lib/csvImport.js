// Reading a food diary exported from somewhere else.
//
// Deliberately not written against MyFitnessPal's exact export: their columns
// differ by app version and region, and members also arrive with Cronometer,
// LoseIt, MacroFactor or a spreadsheet they keep themselves. So we parse the
// CSV properly, guess what each column means, and let the member correct the
// guess before anything is saved.

export const MAX_ROWS = 5000
export const MAX_BYTES = 5 * 1024 * 1024

// --- Parsing ---------------------------------------------------------------

// Exports from European locales are commonly semicolon- or tab-separated.
// Pick whichever delimiter gives the most columns on the header line.
function sniffDelimiter(text) {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'))
  const candidates = [',', ';', '\t', '|']
  let best = ','
  let bestCount = 0
  for (const d of candidates) {
    // Count only delimiters outside quotes.
    let count = 0
    let inQuotes = false
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i]
      if (ch === '"') inQuotes = !inQuotes
      else if (ch === d && !inQuotes) count++
    }
    if (count > bestCount) { bestCount = count; best = d }
  }
  return best
}

// RFC4180-ish: handles quoted fields, "" escapes, and newlines inside quotes.
export function parseCsv(text, delimiter) {
  if (!text) return { rows: [], delimiter: ',' }
  // Strip a UTF-8 BOM — Excel adds one and it corrupts the first header.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const delim = delimiter || sniffDelimiter(text)

  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === delim) { row.push(field); field = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
    field += ch; i++
  }
  row.push(field)
  rows.push(row)

  // Drop trailing blank lines.
  while (rows.length && rows[rows.length - 1].every(c => !c || !c.trim())) rows.pop()
  return { rows, delimiter: delim }
}

// --- Working out what the columns mean -------------------------------------

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Ordered: earlier patterns win, so "net carbs" doesn't beat a plain "carbs"
// for the carbs slot but "saturated fat" never wins the fat slot.
const FIELD_HINTS = {
  date: ['date', 'day', 'eaten', 'loggedon', 'datetime', 'timestamp'],
  time: ['time', 'timeofday', 'loggedat'],
  name: ['food', 'foodname', 'item', 'itemname', 'name', 'description', 'product', 'meal_description'],
  meal: ['meal', 'mealtype', 'mealname', 'category', 'mealgroup'],
  calories: ['calories', 'energykcal', 'kcal', 'energy', 'caloriekcal', 'cals'],
  protein: ['protein', 'proteing', 'proteins'],
  carbs: ['carbohydrates', 'carbohydrate', 'carbs', 'carbsg', 'totalcarbohydrate', 'netcarbs'],
  fat: ['fat', 'fatg', 'totalfat', 'totallipid', 'lipids'],
  quantity: ['amount', 'quantity', 'servings', 'noofservings', 'qty'],
  unit: ['unit', 'units', 'measure', 'servingunit'],
}

// Columns that must never be mistaken for the headline macro.
const EXCLUDE = {
  fat: ['saturated', 'trans', 'poly', 'mono', 'unsaturated'],
  calories: ['fromfat'],
  carbs: ['fiber', 'fibre', 'sugar'],
}

export function detectColumns(headers) {
  const normalised = headers.map(norm)
  const mapping = {}
  const taken = new Set()

  for (const [field, hints] of Object.entries(FIELD_HINTS)) {
    let bestIdx = -1
    let bestRank = Infinity
    normalised.forEach((h, idx) => {
      if (taken.has(idx) || !h) return
      if ((EXCLUDE[field] || []).some(bad => h.includes(bad))) return
      for (let r = 0; r < hints.length; r++) {
        const hint = hints[r]
        // Exact match beats a contains-match, and earlier hints beat later ones.
        const rank = h === hint ? r : h.includes(hint) ? r + 100 : -1
        if (rank >= 0 && rank < bestRank) { bestRank = rank; bestIdx = idx }
      }
    })
    if (bestIdx >= 0) { mapping[field] = bestIdx; taken.add(bestIdx) }
  }
  return mapping
}

// --- Values ----------------------------------------------------------------

export function toNumber(value, decimalComma = false) {
  if (value === null || value === undefined) return 0
  let s = String(value).trim()
  if (!s) return 0
  s = s.replace(/[^\d.,-]/g, '') // drop "g", "kcal", currency, spaces
  if (!s) return 0
  if (decimalComma) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(/,/g, '')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// Whether slash/dot dates in this file look like D/M/Y or M/D/Y. Returns null
// when every row is ambiguous (e.g. all days are 12 or under) — the caller
// asks rather than guessing, because guessing wrong silently misfiles a month
// of someone's diary.
export function detectDateOrder(values) {
  let sawDayFirst = false
  let sawMonthFirst = false
  for (const v of values) {
    const m = String(v || '').trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
    if (!m) continue
    const a = parseInt(m[1], 10)
    const b = parseInt(m[2], 10)
    if (a > 12 && b <= 12) sawDayFirst = true
    else if (b > 12 && a <= 12) sawMonthFirst = true
  }
  if (sawDayFirst && !sawMonthFirst) return 'dmy'
  if (sawMonthFirst && !sawDayFirst) return 'mdy'
  return null // ambiguous, or conflicting
}

// Returns a local Date at the given time of day, or null if unreadable.
export function parseDate(value, order = 'dmy', timeValue = '') {
  const raw = String(value || '').trim()
  if (!raw) return null

  let y = null, mo = null, d = null

  // ISO first: 2026-08-15 or 2026-08-15T09:30:00
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3] }

  if (y === null) {
    m = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
    if (m) {
      const a = +m[1], b = +m[2]
      y = +m[3]
      // A component over 12 settles it regardless of the file's overall order.
      if (a > 12) { d = a; mo = b }
      else if (b > 12) { mo = a; d = b }
      else if (order === 'mdy') { mo = a; d = b }
      else { d = a; mo = b }
      if (y < 100) y += y < 70 ? 2000 : 1900
    }
  }

  if (y === null) {
    // "15 August 2026", "August 15, 2026", "15 Aug 26"
    const t = raw.toLowerCase()
    const mi = MONTHS.findIndex(mon => t.includes(mon))
    if (mi >= 0) {
      const nums = t.match(/\d+/g) || []
      const yearIdx = nums.findIndex(n => n.length === 4)
      if (yearIdx >= 0) {
        y = +nums[yearIdx]
        const rest = nums.filter((_, idx) => idx !== yearIdx)
        if (rest.length) d = +rest[0]
      } else if (nums.length >= 2) {
        d = +nums[0]
        y = +nums[1] < 100 ? +nums[1] + 2000 : +nums[1]
      }
      mo = mi + 1
    }
  }

  if (y === null || !mo || !d) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null

  let hh = 12, mm = 0 // midday default keeps the row on its own day in any timezone
  const timeSrc = String(timeValue || '').trim() || raw
  const tm = timeSrc.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i)
  if (tm) {
    hh = +tm[1]; mm = +tm[2]
    const ap = (tm[3] || '').toLowerCase()
    if (ap === 'pm' && hh < 12) hh += 12
    if (ap === 'am' && hh === 12) hh = 0
    if (hh > 23 || mm > 59) { hh = 12; mm = 0 }
  }

  const date = new Date(y, mo - 1, d, hh, mm, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

const MEAL_WORDS = {
  breakfast: 'breakfast',
  brunch: 'breakfast',
  morning: 'breakfast',
  lunch: 'lunch',
  midday: 'lunch',
  noon: 'lunch',
  dinner: 'dinner',
  supper: 'dinner',
  tea: 'dinner',
  evening: 'dinner',
  snack: 'snack',
  snacks: 'snack',
}

export function parseMeal(value) {
  const t = norm(value)
  if (!t) return null
  for (const [word, meal] of Object.entries(MEAL_WORDS)) {
    if (t.includes(word)) return meal
  }
  return null
}

// --- Rows into log entries -------------------------------------------------

// Turns parsed rows into food_logs-shaped objects, alongside a count of what
// had to be skipped so the member is told rather than left wondering.
export function buildEntries(rows, mapping, opts = {}) {
  const { dateOrder = 'dmy', decimalComma = false, hasHeader = true } = opts
  const body = hasHeader ? rows.slice(1) : rows
  const at = (row, field) => (mapping[field] === undefined ? '' : row[mapping[field]] ?? '')

  const entries = []
  const skipped = { noName: 0, noCalories: 0, badDate: 0 }

  for (const row of body) {
    if (!row || row.every(c => !c || !c.trim())) continue

    const name = String(at(row, 'name') || '').trim()
    const calories = Math.round(toNumber(at(row, 'calories'), decimalComma))

    // A row with neither a name nor any energy is a total/blank line, not food.
    if (!name && !calories) continue
    if (!name) { skipped.noName++; continue }
    if (!calories) { skipped.noCalories++; continue }

    let eatenAt = null
    if (mapping.date !== undefined) {
      eatenAt = parseDate(at(row, 'date'), dateOrder, at(row, 'time'))
      if (!eatenAt) { skipped.badDate++; continue }
    }

    const qty = mapping.quantity !== undefined ? toNumber(at(row, 'quantity'), decimalComma) : 0
    const unit = String(at(row, 'unit') || '').trim()

    entries.push({
      name,
      calories,
      p: Math.round(toNumber(at(row, 'protein'), decimalComma) * 10) / 10,
      c: Math.round(toNumber(at(row, 'carbs'), decimalComma) * 10) / 10,
      f: Math.round(toNumber(at(row, 'fat'), decimalComma) * 10) / 10,
      meal: parseMeal(at(row, 'meal')) || mealFromTime(eatenAt),
      eatenAt,
      qty: qty > 0 ? qty : null,
      unit: unit || null,
    })
  }

  return { entries, skipped }
}

function mealFromTime(date) {
  if (!date) return 'snack'
  const h = date.getHours()
  if (h >= 5 && h < 11) return 'breakfast'
  if (h >= 11 && h < 15) return 'lunch'
  if (h >= 17 && h < 22) return 'dinner'
  return 'snack'
}

// Shapes an entry for insertion, matching how the rest of the app writes
// food_logs (macros carries p/c/f and the meal).
export function toLogRow(entry, userId) {
  if (!entry) return null
  const macros = { p: entry.p, c: entry.c, f: entry.f, meal_type: entry.meal || 'snack', imported: true }
  if (entry.qty) macros.servings = entry.qty
  const row = {
    user_id: userId,
    item_name: entry.name.slice(0, 200),
    calories: entry.calories,
    macros,
  }
  if (entry.eatenAt) row.eaten_at = entry.eatenAt.toISOString()
  if (entry.unit) row.unit = entry.unit.slice(0, 40)
  return row
}

export function summarise(entries) {
  if (!entries.length) return null
  const dated = entries.filter(e => e.eatenAt).map(e => e.eatenAt.getTime())
  return {
    count: entries.length,
    calories: entries.reduce((s, e) => s + e.calories, 0),
    from: dated.length ? new Date(Math.min(...dated)) : null,
    to: dated.length ? new Date(Math.max(...dated)) : null,
    days: new Set(entries.filter(e => e.eatenAt).map(e => e.eatenAt.toDateString())).size,
  }
}
