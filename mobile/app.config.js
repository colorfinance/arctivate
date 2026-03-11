const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getUniqueIdentifier = () => {
  if (IS_DEV) return 'com.arctivate.app.dev';
  if (IS_PREVIEW) return 'com.arctivate.app.preview';
  return 'com.arctivate.app';
};

const getAppName = () => {
  if (IS_DEV) return 'Arctivate (Dev)';
  if (IS_PREVIEW) return 'Arctivate (Preview)';
  return 'Arctivate';
};

export default {
  expo: {
    name: getAppName(),
    slug: 'arctivate',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    scheme: 'arctivate',
    splash: {
      image: './assets/splash.png',
      backgroundColor: '#030808',
      resizeMode: 'contain',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: getUniqueIdentifier(),
      buildNumber: '1',
      infoPlist: {
        NSCameraUsageDescription:
          'Arctivate uses the camera to scan food and QR codes for check-ins.',
        NSMicrophoneUsageDescription:
          'Arctivate uses the microphone for voice workout logging.',
        NSPhotoLibraryUsageDescription:
          'Arctivate uses the photo library to upload food images.',
      },
      config: {
        usesNonExemptEncryption: false,
      },
      associatedDomains: [
        `applinks:${process.env.EXPO_PUBLIC_SUPABASE_URL?.replace('https://', '') || 'your-project.supabase.co'}`,
      ],
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#030808',
      },
      package: getUniqueIdentifier(),
      versionCode: 1,
      permissions: ['CAMERA', 'RECORD_AUDIO', 'VIBRATE'],
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'arctivate',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-camera',
        {
          cameraPermission:
            'Arctivate needs camera access to scan food and QR codes.',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Arctivate needs photo access to upload food images.',
        },
      ],
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#00D4AA',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: process.env.EAS_PROJECT_ID || undefined,
      },
    },
    updates: {
      url: process.env.EAS_PROJECT_ID ? `https://u.expo.dev/${process.env.EAS_PROJECT_ID}` : undefined,
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    owner: process.env.EAS_OWNER || 'arctivate',
  },
};
