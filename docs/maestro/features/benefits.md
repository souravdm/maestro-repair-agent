# Benefits Feature Requirements

> **📚 For comprehensive business context, feature evolution, and architecture details, see:**  
> [`BENEFITS_COMPLETE_KNOWLEDGE.md`](./BENEFITS_COMPLETE_KNOWLEDGE.md)

## Overview
The Benefits feature provides users with access to their health insurance information, coverage details, plan summaries, and claim history. It integrates with multiple insurance providers including Caremark, Aetna, and other health plans. The feature supports both authenticated users and caregivers managing dependent benefits.

## Key User Flows
- **View Plan Summary**: Display member ID, plan name, deductible, out-of-pocket max
- **Find Care Provider**: Search for in-network doctors and specialists
- **View Claims**: Access claim history and status
- **Manage Dependents**: View and manage benefits for family members (caregiver flow)
- **Compare Plans**: View plan options and coverage details
- **Access ID Card**: Digital ID card display and sharing
- **Contact Support**: Reach insurance provider support
- **Error Handling**: Display error states and retry mechanisms

---

## Screen Objects

### File Location
- **Primary**: `.maestro/screenObjects/benefitsObjects.js` (if exists) or use `commonObjects.js`
- **Supporting**: `.maestro/screens/SearchAndNav/searchNavObjects.js` (for navigation)

### Key Element Groups

#### Navigation & Headers
```javascript
output.benefits_navigation = {
    backBtn: "Back|<",
    benefitsTab: "Benefits.*",
    searchField: "Search.*",
    menuBtn: "Menu|≡"
}
```

#### Landing/Dashboard
```javascript
output.benefits_landing = {
    memberIdBtn: "Member ID|ID Card",
    memberIdDisplay: "Member ID:.*",
    caremarkLogo: "Caremark|Aetna|Insurance.*",
    planSummaryLabel: "Plan Summary|Coverage",
    planName: "Plan Name:.*",
    deductible: "Deductible:.*",
    outOfPocketMax: "Out of Pocket Max:.*"
}
```

#### Plan Details
```javascript
output.benefits_plan = {
    planDetailsHeader: "Plan Details|Coverage Details",
    deductibleAmount: "\\$[0-9,]+",
    copayAmount: "Copay:.*",
    coinsuranceAmount: "Coinsurance:.*",
    outOfNetworkCoverage: "Out of Network:.*",
    prescriptionCoverage: "Prescription Coverage|Pharmacy"
}
```

#### Claims
```javascript
output.benefits_claims = {
    claimsHeader: "Claims|Claim History",
    claimCard: "Claim.*",
    claimStatus: "Status:.*",
    claimAmount: "\\$[0-9,]+",
    claimDate: "Date:.*",
    viewClaimDetails: "View Details|Claim Details"
}
```

#### Provider Search
```javascript
output.benefits_provider = {
    providerSearchHeader: "Find Care|Search Providers",
    searchInput: "Search.*provider|doctor|specialist",
    providerCard: "Provider.*",
    providerName: ".*MD|.*DO",
    providerSpecialty: "Specialty:.*",
    providerDistance: "Distance:.*",
    providerRating: "Rating:.*"
}
```

#### ID Card
```javascript
output.benefits_idcard = {
    idCardHeader: "ID Card|Digital ID",
    memberId: "Member ID:.*",
    groupNumber: "Group Number:.*",
    planName: "Plan:.*",
    effectiveDate: "Effective:.*",
    shareBtn: "Share|Send",
    downloadBtn: "Download|Save"
}
```

#### Dependents/Caregiving
```javascript
output.benefits_dependents = {
    dependentsHeader: "Dependents|Family Members",
    addDependentBtn: "Add Dependent|Add Member",
    dependentCard: "Dependent.*",
    dependentName: "Name:.*",
    dependentRelationship: "Relationship:.*",
    manageDependentBtn: "Manage|View Details"
}
```

#### Error States
```javascript
output.benefits_error = {
    errorBanner: ".*Error.*|.*Something went wrong.*",
    noDataMessage: "No.*found|No.*available",
    retryBtn: "Retry|Try Again",
    contactSupportBtn: "Contact Support|Help"
}
```

### Element Naming Convention
- Prefix: `benefits_` for all benefits elements
- Group by section: `landing`, `plan`, `claims`, `provider`, `idcard`, `dependents`, `navigation`, `error`
- Use descriptive names: `memberIdBtn`, `planSummaryLabel`, `claimStatus`

---

## Test Data Requirements

### Required Test Users

#### LOA2 (Basic Authenticated User)
```javascript
LOA2: {
    email: 'senior.usavior@gmail.com',
    dob: "09011956",
    password: 'Nextgen@8888',
    loa: 2,
    hasCvsAccount: true
}
// Used for: Basic benefits navigation, plan summary viewing
```

#### QL_ONLY_3 (Caremark/Aetna User)
```javascript
QL_ONLY_3: {
    email: 'test.user@example.com',
    password: 'Password@123',
    hasCvsAccount: true,
    cmkId: '123456789',  // Caremark ID
    qlId: 'QL123456'     // Aetna/QL ID
}
// Used for: Caremark benefits, plan details, claims
```

#### LOA2_CAREGIVER (Caregiver with Dependents)
```javascript
LOA2_CAREGIVER: {
    email: 'dadone.savior@gmail.com',
    password: 'Nextgen*8888',
    firstName: 'Dadone',
    lastName: 'Savior',
    dob: '09041989',
    hasCvsAccount: true,
    caregivees: [
        {
            firstName: 'Cgiveetwo',
            lastName: 'Savior',
            dob: '09041989',
            relationship: 'Spouse'
        }
    ]
}
// Used for: Caregiver flows, dependent benefits management
```

#### PRADHI_THIDHI (User with Multiple Insurance Plans)
```javascript
PRADHI_THIDHI: {
    firstName: 'Pradhi',
    lastName: 'Thidhi',
    email: 'pradhi@qa2.com',
    password: 'Password@1234',
    hasCvsAccount: true,
    profileId: '527178562',
    rxcId: '2518002032',
    cmkId: '450799813',  // Caremark
    ecNumber: '4765181103990'
}
// Used for: Multi-plan benefits, Rx + Caremark integration
```

### Loading Test Data in Tests
```yaml
onFlowStart:
  - runScript: ../../screens/SearchAndNav/searchNavObjects.js
  - runScript:
      file: ../../testdata/users_qa.js
      env:
        loginData: QL_ONLY_3  # or LOA2_CAREGIVER, PRADHI_THIDHI, etc.
```

---

## Common Subflows

### Available Subflows

#### Benefits Navigation
```yaml
# .maestro/subflows/benefits/benefits_loaded_successful.yaml
# Verifies benefits screen loaded with plan summary visible
- runFlow: ../../subflows/benefits/benefits_loaded_successful.yaml
```

#### Plan Details View
```yaml
# .maestro/subflows/benefits/view_plan_details.yaml
# Opens plan details and verifies coverage information
- runFlow: ../../subflows/benefits/view_plan_details.yaml
```

#### ID Card Display
```yaml
# .maestro/subflows/benefits/view_id_card.yaml
# Opens and displays digital ID card
- runFlow: ../../subflows/benefits/view_id_card.yaml
```

### Usage Pattern
```yaml
# Example: View benefits and plan details
- runFlow: ../../subflows/common/launchApp.yaml
- runFlow: ../../subflows/account/complete_signin_and_otp_dob.yaml
- tapOn: ${output.common_navigation.benefitsTab}
- runFlow: ../../subflows/benefits/benefits_loaded_successful.yaml
- runFlow: ../../subflows/benefits/view_plan_details.yaml
```

---

## Business Rules & Validations

### 1. Benefits Landing Page Loading
**Rule**: Benefits page must load within 10 seconds with plan summary visible
- Member ID section must be present
- Plan summary with deductible and out-of-pocket max must display
- No "Something went wrong" error should appear
- Navigation tabs must be accessible

**Validation**:
```yaml
- extendedWaitUntil:
    visible: ${output.benefits_landing.planSummaryLabel}
    timeout: 10000
- assertVisible: ${output.benefits_landing.memberIdBtn}
- assertNotVisible: ${output.benefits_error.errorBanner}
```

### 2. Plan Summary Display Rules
**Rule**: Display accurate plan information based on user's insurance
- **Caremark Users**: Show Caremark plan details, deductible, copays
- **Aetna Users**: Show Aetna plan details, coverage tiers
- **Multiple Plans**: Show primary plan by default, allow switching
- **No Plan**: Show "No active plan" message with contact support option

**Plan Information Display**:
| Field | Display Format | Required |
|-------|---|---|
| Member ID | "Member ID: 123456789" | ✅ |
| Plan Name | "Plan Name: [Plan Name]" | ✅ |
| Deductible | "Deductible: $1,500" | ✅ |
| Out of Pocket Max | "Out of Pocket Max: $5,000" | ✅ |
| Copay | "Copay: $25" | ⚠️ Plan-dependent |
| Coinsurance | "Coinsurance: 20%" | ⚠️ Plan-dependent |

### 3. ID Card Display Rules
**Rule**: Digital ID card shows all required information
- Member ID clearly visible
- Group number displayed
- Plan name and effective date shown
- Share and download options available
- Works offline (cached)

**Validation**:
```yaml
- tapOn: ${output.benefits_landing.memberIdBtn}
- assertVisible: ${output.benefits_idcard.memberId}
- assertVisible: ${output.benefits_idcard.groupNumber}
- assertVisible: ${output.benefits_idcard.shareBtn}
```

### 4. Claims History Display Rules
**Rule**: Display user's claim history with status and amounts
- Show recent claims first (descending date order)
- Display claim status: Approved, Pending, Denied
- Show claim amount and date
- Allow filtering by date range or status
- Provide claim details view

**Claim Status Mapping**:
| Status | Display | Color |
|--------|---------|-------|
| Approved | "Approved" | Green |
| Pending | "Pending" | Yellow |
| Denied | "Denied" | Red |
| Submitted | "Submitted" | Blue |

### 5. Provider Search Rules
**Rule**: Search and display in-network providers
- Search by name, specialty, or location
- Show provider details: name, specialty, distance, rating
- Filter by specialty or distance
- Show network status (in-network, out-of-network)
- Display contact information and scheduling options

**Validation**:
```yaml
- tapOn: ${output.benefits_provider.searchInput}
- typeText: "Cardiologist"
- assertVisible: ${output.benefits_provider.providerCard}
- assertVisible: ${output.benefits_provider.providerSpecialty}
```

### 6. Dependent/Caregiver Rules
**Rule**: Caregivers can view and manage dependent benefits
- Display list of dependents with relationships
- Allow switching between dependent and self benefits
- Show dependent-specific plan information
- Provide add/remove dependent options (if applicable)
- Maintain separate claim history per dependent

**Validation**:
```yaml
- assertVisible: ${output.benefits_dependents.dependentsHeader}
- assertVisible: ${output.benefits_dependents.dependentCard}
- tapOn: ${output.benefits_dependents.dependentCard}
- assertVisible: ${output.benefits_landing.planSummaryLabel}
```

### 7. Error Handling Rules
**Rule**: Handle API failures and display appropriate error states
- Show error banner when API fails
- Provide retry option
- Cache previous data when possible
- Show "Contact Support" option for persistent errors
- Graceful degradation for partial failures

**Validation**:
```yaml
# Simulate network error
- runFlow: ../../subflows/common/disable_network.yaml

# Verify error banner
- assertVisible: ${output.benefits_error.errorBanner}

# Reconnect and retry
- runFlow: ../../subflows/common/enable_network.yaml
- tapOn: ${output.benefits_error.retryBtn}
- assertNotVisible: ${output.benefits_error.errorBanner}
```

---

## Known Issues & Edge Cases

### Edge Cases to Test

#### 1. Multiple Insurance Plans
- **User with Caremark + Aetna**: Show both plans with switching capability
- **User with primary + secondary**: Display primary by default
- **Plan switching**: Verify correct plan details load when switching

#### 2. No Benefits Data
- **User with no active plan**: Show "No active plan" message
- **User with no claims**: Show "No claims found" message
- **User with no dependents**: Hide dependents section

#### 3. Dependent Benefits
- **Caregiver viewing dependent**: Show dependent's plan and claims
- **Switching between dependents**: Verify correct data loads
- **Dependent with different plan**: Show dependent-specific coverage

#### 4. ID Card Sharing
- **Share via email**: Verify email option works
- **Share via messaging**: Verify messaging option works
- **Download PDF**: Verify PDF generation and download
- **Offline access**: Verify cached ID card displays offline

#### 5. Claims with Different Statuses
- **Approved claims**: Show full details and provider info
- **Pending claims**: Show expected processing date
- **Denied claims**: Show denial reason and appeal option
- **Submitted claims**: Show submission date and expected timeline

#### 6. Provider Search Edge Cases
- **No results**: Show "No providers found" message
- **Network error**: Show error and retry option
- **Location-based search**: Verify distance calculation
- **Specialty filtering**: Verify filter accuracy

### Platform Differences

#### iOS vs Android
- **ID Card Display**: iOS may use native PDF viewer, Android uses embedded viewer
- **Share Options**: iOS uses native share sheet, Android uses system share dialog
- **Date Picker**: iOS uses native picker, Android uses custom component
- **Animations**: Loading animations may differ slightly

#### Element Selectors
```javascript
// Platform-specific elements in benefits screenObjects
const __isIOS = maestro.platform.toLowerCase() === 'ios';

// Most benefits elements are platform-agnostic
// Use same text/labels for both platforms
```

---

## Test Coverage Matrix

### Smoke Tests (Critical Path)
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| BEN-0.1.0 | Benefits loads (Authenticated) | `BEN-0.1.0_smoke_benefits_loads.yaml` | LOA2 | ⏳ |
| BEN-0.1.1 | Plan summary displays | `BEN-0.1.1_smoke_plan_summary_displays.yaml` | QL_ONLY_3 | ⏳ |
| BEN-0.2.0 | ID card displays | `BEN-0.2.0_smoke_id_card_displays.yaml` | LOA2 | ⏳ |
| BEN-0.3.0 | Claims history loads | `BEN-0.3.0_smoke_claims_history_loads.yaml` | QL_ONLY_3 | ⏳ |

### Plan Details Tests
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| BEN-1.0.0 | View plan details | `BEN-1.0.0_view_plan_details.yaml` | QL_ONLY_3 | ⏳ |
| BEN-1.1.0 | Deductible displays | `BEN-1.1.0_deductible_displays.yaml` | QL_ONLY_3 | ⏳ |
| BEN-1.2.0 | Out of pocket max displays | `BEN-1.2.0_out_of_pocket_max_displays.yaml` | QL_ONLY_3 | ⏳ |
| BEN-1.3.0 | Copay information displays | `BEN-1.3.0_copay_information_displays.yaml` | QL_ONLY_3 | ⏳ |

### ID Card Tests
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| BEN-2.0.0 | ID card displays correctly | `BEN-2.0.0_id_card_displays.yaml` | LOA2 | ⏳ |
| BEN-2.1.0 | Share ID card | `BEN-2.1.0_share_id_card.yaml` | LOA2 | ⏳ |
| BEN-2.2.0 | Download ID card | `BEN-2.2.0_download_id_card.yaml` | LOA2 | ⏳ |
| BEN-2.3.0 | ID card offline access | `BEN-2.3.0_id_card_offline.yaml` | LOA2 | ⏳ |

### Claims Tests
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| BEN-3.0.0 | Claims history displays | `BEN-3.0.0_claims_history_displays.yaml` | QL_ONLY_3 | ⏳ |
| BEN-3.1.0 | View claim details | `BEN-3.1.0_view_claim_details.yaml` | QL_ONLY_3 | ⏳ |
| BEN-3.2.0 | Filter claims by status | `BEN-3.2.0_filter_claims_by_status.yaml` | QL_ONLY_3 | ⏳ |
| BEN-3.3.0 | Filter claims by date | `BEN-3.3.0_filter_claims_by_date.yaml` | QL_ONLY_3 | ⏳ |

### Provider Search Tests
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| BEN-4.0.0 | Provider search loads | `BEN-4.0.0_provider_search_loads.yaml` | QL_ONLY_3 | ⏳ |
| BEN-4.1.0 | Search by provider name | `BEN-4.1.0_search_by_provider_name.yaml` | QL_ONLY_3 | ⏳ |
| BEN-4.2.0 | Filter by specialty | `BEN-4.2.0_filter_by_specialty.yaml` | QL_ONLY_3 | ⏳ |
| BEN-4.3.0 | Filter by distance | `BEN-4.3.0_filter_by_distance.yaml` | QL_ONLY_3 | ⏳ |

### Dependent/Caregiver Tests
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| BEN-5.0.0 | View dependent benefits | `BEN-5.0.0_view_dependent_benefits.yaml` | LOA2_CAREGIVER | ⏳ |
| BEN-5.1.0 | Switch between dependents | `BEN-5.1.0_switch_between_dependents.yaml` | LOA2_CAREGIVER | ⏳ |
| BEN-5.2.0 | View dependent claims | `BEN-5.2.0_view_dependent_claims.yaml` | LOA2_CAREGIVER | ⏳ |
| BEN-5.3.0 | View dependent ID card | `BEN-5.3.0_view_dependent_id_card.yaml` | LOA2_CAREGIVER | ⏳ |

### Multi-Plan Tests
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| BEN-6.0.0 | Multiple plans display | `BEN-6.0.0_multiple_plans_display.yaml` | PRADHI_THIDHI | ⏳ |
| BEN-6.1.0 | Switch between plans | `BEN-6.1.0_switch_between_plans.yaml` | PRADHI_THIDHI | ⏳ |
| BEN-6.2.0 | Plan-specific claims | `BEN-6.2.0_plan_specific_claims.yaml` | PRADHI_THIDHI | ⏳ |

### Error Handling & Edge Cases
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| BEN-7.0.0 | No benefits data | `BEN-7.0.0_no_benefits_data.yaml` | LOA2 | ⏳ |
| BEN-7.1.0 | No claims found | `BEN-7.1.0_no_claims_found.yaml` | QL_ONLY_3 | ⏳ |
| BEN-7.2.0 | API error handling | `BEN-7.2.0_api_error_handling.yaml` | LOA2 | ⏳ |
| BEN-7.3.0 | Network error retry | `BEN-7.3.0_network_error_retry.yaml` | LOA2 | ⏳ |

---

## Related Documentation

### Jira Tickets
- **PA1-XXXXX**: Benefits Dashboard Feature
- **PA1-XXXXX**: Insurance Integration
- **PA1-XXXXX**: Caregiver Benefits Management

### Confluence Pages
- [Benefits Feature Design](https://cvsdigital.atlassian.net/wiki/spaces/PA1/pages/XXXXX)
- [Insurance Integration Architecture](https://cvsdigital.atlassian.net/wiki/spaces/PA1/pages/XXXXX)

### API Endpoints & Architecture

#### Benefits API
- **Endpoint**: `https://www-qa2.cvs.com/apix/client/benefits/v2/summary`
- **Dependencies**: 
  - Insurance provider APIs (Caremark, Aetna)
  - Account services (member ID, plan information)
  - Claims backend
- **Returns**: Plan summary, deductible, out-of-pocket max, coverage details

#### Claims API
- **Endpoint**: `https://www-qa2.cvs.com/apix/client/benefits/v2/claims`
- **Dependencies**: Claims processing backend
- **Returns**: Claim history with status and amounts

#### Provider Search API
- **Endpoint**: `https://www-qa2.cvs.com/apix/client/benefits/v2/providers`
- **Dependencies**: Provider directory database
- **Returns**: In-network provider list with details

#### Dependent Benefits API
- **Endpoint**: `https://www-qa2.cvs.com/apix/client/benefits/v2/dependents`
- **Dependencies**: Account services, insurance provider APIs
- **Returns**: Dependent list and their benefits information

---

## Test Creation Guidelines

### Creating New Benefits Tests

1. **Identify the feature/component** to test (Plan details, ID card, Claims, etc.)

2. **Select appropriate test user** based on required data:
   - LOA2 for general authenticated flows
   - QL_ONLY_3 for Caremark/Aetna-specific tests
   - LOA2_CAREGIVER for dependent/caregiver flows
   - PRADHI_THIDHI for multi-plan scenarios

3. **Load required screenObjects** in `onFlowStart`:
   ```yaml
   onFlowStart:
     - runScript: ../../screens/SearchAndNav/searchNavObjects.js
     - runScript:
         file: ../../testdata/users_qa.js
         env:
           loginData: QL_ONLY_3
   ```

4. **Use existing subflows** for common actions:
   - `launchApp.yaml` - Launch app
   - `complete_signin_and_otp_dob.yaml` - Sign in
   - `benefits_loaded_successful.yaml` - Verify benefits loaded

5. **Follow naming convention**: `BEN-{ID}.{SUB}.{VER}_{category}_{description}.yaml`
   - Example: `BEN-1.0.0_view_plan_details.yaml`

6. **Add appropriate tags**:
   - `benefits` - All benefits tests
   - `smoke` - Critical path tests
   - `plan_details` - Plan-specific tests
   - `claims` - Claims-related tests
   - `provider_search` - Provider search tests
   - `caregiver` - Caregiver/dependent tests
   - `regression` - Regression suite tests

### Example Test Structure
```yaml
appId: ${APP_NAME}
tags:
  - benefits
  - plan_details
  - smoke
onFlowStart:
  - runScript: ../../screens/SearchAndNav/searchNavObjects.js
  - runScript:
      file: ../../testdata/users_qa.js
      env:
        loginData: QL_ONLY_3
---
# Launch app and sign in
- runFlow: ../../subflows/common/launchApp.yaml
- runFlow: ../../subflows/account/complete_signin_and_otp_dob.yaml

# Navigate to benefits
- tapOn: ${output.common_navigation.benefitsTab}

# Verify benefits loaded
- runFlow: ../../subflows/benefits/benefits_loaded_successful.yaml

# Verify plan details
- assertVisible: ${output.benefits_landing.planSummaryLabel}
- assertVisible: ${output.benefits_landing.deductible}
- assertVisible: ${output.benefits_landing.outOfPocketMax}

# View plan details
- tapOn: ${output.benefits_landing.planSummaryLabel}
- assertVisible: ${output.benefits_plan.planDetailsHeader}
```

---

**Last Updated**: March 2, 2026  
**Maintained By**: QA Automation Team  
**Framework**: Maestro UI Tests
