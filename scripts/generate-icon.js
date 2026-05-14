#!/usr/bin/env node
// Renders the lightning-bolt-with-flare icon to a 1024x1024 master PNG,
// then exports the sizes Play Store + iOS + Android need.

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const TPL = path.join(ROOT, 'scripts', 'store-assets-templates', 'icon.html');
const STORE_OUT = path.join(ROOT, 'store-assets', 'play-store');
const MASTER = path.join(ROOT, 'assets', 'icon.png');

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('file://' + TPL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const masterBuf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  await browser.close();

  // Master 1024×1024 (overwrites assets/icon.png so cap-assets generators can pick it up)
  fs.writeFileSync(MASTER, masterBuf);
  console.log('✓ assets/icon.png (1024×1024)');

  // Play Store icon — 512×512, 24-bit PNG no alpha
  await sharp(masterBuf)
    .resize(512, 512, { fit: 'cover' })
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(STORE_OUT, 'icon-512.png'));
  console.log('✓ store-assets/play-store/icon-512.png (512×512, no alpha)');

  // iOS app icon — 1024×1024, no alpha (Apple requires it)
  const iosDest = path.join(ROOT, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
  await sharp(masterBuf)
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(iosDest);
  console.log('✓ ios AppIcon-512@2x.png (1024×1024, no alpha)');

  // Android launcher icons across mipmap densities
  const androidSizes = [
    { dir: 'mipmap-mdpi',    size: 48 },
    { dir: 'mipmap-hdpi',    size: 72 },
    { dir: 'mipmap-xhdpi',   size: 96 },
    { dir: 'mipmap-xxhdpi',  size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];
  for (const { dir, size } of androidSizes) {
    const base = path.join(ROOT, 'android/app/src/main/res', dir);
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      // foreground variant is rendered larger inside Android's adaptive icon, but
      // we can ship the same square art for all three — Android will mask correctly.
      await sharp(masterBuf)
        .resize(size, size, { fit: 'cover' })
        .png({ compressionLevel: 9 })
        .toFile(path.join(base, name));
    }
    console.log(`✓ android ${dir} (${size}×${size}, 3 variants)`);
  }

  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
