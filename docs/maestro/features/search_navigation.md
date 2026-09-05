# Search & Navigation Feature Requirements

## Overview
The Search & Navigation feature provides users with quick access to app functionality through a bottom navigation bar and a comprehensive search interface. It enables users to discover products, services, health information, and app features. The feature includes search history, filters, and personalized recommendations based on user behavior and preferences.

## Key User Flows
- **Bottom Navigation**: Switch between main app sections (Home, Shop, Health, Account, More)
- **Search Products**: Search for pharmacy products, health items, and services
- **Search Health Info**: Search health articles, conditions, and wellness content
- **Search Providers**: Search for doctors and healthcare providers
- **Search History**: View and manage previous searches
- **Search Filters**: Filter results by category, price, rating, availability
- **Search Suggestions**: View autocomplete suggestions and trending searches
- **Navigation Drawer**: Access additional menu items and settings
- **Error Handling**: Display error states and retry mechanisms

---

## Screen Objects

### File Location
- **Primary**: `.maestro/screens/SearchAndNav/searchNavObjects.js`
- **Supporting**: `.maestro/screenObjects/commonObjects.js` (for shared elements)

### Key Element Groups

#### Bottom Navigation Bar
```javascript
output.searchNav_bottomNav = {
    homeTab: "Home|Home tab",
    shopTab: "Shop|Shop tab",
    healthTab: "Health|Health tab",
    accountTab: "Account|Account tab",
    moreTab: "More|Menu|More tab",
    tabBar: "Tab bar|Navigation bar"
}
```

#### Search Bar & Input
```javascript
output.searchNav_search = {
    searchField: "Search.*|Search products|Search health",
    searchInput: "input.*search|search.*input",
    clearSearchBtn: "Clear|×",
    searchBtn: "Search|Go",
    cancelSearchBtn: "Cancel|Back"
}
```

#### Search Results
```javascript
output.searchNav_results = {
    resultsHeader: "Results|Search Results",
    resultCard: "Result.*|Product.*|Article.*",
    resultTitle: "Title|Name",
    resultDescription: "Description|Details",
    resultPrice: "\\$[0-9,]+",
    resultRating: "Rating:.*|★.*",
    noResultsMessage: "No results found|No.*found",
    resultCount: "[0-9]+ results"
}
```

#### Search Filters
```javascript
output.searchNav_filters = {
    filterBtn: "Filter|Filters",
    filterHeader: "Filters|Filter Results",
    categoryFilter: "Category|Categories",
    priceFilter: "Price|Price Range",
    ratingFilter: "Rating|Star Rating",
    availabilityFilter: "Availability|In Stock",
    applyFiltersBtn: "Apply|Apply Filters",
    clearFiltersBtn: "Clear|Clear Filters",
    filterBadge: "[0-9]+ filters applied"
}
```

#### Search History & Suggestions
```javascript
output.searchNav_history = {
    historyHeader: "Search History|Recent Searches",
    historyItem: "Search.*|Recent.*",
    clearHistoryBtn: "Clear History|Clear All",
    suggestionsHeader: "Suggestions|Trending|Popular",
    suggestionItem: "Suggestion.*|Trending.*",
    recentSearches: "Recent|History"
}
```

#### Navigation Drawer/Menu
```javascript
output.searchNav_drawer = {
    menuBtn: "Menu|≡|Hamburger",
    drawerHeader: "Menu|Navigation",
    drawerItem: "Menu item|Navigation item",
    settingsOption: "Settings|Preferences",
    helpOption: "Help|Support|Contact",
    aboutOption: "About|App Info",
    logoutOption: "Logout|Sign Out",
    closeDrawerBtn: "Close|Back"
}
```

#### Header Elements
```javascript
output.searchNav_header = {
    appLogo: "CVS|Logo",
    headerTitle: "CVS Health|App Title",
    notificationBell: "Notifications|Bell|Messages",
    notificationBadge: "[0-9]+",
    profileBtn: "Profile|Account|User",
    backBtn: "Back|<|←"
}
```

#### Error States
```javascript
output.searchNav_error = {
    errorBanner: ".*Error.*|.*Something went wrong.*",
    noInternetMessage: "No internet|Not connected",
    retryBtn: "Retry|Try Again",
    errorIcon: "Error icon|⚠"
}
```

### Element Naming Convention
- Prefix: `searchNav_` for all search/navigation elements
- Group by section: `bottomNav`, `search`, `results`, `filters`, `history`, `drawer`, `header`, `error`
- Use descriptive names: `searchField`, `filterBtn`, `clearHistoryBtn`

---

## Test Data Requirements

### Required Test Users

#### Guest User (No Authentication)
```javascript
// No test data needed - use app without signing in
// Used for: Search products, browse health info, navigation
```

#### LOA2 (Authenticated User)
```javascript
LOA2: {
    email: 'senior.usavior@gmail.com',
    dob: "09011956",
    password: 'Nextgen@8888',
    loa: 2,
    hasCvsAccount: true
}
// Used for: Personalized search, saved searches, account navigation
```

#### ReadyRx (User with Prescriptions)
```javascript
ReadyRx: {
    firstName: 'MAYFLOWERS',
    lastName: 'DUR',
    dob: '01011990',
    email: 'mayflowers@qa2.com',
    password: 'Retail@4321',
    hasCvsAccount: true,
    ephData: [{ rxc: true }],
    rx: [
        { name: "Carbamazepine 200 Mg Tablet", status: "Ready for Pickup" }
    ]
}
// Used for: Rx search, prescription-related navigation
```

#### SUMMER_PE (EC Plus User)
```javascript
SUMMER_PE: {
    firstName: 'Summer',
    lastName: 'PE',
    dob: '09091990',
    email: 'summer.pe@qa2.com',
    password: 'Common@123',
    hasCvsAccount: true,
    profileId: '533915299',
    rxcId: '2518029424',
    ecNumber: '4765181103525',
    isECPlus: true
}
// Used for: EC Plus member search, personalized recommendations
```

### Loading Test Data in Tests
```yaml
onFlowStart:
  - runScript: ../../screens/SearchAndNav/searchNavObjects.js
  - runScript:
      file: ../../testdata/users_qa.js
      env:
        loginData: LOA2  # or ReadyRx, SUMMER_PE, etc.
```

---

## Common Subflows

### Available Subflows

#### Bottom Navigation Verification
```yaml
# .maestro/subflows/searchNav/bottom_nav_loaded.yaml
# Verifies bottom navigation bar is visible and functional
- runFlow: ../../subflows/searchNav/bottom_nav_loaded.yaml
```

#### Search Execution
```yaml
# .maestro/subflows/searchNav/perform_search.yaml
# Executes a search and waits for results
- runFlow: ../../subflows/searchNav/perform_search.yaml
```

#### Navigation Tab Switch
```yaml
# .maestro/subflows/searchNav/switch_nav_tab.yaml
# Switches between bottom navigation tabs
- runFlow: ../../subflows/searchNav/switch_nav_tab.yaml
```

### Usage Pattern
```yaml
# Example: Search for a product
- runFlow: ../../subflows/common/launchApp.yaml
- runFlow: ../../subflows/searchNav/bottom_nav_loaded.yaml
- tapOn: ${output.searchNav_search.searchField}
- typeText: "Aspirin"
- runFlow: ../../subflows/searchNav/perform_search.yaml
- assertVisible: ${output.searchNav_results.resultCard}
```

---

## Business Rules & Validations

### 1. Bottom Navigation Bar Loading
**Rule**: Bottom navigation must load and be accessible on all screens
- All 5 tabs must be visible (Home, Shop, Health, Account, More)
- Current tab must be highlighted/active
- Tab switching must work smoothly without errors
- Navigation bar must persist across app usage

**Validation**:
```yaml
- assertVisible: ${output.searchNav_bottomNav.homeTab}
- assertVisible: ${output.searchNav_bottomNav.shopTab}
- assertVisible: ${output.searchNav_bottomNav.healthTab}
- assertVisible: ${output.searchNav_bottomNav.accountTab}
- assertVisible: ${output.searchNav_bottomNav.moreTab}
```

### 2. Search Functionality Rules
**Rule**: Search must work across multiple content types
- **Product Search**: Search pharmacy products, OTC items, health products
- **Health Info Search**: Search articles, conditions, wellness topics
- **Provider Search**: Search doctors and healthcare providers
- **Search History**: Store and display previous searches
- **Autocomplete**: Show suggestions as user types
- **Search Results**: Display relevant results with details

**Search Result Display**:
| Content Type | Fields | Required |
|---|---|---|
| Product | Name, Price, Rating, Availability | ✅ |
| Health Article | Title, Description, Category | ✅ |
| Provider | Name, Specialty, Distance, Rating | ✅ |
| Service | Name, Description, Availability | ✅ |

**Validation**:
```yaml
- tapOn: ${output.searchNav_search.searchField}
- typeText: "Aspirin"
- assertVisible: ${output.searchNav_results.resultCard}
- assertVisible: ${output.searchNav_results.resultTitle}
- assertVisible: ${output.searchNav_results.resultPrice}
```

### 3. Search Filter Rules
**Rule**: Filters must refine search results accurately
- **Category Filter**: Filter by product category or content type
- **Price Filter**: Filter by price range (min-max)
- **Rating Filter**: Filter by star rating (1-5 stars)
- **Availability Filter**: Filter by in-stock/available status
- **Multiple Filters**: Support combining multiple filters
- **Clear Filters**: Reset all filters with one action

**Validation**:
```yaml
- tapOn: ${output.searchNav_filters.filterBtn}
- tapOn: ${output.searchNav_filters.priceFilter}
- typeText: "50"  # Max price
- tapOn: ${output.searchNav_filters.applyFiltersBtn}
- assertVisible: ${output.searchNav_filters.filterBadge}
```

### 4. Search History Rules
**Rule**: Maintain and display user search history
- Store last 20 searches (configurable)
- Display most recent searches first
- Allow clearing individual searches
- Allow clearing all history
- Sync history across sessions (for authenticated users)
- Don't store sensitive searches

**Validation**:
```yaml
- tapOn: ${output.searchNav_search.searchField}
- assertVisible: ${output.searchNav_history.historyHeader}
- assertVisible: ${output.searchNav_history.historyItem}
- tapOn: ${output.searchNav_history.clearHistoryBtn}
- assertNotVisible: ${output.searchNav_history.historyItem}
```

### 5. Navigation Tab Rules
**Rule**: Tab switching must be smooth and preserve state
- **Home Tab**: Display homescreen with personalized content
- **Shop Tab**: Display shopping interface and product catalog
- **Health Tab**: Display health information and services
- **Account Tab**: Display user account and profile
- **More Tab**: Display additional menu items and settings
- **Tab State**: Preserve scroll position and content within tab
- **Active Tab**: Highlight current tab in navigation bar

**Validation**:
```yaml
# Switch to Shop tab
- tapOn: ${output.searchNav_bottomNav.shopTab}
- assertVisible: ${output.shop.shopHeader}

# Switch to Health tab
- tapOn: ${output.searchNav_bottomNav.healthTab}
- assertVisible: ${output.health.healthHeader}
```

### 6. Navigation Drawer Rules
**Rule**: Menu drawer provides access to additional options
- **Menu Items**: Settings, Help, About, Logout (if authenticated)
- **Drawer State**: Opens/closes smoothly
- **Drawer Persistence**: Closes when selecting item or tapping outside
- **Menu Organization**: Logical grouping of related items
- **Accessibility**: All items must be keyboard accessible

**Validation**:
```yaml
- tapOn: ${output.searchNav_drawer.menuBtn}
- assertVisible: ${output.searchNav_drawer.settingsOption}
- assertVisible: ${output.searchNav_drawer.helpOption}
- tapOn: ${output.searchNav_drawer.settingsOption}
- assertNotVisible: ${output.searchNav_drawer.drawerHeader}
```

### 7. Search Suggestions Rules
**Rule**: Display relevant search suggestions and trending content
- **Autocomplete**: Show suggestions as user types
- **Trending Searches**: Display popular searches
- **Personalized Suggestions**: Show recommendations based on history
- **Search Categories**: Suggest searches by category
- **Clear Suggestions**: Hide suggestions when search is cleared

**Validation**:
```yaml
- tapOn: ${output.searchNav_search.searchField}
- typeText: "Asp"
- assertVisible: ${output.searchNav_history.suggestionsHeader}
- assertVisible: ${output.searchNav_history.suggestionItem}
```

### 8. Error Handling Rules
**Rule**: Handle search failures and network errors gracefully
- Show error banner when search fails
- Provide retry option
- Show "No results found" for empty results
- Handle network disconnection
- Cache previous search results when possible

**Validation**:
```yaml
# Simulate network error
- runFlow: ../../subflows/common/disable_network.yaml

# Attempt search
- tapOn: ${output.searchNav_search.searchField}
- typeText: "Test"
- tapOn: ${output.searchNav_search.searchBtn}

# Verify error handling
- assertVisible: ${output.searchNav_error.noInternetMessage}
```

---

## Known Issues & Edge Cases

### Edge Cases to Test

#### 1. Empty Search Results
- **No results found**: Show "No results found" message
- **Partial matches**: Show close matches or suggestions
- **Typos**: Suggest corrections or similar searches
- **Empty search field**: Show search history or suggestions

#### 2. Search Performance
- **Large result sets**: Paginate or lazy-load results
- **Search latency**: Show loading indicator during search
- **Timeout handling**: Show error if search takes too long
- **Concurrent searches**: Cancel previous search if new one initiated

#### 3. Filter Combinations
- **No results after filtering**: Show "No results match filters" message
- **Invalid filter combinations**: Disable incompatible filters
- **Filter persistence**: Maintain filters when navigating back
- **Clear filters**: Reset all filters without reloading

#### 4. Search History Edge Cases
- **First-time user**: Show suggestions instead of history
- **Cleared history**: Show empty state with message
- **Duplicate searches**: Don't store duplicate entries
- **Sensitive searches**: Don't store certain search terms

#### 5. Navigation Tab Switching
- **Rapid tab switching**: Handle without errors
- **Tab content loading**: Show loading state if needed
- **Scroll position**: Preserve scroll position within tab
- **Form data**: Preserve unsaved form data when switching tabs

#### 6. Search Across Content Types
- **Mixed results**: Display results grouped by type
- **Type filtering**: Allow filtering by content type
- **Type-specific details**: Show relevant details for each type
- **Cross-type navigation**: Allow navigating between result types

### Platform Differences

#### iOS vs Android
- **Bottom Navigation**: iOS uses tab bar, Android uses bottom nav bar
- **Search Bar**: iOS may use native search controller, Android uses custom
- **Drawer**: iOS uses side menu, Android uses bottom drawer or side menu
- **Animations**: Transitions may differ between platforms

#### Element Selectors
```javascript
// Platform-specific elements in searchNavObjects.js
const __isIOS = maestro.platform.toLowerCase() === 'ios';

// Most search/nav elements are platform-agnostic
// Use same text/labels for both platforms
```

---

## Test Coverage Matrix

### Smoke Tests (Critical Path)
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| SN-0.1.0 | Bottom nav loads | `SN-0.1.0_smoke_bottom_nav_loads.yaml` | Guest | ⏳ |
| SN-0.1.1 | Tab switching works | `SN-0.1.1_smoke_tab_switching_works.yaml` | Guest | ⏳ |
| SN-0.2.0 | Search bar visible | `SN-0.2.0_smoke_search_bar_visible.yaml` | Guest | ⏳ |
| SN-0.3.0 | Search executes | `SN-0.3.0_smoke_search_executes.yaml` | Guest | ⏳ |

### Bottom Navigation Tests
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| SN-1.0.0 | Home tab navigation | `SN-1.0.0_home_tab_navigation.yaml` | Guest | ⏳ |
| SN-1.1.0 | Shop tab navigation | `SN-1.1.0_shop_tab_navigation.yaml` | Guest | ⏳ |
| SN-1.2.0 | Health tab navigation | `SN-1.2.0_health_tab_navigation.yaml` | Guest | ⏳ |
| SN-1.3.0 | Account tab navigation | `SN-1.3.0_account_tab_navigation.yaml` | LOA2 | ⏳ |
| SN-1.4.0 | More tab navigation | `SN-1.4.0_more_tab_navigation.yaml` | Guest | ⏳ |

### Search Tests
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| SN-2.0.0 | Product search | `SN-2.0.0_product_search.yaml` | Guest | ⏳ |
| SN-2.1.0 | Health info search | `SN-2.1.0_health_info_search.yaml` | Guest | ⏳ |
| SN-2.2.0 | Provider search | `SN-2.2.0_provider_search.yaml` | Guest | ⏳ |
| SN-2.3.0 | Search with no results | `SN-2.3.0_search_with_no_results.yaml` | Guest | ⏳ |
| SN-2.4.0 | Search autocomplete | `SN-2.4.0_search_autocomplete.yaml` | Guest | ⏳ |

### Search Filter Tests
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| SN-3.0.0 | Apply category filter | `SN-3.0.0_apply_category_filter.yaml` | Guest | ⏳ |
| SN-3.1.0 | Apply price filter | `SN-3.1.0_apply_price_filter.yaml` | Guest | ⏳ |
| SN-3.2.0 | Apply rating filter | `SN-3.2.0_apply_rating_filter.yaml` | Guest | ⏳ |
| SN-3.3.0 | Apply multiple filters | `SN-3.3.0_apply_multiple_filters.yaml` | Guest | ⏳ |
| SN-3.4.0 | Clear filters | `SN-3.4.0_clear_filters.yaml` | Guest | ⏳ |

### Search History Tests
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| SN-4.0.0 | View search history | `SN-4.0.0_view_search_history.yaml` | LOA2 | ⏳ |
| SN-4.1.0 | Clear search history | `SN-4.1.0_clear_search_history.yaml` | LOA2 | ⏳ |
| SN-4.2.0 | Search from history | `SN-4.2.0_search_from_history.yaml` | LOA2 | ⏳ |
| SN-4.3.0 | History persistence | `SN-4.3.0_history_persistence.yaml` | LOA2 | ⏳ |

### Navigation Drawer Tests
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| SN-5.0.0 | Open menu drawer | `SN-5.0.0_open_menu_drawer.yaml` | Guest | ⏳ |
| SN-5.1.0 | Access settings | `SN-5.1.0_access_settings.yaml` | Guest | ⏳ |
| SN-5.2.0 | Access help | `SN-5.2.0_access_help.yaml` | Guest | ⏳ |
| SN-5.3.0 | Logout from menu | `SN-5.3.0_logout_from_menu.yaml` | LOA2 | ⏳ |

### Search Suggestions Tests
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| SN-6.0.0 | View trending searches | `SN-6.0.0_view_trending_searches.yaml` | Guest | ⏳ |
| SN-6.1.0 | View personalized suggestions | `SN-6.1.0_view_personalized_suggestions.yaml` | LOA2 | ⏳ |
| SN-6.2.0 | Search from suggestion | `SN-6.2.0_search_from_suggestion.yaml` | Guest | ⏳ |

### Error Handling & Edge Cases
| Test ID | Scenario | Test File | User Type | Status |
|---------|----------|-----------|-----------|--------|
| SN-7.0.0 | Search network error | `SN-7.0.0_search_network_error.yaml` | Guest | ⏳ |
| SN-7.1.0 | Search timeout | `SN-7.1.0_search_timeout.yaml` | Guest | ⏳ |
| SN-7.2.0 | Empty search field | `SN-7.2.0_empty_search_field.yaml` | Guest | ⏳ |
| SN-7.3.0 | Rapid tab switching | `SN-7.3.0_rapid_tab_switching.yaml` | Guest | ⏳ |

---

## Related Documentation

### Jira Tickets
- **PA1-XXXXX**: Search Feature Implementation
- **PA1-XXXXX**: Navigation Architecture
- **PA1-XXXXX**: Search Filters and Refinement

### Confluence Pages
- [Search Feature Design](https://cvsdigital.atlassian.net/wiki/spaces/PA1/pages/XXXXX)
- [Navigation Architecture](https://cvsdigital.atlassian.net/wiki/spaces/PA1/pages/XXXXX)

### API Endpoints & Architecture

#### Search API
- **Endpoint**: `https://www-qa2.cvs.com/apix/client/search/v2/query`
- **Parameters**: `q` (query), `type` (product|article|provider), `filters` (category, price, rating)
- **Returns**: Search results with pagination

#### Autocomplete API
- **Endpoint**: `https://www-qa2.cvs.com/apix/client/search/v2/autocomplete`
- **Parameters**: `q` (partial query), `type` (optional)
- **Returns**: Autocomplete suggestions

#### Trending Searches API
- **Endpoint**: `https://www-qa2.cvs.com/apix/client/search/v2/trending`
- **Parameters**: `category` (optional)
- **Returns**: List of trending searches

#### Search History API
- **Endpoint**: `https://www-qa2.cvs.com/apix/client/search/v2/history`
- **Returns**: User's search history (authenticated users only)

---

## Test Creation Guidelines

### Creating New Search/Navigation Tests

1. **Identify the feature/component** to test (Search, Navigation, Filters, etc.)

2. **Select appropriate test user** based on required data:
   - Guest for unauthenticated flows
   - LOA2 for authenticated flows with search history
   - ReadyRx for Rx-related search
   - SUMMER_PE for personalized recommendations

3. **Load required screenObjects** in `onFlowStart`:
   ```yaml
   onFlowStart:
     - runScript: ../../screens/SearchAndNav/searchNavObjects.js
   ```

4. **Use existing subflows** for common actions:
   - `bottom_nav_loaded.yaml` - Verify bottom nav
   - `perform_search.yaml` - Execute search
   - `switch_nav_tab.yaml` - Switch tabs

5. **Follow naming convention**: `SN-{ID}.{SUB}.{VER}_{category}_{description}.yaml`
   - Example: `SN-2.0.0_product_search.yaml`

6. **Add appropriate tags**:
   - `search_nav` - All search/navigation tests
   - `smoke` - Critical path tests
   - `search` - Search-specific tests
   - `navigation` - Navigation-specific tests
   - `filters` - Filter-related tests
   - `regression` - Regression suite tests

### Example Test Structure
```yaml
appId: ${APP_NAME}
tags:
  - search_nav
  - search
  - smoke
onFlowStart:
  - runScript: ../../screens/SearchAndNav/searchNavObjects.js
---
# Launch app
- runFlow: ../../subflows/common/launchApp.yaml

# Verify bottom nav loaded
- runFlow: ../../subflows/searchNav/bottom_nav_loaded.yaml

# Perform search
- tapOn: ${output.searchNav_search.searchField}
- typeText: "Aspirin"
- runFlow: ../../subflows/searchNav/perform_search.yaml

# Verify results
- assertVisible: ${output.searchNav_results.resultCard}
- assertVisible: ${output.searchNav_results.resultTitle}
- assertVisible: ${output.searchNav_results.resultPrice}
```

---

**Last Updated**: March 2, 2026  
**Maintained By**: QA Automation Team  
**Framework**: Maestro UI Tests
