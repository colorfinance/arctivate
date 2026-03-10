#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_step() { echo -e "\n${CYAN}${BOLD}[$1/$TOTAL_STEPS]${NC} ${BOLD}$2${NC}"; }
print_success() { echo -e "  ${GREEN}✓${NC} $1"; }
print_warning() { echo -e "  ${YELLOW}!${NC} $1"; }
print_error() { echo -e "  ${RED}✗${NC} $1"; }
print_info() { echo -e "  $1"; }

TOTAL_STEPS=7
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}   Arctivate — App Store Setup Wizard${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ─── Step 1: Check prerequisites ───
print_step 1 "Checking prerequisites..."

if ! command -v node &> /dev/null; then
  print_error "Node.js is not installed. Install it from https://nodejs.org"
  exit 1
fi
print_success "Node.js $(node -v)"

if ! command -v npx &> /dev/null; then
  print_error "npx not found. Install Node.js 18+ from https://nodejs.org"
  exit 1
fi
print_success "npx available"

if ! command -v eas &> /dev/null; then
  print_warning "EAS CLI not found. Installing..."
  npm install -g eas-cli
  print_success "EAS CLI installed"
else
  print_success "EAS CLI $(eas --version 2>/dev/null || echo 'installed')"
fi

# ─── Step 2: Expo login ───
print_step 2 "Expo account..."

if eas whoami &> /dev/null; then
  EXPO_USER=$(eas whoami 2>/dev/null)
  print_success "Logged in as: $EXPO_USER"
else
  print_info "You need an Expo account to build and submit your app."
  print_info "Create one free at: https://expo.dev/signup"
  echo ""
  eas login
  EXPO_USER=$(eas whoami 2>/dev/null)
  print_success "Logged in as: $EXPO_USER"
fi

# ─── Step 3: Install dependencies ───
print_step 3 "Installing dependencies..."

npm install --silent 2>&1 | tail -1
print_success "Dependencies installed"

# ─── Step 4: Initialize EAS project ───
print_step 4 "Setting up EAS project..."

# Check if EAS_PROJECT_ID is already set in .env
if [ -f .env ] && grep -q "^EAS_PROJECT_ID=" .env && ! grep -q "^EAS_PROJECT_ID=$" .env && ! grep -q "^EAS_PROJECT_ID=your-eas-project-id" .env; then
  print_success "EAS project already configured"
else
  print_info "Initializing EAS project..."
  EAS_OUTPUT=$(eas init 2>&1) || true
  echo "$EAS_OUTPUT"

  # Extract project ID from eas init output or from eas config
  PROJECT_ID=$(echo "$EAS_OUTPUT" | grep -oP '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)

  if [ -n "$PROJECT_ID" ]; then
    # Ensure .env exists
    if [ ! -f .env ] && [ -f .env.example ]; then
      cp .env.example .env
    elif [ ! -f .env ]; then
      touch .env
    fi
    # Write or update EAS_PROJECT_ID in .env
    if grep -q "^EAS_PROJECT_ID=" .env; then
      sed -i '' "s/^EAS_PROJECT_ID=.*/EAS_PROJECT_ID=$PROJECT_ID/" .env 2>/dev/null || \
      sed -i "s/^EAS_PROJECT_ID=.*/EAS_PROJECT_ID=$PROJECT_ID/" .env
    else
      echo "EAS_PROJECT_ID=$PROJECT_ID" >> .env
    fi
    export EAS_PROJECT_ID="$PROJECT_ID"
    print_success "EAS project initialized (ID: $PROJECT_ID)"
  else
    print_warning "Could not extract project ID. You may need to run 'eas init' manually."
    print_info "Then add EAS_PROJECT_ID=<your-project-id> to mobile/.env"
  fi
fi

# ─── Step 5: Environment variables ───
print_step 5 "Configuring environment variables..."

if [ ! -f .env ]; then
  cp .env.example .env
  print_warning "Created .env file from template"
fi

# Check if env vars are still placeholders
if grep -q "your-project.supabase.co" .env; then
  echo ""
  echo -e "  ${YELLOW}Your .env file needs real values. Open it and fill in:${NC}"
  echo ""
  echo -e "  ${BOLD}EXPO_PUBLIC_SUPABASE_URL${NC}"
  echo -e "    → Supabase Dashboard → Settings → API → Project URL"
  echo ""
  echo -e "  ${BOLD}EXPO_PUBLIC_SUPABASE_ANON_KEY${NC}"
  echo -e "    → Supabase Dashboard → Settings → API → anon/public key"
  echo ""
  echo -e "  ${BOLD}EXPO_PUBLIC_API_URL${NC}"
  echo -e "    → Your deployed Vercel URL (e.g. https://arctivate.vercel.app)"
  echo ""

  read -p "  Have you updated your .env file? (y/n): " ENV_READY
  if [ "$ENV_READY" != "y" ]; then
    echo ""
    print_info "Edit ${BOLD}mobile/.env${NC} with your values, then re-run this script."
    exit 0
  fi
else
  print_success "Environment variables configured"
fi

# ─── Step 6: Supabase deep linking reminder ───
print_step 6 "Supabase configuration..."

echo ""
echo -e "  ${YELLOW}ACTION REQUIRED:${NC} Add this redirect URL in Supabase:"
echo ""
echo -e "  ${BOLD}arctivate://auth${NC}"
echo ""
echo -e "  → Supabase Dashboard → Authentication → URL Configuration → Redirect URLs → Add"
echo ""
read -p "  Done? (y/n): " SUPA_READY

# ─── Step 7: Build! ───
print_step 7 "Ready to build!"

echo ""
echo -e "  ${GREEN}${BOLD}Setup complete!${NC} Choose what to do next:"
echo ""
echo -e "  ${BOLD}[1]${NC} Build for iOS simulator (fastest, for testing)"
echo -e "  ${BOLD}[2]${NC} Build preview for real devices (internal testing)"
echo -e "  ${BOLD}[3]${NC} Build production for App Store + Play Store"
echo -e "  ${BOLD}[4]${NC} Skip build for now"
echo ""
read -p "  Choose (1-4): " BUILD_CHOICE

case $BUILD_CHOICE in
  1)
    echo ""
    print_info "Building development client for iOS simulator..."
    eas build --profile development --platform ios
    echo ""
    print_success "Dev build started! Check https://expo.dev for status."
    print_info "Once built, run ${BOLD}npm run dev${NC} to connect."
    ;;
  2)
    echo ""
    print_info "Building preview for both platforms..."
    eas build --profile preview --platform all
    echo ""
    print_success "Preview build started! Check https://expo.dev for status."
    ;;
  3)
    echo ""
    print_info "Building production for both platforms..."
    eas build --profile production --platform all
    echo ""
    print_success "Production build started! Check https://expo.dev for status."
    echo ""
    echo -e "  ${BOLD}After the build completes, submit with:${NC}"
    echo -e "    iOS:     ${CYAN}npm run submit:ios${NC}"
    echo -e "    Android: ${CYAN}npm run submit:android${NC}"
    ;;
  4)
    echo ""
    print_info "No problem! When you're ready, run:"
    echo ""
    echo -e "    ${CYAN}npm run build:dev${NC}      ← test on simulator"
    echo -e "    ${CYAN}npm run build:preview${NC}  ← test on real devices"
    echo -e "    ${CYAN}npm run build:prod${NC}     ← App Store / Play Store"
    ;;
esac

echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}   Setup finished! Next steps:${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  1. Replace icons in ${BOLD}assets/${NC} with your final designs"
echo -e "  2. Take screenshots on simulator for store listings"
echo -e "  3. Fill in store listing details (see ${BOLD}STORE_LISTING.md${NC})"
echo -e "  4. Submit: ${CYAN}npm run submit:ios${NC} / ${CYAN}npm run submit:android${NC}"
echo ""
