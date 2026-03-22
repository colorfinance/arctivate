#!/usr/bin/env node
/**
 * Generate PWA icons as SVG files served with .png extension.
 * For production, replace with actual PNG assets.
 */

const fs = require('fs');
const path = require('path');

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
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="900"
        font-size="${size * 0.45}" fill="url(#accent)">A</text>
  <circle cx="${size * 0.75}" cy="${size * 0.25}" r="${size * 0.08}" fill="#00D4AA" opacity="0.8"/>
</svg>`;
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons (browsers accept SVG for PWA icons)
fs.writeFileSync(path.join(iconsDir, 'icon-192.svg'), generateIconSVG(192));
fs.writeFileSync(path.join(iconsDir, 'icon-512.svg'), generateIconSVG(512));

// Also create an apple-touch-icon SVG
const publicDir = path.join(__dirname, '..', 'public');
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.svg'), generateIconSVG(180));

console.log('Generated PWA icon SVGs in /public/icons/');
