# Homescreen Feature Requirements

## Overview
The Homescreen is the primary landing screen for the CVS Health app, displaying personalized content including activity updates, health services, savings, and discovery content. It features a splitview design with Health & Pharmacy and Shop tabs.

## Key User Flows
- **Guest User**: View homescreen with discovery content and sign-in prompts
- **Authenticated User**: View personalized activity, prescriptions, appointments, and rewards
- **Splitview Navigation**: Switch between Health & Pharmacy and Shop tabs
- **NBA Cards**: View and interact with Next Best Action cards (Priority, Activity, Discovery zones)
- **Refresh**: Pull-to-refresh to update homescreen content
- **Error Handling**: Display error banners and retry mechanisms

---

## Screen Objects

### File Location
- **Primary**: `.maestro/screens/Home/homescreenObjects.js`
- **Supporting**: `.maestro/screens/SearchAndNav/searchNavObjects.js` (for bottom navigation)

### Key Element Groups

#### Error States
```javascript
output.homescreen_error = {
    somethingWentWrong: ".*Something went wrong.*",
    notConnectedText: ".*Not connected to the internet.*"
}
```

#### Splitview Tabs & Tooltips
```javascript
output.homescreen_splitview = {
    tab_shop: "Shop tab.*",
    tab_health_and_pharmacy: "Health & Pharmacy tab.*",
    tooltip_health_and_pharmacy_title: "Review your health updates.*",
    tooltip_shop_title: "Find the products you need.*"
}
```

#### Activity Zone (ANBAs - Action Next Best Actions)
```javascript
output.homescreen_activity = {
    activityHeader: "Activity.*",
    // Prescription statuses
    anba_availableForRefill: "Available for refill",
    anba_availableForRenewal: "Available for renewal",
    anba_wereWorkingOnIt: "We're working on it",
    anba_ready: "Ready",
    anba_delayed: "Delayed",
    anba_readyForPickup: "Ready for pickup",
    anba_notFilled: ".*Not filled.*",
    // Actions
    anba_bonusRewardBtn: "Your bonus reward",
    anba_messagePhysician: "Message a physician.*",
    anba_enrollInTextAlerts: "Enroll in text alerts.*"
}
```

#### Business Units
```javascript
output.homescreen_businessunit = {
    savingsAndRewardsText: "Savings & rewards"
}

output.homescreen_counsel = {
    title: "Unlimited access to real providers in minutes",
    messagePhysicianBtn: "Message a Counsel physician",
    businessUnitCta: "Request a Care consult"
}

output.homescreen_pharmacy = {
    header: "At the Pharmacy",
    viewAllPrescriptions: "View all prescriptions",
    reviewRxOrders: "Review Rx orders",
    updateDataAccess: "Update data access"
}

output.homescreen_healthServices = {
    healthServices: "Health services.*",
    exploreCareOptions: "Explore care options.*",
    scheduleFluShot: "Schedule a flu shot.*"
}

output.homescreen_extracare = {
    ecPlusHeader: "ExtraCare Plus™ Savings",
    savingsAndRewardsHeader: "Savings & rewards",
    shopNow: "Shop now",
    viewAllRewards: "View all rewards"
}
```

#### Discovery Zone (DNBAs - Discovery Next Best Actions)
```javascript
output.homescreen_discover = {
    discoverHeader: "Discover.*",
    tenExtraBucksReward: ".*10 ExtraBucks Rewards.*",
    photoDeals: ".*photo products*.*",
    scheduleFluShot: ".*Schedule your fall flu shot today.*"
}
```

#### App Rating Component
```javascript
output.homescreen_appRating = {
    header: "Healthier happens together®",
    subheader: "Enjoying the CVS Health app?",
    thumbsUp: "Love it!",
    thumbsDown: "Not quite"
}
```

### Element Naming Convention
- Prefix: `homescreen_` for all homescreen elements
- Group by zone/section: `activity`, `discover`, `splitview`, `pharmacy`, `healthServices`, `extracare`
- Use descriptive names: `anba_availableForRefill`, `tab_health_and_pharmacy`

---

## Test Data Requirements

### Required Test Users

#### Guest User (No Authentication)
```javascript
// No test data needed - use app without signing in
// Used for: HS-0.1.0, HS-23.0.0
```

#### LOA2 (Authenticated User with Rx Data)
```javascript
LOA2: {
    email: 'senior.usavior@gmail.com',
    dob: "09011956",
    password: 'Nextgen@8888',
    loa: 2,
    hasCvsAccount: true
}
// Used for: HS-0.1.1, HS-17.1.0, HS-2.x.0 (ANBA tests)
```

#### ReadyRx (User with Ready Prescriptions)
```javascript
ReadyRx: {
    firstName: 'MAYFLOWERS',
    lastName: 'DUR',
    dob: '01011990',
    phoneNumber: '3022570612',
    email: 'mayflowers@qa2.com',
    password: 'Retail@4321',
    hasCvsAccount: true,
    ephData: [{ rxc: true }],
    rx: [
        { name: "Carbamazepine 200 Mg Tablet", status: "Ready for Pickup" },
        { name: "Lipistart Powder", status: "Ready" }
    ]
}
// Used for: HS-2.13.0, HS-2.16.0
```

#### RxWithPriorityCards (User with Priority NBAs)
```javascript
RxWithPriorityCards: {
    firstName: 'Almond',
    lastName: 'Book',
    dob: '01011990',
    phoneNumber: '4846498151',
    email: 'almond@qa2.com',
    password: 'Password@1234',
    hasCvsAccount: true,
    ephData: [{ rxc: true }],
    rx: [
        { name: "Trulicity 0.75 Mg/0.5 Ml Pen", status: "Not filled" }
    ]
}
// Used for: HS-2.1.0 (Priority not filled)
```

#### WERE_WORKING_ON_IT_NBA (User with "Working on it" Status)
```javascript
WERE_WORKING_ON_IT_NBA: {
    firstName: 'Spring',
    lastName: 'PE',
    dob: '09091990',
    phoneNumber: '484-649-8151',
    email: 'spring.pe@qa2.com',
    password: 'Common@123',
    hasCvsAccount: true
}
// Used for: HS-2.12.0
```

#### DELAYED_NBA (User with Delayed Prescriptions)
```javascript
DELAYED_NBA: {
    firstName: 'Winter',
    lastName: 'PE',
    dob: '09091990',
    phoneNumber: '484-649-8151',
    email: 'Winter.pe@qa2.com',
    password: 'Common@123',
    hasCvsAccount: true
}
// Used for: HS-2.15.0
```

### Loading Test Data in Tests
```yaml
- runScript:
    file: ../../testdata/users_qa.js
    env:
      loginData: LOA2  # or ReadyRx, RxWithPriorityCards, etc.
```

---

## Common Subflows

### Available Subflows

#### Core Verification
```yaml
# .maestro/subflows/Home/homescreen_loaded_successful.yaml
# Verifies homescreen loaded successfully with bottom nav and discovery content
- runFlow: ../../subflows/Home/homescreen_loaded_successful.yaml
```

#### Discovery NBA Verification
```yaml
# .maestro/subflows/Home/discover_nba_loaded.yaml
# Verifies discovery zone NBA cards loaded
- runFlow: ../../subflows/Home/discover_nba_loaded.yaml
```

### Usage Pattern
```yaml
# Example: Verify homescreen after sign-in
- runFlow: ../../subflows/Account/complete_signin_and_otp_dob.yaml
- runFlow: ../../subflows/SearchAndNav/bottom_nav_loaded.yaml
- runFlow: ../../subflows/Home/homescreen_loaded_successful.yaml
```

---

## Business Rules & Validations

### 1. Homescreen Loading
**Rule**: Homescreen must load within 10 seconds with all core zones visible
- Bottom navigation bar must be present
- Discovery zone header must be visible
- No "Something went wrong" error should appear

**Validation**:
```yaml
- extendedWaitUntil:
    visible: ${output.homescreen_discover.discoverHeader}
    timeout: 10000
- assertNotVisible: ${output.homescreen_error.somethingWentWrong}
```

### 2. Activity Zone (ANBA) Display Rules
**Rule**: Activity zone displays based on user's prescription/appointment status
- **Priority NBAs**: Urgent actions (Not filled, Delayed) appear first
- **Action NBAs**: Standard actions (Available for refill, Ready for pickup)
- **Discovery NBAs**: Personalized recommendations

**Prescription Status Mapping**:
| Status | Display Text | User Action |
|--------|-------------|-------------|
| Not filled | "Not filled" | Review and provide info |
| Delayed | "Delayed" | Review order details |
| Ready for pickup | "Ready for pickup" | Pick up at pharmacy |
| Ready | "Ready" | Pick up at pharmacy |
| Available for refill | "Available for refill" | Review and refill |
| Available for renewal | "Available for renewal" | Review and renew |
| We're working on it | "We're working on it" | Check back later |

### 3. Splitview Tab Rules
**Rule**: Health & Pharmacy tab is default; Shop tab shows retail content
- **Health & Pharmacy Tab**: Shows Rx activity, appointments, health services
- **Shop Tab**: Shows shopping deals, ExtraCare rewards, product recommendations
- Tab state persists during session
- Content updates when switching tabs

**Validation**:
```yaml
# Verify Health tab is default
- assertVisible: ${output.homescreen_splitview.tab_health_and_pharmacy}

# Switch to Shop tab
- tapOn: ${output.homescreen_splitview.tab_shop}
- assertVisible: ${output.homescreen_extracare.savingsAndRewardsHeader}
```

### 4. Error Handling Rules
**Rule**: Display error banner when API fails; allow retry
- Show "Something went wrong" banner
- Provide refresh/retry option
- Cache previous content when possible
- Graceful degradation for partial failures

**Validation**:
```yaml
# Disconnect internet
- runFlow: ../../subflows/common/disable_network.yaml

# Verify error banner
- assertVisible: ${output.homescreen_error.notConnectedText}

# Reconnect and refresh
- runFlow: ../../subflows/common/enable_network.yaml
- scroll  # Pull to refresh
- assertNotVisible: ${output.homescreen_error.notConnectedText}
```

### 5. App Rating Component Rules
**Rule**: Display app rating prompt after certain user interactions
- Shows "Healthier happens together®" header
- Provides "Love it!" and "Not quite" options
- Appears conditionally based on user engagement
- Dismissible by user

### 6. Business Unit Display Rules
**Rule**: Business units display based on user eligibility and feature flags
- **Counsel Health**: Shows for eligible users with care consult access
- **At the Pharmacy**: Shows for Rx-tied users
- **Health Services**: Shows vaccine and appointment scheduling options
- **ExtraCare**: Shows for ExtraCare members with rewards/deals

---

## Known Issues & Edge Cases

### Edge Cases to Test

#### 1. Empty States
- **No Activity**: User with no prescriptions or appointments
  - Display discovery content only
  - Show "Start shopping to earn rewards" message

- **No Internet**: User launches app offline
  - Display cached content if available
  - Show "Not connected to the internet" banner
  - Allow retry when connection restored

#### 2. Multiple Prescription Statuses
- **User with mixed statuses**: Some ready, some delayed, some not filled
  - Priority NBAs appear first (Not filled, Delayed)
  - Action NBAs appear second (Ready, Available for refill)
  - Prescription count shows total: "3 prescriptions"

#### 3. Guest vs Authenticated Experience
- **Guest User**: Limited content
  - Discovery zone only
  - Sign-in prompts in place of activity
  - Generic health services and shop content

- **Authenticated User**: Personalized content
  - Activity zone with Rx/appointment updates
  - Personalized discovery recommendations
  - ExtraCare rewards and deals

#### 4. Splitview Tab Switching
- **Content Loading**: Switching tabs triggers new API calls
  - Show loading state during switch
  - Preserve scroll position within tab
  - Cache tab content for quick switching

#### 5. KSMI (Keep Me Signed In)
- **Session Persistence**: User remains signed in across app sessions
  - Login state persists when app is closed or backgrounded
  - Automatically obtains new session token upon relaunch
  - Session lasts for 30 days (current implementation)
  - User doesn't need to re-authenticate within the 30-day window
  - After 30 days, user must sign in again

### Platform Differences

#### iOS vs Android
- **Date Picker**: iOS uses native picker, Android uses custom component
- **Pull-to-Refresh**: iOS uses native gesture, Android may vary
- **Bottom Navigation**: iOS uses tab bar, Android uses bottom nav bar
- **Animations**: Loading animations may differ slightly

#### Element Selectors
```javascript
// Platform-specific elements in homescreenObjects.js
const __isIOS = maestro.platform.toLowerCase() === 'ios';

// Most homescreen elements are platform-agnostic
// Use same text/labels for both platforms
```

---

## Test Coverage Matrix

### Smoke Tests (Critical Path)
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| HS-0.1.0 | Homescreen loads (Guest) | `HS-0.1.0_smoke_homescreen_loads_successfully_guest.yaml` | Guest | ✅ |
| HS-0.1.1 | Homescreen loads (Signed in) | `HS-0.1.1_smoke_homescreen_loads_successfully_signed_in.yaml` | LOA2 | ✅ |
| HS-23.0.0 | Splitview loads (Guest) | `HS-23.0.0_smoke_homescreen_splitview_loads_successfully_guest.yaml` | Guest | ✅ |
| HS-23.1.0 | Splitview Health tab | `HS-23.1.0_smoke_homescreen_splitview_health.yaml` | LOA2 | ✅ |
| HS-23.1.1 | Splitview Shop tab | `HS-23.1.1_smoke_homescreen_splitview_shop.yaml` | LOA2 | ✅ |

### Activity NBA Tests (ANBAs)
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| HS-2.0.0 | Activity component loads | `HS-2.0.0-ANBA_activity_component_loads.yaml` | LOA2 | ✅ |
| HS-2.1.0 | Priority: Not filled | `HS-2.1.0_ANBA_priority_not_filled.yaml` | RxWithPriorityCards | ✅ |
| HS-2.12.0 | Working on it (DUR) | `HS-2.12.0_ANBA_working_on_it_dur.yaml` | WERE_WORKING_ON_IT_NBA | ✅ |
| HS-2.13.0 | Ready for pickup (DUR) | `HS-2.13.0_ANBA_ready_for_pickup_dur.yaml` | ReadyRx | ✅ |
| HS-2.14.0 | Available for renewal | `HS-2.14.0_ANBA_available_for_renewal.yaml` | availableForRenewal | ✅ |
| HS-2.15.0 | Delayed | `HS-2.15.0_ANBA_delayed.yaml` | DELAYED_NBA | ✅ |
| HS-2.16.0 | Ready | `HS-2.16.0_ANBA_ready.yaml` | ReadyRx | ✅ |

### Discovery NBA Tests (DNBAs)
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| HS-3.0.0 | Discovery loads (Guest) | `HS-3.0.0_discovery_loads_successfully_guest.yaml` | Guest | ✅ |
| HS-3.1.0 | ExtraCare Plus navigation | `HS-3.1.0_DNBA_extracare_plus_navigation.yaml` | LOA2 | ✅ |
| HS-3.3.0 | Photo deals navigation | `HS-3.3.0_DNBA_photo_deals_navigation_guest.yaml` | Guest | ✅ |

### Business Unit Tests
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| HS-9.0.0 | Counsel Health displayed | `HS-9.0.0_BU_counsel_health_displayed.yaml` | LOA2 | ✅ |
| HS-9.1.0 | Counsel Health bottom sheet | `HS-9.1.0_BU_counsel_health_bottom_sheet.yaml` | LOA2 | ✅ |
| HS-9.2.0 | Counsel Health navigation | `HS-9.2.0_BU_counsel_health_navigation.yaml` | LOA2 | ✅ |
| HS-11.0.0 | Health services loaded | `HS-11.0.0_Health_services_loaded.yaml` | LOA2 | ✅ |
| HS-16.0.0 | Shop essentials BU | `HS-16.0.0_homescreen_bu_shop_essentials.yaml` | LOA2 | ✅ |
| HS-17.1.0 | RxP view prescriptions | `HS-17.1.0_BU_rxp_module_view_prescription_navigation.yaml` | LOA2 | ✅ |
| HS-18.0.0 | ExtraCare savings BU | `HS-18.0.0_BU_extracare_savings.yaml` | LOA2 | ✅ |

### Error Handling & Edge Cases
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| HS-0.2.0 | No internet banner | `HS-0.2.0_smoke_homescreen_no_internet_banner.yaml` | Guest | ✅ |
| HS-0.3.0 | Reconnect internet | `HS-0.3.0_smoke_reconnect_internet.yaml` | Guest | ✅ |
| HS-0.4.0 | Relaunch with KSMI | `HS-0.4.0_smoke_relaunch_with_ksmi.yaml` | Guest | ✅ |
| HS-0.6.0 | Swipe down refresh | `HS-0.6.0_smoke_swipe_down_refreshes_homescreen.yaml` | LOA2 | ✅ |
| HS-24.0.0 | App rating component | `HS-24.0.0_smoke_homescreen_app_rating_component.yaml` | LOA2 | ✅ |

---

## Related Documentation

### Jira Tickets
- **TLSADES-103**: Runway - Homepage with Action zones
- **PA1-3453354615**: Mobile Architecture SuperApp NBAs Homescreen
- **PA1-4887775017**: SPLIT NBA - Homescreen Technical document
- **PA1-4876271659**: Home Screen - Segmentation and API Changes

### Confluence Pages
- [Mobile Architecture SuperApp NBAs Homescreen](https://cvsdigital.atlassian.net/wiki/spaces/PA1/pages/3453354615)
- [SPLIT NBA - Homescreen Technical document](https://cvsdigital.atlassian.net/wiki/spaces/PA1/pages/4887775017)
- [Home Screen - Segmentation and API Changes](https://cvsdigital.atlassian.net/wiki/spaces/PA1/pages/4876271659)

### API Endpoints & Architecture

#### Personalization Engine APIs
All NBAs (Next Best Actions) and Business Units are driven by the Personalization Engine (PE):

**Activity NBAs (Health Tab)**
- **Endpoint**: `https://www-qa2.cvs.com/apix/client/experience/v2/load/27071ebc-ecb9-4983-9594-4f4a6bfa70f0?frn=SegmentedHomeHealth`
- **Dependencies**: 
  - Pharmacy backend (for Rx prescriptions)
  - Account services (Caregiving, Rx connect status, Caremark status, Specialty status, Counsel)
- **Returns**: Priority and Action NBAs based on user's health data

**Activity NBAs (Shop Tab)**
- **Endpoint**: `https://www-qa2.cvs.com/apix/client/experience/v2/load/0a1b0845-a6b6-4820-9096-34a5278fdb4c?frn=SegmentedHomeShop`
- **Dependencies**:
  - Loyalty services
  - ExtraCare membership
  - Shop backend
- **Returns**: Shopping-related NBAs and personalized deals

**Discovery NBAs**
- **Endpoint**: `https://www.cvs.com/apix/client/experience/v2/load/8465766c-0155-4c81-94d0-1193c5a1961c?frn=SegmentedHomeDiscovery`
- **Returns**: Personalized discovery recommendations (cached daily)

#### Business Units (BU)
- **Source**: Returned from Personalization Engine
- **Purpose**: Determines ranking and order of content cards
- **Configuration**: Can be enabled/disabled in AEM (Adobe Experience Manager)

#### AEM Configuration
All NBAs and Business Units can be configured in Adobe Experience Manager to:
- Enable/disable specific cards
- Control card visibility by user segment
- Adjust ranking and ordering
- Manage feature flags

**User Segments** (determines personalized content):

| User Segment | AEM Segment ID | Description | Key Modules |
|--------------|----------------|-------------|-------------|
| `guest` | `segment_guest` | Unauthenticated user | Discovery NBAs, Loyalty, Health, Shop |
| `guest + EC` | `segment_guest_extracare` | Guest with ExtraCare | Priority, Activity, Discovery NBAs, Loyalty, Pharmacy |
| `guest + EC plus` | `segment_guest_extracareplus` | Guest with ExtraCare Plus | Activity, Discovery NBAs, Loyalty, Health Insights |
| `user (LOA1)` | `segment_user` | Authenticated user (LOA1) | Priority, Activity, Discovery NBAs, Counsel, Insurance |
| `user + EC` | `segment_user_extracare` | Authenticated + ExtraCare | Priority, Activity, Discovery NBAs, Loyalty, Pharmacy |
| `user + ECplus` | `segment_user_extracareplus` | Authenticated + ExtraCare Plus | Priority, Activity, Discovery NBAs, Counsel, Pharmacy |
| `user + rxtie` | `segment_user_rx` | Authenticated + Rx tied | Priority, Activity, Discovery NBAs, Pharmacy (Rx tied) |
| `user + rxtie + ec` | `segment_user_extracare_rx` | Authenticated + Rx + ExtraCare | Priority, Activity, Discovery NBAs, Loyalty, Pharmacy (Rx tied) |
| `user + rxtie + EC plus` | `segment_user_extracareplus_rx` | Authenticated + Rx + ExtraCare Plus | Priority, Activity, Discovery NBAs, Loyalty, Pharmacy (Rx tied) |

**Module Categories by Segment:**

Each segment receives a specific set of modules from AEM in ranked order:

- **Priority NBAs** (`priority_user`) - Urgent actions requiring immediate attention (only for authenticated users)
  - ⚠️ **Note:** Priority NBAs are configured in AEM but are **not currently handled in the app code implementation**. These can be ignored for testing purposes until the feature is implemented.
- **Activity NBAs** - Recent user activity and personalized actions:
  - `activity_guest_extracare`, `activity_guest_extracareplus`
  - `activity_user`, `activity_user_extracare`, `activity_user_extracareplus`
  - `activity_user_rxtied`, `activity_user_extracare_rxtied`, `activity_user_extracareplus_rxtied`
- **Discovery NBAs** - Personalized recommendations:
  - `discovery_guest`, `discovery_guest_ectied`, `discovery_guest_ecplus`
  - `discovery_user`, `discovery_user_ec`, `discovery_user_ecplus`
  - `discovery_user_rxtied`, `discovery_user_ec_rxtied`, `discovery_user_ecplus_rxtied`
- **Business Units** - Feature modules:
  - `hs_counsel` - Counsel Health module
  - `hs_loyalty` - Loyalty/ExtraCare module
  - `hs_savings_and_rewards` - Savings and rewards module
  - `hs_health` - Health services module
  - `hs_health_insights` - Health insights module
  - `hs_insurance_benefits` - Insurance and benefits module
  - `hs_pharmacy` - Pharmacy module
  - `hs_phmarcy_rx_tied` - Pharmacy module (Rx tied variant)
  - `hs_shop` - Shop module
  - `hs_buy_it_again` - Buy it again product shelf
  - `hs_trending_now` - Trending products shelf
  - `hs_gam_banner` - Google Ad Manager banner
  - `hs_marketing` - Marketing module
  - `hs_osh` - Oak Street Health module

These segments determine which NBAs and Business Units are returned from the Personalization Engine based on the user's authentication status, loyalty membership, and Rx connection status.

#### AEM Data Validation
**AEM GraphQL Endpoint**: `https://str-cmsservices.cvshealth.com/graphql/execute.json/superapp/get-home-24-08-06`

Before running homescreen tests, you can validate which NBAs are expected for a given user segment by calling the AEM GraphQL API. This helps ensure:
- The correct NBAs are configured in AEM for the user segment
- Business Units are enabled/disabled as expected
- Card ranking and ordering matches requirements

**Validation Workflow**:
1. Identify the user segment being tested (e.g., `user + rxtie + EC plus`)
2. Call the AEM GraphQL API to retrieve configured NBAs for that segment
3. Compare expected NBAs from AEM with actual NBAs returned by Personalization Engine
4. Run Maestro tests to verify UI displays the correct NBAs

**Example Usage in Test Setup**:
```yaml
# Optional: Add API validation step before UI tests
# This can be done in test setup or as a separate validation script
# to confirm AEM configuration matches test expectations
```

---

## Test Creation Guidelines

### Creating New Homescreen Tests

1. **Identify the feature/component** to test (ANBA, DNBA, Business Unit, etc.)

2. **Select appropriate test user** based on required data:
   - Guest for unauthenticated flows
   - LOA2 for general authenticated flows
   - Specific users (ReadyRx, RxWithPriorityCards) for prescription-specific tests

3. **Load required screenObjects** in `onFlowStart`:
   ```yaml
   onFlowStart:
     - runScript: ../../screens/Home/homescreenObjects.js
     - runScript: ../../screens/SearchAndNav/searchNavObjects.js
   ```

4. **Use existing subflows** for common actions:
   - `launchApp.yaml` - Launch app
   - `complete_signin_and_otp_dob.yaml` - Sign in
   - `homescreen_loaded_successful.yaml` - Verify homescreen loaded

5. **Follow naming convention**: `HS-{ID}.{SUB}.{VER}_{category}_{description}.yaml`
   - Example: `HS-2.1.0_ANBA_priority_not_filled.yaml`

6. **Add appropriate tags**:
   - `homescreen` - All homescreen tests
   - `smoke` - Critical path tests
   - `anba` / `dnba` - Activity/Discovery NBAs
   - `splitview` - Splitview-specific tests
   - `regression` - Regression suite tests

### Example Test Structure
```yaml
appId: ${APP_NAME}
tags:
  - homescreen
  - anba
  - smoke
onFlowStart:
  - runScript: ../../screens/Home/homescreenObjects.js
  - runScript: ../../screens/SearchAndNav/searchNavObjects.js
  - runScript:
      file: ../../testdata/users_qa.js
      env:
        loginData: ReadyRx
---
# Launch app and sign in
- runFlow: ../../subflows/common/launchApp.yaml
- tapOn: ${output.account_onboarding.letsGetStartedBtn}
- runFlow: ../../subflows/Account/complete_signin_and_otp_dob.yaml

# Verify homescreen loaded
- runFlow: ../../subflows/Home/homescreen_loaded_successful.yaml

# Verify specific ANBA card
- assertVisible: ${output.homescreen_activity.anba_ready}
- assertVisible: ${output.homescreen_activity.subtext_pickupAtText}
```

---

**Last Updated**: February 27, 2026  
**Maintained By**: QA Automation Team  
**Framework**: Maestro UI Tests
