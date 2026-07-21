# GATE_P4 — Track loop

Status: PASS (adapted — not pixel MATCH)  
Date: 2026-07-21  
Updated: 2026-07-21 (honest parity labels)  
Implementer: agent  

## Per-ID parity matrix

| Design ID | Live route | Parity | Notes |
|-----------|------------|--------|-------|
| track-mark | `/capture/mark-picker` | **MATCH** | FAB → mark picker |
| track-guidance | `/capture/guidance` | **MATCH** | Same-light tip; skip-once |
| track-camera | `/capture` | **PARTIAL** | **Deliberate:** existing capture camera (PIH overlay) |
| track-permdenied | `/capture/camera-denied` | **PARTIAL** | **Deliberate:** existing camera-denied |
| track-loading | `/capture/loading` | **PARTIAL** | **Deliberate:** existing loading |
| track-visionfail | `/capture/vision-fail` | **PARTIAL** | **Deliberate:** existing vision-fail |
| track-confirm | `/capture/confirm/skin` | **PARTIAL** | Location chips Face/Chest/Back/Hand/Other on **skin** confirm only — Region machine deferred |
| track-discard | CaptureDiscardDialog | **PARTIAL** | **Deliberate:** existing discard dialog |
| track-reveal | `/capture/reveal/*` | **PARTIAL** | **Deliberate:** existing reveal path (keep 6-tag) |
| track-checkin | `/capture/check-in` | **PARTIAL** | UI + Track hub link MATCH; **known limit:** POST `/api/patient/records/check-in` may 404 — client acknowledges locally (shell until backend lands) |

## Unlock → P5
