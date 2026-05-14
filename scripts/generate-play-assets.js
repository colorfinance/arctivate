#!/usr/bin/env node
/* eslint-disable no-console */
// Generates Google Play Store assets:
//   store-assets/play-store/icon-512.png      (512x512)
//   store-assets/play-store/feature-graphic.png (1024x500)
//   store-assets/play-store/phone-{1..4}.png    (1080x1920)
//   store-assets/play-store/tablet-7-{1..4}.png (1200x1920, 9:16)
//   store-assets/play-store/tablet-10-{1..4}.png (1440x2560, 9:16)
//
// Usage:  node scripts/generate-play-assets.js

const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = path.resolve(__dirname, '..');
const TPL = path.join(ROOT, 'scripts', 'store-assets-templates');
const OUT = path.join(ROOT, 'store-assets', 'play-store');
fs.mkdirSync(OUT, { recursive: true });

const SCREENS = [
  { name: 'phone-1-workout', file: 'screen-workout.html' },
  { name: 'phone-2-habits',  file: 'screen-habits.html' },
  { name: 'phone-3-food',    file: 'screen-food.html' },
  { name: 'phone-4-coach',   file: 'screen-coach.html' },
];

// All sizes are exact 9:16 — Google rejects anything else.
const SIZES = [
  { suffix: 'phone',     width: 1080, height: 1920 },
  { suffix: 'tablet-7',  width: 1242, height: 2208 },
  { suffix: 'tablet-10', width: 1440, height: 2560 },
];

async function renderHtmlToPng(browser, htmlPath, outPath, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400); // let fonts settle
  await page.screenshot({ path: outPath, type: 'png', clip: { x: 0, y: 0, width, height } });
  await ctx.close();
}

async function main() {
  console.log('→ icon 512×512');
  await sharp(path.join(ROOT, 'assets', 'icon.png'))
    .resize(512, 512, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, 'icon-512.png'));

  const browser = await chromium.launch();

  console.log('→ feature graphic 1024×500');
  await renderHtmlToPng(
    browser,
    path.join(TPL, 'feature-graphic.html'),
    path.join(OUT, 'feature-graphic.png'),
    1024, 500
  );

  for (const screen of SCREENS) {
    for (const size of SIZES) {
      const idx = screen.name.split('-')[1];
      const label = screen.name.split('-').slice(2).join('-');
      const outName = `${size.suffix}-${idx}-${label}.png`;
      console.log(`→ ${outName} (${size.width}×${size.height})`);
      await renderHtmlToPng(
        browser,
        path.join(TPL, screen.file),
        path.join(OUT, outName),
        size.width, size.height
      );
    }
  }

  await browser.close();
  console.log('\nDone. Files in store-assets/play-store/');
}

main().catch(e => { console.error(e); process.exit(1); });
