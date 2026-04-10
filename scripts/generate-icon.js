#!/usr/bin/env node
/**
 * Generates the Arctivate app icon as a 1024x1024 PNG.
 *
 * Design: dark radial-gradient background with a bold italic "A" glyph
 * rendered in the Arctivate accent color. No external dependencies —
 * uses only Node's built-in `zlib` to emit a valid PNG.
 *
 * Usage:
 *   node scripts/generate-icon.js
 *
 * Output:
 *   assets/icon.png             (1024x1024 — source for @capacitor/assets)
 *   assets/icon-foreground.png  (1024x1024 — transparent bg for Android adaptive)
 *   assets/splash.png           (2732x2732 — splash source)
 */

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

// ---------- PNG encoder ----------

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(width, height, pixels) {
  // pixels: Buffer of RGBA bytes, length = width*height*4
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // add filter byte (0) at the start of each row
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- Drawing helpers ----------

function createCanvas(w, h) {
  return { w, h, data: Buffer.alloc(w * h * 4) }
}

function setPx(c, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return
  const i = (y * c.w + x) * 4
  // alpha-over compositing
  const srcA = a / 255
  const dstA = c.data[i + 3] / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA === 0) return
  c.data[i] = Math.round((r * srcA + c.data[i] * dstA * (1 - srcA)) / outA)
  c.data[i + 1] = Math.round((g * srcA + c.data[i + 1] * dstA * (1 - srcA)) / outA)
  c.data[i + 2] = Math.round((b * srcA + c.data[i + 2] * dstA * (1 - srcA)) / outA)
  c.data[i + 3] = Math.round(outA * 255)
}

function fillBackground(c, gradient = true) {
  const cx = c.w / 2
  const cy = c.h * 0.42
  const maxDist = Math.hypot(c.w, c.h)
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      const i = (y * c.w + x) * 4
      if (gradient) {
        const d = Math.hypot(x - cx, y - cy) / maxDist
        // dark base -> slight teal tint toward the glow
        const t = Math.max(0, 1 - d * 1.6)
        const r = Math.round(10 + 0 * t)
        const g = Math.round(10 + 40 * t)
        const b = Math.round(10 + 50 * t)
        c.data[i] = r
        c.data[i + 1] = g
        c.data[i + 2] = b
        c.data[i + 3] = 255
      } else {
        c.data[i] = 0
        c.data[i + 1] = 0
        c.data[i + 2] = 0
        c.data[i + 3] = 0
      }
    }
  }
}

// Signed distance to a line segment (for thick strokes / glyph construction)
function sdfSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax
  const pay = py - ay
  const bax = bx - ax
  const bay = by - ay
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)))
  const dx = pax - bax * h
  const dy = pay - bay * h
  return Math.hypot(dx, dy)
}

function drawStroke(c, ax, ay, bx, by, thickness, r, g, b) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx) - thickness - 2))
  const maxX = Math.min(c.w - 1, Math.ceil(Math.max(ax, bx) + thickness + 2))
  const minY = Math.max(0, Math.floor(Math.min(ay, by) - thickness - 2))
  const maxY = Math.min(c.h - 1, Math.ceil(Math.max(ay, by) + thickness + 2))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = sdfSegment(x + 0.5, y + 0.5, ax, ay, bx, by)
      const edge = thickness - d
      if (edge > -1.5) {
        // smooth 1.5px antialias
        const alpha = Math.max(0, Math.min(1, (edge + 1.5) / 3))
        setPx(c, x, y, r, g, b, Math.round(alpha * 255))
      }
    }
  }
}

function drawGlow(c, cx, cy, radius, r, g, b, intensity = 0.35) {
  const minX = Math.max(0, Math.floor(cx - radius))
  const maxX = Math.min(c.w - 1, Math.ceil(cx + radius))
  const minY = Math.max(0, Math.floor(cy - radius))
  const maxY = Math.min(c.h - 1, Math.ceil(cy + radius))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      if (d > radius) continue
      const t = 1 - d / radius
      const alpha = Math.round(t * t * intensity * 255)
      if (alpha > 0) setPx(c, x, y, r, g, b, alpha)
    }
  }
}

function drawA(c, cx, cy, size, r, g, b) {
  // Bold italic "A" – two slanted upstrokes + crossbar.
  const half = size / 2
  const slant = size * 0.14 // italic lean
  const baseY = cy + half
  const apexY = cy - half
  const leftBase = cx - half + slant
  const rightBase = cx + half + slant
  const apexX = cx - slant * 0.3
  const thickness = size * 0.12

  // Left diagonal
  drawStroke(c, leftBase, baseY, apexX, apexY, thickness, r, g, b)
  // Right diagonal
  drawStroke(c, rightBase, baseY, apexX, apexY, thickness, r, g, b)
  // Crossbar (roughly at 60% down)
  const tCross = 0.58
  const lxC = leftBase + (apexX - leftBase) * (1 - tCross)
  const lyC = baseY + (apexY - baseY) * (1 - tCross)
  const rxC = rightBase + (apexX - rightBase) * (1 - tCross)
  const ryC = baseY + (apexY - baseY) * (1 - tCross)
  drawStroke(c, lxC, lyC, rxC, ryC, thickness * 0.85, r, g, b)
}

// ---------- Render ----------

function renderIcon({ size, transparentBg = false }) {
  const c = createCanvas(size, size)
  fillBackground(c, !transparentBg)

  // Accent color (Arctivate teal: #00D4AA)
  const AR = 0x00,
    AG = 0xd4,
    AB = 0xaa

  const cx = size / 2
  const cy = size / 2

  // Outer glow ring
  drawGlow(c, cx, cy * 0.95, size * 0.55, AR, AG, AB, 0.18)
  drawGlow(c, cx, cy * 0.95, size * 0.35, AR, AG, AB, 0.25)

  // Main "A" glyph
  drawA(c, cx, cy, size * 0.62, AR, AG, AB)

  // Highlight pass (brighter inner stroke for a neon feel)
  drawA(c, cx, cy, size * 0.62, 0xaa, 0xff, 0xe5)

  return encodePNG(size, size, c.data)
}

// ---------- Output ----------

module.exports = { renderIcon, encodePNG }

if (require.main === module) {
  const outDir = path.join(__dirname, '..', 'assets')
  fs.mkdirSync(outDir, { recursive: true })

  const icon = renderIcon({ size: 1024 })
  fs.writeFileSync(path.join(outDir, 'icon.png'), icon)

  const iconFg = renderIcon({ size: 1024, transparentBg: true })
  fs.writeFileSync(path.join(outDir, 'icon-foreground.png'), iconFg)

  const splash = renderIcon({ size: 2732 })
  fs.writeFileSync(path.join(outDir, 'splash.png'), splash)

  console.log('Wrote:')
  console.log('  assets/icon.png            (1024x1024)')
  console.log('  assets/icon-foreground.png (1024x1024, transparent bg)')
  console.log('  assets/splash.png          (2732x2732)')
}
