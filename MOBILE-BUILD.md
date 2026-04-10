# Arctivate — Mobile Build Guide

This is the step-by-step for rebuilding the iOS app in Xcode after pulling
the latest changes on `claude/capacitor-mobile-app-3iF1M`.

## 1. One-time setup (only if `xcodebuild` errors with "command line tools")

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```

## 2. Pull the latest code

```bash
cd ~/LocalTheory/apps/arctivate    # or wherever you cloned it
git checkout claude/capacitor-mobile-app-3iF1M
git pull origin claude/capacitor-mobile-app-3iF1M
npm install
```

## 3. Generate / refresh the app icon

The new icon is already committed, but if you ever want to tweak it, edit
`scripts/generate-icon.js` and run:

```bash
npm run icons:generate
```

That regenerates:
- `assets/icon.png` (1024×1024 master)
- `assets/splash.png` (2732×2732)
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- `ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png`
- All Android mipmap launcher icons

### Using your own icon (recommended before shipping)

If you have a custom 1024×1024 PNG, drop it in as `assets/icon.png` and then
run just the install step:

```bash
node scripts/install-ios-icon.js
```

This will copy it into iOS and regenerate Android densities directly from
the generator. For Android raster resizing of a custom image you'll want a
proper tool like `@capacitor/assets`, but the iOS install works with any
square PNG.

## 4. Build the web app for static export

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY \
npm run build:mobile
```

Important: the Supabase env vars *must* be set at build time for static
export — they get baked into the JS bundle.

## 5. Sync the native project

```bash
npx cap sync ios
```

## 6. Open Xcode and build

```bash
open ios/App/App.xcodeproj
```

In Xcode:

1. Select the `App` target, then the **Signing & Capabilities** tab.
2. Make sure **Automatically manage signing** is on and your Team is picked.
3. Bundle Identifier should read `com.arc.arctivate`.
4. Select an **iPhone simulator** as the run destination (unless you have
   a registered physical device).
5. Hit **Cmd+R** (or the ▶ button) to build and run.

## 7. Archive for App Store upload

1. Change the run destination to **Any iOS Device (arm64)**.
2. **Product → Archive**.
3. When the Organizer opens, click **Distribute App → App Store Connect →
   Upload**.

## Troubleshooting

- **"No profiles for 'com.arc.arctivate' were found"** — Keep automatic
  signing on and pick your Team. Xcode will request a profile from Apple.
- **"Your team has no devices"** — Run on the simulator, not a physical
  device, or register the device in Apple Developer first.
- **Blank white screen on launch** — Supabase env vars weren't set at build
  time. Re-run step 4 with the vars inline.
- **Apple/Google sign-in opens browser but never returns** — Verify the
  `CFBundleURLTypes` entry for `com.arc.arctivate` is still in
  `ios/App/App/Info.plist`, and that the Supabase redirect URL list
  includes `com.arc.arctivate://callback`.
