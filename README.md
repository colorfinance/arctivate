# Arctivate - Phase 1 MVP

## Overview
**Arctivate** is a performance-driven application that gamifies discipline. 
**Goal:** Create a high-friction-resistance habit and PB tracking system.

## Stack
- **Frontend:** React (Web Dashboard) / React Native (Mobile)
- **Backend/DB:** PostgreSQL (Supabase recommended)
- **Style:** "Arc Fitness" (Deep blacks, Slate grays, Orange accents)

## Phase 1 Roadmap status
- [x] Specs Defined
- [x] Database Schema Design (In Progress)
- [x] Core UI (Habits & Workout Logger)
- [ ] Authentication Setup
- [ ] Gamification Engine (Points Logic)

## Feature Demos
- **Workout Logger:** `/prototype.html`
- **Habit Tracker:** `/habits.html`
- **Food Scanner:** `/food.html`


## Gamification Rules
- **Habit:** +10 pts
- **Workout:** +50 pts
- **New PB:** +100 pts
- **Check-in:** +150 pts

## Mobile (Capacitor) — quick reference
The native iOS shell loads `https://arctivate.vercel.app` via Capacitor's
`server.url`. A bundled offline fallback (`out/offline.html`) renders a
"Reconnecting…" screen if the host is unreachable.

```bash
npm install
npm run build:ios          # next build + offline shell + cap sync ios
npm run cap:open:ios       # open Xcode workspace
```

Override the served URL per environment:
```bash
CAP_SERVER_URL=https://staging.arctivate.app npm run build:ios
```

Regenerate iOS icons / splash from `assets/icon.png` and `assets/splash.png`:
```bash
npm run generate:capacitor-assets
```

See [`STORE_SUBMISSION_STEPS.md`](./STORE_SUBMISSION_STEPS.md) for the full
TestFlight / App Store walkthrough, including the GitHub Actions secrets
needed for the `Build iOS IPA` workflow.

> **Note:** `mobile/` contains a deprecated Expo prototype kept only as
> reference. All current native work lives under `ios/` and `android/`
> (Capacitor 8).
