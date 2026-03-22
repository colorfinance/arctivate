/**
 * Capacitor native plugin helpers.
 * These are no-ops on web and only activate inside native iOS/Android shells.
 */

let isNativePlatform = false;

export async function initCapacitor() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    isNativePlatform = Capacitor.isNativePlatform();

    if (!isNativePlatform) return;

    // Configure status bar for dark theme
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#030808' });

    // Hide splash screen after app loads
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();

    // Configure keyboard behavior
    const { Keyboard } = await import('@capacitor/keyboard');
    Keyboard.addListener('keyboardWillShow', () => {
      document.body.classList.add('keyboard-open');
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
