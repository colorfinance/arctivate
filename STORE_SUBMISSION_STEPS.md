# Arctivate - Step by Step Store Submission

## PART 1: Google Play Store (Android)

### Step 1: Create a Google Play Developer account
1. Go to https://play.google.com/console
2. Sign in with your Google account
3. Pay the **$25 one-time fee**
4. Fill in your developer profile (name, address, etc.)
5. Wait for approval (usually 1-2 days)

### Step 2: Create your Android signing key
On any computer with Java installed, run this in your terminal:
```bash
keytool -genkey -v -keystore arctivate-upload-key.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias arctivate-upload
```
It will ask you for:
- A password (remember this!)
- Your name, organization, city, country

**SAVE THIS FILE AND PASSWORD SOMEWHERE SAFE. You cannot recover it.**

### Step 3: Add secrets to GitHub
1. Go to your GitHub repo > **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret** for each:

| Name | Value |
|------|-------|
| `ANDROID_KEYSTORE_BASE64` | Run `base64 -i arctivate-upload-key.jks` on Mac, or `base64 arctivate-upload-key.jks` on Linux, and paste the output |
| `ANDROID_KEYSTORE_PASSWORD` | The password you chose in Step 2 |
| `ANDROID_KEY_ALIAS` | `arctivate-upload` |
| `ANDROID_KEY_PASSWORD` | The password you chose in Step 2 |

### Step 4: Build the AAB
1. Go to your GitHub repo > **Actions** tab
2. Click **Build Android AAB** on the left
3. Click **Run workflow** > **Run workflow**
4. Wait for it to finish (green checkmark)
5. Click into the completed run
6. Scroll down to **Artifacts**
7. Download **arctivate-release-aab**
8. Unzip it — you'll get a file ending in `.aab`

### Step 5: Create your app in Google Play Console
1. Go to https://play.google.com/console
2. Click **Create app**
3. Fill in:
   - App name: **Arctivate**
   - Default language: **English**
   - App or game: **App**
   - Free or paid: **Free**
4. Accept the declarations and click **Create app**

### Step 6: Fill in the store listing
Go to **Grow > Store presence > Main store listing** and fill in:
- **Short description:** Gamify your fitness with points, streaks, and real rewards
- **Full description:**
  ```
  Arctivate transforms your fitness journey into a game. Log workouts,
  track habits, scan food, and earn points for every healthy choice.

  Features:
  • Workout logger with personal best tracking
  • Daily habit tracker with progress photos
  • AI-powered food scanner and calorie counter
  • AI coaching with readiness scores
  • Social feed to share wins with friends
  • Points and streaks to keep you motivated
  • QR code rewards from partner businesses
  ```
- **App icon:** Upload a 512x512 PNG
- **Feature graphic:** Upload a 1024x500 PNG
- **Screenshots:** Upload at least 2 phone screenshots (take these from your live app)

### Step 7: Complete the required sections
In the left sidebar, work through each section with a ⚠️ icon:
1. **App content** > Privacy policy (you need a URL — use a free one from getterms.io)
2. **App content** > Ads (select "No ads")
3. **App content** > Content rating (fill out the questionnaire — mostly "No" for a fitness app)
4. **App content** > Target audience (select 18+)
5. **App content** > Data safety (describe what data you collect)

### Step 8: Upload the AAB and release
1. Go to **Release** > **Testing** > **Internal testing**
2. Click **Create new release**
3. Upload your `.aab` file from Step 4
4. Add release notes: `Initial release of Arctivate`
5. Click **Review release** > **Start rollout**

### Step 9: Add testers
1. Go to **Internal testing** > **Testers** tab
2. Create an email list
3. Add your email and any testers' emails
4. Share the opt-in link with your testers

**Your testers can now install from the Play Store!**

### Step 10: Move to production (when ready)
1. Go to **Release** > **Production**
2. Click **Create new release**
3. Promote from internal testing or upload the AAB again
4. Submit for review (takes 1-7 days)

---

## PART 2: Apple App Store / TestFlight (iOS)

### Step 1: Create an Apple Developer account
1. Go to https://developer.apple.com/programs/
2. Click **Enroll**
3. Sign in with your Apple ID (or create one)
4. Pay the **$99/year fee**
5. Wait for approval (usually 1-2 days, sometimes 48hrs)

### Step 2: Create your app ID and certificates
1. Go to https://developer.apple.com/account
2. Go to **Certificates, IDs & Profiles**

**Create an App ID:**
1. Click **Identifiers** > **+**
2. Select **App IDs** > **App**
3. Description: `Arctivate`
4. Bundle ID: **Explicit** > `com.arctivate.app`
5. Check these capabilities: Push Notifications (optional)
6. Click **Register**

**Create a distribution certificate:**
1. Click **Certificates** > **+**
2. Select **Apple Distribution**
3. Follow the instructions to create a Certificate Signing Request (CSR) using Keychain Access on a Mac
   - If you don't have a Mac: use a cloud Mac service like MacinCloud ($1 trial)
4. Upload the CSR and download the certificate
5. Double-click to install it in your Keychain

**Export the certificate as .p12:**
1. Open **Keychain Access** on the Mac
2. Find the certificate under "My Certificates"
3. Right-click > **Export**
4. Save as .p12 format
5. Set a password (remember this!)

**Create a provisioning profile:**
1. Back in the Developer portal, click **Profiles** > **+**
2. Select **App Store Connect**
3. Select your App ID (`com.arctivate.app`)
4. Select your distribution certificate
5. Name it: `Arctivate App Store`
6. Download the `.mobileprovision` file

### Step 3: Add secrets to GitHub
1. Go to your GitHub repo > **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret** for each:

**Signing material (required to produce a signed IPA):**

| Name | Value |
|------|-------|
| `IOS_BUILD_CERTIFICATE_BASE64` | Run `base64 -i certificate.p12` and paste the output |
| `IOS_P12_PASSWORD` | The password you set when exporting the .p12 |
| `IOS_PROVISION_PROFILE_BASE64` | Run `base64 -i profile.mobileprovision` and paste the output |
| `IOS_KEYCHAIN_PASSWORD` | Any random password used only inside the runner (e.g. `ci-build-2024`) |

**App Store Connect API key (required to upload to TestFlight automatically):**

In App Store Connect → Users and Access → Integrations → App Store Connect API,
generate a new key with **App Manager** role and download the `.p8` file.

| Name | Value |
|------|-------|
| `APP_STORE_CONNECT_API_KEY_ID` | The 10-character Key ID shown in the portal |
| `APP_STORE_CONNECT_API_KEY_ISSUER_ID` | The Issuer ID shown above the keys list |
| `APP_STORE_CONNECT_API_KEY_BASE64` | Run `base64 -i AuthKey_XXXXXXXX.p8` and paste the output |

### Step 4: Build the IPA
1. Go to your GitHub repo > **Actions** tab
2. Click **Build iOS IPA** on the left
3. Click **Run workflow**, choose a `lane`:
   - `build` — produces an IPA artifact only
   - `beta` — builds and uploads to TestFlight (default, recommended)
   - `release` — builds and submits the version to App Store review
4. Wait for it to finish (~15-20 min on `macos-14`)
5. Click into the completed run, scroll to **Artifacts**, download
   **arctivate-ipa** (also contains the dSYM for crash symbolication)

### Step 4b (alternative): Build locally on Mac
If you'd rather skip CI and use Xcode directly:

```bash
npm install
npm run build:ios          # next build + offline shell + cap sync ios
npm run cap:open:ios       # opens ios/App/App.xcworkspace in Xcode
```

In Xcode:
1. Select the **App** scheme and **Any iOS Device (arm64)** as target
2. **Signing & Capabilities** → check "Automatically manage signing", pick your team
3. **Product → Archive**
4. **Distribute App → App Store Connect → Upload**
5. Build appears in App Store Connect → TestFlight within ~10 min

### Step 5: Create your app in App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Click **My Apps** > **+** > **New App**
3. Fill in:
   - Platform: **iOS**
   - Name: **Arctivate**
   - Primary language: **English**
   - Bundle ID: `com.arctivate.app`
   - SKU: `arctivate-001`
4. Click **Create**

### Step 6: Fill in app information
On the app page, fill in:

**App Information tab:**
- Category: **Health & Fitness**
- Content rights: "Does not contain third-party content"

**Pricing and Availability tab:**
- Price: **Free**
- Availability: Select your countries

**App Privacy tab:**
- Privacy policy URL (use getterms.io for a free one)
- Fill in the data collection questionnaire

### Step 7: Upload the IPA
**Option A: Using Transporter app (easiest)**
1. Download **Transporter** from the Mac App Store (free)
2. Open Transporter
3. Sign in with your Apple ID
4. Drag your `.ipa` file into Transporter
5. Click **Deliver**

**Option B: No Mac available**
1. Use a cloud Mac (MacinCloud ~$1 trial, or GitHub Actions already uploaded it)
2. Install Transporter on the cloud Mac and upload

### Step 8: Create a TestFlight build
1. Back in App Store Connect, go to your app
2. Click **TestFlight** tab
3. Your uploaded build will appear (may take 5-10 min to process)
4. Click the build number
5. Fill in **Export Compliance** > select "No" (uses standard HTTPS only)
6. The build is now available for testing

### Step 9: Add TestFlight testers
**Internal testers (up to 25 — instant, no review needed):**
1. Go to **TestFlight** > **Internal Group** (or create one)
2. Click **+** next to Testers
3. Add testers by Apple ID email
4. They'll get an email invite to install via TestFlight app

**External testers (up to 10,000 — requires brief review):**
1. Go to **TestFlight** > **External Testing**
2. Click **+** to create a group
3. Add testers by email
4. Submit for Beta App Review (usually approved in 1 day)

### Step 10: Submit to App Store (when ready)
1. Go to your app > **App Store** tab
2. Click the version (e.g. "1.0 Prepare for Submission")
3. Fill in:
   - Screenshots (6.7" iPhone 15 Pro Max + 5.5" iPhone 8 Plus sizes minimum)
   - Description, keywords, support URL
   - Select the build you uploaded
4. Click **Submit for Review**
5. Review takes 1-3 days

---

## Quick Reference: What Goes Where

| What | Where to upload | Format |
|------|----------------|--------|
| Android app | Google Play Console > Internal testing > Create release | `.aab` file |
| iOS app | Transporter app (Mac) or Xcode | `.ipa` file |

## Quick Reference: Costs

| Item | Cost |
|------|------|
| Google Play Developer | $25 one-time |
| Apple Developer Program | $99/year |
| GitHub Actions (builds) | Free for public repos, 2000 min/month for private |

## Quick Reference: Timeline

| Step | Time |
|------|------|
| Developer account approval | 1-2 days |
| GitHub Actions build | 10-20 minutes |
| TestFlight processing | 5-15 minutes |
| TestFlight external review | 1 day |
| App Store review | 1-3 days |
| Google Play review | 1-7 days |
