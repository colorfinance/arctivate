# Arctivate - Mobile App Build & Store Submission Guide

## Overview

Arctivate uses **Capacitor** to wrap the Next.js web app as native iOS and Android applications. The native apps load from your live Vercel deployment, so API routes work seamlessly.

- **App ID:** `com.arctivate.app`
- **App Name:** Arctivate
- **Platforms:** iOS 14+, Android SDK 22+

---

## Prerequisites

### General
- Node.js 18+
- npm or yarn

### iOS (requires macOS)
- macOS with Xcode 15+
- Apple Developer account ($99/year)
- CocoaPods (`sudo gem install cocoapods`)

### Android
- Android Studio (Hedgehog or newer)
- Java JDK 17+
- Android SDK 34+

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Build web assets
```bash
npm run build
```

### 3. Sync native projects
```bash
npm run cap:sync
```

### 4. Open in IDE
```bash
# iOS (opens Xcode)
npm run cap:open:ios

# Android (opens Android Studio)
npm run cap:open:android
```

---

## iOS: Build for App Store

### First-Time Setup

1. Open Xcode: `npm run cap:open:ios`
2. Select the **App** target
3. Under **Signing & Capabilities**:
   - Select your Apple Developer team
   - Update the Bundle Identifier if needed (default: `com.arctivate.app`)
4. Set the **Deployment Target** to iOS 14.0+

### Replace App Icon

1. Replace the icon in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
2. You need a 1024x1024 PNG icon
3. Use Xcode's asset catalog editor or a tool like [AppIcon Generator](https://www.appicon.co/)

### Build .ipa for App Store

**Option A: Xcode (Recommended for first time)**
1. Select **Product > Archive** in Xcode
2. In the Organizer, click **Distribute App**
3. Select **App Store Connect**
4. Follow the prompts to upload

**Option B: Fastlane**
```bash
cd ios/App
# Install fastlane
gem install fastlane

# Update Appfile with your Apple ID and Team ID
# Then run:
fastlane beta    # Upload to TestFlight
fastlane release # Upload to App Store
```

### App Store Connect Listing

You'll need:
- App name: **Arctivate**
- Subtitle: **Gamify Your Discipline**
- Category: **Health & Fitness**
- Description, keywords, screenshots (6.7" and 5.5" sizes)
- Privacy Policy URL
- App icon (1024x1024)

---

## Android: Build for Play Store

### First-Time Setup

1. Open Android Studio: `npm run cap:open:android`
2. Let Gradle sync complete
3. Verify the app runs on an emulator or device

### Create Upload Key (Required for Play Store)

```bash
keytool -genkey -v -keystore arctivate-upload-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias arctivate-upload
```

**Store this keystore file safely - you cannot recover it!**

### Configure Signing

Add to `android/gradle.properties` (do NOT commit this file):

```properties
ARCTIVATE_UPLOAD_STORE_FILE=../arctivate-upload-key.jks
ARCTIVATE_UPLOAD_STORE_PASSWORD=your-store-password
ARCTIVATE_UPLOAD_KEY_ALIAS=arctivate-upload
ARCTIVATE_UPLOAD_KEY_PASSWORD=your-key-password
```

### Build AAB for Play Store

**Option A: Android Studio**
1. Select **Build > Generate Signed Bundle / APK**
2. Choose **Android App Bundle**
3. Select your keystore and enter credentials
4. Choose **release** build type
5. The `.aab` file will be in `android/app/build/outputs/bundle/release/`

**Option B: Command Line**
```bash
cd android
./gradlew bundleRelease
```

The output AAB will be at: `android/app/build/outputs/bundle/release/app-release.aab`

**Option C: Fastlane**
```bash
cd android
gem install fastlane
fastlane beta    # Upload to internal testing
fastlane release # Upload to production
```

### Build APK (for testing)
```bash
cd android
./gradlew assembleRelease
```

### Google Play Console Listing

You'll need:
- App name: **Arctivate**
- Short description: **Gamify your fitness discipline with points, streaks, and rewards**
- Full description
- Category: **Health & Fitness**
- Screenshots (phone + tablet)
- Feature graphic (1024x500)
- App icon (512x512)
- Privacy Policy URL
- Content rating questionnaire

---

## App Icon Generation

### Using the built-in script
```bash
npm run generate:icons
```
This creates SVG templates in `/assets`. For production PNG icons:

### Using @capacitor/assets (Recommended)
```bash
# Place your 1024x1024 icon at assets/icon.png
# Place your 2732x2732 splash at assets/splash.png
npx @capacitor/assets generate --iconBackgroundColor '#030808' --splashBackgroundColor '#030808'
```

---

## Development Workflow

```bash
# 1. Make changes to the web app
npm run dev

# 2. Build and sync to native projects
npm run cap:build

# 3. Run on device/simulator
npm run cap:run:ios
npm run cap:run:android
```

### Live Reload (Development)
The app is configured to load from your Vercel deployment (`https://arctivate-repo.vercel.app`). Changes deployed to Vercel will be reflected in the native app immediately.

For local development, temporarily update `capacitor.config.ts`:
```typescript
server: {
  url: 'http://YOUR_LOCAL_IP:3000',  // Your local dev server
}
```

---

## Version Management

Before each store submission, update versions:

### iOS
In Xcode: Target > General > Version and Build

### Android
In `android/app/build.gradle`:
```groovy
versionCode 2      // Increment for each upload
versionName "1.1.0" // Semantic version
```

---

## GitHub Actions CI/CD (Recommended)

Both apps are built automatically in the cloud when you push to `main`. No local Xcode or Android Studio needed.

### How it works

1. Push code to `main` (or click "Run workflow" in GitHub Actions)
2. GitHub builds the `.aab` (Android) and `.ipa` (iOS) automatically
3. Download the files from the Actions tab > Artifacts section
4. Upload to Play Store / App Store

### Android Secrets (for signed builds)

Go to **GitHub repo > Settings > Secrets and variables > Actions** and add:

| Secret | How to get it |
|--------|--------------|
| `ANDROID_KEYSTORE_BASE64` | Run: `base64 -i arctivate-upload-key.jks` (see below to create keystore) |
| `ANDROID_KEYSTORE_PASSWORD` | The password you chose when creating the keystore |
| `ANDROID_KEY_ALIAS` | `arctivate-upload` (or whatever alias you chose) |
| `ANDROID_KEY_PASSWORD` | The key password you chose |

**Create the keystore first:**
```bash
keytool -genkey -v -keystore arctivate-upload-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias arctivate-upload
```

Without these secrets, Android still builds an **unsigned debug APK** you can test with.

### iOS Secrets (for signed builds)

| Secret | How to get it |
|--------|--------------|
| `IOS_BUILD_CERTIFICATE_BASE64` | Export your distribution certificate as .p12 from Keychain Access, then `base64 -i cert.p12` |
| `IOS_P12_PASSWORD` | The password you set when exporting the .p12 |
| `IOS_PROVISION_PROFILE_BASE64` | Download from Apple Developer portal, then `base64 -i profile.mobileprovision` |
| `IOS_KEYCHAIN_PASSWORD` | Any random password (used for temp keychain in CI) |

Without these secrets, iOS builds an **unsigned build** for verification only.

### Running manually

Go to **GitHub repo > Actions > Build Android AAB** (or Build iOS IPA) > **Run workflow**.

### Downloading the built files

1. Go to **Actions** tab in your GitHub repo
2. Click the latest successful workflow run
3. Scroll to **Artifacts** at the bottom
4. Download `arctivate-release-aab` or `arctivate-release-ipa`
5. Upload the file to the respective store

---

## Troubleshooting

### iOS: "No signing certificate" error
- Ensure you have a valid Apple Developer account
- In Xcode: Preferences > Accounts > add your Apple ID

### Android: "Keystore was tampered with" error
- Verify your keystore password is correct
- Re-generate the keystore if needed

### Web content not loading
- Check `capacitor.config.ts` server URL
- Ensure your Vercel deployment is live
- Run `npx cap sync` after any config changes

### Camera/permissions not working
- iOS: Check Info.plist permission descriptions
- Android: Check AndroidManifest.xml permissions
- Test on a real device (simulators have limited camera support)
