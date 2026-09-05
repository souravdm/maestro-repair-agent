#!/bin/bash

# Clean Android Emulator Storage
# Frees up space by clearing cache and temporary files

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Android Emulator Storage Cleanup                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if emulator is running
if ! adb devices | grep -q "emulator"; then
  echo -e "${RED}❌ No Android emulator detected${NC}"
  echo "Please start the emulator first"
  exit 1
fi

echo -e "${BLUE}📊 Current storage usage:${NC}"
adb shell df -h /data | grep -E "Filesystem|/data"
echo ""

echo -e "${BLUE}🧹 Cleaning up...${NC}"
echo ""

# 1. Clear app caches
echo "1️⃣  Clearing app caches..."
CACHE_CLEARED=0
for package in $(adb shell pm list packages | cut -d: -f2); do
  if adb shell pm clear-cache "$package" 2>/dev/null; then
    ((CACHE_CLEARED++))
  fi
done
echo -e "${GREEN}   ✓ Cleared cache for $CACHE_CLEARED apps${NC}"

# 2. Clear logcat buffer
echo "2️⃣  Clearing logcat buffer..."
adb logcat -c 2>/dev/null || true
echo -e "${GREEN}   ✓ Logcat buffer cleared${NC}"

# 3. Clear temporary files
echo "3️⃣  Clearing temporary files..."
adb shell "rm -rf /data/local/tmp/*" 2>/dev/null || true
echo -e "${GREEN}   ✓ Temporary files cleared${NC}"

# 4. Clear download cache
echo "4️⃣  Clearing download cache..."
adb shell "rm -rf /sdcard/Download/*" 2>/dev/null || true
echo -e "${GREEN}   ✓ Download cache cleared${NC}"

# 5. Uninstall old Maestro driver apps (if any)
echo "5️⃣  Removing old Maestro driver apps..."
MAESTRO_APPS=$(adb shell pm list packages | grep -E "maestro|xcuitest" | cut -d: -f2 || echo "")
if [ -n "$MAESTRO_APPS" ]; then
  for app in $MAESTRO_APPS; do
    echo "   Uninstalling $app..."
    adb uninstall "$app" 2>/dev/null || true
  done
  echo -e "${GREEN}   ✓ Old Maestro apps removed${NC}"
else
  echo -e "${YELLOW}   ℹ  No old Maestro apps found${NC}"
fi

echo ""
echo -e "${BLUE}📊 Storage after cleanup:${NC}"
adb shell df -h /data | grep -E "Filesystem|/data"
echo ""

# Calculate freed space
BEFORE=$(adb shell df /data | tail -1 | awk '{print $4}')
echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo ""
echo -e "${YELLOW}💡 If still low on space, consider:${NC}"
echo "   1. Wiping emulator data: adb shell pm clear com.cvs.launchers.cvs"
echo "   2. Creating a new emulator with more storage"
echo "   3. Uninstalling unused apps from the emulator"
