# Benefits Feature - Complete Knowledge Base

**Last Updated:** May 1, 2026  
**Source:** JIRA TLOP Board - Open Platform Project  
**Purpose:** Comprehensive reference for AI models and test automation

> **🔧 For technical test automation details, screen objects, and test patterns, see:**  
> [`benefits.md`](./benefits.md)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Feature Evolution Timeline](#feature-evolution-timeline)
3. [Core Features & Capabilities](#core-features--capabilities)
4. [Epic Breakdown](#epic-breakdown)
5. [Technical Architecture](#technical-architecture)
6. [User Personas & Journeys](#user-personas--journeys)
7. [Integration Points](#integration-points)
8. [Business Rules & Logic](#business-rules--logic)
9. [Test Coverage Requirements](#test-coverage-requirements)
10. [Known Issues & Limitations](#known-issues--limitations)

---

## Executive Summary

### What is Benefits?

The Benefits feature is CVS Health's integrated health insurance experience within the Health100 (H100) Super App, consolidating Aetna medical/dental/vision benefits and Caremark pharmacy benefits into a unified digital platform. It serves as the central hub for members to access plan information, manage claims, find care, and utilize health programs.

### Business Goals

- **Consolidation**: Unite Aetna and Caremark experiences from separate apps into one Super App
- **Retirement Strategy**: Enable retirement of standalone Caremark mobile app
- **User Growth**: Increase Monthly Active Users from 14.1M to 17M
- **Engagement**: Increase monthly visits per user from 5 to 6
- **Member Value**: Provide end-to-end benefit management in one place

### Key Stakeholders

- **Clients**: Aetna and Caremark customers (Commercial, Medicare, Medicaid)
- **Business Units**: Aetna Health, Caremark Pharmacy Benefits
- **Platform**: CVS Health Super App / Health100 App
- **Teams**: Open Platform Team 1, Team 2, Flutter Team

---

## Feature Evolution Timeline

### Phase 1: MVP Launch (Mid-2025)

**Epic**: TLOP-5 - "Deliver an integrated benefits landing page"  
**Status**: ✅ Completed  
**Launch Date**: August 2025

**Delivered:**
- Integrated Benefits landing page for Caremark + Aetna customers
- Plan summary cards with deductible information
- Digital ID card access (Caremark and Aetna)
- Basic navigation and header structure
- Consent management for cross-LOB access

**Scope:**
- ✅ Commercial plans only
- ✅ Active plans display
- ✅ Caremark plan summary with deductible
- ✅ ID card FAB/SIS sheet
- ❌ Medicare/MedD (out of scope)
- ❌ Inactive → active plan transitions

### Phase 2: Enhanced Features (Q4 2025 - Q1 2026)

**Key Epics:**
- **TLOP-983**: Spending Details (Claims with accumulators)
- **TLOP-1454**: Copay/Coinsurance information
- **TLOP-1948**: OCR/AI for Request Reimbursement
- **TLOP-1950**: Prescription YTD Summary (Retail & Specialty)
- **TLOP-1945**: Caremark Plan Disruptions MVP
- **TLOP-1953**: Find Care compliance gaps closure
- **TLOP-1954**: Executive Medical & BFD Plan Types support

**Delivered:**
- Medical/Dental spending details with plan accumulators
- Claims history with filtering (processed, submitted)
- Copay and coinsurance transparency
- Plan disruption alerts and banners
- Enhanced Find Care with compliance
- YTD spending summaries

### Phase 3: Point Solutions & Wellness (Q1 2026)

**Epic**: TLOP-2681 - "Benefits - Solera Point Solutions MVP"  
**Status**: 🟡 In Progress  
**Target**: December 2025 / Q1 2026

**Features:**
- Integration with Solera wellness platform
- Health program discovery and enrollment
- Personalized program recommendations
- Committed program display on Benefits landing
- Support for multiple wellness programs (Weight Watchers, diabetes management, etc.)

**Epic**: TLOP-2773 - "Benefits - Solera Payor Agnostic"  
**Status**: 🟡 Pending Approval

**Features:**
- Extend Solera access to non-Caremark members
- Insurance verification for wellness program eligibility
- WellBridge health questionnaire integration
- Broader payor support beyond Caremark

### Phase 4: Health Gateway & AI (2026)

**Epic**: TLOP-2775 - "H100 - Health Gateway MVP"  
**Status**: 🟡 Pending Approval

**Vision:**
- Personalized health program marketplace
- AI-powered program recommendations
- Cost/coverage transparency upfront
- Family member program discovery
- Embedded AI assistant (Haio integration)

**Epic**: TLOP-4002 - "Benefits on-page AI summarization (Phase 1)"  
**Status**: 🟡 In Progress  
**Target**: Q2 2026

**Features:**
- AI summarization of Plan Summary
- AI explanation of Claims details
- Haio conversational handoff from AI summaries
- Context-aware AI assistance for benefits questions

### Phase 5: Advanced Tools (2026)

**Epic**: TLOP-4220 - "AH Cost Estimator Tool Single Code"  
**Status**: 🟡 Pending Approval

**Features:**
- Medical procedure cost estimation
- Single CPT code lookup
- Out-of-pocket cost transparency
- Provider cost comparison

---

## Core Features & Capabilities

### 1. Benefits Landing Page

**Purpose**: Central hub for all benefit information

**Components:**
- **Header**: "My Benefits" with back, notification, cart icons
- **Plan Summary Cards**: 
  - Caremark (Pharmacy) - appears first for dual customers
  - Aetna (Medical/Dental/Vision) - appears second for dual customers
- **ID Card Access**: FAB/SIS sheet for digital ID cards
- **Quick Links**: Spending details, copay/coinsurance, plan documents
- **Null States**: Consent enrollment CTAs for missing permissions

**Display Rules:**
- Caremark-only customer → Show only Caremark section
- Aetna-only customer → Show only Aetna section  
- Dual customer → Show Caremark first, then Aetna
- Only active plans are displayed
- Family vs Individual toggle based on dependents

**Figma**: [Benefits Landing](https://www.figma.com/design/OujotMMgZTLcNoGJc8bili/Open-Platform-%E2%80%94-Benefits-Integration?node-id=15115-314811)

### 2. Plan Summary

**Caremark Plan Summary:**
- CVS Caremark logo with gradient background
- "Pharmacy" label in box
- Plan name (API-driven)
- Deductible information:
  - Individual or Family (based on subscriber status)
  - Total deductible amount
  - Amount spent
  - Amount remaining
- Link to Pharmacy spending details
- Link to Copay & coinsurance

**Aetna Plan Summary:**
- Aetna logo with gradient background
- "Medical" or "Dental" label
- Plan name (API-driven)
- Deductible information (same structure as Caremark)
- Link to Medical spending details
- Link to Benefits and plan documents
- Microapp integration for plan picker dropdown

**PZN Response Handling:**
- Hide deductible + hide plan summary
- Hide deductible + show plan summary
- Show deductible + hide plan summary
- Show deductible + show plan summary

**Figma**: [Plan Summary](https://www.figma.com/design/OujotMMgZTLcNoGJc8bili/Open-Platform-%E2%80%94-Benefits-Integration?node-id=15115-357214)

### 3. Digital ID Card

**Features:**
- Member ID display
- Group Number
- Plan name
- Effective date
- Share functionality
- Add to Apple Wallet (iOS) / Google Wallet (Android)

**Display Logic:**
- Caremark-only → Show Caremark ID card only
- Aetna-only → Show Aetna ID card only
- Dual customer → Show both cards

**Figma**: [ID Card/FAB](https://www.figma.com/design/OujotMMgZTLcNoGJc8bili/Open-Platform-%E2%80%94-Benefits-Integration?node-id=15115-357213)

### 4. Spending Details

**Epic**: TLOP-983

**Medical/Dental Spending:**
- Plan accumulator data integration
- Individual vs Family toggle
- Member dropdown for family plans
- Claim activity with associated accumulators
- Deductible progress tracking
- Out-of-pocket max tracking

**Pharmacy Spending:**
- Retail and Specialty claims
- YTD spending summary
- Claim-level detail
- Prescription cost breakdown

**Figma**: [Spending Details](https://www.figma.com/design/OujotMMgZTLcNoGJc8bili/Open-Platform-%E2%80%94-Benefits-Integration?node-id=24888-199797)

### 5. Claims Management

**Features:**
- Claims history display (recent first, descending date)
- Claim status: Approved, Pending, Denied, Submitted
- Claim amount and date
- Filtering by date range and status
- Claim details view
- Submit claim (reimbursement request)
- Submitted claim history tracking

**Status Mapping:**
| Status | Display | Color |
|--------|---------|-------|
| Approved | "Approved" | Green |
| Pending | "Pending" | Yellow |
| Denied | "Denied" | Red |
| Submitted | "Submitted" | Blue |

**OCR/AI Enhancement (TLOP-1948):**
- Upload prescription receipt
- AI extracts fields (date, pharmacy, amount, prescription details)
- Pre-populate reimbursement form
- Reduce manual data entry errors

### 6. Copay & Coinsurance

**Epic**: TLOP-1454

**Features:**
- Transparent cost-sharing information
- Copay amounts by service type
- Coinsurance percentages
- Deductible application rules
- Out-of-network coverage details

### 7. Find Care / Provider Search

**Epic**: TLOP-1953 - "Close fed/state compliance gaps"

**Features:**
- Provider search by name, specialty, location
- In-network provider filtering
- Provider details (specialty, distance, rating)
- Compliance with federal/state regulations
- Disclaimers section for legal requirements

**Epic**: TLOP-4045 - "Find Care - Create Disclaimers Section"

### 8. Plan Disruptions

**Epic**: TLOP-1945 - "Caremark Plan Disruptions MVP"

**Purpose**: Alert Caremark members to timely plan changes

**Features:**
- Dedicated banner on Benefits landing page
- Disruption flow routing from alert tap
- Plan change notifications
- Coverage transition alerts

**Figma**: [Plan Disruption](https://www.figma.com/design/OujotMMgZTLcNoGJc8bili/Open-Platform-%E2%80%94-Benefits-Integration)

### 9. Point Solutions / Wellness Programs

**Epic**: TLOP-2681 - "Solera Point Solutions MVP"

**Integration**: Solera wellness platform

**Features:**
- **Discovery**: "More programs to support your health" section
- **Enrollment**: Redirect to Solera questionnaire
- **Committed Programs**: Display enrolled programs as cards
- **Program Access**: Direct navigation to 3rd party apps/websites
- **Horizontal Carousel**: Scroll through multiple programs

**Program Lifecycle:**
- User completes Solera questionnaire
- Program recommended → Shows as "committed" for 90 days
- User enrolls → Program moves to enrolled state
- Low engagement → Program may be removed (future)

**Supported Programs:**
- Weight management (Weight Watchers)
- Diabetes management
- Hypertension management
- Mental health support
- Nutrition counseling
- Fitness programs

**Payor Agnostic Extension (TLOP-2773):**
- Insurance lookup/linkage flow
- Verify coverage for Solera programs
- Support non-Caremark payors
- WellBridge questionnaire integration

**Figma**: [Solera MVP](https://www.figma.com/design/fWvjQs42KFn95mzaW8qbju/Solera-Integration---Point-Solutions?node-id=5709-56774)

### 10. Health Gateway (Future)

**Epic**: TLOP-2775

**Vision**: Personalized health program marketplace

**Features:**
- Personalized program recommendations
- Search by name/category
- Family member program discovery
- Transparent cost/coverage details
- Enrolled program management
- AI-powered recommendations (Haio integration)

**Entry Points:**
- H100 homescreen (For You, Discovery)
- Benefits landing page
- Push notifications

**Figma**: [Partner Hub](https://www.figma.com/design/gCH1Nr38EiXj4kWlwWRrcR/Partner-Hub?node-id=7728-98644)

### 11. AI Summarization

**Epic**: TLOP-4002 - "Benefits on-page AI summarization (Phase 1)"

**Use Cases:**
1. **Plan Summary AI**:
   - Summarize plan details
   - Explain cost sharing changes
   - Alert when close to deductible
   - Explain spending drivers

2. **Claims AI**:
   - Explain claim cost breakdown
   - Clarify denial reasons
   - Suggest next actions

**Haio Integration:**
- CTA from AI summary to Haio conversational agent
- Context passed to Haio for seamless transition
- Agent acknowledges transfer and continues conversation

**Intent Journeys:**
- High priority: Cost sharing change
- Medium priority: Close to deductible
- Low priority: What drove the spending

**Figma**: [Benefits AI Explorations](https://www.figma.com/design/IJvx2lVBjfo7KDjcNHYmMn/Benefits-Ai-explorations?node-id=224-9798)

---

## Epic Breakdown

### Foundation Epics

#### TLOP-5: Integrated Benefits Landing Page
- **Status**: ✅ Completed (Aug 2025)
- **Priority**: Highest
- **Description**: First integrated experience for Caremark + Aetna customers
- **Key Deliverables**:
  - Benefits landing page with plan summaries
  - Digital ID card access
  - Consent management
  - Header and navigation
  - Null state views

#### TLOP-983: Spending Details (Claims w/accumulators)
- **Status**: ✅ Completed
- **Priority**: High
- **Description**: Medical/Dental spending with plan accumulator data
- **Key Deliverables**:
  - Individual vs Family toggle
  - Member dropdown
  - Claim activity display
  - Accumulator tracking

#### TLOP-1454: Copay/Coinsurance
- **Status**: ✅ Completed
- **Priority**: High
- **Description**: Transparent cost-sharing information
- **Key Deliverables**:
  - Copay amounts by service
  - Coinsurance percentages
  - Deductible rules

### Enhancement Epics

#### TLOP-1945: Caremark Plan Disruptions MVP
- **Status**: ✅ Completed
- **Priority**: High
- **Description**: Alert members to plan changes
- **Key Deliverables**:
  - Disruption banner on Benefits landing
  - Disruption flow routing
  - Plan change notifications

#### TLOP-1948: OCR/AI for Request Reimbursement
- **Status**: ✅ Completed
- **Priority**: Medium
- **Description**: AI-powered receipt processing
- **Key Deliverables**:
  - Receipt upload
  - OCR field extraction
  - Form pre-population

#### TLOP-1950: Prescription YTD Summary
- **Status**: ✅ Completed
- **Priority**: Medium
- **Description**: Retail & Specialty prescription spending
- **Key Deliverables**:
  - YTD spending totals
  - Retail vs Specialty breakdown
  - Claim-level details

#### TLOP-1953: Find Care Compliance Gaps
- **Status**: ✅ Completed
- **Priority**: High
- **Description**: Federal/state compliance for provider search
- **Key Deliverables**:
  - Compliance disclaimers
  - Regulatory requirements met
  - State-specific rules

#### TLOP-1954: Executive Medical & BFD Plan Types
- **Status**: ✅ Completed
- **Priority**: Medium
- **Description**: Support additional plan types
- **Key Deliverables**:
  - Executive Medical plan support
  - BFD plan type support
  - Plan-specific rules

#### TLOP-2276: Spending Details - Individual vs Family Toggle
- **Status**: ✅ Completed
- **Priority**: Medium
- **Description**: Enhanced spending view controls
- **Key Deliverables**:
  - Individual/Family toggle
  - Member dropdown for families
  - Filtered spending views

### Point Solutions Epics

#### TLOP-2681: Solera Point Solutions MVP
- **Status**: 🟡 In Progress
- **Priority**: Medium
- **Target**: Dec 2025 / Q1 2026
- **Description**: Wellness program integration via Solera
- **Key Deliverables**:
  - Solera entry point on Benefits landing
  - Program discovery section
  - Enrollment flow
  - Committed program display
  - Program carousel

#### TLOP-2773: Solera Payor Agnostic
- **Status**: 🟡 Pending Approval
- **Priority**: Medium
- **Description**: Extend Solera to non-Caremark members
- **Key Deliverables**:
  - Insurance lookup/verification
  - WellBridge questionnaire
  - Broader payor support
  - Pilot audience targeting

#### TLOP-2775: Health Gateway MVP
- **Status**: 🟡 Pending Approval
- **Priority**: Medium
- **Description**: Personalized health program marketplace
- **Key Deliverables**:
  - Program recommendations
  - Search functionality
  - Family member support
  - Cost/coverage transparency
  - Haio AI integration

### AI & Advanced Features

#### TLOP-4002: Benefits On-Page AI Summarization (Phase 1)
- **Status**: 🟡 In Progress
- **Priority**: Highest
- **Target**: Q2 2026
- **Description**: AI summaries for Plan Summary and Claims
- **Key Deliverables**:
  - Plan Summary AI button
  - Claims AI explanation
  - Haio CTA and handoff
  - Context passing to agent
  - Intent journey support

#### TLOP-4045: Find Care - Create Disclaimers Section
- **Status**: 🟡 In Progress
- **Priority**: Medium
- **Description**: Legal disclaimers for Find Care
- **Key Deliverables**:
  - Disclaimers section UI
  - Compliance text
  - State-specific rules

#### TLOP-4220: AH Cost Estimator Tool Single Code
- **Status**: 🟡 Pending Approval
- **Priority**: Medium
- **Description**: Medical procedure cost estimation
- **Key Deliverables**:
  - CPT code lookup
  - Cost estimation
  - Out-of-pocket calculation
  - Provider comparison

### Technical & Support Epics

#### TLOP-2687: 2026 Q1 Postponed Defects Remediation
- **Status**: 🟡 In Progress
- **Priority**: High
- **Description**: Fix deferred medium/low defects from 2025 MVPs
- **Scope**: All teams (Team 1, Team 2, Flutter)

#### TLOP-2778: Android - Analysis for CDC, Claims, DMR, Plan Spending, YTD
- **Status**: ✅ Dev Complete
- **Priority**: Low
- **Description**: Feature flag analysis for Android
- **Key Flags**:
  - `benefits-drug-pricing` (100%)
  - `open-platform-submit-claim` (100%)
  - `open-platform-aetna-claims` (100%)
  - `open-platform-planspending-details` (100%)
  - `benefits-year-to-date-spending` (100%)

#### TLOP-2782: New Relic to Datadog Migration
- **Status**: 🟡 Ready To Start
- **Priority**: High
- **Description**: Migrate monitoring from New Relic to Datadog

#### TLOP-2783: Flutter Error Tracing, Monitoring & Telemetry
- **Status**: 🟡 Ready To Start
- **Priority**: High
- **Description**: Implement error tracking for Flutter components

#### TLOP-3380: H100 Design Changes for Benefits/Open Platform (4/2 Launch)
- **Status**: ✅ Completed
- **Priority**: High
- **Description**: Design updates for April 2026 launch

---

## Technical Architecture

### API Integrations

**Caremark APIs:**
- Plan summary data
- Deductible information
- Prescription claims
- YTD spending
- Drug pricing
- Copay/coinsurance

**Aetna APIs:**
- Medical/Dental/Vision plan data
- Claims history
- Accumulators
- Provider search
- Cost estimator

**Solera APIs:**
- Program eligibility
- Enrollment status
- Committed programs
- Questionnaire results

**WellBridge APIs:**
- Health questionnaire
- Program recommendations
- Enrollment completion

### Feature Flags (LaunchDarkly)

**Drug Pricing:**
- `benefits-drug-pricing` - Show/hide drug pricing (100%)
- `open-platform-cdc-specialty-pagination` - Specialty pagination (100%)
- `open-platfrom-drugsearch-by-name` - Drug search (100%)
- `drug-pricing-future-plans` - Future plans support (100%)
- `open-platform-precisely-v2` - Precisely v2 integration

**Claims:**
- `open-platform-submit-claim` - Submit claim flow (100%)
- `open-platform-submitted-claim-history` - Claim history (100%)
- `open-platform-aetna-claims` - Aetna claims (100%)
- `open-platform-claims-processed-filters` - Claim filters (100%)

**Plan Spending:**
- `open-platform-planspending-details` - Spending details (100%)
- `open-platform-planspending-details-aetna` - Aetna spending (100%)

**YTD Spending:**
- `open-platform-benefits-ytd-spending` - YTD spending (100%)
- `benefits-year-to-date-spending` - YTD display (100%)

### Microapp Integration

**Aetna Microapp:**
- Plan picker dropdown
- Spending details navigation
- Service usage tracking
- Neutral/white header override (not Aetna purple)

**Figma**: [Aetna Microapp](https://www.figma.com/design/oYR4pb7H0uxGKlvqjn8Y93/MLP-HS---Designs-for-Dev-Handoff?node-id=7862-27542)

### Component Library

**Shared Components:**
- Plan summary cards
- Deductible progress bars
- Claim cards
- Provider cards
- ID card display
- Toggle switches (Individual/Family)
- Dropdown selectors (Member picker)

**Figma**: [Component Library](https://www.figma.com/design/YErM8wIMAiq6axqdOwU9VI/Open-Platform-Component-Library?node-id=1-2)

---

## User Personas & Journeys

### Persona 1: Caremark-Only Customer

**Profile:**
- Has Caremark pharmacy benefits
- No Aetna medical coverage
- Primarily uses app for prescription management

**Benefits Landing View:**
- Sees Caremark plan summary only
- Caremark ID card access
- Pharmacy spending link
- Copay/coinsurance link
- No Aetna section

**Key Journeys:**
1. View prescription deductible progress
2. Check copay for specific drug
3. Access digital ID card
4. Submit prescription reimbursement claim
5. View YTD pharmacy spending

### Persona 2: Aetna-Only Customer

**Profile:**
- Has Aetna medical/dental/vision benefits
- No Caremark pharmacy coverage
- Uses app for medical claims and provider search

**Benefits Landing View:**
- Sees Aetna plan summary only
- Aetna ID card access
- Medical spending link
- Plan documents link
- No Caremark section

**Key Journeys:**
1. View medical deductible progress
2. Find in-network provider
3. Check claim status
4. Access digital ID card
5. View spending details

### Persona 3: Dual Customer (Caremark + Aetna)

**Profile:**
- Has both Caremark and Aetna benefits
- Uses app for comprehensive health management
- Most common persona

**Benefits Landing View:**
- Sees Caremark section first
- Sees Aetna section second
- Both ID cards accessible
- Links to both pharmacy and medical spending

**Key Journeys:**
1. View both pharmacy and medical deductibles
2. Compare pharmacy vs medical spending
3. Access both ID cards
4. Submit claims for both pharmacy and medical
5. Find care and check drug pricing

### Persona 4: Family Subscriber with Dependents

**Profile:**
- Subscriber with spouse and/or children
- Manages benefits for entire family
- Needs family-level and individual-level views

**Benefits Landing View:**
- Family deductible displayed
- Member dropdown to filter by family member
- Individual/Family toggle
- Dependent ID cards

**Key Journeys:**
1. Toggle between individual and family deductibles
2. Select specific family member to view their claims
3. Track family out-of-pocket max progress
4. Access dependent ID cards
5. View spending by family member

### Persona 5: Wellness-Focused Member

**Profile:**
- Interested in preventive health programs
- Eligible for Solera wellness programs
- Proactive about health management

**Benefits Landing View:**
- Sees "More programs to support your health" section
- Solera entry point visible
- Committed/enrolled programs displayed

**Key Journeys:**
1. Discover available wellness programs
2. Complete Solera health questionnaire
3. Enroll in recommended programs (Weight Watchers, diabetes management)
4. Access enrolled programs from Benefits landing
5. Track program engagement

### Persona 6: Payor Agnostic User (Future)

**Profile:**
- Has insurance but not Caremark
- Wants to check Solera program eligibility
- Needs to verify coverage

**Benefits Landing View:**
- Sees Benefits tab (via Solera targeting)
- Insurance lookup/verification flow
- WellBridge entry point

**Key Journeys:**
1. Add insurance information
2. Verify coverage for wellness programs
3. Complete WellBridge questionnaire
4. Enroll in eligible programs
5. Access programs from Benefits

---

## Integration Points

### 1. Homescreen Integration

**Entry Points:**
- Benefits tab in bottom navigation
- Benefits card on homescreen (for eligible members)
- Push notifications for plan disruptions
- Deep links from notifications

### 2. Pharmacy Integration

**Connections:**
- Drug pricing from Benefits → Pharmacy
- Prescription claims in Benefits
- Copay information shared
- YTD spending includes pharmacy

### 3. Find Care Integration

**Connections:**
- Provider search from Benefits
- Cost estimator integration
- In-network provider filtering
- Plan-specific provider networks

### 4. Chatbot (Haio) Integration

**Connections:**
- AI summarization → Haio handoff
- Benefits questions routed to Haio
- Context passing from AI summaries
- Intent-based conversations

### 5. Third-Party Program Integration

**Solera:**
- Program discovery
- Enrollment status
- Committed program display
- Questionnaire completion

**WellBridge:**
- Health questionnaire
- Program recommendations
- Enrollment flow

**Partner Programs:**
- Weight Watchers
- Diabetes management platforms
- Mental health apps
- Fitness programs

### 6. Adobe Analytics

**Tracking:**
- Page views (Benefits landing, Plan Summary, Claims)
- User actions (tap ID card, view spending, submit claim)
- Conversion funnels (Solera enrollment)
- Engagement metrics (time on page, scroll depth)

### 7. Quantum Metric

**Monitoring:**
- User session replay
- Error tracking
- Performance monitoring
- Heatmaps and click tracking

---

## Business Rules & Logic

### 1. Plan Display Rules

**Active Plans Only:**
- Only display currently active plans
- Inactive plans are hidden
- Plan transitions (inactive → active) not yet supported

**Plan Type Eligibility:**
- ✅ Commercial plans
- ✅ Executive Medical
- ✅ BFD plans
- ❌ Medicare/MedD (out of scope for MVP)
- ❌ STCOB plans

### 2. Deductible Display Rules

**Individual vs Family:**
- Subscriber with dependents → Show family deductible
- Subscriber with no dependents → Show individual deductible
- Dependent → Show individual deductible

**PZN Response Handling:**
- API response controls deductible and plan summary visibility
- Four combinations supported:
  1. Hide deductible + hide plan summary
  2. Hide deductible + show plan summary
  3. Show deductible + hide plan summary
  4. Show deductible + show plan summary

### 3. Consent Requirements

**Cross-LOB Consent:**
- Caremark + Aetna customer missing consent → Show CTA to enroll
- Caremark-only customer missing consent → Show Caremark consent CTA
- Aetna-only customer missing consent → Show Aetna consent CTA

**Consent Flow:**
- User taps consent CTA
- Consent enrollment modal
- User accepts terms
- Benefits data becomes accessible

### 4. ID Card Display Rules

**Single LOB:**
- Caremark-only → Show Caremark ID card only
- Aetna-only → Show Aetna ID card only

**Dual LOB:**
- Show both Caremark and Aetna ID cards
- Caremark card appears first
- Both accessible via FAB/SIS sheet

**Add to Wallet:**
- iOS → "Add to Apple Wallet" (Caremark only for MVP)
- Android → "Add to Wallet" (Caremark only for MVP)
- Aetna wallet support out of scope for MVP

### 5. Claims Status Rules

**Status Mapping:**
- Approved → Green indicator, "Approved" label
- Pending → Yellow indicator, "Pending" label
- Denied → Red indicator, "Denied" label
- Submitted → Blue indicator, "Submitted" label

**Display Order:**
- Recent claims first (descending date order)
- Filterable by status and date range
- Claim details accessible via tap

### 6. Spending Details Rules

**Individual/Family Toggle:**
- Available only for subscribers with dependents
- Toggles between individual and family spending
- Member dropdown to filter by specific family member

**Accumulator Display:**
- Deductible progress (spent / total)
- Out-of-pocket max progress
- Coinsurance amounts
- Copay totals

### 7. Solera Program Rules

**Committed Program Display:**
- Show programs for 90 days after Solera recommendation
- After 90 days, remove from Benefits landing if not enrolled
- Enrolled programs persist until unenrolled

**Program Discovery:**
- "More programs to support your health" section
- Generic for all users (no filtering in MVP)
- Tap → Solera questionnaire landing page
- No direct condition → questionnaire link in MVP

**Program Management:**
- No unenroll capability in MVP
- No program reordering in MVP
- No program removal based on engagement in MVP

### 8. Payor Agnostic Rules (Future)

**Eligibility:**
- Pilot audience defined by Solera
- Must have Solera-supported payor
- Insurance verification required

**Edge Cases:**
- Caremark Rx + Payor Agnostic Health → TBD
- Multiple payors → TBD
- Additional fields (SSN last 4) → TBD

---

## Test Coverage Requirements

### Critical User Flows (Smoke Tests)

1. **Benefits Landing Load**
   - ✅ Guest user → No Benefits access
   - ✅ Caremark-only → Caremark section only
   - ✅ Aetna-only → Aetna section only
   - ✅ Dual customer → Both sections, Caremark first

2. **Plan Summary Display**
   - ✅ Deductible information visible
   - ✅ Individual vs Family correct
   - ✅ Spent/Remaining amounts accurate
   - ✅ Links to spending details work

3. **ID Card Access**
   - ✅ Tap ID card button
   - ✅ Card displays with member ID, group number
   - ✅ Share functionality works
   - ✅ Add to Wallet (iOS/Android)

4. **Claims History**
   - ✅ Claims list displays
   - ✅ Status colors correct
   - ✅ Claim details accessible
   - ✅ Filtering works

5. **Spending Details**
   - ✅ Individual/Family toggle works
   - ✅ Member dropdown filters correctly
   - ✅ Accumulator data accurate
   - ✅ Navigation from plan summary works

### Regression Tests

1. **Consent Management**
   - Missing consent → CTA displayed
   - Consent enrollment flow
   - Post-consent data access

2. **Plan Disruptions**
   - Banner displays for eligible members
   - Tap banner → Disruption flow
   - Dismissal behavior

3. **Copay/Coinsurance**
   - Information displays correctly
   - Service-specific copays
   - Deductible application rules

4. **Find Care**
   - Provider search works
   - In-network filtering
   - Provider details display
   - Disclaimers visible

5. **YTD Spending**
   - Retail vs Specialty breakdown
   - YTD totals accurate
   - Claim-level details

6. **OCR/AI Reimbursement**
   - Receipt upload
   - Field extraction accuracy
   - Form pre-population
   - Submit claim flow

### Solera Integration Tests

1. **Program Discovery**
   - "More programs" section visible
   - Tap → Solera questionnaire
   - Questionnaire completion
   - Program recommendation

2. **Committed Programs**
   - Program displays after recommendation
   - Carousel scrolling
   - Tap → Partner app/website
   - 90-day expiration

3. **Enrolled Programs**
   - Enrolled program displays
   - Access to program
   - Multiple programs support

### AI Summarization Tests (Future)

1. **Plan Summary AI**
   - AI button visible
   - Tap → Summary displays
   - Haio CTA visible
   - Tap Haio → Context passed

2. **Claims AI**
   - AI explanation for claim
   - Cost breakdown clarity
   - Haio handoff

### Accessibility Tests

1. **VoiceOver/TalkBack**
   - All elements labeled
   - Proper reading order
   - Interactive elements accessible

2. **Dynamic Text**
   - Text scales correctly
   - No truncation at larger sizes
   - Layout adapts

3. **Color Contrast**
   - 4.5:1 ratio minimum
   - Status colors distinguishable
   - Not relying on color alone

4. **Touch Targets**
   - 44×44pt minimum (iOS)
   - 48×48dp minimum (Android)
   - Adequate spacing

### Performance Tests

1. **Page Load Times**
   - Benefits landing < 2s
   - Plan summary < 1.5s
   - Claims list < 2s

2. **API Response Times**
   - BE APIs < 2500ms
   - Overall experience < 3500ms

3. **Memory Usage**
   - No memory leaks
   - Efficient image loading
   - Proper cleanup

### Negative Test Scenarios

1. **API Failures**
   - Network timeout → Error state
   - 500 error → Retry mechanism
   - Invalid data → Graceful degradation

2. **Missing Data**
   - No deductible data → Hide section
   - No claims → Empty state
   - No programs → Hide Solera section

3. **Invalid User States**
   - No consent → CTA displayed
   - Inactive plan → Not displayed
   - Expired session → Re-authentication

---

## Known Issues & Limitations

### MVP Limitations

**Out of Scope:**
- Medicare/MedD plans
- STCOB plans
- Inactive → active plan transitions
- Active → inactive plan handling
- Caremark plan name from API (hardcoded for MVP)
- Aetna Add to Wallet (only Caremark supported)

**Solera MVP Limitations:**
- No condition-specific filtering in "More programs" section
- No direct condition → questionnaire link
- No program unenroll capability
- No program reordering
- No program removal based on engagement
- 90-day committed program expiration (Solera-driven)

**AI Summarization Limitations (Phase 1):**
- Only Plan Summary and Claims
- No other intent support
- Haio handoff required for deeper questions

### Known Technical Debt

**Feature Flags:**
- Many flags at 100% deployment (candidates for removal)
- `open-platform-precisely-v2` status unknown

**Postponed Defects:**
- Medium/Low defects from 2025 MVPs deferred to Q1 2026
- Tracked in TLOP-2687

**Monitoring Migration:**
- New Relic → Datadog migration pending (TLOP-2782)
- Flutter error tracing not yet implemented (TLOP-2783)

### Future Enhancements

**Health Gateway:**
- Personalized program recommendations
- Search by name/category
- Family member program discovery
- Cost/coverage transparency upfront
- Guest experience for non-insured users

**Cost Estimator:**
- Multi-code support (beyond single CPT)
- Provider cost comparison
- Out-of-pocket estimation

**Program Management:**
- Unenroll capability
- Program reordering
- Engagement-based removal
- Dedicated Partner Hub

**Spanish Translation:**
- Benefits page translation
- Third-party site translation (partner-dependent)

---

## Appendix

### Key Confluence Pages

1. [Benefits Landing and Open Platform](https://cvsdigital.atlassian.net/wiki/spaces/DC/pages/4767188403)
2. [Open Platform High-Level Requirements](https://cvsdigital.atlassian.net/wiki/spaces/SESA/pages/4486168972)
3. [Open Platform Jan/Feb Features: Benefit Team Requirement Feedback](https://cvsdigital.atlassian.net/wiki/spaces/~62ec199bc1b3a10ac3aabb01/pages/4937496041)
4. [Open Platform Oct, Nov, Dec Features: Benefit Team Requirement Feedback](https://cvsdigital.atlassian.net/wiki/spaces/~62ec199bc1b3a10ac3aabb01/pages/4780655403)
5. [BFF - Plan Disruption - Solution](https://cvsdigital.atlassian.net/wiki/spaces/SESA/pages/5346885843)
6. [Spending Details Architecture](https://cvsdigital.atlassian.net/wiki/spaces/NGX/pages/4921394910)

### Key Figma Files

1. [2026 — Open Platform — Benefits Integration](https://www.figma.com/design/OujotMMgZTLcNoGJc8bili/Open-Platform-%E2%80%94-Benefits-Integration)
2. [Solera Integration - Point Solutions](https://www.figma.com/design/fWvjQs42KFn95mzaW8qbju/Solera-Integration---Point-Solutions)
3. [Payor Agnostic - Point Solutions](https://www.figma.com/design/GRktNyzc9EiC9gBPZvlTv8/Payor-Agnostic---Point-Solutions)
4. [Partner Hub](https://www.figma.com/design/gCH1Nr38EiXj4kWlwWRrcR/Partner-Hub)
5. [Benefits AI Explorations](https://www.figma.com/design/IJvx2lVBjfo7KDjcNHYmMn/Benefits-Ai-explorations)
6. [Open Platform Component Library](https://www.figma.com/design/YErM8wIMAiq6axqdOwU9VI/Open-Platform-Component-Library)

### JIRA Board

- **Project**: TLOP (Open Platform)
- **Board**: [Open Platform Board](https://cvsdigital.atlassian.net/jira/software/c/projects/TLOP/boards/7266/backlog)
- **Cloud ID**: c08225c2-3ed9-4a44-8526-4f5589f2b403

### Related Projects

- **TLOHPAPPHS**: Homescreen team
- **TLSASEASNA**: SNAPP team
- **TLDAS**: Accessibility defects

---

**Document Maintainer**: AI Agent  
**Last Epic Reviewed**: TLOP-4220 (April 23, 2026)  
**Total Epics Documented**: 25+  
**Coverage**: Complete from inception (TLOP-5) to latest (TLOP-4220)
