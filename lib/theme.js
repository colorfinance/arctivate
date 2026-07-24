// App-wide light/dark theme. Dark is the default. The choice persists in
// localStorage and is applied by toggling a `.light` class on <html>.
export const THEME_KEY = 'arc_theme'

export const getStoredTheme = () => {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

// Apply a theme to the document (class + browser chrome colour).
export const applyTheme = (theme) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'light') root.classList.add('light')
  else root.classList.remove('light')

  const color = theme === 'light' ? '#EFF4F3' : '#030808'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', color)

  // Match the native status bar if we're inside the Capacitor shell.
  try {
    import('@capacitor/core').then(({ Capacitor }) => {
      if (!Capacitor?.isNativePlatform?.()) return
      import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
        StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark }).catch(() => {})
        StatusBar.setBackgroundColor({ color }).catch(() => {})
      }).catch(() => {})
    }).catch(() => {})
  } catch {}
}

export const setTheme = (theme) => {
  try { localStorage.setItem(THEME_KEY, theme) } catch {}
  applyTheme(theme)
}

export const toggleTheme = () => {
  const next = getStoredTheme() === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}
