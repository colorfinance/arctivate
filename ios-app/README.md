# Arctivate iOS App

Native SwiftUI iOS application for Arctivate - a gamified fitness and habit tracking platform.

## Requirements

- Xcode 15.0+
- iOS 17.0+
- Swift 5.9+

## Setup

1. Open the project in Xcode:
   ```bash
   cd ios-app/Arctivate
   open Package.swift
   ```

2. Configure environment:
   - Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the scheme environment variables
   - Set `API_BASE_URL` to your Vercel deployment URL

3. Build and run on simulator or device

## Architecture

- **SwiftUI** with iOS 17+ features
- **@Observable** macro for ViewModels
- **Supabase Swift SDK** for backend
- **async/await** for all async operations

## Project Structure

```
Sources/
├── App/           - App entry point
├── Theme/         - Colors, typography, spacing
├── Models/        - Data models (Codable structs)
├── Services/      - Supabase & API services
├── ViewModels/    - Observable view models
└── Views/         - SwiftUI views
    ├── Auth/      - Login/signup
    ├── Train/     - Workout logging
    ├── Food/      - Nutrition tracking
    ├── Habits/    - Habit tracking
    ├── Coach/     - AI coach chat
    ├── Feed/      - Social feed
    ├── Profile/   - User profile
    └── Onboarding/- First-time setup
```

## Features

- Workout logging with PB detection and points
- Food scanning via camera + manual entry
- Daily habit tracking with streak system
- AI coaching powered by Gemini
- Social feed with high-fives
- QR code scanning for rewards
- Gamification with points and challenges
