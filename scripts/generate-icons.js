#!/usr/bin/env node
/**
 * Generate app icons and splash screens for iOS and Android.
 *
 * This creates simple branded icons using Canvas.
 * For production, replace with your actual design assets by running:
 *   npx @capacitor/assets generate --iconBackgroundColor '#030808' --splashBackgroundColor '#030808'
 *
 * Place your source icon at: assets/icon.png (1024x1024)
 * Place your source splash at: assets/splash.png (2732x2732)
 */

const fs = require('fs');
const path = require('path');

// SVG-based icon generation (no external deps needed)
function generateIconSVG(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#030808"/>
      <stop offset="100%" style="stop-color:#0A1414"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00D4AA"/>
      <stop offset="100%" style="stop-color:#06B6D4"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#bg)"/>
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="900"
        font-size="${size * 0.45}" fill="url(#accent)">A</text>
  <circle cx="${size * 0.75}" cy="${size * 0.25}" r="${size * 0.08}" fill="#00D4AA" opacity="0.8"/>
</svg>`;
}

function generateSplashSVG(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#030808"/>
      <stop offset="100%" style="stop-color:#0A1414"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00D4AA"/>
      <stop offset="100%" style="stop-color:#06B6D4"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="900"
        font-size="${Math.min(width, height) * 0.12}" fill="url(#accent)">ARCTIVATE</text>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="400"
        font-size="${Math.min(width, height) * 0.035}" fill="#5E7D7D">Gamify Your Discipline</text>
</svg>`;
}

// Create assets directory for source files
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate source SVG icons
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), generateIconSVG(1024));
fs.writeFileSync(path.join(assetsDir, 'splash.svg'), generateSplashSVG(2732, 2732));
fs.writeFileSync(path.join(assetsDir, 'splash-dark.svg'), generateSplashSVG(2732, 2732));

console.log('Generated SVG assets in /assets directory');
console.log('');
console.log('To generate production PNG icons, install sharp and run:');
console.log('  npx @capacitor/assets generate');
console.log('');
console.log('Or replace assets/icon.svg and assets/splash.svg with your own designs.');
