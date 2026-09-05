# Homescreen Activity Zone

## Overview

The Activity Zone displays personalized action cards for **authenticated users only**. Card visibility and content are determined by a multi-layered system of feature flags, user profile data, backend configuration, and real-time API calls to multiple services.

---

## Architecture & Data Sources

### 1. LaunchDarkly Feature Flags
Controls which activity cards are enabled/disabled per user segment and environment:
- **Flag naming**: `homescreen_activity_*` (e.g., `homescreen_activity_anba_enabled`)
- **Scope**: User segment, environment (qa/prod), percentage rollout
- **Impact**: If flag is OFF, the entire card or card section is hidden from the UI

### 2. User Profile Data
Retrieved during login/session initialization from the backend:
- **Orders**: Purchase history, pending orders, delivery status
- **Linked SSKs (Specialty Pharmacy Systems)**:
  - **RxConnect**: Retail pharmacy prescriptions (CVS/Walgreens)
  - **Specialty**: Specialty pharmacy medications (complex/high-cost drugs)
  - **Caremark**: PBM (Pharmacy Benefit Manager) claims and coverage
  - **Counsel**: Virtual care/telemedicine eligibility
  - **Oakstreet**: Primary care/clinic integration
- **Eligibility flags**: Determines which business units and services are available

### 3. AEM Configuration (Adobe Experience Manager)
Defines the **module structure** and **card ordering** per user segment:
- **Segments**: Guest, LOA1, LOA2, RxTie, ExtraCare, ExtraCare Plus, etc.
- **Module types**:
  - Priority NBAs (urgent actions: not filled, delayed prescriptions)
  - Activity NBAs (standard actions: ready for pickup, available for refill)
  - Discovery NBAs (personalized recommendations)
  - Business Units (Counsel, Pharmacy, Health Services, ExtraCare)
- **Rank/Order**: Determines card display sequence on the homescreen
- **Visibility rules**: Which modules appear for which segments

### 4. Personalization Engine Backend
Makes real-time API calls to acquire data for card display:

#### Pharmacy Service (RxP)
- **Endpoint**: `/api/pharmacy/prescriptions`
- **Data**: Prescription status (ready, not filled, delayed, available for refill, available for renewal)
- **Used for**: Prescription action cards (ANBAs)

#### Immunization Service (IMZ)
- **Endpoint**: `/api/immunization/schedule`
- **Data**: Vaccine eligibility, upcoming appointments, flu shot reminders
- **Used for**: Vaccine scheduling cards

#### Minute Clinic (MC)
- **Endpoint**: `/api/minuteclinic/availability`
- **Data**: Clinic locations, appointment availability, wait times
- **Used for**: Find Care / Book Appointment cards

#### Pharmacy Locator Service (PLSS)
- **Endpoint**: `/api/pharmacy/locator`
- **Data**: Nearest CVS locations, hours, services available
- **Used for**: Pharmacy location cards

#### Additional Services
- **Counsel API**: Virtual care availability, provider schedules
- **Benefits API**: Insurance claims, coverage details
- **Loyalty API**: ExtraCare rewards, points balance

---

## Display Logic

### Conditional Rendering

```
For Authenticated Users:
  1. Check LaunchDarkly flags for activity zone enabled
  2. Fetch user profile data (SSK links, eligibility)
  3. Query AEM for user's segment configuration
  4. For each module in AEM config:
     a. Check if module is enabled for this segment
     b. Call corresponding backend API (Pharmacy, IMZ, MC, PLSS, etc.)
     c. If API returns data, render card
     d. If API fails or no data, skip card (graceful degradation)
  5. Display cards in AEM-defined order
  6. Show loading states during API calls
  7. Show error banners if critical API fails
```

### Fallback Behavior
- **API timeout** (>10s): Skip card, show next card
- **API error (4xx/5xx)**: Log error, skip card, continue
- **No data returned**: Card not displayed (not an error state)
- **All APIs fail**: Show "Something went wrong" banner with retry option

---

## Test Data Requirements

### User Segments for Testing

#### LOA2 (Authenticated, No Rx Tie)
- Profile: Basic user, no pharmacy data
- Expected cards: Counsel, Health Services, Discovery only
- Test file: `users_qa.js` → `LOA2`

#### RxTie User (Authenticated + Pharmacy)
- Profile: Linked to RxConnect (retail pharmacy)
- Expected cards: Prescription ANBAs, Pharmacy, Counsel, Health Services
- Test file: `users_qa.js` → `ReadyRx`, `RxWithPriorityCards`

#### Specialty Pharmacy User
- Profile: Linked to Specialty SSK
- Expected cards: Specialty Rx ANBAs, Counsel, Health Services
- Test file: Custom test data (if available)

#### ExtraCare Plus User
- Profile: Linked to ExtraCare Plus membership
- Expected cards: All ANBAs, ExtraCare rewards, Discovery
- Test file: Custom test data (if available)

---

## Screen Objects

### File Location
- **Primary**: `.maestro/screens/Home/homescreenObjects.js`
- **Supporting**: `.maestro/screens/SearchAndNav/searchNavObjects.js`

### Activity Zone Elements
```javascript
output.homescreen_activity = {
  // Zone header
  activityHeader: "Activity.*",
  
  // Priority NBAs (urgent)
  pnba_notFilled: ".*Not filled.*",
  pnba_delayed: ".*Delayed.*",
  
  // Action NBAs (standard)
  anba_availableForRefill: "Available for refill",
  anba_availableForRenewal: "Available for renewal",
  anba_readyForPickup: "Ready for pickup",
  anba_ready: "Ready",
  anba_wereWorkingOnIt: "We're working on it",
  
  // Action buttons
  anba_bonusRewardBtn: "Your bonus reward",
  anba_messagePhysician: "Message a physician.*",
  anba_enrollInTextAlerts: "Enroll in text alerts.*"
}
```

---

## Business Rules & Validations

### Rule 1: Activity Zone Only for Authenticated Users
- **Condition**: User must be signed in (LOA2 or higher)
- **Validation**: 
  ```yaml
  - runFlow: ../../subflows/account/complete_signin_and_otp_dob.yaml
  - assertVisible: ${output.homescreen_activity.activityHeader}
  ```

### Rule 2: Card Order Follows AEM Configuration
- **Condition**: Cards display in rank order from AEM
- **Expected order**: Priority NBAs → Activity NBAs → Business Units → Discovery
- **Validation**: Inspect card order in hierarchy capture

### Rule 3: Prescription Status Mapping
| Status | Display Text | Source | Action |
|--------|-------------|--------|--------|
| Not filled | "Not filled" | Pharmacy API | Review & provide info |
| Delayed | "Delayed" | Pharmacy API | Review order details |
| Ready for pickup | "Ready for pickup" | Pharmacy API | Pick up at pharmacy |
| Ready | "Ready" | Pharmacy API | Pick up at pharmacy |
| Available for refill | "Available for refill" | Pharmacy API | Review & refill |
| Available for renewal | "Available for renewal" | Pharmacy API | Review & renew |
| We're working on it | "We're working on it" | Pharmacy API | Check back later |

### Rule 4: API Failure Graceful Degradation
- **Condition**: One or more backend APIs fail
- **Behavior**: Skip failed card, show remaining cards
- **Validation**: 
  ```yaml
  # Simulate API failure (network disconnect)
  - runFlow: ../../subflows/common/disable_network.yaml
  - assertVisible: ${output.homescreen_activity.activityHeader}  # Zone still visible
  - runFlow: ../../subflows/common/enable_network.yaml
  - assertVisible: ${output.homescreen_activity.anba_availableForRefill}  # Cards reload
  ```

### Rule 5: LaunchDarkly Flag Respect
- **Condition**: Feature flag is OFF for user
- **Behavior**: Activity zone is completely hidden
- **Validation**: Requires flag override in test environment

---

## Common Subflows

### Activity Zone Verification
```yaml
# .maestro/subflows/Home/activity_zone_loaded.yaml
- assertVisible: ${output.homescreen_activity.activityHeader}
- assertVisible: ${output.homescreen_activity.anba_availableForRefill}
```

### Click ANBA Card
```yaml
# .maestro/subflows/Home/click_anba_card.yaml
- tapOn: ${output.homescreen_activity.anba_availableForRefill}
- extendedWaitUntil:
    visible: "Prescription details"
    timeout: 5000
```

---

## Known Issues & Edge Cases

### 1. API Timeout Cascades
- **Issue**: If Pharmacy API is slow, entire activity zone delays
- **Mitigation**: Backend implements 3s timeout per API, shows partial results
- **Test**: Simulate slow network with Maestro `delay` command

### 2. SSK Link Mismatch
- **Issue**: User profile says RxTie=true but Pharmacy API returns no prescriptions
- **Cause**: Data sync delay between systems (typically <5min)
- **Mitigation**: Activity zone shows empty state, not error

### 3. AEM Segment Not Found
- **Issue**: User's segment is not configured in AEM
- **Behavior**: Fallback to "guest" segment configuration
- **Mitigation**: Ensure all user segments are configured in AEM

### 4. LaunchDarkly Offline
- **Issue**: LD service unavailable, flags cannot be fetched
- **Behavior**: Default to "off" for all new flags (safe default)
- **Mitigation**: Use cached flag values from previous session

---

## Test Coverage Matrix

| Test ID | Scenario | User Type | Expected Cards | Status |
|---------|----------|-----------|----------------|--------|
| HS-2.0.0 | Activity zone loads | LOA2 | Activity header visible | ✅ |
| HS-2.1.0 | Priority: Not filled | RxTie | Not filled card visible | ✅ |
| HS-2.13.0 | Ready for pickup | RxTie | Ready for pickup card visible | ✅ |
| HS-2.14.0 | Available for renewal | RxTie | Renewal card visible | ✅ |
| HS-2.15.0 | Delayed prescription | RxTie | Delayed card visible | ✅ |
| HS-2.16.0 | Ready prescription | RxTie | Ready card visible | ✅ |

---

## Related Documentation
- [Homescreen Feature Overview](../homescreen.md)
- [AEM NBA Configuration](../aem-nba-config.md)
- [Pharmacy Integration](../../pharmacy/pharmacy-integration.md)
- [LaunchDarkly Feature Flags](../../configuration/launchdarkly-flags.md)
