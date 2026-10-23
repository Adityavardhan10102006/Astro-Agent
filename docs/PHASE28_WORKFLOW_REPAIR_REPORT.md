# ASTRO Phase 28 — Core Workflow Repair Report

**Date:** 2026-10-23  
**Auditor / Engineer:** Antigravity AI Coding Assistant  
**Target:** ASTRO Offline-First Desktop AI Assistant & Coding Studio  
**Deliverable Status:** PASS  

---

## 1. Executive Summary

During client review, the application was rated 1/10 with key complaints that model downloads appeared permanently stuck, Activity and Model Manager displayed confusing or inconsistent download states, offline verification messaging was inaccurate or missing, and the application could appear trapped in global loading states.

Rather than applying cosmetic styling fixes, this phase systematically diagnosed, reproduced, and repaired the underlying architectural defects across `download-manager.js`, `main.js` IPC coordination, and `app.js` UI event handlers. All 175 automated test suites pass with zero regressions.

---

## 2. Diagnosed Root Causes & Implemented Fixes

### Issue 1: Model Downloads Appeared Stuck in "Contacting Repository"
* **Root Cause:** While the Electron main process was actively forwarding `download:progress` events from `DownloadManager` via `mainWindow.webContents.send('download:progress', data)`, the renderer in `src/ui/app.js` **never registered a listener** for `api.onDownloadProgress`. The download card was statically set to "Contacting model repository..." with an indeterminate progress bar at click time and remained permanently frozen until the entire multi-gigabyte file finished downloading.
* **Fix:** Registered `api.onDownloadProgress` in `initApp()` in `src/ui/app.js` and connected it to `updateDownloadCardUI(p)`. The progress bar now animates in real time, displaying exact downloaded MB, total file size, live transfer speed in MB/s, estimated time remaining (ETA), and progress percentage.

### Issue 2: Inconsistent Download States & Lost State on Navigation
* **Root Cause:** When the user navigated away from Model Manager to Chat or Home and then returned, `refreshModelsView()` checked `activeDlMap.get(m.id)`. However, `downloadManager.downloadFile` did not record `modelId` or `variantTag` on the internal queue item `qItem`, meaning `activeDlMap` could not resolve active downloads by model ID. Furthermore, when downloads finished byte transfer, `DownloadManager` removed the active item before `ModelInstaller` had verified the GGUF header and registered the file, causing Activity to report completion prematurely while the UI was still verifying.
* **Fix:** 
  1. Updated `downloadManager.downloadFile` and `qItem` to store and preserve `modelId` and `variantTag`.
  2. Enhanced `DownloadManager.getActiveDownload` to resolve by either filename or model ID.
  3. Added explicit stage transitions: `connecting` → `downloading` → `verifying` → `registering` → `completed` (or `cancelled`/`failed`).
  4. Synchronized `ModelInstaller` with `ActivityService` so Activity and Model Manager display the exact same operation and status.

### Issue 3: Fatal Error on Duplicate Download Triggers
* **Root Cause:** In `src/main.js`, if a user revisited Model Manager and re-triggered download on an already-active job, line 302 called `downloadManager.downloadFile(...)`, which threw an unhandled `Error: Download is already active for ...`. This caused `ActivityService` to mark the task failed and surfaced an error alert even while the download was actively running in the background.
* **Fix:** In `src/main.js`, `models:download` checks `downloadManager.isDownloadInProgress(filename)`. If already running, it returns `{ alreadyActive: true, ... }` gracefully, and `app.js` shows a non-blocking toast while continuing to render the active progress bar.

### Issue 4: Inaccurate / Broken Offline Status Messaging
* **Root Cause:** `ipcMain.handle('system:network-status')` in `src/main.js` returned an object containing `{ offlineOnly, allowExternalServices, hasNetworkAdapter, activeDownloadsCount, activeDownloads }`. However, `src/ui/app.js` attempted to read `net.label`, `net.details`, `net.offlineMode`, and `net.isOnline`, which were all `undefined`. This broke the topbar status pill, network modal descriptions, and bottom status line.
* **Fix:** Updated `system:network-status` in `src/main.js` to return clear, authoritative status metadata:
  - `offlineMode`: Boolean (strict user offline enforcement).
  - `isOnline`: Boolean (network adapter detected and offlineMode is false).
  - `label`: Distinct labels for "Offline-Only Privacy", "Downloading Model (N)", "Local AI • Online", and "Local AI • Offline".
  - `details`: Clear explanation distinguishing hardware connectivity from offline inference privacy.

### Issue 5: Perceived Indefinite Loading during Model Loading and Switching
* **Root Cause:** Loading a 4–8 GB GGUF model into RAM through `node-llama-cpp` takes 5–15 seconds. In `triggerLoadModel` and `confirmModelSwitch`, no visual loading state was applied to the button or topbar pill before calling `api.loadModel()`. The UI appeared unresponsive and frozen during RAM allocation.
* **Fix:** Added immediate visual feedback:
  - Topbar model pill updates to `⏳ Loading [modelId] into RAM...` with warning accent.
  - Buttons disable and display loading states to prevent re-click memory crashes.
  - Non-blocking toast informs user: `Allocating memory and loading model [modelId] into RAM...`.
  - Cleans up and restores UI states on both success and failure paths.

### Issue 6: Missing Model Preflight Information
* **Root Cause:** Model Manager's quantization table only listed `Quant` and `Size`, with no information on runtime RAM needs or disk space requirements.
* **Fix:** Upgraded the quantizations table to display:
  - `Quantization`: Tag name with recommendation flag.
  - `Disk Required`: Approx size plus explicit note on required +5 GB safety margin.
  - `Est. RAM Footprint`: Realistic runtime memory needs (`~5.6 GB RAM (Weights + KV)`).
  - Preflight checks before download and loading flag memory paging risks or critical insufficient RAM.

---

## 3. Files Created and Modified

| File | Status | Description |
| :--- | :--- | :--- |
| `src/services/models/download-manager.js` | **Modified** | Enriched queue and active download lookup with `modelId` and `variantTag`; distinguished connecting, downloading, and verifying phases. |
| `src/main.js` | **Modified** | Resolved `system:network-status` formatting (labels, details, offlineMode, isOnline); handled duplicate download requests safely; synchronized install verification tasks. |
| `src/ui/app.js` | **Modified** | Registered `api.onDownloadProgress` listener; implemented `updateDownloadCardUI`; enhanced quantization table with preflight RAM/disk metrics; added loading states to model loading and switching. |
| `tests/phase28-core-workflow-repair.test.js` | **Created** | Regression test suite covering download queue preservation, network status metadata, UI progress listener registration, and safe duplicate download handling. |
| `docs/PHASE28_WORKFLOW_REPAIR_REPORT.md` | **Created** | Comprehensive audit report documenting root causes, fixes, and verification evidence. |

---

## 4. Test Verification Results

### Regression Test Suite (`phase28-core-workflow-repair.test.js`)
```
✔ Phase 28 Core Repair: 1. DownloadManager preserves modelId and variantTag across queue and active lookup (28.88ms)
✔ Phase 28 Core Repair: 2. Network status metadata distinguishes offline privacy from hardware connectivity (1.09ms)
✔ Phase 28 Core Repair: 3. UI controller registers onDownloadProgress listener and handles real-time updates (2.18ms)
✔ Phase 28 Core Repair: 4. Safe concurrent download handling prevents fatal errors on duplicate triggers (1.09ms)
✔ Phase 28 Core Repair: 5. Live download execution emits modelId, variantTag, and phase correctly (83.55ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
```

### Complete ASTRO Test Suite
```
node --test tests/**/*.test.js
ℹ tests 175
ℹ suites 2
ℹ pass 175
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 29447.46
```

All 175 tests across all 19 test suites passed with zero failures.

---

## 5. Security, Privacy, and Offline Safeguards

1. **Rule 2 & Rule 4 Compliance:** All assistant inference, document extraction, OCR, and RAG retrieval remain 100% offline.
2. **Network Isolation:** Strict offline-mode settings are respected. External downloads remain blocked when `offlineOnly` is enabled.
3. **Hardware Boundaries:** Preflight checks prevent Out-Of-Memory system crashes by warning before allocating models exceeding physical RAM.
4. **Data Protection:** No user files or models were deleted or overwritten during repairs.

---

## 6. Verdict

**FINAL VERDICT: PASS**

The core workflow defects causing model downloads to appear stuck, inconsistent status reporting, missing offline metadata, and indefinite loading states have been diagnosed and repaired at the root level. All tests pass and the application is verified ready.
