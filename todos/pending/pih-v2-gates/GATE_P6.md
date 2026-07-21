# GATE_P6 — Profile

Status: PASS (adapted — not pixel MATCH)  
Date: 2026-07-21  
Updated: 2026-07-21 (honest parity; notif-denied wired)  
Implementer: agent  

| Design ID | Live route | Parity | Notes |
|-----------|------------|--------|-------|
| profile | `/(tabs)/account` | **PARTIAL** | skiñcare + JOURNAL20 card. **Deliberate:** existing Account chrome, not pixel clone |
| profile-protocol | `/profile/protocol` | **PARTIAL** | Claim-safe habits. **Deliberate:** overlay on protocol destination |
| profile-share | `/profile/share-with-doctor` | **PARTIAL** | **Deliberate:** reuse existing share route |
| profile-allergens | `/profile/allergens` | **PARTIAL** | **Deliberate:** reuse existing allergens |
| profile-notifications | `/profile/notifications` | **PARTIAL** | Prefs UI shared with allergens; **OS deny →** `/profile/notif-denied` |
| profile-notif-denied | `/profile/notif-denied` | **MATCH** | Wired from notifications when `getNotificationPermissionStatus() === denied` (and Allow CTA deny); Back → Profile (avoids redirect loop) |
| profile-billing | `/billing/choose-plan` | **MATCH** | See GATE_P1 |
| profile-billing-care | `/billing/care-checkout` | **MATCH** | See GATE_P1 |
| profile-records | `/profile/records` | **PARTIAL** | **Deliberate:** advanced hub overlay |
| profile-delete | `/profile/delete-account` | **MATCH** | POST `/api/patient/account/delete` → `purgePatientAccount` including `patient_record_facts` |
| profile-signout | `/profile/sign-out` | **MATCH** | Clear session |

## Unlock → P7
