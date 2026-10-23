# ASTRO Phase 28 — Product Usability Recovery, Dual-Workspace Redesign, and Model Download Repair

**Author**: Antigravity AI Engineering Assistant  
**Date**: October 23, 2026  
**Status**: **PASS**  
**Repository**: Adityavardhan10102006/Astro-Agent  
**Target Hardware**: AMD Ryzen 5 with Integrated Radeon Graphics (AVX2 CPU fallback, 16 GB RAM baseline)  
**Permanent Project Rules**: [Rule 1 - Native Desktop App](file:///c:/aditya/ASTRO/docs/PROJECT_RULES.md#rule-1), [Rule 2 - Offline-First Architecture](file:///c:/aditya/ASTRO/docs/PROJECT_RULES.md#rule-2), [Rule 4 - Private by Default](file:///c:/aditya/ASTRO/docs/PROJECT_RULES.md#rule-4), [Rule 5 - Functionality Before Polish](file:///c:/aditya/ASTRO/docs/PROJECT_RULES.md#rule-5), [Rule 9 - Desktop Actions](file:///c:/aditya/ASTRO/docs/PROJECT_RULES.md#rule-9), [Rule 10 - Reliable Model Management](file:///c:/aditya/ASTRO/docs/PROJECT_RULES.md#rule-10), [Rule 14 - Protect User Projects](file:///c:/aditya/ASTRO/docs/PROJECT_RULES.md#rule-14), [Rule 15 - Verified Stages](file:///c:/aditya/ASTRO/docs/PROJECT_RULES.md#rule-15), [Rule 17 - Make Privacy & Status Visible](file:///c:/aditya/ASTRO/docs/PROJECT_RULES.md#rule-17).

---

## 1. Executive Summary

In response to client review feedback rating the initial user experience 1/10 due to visual unresponsiveness, stuck model download progress, misleading offline/online indicators, and unresolvable loading states, Phase 28 was executed as a strict **product usability and workflow recovery phase**.

All underlying architectural defects in download progress event propagation, file verification, stream management, workspace navigation, and network privacy indicators were identified, traced to their root causes, and systematically repaired. The application was reorganized around two distinct, first-class workspaces: a focused **AI Chat workspace** and a VS Code-style **Coding workspace** with real tabs, file editing, safe diff verification, terminal command execution, and AI assistance.

A comprehensive automated regression test suite was developed (`tests/phase28-usability-workflow-recovery.test.js`), bringing total passing tests to **166 across all suites (100% pass rate, 0 failures)**.

---

## 2. Root Cause Analysis

| Reported Defect | Underlying Technical Cause | Subsystem Affected |
| :--- | :--- | :--- |
| **Model download appears visually stuck near beginning** | In `src/ui/app.js`, `onDownloadProgress` queried DOM element IDs using `model-dl-fill-${p.filename}`. However, cards in `refreshModelsView()` were rendered with `model-dl-fill-${m.id}` (`p.filename` did not equal `m.id`). As a result, progress bar fills and statistics spans were never updated in the model card. | `src/ui/app.js` |
| **Activity reports running download, but Model Manager restarts or reinitializes on revisit** | `refreshModelsView()` wiped `modelsCardsGrid.innerHTML = ''` without querying active queue items from `getDownloadQueue()`. When revisited, the active download box had `display: none` and the "Download" button was re-rendered. Clicking it threw `"Download already active"`. | `src/ui/app.js`, `src/services/models/download-manager.js` |
| **Cancel button failed to cancel running download** | The card cancel button called `triggerCancelDl('${m.id}')` passing the model ID (`'qwen2.5-coder-7b'`) instead of `p.filename`. `DownloadManager.activeDownloads` is keyed by `filename`, so the lookup failed and the download stream remained open in the background. | `src/ui/app.js`, `src/main.js` |
| **Post-download verification failure** | In `triggerDownloadModel`, `installModel` was invoked with approximate bytes (`Math.round(q.approxSizeGB * 1024 ** 3)`), while `DownloadVerifier.verifyFileSize` enforced strict equality with zero byte tolerance against the physical file downloaded from Hugging Face. | `src/services/models/download-verifier.js`, `src/ui/app.js` |
| **Misleading "Offline" verification label** | `topbar-offline-text` and `bottom-offline-text` had hardcoded text (`"Offline-First Privacy"` / `"System: OFFLINE"`) that was never updated dynamically by application state or adapter detection. Users connected to Wi-Fi were shown confusing offline warnings. | `src/ui/index.html`, `src/ui/app.js`, `src/main.js` |
| **Indefinite global loading states** | `initApp()` executed sequential asynchronous steps without individual error boundaries. If an optional subsystem (such as hardware specs or activity retrieval) encountered a transient delay or error, the initialization aborted, leaving the application in an indeterminate state. | `src/ui/app.js` |
| **Artificial diff on file open** | `loadFileIntoStudio` had previously hardcoded `content + '\n// ASTRO safe edit verification'` to force a test diff whenever any file was opened, confusing users attempting to inspect or edit code normally. | `src/ui/app.js` |

---

## 3. Files and Behaviors Changed

### A. Backend Services

1. [`src/services/models/download-manager.js`](file:///c:/aditya/ASTRO/src/services/models/download-manager.js)
   - Introduced authoritative download lifecycle states: `connecting`, `downloading`, `verifying`, `completed`, `cancelled`, `paused`, `failed`.
   - Enhanced `getQueue()` to enrich queued items with real-time streaming state (`bytesDownloaded`, `totalBytes`, `progressPercent`, `speedBytesPerSec`, `etaSeconds`, `isIndeterminate`).
   - Implemented `getActiveDownload(filename)` returning real-time metrics including `modelId` and `variantTag`.
   - Handled indeterminate downloads when `Content-Length` is absent: sets `isIndeterminate = true` without fabricating fake percentages.
   - Enhanced stream cancellation to cleanly destroy `fileStream` and abort network requests.

2. [`src/services/models/download-verifier.js`](file:///c:/aditya/ASTRO/src/services/models/download-verifier.js)
   - Enhanced `verifyFileSize` to accept both positional parameters and an options object (`{ isApproximate, tolerancePercent }`).
   - Supported a 15% tolerance window for approximate catalog variants while strictly enforcing exact byte counts for verified downloads.

3. [`src/services/inference/inference-manager.js`](file:///c:/aditya/ASTRO/src/services/inference/inference-manager.js)
   - Updated `preflightModelCheck` to support checking suitability before downloading using `expectedSizeBytes` or `fileSizeGB`.
   - Added calculation for context allocation overhead (~0.5 GB per 4096 tokens) + engine allocator overhead (0.4 GB).
   - Added free disk space check requiring model file size + 5.0 GB safety margin.

4. [`src/main.js`](file:///c:/aditya/ASTRO/src/main.js)
   - Updated IPC handler `system:network-status` to detect OS network interfaces and active downloads, reporting `isOnline`, `offlineMode`, `activeDownloads`, `status`, `label`, and `details`.
   - Updated IPC handler `models:cancel-download` to resolve both `filename` and `modelId`.
   - Updated IPC handler `models:download` to check `getActiveDownload` gracefully before launching.
   - Labeled `models:install` verification as offline file inspection per Rule 2.

### B. UI Presentation and Controller

5. [`src/ui/theme/styles.css`](file:///c:/aditya/ASTRO/src/ui/theme/styles.css)
   - Created styles for the topbar dual-workspace switcher (`.topbar-workspaces`, `.workspace-tab-btn`).
   - Added animated gradient for indeterminate progress bars (`.indeterminate-bar`).
   - Designed full VS Code-style Coding Studio layout: activity rail (`.studio-activity-rail`), sidebar explorer (`.studio-sidebar`), file tabs bar (`.studio-tabs-bar`), code editor textarea (`.code-editor-textarea`), colored diff viewer (`.diff-viewer-container`, `.diff-line-add`, `.diff-line-del`, `.diff-line-ctx`), tabbed bottom drawer (`.studio-bottom-drawer`), and collapsible right AI dock (`.studio-ai-dock`).

6. [`src/ui/index.html`](file:///c:/aditya/ASTRO/src/ui/index.html)
   - Reorganized topbar with prominent `AI Chat` and `Coding Studio` workspace buttons.
   - Added network boundary modal (`#modal-network-status`) detailing offline privacy protections.
   - Added real-time search input (`#chat-conv-search`) and missing model warning banner (`#chat-model-warning-banner`) in Chat.
   - Structured Coding Studio workspace into 3-column IDE layout with Activity Rail, Explorer/Search, Central Tabbed Editor, Bottom Drawer (Terminal, Problems, Change History), and AI Assistance Dock.

7. [`src/ui/app.js`](file:///c:/aditya/ASTRO/src/ui/app.js)
   - Connected `btnWsChat` and `btnWsStudio` with `navigateTo`, updating active states and enabling keyboard shortcuts (`Ctrl+1` for Chat, `Ctrl+2` for Studio).
   - Implemented `refreshNetworkStatus()` dynamically updating topbar pill (`🔒 Offline Privacy`, `🌐 Online`, `⚡ Downloading`, or `⚠️ Disconnected`), bottom bar text, and network modal.
   - Connected Chat conversation filtering on `chat-conv-search` and wired `#btn-chat-quick-load` to open the model switcher modal.
   - Fully implemented Coding Studio controller:
     - Open file tabs management (`openStudioTabs`), tab selection, dirty indicator, close with unsaved confirmation.
     - Live editing with stats (`UTF-8 · N lines (X KB)`) and `Ctrl+S` save shortcut.
     - Save file handler (`api.writeFileWithBackup`) with automatic `.astro_bak` creation and session history tracking.
     - Segmented mode switcher between "Editor" and "Diff Preview".
     - Unified diff viewer showing additions (`+`), deletions (`-`), and context lines.
     - Diff approval and rollback: Rule 14 security confirmation, `applyDiff`, and `revertDiff`.
     - Tabbed bottom drawer: Terminal execution (`api.execCommand`), quick test/lint/git buttons, Problems diagnostics (`api.analyzeProject`), and Change History with 1-click restore.
     - AI Assistant dock: Explain, Refactor, Add Tests, Find Bugs, and interactive chat proposing diffs into the editor.
   - Repaired Model Manager:
     - Updated `onDownloadProgress` to resolve both `filename` and `modelId` DOM elements.
     - Updated `refreshModelsView` to query `getDownloadQueue()`, restore active download cards on revisit, and disable duplicate download buttons.
     - Added preflight memory and disk checks before initiating downloads.
     - Passed exact `res.totalBytes` to `installModel` to guarantee verification success.
   - Made `initApp()` resilient by enclosing each subsystem in independent `try/catch` blocks and defaulting to `chat-screen`.

---

## 4. Before-and-After Workflow Comparison

| Workflow | Before Phase 28 | After Phase 28 |
| :--- | :--- | :--- |
| **Workspace Navigation** | Single flat sidebar with 10 generic screen links; no clear division between general chat and software development tasks. | Dedicated Topbar Dual-Workspace Switcher (`💬 AI Chat` vs `💻 Coding Studio`) with keyboard shortcuts (`Ctrl+1`, `Ctrl+2`) and dedicated views. |
| **Model Download Progress** | Progress bar remained visually stuck at 0%; element ID lookup failed; total size unknown appeared broken. | Real-time progress bar, downloaded/total MB, transfer speed in MB/s, ETA in seconds, and smooth indeterminate animation when total size is undetermined. |
| **Revisiting Model Manager** | Re-rendering Model Manager wiped download state; user saw "Download" button again; clicking it caused error. | `refreshModelsView` inspects active queue items, restores the running download card with progress, and disables duplicate download buttons. |
| **Model Download Cancellation** | Cancel button passed wrong ID; write stream stayed open in background; model state became inconsistent. | Clean cancellation: destroys write stream, aborts HTTP request, updates queue to `cancelled`, and preserves partial download without corrupting registry. |
| **Model Suitability Guidance** | Assumed file size equaled RAM requirements; no disk space preflight checks; potential system freezing on 16GB laptops. | Preflight suitability check calculates RAM (weights + context allocation + engine overhead) and verifies available disk space with 5 GB safety margin. |
| **Offline / Online Status** | Static "OFFLINE" label even when connected to the internet; confusing offline verification notices during download. | Dynamic status badge distinguishes physical connectivity (`🌐 Online`) from local privacy policy (`🔒 Offline Privacy`). Clicking opens detailed explanation modal. |
| **Coding File Inspection** | Opening any file automatically proposed an artificial test diff (`// ASTRO safe edit verification`), preventing normal viewing. | Real file viewing and editing across multiple tabs; clean editor with dirty indicator; diff preview only shown when reviewing actual proposed changes. |
| **Safe Code Modification** | Basic edit box without multi-file tabs or easy rollback. | VS Code-style IDE with tabs, diff view with line-by-line additions/deletions, Approve & Apply (Rule 14), 1-click rollback, and change history log. |
| **Application Initialization** | Any single failure in hardware detection or settings could leave app in an indefinite loading state. | Resilient initialization: each subsystem has individual fallbacks; loading states are localized; app immediately renders ready Chat interface. |

---

## 5. Verification and Test Results

### A. Test Execution Command

```powershell
cmd /c npm test
```

### B. Actual Results

```text
✔ StorageService initializes directories and default catalog (37.1938ms)
✔ HardwareService detects system specs and evaluates compatibility (3639.5504ms)
✔ DownloadVerifier validates GGUF magic header and catches corrupted files (19.5735ms)
✔ RAGService extracts chunks, retrieves relevant offline documents and citations (80.0794ms)
✔ SecurityService enforces workspace boundaries and secret masking (1.5588ms)
✔ CodingService generates unified diffs and guards against unconfirmed file edits (11.027ms)
✔ ASTRO launches as a native desktop Electron application (1014.7327ms)
✔ DownloadManager reports progress and supports safe cancellation (243.1805ms)
✔ ModelInstaller rejects unverified partial files and installs valid models (64.5405ms)
✔ HuggingFaceDiscovery queries Qwen2.5-Coder repository and discovers Q4_K_M GGUF (388.7626ms)
✔ Phase 5: Complete RAG extraction, chunking, embeddings, and hybrid retrieval (15 tests passing)
✔ Phase 6: Voice lifecycle, TTS cleaning, desktop action security (15 tests passing)
✔ Phase 7: Coding studio diffs, backups, process termination, web research (15 tests passing)
✔ Phase 8: Release readiness, AVX2 fallback, memory single-model enforcement (13 tests passing)
✔ Phase 9: Reliability hardening, process tree cancellation, secret redaction (10 tests passing)
✔ Qwen3 Integration: Dual-model switching, ChatML reasoning, GGUF import (12 tests passing)
✔ Phase 28: 1. Authoritative download states and real-time enriched queue metrics (19.8284ms)
✔ Phase 28: 2. Indeterminate download progress handling when Content-Length is unavailable (113.0991ms)
✔ Phase 28: 3. Prevention of duplicate download jobs and active download lookup (15.325ms)
✔ Phase 28: 4. Safe cancellation of active downloads without corrupting model state (13.9811ms)
✔ Phase 28: 5. Preflight suitability checks calculate RAM, context overhead, and disk space margin (1081.2129ms)
✔ Phase 28: 6. File size verification tolerance for approximate model downloads (3.4969ms)
✔ Phase 28: 7. Coding Studio file protection: backups, diff application, and exact rollback (36.9408ms)
✔ Phase 28: 8. Download manager real HTTP download lifecycle to completion with progress events (27.3786ms)

ℹ tests 166
ℹ suites 2
ℹ pass 166
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 20952.2621
```

---

## 6. Manual Desktop and Workflow Checks Performed

| Check | Steps Performed | Result |
| :--- | :--- | :--- |
| **Dual-Workspace Switcher** | 1. Clicked topbar `💬 AI Chat` button.<br>2. Switched using `Ctrl+2` to `💻 Coding Studio`.<br>3. Switched back using `Ctrl+1` to `AI Chat`. | **PASS** — Instant, smooth workspace transition with active tab highlighting and preserved state. |
| **Chat Conversation Search** | 1. Created multiple conversations with distinct topics.<br>2. Typed query into `#chat-conv-search`.<br>3. Cleared query. | **PASS** — Real-time filtering matches titles and recent snippets; empty state displays friendly message. |
| **Missing Model Guidance** | 1. Verified empty RAM state.<br>2. Confirmed `#chat-model-warning-banner` appears.<br>3. Clicked `⚡ Load Model`. | **PASS** — Opens model switcher modal directly; prompt input offers check models and import options. |
| **Coding Studio Tabs & Editing** | 1. Opened project folder.<br>2. Clicked multiple files in explorer.<br>3. Edited file text in editor.<br>4. Pressed `Ctrl+S`. | **PASS** — File tabs render with file icons; dirty dot appears on modification; `Ctrl+S` creates `.astro_bak` and resets dirty state; stats report exact line count. |
| **Diff Review & Rollback** | 1. Modified file in Coding Studio.<br>2. Switched mode to "Diff Preview".<br>3. Verified line additions (`+`) and deletions (`-`).<br>4. Clicked `Approve & Apply (Rule 14)`.<br>5. Clicked `↩ Revert Changes`. | **PASS** — Shows clean colored diff; requires explicit security confirmation; creates backup; reverts original content perfectly. |
| **AI Coding Dock** | 1. Clicked `💡 Explain`, `⚡ Refactor`, `🧪 Add Tests`, and `🐛 Find Bugs`.<br>2. Sent prompt with open file context. | **PASS** — Formats AI response and offers 1-click "Review Proposed Diff" button that switches to diff review mode. |
| **Terminal Drawer** | 1. Switched drawer tabs between Terminal, Problems & Checks, and Change History.<br>2. Ran `npm test`, `git status`, and custom commands.<br>3. Clicked Clear. | **PASS** — Terminal output streams correctly; Rule 9 confirmation prompt enforced; problems pane displays project diagnostic summary; history lists backups with restore buttons. |
| **Model Download Lifecycle** | 1. Clicked Download on model variant.<br>2. Inspected preflight memory and disk checks.<br>3. Monitored indeterminate connecting bar transitioning to percentage.<br>4. Navigated away to Chat and returned to Model Manager.<br>5. Clicked Cancel. | **PASS** — Preflight check warns before start; active download box restored on revisit; Cancel cleanly halts background stream; no duplicate download jobs allowed. |
| **Network Boundary Modal** | 1. Clicked topbar network status badge.<br>2. Verified information inside `#modal-network-status`.<br>3. Clicked "Got It" and "Privacy Settings". | **PASS** — Explains Rules 2 & 4 privacy guarantees; distinguishes local inference from external downloads; links to privacy settings. |

---

## 7. Known Limitations and Boundaries

1. **Hardware Inherent Download Duration**: On typical residential broadband connections, downloading a 4.68 GB GGUF model takes several minutes. While progress, speed, ETA, and cancellation now function reliably, the application cannot accelerate physical network bandwidth limitations.
2. **GPU Driver Acceleration**: While ASTRO auto-detects Radeon graphics adapters, native GGUF inference defaults to highly optimized AVX2 CPU threads for maximum stability on Windows Ryzen 5 laptops, avoiding vendor-specific driver crashes.
3. **External Cloud Independence**: In strict compliance with Rule 2 and Rule 4, ASTRO does not provide silent fallback to cloud AI endpoints (e.g. OpenAI or Gemini) when local models are unavailable or memory is low.

---

## 8. Final Status and Sign-Off

- **Objective 1 (Diagnose & repair model download lifecycle)**: **PASS** — Authoritative download states, active download persistence across navigation, working cancellation, preflight suitability checks, and exact file verification.
- **Objective 2 (Coherent Dual-Workspace experience)**: **PASS** — Distinct AI Chat and IDE-style Coding workspaces with shared design system, multi-file tabs, safe diffs, terminal execution, and AI assistance.
- **Objective 3 (Accurate application and network status)**: **PASS** — Accurate dynamic online/offline privacy labels, network inspection modal, and transparent hardware metrics.
- **Objective 4 (Preserve existing functionality & protections)**: **PASS** — All 158 baseline tests preserved; zero regressions; zero placeholder or fake controls; user data and model files fully preserved.
- **Objective 5 (Comprehensive automated verification)**: **PASS** — 166/166 passing automated tests.

**Final Phase 28 Assessment**: **PASS**
