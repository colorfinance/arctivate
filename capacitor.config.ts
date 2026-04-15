import type { CapacitorConfig } from '@capacitor/cli';

// Server URL the native shell loads. Override per-environment via the
// CAP_SERVER_URL env var, e.g. `CAP_SERVER_URL=https://staging.arctivate.app
// npx cap sync ios`. The `webDir` (./out) is a bundled offline-fallback
// shell — see scripts/build-offline-shell.js.
const serverUrl = process.env.CAP_SERVER_URL || 'https://arctivate.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.arctivate.app',
  appName: 'Arctivate',
  webDir: 'out',
  server: {
    url: serverUrl,
    androidScheme: 'https',
    iosScheme: 'https',
    // Fall back to bundled webDir if the remote host is unreachable.
    errorPath: 'offline.html',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      launchAutoHide: true,
      backgroundColor: '#030808',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#030808',
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
      style: 'DARK',
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Arctivate',
    // Note: iOS deployment target (was 14.0) is set via the Xcode project's
    // IPHONEOS_DEPLOYMENT_TARGET build setting, not capacitor.config.ts.
    backgroundColor: '#030808',
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#030808',
  },
};

export default config;
