# ASTRO — Phase 22: Controlled Technical Preview Readiness Report

**Date:** October 21, 2026  
**Auditor / Engineering Pair:** ASTRO Release Engineering Pair / Antigravity AI  
**Authoritative Version:** `0.1.0`  
**Distribution Target:** Controlled Technical Preview (Owner-Approved Early Adopters)  
**Target Platform:** Windows 10 (Build 19041+) / Windows 11 (64-bit, x86_64, AVX2)  
**Final Preview Recommendation:** **READY FOR OWNER APPROVAL**

---

## 1. Executive Summary

This document establishes the official readiness assessment for releasing ASTRO v0.1.0 as a **Controlled Technical Preview**. 

Following the Phase 20 acceptance audit and Phase 21 release planning, Phase 22 validated the complete end-to-end user preview experience across 10 vital criteria, reconciled automated test telemetry, prepared a dedicated user feedback mechanism, and verified all release assets in [`dist-release/`](file:///c:/aditya/ASTRO/dist-release/).

- **Acceptance Status:** All 16 Release Requirements remain **PASS**.
- **Automated Regression Suite:** **100% pass rate (148 of 148 tests passing)** across 17 test files and 2 native test suites.
- **Empirical Preview Validation:** 10 of 10 preview criteria verified with runtime evidence.
- **Local Inference:** Physically verified with `Qwen3-8B-Q4_K_M.gguf` (5.02 GB) at ~4.2 tokens/second on an AMD Ryzen 5 CPU.
- **Integrity Status:** Checksums for installer and portable binaries re-verified matching `SHA256SUMS.txt` 100%.
- **Recommendation:** **READY FOR OWNER APPROVAL**. The release artifacts and documentation are staged and ready for the project owner to authorize distribution.

> [!IMPORTANT]
> **Strict Operational Boundary:**
> No files have been published, uploaded, or transmitted externally. Distribution remains entirely gated behind the project owner's explicit decision.

---

## 2. Release Candidate Identity & Checksum Freeze

The exact release candidate binaries staged in [`dist-release/`](file:///c:/aditya/ASTRO/dist-release/) are frozen with verified SHA-256 hashes:

| Artifact Name | Staging Location | File Size (Bytes) | SHA-256 Checksum | Signature Status |
|---|---|---|---|---|
| **ASTRO-Setup-0.1.0.exe** | `dist-release\ASTRO-Setup-0.1.0.exe` | 368,965,251 (~351.8 MB) | `b4bc17b298528079962b827e5d50f7130a6af25c588d174ce15eca9f05208da1` | `NotSigned` |
| **ASTRO-0.1.0-portable.exe** | `dist-release\ASTRO-0.1.0-portable.exe` | 368,588,191 (~351.5 MB) | `9eec822f4092bece1c3dc28576743f4cbfc1a29977d869ff736e75a4954d252f` | `NotSigned` |
| **SHA256SUMS.txt** | `dist-release\SHA256SUMS.txt` | 179 bytes | Verified 2/2 matching | Plaintext (ASCII) |

- **Verification Tool:** Verified via `scripts/verify-release-checksums.js` (`npm.cmd run verify:checksums`) and PowerShell `Get-FileHash`.
- **Model Exclusion Verified:** Large GGUF weights (`Qwen3-8B-Q4_K_M.gguf`, 5.02 GB) are externalized to ensure a lightweight download footprint (~351 MB). Zero-copy Bring Your Own Model (BYOM) detection is fully operational.

---

## 3. Fresh Automated Test Results

A fresh run of `npm.cmd test` on the candidate source tree yielded:

```text
> astro-desktop@0.1.0 test
> node --test tests/**/*.test.js

ℹ tests 148
ℹ suites 2
ℹ pass 148
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ duration_ms 19289.9244 (19.29s)
```

- **Pass Rate:** **100% (148 passed of 148 tests, 0 failures, 0 regressions).**
- **Test Reconciliation:** The 148 tests span 17 individual test files in `tests/`. Node.js's native test runner reports `suites: 2` because exactly two files (`phase10-runtime-verification.test.js` and `phase11-packaging.test.js`) encapsulate their tests in a top-level `describe()` block, while the other 15 files register tests directly at the top level.

---

## 4. Empirical Preview Experience Validation

The 10 preview criteria evaluated in [`docs/PHASE22_PREVIEW_TEST_RESULTS.md`](file:///c:/aditya/ASTRO/docs/PHASE22_PREVIEW_TEST_RESULTS.md) achieved **PASS** status:

1. **Installation & Launch Artifact:** Standalone `win-unpacked\ASTRO.exe` launches without development tools or errors.
2. **First-Run Guidance:** Actionable banner and unconfigured model error prevent invalid inference without crashing.
3. **Model Registration & Loading:** Real `Qwen3-8B-Q4_K_M.gguf` header inspected and loaded into native C++ context.
4. **Multi-Turn Chat & Cancellation:** 2-turn dialogue preserved; mid-stream token generation aborted cleanly.
5. **Model Switching & Recovery:** Corrupt model throws native exception; previous model unloaded to protect RAM; recovery reload succeeds.
6. **Local File RAG Workflows:** Document indexed; hybrid retrieval grounds responses with explicit clickable citations.
7. **Coding Studio Safeguards:** Unified diff preview, automatic `.astro_bak` creation, and 100% byte-accurate rollback verified.
8. **Activity Logs & Privacy:** Automatic regex redaction of `sk-`, `hf_`, and Bearer tokens in local disk logs.
9. **Offline Network Boundaries:** Default `offlineOnly: true` and strict CSP (`default-src 'self'`) block all external telemetry.
10. **Data Retention:** Decoupled storage at `%USERPROFILE%\.astro_data` preserved across uninstalls (`deleteAppDataOnUninstall: false`).

---

## 5. Security, Signing & Trust Status

- **Authenticode Signature:** `NotSigned` (Unsigned).
- **Windows SmartScreen Warnings:** Accurately documented in all user guides. Preview users are instructed to verify the SHA-256 hash against `SHA256SUMS.txt` before proceeding.
- **Integrity vs Authenticity:** Documentation explicitly discloses that while checksums detect transit corruption or tampering, **a checksum alone does not prove publisher identity**.
- **No Disabling Protections:** Users are never instructed to disable antivirus or security protections.
- **Future Commercial Requirement:** Commercial EV Authenticode signing is documented as a requirement before general consumer distribution.

---

## 6. Feedback & Triage Process

A dedicated, privacy-respecting feedback template has been established:
- **Project Template:** [`docs/PHASE22_PREVIEW_FEEDBACK_TEMPLATE.md`](file:///c:/aditya/ASTRO/docs/PHASE22_PREVIEW_FEEDBACK_TEMPLATE.md)
- **User Distribution Copy:** [`dist-release/PREVIEW_FEEDBACK_TEMPLATE.md`](file:///c:/aditya/ASTRO/dist-release/PREVIEW_FEEDBACK_TEMPLATE.md)

### Severity Triage Definitions:
- **Critical:** Data loss, privacy breach, or serious security failure.
- **High:** Application crash, installation failure, model fails to load, or core workflow unusable.
- **Medium:** Feature works incorrectly, unexpected latency, or major usability difficulty.
- **Low:** Minor cosmetic defect, wording typo, or non-blocking inconvenience.

### Zero-Telemetry Commitment:
Feedback submission is 100% voluntary and user-initiated via GitHub Issues. No background crash reporters or analytics exist in ASTRO.

---

## 7. Staging Package Inventory (`dist-release/`)

The distribution staging directory [`dist-release/`](file:///c:/aditya/ASTRO/dist-release/) contains 12 customer-facing files:

1. `ASTRO-Setup-0.1.0.exe` (368.9 MB)
2. `ASTRO-0.1.0-portable.exe` (368.5 MB)
3. `SHA256SUMS.txt` (Standard Coreutils Checksum Manifest)
4. `CHECKSUMS.txt` (Detailed SHA-256 and SHA-512 Manifest)
5. `INSTALLATION_GUIDE.md` (Beginner Setup Walkthrough & Security Guidance)
6. `MODEL_SETUP_GUIDE.md` (GGUF Setup, Hardware Requirements & BYOM Guide)
7. `RELEASE_NOTES.md` (v0.1.0 Feature Overview & Known Limitations)
8. `TROUBLESHOOTING.md` (Safe Issue Recovery Guide)
9. `PRIVACY_STATEMENT.md` (Offline Boundaries & Data Commitments)
10. `MANUAL_UPDATE_GUIDE.md` (9-Step Safe Manual Update SOP)
11. `RELEASE_CHECKLIST.md` (Maintainer Pre-Publishing Checklist)
12. `PREVIEW_FEEDBACK_TEMPLATE.md` (Voluntary User Feedback Template)

---

## 8. Rollback and Withdrawal Procedure

If preview users report a critical defect (e.g. fatal crash on a specific Windows 10 build or hardware configuration):
1. **Immediate Withdrawal:** The project owner sets the preview release on GitHub to "Draft" to prevent further downloads.
2. **User Data Safety:** Affected preview users can safely uninstall ASTRO; `%USERPROFILE%\.astro_data` (conversations, indexes, settings) and their downloaded `.gguf` models are strictly preserved.
3. **Patch Workflow:** Defect is isolated, replicated in a regression test, patched, and verified under automated suites before staging as `v0.1.1`.

---

## 9. Final Decision & Recommendation

### Decision: **READY FOR OWNER APPROVAL**

The ASTRO v0.1.0 Technical Preview candidate is verified, documented, and fully staged.

#### Shortest Actionable List for the Project Owner:
1. **Review Staging Directory:** Confirm the 12 files staged in [`dist-release/`](file:///c:/aditya/ASTRO/dist-release/).
2. **Authorize Preview Release:** Upload the candidate binaries (`ASTRO-Setup-0.1.0.exe`, `ASTRO-0.1.0-portable.exe`), `SHA256SUMS.txt`, and user documentation to GitHub Releases tagged as `v0.1.0-preview`.
3. **Invite Initial Preview Cohort:** Share the release link and [`PREVIEW_FEEDBACK_TEMPLATE.md`](file:///c:/aditya/ASTRO/dist-release/PREVIEW_FEEDBACK_TEMPLATE.md) with selected technical testers.
4. **Future Milestone (v0.2.0):** Pursue commercial Authenticode code signing prior to public mass-market distribution.
