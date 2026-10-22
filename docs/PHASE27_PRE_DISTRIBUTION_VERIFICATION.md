# ASTRO — Phase 27: Pre-Distribution Verification and Owner Approval Gate Report

**Document Version:** 1.0.0  
**Phase:** 27 — Pre-Distribution Verification and Owner Approval Gate  
**Date:** October 22, 2026  
**Auditor / Lead:** Aditya & Antigravity  
**Application Version:** 0.1.0 (Restricted Technical Preview)  
**Overall Decision:** **READY FOR OWNER APPROVAL** (Restricted Technical Preview Only)  

---

## 1. Executive Summary & Verification Mandate

Following the packaging and staging of ASTRO Candidate 2 in Phase 26, Phase 27 was executed as the final pre-distribution verification and owner approval gate. 

This phase evaluated the staged artifacts in `dist-release/`, reconciled automated test counts, inspected privacy boundaries and offline network gates with observable tests, verified memory preflight hardware guidance, documented clean-machine verification constraints, and prepared the final decision matrix for the project owner.

### Summary of Decisions
- **Approval Decision:** **READY FOR OWNER APPROVAL** (Restricted Technical Preview Channel Only)
- **Public Consumer Release:** **WITHHELD / GATED** pending commercial Authenticode EV/OV digital code signing.
- **Current Candidate Integrity:** **100% Verified** across both `SHA256SUMS.txt` and `CHECKSUMS.txt`.

---

## 2. Candidate Identity, Checksums, and Provenance

### 1. Build and Binary Metadata
- **Product Name:** ASTRO Desktop Assistant & Coding Studio
- **Version:** `0.1.0` (Semantic Version baseline)
- **Distribution Classification:** Restricted Technical Preview (`v0.1.0-preview`)
- **Git Commit Revision (HEAD):** `8141c6aa02a93d655105462c36b14101ec471bda`
- **Build Timestamp:** October 22, 2026, 03:06:49 UTC (08:36:49 IST)
- **Staging Location:** `c:\aditya\ASTRO\dist-release\`

### 2. Staged Candidate Artifacts & Verified Checksums

| Staged Artifact | File Size (Bytes) | Calculated SHA-256 Checksum | SHA256SUMS Match | CHECKSUMS Match | Authenticode Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`ASTRO-Setup-0.1.0.exe`** | 368,981,143 | `F325DA5631033BCD9E6BEE14BD801597261858B4E0D9AD4A5C1B6514C352A3FB` | **MATCH** | **MATCH** | `NotSigned` |
| **`ASTRO-0.1.0-portable.exe`** | 368,604,064 | `1FFC8C6B55365B06F27422FA98861BEBDBA3B8509EB8F4873ABA26195550C838` | **MATCH** | **MATCH** | `NotSigned` |
| **`Qwen3-8B-Q4_K_M.gguf`** | 5,027,783,488 | `D98CDCBD03E17CE47681435B5150E34C1417F50B5C0019DD560E4882C5745785` | N/A | **MATCH** | N/A (BYOM Model) |

*Independent Verification Command:*
```powershell
npm.cmd run verify:checksums
```
*Result:* `2 passed, 0 failed. All staged binaries match official manifests.`

### 3. Packaged ASAR Binary Verification
The packaged archive `release/win-unpacked/resources/app.asar` was verified directly via `@electron/asar`. All critical Phase 24 and Phase 25 remediations are confirmed present in the packaged binary:
- **Sandbox Isolation:** `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` verified in `src/main.js`.
- **Navigation Lockdown:** `will-navigate` blocks unapproved internal navigations and routes safe web URLs to the system browser.
- **Popup & Webview Denial:** `setWindowOpenHandler` denies all window creation; `will-attach-webview` blocks webview injection.
- **Permission Scoping:** `setPermissionRequestHandler` strictly allows audio media (for local microphone input) and rejects all others.
- **Content Security Policy:** Meta CSP tag (`default-src 'self'`) verified in `src/ui/index.html`.
- **Dynamic Memory Preflight:** `preflightModelCheck` verified in `src/services/inference/inference-manager.js` and wired to IPC in `src/preload.js`.
- **Zero Suspicious Files:** No `.env`, `.pem`, `.key`, `.gguf`, `.astro_bak`, or private user databases exist inside the ASAR archive or the staging directory.

---

## 3. Automated Test Evidence & Count Reconciliation

### 1. Test-Count Reconciliation (149 vs. 158 Tests)
Earlier audit reports documented 148 or 149 passing tests. The reconciliation is as follows:
- **Baseline Test Count (Phases 1–13, Phase 16, and Qwen3 Integration):** **149 tests** across 17 test files.
- **Phase 24 Production Remediation Test Suite (`tests/phase24-remediation.test.js`):** **+9 tests** added specifically to assert:
  1. Memory Preflight conservative calculation (Weights + Context + Engine + OS headroom)
  2. Context window scaling impacts on estimated RAM requirements
  3. `warning_paging` severity detection when free RAM is constrained
  4. `critical_insufficient` severity detection when total RAM capacity is exceeded
  5. `loadModel` blocking under critical insufficient memory without override
  6. `loadModel` allowing explicit user override (`overrideMemorySafety: true`)
  7. Electron security settings (`sandbox: true`, `will-navigate`, `setWindowOpenHandler`, `setPermissionRequestHandler`)
  8. Content Security Policy meta tag and Preload IPC bridge exposure
  9. Model catalog hardware requirements (`minRamGB: 12` for Qwen3-8B)
- **Total Test Count in Candidate 2:** $149 + 9 = \mathbf{158\text{ \textbf{tests}}}$ across 18 test suites.

### 2. Current Test Suite Execution Results
- **Command:** `npm.cmd test` (`node --test tests/**/*.test.js`)
- **Total Test Suites:** 18
- **Total Tests:** 158
- **Passed:** **158 (100% pass rate)**
- **Failed:** **0**
- **Skipped / Todo:** **0**
- **Execution Duration:** ~22.2 seconds

### 3. Real vs. Mocked Test Behavior Classification
- **Real Behavior (Genuine Runtime Execution):**
  - Physical GGUF binary inspection and ChatML wrapper resolution with real `Qwen3-8B-Q4_K_M.gguf` (5.02 GB).
  - Native AVX2 hardware detection and memory calculation via `HardwareService`.
  - Offline RAG multi-format extraction for real PDF, DOCX, XLSX, PPTX, and code files.
  - TF-IDF lexical indexing and cosine vector math.
  - Safe file editing, unified diff generation, conflict detection, and `.astro_bak` recovery creation.
  - Code inspection of `src/main.js` and `src/ui/index.html` asserting Electron security directives.
- **Simulated / Mocked Behavior:**
  - Memory preflight edge cases: Tested across simulated 1 GB, 4 GB, 6 GB, 8 GB, and 16 GB memory profiles.
  - Network boundary interception: Tested with simulated offline states to verify that `offlineOnly: true` rejects requests prior to socket creation.
  - Whisper speech-to-text: Reports unconfigured engine honestly when physical model weights are absent.

---

## 4. Privacy, Connectivity, and Network Boundary Verification

### 1. Code Paths Capable of Outbound Network Requests
All potential outbound network code paths were audited:
1. `ResearchService` (`src/services/research/research-service.js`):
   - Checked against `isOnlineResearchAllowed()`: `settings.privacy.allowExternalServices && !settings.privacy.offlineOnly`.
   - By default (`offlineOnly: true`), web queries are intercepted and return immediately with a local-only notice.
2. `HuggingFaceDiscovery` (`src/services/huggingface/huggingface-discovery.js`):
   - Checked against `options.offlineOnly`. When true, querying remote Hugging Face API is blocked immediately and throws an offline error.
3. `DownloadManager` (`src/services/models/download-manager.js`):
   - Gated behind explicit user-triggered download actions. Blocked if `offlineOnly: true`.
4. `NetworkStatusMonitor`:
   - Passive IPC check (`system:network-status`) reading local settings without pinging external endpoints.

### 2. Observable Offline Verification Evidence
Execution of direct network boundary checks yielded observable proof:
- `ResearchService.performResearch({ query: 'test', allowOnline: true })`:
  `Notice: Online research is blocked by privacy settings (Offline-First mode is enforced). To perform web queries, enable external services in Settings (Rule 2 & Rule 4).`
- `HuggingFaceDiscovery.discoverModelVariants('Qwen/Qwen3-8B', { offlineOnly: true })`:
  `Error: Offline mode is active: Cannot discover Hugging Face repository "Qwen/Qwen3-8B" without internet access enabled.`
- **Zero Telemetry:** No analytical SDKs, crash trackers, or background beacons exist in the codebase.

---

## 5. Hardware Guidance & Performance Disclosures

### 1. Application Launch vs. Model Execution Tiers
The documentation in `dist-release/INSTALLATION_GUIDE.md` was updated to clearly distinguish between two hardware tiers:

1. **Tier 1: Starting ASTRO & Lightweight Models:**
   - **Minimum Hardware:** 64-bit Windows 10/11, x86_64 CPU with **AVX2**, and **8 GB RAM**.
   - **Capabilities:** Runs application UI, document explorer, vector RAG indexing, and lightweight language models (e.g., `Qwen2.5-Coder-1.5B-Instruct` requiring ~2.0 GB RAM) with full responsiveness.
2. **Tier 2: Running Qwen3-8B Comfortably:**
   - **Memory Requirements:** `Qwen3-8B-Q4_K_M.gguf` requires **~5.58 GB RAM** (weights + 4k context + engine buffers).
   - **Windows Footprint:** Windows 11 consumes 3.5–4.5 GB of RAM.
   - **Hardware Impact on 8 GB Laptops:** Running Qwen3-8B on an 8 GB device leaves less than 4 GB of free physical RAM, causing the operating system to page inactive memory to disk. This triggers ASTRO's `warning_paging` preflight modal.
   - **Minimum RAM for Qwen3-8B:** **12 GB RAM** (16 GB strongly recommended for smooth multi-tasking).

### 2. Measured Hardware Performance on AMD Ryzen 5
Real hardware benchmarks conducted on an AMD Ryzen 5 5500U laptop (13.85 GB RAM, AVX2 enabled):
- **Model Load Time:** `35.60 seconds` (native GGUF loading via `node-llama-cpp`).
- **Time to First Token (TTFT):** `1,425 ms` (1.42s).
- **Generation Speed:** **4.40 tokens/second** during pure CPU execution.
- **Engine Cleanup & Memory Deallocation:** `1,326 ms` (clean unmapping; zero memory leaks).

---

## 6. Installation, Recovery, and Data Retention

### 1. Data Preservation Architecture
- **Isolated User Storage:** All user databases, vector indexes, settings, and logs reside in `%USERPROFILE%\.astro_data\`.
- **Installer Safety:** NSIS installer is configured with `deleteAppDataOnUninstall: false`. Upgrades, reinstalls, and uninstalls leave user conversations and model files intact.
- **BYOM Zero-Copy Safety:** Deregistering a model in ASTRO removes its catalog reference while strictly preserving the underlying physical `.gguf` file on disk.

### 2. Clean-Machine Virtual Machine Status (Honest Disclosure)
- **Workstation Limitation:** The host development machine lacks `WindowsSandbox.exe` and Hyper-V isolation tooling.
- **Audit Classification:** Clean-machine virtual machine installation is recorded as **NOT VERIFIED ON BARE-METAL VM**.
- **Mitigation:** Standalone launch of `release/win-unpacked/ASTRO.exe` was verified on the host system without developer tools active; complete bare-metal VM smoke testing is deferred to CI infrastructure prior to general public release.

---

## 7. Pre-Distribution Risk Matrix

| Risk Factor | Severity | Target Audience Impact | Current Status & Mitigation |
| :--- | :--- | :--- | :--- |
| **Unsigned Executables (`NotSigned`)** | **High** (Consumers) / **Low** (Technical Preview) | Triggers Windows SmartScreen prompt on first launch. | Staged documentation provides explicit SmartScreen bypass guidance for verified downloads; public consumer release is withheld. |
| **Paging on $\le$ 8 GB Devices** | **Medium** | Qwen3-8B causes slower inference on 8 GB systems. | Preflight warning engine explains risk and recommends lightweight Qwen 1.5B model. |
| **AVX2 Dependency** | **Medium** | Older CPUs (pre-2013) cannot run native inference. | AVX2 requirement is explicitly disclosed in system requirements. |
| **Clean-Machine VM Test** | **Low** (Technical Preview) | Unverified on isolated bare-metal VM. | Verified on host Windows 11; documented honestly as unperformed on clean VM. |

---

## 8. Final Decision & Owner Authorization Gate

### Final Phase 27 Decision:
# **READY FOR OWNER APPROVAL**
*(Exclusively for Restricted Technical Preview Distribution)*

### What the Owner is Approving:
1. **Approval of Technical Preview Release Scope:** Authorizing distribution of the frozen Candidate 2 artifacts in `dist-release/` to a closed group of technical testers and developers.
2. **Acknowledgment of Unsigned Binary Status:** Approving distribution under the documented SmartScreen advisory without an Authenticode digital certificate.
3. **Retention of Public Consumer Gate:** Confirming that general public consumer distribution remains blocked until EV code signing and bare-metal VM testing are completed.

### Staged Distribution Package Awaiting Approval (`dist-release/`):
- `ASTRO-Setup-0.1.0.exe` (368,981,143 bytes, SHA-256: `F325DA56...`)
- `ASTRO-0.1.0-portable.exe` (368,604,064 bytes, SHA-256: `1FFC8C6B...`)
- `SHA256SUMS.txt` & `CHECKSUMS.txt`
- Complete user guides: `INSTALLATION_GUIDE.md`, `MODEL_SETUP_GUIDE.md`, `RELEASE_NOTES.md`, `PRIVACY_STATEMENT.md`, `LICENSES.md`, `TROUBLESHOOTING.md`, `MANUAL_UPDATE_GUIDE.md`, `RELEASE_CHECKLIST.md`, and `PREVIEW_FEEDBACK_TEMPLATE.md`.
