import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arctivate.app',
  appName: 'Arctivate',
  webDir: 'out',
  server: {
    // Load from the live Vercel deployment so API routes work
    url: 'https://arctivate.vercel.app',
    androidScheme: 'https',
    iosScheme: 'https',
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
