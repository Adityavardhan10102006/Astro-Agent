# ASTRO — Phase 26: Final Release Packaging and Distribution Preparation Report

**Document Version:** 1.0.0  
**Phase:** 26 — Final Release Packaging and Distribution Preparation  
**Date:** October 22, 2026  
**Auditor / Build Engineer:** Aditya & Antigravity  
**Application Version:** 0.1.0 (Restricted Technical Preview)  
**Acceptance Status:** **READY FOR OWNER APPROVAL** (Limited Technical Preview Distribution)  

---

## 1. Executive Summary & Acceptance Gate Enforcement

Phase 26 enforces the formal acceptance gate established by [`docs/PHASE25_PRODUCTION_ACCEPTANCE.md`](file:///c:/aditya/ASTRO/docs/PHASE25_PRODUCTION_ACCEPTANCE.md), which rendered an independent audit decision of **CONDITIONAL GO — LIMITED RELEASE ONLY**.

### Acceptance Gate Mandate
1. **Public Consumer Release:** **STRICTLY BLOCKED.** Due to unsigned Windows binary status (`NotSigned`), distributing to a general consumer audience is prevented. Public consumer distribution remains gated until an official Extended Validation (EV) or Organization Validation (OV) Authenticode certificate is procured and integrated into the packaging pipeline.
2. **Restricted Technical Preview:** **APPROVED FOR OWNER AUTHORIZATION.** The candidate is fully frozen, verified, and packaged exclusively for technically adept early adopters, developers, and closed-beta testers with AVX2-capable Windows hardware and $\ge$ 8 GB RAM.
3. **Distribution Policy:** **NO ARTIFACTS ARE PUBLISHED OR DISTRIBUTED BY THIS PHASE.** All binaries, checksums, guides, and licensing documents are staged in `dist-release/` pending explicit, documented owner authorization.

---

## 2. Release Candidate Freeze & Exact Artifact Identities

The release candidate (Candidate 2, rebuilt and audited in Phases 24 and 25) is frozen. No binaries have been modified, re-linked, or overwritten.

### 1. Build & Revision Metadata
- **Product Name:** ASTRO Desktop Assistant & Coding Studio
- **Application Version:** `0.1.0` (Semantic Version baseline)
- **Release Channel:** Restricted Technical Preview (`v0.1.0-preview`)
- **Git Commit Revision (HEAD):** `8141c6aa02a93d655105462c36b14101ec471bda`
- **Build Timestamp:** October 22, 2026, 03:06:49 UTC (08:36:49 IST)
- **Target Platform:** Windows 10 (Build 19041+) / Windows 11 (64-bit x86_64)
- **Packaging Environment:** `electron-builder@26.15.3` / `electron@33.4.11`

### 2. Frozen Release Binaries (Staged in `dist-release/`)

| Artifact Name | File Size (Bytes) | SHA-256 Checksum | SHA-512 Checksum (Prefix) | Authenticode Signature |
| :--- | :--- | :--- | :--- | :--- |
| **`ASTRO-Setup-0.1.0.exe`** | 368,981,143 | `F325DA5631033BCD9E6BEE14BD801597261858B4E0D9AD4A5C1B6514C352A3FB` | `42882121FC814E5B...` | `NotSigned` |
| **`ASTRO-0.1.0-portable.exe`** | 368,604,064 | `1FFC8C6B55365B06F27422FA98861BEBDBA3B8509EB8F4873ABA26195550C838` | `E8EE358E0F1ECB2E...` | `NotSigned` |
| **`Qwen3-8B-Q4_K_M.gguf`** *(External BYOM Model)* | 5,027,783,488 | `D98CDCBD03E17CE47681435B5150E34C1417F50B5C0019DD560E4882C5745785` | N/A (Local GGUF File) | N/A |

### 3. Checksum Integrity Verification
Independent verification was re-executed against the staged directory:
```powershell
npm.cmd run verify:checksums
```
**Output:**
```
====================================================
   ASTRO — Release Checksum Verifier (Phase 19)     
====================================================
Reading manifest: C:\aditya\ASTRO\dist-release\SHA256SUMS.txt

✅ [MATCH]   ASTRO-Setup-0.1.0.exe
            Expected: f325da5631033bcd9e6bee14bd801597261858b4e0d9ad4a5c1b6514c352a3fb
            Actual:   f325da5631033bcd9e6bee14bd801597261858b4e0d9ad4a5c1b6514c352a3fb
✅ [MATCH]   ASTRO-0.1.0-portable.exe
            Expected: 1ffc8c6b55365b06f27422fa98861bebdba3b8509eb8f4873aba26195550c838
            Actual:   1ffc8c6b55365b06f27422fa98861bebdba3b8509eb8f4873aba26195550c838
----------------------------------------------------
Verification Summary: 2 passed, 0 failed
====================================================
```

### 4. Preserved Rollback Baseline (Candidate 1)
Candidate 1 remains isolated and intact in both `release/candidate-1-baseline/` and `dist-release/candidate-1-baseline/`:
- `ASTRO-Setup-0.1.0.exe` (`368,965,251` bytes, SHA-256: `b4bc17b298528079962b827e5d50f7130a6af25c588d174ce15eca9f05208da1`)
- `ASTRO-0.1.0-portable.exe` (`368,588,191` bytes, SHA-256: `9eec822f4092bece1c3dc28576743f4cbfc1a29977d869ff736e75a4954d252f`)

---

## 3. Code Signing Status & Trust Disclosure

### Authenticode Inspection
- **PowerShell Verification Command:**
  ```powershell
  Get-AuthenticodeSignature dist-release\ASTRO-Setup-0.1.0.exe, dist-release\ASTRO-0.1.0-portable.exe
  ```
- **Result:** Both binaries have Status **`NotSigned`**.
- **Assessment:** No commercial certificate was provided or configured on this developer machine. In accordance with Rule 11 and strict phase constraints, no fake signatures, self-signed test root certificates, or deceptive publisher credentials were used.
- **SmartScreen Impact:** First-time users downloading or launching the binaries will encounter the Windows Defender SmartScreen warning (*"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting"*).
- **Technical Preview Mitigation:** Technical preview users must be provided clear instructions on how to independently verify SHA-256 hashes against `dist-release/SHA256SUMS.txt` before choosing to click **"More info"** $\to$ **"Run anyway"**.

---

## 4. Staged Distribution Package Inventory

The release staging directory `dist-release/` contains strictly approved distribution artifacts and user documentation. All machine-specific development paths (`C:\aditya\ASTRO`) have been removed in favor of generalized user environment variables.

| File Name | Size (Bytes) | Category | Purpose |
| :--- | :--- | :--- | :--- |
| **`ASTRO-Setup-0.1.0.exe`** | 368,981,143 | Application Binary | Standard NSIS Windows installer with Start Menu & Desktop shortcuts. |
| **`ASTRO-0.1.0-portable.exe`** | 368,604,064 | Application Binary | Zero-install standalone portable executable (runs from USB or custom folder). |
| **`SHA256SUMS.txt`** | 179 | Security Manifest | Standard SHA-256 hash manifest for command-line verification. |
| **`CHECKSUMS.txt`** | 832 | Security Manifest | Detailed manifest with SHA-256, SHA-512, and file sizes. |
| **`INSTALLATION_GUIDE.md`** | 9,486 | Documentation | Step-by-step setup guide, SmartScreen instructions, and requirements. |
| **`MODEL_SETUP_GUIDE.md`** | 6,386 | Documentation | GGUF model acquisition, Bring Your Own Model (BYOM), and registration guide. |
| **`RELEASE_NOTES.md`** | 6,535 | Documentation | Technical preview feature overview, 158-test baseline, and performance metrics. |
| **`PRIVACY_STATEMENT.md`** | 4,728 | Documentation | Discloses 100% offline local privacy, data boundary, and zero-telemetry architecture. |
| **`LICENSES.md`** | 1,018 | Legal & Attributions | MIT Application license, Apache 2.0 Qwen model licenses, and llama.cpp notices. |
| **`TROUBLESHOOTING.md`** | 7,595 | Support & Recovery | Solutions for missing models, memory paging, AVX2 errors, and crash recovery. |
| **`MANUAL_UPDATE_GUIDE.md`** | 4,593 | Lifecycle & Upgrade | Safe upgrade procedures guaranteeing `%USERPROFILE%\.astro_data\` retention. |
| **`RELEASE_CHECKLIST.md`** | 4,364 | Release QA | Audit checklist verifying offline operation, model switching, and diff guards. |
| **`PREVIEW_FEEDBACK_TEMPLATE.md`** | 2,776 | Quality Assurance | Structured feedback form for technical preview testers. |
| **`candidate-1-baseline/`** | Directory | Provenance | Preserves original baseline binaries and hashes for rollback reference. |

---

## 5. Verification of Package Content, Security & Offline Privacy

### 1. Package Hygiene & Data Isolation
- **No Private Data in Staged Package:** The staging directory was inspected; it contains zero user databases, zero chat histories, zero `.astro_bak` recovery files, zero `.env` credentials, and zero temporary test outputs.
- **Excluded Model Weights:** Model weights (`Qwen3-8B-Q4_K_M.gguf`, 5.02 GB) are **not bundled** into the installer or portable binary, keeping the download compact (~369 MB) and respecting BYOM zero-copy architecture.
- **Isolated User Storage:** Both installer and portable editions store user data exclusively in `%USERPROFILE%\.astro_data\`, completely decoupled from the application executable directory.
- **Uninstall Protection:** NSIS configuration enforces `deleteAppDataOnUninstall: false`. Uninstalling or upgrading ASTRO preserves the user's downloaded models, indexed documents, and chat histories.

### 2. Packaged Application Runtime Security (app.asar Verification)
Direct extraction and inspection of `release/win-unpacked/resources/app.asar` confirmed that all critical security protections are embedded in the compiled binary:
- **Renderer Sandbox:** `sandbox: true` enforced in `webPreferences`.
- **Node Integration Disabled:** `nodeIntegration: false`, `contextIsolation: true`.
- **Navigation Interception:** `will-navigate` blocks all external links and delegates safe URLs to the default system browser via `shell.openExternal`.
- **Window Creation Denial:** `setWindowOpenHandler` blocks unauthorized popups.
- **Webview Prevention:** `will-attach-webview` prevents `<webview>` injection attacks.
- **Permission Scoping:** `setPermissionRequestHandler` strictly allows audio media for Whisper voice input and denies all other system permissions.
- **Content Security Policy:** `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; ... connect-src 'self';">` enforced in `index.html`.
- **Memory Preflight Safeguards:** `preflightModelCheck()` warns users of RAM paging and blocks loading when memory requirements exceed physical capacity.

### 3. Automated Test Suite Final Results
- **Command:** `npm.cmd test` (`node --test tests/**/*.test.js`)
- **Results:** **158 passed, 0 failed, 0 skipped across 18 test suites** in ~21.6 seconds (100% pass rate).

---

## 6. Distribution and Rollback Plan

### 1. Target Audience & Permitted Channel
- **Authorized Distribution Channel:** Private developer repository, authenticated project drive, or direct download link shared exclusively with approved technical preview participants.
- **Prohibited Distribution Channels:** Public Windows Store, public package managers (winget, chocolatey), general consumer websites, or public social media announcements.

### 2. User Prerequisites for Preview Testers
1. **Operating System:** 64-bit Windows 10 (Build 19041+) or Windows 11.
2. **Processor:** x86_64 CPU with **AVX2** instruction support (e.g. AMD Ryzen 5, Intel Core i5/i7 8th Gen+).
3. **RAM:** 8 GB minimum (supports 1.5B models; 4k context); 16 GB recommended for smooth Qwen3-8B operation.
4. **Disk Space:** ~2 GB for application installation + 6–10 GB for external GGUF model files.
5. **Model File:** `Qwen3-8B-Q4_K_M.gguf` (SHA-256: `d98cdcbd...`) or compatible GGUF model placed in Downloads, Desktop, or custom folder.

### 3. Step-by-Step User Verification Procedure
Preview testers should verify file integrity before launching:
```powershell
Get-FileHash -Path .\ASTRO-Setup-0.1.0.exe -Algorithm SHA256
```
Expected output must match:
```
F325DA5631033BCD9E6BEE14BD801597261858B4E0D9AD4A5C1B6514C352A3FB
```

### 4. SmartScreen Guidance for Technical Preview
Because the binary is unsigned, testers must be instructed:
1. Double-click `ASTRO-Setup-0.1.0.exe` or `ASTRO-0.1.0-portable.exe`.
2. When Windows Defender SmartScreen appears, click **"More info"**.
3. Confirm that the Publisher says *Unknown Publisher* and the Application says *ASTRO-Setup-0.1.0.exe*.
4. Click **"Run anyway"**.
*(Note: Testers should NEVER bypass SmartScreen for binaries from unverified third-party sources).*

### 5. Package Withdrawal & Rollback Procedure
If a critical defect, data corruption issue, or privacy regression is reported:
1. **Immediate Distribution Halt:** Disable download links and mark the technical preview release as paused.
2. **Rollback to Candidate 1:** The baseline candidate (`release/candidate-1-baseline/`) is preserved and ready for immediate deployment if needed.
3. **User Data Safety:** Users encountering issues can downgrade or uninstall without data loss, as all user configurations and model weights reside untouched in `%USERPROFILE%\.astro_data\`.
4. **Issue Intake:** Testers report findings using [`dist-release/PREVIEW_FEEDBACK_TEMPLATE.md`](file:///c:/aditya/ASTRO/dist-release/PREVIEW_FEEDBACK_TEMPLATE.md) directly to the designated project issue tracker.

---

## 7. Remaining Limitations & Risk Matrix

| Risk / Limitation | Severity | Impact | Mitigation / Recommendation |
| :--- | :--- | :--- | :--- |
| **Unsigned Executable (`NotSigned`)** | **High** *(for public consumers)* / **Low** *(for technical preview)* | Triggers Windows Defender SmartScreen warning on first execution. | Restricted distribution to technical preview; require EV code signing before public consumer launch. |
| **Bare-Metal VM Test Unperformed** | **Medium** | Clean-machine installation not tested on bare-metal VM due to lack of `WindowsSandbox.exe`. | Simulated tests and host execution verified; conduct VM smoke test on dedicated CI VM. |
| **8B Model Memory on 8 GB Laptops** | **Medium** | Qwen3-8B (5.02 GB) will trigger disk paging on systems with $\le$ 8 GB RAM. | Preflight warning engine actively warns user; recommends lightweight Qwen2.5-Coder-1.5B model. |
| **Whisper Voice Dependencies** | **Low** | Audio recording works, but speech transcription requires local Whisper binaries. | Honestly documented in `MODEL_SETUP_GUIDE.md` and UI; text and coding features remain 100% operational. |

---

## 8. Final Recommendation & Required Owner Approvals

### Recommendation:
# **READY FOR OWNER APPROVAL**
*(For Restricted Technical Preview Distribution Only)*

The release package staged in `dist-release/` is complete, verified, frozen, and adheres strictly to Rule 1 through Rule 18.

### Exact Staged Distribution Files Awaiting Approval:
1. `dist-release/ASTRO-Setup-0.1.0.exe` (368,981,143 bytes)
2. `dist-release/ASTRO-0.1.0-portable.exe` (368,604,064 bytes)
3. `dist-release/SHA256SUMS.txt` (179 bytes)
4. `dist-release/CHECKSUMS.txt` (832 bytes)
5. `dist-release/INSTALLATION_GUIDE.md` (9,486 bytes)
6. `dist-release/MODEL_SETUP_GUIDE.md` (6,386 bytes)
7. `dist-release/RELEASE_NOTES.md` (6,535 bytes)
8. `dist-release/PRIVACY_STATEMENT.md` (4,728 bytes)
9. `dist-release/LICENSES.md` (1,018 bytes)
10. `dist-release/TROUBLESHOOTING.md` (7,595 bytes)
11. `dist-release/MANUAL_UPDATE_GUIDE.md` (4,593 bytes)
12. `dist-release/RELEASE_CHECKLIST.md` (4,364 bytes)
13. `dist-release/PREVIEW_FEEDBACK_TEMPLATE.md` (2,776 bytes)

### Specific Owner Approvals Required Prior to Distribution:
1. **Authorization of Technical Preview Scope:** Explicit approval to share the staged files with closed-beta technical testers under the unsigned SmartScreen disclosure.
2. **Distribution Channel Approval:** Confirmation of the private download channel/repository URL to be used.
3. **Confirmation to Keep General Consumer Distribution Gated:** Affirmation that public distribution remains on hold until an EV/OV Authenticode signing certificate is acquired.
