#!/usr/bin/env node
/**
 * Installs the generated icon into both the iOS AppIcon.appiconset and,
 * if present, the Android mipmap directories.
 *
 * iOS: Capacitor 6 only needs a single 1024x1024 universal icon.
 * Android: We re-render the glyph at each mipmap resolution so the small
 * launcher icons stay crisp without requiring an external resizer.
 *
 * Usage: node scripts/install-ios-icon.js
 */

const fs = require('fs')
const path = require('path')
const { renderIcon } = require('./generate-icon')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'assets', 'icon.png')
const IOS_DIR = path.join(
  ROOT,
  'ios',
  'App',
  'App',
  'Assets.xcassets',
  'AppIcon.appiconset'
)

if (!fs.existsSync(SRC)) {
  console.error('Missing assets/icon.png — run `node scripts/generate-icon.js` first.')
  process.exit(1)
}

// ---------- iOS ----------

if (fs.existsSync(IOS_DIR)) {
  const destPng = path.join(IOS_DIR, 'AppIcon-512@2x.png')
  fs.copyFileSync(SRC, destPng)

  const contents = {
    images: [
      {
        filename: 'AppIcon-512@2x.png',
        idiom: 'universal',
        platform: 'ios',
        size: '1024x1024',
      },
    ],
    info: { author: 'xcode', version: 1 },
  }
  fs.writeFileSync(
    path.join(IOS_DIR, 'Contents.json'),
    JSON.stringify(contents, null, 2) + '\n'
  )

  console.log('Installed iOS app icon:')
  console.log('  ' + path.relative(ROOT, destPng))

  // Splash
  const SPLASH_SRC = path.join(ROOT, 'assets', 'splash.png')
  const SPLASH_DIR = path.join(
    ROOT,
    'ios',
    'App',
    'App',
    'Assets.xcassets',
    'Splash.imageset'
  )
  if (fs.existsSync(SPLASH_SRC) && fs.existsSync(SPLASH_DIR)) {
    for (const name of [
      'splash-2732x2732.png',
      'splash-2732x2732-1.png',
      'splash-2732x2732-2.png',
    ]) {
      fs.copyFileSync(SPLASH_SRC, path.join(SPLASH_DIR, name))
    }
    console.log('Installed iOS splash screen:')
    console.log('  ' + path.relative(ROOT, SPLASH_DIR))
  }
} else {
  console.log('Skipping iOS — ios/App/App/Assets.xcassets/AppIcon.appiconset not found')
}

// ---------- Android ----------

const ANDROID_RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
if (fs.existsSync(ANDROID_RES)) {
  const densities = [
    { dir: 'mipmap-mdpi', size: 48 },
    { dir: 'mipmap-hdpi', size: 72 },
    { dir: 'mipmap-xhdpi', size: 96 },
    { dir: 'mipmap-xxhdpi', size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ]

  for (const { dir, size } of densities) {
    const destDir = path.join(ANDROID_RES, dir)
    if (!fs.existsSync(destDir)) continue
    const square = renderIcon({ size })
    const foreground = renderIcon({ size, transparentBg: true })
    fs.writeFileSync(path.join(destDir, 'ic_launcher.png'), square)
    fs.writeFileSync(path.join(destDir, 'ic_launcher_round.png'), square)
    fs.writeFileSync(path.join(destDir, 'ic_launcher_foreground.png'), foreground)
  }
  console.log('Installed Android launcher icons across all mipmap densities')
}
