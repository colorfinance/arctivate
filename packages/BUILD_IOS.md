# Arctivate iOS Build Package

## What's Inside
This zip contains the complete Xcode project for Arctivate, with the latest web assets already synced via Capacitor.

## Requirements
- macOS with Xcode 15+ installed
- CocoaPods (`sudo gem install cocoapods`)
- Apple Developer account (for signing & App Store submission)

## Build Steps

### 1. Install CocoaPods Dependencies
```bash
cd ios/App
pod install --repo-update
```

### 2. Open in Xcode
```bash
open ios/App/App.xcworkspace
```
> **Important:** Open the `.xcworkspace` file, NOT the `.xcodeproj`.

### 3. Configure Signing
1. In Xcode, select the **App** target
2. Go to **Signing & Capabilities**
3. Select your **Team** (Apple Developer account)
4. Ensure the Bundle Identifier is `com.arctivate.app`

### 4. Build for App Store
1. Set the build target to **Any iOS Device (arm64)**
2. Go to **Product → Archive**
3. Once archived, click **Distribute App**
4. Select **App Store Connect** → **Upload**

### Alternative: Use Fastlane
```bash
cd ios/App
fastlane build    # Build IPA
fastlane beta     # Upload to TestFlight
fastlane release  # Upload to App Store
```

## App Details
- **Bundle ID:** com.arctivate.app
- **App Name:** Arctivate
- **Min iOS Version:** 14.0
- **Capacitor Version:** 8.2.0
