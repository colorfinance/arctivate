/**
 * Shared dark-themed loading state used across pages so blank screens
 * don't appear during initial Supabase fetches.
 */
export default function LoadingState({ label = 'Loading…', fullScreen = true }) {
  const wrapper = fullScreen
    ? 'min-h-screen flex items-center justify-center bg-arc-bg text-arc-muted'
    : 'flex items-center justify-center py-12 text-arc-muted'

  return (
    <div className={wrapper} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 border-white/10 border-t-arc-accent animate-spin"
          aria-hidden="true"
        />
        <span className="text-sm tracking-wide">{label}</span>
      </div>
    </div>
  )
}
