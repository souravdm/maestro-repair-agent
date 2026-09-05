# POM Compliance Validator

## Overview
Automated validation tool to ensure all Maestro test files follow the Page Object Model (POM) pattern.

## POM Compliance Checklist

### Test File Requirements
- [ ] **Screen files loaded first**: Test must load screen files before `launchApp`
  - Pattern: `- runFlow: ../../screens/[Module]/[ScreenName].yaml`
  - Must appear before any other commands
  
- [ ] **Environment variables used**: All locators must use `${VARIABLE}` syntax
  - ✅ Correct: `- tapOn: ${SEARCH_FIELD}`
  - ❌ Incorrect: `- tapOn: "Search"`
  
- [ ] **Wait conditions added**: Tests must include `extendedWaitUntil` after launchApp
  - Pattern: `- extendedWaitUntil: visible: ${SCREEN_ELEMENT} timeout: 8000`
  - Timeout: 8000ms (8 seconds)
  
- [ ] **Tags present**: All tests must have tags for categorization
  - Smoke tests: `- smoke`
  - Regression tests: `- regression`
  - Module tags: `- [module-name]`
  
- [ ] **No hardcoded locators**: All UI interactions must use variables
  - ✅ Correct: `- assertVisible: ${ELEMENT}`
  - ❌ Incorrect: `- assertVisible: "Element Text"`

### Screen File Requirements
- [ ] **Default value syntax**: All environment variables use default syntax
  - Pattern: `${VAR:-"default_value"}`
  - Example: `SEARCH_FIELD: ${SEARCH_FIELD:-"id:search_input"}`
  
- [ ] **Consistent naming**: Variable names follow pattern
  - Format: `UPPERCASE_WITH_UNDERSCORES`
  - Example: `PHARMACY_DASHBOARD_TITLE`, `REFILL_PRESCRIPTIONS_BTN`
  
- [ ] **Documentation**: Each screen file has header comment
  - Include: Module name, screen purpose, variable descriptions

## Validation Script

```bash
#!/bin/bash

# POM Compliance Validator Script
# Usage: ./validate_pom.sh [test_file_or_directory]

ERRORS=0
WARNINGS=0

validate_test_file() {
    local file=$1
    local filename=$(basename "$file")
    
    echo "Validating: $filename"
    
    # Check 1: Screen files loaded first
    if ! grep -q "runFlow.*screens.*yaml" "$file"; then
        echo "  ❌ ERROR: No screen files loaded"
        ((ERRORS++))
    fi
    
    # Check 2: extendedWaitUntil present
    if ! grep -q "extendedWaitUntil" "$file"; then
        echo "  ⚠️  WARNING: No wait conditions found"
        ((WARNINGS++))
    fi
    
    # Check 3: No hardcoded text locators (basic check)
    if grep -q "- tapOn: \"[A-Z]" "$file" || grep -q "- assertVisible: \"[A-Z]" "$file"; then
        echo "  ⚠️  WARNING: Possible hardcoded locators detected"
        ((WARNINGS++))
    fi
    
    # Check 4: Tags present
    if ! grep -q "tags:" "$file"; then
        echo "  ❌ ERROR: No tags defined"
        ((ERRORS++))
    fi
}

validate_screen_file() {
    local file=$1
    local filename=$(basename "$file")
    
    echo "Validating Screen: $filename"
    
    # Check 1: Default value syntax
    if grep -q ":\s*\${[A-Z_]*}$" "$file"; then
        echo "  ❌ ERROR: Variables missing default value syntax"
        ((ERRORS++))
    fi
    
    # Check 2: Consistent naming
    if grep -q ":\s*\${[a-z]" "$file"; then
        echo "  ⚠️  WARNING: Lowercase variable names detected"
        ((WARNINGS++))
    fi
}

# Main validation
if [ -d "$1" ]; then
    echo "Validating directory: $1"
    find "$1" -name "test_*.yaml" | while read file; do
        validate_test_file "$file"
    done
    find "$1" -name "*Screen.yaml" | while read file; do
        validate_screen_file "$file"
    done
else
    validate_test_file "$1"
fi

echo ""
echo "Validation Summary:"
echo "  Errors: $ERRORS"
echo "  Warnings: $WARNINGS"

exit $ERRORS
```

## Compliance Report Template

### Module: [Module Name]
- **Total Tests**: X
- **Compliant**: X/X
- **Compliance %**: XX%

#### Non-Compliant Tests
- [ ] test_name.yaml - Issue description

#### Screen Files Status
- [ ] ScreenName.yaml - Status

## Automated Checks (CI/CD Integration)

### Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

# Validate POM compliance for changed test files
git diff --cached --name-only | grep "test_.*\.yaml" | while read file; do
    ./validate_pom.sh "$file" || exit 1
done
```

### GitHub Actions Workflow
```yaml
name: POM Compliance Check

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Validate POM Compliance
        run: |
          find . -name "test_*.yaml" -exec ./validate_pom.sh {} \;
```

## Remediation Guide

### Issue: Screen files not loaded first
**Fix**: Move screen file loading to top of test file, before launchApp
```yaml
# BEFORE
- launchApp
- runFlow: ../../.maestro/screens/Common/CommonScreen.yaml

# AFTER
- runFlow: ../../.maestro/screens/Common/CommonScreen.yaml
- launchApp
```

### Issue: Hardcoded locators used
**Fix**: Replace with environment variable references
```yaml
# BEFORE
- tapOn: "Search"
- assertVisible: "Results"

# AFTER
- tapOn: ${SEARCH_FIELD}
- assertVisible: ${RESULTS_TITLE}
```

### Issue: Missing wait conditions
**Fix**: Add extendedWaitUntil after launchApp
```yaml
- launchApp
- extendedWaitUntil:
    visible: ${SCREEN_ELEMENT}
    timeout: 8000
```

### Issue: Screen variables missing defaults
**Fix**: Add default value syntax
```yaml
# BEFORE
SEARCH_FIELD: ${SEARCH_FIELD}

# AFTER
SEARCH_FIELD: ${SEARCH_FIELD:-"id:search_input"}
```

## Compliance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Test Files Compliant | 100% | - |
| Screen Files Compliant | 100% | - |
| Screen File Loading | 100% | - |
| Wait Conditions | 100% | - |
| Variable Usage | 100% | - |
| Tags Coverage | 100% | - |

## Next Steps

1. Run validator on all test files
2. Generate compliance report
3. Create remediation tasks for non-compliant files
4. Integrate into CI/CD pipeline
5. Monitor compliance metrics over time
