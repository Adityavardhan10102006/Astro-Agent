# ASTRO — Phase 19: Release Integrity, Code Signing, and Update Strategy Report

**Date:** October 21, 2026  
**Authoritative Version:** `0.1.0`  
**Auditor:** ASTRO Release Engineering Pair / Antigravity AI  
**Target Environment:** Windows 10 / Windows 11 (64-bit, x86_64)  
**Status:** **COMPLETE**  
**Final Release Recommendation:** **READY FOR RELEASE PREPARATION (Self-Hosted / Developer Distribution; Code-Signing Roadmap Documented for General Public Release)**

---

## 1. Executive Summary

Phase 19 conducted a comprehensive audit of ASTRO's Windows distribution integrity, code-signing posture, artifact verification mechanisms, and update architecture. To protect user sovereignty and offline-first integrity (Rule 2 & Rule 4), release verification was standardized through reproducible cryptographic manifests and an authoritative 9-step manual update Standard Operating Procedure (SOP).

- **Authoritative Version:** **`0.1.0`** (Harmonized across all configuration files, release binaries, and diagnostics).
- **Signing Status:** Confirmed as **`NotSigned`**; SmartScreen bypass instructions and commercial code-signing options are fully documented.
- **Artifact Integrity Tooling:** Created automated verification tool [`scripts/verify-release-checksums.js`](file:///c:/aditya/ASTRO/scripts/verify-release-checksums.js) and standard manifest [`docs/SHA256SUMS.txt`](file:///c:/aditya/ASTRO/docs/SHA256SUMS.txt).
- **Manual Update SOP:** Created user-safe procedure in [`docs/MANUAL_UPDATE_GUIDE.md`](file:///c:/aditya/ASTRO/docs/MANUAL_UPDATE_GUIDE.md) guaranteeing that `%USERPROFILE%\.astro_data` is preserved across updates.
- **Auto-Updater Decision:** Evaluated and deferred; background auto-updating is rejected to uphold ASTRO's strict offline-first, no-telemetry principles.
- **Automated Regression Suite:** **148 of 148 automated tests passed (100% pass rate)**.

---

## 2. Release Artifact Inventory & Provenance

The current distribution artifacts were audited in both `release/` and `dist-release/`:

| Artifact | File Size | SHA-256 Checksum | Build Date | Toolchain / Origin |
|----------|-----------|------------------|------------|--------------------|
| `ASTRO-Setup-0.1.0.exe` | 368,965,251 bytes (~351.8 MB) | `B4BC17B298528079962B827E5D50F7130A6AF25C588D174CE15ECA9F05208DA1` | Oct 19, 2026 | `electron-builder 26.15.3` (NSIS target) |
| `ASTRO-0.1.0-portable.exe` | 368,588,191 bytes (~351.5 MB) | `9EEC822F4092BECE1C3DC28576743F4CBFC1A29977D869FF736E75A4954D252F` | Oct 19, 2026 | `electron-builder 26.15.3` (Portable target) |
| `win-unpacked/ASTRO.exe` | 188,917,760 bytes (~180.1 MB) | Valid win-x64 binary | Oct 19, 2026 | Direct unpacked runtime |

### 2.1 Provenance Connection
- **Source Revision:** Built from the `main` branch baseline.
- **Native Unpacked Bindings:** Confirmed extraction of compiled native C++ bindings (`node-llama-cpp`, `llama-addon.node`, `llama-common.dll`, `ggml-base.dll`) into `app.asar.unpacked`.
- **Model Separation (Rule 10):** The 5.02 GB `Qwen3-8B-Q4_K_M.gguf` file is strictly decoupled from installer archives (`!*.gguf`), ensuring fast downloads (<400 MB).

---

## 3. Windows Code Signing Evaluation

Direct inspection via PowerShell `Get-AuthenticodeSignature` confirmed:
```text
File: release\ASTRO-Setup-0.1.0.exe
SignerCertificate: None
Status: NotSigned

File: release\ASTRO-0.1.0-portable.exe
SignerCertificate: None
Status: NotSigned
```

### 3.1 Practical Implications for Windows Users
1. **Windows Defender SmartScreen:**  
   When downloaded via a web browser, Windows marks the file with the "Mark of the Web" (`Zone.Identifier`). Microsoft Defender SmartScreen displays:  
   *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."*  
   **Mitigation:** Documented clear 2-click bypass instructions (*"More info"* → *"Run anyway"*) in the User Installation Guide and Troubleshooting Guide.
2. **User Account Control (UAC):**  
   The installer displays a standard yellow/orange prompt indicating `Publisher: Unknown`.

### 3.2 Evaluation of Commercial Code-Signing Options

| Option | Estimated Cost | Requirements | SmartScreen Reputation Impact | Feasibility for ASTRO |
|--------|----------------|--------------|-------------------------------|-----------------------|
| **Extended Validation (EV) Certificate** | $400 – $800 / year | Registered legal organization, Dun & Bradstreet number, Hardware FIPS Token or Cloud HSM. | **Immediate:** Bypasses SmartScreen from day one. | Recommended for commercial enterprise distribution. |
| **Standard (OV) Code Signing** | $200 – $400 / year | Organizational identity verification, Hardware Token. | **Gradual:** Requires building reputation over hundreds of downloads. | Viable intermediate commercial option. |
| **Azure Trusted Signing** | ~$9.99 / month + signature fees | Microsoft Azure Tenant, identity validation, cloud HSM. | **High:** Integrates directly with Microsoft identity. | Recommended modern cloud CI/CD option. |
| **Self-Signed Certificate** | Free | Local OpenSSL / PowerShell creation. | **None:** Untrusted by any computer without manual root cert installation. | Dev/testing only; not suitable for distribution. |

> [!IMPORTANT]
> **Policy Decision:** Because signing credentials require organizational verification and ongoing financial costs, code signing is documented as a distinct commercial release prerequisite rather than blocking internal, developer, or self-hosted distribution.

---

## 4. Artifact Integrity Verification (Checksum Manifest)

### 4.1 Repeatable Tooling Created
A dedicated script was created at [`scripts/verify-release-checksums.js`](file:///c:/aditya/ASTRO/scripts/verify-release-checksums.js):
- **Generate Manifests:** `npm run generate:checksums`
- **Verify Manifests:** `npm run verify:checksums`

### 4.2 Standard Coreutils Manifest (`SHA256SUMS.txt`)
Generated at [`docs/SHA256SUMS.txt`](file:///c:/aditya/ASTRO/docs/SHA256SUMS.txt) and [`dist-release/SHA256SUMS.txt`](file:///c:/aditya/ASTRO/dist-release/SHA256SUMS.txt):
```text
b4bc17b298528079962b827e5d50f7130a6af25c588d174ce15eca9f05208da1  ASTRO-Setup-0.1.0.exe
9eec822f4092bece1c3dc28576743f4cbfc1a29977d869ff736e75a4954d252f  ASTRO-0.1.0-portable.exe
```

### 4.3 How Users Verify Downloads
Users can verify their downloads using standard built-in Windows tools:
- **PowerShell:**
  ```powershell
  Get-FileHash -Path .\ASTRO-Setup-0.1.0.exe -Algorithm SHA256
  ```
- **Command Prompt:**
  ```cmd
  certutil -hashfile ASTRO-Setup-0.1.0.exe SHA256
  ```

### 4.4 Trust Boundary Disclosure
Checksum manifests detect transmission corruption, incomplete downloads, or third-party file tampering. However, checksums alone do not prove author identity unless the manifest itself is obtained from an authenticated source (such as the verified GitHub release page over HTTPS).

---

## 5. Safe Manual Update Strategy

ASTRO does not implement an automatic background updater. Instead, a verified 9-step manual update procedure was authored in [`docs/MANUAL_UPDATE_GUIDE.md`](file:///c:/aditya/ASTRO/docs/MANUAL_UPDATE_GUIDE.md):

1. **Confirm Installed Version** (Settings → Diagnostics).
2. **Download Verified Artifact** from official GitHub Releases.
3. **Verify Checksum** against `SHA256SUMS.txt`.
4. **Safely Close ASTRO** to release native llama DLL locks.
5. **Create Pre-Update Backup** (`Copy-Item -Path "$env:USERPROFILE\.astro_data" ...`).
6. **Execute New Installer** (NSIS replaces binaries in `%LOCALAPPDATA%\Programs\ASTRO`).
7. **Verify Data Retention** (all conversations, RAG indexes, and models are preserved).
8. **Perform Verification Chat Turn** (confirm local token streaming).
9. **Rollback Procedure** (reinstall prior installer or restore `.astro_data` backup if issues arise).

---

## 6. Architectural Assessment of Automatic Updating

### 6.1 Why Automatic Updating is Currently Rejected
1. **Rule 2 (Offline-First Architecture):** ASTRO must operate indefinitely without an internet connection. An automatic updater that polls remote servers contradicts this core design rule.
2. **Rule 4 (Private by Default):** Periodic background update queries can leak IP addresses, usage patterns, and operating system metadata to external servers.
3. **Native Binary Safety:** ASTRO bundles compiled native C++ binaries (`llama-addon.node`). In-place hot swapping of native DLLs during active process execution carries a high risk of memory corruption and file lock crashes.
4. **Bandwidth Considerations:** The installer is ~351 MB. Automatic background downloads on metered mobile or laptop connections would consume user data without consent.

### 6.2 Proposed Future Opt-In Update Architecture (Phase 20+)
If an updater is implemented in the future, it must satisfy these strict constraints:
- **Disabled by Default:** The setting `checkUpdates` must default to `false`.
- **User-Initiated Check:** Triggered only via an explicit button in **⚙️ Settings** (*"Check for Updates"*).
- **Cryptographic Verification:** Downloaded update packages must verify both SHA-256 checksums and digital signatures before presenting an install prompt.
- **Zero Automatic Restart:** The user must explicitly approve when the application restarts.

---

## 7. Data Safety During Updates & Uninstallation

- **Decoupled User Storage:** User data is located at `%USERPROFILE%\.astro_data`, completely separate from `%LOCALAPPDATA%\Programs\ASTRO`.
- **NSIS Uninstaller Setting:** `deleteAppDataOnUninstall: false` ensures that uninstalling or upgrading the app leaves conversations, vector indexes, and model registries completely intact.
- **Model Unregistration Safety:** Unregistering a model in ASTRO removes it from `registry.json` without deleting the underlying physical `.gguf` file.
- **Coding Studio Rollback:** File edits generate local timestamped backups (`${filePath}.astro_bak_${Date.now()}`), which are never deleted during application updates.

---

## 8. Offline-First Preservation

- Content Security Policy (CSP) enforces `default-src 'self'`.
- Zero network requests occur during startup, model discovery, chat, RAG, Coding Studio, or settings management.
- Web research and Hugging Face discovery remain strictly guarded by `offlineOnly: true`.

---

## 9. Automated Regression Testing

Executed full test suite (`npm.cmd test`):
- **17 Test Suites Executed**
- **148 Tests Passed (100% Pass Rate)**
- **0 Failures, 0 Skipped**
- **Duration:** 15.49 seconds

Executed checksum verification tool (`node scripts/verify-release-checksums.js --verify`):
- **2 of 2 Release Binaries Matched Exact Recorded Hashes (100% Match)**

---

## 10. Change Control Summary

### Files Created:
1. [`scripts/verify-release-checksums.js`](file:///c:/aditya/ASTRO/scripts/verify-release-checksums.js) — Checksum manifest generation and verification tool.
2. [`docs/SHA256SUMS.txt`](file:///c:/aditya/ASTRO/docs/SHA256SUMS.txt) — Standard UNIX-format SHA-256 release manifest.
3. [`dist-release/SHA256SUMS.txt`](file:///c:/aditya/ASTRO/dist-release/SHA256SUMS.txt) — Checksum manifest inside distribution package.
4. [`docs/MANUAL_UPDATE_GUIDE.md`](file:///c:/aditya/ASTRO/docs/MANUAL_UPDATE_GUIDE.md) — 9-step safe update Standard Operating Procedure.
5. [`dist-release/MANUAL_UPDATE_GUIDE.md`](file:///c:/aditya/ASTRO/dist-release/MANUAL_UPDATE_GUIDE.md) — Manual update guide in distribution package.
6. [`docs/PHASE19_RELEASE_INTEGRITY_REPORT.md`](file:///c:/aditya/ASTRO/docs/PHASE19_RELEASE_INTEGRITY_REPORT.md) — This report.

### Files Modified:
1. [`package.json`](file:///c:/aditya/ASTRO/package.json) — Added `generate:checksums` and `verify:checksums` npm scripts.
2. [`docs/CHECKSUMS.txt`](file:///c:/aditya/ASTRO/docs/CHECKSUMS.txt) — Updated timestamped manifest.
3. [`dist-release/CHECKSUMS.txt`](file:///c:/aditya/ASTRO/dist-release/CHECKSUMS.txt) — Updated timestamped manifest.

---

## 11. Final Recommendation

**READY FOR RELEASE PREPARATION**  
ASTRO's release artifacts, cryptographic integrity manifests, manual update procedures, user-data protections, and offline-first boundaries are verified, documented, and reproducible. The application is ready for self-hosted, developer, and GitHub release distribution. A commercial EV code-signing certificate can be introduced when scaling to consumer audiences.
