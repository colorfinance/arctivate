# Arctivate Android Build Package

## What's Inside
This zip contains the complete Android Studio project for Arctivate, with the latest web assets already synced via Capacitor.

## Requirements
- Android Studio (latest stable)
- JDK 17+
- Android SDK 36

## Build Steps

### 1. Open in Android Studio
Open the `android/` folder as an Android Studio project. Gradle will sync automatically.

### 2. Build Debug APK (for testing)
```bash
cd android
./gradlew assembleDebug
```
APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3. Build Release APK (signed)
```bash
cd android
./gradlew assembleRelease
```
APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

### 4. Build AAB for Google Play Store
```bash
cd android
./gradlew bundleRelease
```
AAB will be at: `android/app/build/outputs/bundle/release/app-release.aab`

### 5. Configure Signing (for release builds)
Create or update `android/app/build.gradle` signing config with your keystore:
```groovy
signingConfigs {
    release {
        storeFile file('your-keystore.jks')
        storePassword 'your-store-password'
        keyAlias 'your-key-alias'
        keyPassword 'your-key-password'
    }
}
```

### Alternative: Use Fastlane
```bash
cd android
fastlane build    # Build AAB
fastlane beta     # Upload to Play Store internal testing
fastlane release  # Upload to Play Store production
```

## App Details
- **Package ID:** com.arctivate.app
- **App Name:** Arctivate
- **Min SDK:** 24 (Android 7.0+)
- **Target SDK:** 36
- **Capacitor Version:** 8.2.0
