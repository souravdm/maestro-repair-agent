# Homescreen Discovery NBAs (DNBAs)

## Overview

The Discovery Zone displays **personalized product and service recommendations** for both guest and authenticated users. Discovery cards are driven by AEM configuration, user behavior analytics, and real-time recommendation engine API calls. Unlike Activity NBAs which are action-oriented, Discovery NBAs focus on discovery and engagement.

---

## Architecture & Data Sources

### 1. LaunchDarkly Feature Flags
Controls discovery zone visibility and individual card types:
- **Flag naming**: `homescreen_discovery_*` (e.g., `homescreen_discovery_enabled`, `homescreen_discovery_photo_deals`)
- **Scope**: User segment, environment (qa/prod), percentage rollout
- **Impact**: If flag is OFF, discovery zone is completely hidden

### 2. AEM Configuration (Adobe Experience Manager)
Defines the **discovery module structure** and **card ordering** per user segment:
- **Segments**: Guest, LOA1, LOA2, RxTie, ExtraCare, ExtraCare Plus, etc.
- **Module types**:
  - **Photo Deals**: CVS photo products and deals
  - **ExtraCare Plus Savings**: Membership benefits and exclusive offers
  - **Health & Wellness**: Vitamins, supplements, health products
  - **Seasonal Promotions**: Flu shots, health screenings, seasonal products
  - **Personalized Recommendations**: ML-driven product suggestions
  - **Brand Partnerships**: Partner brand promotions (e.g., Dyson, Samsung)
- **Rank/Order**: Determines card display sequence
- **Visibility rules**: Which modules appear for which segments

### 3. User Behavior Analytics
Tracks user interactions to personalize recommendations:
- **Purchase history**: Previous orders, product categories, brands
- **Browse history**: Viewed products, categories, search queries
- **Engagement signals**: Clicked cards, time spent on categories
- **Location data**: Nearest CVS store, regional promotions
- **Loyalty status**: ExtraCare member tier, points balance

### 4. Recommendation Engine Backend
Makes real-time API calls to generate personalized discovery cards:

#### Product Recommendation API
- **Endpoint**: `/api/recommendations/products`
- **Parameters**: User ID, behavior history, location, segment
- **Data**: Product IDs, titles, images, prices, ratings
- **Used for**: Personalized product cards

#### Deals & Promotions API
- **Endpoint**: `/api/deals/active`
- **Parameters**: User segment, location, category filters
- **Data**: Deal title, discount %, expiration, product list
- **Used for**: Photo deals, seasonal promotions, brand partnerships

#### ExtraCare API
- **Endpoint**: `/api/loyalty/extracare/offers`
- **Parameters**: Member ID, tier level
- **Data**: Exclusive offers, bonus points, member-only deals
- **Used for**: ExtraCare Plus savings cards

#### Health & Wellness API
- **Endpoint**: `/api/health/recommendations`
- **Parameters**: User age, health interests, location
- **Data**: Product recommendations, health tips, appointment availability
- **Used for**: Health & wellness cards, vaccine reminders

---

## Display Logic

### Conditional Rendering

```
For All Users (Guest & Authenticated):
  1. Check LaunchDarkly flags for discovery zone enabled
  2. Query AEM for user's segment configuration
  3. For each discovery module in AEM config:
     a. Check if module is enabled for this segment
     b. Call corresponding recommendation API
     c. If API returns data, render card(s)
     d. If API fails or no data, skip card (graceful degradation)
  4. Display cards in AEM-defined order
  5. Show loading states during API calls
  6. Show error banners if critical API fails
```

### Fallback Behavior
- **API timeout** (>10s): Skip card, show next card
- **API error (4xx/5xx)**: Log error, skip card, continue
- **No data returned**: Card not displayed (not an error state)
- **All APIs fail**: Show "Something went wrong" banner with retry option
- **Guest user**: Show generic recommendations (no personalization)
- **Authenticated user**: Show personalized recommendations based on history

---

## Test Data Requirements

### User Segments for Testing

#### Guest User
- Profile: No authentication, no history
- Expected cards: Generic photo deals, seasonal promotions, health tips
- Test file: No login required, continue as guest

#### LOA2 (Authenticated, No Rx Tie)
- Profile: Authenticated, no pharmacy data, limited history
- Expected cards: Personalized products, health & wellness, ExtraCare offers
- Test file: `users_qa.js` → `LOA2`

#### RxTie User (Authenticated + Pharmacy)
- Profile: Authenticated, pharmacy data, purchase history
- Expected cards: Pharmacy-related products, health services, seasonal promotions
- Test file: `users_qa.js` → `ReadyRx`, `RxWithPriorityCards`

#### ExtraCare Plus User
- Profile: Authenticated, ExtraCare Plus member, high engagement
- Expected cards: Exclusive member offers, bonus point opportunities, premium deals
- Test file: Custom test data (if available)

---

## Screen Objects

### File Location
- **Primary**: `.maestro/screens/Home/homescreenObjects.js`
- **Supporting**: `.maestro/screens/SearchAndNav/searchNavObjects.js`

### Discovery Zone Elements
```javascript
output.homescreen_discover = {
  // Zone header
  discoverHeader: "Discover.*",
  
  // Photo Deals
  photoDealsCard: ".*photo.*",
  photoDealsTitle: "Photo Deals|Photo Products",
  viewPhotoDealBtn: "View Deals|Shop Now",
  
  // ExtraCare Plus Savings
  extracarePlusSavingsCard: "ExtraCare Plus.*Savings",
  extracarePlusBonusBtn: "Your bonus reward|Claim bonus",
  
  // Health & Wellness
  healthWellnessCard: ".*Health.*Wellness.*",
  vitaminsSupplementsCard: "Vitamins.*Supplements",
  scheduleFluShotCard: ".*Schedule.*flu shot.*",
  
  // Seasonal Promotions
  seasonalPromoCard: ".*Seasonal.*|.*Promotion.*",
  
  // Brand Partnerships
  brandPartnershipCard: ".*Dyson.*|.*Samsung.*|.*Partner.*",
  
  // Personalized Recommendations
  recommendedProductCard: "Recommended for you|Just for you",
  
  // Generic discovery cards
  tenExtraBucksReward: ".*10 ExtraBucks Rewards.*",
  exploreHealthServicesCard: "Explore.*Health.*Services.*"
}
```

---

## Business Rules & Validations

### Rule 1: Discovery Zone Available for All Users
- **Condition**: Guest and authenticated users can see discovery
- **Validation**: 
  ```yaml
  # Guest user
  - runFlow: ../../subflows/common/launchApp.yaml
  - tapOn: ${output.account_onboarding.continueAsGuestBtn}
  - assertVisible: ${output.homescreen_discover.discoverHeader}
  ```

### Rule 2: Card Order Follows AEM Configuration
- **Condition**: Cards display in rank order from AEM
- **Expected order**: Photo Deals → ExtraCare Savings → Health & Wellness → Seasonal → Personalized
- **Validation**: Inspect card order in hierarchy capture

### Rule 3: Personalization for Authenticated Users
- **Condition**: User is signed in
- **Behavior**: Show personalized recommendations based on purchase/browse history
- **Validation**: 
  ```yaml
  - runFlow: ../../subflows/account/complete_signin_and_otp_dob.yaml
  - assertVisible: ${output.homescreen_discover.recommendedProductCard}
  ```

### Rule 4: Generic Content for Guest Users
- **Condition**: User is not authenticated
- **Behavior**: Show generic, non-personalized discovery cards
- **Validation**: 
  ```yaml
  - tapOn: ${output.account_onboarding.continueAsGuestBtn}
  - assertVisible: ${output.homescreen_discover.photoDealsCard}
  - assertNotVisible: ${output.homescreen_discover.recommendedProductCard}
  ```

### Rule 5: API Failure Graceful Degradation
- **Condition**: One or more recommendation APIs fail
- **Behavior**: Skip failed card, show remaining cards
- **Validation**: 
  ```yaml
  - runFlow: ../../subflows/common/disable_network.yaml
  - assertVisible: ${output.homescreen_discover.discoverHeader}
  - runFlow: ../../subflows/common/enable_network.yaml
  - assertVisible: ${output.homescreen_discover.photoDealsCard}
  ```

### Rule 6: LaunchDarkly Flag Respect
- **Condition**: Feature flag is OFF for user
- **Behavior**: Discovery zone is completely hidden
- **Validation**: Requires flag override in test environment

---

## Common Subflows

### Discovery Zone Verification
```yaml
# .maestro/subflows/Home/discover_zone_loaded.yaml
- assertVisible: ${output.homescreen_discover.discoverHeader}
- assertVisible: ${output.homescreen_discover.photoDealsCard}
```

### Click Discovery Card
```yaml
# .maestro/subflows/Home/click_discovery_card.yaml
- tapOn: ${output.homescreen_discover.photoDealsCard}
- extendedWaitUntil:
    visible: "Photo products|Deal details"
    timeout: 5000
```

---

## Known Issues & Edge Cases

### 1. Recommendation API Latency
- **Issue**: Recommendation engine is slow, discovery zone delays
- **Mitigation**: Backend implements 5s timeout, shows cached recommendations
- **Test**: Simulate slow network with Maestro `delay` command

### 2. Cold Start Problem
- **Issue**: New user has no history, recommendations are generic
- **Cause**: Recommendation engine needs data to personalize
- **Mitigation**: Show popular/trending products for new users

### 3. Stale Recommendations
- **Issue**: User sees products they already purchased
- **Cause**: Recommendation cache not invalidated after purchase
- **Mitigation**: Refresh recommendations after checkout

### 4. Regional Deal Mismatch
- **Issue**: User sees deals not available in their location
- **Cause**: Location data not passed to deals API
- **Mitigation**: Filter deals by user's nearest CVS location

### 5. ExtraCare Tier Mismatch
- **Issue**: Non-ExtraCare user sees member-only offers
- **Cause**: Membership status not fetched before rendering
- **Mitigation**: Verify membership status before showing exclusive cards

---

## Test Coverage Matrix

| Test ID | Scenario | User Type | Expected Cards | Status |
|---------|----------|-----------|----------------|--------|
| HS-3.0.0 | Discovery loads (Guest) | Guest | Photo deals visible | ✅ |
| HS-3.1.0 | ExtraCare Plus navigation | LOA2 | ExtraCare savings visible | ✅ |
| HS-3.2.0 | Personalized recommendations | LOA2 | Recommended products visible | ✅ |
| HS-3.3.0 | Photo deals navigation | Guest | Photo deals card clickable | ✅ |
| HS-3.4.0 | Health & wellness cards | LOA2 | Health services visible | ✅ |
| HS-3.5.0 | Seasonal promotions | All | Seasonal cards visible | ✅ |

---

## Related Documentation
- [Homescreen Feature Overview](../homescreen.md)
- [Activity Zone (ANBAs)](./homescreen-activity-zone.md)
- [Business Units](./homescreen-business-units.md)
- [AEM NBA Configuration](../aem-nba-config.md)
- [Recommendation Engine](../../personalization/recommendation-engine.md)
