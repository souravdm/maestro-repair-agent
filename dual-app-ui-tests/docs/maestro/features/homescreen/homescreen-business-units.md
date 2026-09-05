# Homescreen Business Units (BUs)

## Overview

Business Units are **feature modules** that provide access to major CVS services and business lines. Unlike Activity NBAs (action-driven) and Discovery NBAs (recommendation-driven), Business Units are **persistent navigation hubs** to key services. BU visibility and content are controlled by LaunchDarkly flags, user eligibility, AEM configuration, and real-time API calls to service backends.

---

## Architecture & Data Sources

### 1. LaunchDarkly Feature Flags
Controls which business units are enabled per user segment and environment:
- **Flag naming**: `homescreen_bu_*` (e.g., `homescreen_bu_counsel`, `homescreen_bu_pharmacy`)
- **Scope**: User segment, environment (qa/prod), percentage rollout
- **Impact**: If flag is OFF, the BU module is completely hidden

### 2. User Eligibility & Profile Data
Determines which BUs are available to the user:
- **Counsel**: Virtual care eligibility (age, location, insurance)
- **Pharmacy**: RxConnect link status, pharmacy preference
- **Health Services**: Location-based availability (vaccine, flu shot, health screening)
- **ExtraCare**: Membership status (member, non-member, Plus tier)
- **Oakstreet**: Primary care clinic network availability
- **Shop Essentials**: Available to all users

### 3. AEM Configuration (Adobe Experience Manager)
Defines the **BU module structure** and **ordering** per user segment:
- **Segments**: Guest, LOA1, LOA2, RxTie, ExtraCare, ExtraCare Plus, etc.
- **Module types**:
  - **Counsel Health**: Virtual care / telemedicine
  - **At the Pharmacy**: Prescription management, pharmacy locator
  - **Health Services**: Vaccines, health screenings, appointments
  - **ExtraCare Savings**: Rewards, deals, loyalty
  - **Shop Essentials**: Health & wellness products
  - **Oakstreet Health**: Primary care clinics
- **Rank/Order**: Determines BU display sequence
- **Visibility rules**: Which BUs appear for which segments

### 4. Business Unit Backend APIs
Real-time API calls to populate BU content:

#### Counsel API
- **Endpoint**: `/api/counsel/availability`
- **Parameters**: User age, location, insurance
- **Data**: Provider availability, wait times, specialties
- **Used for**: Counsel Health BU card

#### Pharmacy API (RxP)
- **Endpoint**: `/api/pharmacy/prescriptions` + `/api/pharmacy/locator`
- **Parameters**: User location, pharmacy preference
- **Data**: Prescription count, nearest CVS locations, hours
- **Used for**: At the Pharmacy BU card

#### Immunization Service (IMZ)
- **Endpoint**: `/api/immunization/availability`
- **Parameters**: User age, location, vaccine type
- **Data**: Vaccine availability, appointment slots, eligibility
- **Used for**: Health Services BU card

#### Loyalty API
- **Endpoint**: `/api/loyalty/extracare/status`
- **Parameters**: Member ID (if authenticated)
- **Data**: Membership tier, points balance, exclusive offers
- **Used for**: ExtraCare Savings BU card

#### Shop API
- **Endpoint**: `/api/shop/categories`
- **Parameters**: User location, preferences
- **Data**: Featured products, deals, categories
- **Used for**: Shop Essentials BU card

#### Oakstreet API
- **Endpoint**: `/api/oakstreet/clinics`
- **Parameters**: User location, insurance
- **Data**: Clinic locations, appointment availability, providers
- **Used for**: Oakstreet Health BU card

---

## Display Logic

### Conditional Rendering

```
For All Users (Guest & Authenticated):
  1. Check LaunchDarkly flags for each BU enabled
  2. Query AEM for user's segment configuration
  3. For each BU module in AEM config:
     a. Check if BU is enabled for this segment
     b. Check user eligibility for this BU
     c. Call corresponding BU API to get content
     d. If API returns data, render BU card
     e. If API fails or user ineligible, skip BU (graceful degradation)
  4. Display BUs in AEM-defined order
  5. Show loading states during API calls
  6. Show error banners if critical API fails
```

### Fallback Behavior
- **API timeout** (>10s): Skip BU, show next BU
- **API error (4xx/5xx)**: Log error, skip BU, continue
- **User ineligible**: BU not displayed (not an error state)
- **All APIs fail**: Show "Something went wrong" banner with retry option
- **Guest user**: Show only guest-eligible BUs (Shop, Health Services)
- **Authenticated user**: Show all eligible BUs based on profile

---

## Business Unit Details

### 1. Counsel Health
**Purpose**: Virtual care / telemedicine access

**Eligibility**:
- Available to users 18+
- Requires valid insurance or payment method
- Location-based availability

**Content**:
- "Unlimited access to real providers in minutes"
- "Message a Counsel physician" button
- "Request a Care consult" CTA
- Provider specialties, wait times

**API**: `/api/counsel/availability`

**Screen Objects**:
```javascript
output.homescreen_counsel = {
  title: "Unlimited access to real providers in minutes",
  messagePhysicianBtn: "Message a Counsel physician",
  businessUnitCta: "Request a Care consult",
  providerSpecialties: ".*Specialist.*",
  waitTime: ".*minutes.*wait"
}
```

### 2. At the Pharmacy
**Purpose**: Prescription management and pharmacy locator

**Eligibility**:
- Available to RxTie users (linked to RxConnect)
- Available to all users (pharmacy locator)

**Content**:
- "View all prescriptions" link
- "Review Rx orders" section
- "Update data access" option
- Nearest CVS locations, hours, services

**API**: `/api/pharmacy/prescriptions` + `/api/pharmacy/locator`

**Screen Objects**:
```javascript
output.homescreen_pharmacy = {
  header: "At the Pharmacy",
  viewAllPrescriptions: "View all prescriptions",
  reviewRxOrders: "Review Rx orders",
  updateDataAccess: "Update data access",
  nearestPharmacy: "Nearest CVS|Find a pharmacy",
  pharmacyHours: ".*Hours.*"
}
```

### 3. Health Services
**Purpose**: Vaccines, health screenings, appointments

**Eligibility**:
- Available to all users (guest & authenticated)
- Location-based availability

**Content**:
- "Health services" header
- "Explore care options" link
- "Schedule a flu shot" CTA
- Available services, appointment slots

**API**: `/api/immunization/availability`

**Screen Objects**:
```javascript
output.homescreen_healthServices = {
  healthServices: "Health services.*",
  exploreCareOptions: "Explore care options.*",
  scheduleFluShot: "Schedule a flu shot.*",
  availableServices: ".*Vaccine.*|.*Screening.*",
  appointmentSlots: ".*Available.*|.*Book now.*"
}
```

### 4. ExtraCare Savings
**Purpose**: Loyalty rewards, deals, member benefits

**Eligibility**:
- Available to all users
- Enhanced content for ExtraCare members

**Content**:
- "ExtraCare Plus™ Savings" header (for Plus members)
- "Savings & rewards" section
- "Shop now" CTA
- "View all rewards" link
- Points balance, exclusive offers

**API**: `/api/loyalty/extracare/status`

**Screen Objects**:
```javascript
output.homescreen_extracare = {
  ecPlusHeader: "ExtraCare Plus™ Savings",
  savingsAndRewardsHeader: "Savings & rewards",
  shopNow: "Shop now",
  viewAllRewards: "View all rewards",
  pointsBalance: ".*Points.*|.*Balance.*",
  exclusiveOffers: ".*Exclusive.*|.*Member.*"
}
```

### 5. Shop Essentials
**Purpose**: Health & wellness product shopping

**Eligibility**:
- Available to all users (guest & authenticated)

**Content**:
- "Shop essentials" header
- Featured product categories
- "Shop now" CTA
- Deals and promotions

**API**: `/api/shop/categories`

**Screen Objects**:
```javascript
output.homescreen_shopEssentials = {
  header: "Shop Essentials|Health & Wellness",
  shopNow: "Shop now",
  featuredCategories: ".*Vitamins.*|.*Health.*|.*Wellness.*",
  deals: ".*Deal.*|.*Save.*"
}
```

### 6. Oakstreet Health
**Purpose**: Primary care clinic network access

**Eligibility**:
- Location-based availability
- Insurance verification required

**Content**:
- "Find primary care" header
- Clinic locations, hours
- "Book appointment" CTA
- Provider information

**API**: `/api/oakstreet/clinics`

**Screen Objects**:
```javascript
output.homescreen_oakstreet = {
  header: "Primary Care|Find Care",
  clinicLocations: ".*Clinic.*|.*Location.*",
  bookAppointment: "Book appointment|Schedule visit",
  providerInfo: ".*Provider.*|.*Doctor.*"
}
```

---

## Business Rules & Validations

### Rule 1: BU Visibility Follows AEM Configuration
- **Condition**: BU is enabled in AEM for user's segment
- **Validation**: Inspect BU presence in hierarchy capture

### Rule 2: Eligibility Gating
- **Condition**: User meets eligibility criteria for BU
- **Behavior**: BU is displayed; otherwise hidden
- **Validation**: 
  ```yaml
  # Counsel requires age 18+
  - runFlow: ../../subflows/account/complete_signin_and_otp_dob.yaml
  - assertVisible: ${output.homescreen_counsel.title}
  ```

### Rule 3: API Failure Graceful Degradation
- **Condition**: BU API fails or times out
- **Behavior**: BU is skipped, next BU displayed
- **Validation**: 
  ```yaml
  - runFlow: ../../subflows/common/disable_network.yaml
  - assertNotVisible: ${output.homescreen_counsel.title}  # BU hidden
  - runFlow: ../../subflows/common/enable_network.yaml
  - assertVisible: ${output.homescreen_counsel.title}  # BU reloads
  ```

### Rule 4: LaunchDarkly Flag Respect
- **Condition**: Feature flag is OFF for user
- **Behavior**: BU is completely hidden
- **Validation**: Requires flag override in test environment

### Rule 5: Guest vs Authenticated Content
- **Condition**: User is guest or authenticated
- **Behavior**: Guest sees limited BUs; authenticated sees all eligible BUs
- **Validation**: 
  ```yaml
  # Guest user
  - tapOn: ${output.account_onboarding.continueAsGuestBtn}
  - assertVisible: ${output.homescreen_healthServices.header}
  - assertNotVisible: ${output.homescreen_pharmacy.header}
  ```

---

## Common Subflows

### Business Units Verification
```yaml
# .maestro/subflows/Home/business_units_loaded.yaml
- assertVisible: ${output.homescreen_counsel.title}
- assertVisible: ${output.homescreen_pharmacy.header}
- assertVisible: ${output.homescreen_healthServices.header}
```

### Click Business Unit
```yaml
# .maestro/subflows/Home/click_business_unit.yaml
- tapOn: ${output.homescreen_counsel.messagePhysicianBtn}
- extendedWaitUntil:
    visible: "Counsel|Virtual care|Provider"
    timeout: 5000
```

---

## Known Issues & Edge Cases

### 1. Eligibility Check Lag
- **Issue**: User eligibility changes but BU still hidden
- **Cause**: Eligibility cache not invalidated
- **Mitigation**: Refresh eligibility on app launch

### 2. API Timeout Cascades
- **Issue**: One slow BU API delays entire homescreen load
- **Mitigation**: Parallel API calls with individual timeouts (10s each)
- **Test**: Simulate slow network with Maestro `delay` command

### 3. Location-Based Unavailability
- **Issue**: User in unsupported location, BU unavailable
- **Cause**: Health Services, Counsel, Oakstreet have regional limits
- **Mitigation**: Show "Not available in your area" message

### 4. Insurance Verification Failure
- **Issue**: Insurance verification fails, Counsel/Oakstreet unavailable
- **Cause**: Insurance API timeout or invalid coverage
- **Mitigation**: Show "Verify insurance" CTA instead of BU

### 5. RxConnect Link Status Mismatch
- **Issue**: User profile says RxTie=true but Pharmacy API returns no data
- **Cause**: Data sync delay between systems
- **Mitigation**: Show "Pharmacy" BU but with empty state

---

## Test Coverage Matrix

| Test ID | Scenario | User Type | Expected BU | Status |
|---------|----------|-----------|-------------|--------|
| HS-9.0.0 | Counsel Health displayed | LOA2 | Counsel visible | ✅ |
| HS-9.1.0 | Counsel Health bottom sheet | LOA2 | Counsel details visible | ✅ |
| HS-9.2.0 | Counsel Health navigation | LOA2 | Counsel clickable | ✅ |
| HS-11.0.0 | Health services loaded | All | Health Services visible | ✅ |
| HS-16.0.0 | Shop essentials BU | All | Shop visible | ✅ |
| HS-17.1.0 | Pharmacy BU view prescriptions | RxTie | Pharmacy visible | ✅ |
| HS-18.0.0 | ExtraCare savings BU | LOA2 | ExtraCare visible | ✅ |

---

## Related Documentation
- [Homescreen Feature Overview](../homescreen.md)
- [Activity Zone (ANBAs)](./homescreen-activity-zone.md)
- [Discovery NBAs (DNBAs)](./homescreen-discover-nbas.md)
- [AEM NBA Configuration](../aem-nba-config.md)
- [Counsel Integration](../../counsel/counsel-integration.md)
- [Pharmacy Integration](../../pharmacy/pharmacy-integration.md)
