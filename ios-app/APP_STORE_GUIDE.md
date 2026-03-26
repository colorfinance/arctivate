# Arctivate - App Store Submission Guide

Complete step-by-step guide to get Arctivate live on the iOS App Store.

## Prerequisites

- [ ] **Apple Developer Account** ($99/year) - [developer.apple.com](https://developer.apple.com)
- [ ] **Mac with Xcode 15+** installed
- [ ] **Supabase project** configured with the database schema
- [ ] **Vercel deployment** running (for API endpoints)

---

## Step 1: Apple Developer Setup (15 min)

### 1.1 Create App ID
1. Go to [developer.apple.com/account](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles** > **Identifiers**
3. Click **+** to register a new App ID
4. Select **App IDs** > **App**
5. Set:
   - Description: `Arctivate`
   - Bundle ID: `com.arctivate.app` (Explicit)
6. Enable capabilities:
   - [x] Push Notifications
   - [x] Sign In with Apple (optional, for future)
7. Click **Register**

### 1.2 Create App Store Connect Listing
1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **My Apps** > **+** > **New App**
3. Fill in:
   - Platform: **iOS**
   - Name: **Arctivate**
   - Primary Language: **English (U.S.)**
   - Bundle ID: **com.arctivate.app**
   - SKU: `arctivate-ios`
4. Click **Create**

### 1.3 Note Your Team ID
1. In the Apple Developer portal, go to **Membership**
2. Copy your **Team ID** (10-character string like `ABC1234DEF`)
3. You'll need this for Xcode and Fastlane configuration

---

## Step 2: Configure the Project (10 min)

### 2.1 Open in Xcode
```bash
cd ios-app/Arctivate
open Arctivate.xcodeproj
```

### 2.2 Set Your Team
1. Select the **Arctivate** project in the navigator
2. Select the **Arctivate** target
3. Go to **Signing & Capabilities** tab
4. Check **Automatically manage signing**
5. Select your **Team** from the dropdown
6. Xcode will automatically create certificates and provisioning profiles

### 2.3 Set Environment Variables
In Xcode, go to **Product** > **Scheme** > **Edit Scheme** > **Run** > **Arguments** > **Environment Variables**:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://your-project.supabase.co` |
| `SUPABASE_ANON_KEY` | `your-anon-key` |
| `API_BASE_URL` | `https://arctivate.vercel.app` |

For production builds, these should be set in `Info.plist` or a config file:

```swift
// Alternative: Add to Info.plist as custom keys
// Then read with Bundle.main.infoDictionary?["SUPABASE_URL"]
```

### 2.4 Configure Fastlane
Edit `fastlane/Appfile`:
```ruby
app_identifier("com.arctivate.app")
apple_id("your-email@example.com")      # Your Apple Developer email
team_id("ABC1234DEF")                     # Your Team ID
itc_team_id("123456789")                  # App Store Connect Team ID
```

---

## Step 3: App Icon (5 min)

You need a 1024x1024 PNG app icon. Place it in:
```
Assets.xcassets/AppIcon.appiconset/
```

### Quick Icon Generation
If you have a source icon, create it with:
```bash
# Using sips (built into macOS)
sips -z 1024 1024 your-icon.png --out Assets.xcassets/AppIcon.appiconset/AppIcon.png
```

Or use the existing icon from the Capacitor app:
```bash
cp ../../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png \
   Assets.xcassets/AppIcon.appiconset/AppIcon.png
```

---

## Step 4: Build & Test Locally (10 min)

### 4.1 Resolve Dependencies
```bash
# Xcode will auto-resolve SPM packages, or manually:
xcodebuild -resolvePackageDependencies
```

### 4.2 Build for Simulator
```bash
xcodebuild -project Arctivate.xcodeproj \
  -scheme Arctivate \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  build
```

### 4.3 Run on Device
1. Connect your iPhone via USB
2. In Xcode, select your device from the toolbar
3. Press **Cmd+R** to build and run
4. Trust the developer certificate on your device: **Settings > General > VPN & Device Management**

---

## Step 5: Screenshots (20 min)

App Store requires screenshots for these device sizes:

| Device | Resolution | Required? |
|--------|-----------|-----------|
| iPhone 6.9" (16 Pro Max) | 1320 x 2868 | Yes |
| iPhone 6.7" (15 Pro Max) | 1290 x 2796 | Yes |
| iPhone 6.5" (11 Pro Max) | 1284 x 2778 | Optional |
| iPhone 5.5" (8 Plus) | 1242 x 2208 | Optional |
| iPad Pro 13" | 2048 x 2732 | If supporting iPad |

### Capture Screenshots
1. Run the app on each simulator size
2. Navigate to each key screen
3. Press **Cmd+S** in Simulator to save screenshot
4. Or use Fastlane Snapshot (automated)

### Recommended Screenshots (5-8 per device)
1. **Train** - Workout logging with exercises
2. **Habits** - Challenge progress with streaks
3. **Food** - Daily nutrition tracking
4. **Coach** - AI coaching conversation
5. **Feed** - Social feed with high-fives
6. **Profile** - Points and streak stats

---

## Step 6: App Store Metadata

### 6.1 App Information
Fill these in App Store Connect:

**App Name:** Arctivate

**Subtitle:** Gamify Your Discipline

**Description:**
```
Arctivate turns your fitness journey into a game. Track workouts, build habits,
log nutrition, and earn points for every rep, every habit, every day.

FEATURES:
• Workout Logger - Track exercises, sets, reps with automatic PB detection
• Habit Tracker - Daily habits with streaks and a 75-day challenge
• Food Scanner - AI-powered food recognition with macro tracking
• AI Coach - Get personalized workout and nutrition advice
• Social Feed - Share achievements and high-five your community
• QR Rewards - Scan codes at partner gyms for bonus points

GAMIFICATION:
• Habits: +10 pts per completion
• Workouts: +50 pts per session
• New Personal Best: +100 pts bonus
• Partner Check-in: +150 pts

Build discipline. Track progress. Level up.
```

**Keywords:** fitness,workout,habits,tracker,gamification,gym,nutrition,personal best,streak,health

**Category:** Health & Fitness

**Secondary Category:** Lifestyle

**Privacy Policy URL:** `https://arctivate.vercel.app/privacy`

**Support URL:** `https://arctivate.vercel.app`

### 6.2 Age Rating
- Set to **4+** (no objectionable content)
- No gambling, violence, or mature themes

### 6.3 App Privacy
In App Store Connect > **App Privacy**, declare data collection:

| Data Type | Purpose | Linked to Identity? |
|-----------|---------|-------------------|
| Email Address | Account | Yes |
| Fitness & Exercise | App Functionality | Yes |
| Health & Fitness | App Functionality | Yes |
| Photos | App Functionality | No |

---

## Step 7: Submit to TestFlight (5 min)

### Option A: Xcode Upload
1. In Xcode: **Product** > **Archive**
2. Once archived, click **Distribute App**
3. Select **App Store Connect**
4. Select **Upload**
5. Click through the options (keep defaults)
6. Click **Upload**

### Option B: Fastlane Upload
```bash
cd ios-app/Arctivate

# Upload to TestFlight
fastlane beta
```

### Option C: GitHub Actions (Automated)
1. Set up repository secrets (see Step 8)
2. Push to `main` branch
3. The workflow automatically builds and uploads to TestFlight

---

## Step 8: GitHub Actions Setup (CI/CD)

### Required Secrets
Go to your GitHub repo > **Settings** > **Secrets and variables** > **Actions**

Add these secrets:

| Secret | How to Get It |
|--------|--------------|
| `IOS_BUILD_CERTIFICATE_BASE64` | Export .p12 from Keychain, then `base64 -i cert.p12` |
| `IOS_P12_PASSWORD` | Password you set when exporting the .p12 |
| `IOS_PROVISION_PROFILE_BASE64` | Download from Apple Developer, then `base64 -i profile.mobileprovision` |
| `IOS_KEYCHAIN_PASSWORD` | Any random password (used for temp keychain) |
| `APPSTORE_CONNECT_API_KEY_ID` | From App Store Connect > Users > Keys |
| `APPSTORE_CONNECT_ISSUER_ID` | From App Store Connect > Users > Keys |
| `APPSTORE_CONNECT_API_KEY_BASE64` | Download .p8 key, then `base64 -i AuthKey_XXXX.p8` |

### Creating App Store Connect API Key
1. Go to [appstoreconnect.apple.com/access/api](https://appstoreconnect.apple.com/access/api)
2. Click **+** to generate a new key
3. Name: `Arctivate CI`
4. Access: **Admin**
5. Download the `.p8` file (only available once!)
6. Note the **Key ID** and **Issuer ID**

### Encode Secrets
```bash
# Certificate
base64 -i ~/Desktop/Certificates.p12 | pbcopy
# Paste into IOS_BUILD_CERTIFICATE_BASE64

# Provisioning Profile
base64 -i ~/Desktop/Arctivate_AppStore.mobileprovision | pbcopy
# Paste into IOS_PROVISION_PROFILE_BASE64

# API Key
base64 -i ~/Desktop/AuthKey_XXXX.p8 | pbcopy
# Paste into APPSTORE_CONNECT_API_KEY_BASE64
```

---

## Step 9: Submit for App Store Review

### 9.1 Test on TestFlight First
1. After upload, go to App Store Connect > **TestFlight**
2. Wait for build processing (~5-15 min)
3. Add internal testers (your team)
4. Test the app thoroughly on real devices

### 9.2 Submit for Review
1. Go to App Store Connect > **App Store** tab
2. Select your build
3. Fill in all metadata (from Step 6)
4. Upload screenshots (from Step 5)
5. Set **Release Method**: Manual or Automatic
6. Click **Submit for Review**

### 9.3 Review Timeline
- **Typical review time:** 24-48 hours
- **First submission:** May take longer (up to 7 days)
- **Common rejection reasons:**
  - Crashes or bugs
  - Incomplete metadata
  - Missing privacy policy
  - Placeholder content
  - Login required without demo account

### 9.4 Provide Demo Account
If your app requires login, add a demo account in App Store Connect:
- **Demo Username:** `demo@arctivate.app`
- **Demo Password:** (create a test account in Supabase)

---

## Quick Reference Commands

```bash
# Build for testing
xcodebuild -project Arctivate.xcodeproj -scheme Arctivate -sdk iphoneos build

# Archive for distribution
xcodebuild -project Arctivate.xcodeproj -scheme Arctivate \
  -archivePath build/Arctivate.xcarchive archive

# Upload via Fastlane
fastlane beta          # TestFlight
fastlane release       # App Store

# Increment version
agvtool new-version -all 2        # Build number
agvtool new-marketing-version 1.1  # Version string
```

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| "No signing certificate" | Open Xcode, sign in with Apple ID, let it create certificates |
| "Provisioning profile not found" | Enable Automatic Signing in Xcode |
| SPM packages fail to resolve | File > Packages > Reset Package Caches in Xcode |
| Build fails on CI | Ensure all secrets are correctly base64-encoded |
| App rejected for crashes | Test on real devices, check crash logs in Xcode Organizer |
| "Missing required icon" | Ensure 1024x1024 AppIcon.png exists in asset catalog |

---

## Timeline Summary

| Step | Time | Requires |
|------|------|----------|
| Apple Developer Setup | 15 min | Apple ID + $99 payment |
| Project Configuration | 10 min | Mac + Xcode |
| App Icon | 5 min | 1024x1024 PNG |
| Local Build & Test | 10 min | iPhone or Simulator |
| Screenshots | 20 min | Simulator |
| App Store Metadata | 15 min | Text + URLs |
| TestFlight Upload | 5 min | Xcode or Fastlane |
| Review Submission | 5 min | All above complete |
| **Apple Review** | **24-48 hours** | Patience |
| **Total hands-on time** | **~1.5 hours** | |
