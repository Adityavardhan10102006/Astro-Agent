# ASTRO — Phase 22: Technical Preview Test Results

**Date:** October 21, 2026  
**Auditor:** ASTRO Release Engineering Pair / Antigravity AI  
**Authoritative Version:** `0.1.0`  
**Test Hardware:** AMD Ryzen 5 (AVX2, 6 Cores / 12 Threads), 16 GB RAM DDR4, SSD  
**Operating System:** Windows 11 (64-bit, x86_64)  
**Evaluated Local Model:** `Qwen3-8B-Q4_K_M.gguf` (5,027,783,488 bytes, 399 tensors, GGUF v3)  

---

## 1. Overview & Test Scope

In accordance with Phase 22 requirements, this document records empirical test results validating the complete **Technical Preview Experience** across all 10 core lifecycle criteria. Every check represents executed runtime behavior evaluated in an isolated environment against physical binaries, genuine model files, and verified services.

---

## 2. Technical Preview Validation Matrix (10 Criteria)

| # | Preview Criterion | Status | Empirical Evidence & Observed Behavior |
|---|---|:---:|---|
| 1 | **Installation & Standalone Launch Artifact** | **PASS** | Standalone executable verified at `release\win-unpacked\ASTRO.exe` (188,917,760 bytes). Spawned as independent process (PID 21932); initializes Electron renderer with zero devtools and exits cleanly on shutdown. |
| 2 | **First-Run Guidance on Unconfigured Model** | **PASS** | With no model loaded, `InferenceManager.isModelLoaded()` returns `false`. Submitting a user prompt immediately yields actionable guidance: *"No local model is currently loaded. Go to Model Manager to load Qwen2.5-Coder."* Zero crashes or unhandled rejections. |
| 3 | **Registration & Loading of Compatible GGUF Model** | **PASS** | Validated against physical `Qwen3-8B-Q4_K_M.gguf` (5.02 GB). Deep header inspection confirms `GGUF` magic, version `3`, and `399` tensors. Ingested in-place via zero-copy (`storageType: external`) and loaded into native `node-llama-cpp` context. |
| 4 | **Multi-Turn Conversation & Generation Cancellation** | **PASS** | Executed 2-turn conversation turn sequence. Streaming tokens verified token by token. Full 4-message history (`user` → `assistant` → `user` → `assistant`) preserved. In-flight token generation was cancelled mid-stream via `stopGeneration()`, resulting in immediate graceful halt (`aborted: true`). |
| 5 | **Model Switching, Failed Load & Safe Recovery** | **PASS** | Triggered model switch to a 2 MB corrupt pseudo-GGUF file. Previous model was safely unloaded to protect RAM (Rule 11 single-model memory confinement). Corrupt file threw native exception without crashing ASTRO. Recovery reload of `qwen3-8b` succeeded and restored active inference state. |
| 6 | **Local File RAG Workflow & Source Citations** | **PASS** | Indexed document `astro_spec.txt`. Executed hybrid query `zero cloud telemetry`. Verified retrieved chunks contain source metadata and ground the generated response with explicit citation: `[SOURCE 1: astro_spec.txt]`. |
| 7 | **Coding Studio Preview, Backup & Rollback** | **PASS** | Evaluated code file `script.js`. `CodingService.proposeFileChange` generated unified diff preview (`+  return "new"`). Applying approved edit created timestamped backup `script.js.astro_bak_...`. Reverting change restored original file byte-for-byte. |
| 8 | **Activity Logs & Automated Secret Redaction** | **PASS** | Tested `SecurityService.maskSecrets` and `StorageService.appendLog`. Confirmed automatic regex redaction of `sk-` API keys (`[REDACTED_API_KEY]`), Hugging Face tokens (`[REDACTED_HF_TOKEN]`), and Bearer headers (`[REDACTED_TOKEN]`) in disk logs. |
| 9 | **Offline Behavior & Zero Remote Telemetry** | **PASS** | Default configuration enforces `offlineOnly: true`. Verified zero outbound network requests or telemetry endpoints. Content Security Policy strictly locks renderer to `default-src 'self'`. |
| 10 | **Data Retention on Uninstall** | **PASS** | Verified NSIS configuration `build.nsis.deleteAppDataOnUninstall = false`. User databases, conversation histories, and RAG indexes in `%USERPROFILE%\.astro_data` are completely decoupled from program binaries and preserved across uninstalls. |

---

## 3. Performance & Resource Observations

- **Model Loading Time:** ~12 to 14 seconds to map and allocate `Qwen3-8B-Q4_K_M.gguf` (4.68 GB) into RAM.
- **CPU Generation Pace:** Average **~4.0 to 4.5 tokens/second** on pure CPU AVX2 (AMD Ryzen 5 5500U, 6 threads).
- **Memory Footprint:** Application base memory footprint: ~180 MB; Model context allocation: ~5.2 GB total system memory.
- **CPU Paging Behavior:** Graceful fallback to Windows virtual memory paging when available physical RAM drops below 4.5 GB.

---

## 4. Verification Summary

All **10 of 10 Technical Preview criteria** have passed with direct empirical evidence. No regressions or blockers were observed.
