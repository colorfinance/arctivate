#!/usr/bin/env node
/**
 * Writes a tiny static fallback shell into ./out so Capacitor has something
 * to bundle as the offline page (referenced by capacitor.config.ts
 * `server.errorPath`). The native shell uses this when arctivate.vercel.app
 * is unreachable. Stays in sync with the Arctivate dark theme.
 *
 * Run as part of `npm run cap:build` before `cap sync`.
 */
const fs = require('node:fs');
const path = require('node:path');

const outDir = path.join(__dirname, '..', 'out');
fs.mkdirSync(outDir, { recursive: true });

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#030808" />
  <title>Arctivate</title>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #030808; color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 24px; }
    .brand { font-size: 32px; font-weight: 800; letter-spacing: 0.18em; color: #FF3B00; }
    .subtitle { margin-top: 16px; font-size: 16px; opacity: 0.8; }
    .hint { margin-top: 32px; font-size: 13px; opacity: 0.5; }
    .spinner { width: 36px; height: 36px; margin-top: 32px; border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.1); border-top-color: #FF3B00;
      animation: spin 0.9s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    button { margin-top: 24px; background: #FF3B00; color: #030808; border: 0;
      padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 15px;
      cursor: pointer; min-width: 140px; min-height: 44px; }
  </style>
</head>
<body>
  <div class="brand">ARCTIVATE</div>
  <div class="subtitle" id="msg">Reconnecting…</div>
  <div class="spinner" aria-hidden="true"></div>
  <button id="retry" type="button">Try again</button>
  <div class="hint">Check your connection or try opening the app again.</div>
  <script>
    var msg = document.getElementById('msg');
    var btn = document.getElementById('retry');
    function reload() { window.location.href = ${JSON.stringify(process.env.CAP_SERVER_URL || 'https://arctivate.vercel.app')}; }
    btn.addEventListener('click', reload);
    // Auto-retry every 8s when the device reports it's online again.
    setInterval(function () {
      if (navigator.onLine) reload();
    }, 8000);
    window.addEventListener('online', reload);
  </script>
</body>
</html>
`;

const indexPath = path.join(outDir, 'index.html');
const offlinePath = path.join(outDir, 'offline.html');
fs.writeFileSync(indexPath, html);
fs.writeFileSync(offlinePath, html);
console.log('[arctivate] Wrote offline shell to', indexPath, 'and', offlinePath);
