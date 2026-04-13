/**
 * Capacitor native plugin helpers.
 * These are no-ops on web and only activate inside native iOS/Android shells.
 */

let isNativePlatform = false;
let platformName = 'web';

export async function initCapacitor() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    isNativePlatform = Capacitor.isNativePlatform();
    platformName = Capacitor.getPlatform();

    if (!isNativePlatform) return;

    // Configure status bar for dark theme
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#030808' });

    // Hide splash screen immediately once JS is ready
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide();
    } catch {}

    // Configure keyboard: track open/close and push focused input above keyboard.
    const { Keyboard } = await import('@capacitor/keyboard');

    // With resize: 'native' in capacitor.config.ts, the webview already shrinks
    // by the keyboard height. We only toggle a CSS class for UI state (hiding
    // the bottom nav, etc.) and scroll the focused element into view.
    Keyboard.addListener('keyboardWillShow', () => {
      document.body.classList.add('keyboard-open');

      // Scroll the focused element into view above the keyboard
      const active = document.activeElement;
      if (active && typeof active.scrollIntoView === 'function') {
        setTimeout(() => {
          try {
            active.scrollIntoView({ block: 'center', behavior: 'smooth' });
          } catch {}
        }, 100);
      }
    });

    Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-open');
    });
  } catch (e) {
    // Not running in Capacitor - web environment
  }
}

export function isNative() {
  return isNativePlatform;
}

export function getPlatform() {
  return platformName;
}
