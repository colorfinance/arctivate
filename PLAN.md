# ARCTIVATE PHASE 2: FULL-STACK INTEGRATION & MOBILE READINESS PLAN

**Date:** 2026-02-07
**Project:** Arctivate (Fitness Gamification App)
**Repository:** `/Users/gemmamoore/.openclaw/workspace/arctivate-repo`
**Live URL:** https://arctivate-repo.vercel.app

---

## 1. PROJECT AUDIT & ANALYSIS

### 1.1 Current State Assessment

**Technology Stack Confirmed:**
- **Framework:** Next.js (Pages Router)
- **Language:** JavaScript (ES6+)
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Magic Link (OTP)
- **Deployment:** Vercel
- **File Structure:** Pages-based (e.g., `pages/index.js`, `pages/habits.js`, `pages/train.js`)

**Code Quality:**
- Clean, modern JavaScript with `useState` and `useEffect`.
- Good use of Framer Motion for animations.
- Tailwind classes are consistent.
- No TypeScript currently in use.

**Existing Features:**
1.  **Landing Page:** `pages/landing.js` (Marketing)
2.  **Authentication:** `pages/index.js` (Magic Link Login)
3.  **Habit Tracker:** `pages/habits.js`
    - Supabase tables: `habits`, `habit_logs`.
    - Challenge system with day counter.
    - Integration: **Working** (insets data, optimistic updates).
4.  **Workout Logger:** `pages/train.js`
    - Supabase tables: `exercises`, `workout_logs`.
    - Personal Best tracking.
    - Integration: **Working** (logs data, PB calculation).
5.  **Food Log (Stub):** `pages/food.js` (Needs implementation)

**Database Schema (`schema.sql`):**
- Tables exist for Habits, Logs, Exercises, Workouts, Partners, and Food.
- **Issue Identified:** No `profiles` table for Onboarding data (Age, Weight, Goals). *Note: The schema comments mention `profiles` but the SQL file might not be fully migrated to Supabase or may need updates.*

**Blockers Identified:**
- No clear `profiles` table (needs fix).
- No onboarding flow.
- No barcode scanning capability (needs Tesseract.js or similar).
- No mobile-specific optimizations (PWA manifest, responsive viewport).

---

## 2. IMPLEMENTATION ROADMAP

### **PHASE 1: SCHEMA MIGRATION & TYPESCRIPT SETUP**
*Goal: Ensure database schema matches requirements and prepare for type safety.*

1.  **Update Schema:**
    - Add `profiles` table columns: `age`, `weight`, `gender`, `goal` (text: "lose fat", "gain muscle"), `fitness_level`.
    - Ensure RLS (Row Level Security) policies exist for `(auth.uid() = user_id)`.
2.  **TypeScript Integration:**
    - Create `types/db.ts` (TypeScript) or `types/db.js` (JSDoc).
    - Generate types from Supabase or manually define interfaces for `Habit`, `Exercise`, `WorkoutLog`, `FoodLog`, and `Profile`.
    *Decision: Stick to JavaScript with JSDoc for initially to maintain 100% compatibility with existing untyped codebase, type-check later.*

---

### **PHASE 2: ONSHORE BUGS & STYLE GUIDE**
*Goal: Fix existing logic issues and standardize UI.*

1.  **Arc Fitness Style Guide (Based on "Arc Fitness Australia" search):**
    - **Colors:** Dark background (`#121212`), Accent Orange (`#FF3B00`), Muted Text (`#888888`).
    - **Typography:** Clean Sans-Serif. "Archivo Black" or Inter for Headers. Large, bold numbers.
    - **Layout:** Glassmorphism overlays, rounded corners (`rounded-[2rem]`), visual hierarchy.
2.  **Code Cleanup:**
    - Run `npm run build` and fix any Next.js errors.
    - Audit `habits.js` and `train.js` for potential race conditions in `useEffect`.
    - Ensure all "10 PTs" hardcodes are replaced with variables from DB.

---

### **PHASE 3: ONBOARDING FLOW**
*Goal: Collect user demographics post-signup.*

1.  **New Component:** `components/OnboardingModal.js`
    - Triggered on `user.created_at` null or specific session cookie?
    - Better: Redirect first-time users to `/onboarding` route.
2.  **New Page:** `pages/onboarding.js`
    - Form fields: Name, Age, Weight, Gender, Goal (Dropdown), Fitness Level.
    - Submit: `supabase.from('profiles').update({ ...data })`.
    - Redirect to `/train`.

---

### **PHASE 4: CORE FEATURE - CALORIE SCANNER**
*Goal: Implement camera-based barcode scanning.*

1.  **Libraries:**
    - `react-qr-barcode-scanner` / `html5-qrcode` (for scanning).
    - `openfoodfacts` API (for product lookup).
2.  **New Page/Component:** `components/CalorieScanner.js`
    - UI: Camera viewport, shutter button, "Search by name" fallback.
    - Logic: On detect -> call API -> auto-fill `food_logs` table.
3.  **Database:** `food_logs` table already defined in schema. Good.

---

### **PHASE 5: PROGRESS DASHBOARD**
*Goal: Data visualization for habits/workouts.*

1.  **Libraries:** `recharts` (React SVG charts).
2.  **New Page:** `pages/dashboard.js`
    - **Components:** Line chart (Weight over time), Bar chart (Habit completion streaks).
    - **Data:** Aggregate queries from `workout_logs` and `habit_logs`.

---

### **PHASE 6: MOBILE DEPLOYMENT**
*Goal: App Store readiness (PWA/Capacitor).*

1.  **PWA Config:**
    - Generate `public/manifest.json`, `public/sw.js`.
    - Add `<meta name="theme-color" content="#FF3B00">`.
    - Test offline capability (basic caching for static assets).
2.  **Capacitor Setup:**
    - Install `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`.
    - Configure `capacitor.config.json` (App ID, Web Dir).
    - **Note:** Capacitor requires a Native build environment (Xcode/Android Studio). This phase focuses on "Capacitor Ready" config, not building the .apk.

---

## 3. TASKS BREAKDOWN

| Task ID | Phase | Task | Estimated Time | Notes |
| :--- | :--- | :--- | :--- | :--- |
| T1 | Foundation | Update Supabase Schema (Add cols to `profiles`) | 30m | SQL Migration |
| T2 | Foundation | Audit Build Errors (Console) | 1h | Fix Vercel warnings |
| T3 | Foundation | Add Arc Fitness Style Variables to Tailwind | 20m | `tailwind.config.js` |
| T4 | Onboarding | Create `pages/onboarding.js` Form | 45m | Form validation, Supabase update |
| T5 | Onboarding | Logic for redirecting new users | 15m | Check `user.created_at` or local flag |
| T6 | Calorie | Install `html5-qrcode` | 10m | `npm install` |
| T7 | Calorie | Build `components/CalorieScanner.js` | 1.5h | Camera UI, Barcode logic |
| T8 | Calorie | Implement OpenFoodFacts API fetch | 30m | Axios or Fetch |
| T9 | Dashboard | Install `recharts` | 10m | `npm install` |
| T10 | Dashboard | Fetch aggregate data in `pages/dashboard.js` | 1h | Supabase queries |
| T11 | Dashboard | Render Charts | 1h | Line/Bar rendering |
| T12 | Mobile | PWA Manifest (`public/manifest.json`) | 20m | Icons, Theme color |
| T13 | Mobile | Capacitor Init (`npx cap init`) | 15m | Config file only |
| T14 | QC | Run `npm run build` | 10m | Final check |

**Total Estimated Time:** ~8.5 Hours

---

## 4. DELIVERABLES

By the end of this phase, you will have:

1.  **A live, bug-free web app** at `arctivate-repo.vercel.app`.
2.  **A fully functional onboarding flow** collecting Name, Age, Weight, Goals.
3.  **A working Calorie Scanner** using the device camera.
4.  **A Dashboard** with visual progress charts.
5.  **PWA capabilities** (installable on mobile home screen).
6.  **Capacitor configuration** ready for `npx cap add android`.

---

## 5. RISKS & DEPENDENCIES

*   **Risk:** Camera permissions on iOS/Safari can be tricky with iframe/Capacitor.
*   **Mitigation:** Test strictly on physical devices during QA.
*   **Dependency:** OpenFoodFacts API availability/reliability.
*   **Fallback:** Allow manual entry of calories if scan fails.

---

**Approval Required:**
Master, please review this plan. Confirm if we should proceed with JavaScript (current codebase) or refactor to TypeScript during the migration (adds ~2hrs overhead).