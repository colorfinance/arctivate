// A labelled input. The label is above the field, not inside it, so it is
// still there once you have typed. Hints and validation go under the field,
// not in the placeholder.

import { forwardRef } from 'react'

const Field = forwardRef(function Field({ label, hint, error, trailing, className = '', id, ...rest }, ref) {
  const inputId = id || `f-${String(label || 'field').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="t-label text-arc-muted block mb-1.5">{label}</label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={`w-full h-12 px-4 rounded-control bg-arc-surface2 border text-[15px] text-white outline-none transition-colors duration-fast placeholder:text-arc-muted/60 ${error ? 'border-arc-danger/60' : 'border-white/[0.08] focus:border-arc-accent'} ${trailing ? 'pr-12' : ''}`}
          {...rest}
        />
        {trailing && <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>}
      </div>
      {error ? (
        <p className="t-caption text-arc-danger mt-1.5">{error}</p>
      ) : hint ? (
        <p className="t-caption text-arc-muted mt-1.5">{hint}</p>
      ) : null}
    </div>
  )
})

export default Field
