/**
 * Shared error surface. Pass a `retry` callback to render a Try again
 * button — keeps users out of dead-end blank screens when Supabase or
 * the network hiccups.
 */
export default function ErrorState({
  title = 'Something went wrong',
  message = 'Please try again in a moment.',
  retry,
  fullScreen = true,
}) {
  const wrapper = fullScreen
    ? 'min-h-screen flex items-center justify-center bg-arc-bg text-arc-muted px-6'
    : 'flex items-center justify-center py-12 text-arc-muted px-6'

  return (
    <div className={wrapper} role="alert">
      <div className="flex flex-col items-center gap-3 text-center max-w-sm">
        <div className="text-3xl" aria-hidden="true">⚠️</div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="text-sm">{message}</p>
        {retry && (
          <button
            type="button"
            onClick={retry}
            className="mt-2 bg-arc-accent text-arc-bg font-bold px-5 py-3 rounded-full min-h-[44px] min-w-[140px]"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  )
}
