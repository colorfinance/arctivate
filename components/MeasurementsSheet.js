import { useState } from 'react'
import Button from './Button'

// A tape measure, on a screen.
//
// Six numbers and a note, all optional, because the person with only
// bathroom scales still deserves a before and after. Asked once at the
// start of a challenge and once at the finish. The comparison lives on the
// finished card; this sheet only collects.

export const MEASURES = [
  { key: 'weight_kg', label: 'Weight', unit: 'kg', hint: 'Same scales, same time of day' },
  { key: 'waist_cm', label: 'Waist', unit: 'cm', hint: 'At the navel, relaxed' },
  { key: 'chest_cm', label: 'Chest', unit: 'cm', hint: 'Around the fullest part' },
  { key: 'hips_cm', label: 'Hips', unit: 'cm', hint: 'Around the widest part' },
  { key: 'arm_cm', label: 'Arm', unit: 'cm', hint: 'Upper arm, relaxed' },
  { key: 'thigh_cm', label: 'Thigh', unit: 'cm', hint: 'Mid thigh' },
]

const COPY = {
  start: {
    title: 'Where you are starting',
    body: 'Two minutes with a tape. Fill in what you can; at the end you will see what changed.',
    cta: 'Save start',
    skip: 'Not now',
  },
  finish: {
    title: 'Where you finished',
    body: 'Same spots as the start, so the comparison is honest.',
    cta: 'Save finish',
    skip: 'Later',
  },
}

export function fmtDelta(from, to, unit) {
  if (from == null || to == null) return null
  const d = Math.round((Number(to) - Number(from)) * 10) / 10
  if (d === 0) return { text: 'no change', tone: 'muted' }
  return { text: `${d > 0 ? '+' : ''}${d} ${unit}`, tone: d < 0 ? 'down' : 'up' }
}

export default function MeasurementsSheet({ kind = 'start', challengeTitle, initial = null, previous = null, saving = false, onSave, onClose }) {
  const c = COPY[kind] || COPY.start
  const [values, setValues] = useState(() => {
    const v = {}
    for (const m of MEASURES) v[m.key] = initial?.[m.key] != null ? String(initial[m.key]) : ''
    v.note = initial?.note || ''
    return v
  })

  const set = (key, raw) => {
    const cleaned = raw.replace(/[^0-9.,]/g, '').replace(',', '.').slice(0, 6)
    setValues(v => ({ ...v, [key]: cleaned }))
  }

  const filled = MEASURES.some(m => values[m.key] !== '' && !Number.isNaN(Number(values[m.key])))

  const submit = () => {
    if (!filled || saving) return
    const out = {}
    for (const m of MEASURES) {
      const n = values[m.key] === '' ? null : Number(values[m.key])
      out[m.key] = n == null || Number.isNaN(n) ? null : n
    }
    out.note = values.note.trim().slice(0, 200) || null
    onSave(out)
  }

  return (
    <>
      <div onClick={() => !saving && onClose()} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50" />
      <div className="fixed bottom-0 left-0 right-0 bg-arc-card border-t border-white/10 rounded-t-[2rem] z-50 max-h-[92vh] overflow-y-auto">
        <div className="p-6 space-y-4 pb-safe max-w-lg mx-auto">
          <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
          <div>
            <h2 className="t-title text-white" style={{ fontSize: 20 }}>{c.title}</h2>
            <p className="t-caption text-arc-muted mt-0.5">{challengeTitle ? `${challengeTitle} · ` : ''}{c.body}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {MEASURES.map(m => (
              <label key={m.key} className="block rounded-control bg-arc-surface2/60 border border-white/[0.05] px-3 py-2.5 focus-within:border-arc-accent transition-colors">
                <span className="t-label text-arc-muted block">{m.label}</span>
                <span className="flex items-baseline gap-1 mt-0.5">
                  <input
                    value={values[m.key]}
                    onChange={(e) => set(m.key, e.target.value)}
                    inputMode="decimal"
                    placeholder={previous?.[m.key] != null ? String(previous[m.key]) : '—'}
                    aria-label={`${m.label} in ${m.unit}`}
                    className="w-full bg-transparent t-num text-[22px] font-black text-white outline-none placeholder:text-white/20"
                  />
                  <span className="t-caption text-arc-muted shrink-0">{m.unit}</span>
                </span>
                {previous?.[m.key] != null ? (
                  <span className="block t-caption text-arc-muted mt-0.5">Start: {previous[m.key]} {m.unit}</span>
                ) : (
                  <span className="block t-caption text-arc-muted/70 mt-0.5">{m.hint}</span>
                )}
              </label>
            ))}
          </div>

          <input
            value={values.note}
            onChange={(e) => setValues(v => ({ ...v, note: e.target.value.slice(0, 200) }))}
            placeholder="A note to your future self (optional)"
            className="w-full h-12 px-4 rounded-control bg-arc-surface2 border border-white/[0.08] text-[15px] text-white outline-none focus:border-arc-accent placeholder:text-arc-muted/60"
          />

          <p className="t-caption text-arc-muted">Only you can see these. They never go on a leaderboard or a feed.</p>

          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={submit} disabled={!filled || saving}>{saving ? 'Saving…' : c.cta}</Button>
            <Button variant="tertiary" onClick={onClose} disabled={saving}>{c.skip}</Button>
          </div>
        </div>
      </div>
    </>
  )
}
