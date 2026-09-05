# Maestro Suite Inventory

Generated: 2026-09-01
Scope: `.maestro/flows/`, `.maestro/subflows/`, `.maestro/screens/`

**Totals:** 749 flows · 331 subflows · 100 screen objects

## Flows & Subflows by Feature / Sub-Feature

| Feature | Sub-Feature | Flows | Subflows |
|---|---|---|---|
| **Account** | (direct) | 24 | 3 |
| | authentication | — | 6 |
| | communicationPrefs | — | 5 |
| | dashboard | — | 15 |
| | help | — | 4 |
| | inviteOnly | — | 1 |
| | onboarding | — | 1 |
| | otp | — | 4 |
| | postLogin | — | 4 |
| | registration | — | 1 |
| | signin | — | 3 |
| **Account subtotal** | | **24** | **47** |
| **Adhoc** | — | 1 | 0 |
| **Benefits** | AI_Summary | 5 | 3 |
| | Base | — | 1 |
| | CaremarkUser | 1 | — |
| | Claims | 18 | 16 |
| | Consent | 4 | 1 |
| | Dashboard | 9 | 10 |
| | Documents / PlanDocuments | 9 | 3 |
| | DrugPricing | 17 | 9 |
| | Formulary | 5 | — |
| | IDCard / MemberID | 12 | 6 |
| | InNetworkPharmacy | 6 | 6 |
| | Member | 6 | — |
| | PriorAuth | 6 | 5 |
| | Providers | 11 | 9 |
| | Spending | 10 | 8 |
| | Telehealth | 4 | — |
| | Wellness | 4 | — |
| | YTDSummary / YTD | 4 | 4 |
| **Benefits subtotal** | | **131** | **81** |
| **HAIO** | (direct) | 68 | 0 |
| | account | — | 1 |
| | avs | — | 5 |
| | counsel | — | 3 |
| | intents | — | 35 |
| | interactions | — | 3 |
| | multi-record | — | 2 |
| | navigation | — | 6 |
| | onboarding | — | 2 |
| **HAIO subtotal** | | **68** | **57** |
| **Health** | — | 8 | 12 |
| **Home** | (direct) | 80 | 13 |
| | careRecommendations | — | 1 |
| | medReminders | — | 3 |
| **Home subtotal** | | **80** | **17** |
| **Home-Health100** | — | 39 | 0 |
| **Menu** | — | 27 | 1 |
| **Pharmacy** | (direct) | 5 | 12 |
| | dashboard | — | 1 |
| | prescriptions | — | 1 |
| **Pharmacy subtotal** | | **5** | **14** |
| **SearchAndNav** | — | 115 | 56 |
| **SearchAndNav-Health100** | — | 48 | 0 |
| **Shop** | (direct) | 20 | 6 |
| | cart | — | 3 |
| | checkout | — | 1 |
| | extracare | — | 2 |
| | pdp | — | 2 |
| | plp | — | 2 |
| | store-locator | — | 2 |
| **Shop subtotal** | | **20** | **18** |
| **Smart_Sch** | Authentication | 5 | — |
| | BrowserAgent | 8 | — |
| | cancel | — | 1 |
| | clinic | — | 4 |
| | CounselHealth / counsel | 12 | 2 |
| | ErrorStates | 6 | — |
| | InPerson-Caregivee | 8 | — |
| | InPerson-Self | 11 | — |
| | intent | — | 4 |
| | Lab | 6 | — |
| | MCAsync | 12 | — |
| | Modality | 38 | — |
| | navigation | — | 1 |
| | NLP | 4 | — |
| | NotFound | 6 | — |
| | OutboundCall | 14 | — |
| | Pagination | 3 | — |
| | patient | — | 3 |
| | SelfReference | 26 | — |
| | Vaccine | 3 | — |
| | ViewCancel | 8 | — |
| | Virtual | 4 | — |
| | VisitReason | 9 | — |
| **Smart_Sch subtotal** | | **183** | **15** |
| **Webview** | counsel | — | 1 |
| **Common** | — | 0 | 8 |
| **TOTAL** | | **749** | **331** |

## Screen Objects

Flat by feature — no sub-feature split; one JS file typically covers all sub-features of that area.

| Feature | Screen JS files |
|---|---|
| Account | 27 |
| Shop | 17 |
| Benefits | 10 |
| Health | 10 |
| HAIO | 8 |
| Pharmacy | 7 |
| Smart_Sch | 7 |
| SearchAndNav | 6 |
| Common | 4 |
| Home | 2 |
| Menu | 1 |
| Webview | 1 |
| **TOTAL** | **100** |

## Notes

- `Home-Health100` and `SearchAndNav-Health100` are Health100-app-specific variants of `Home`/`SearchAndNav` and have no corresponding `subflows/` subtree of their own — they reuse `subflows/Home` and `subflows/SearchAndNav`.
- `Common/` under `subflows` (8 files) has no feature-specific flows/screens — shared utility subflows referenced across features.
- Counts reflect current file counts under `.maestro/flows`, `.maestro/subflows`, `.maestro/screens` as of 2026-09-01. `apps/*/suites/` (which group these into CI-run suites), `config/`, and `testdata/` were not counted since the scope was flows/subflows/screens.
