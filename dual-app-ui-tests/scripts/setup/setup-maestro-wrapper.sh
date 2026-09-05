#!/bin/bash

###############################################################################
# Setup Maestro Wrapper Function
# Adds a maestro wrapper function to ~/.zshrc or ~/.bashrc
# Allows using 'maestro test' with automatic report generation
#
# Usage:
#   ./setup-maestro-wrapper.sh           # Interactive mode
#   ./setup-maestro-wrapper.sh --auto    # Auto mode (sets up both if available)
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check for auto mode flag
AUTO_MODE=false
if [ "$1" = "--auto" ] || [ "$1" = "-a" ]; then
  AUTO_MODE=true
fi

if [ "$AUTO_MODE" = false ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║        Setup Maestro Wrapper Function                      ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
fi

# Detect available shell config files
CURRENT_SHELL=$(basename "$SHELL")
if [ "$AUTO_MODE" = false ]; then
  echo "Current shell: $CURRENT_SHELL"
  echo ""
fi

# Check which config files exist
HAS_ZSHRC=false
HAS_BASHRC=false
[ -f "$HOME/.zshrc" ] && HAS_ZSHRC=true
[ -f "$HOME/.bashrc" ] && HAS_BASHRC=true

# Determine which files to update
SHELL_RC_FILES=()

if $HAS_ZSHRC && $HAS_BASHRC; then
  if [ "$AUTO_MODE" = true ]; then
    # Auto mode: set up both config files
    SHELL_RC_FILES=("$HOME/.zshrc" "$HOME/.bashrc")
  else
    # Interactive mode: ask user
    echo -e "${YELLOW}Found both ~/.zshrc and ~/.bashrc${NC}"
    echo ""
    echo "Which config file(s) should be updated?"
    echo "  1) Both (recommended if you use both shells)"
    echo "  2) ~/.zshrc only"
    echo "  3) ~/.bashrc only"
    echo "  4) Current shell only ($CURRENT_SHELL)"
    echo ""
    read -p "Enter choice [1-4]: " choice
    echo ""

    case $choice in
      1)
        SHELL_RC_FILES=("$HOME/.zshrc" "$HOME/.bashrc")
        ;;
      2)
        SHELL_RC_FILES=("$HOME/.zshrc")
        ;;
      3)
        SHELL_RC_FILES=("$HOME/.bashrc")
        ;;
      4)
        if [[ "$CURRENT_SHELL" == "zsh" ]]; then
          SHELL_RC_FILES=("$HOME/.zshrc")
        elif [[ "$CURRENT_SHELL" == "bash" ]]; then
          SHELL_RC_FILES=("$HOME/.bashrc")
        else
          SHELL_RC_FILES=("$HOME/.zshrc")
        fi
        ;;
      *)
        echo -e "${YELLOW}Invalid choice, defaulting to both${NC}"
        SHELL_RC_FILES=("$HOME/.zshrc" "$HOME/.bashrc")
        ;;
    esac
  fi
elif $HAS_ZSHRC; then
  SHELL_RC_FILES=("$HOME/.zshrc")
  [ "$AUTO_MODE" = false ] && echo "Using ~/.zshrc"
elif $HAS_BASHRC; then
  SHELL_RC_FILES=("$HOME/.bashrc")
  [ "$AUTO_MODE" = false ] && echo "Using ~/.bashrc"
else
  # No config files exist, create based on current shell
  if [[ "$CURRENT_SHELL" == "zsh" ]]; then
    SHELL_RC_FILES=("$HOME/.zshrc")
  elif [[ "$CURRENT_SHELL" == "bash" ]]; then
    SHELL_RC_FILES=("$HOME/.bashrc")
  else
    SHELL_RC_FILES=("$HOME/.bashrc")
  fi

  if [ "$AUTO_MODE" = false ]; then
    echo -e "${YELLOW}⚠️  No shell config file found${NC}"
    echo "Creating ${SHELL_RC_FILES[0]}..."
  fi
  touch "${SHELL_RC_FILES[0]}"
  [ "$AUTO_MODE" = false ] && echo -e "${GREEN}✓ Created ${SHELL_RC_FILES[0]}${NC}"
fi

if [ "$AUTO_MODE" = false ]; then
  echo ""
fi

# Check if wrapper already exists in any of the target files
ALREADY_CONFIGURED=()
NEEDS_UPDATE=()

for config_file in "${SHELL_RC_FILES[@]}"; do
  if grep -q "maestro_wrapper_function" "$config_file"; then
    ALREADY_CONFIGURED+=("$config_file")
  else
    NEEDS_UPDATE+=("$config_file")
  fi
done

# If all files already have the wrapper, exit
if [ ${#NEEDS_UPDATE[@]} -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Maestro wrapper already configured in all selected files${NC}"
  echo ""
  for config_file in "${ALREADY_CONFIGURED[@]}"; do
    echo "  - $config_file"
  done
  echo ""
  echo "To use it, restart your terminal or run:"
  for config_file in "${ALREADY_CONFIGURED[@]}"; do
    echo "  source $config_file"
  done
  echo ""
  exit 0
fi

# If some files already have it, notify user
if [ ${#ALREADY_CONFIGURED[@]} -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Maestro wrapper already configured in:${NC}"
  for config_file in "${ALREADY_CONFIGURED[@]}"; do
    echo "  - $config_file"
  done
  echo ""
  echo "Will update only:"
  for config_file in "${NEEDS_UPDATE[@]}"; do
    echo "  - $config_file"
  done
  echo ""
fi

# Create wrapper function
WRAPPER_FUNCTION='
# Maestro Test Wrapper Function
# Automatically uses enhanced test runner with report generation
maestro_wrapper_function() {
  # Get the project root by looking for .maestro directory
  local project_root="$(pwd)"
  while [ "$project_root" != "/" ] && [ ! -d "$project_root/.maestro" ]; do
    project_root="$(dirname "$project_root")"
  done
  
  if [ ! -d "$project_root/.maestro" ]; then
    echo "Error: .maestro directory not found in current or parent directories"
    return 1
  fi
  
  # Check if this is a test command
  if [ "$1" = "test" ]; then
    # Use the consolidated test runner
    bash "$project_root/scripts/testing/test.sh" "${@:2}"
    return $?
  else
    # For non-test commands, use original maestro
    ~/.maestro/bin/maestro-original "$@"
    return $?
  fi
}

# Create alias for maestro that uses the wrapper function
alias maestro=maestro_wrapper_function
'

# Add wrapper to shell config files
for config_file in "${NEEDS_UPDATE[@]}"; do
  echo "" >> "$config_file"
  echo "# Maestro Test Wrapper - Consolidated Test Runner" >> "$config_file"
  echo "$WRAPPER_FUNCTION" >> "$config_file"
  echo -e "${GREEN}✓ Maestro wrapper added to $config_file${NC}"
done

echo ""
echo "To activate, restart your terminal or run:"
for config_file in "${NEEDS_UPDATE[@]}"; do
  echo "  source $config_file"
done
echo ""
echo "Then you can use:"
echo ""
echo "  # Single test"
echo "  maestro test .maestro/flows/Account/test_login.yaml"
echo ""
echo "  # Test directory"
echo "  maestro test .maestro/flows/Account/ --platform android"
echo ""
echo "  # Suite file (auto-detected and runs with per-test reporting)"
echo "  maestro test .maestro/flows/suites/test_suite_account.yaml"
echo ""
echo "Suite files are automatically detected and executed with:"
echo "  - Per-test pass/fail status"
echo "  - Individual test duration tracking"
echo "  - Beautiful HTML report with summary"
echo ""
echo "For other maestro commands, the original maestro binary is used."
echo ""
