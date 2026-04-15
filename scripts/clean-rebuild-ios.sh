#!/usr/bin/env bash
# One-command clean rebuild for the iOS app. Run from the repo root.
#
# Usage:
#   ./scripts/clean-rebuild-ios.sh
#
# This wipes every stale Xcode/SPM cache, re-syncs Capacitor, and reopens
# Xcode in a pristine state. Takes ~2-5 minutes.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo ""
echo "==> Arctivate iOS clean rebuild"
echo "    Repo: $REPO_ROOT"
echo ""

echo "==> 1/6 Killing any running Xcode instances..."
osascript -e 'quit app "Xcode"' 2>/dev/null || true
sleep 2

echo "==> 2/6 Wiping Xcode caches..."
rm -rf "$HOME/Library/Developer/Xcode/DerivedData"
rm -rf "$HOME/Library/Caches/org.swift.swiftpm"

echo "==> 3/6 Wiping local Swift Package Manager state..."
rm -rf ios/App/.swiftpm
rm -rf ios/App/App.xcworkspace/xcshareddata/swiftpm
rm -rf ios/App/build
rm -rf ios/App/DerivedData

echo "==> 4/6 Building offline fallback shell..."
node scripts/build-offline-shell.js

echo "==> 5/6 Running Capacitor sync..."
npx cap sync ios

echo "==> 6/6 Opening Xcode..."
npx cap open ios

echo ""
echo "==> Done. When Xcode opens:"
echo "    1. Wait 2-5 minutes for 'Resolving Package Graph' to finish"
echo "       (watch the top-center status bar)"
echo "    2. Bump Build number: App project > App target > General > Build"
echo "    3. Clean Build Folder (Cmd+Shift+K)"
echo "    4. Set target to 'Any iOS Device (arm64)' at the top"
echo "    5. Product > Archive"
echo ""
