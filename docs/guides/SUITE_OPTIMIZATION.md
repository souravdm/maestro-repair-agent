# Suite Execution Optimization

## Problem: Double App Launch in Suites

When running test suites, app launches happen multiple times:
1. **Suite level**: `launchApp` with `clearState: true` at the top
2. **Flow level**: Each flow calls `launchAndSetup.yaml` which does `clearState` + `launchApp` again

**Performance Impact**: For a 5-flow suite, this adds **50-75 seconds** of wasted time (10-15 seconds per redundant launch).

## Solution: Use setupWithoutLaunch.yaml for Suites

### Option 1: Optimized Suite Pattern (Recommended)

Use `setupWithoutLaunch.yaml` which handles onboarding screens WITHOUT launching the app:

```yaml
appId: ${APP_ID}
---
# Launch app ONCE at suite level
- launchApp:
    appId: ${APP_ID}
    clearState: true

# Handle onboarding without re-launching
- runFlow:
    file: ../../subflows/Common/setupWithoutLaunch.yaml

# Now manually run test logic (without calling launchAndSetup)
- runScript: ../../screens/Common/CommonScreen.js
- assertVisible: ${HOME_TAB}
- assertVisible: ${PHARMACY_TAB}
# ... rest of test assertions
```

**Pros:**
- ✅ No double launches
- ✅ Fastest suite execution
- ✅ Complete control over flow

**Cons:**
- ⚠️ Requires inlining test logic instead of calling flow files  
- ⚠️ More maintenance (can't just call existing flows)

### Option 2: Accept Double Launch (Default)

Keep suites simple and accept the trade-off:

```yaml
appId: ${APP_ID}
---
# Each flow handles its own launch (works standalone too)
- runFlow:
    file: ../../flows/Account/H100_ACCT_TC010_loginAndLogout.yaml

- runFlow:
    file: ../../flows/Shop/H100_SHOP_TC014_searchAndAddProductsToCart.yaml
```

**Pros:**
- ✅ Simple - just list flows
- ✅ Individual flows remain independent
- ✅ No maintenance overhead

**Cons:**
- ⚠️ Redundant app launches (adds ~30-50 seconds to suite time)
- ⚠️ Each flow clears state independently

### Option 3: Create Suite-Optimized Flow Variants

Create parallel versions of flows without `launchAndSetup.yaml`:

```
.maestro/flows/Account/
├── H100_ACCT_TC010_loginAndLogout.yaml           # Standalone (calls launchAndSetup)
└── suite/
    └── H100_ACCT_TC010_loginAndLogout.yaml       # Suite version (no launch)
```

**Pros:**
- ✅ Best of both worlds
- ✅ Reusable test logic

**Cons:**
- ⚠️ Double maintenance (two versions of each flow)
- ⚠️ Risk of drift between versions

## Current Implementation

**Current Status**: Option 2 (Accept Double Launch)

- Individual flows call `launchAndSetup.yaml` (always launches)
- Suites call individual flows directly
- Works correctly, just slower for suites

## Files

- `.maestro/subflows/Common/launchAndSetup.yaml` - Standard launch + onboarding (always launches)
- `.maestro/subflows/Common/setupWithoutLaunch.yaml` - Onboarding only (for optimized suites)

## Why Automatic Detection Doesn't Work

We attempted to automatically detect suite execution and skip redundant launches, but hit Maestro limitations:

1. **Environment variables don't propagate**: Env vars set at suite level (`env: MAESTRO_SUITE_MODE: true`) don't reach subflows
2. **Limited conditionals**: Maestro's `when:` only supports `visible:` / `notVisible:` UI checks, not boolean logic
3. **No file system access**: Maestro's JavaScript runtime doesn't have Node.js modules like `fs`
4. **No global state**: Can't share state between flows in a suite

## Recommendation

- **For CI/CD critical path suites**: Use Option 1 (Optimized Pattern) to save time
- **For ad-hoc testing**: Use Option 2 (Default) for simplicity
- **For large regression suites**: Consider Option 3 (Variants) if time savings justify maintenance

## Performance Comparison

**5-Flow Suite Example:**

| Pattern | Launch Time | Total Time | Savings |
|---------|-------------|------------|---------|
| Option 1 (Optimized) | 10s (1x launch) | ~2 min | Baseline |
| Option 2 (Default) | 60s (6x launches) | ~2.5 min | -50s |
| Standalone flows | 50s (5x launches) | ~2.5 min | N/A |

**Time per launch:**
- iOS: ~10-12 seconds
- Android: ~8-10 seconds

## See Also

- `launchAndSetup.yaml` - Standard launch subflow
- `setupWithoutLaunch.yaml` - Optimized suite helper
- Test suite examples in `.maestro/flows/suites/`
