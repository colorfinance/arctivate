import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arctivate.app',
  appName: 'Arctivate',
  webDir: 'out',
  server: {
    // Load from the live Vercel deployment so API routes work
    url: 'https://arctivate-repo.vercel.app',
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
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
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Arctivate',
    // Apple Sign In requires minimum iOS 13
    minVersion: '14.0',
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#030808',
  },
};

export default config;
