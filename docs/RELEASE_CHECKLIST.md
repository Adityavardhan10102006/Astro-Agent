# ASTRO Desktop Assistant — Final Release Checklist

**Target Release Version:** 0.1.0  
**Verification Date:** October 21, 2026  
**Auditor:** Antigravity AI / Release Engineering Team  

---

## 1. Mandatory Release Requirements

| Category | Checkpoint | Verification Method | Status | Evidence Reference |
|----------|------------|---------------------|--------|--------------------|
| **Version Integrity** | `package.json` specifies `"version": "0.1.0"` | Source inspection | **PASSED** | [`package.json:L3`](file:///c:/aditya/ASTRO/package.json#L3) |
| **Version Integrity** | UI Diagnostics displays `v0.1.0` | Electron runtime check | **PASSED** | [`src/ui/app.js:L2521`](file:///c:/aditya/ASTRO/src/ui/app.js#L2521) |
| **Artifact Packaging** | `release/ASTRO-Setup-0.1.0.exe` exists & valid | File verification & hash check | **PASSED** | Size: 368,965,251 bytes |
| **Artifact Packaging** | `release/ASTRO-0.1.0-portable.exe` exists & valid | File verification & hash check | **PASSED** | Size: 368,588,191 bytes |
| **Model Exclusion** | 5 GB model weights excluded from installer | `package.json` build.files check | **PASSED** | Installer size is ~351 MB (<400 MB) |
| **Native Unpacking** | Native llama DLLs present in unpacked folder | Directory inspection | **PASSED** | `llama-addon.node`, `llama-common.dll` |
| **Standalone Launch** | `win-unpacked/ASTRO.exe` launches without dev tools | Child process spawn test | **PASSED** | PID: 21932 clean start & stop |
| **First-Run Onboarding** | Missing model handled gracefully with banner | GUI audit screenshot 01 | **PASSED** | [`01_home_screen.png`](file:///c:/aditya/ASTRO/docs/screenshots/01_home_screen.png) |
| **Real Model Inference**| Real Qwen3-8B model streams tokens on CPU | Native `node-llama-cpp` test | **PASSED** | ~4.2 tokens/sec on AMD Ryzen 5 |
| **Stream Cancellation**| In-flight generation cancels cleanly via button | Dynamic abortion test | **PASSED** | `aborted: true` verified |
| **Multi-Turn Context** | Conversation history preserved across turns | Session continuity test | **PASSED** | 4-turn sequence verified |
| **Model Switching**    | Unloads model 1 before loading model 2 | Single-model enforcement check | **PASSED** | Verified in Phase 17 Step 8 |
| **Restart Persistence**| Conversations and settings survive restart | Storage re-instantiation test | **PASSED** | Verified in Phase 17 Step 9 |
| **Data Safety Policy** | NSIS `deleteAppDataOnUninstall: false` | Config & unregister test | **PASSED** | `.astro_data` preserved on uninstall |
| **Offline Enforcement**| Outbound network blocked when `offlineOnly: true`| Unit & integration tests | **PASSED** | 0 sockets during local inference |
| **Automated Tests**    | All automated regression suites pass | `npm.cmd test` execution | **PASSED** | **148 of 148 passed (100%)** |

---

## 2. Cryptographic Checksums (Mandatory Verification)

Before publishing, verify that release artifacts match the recorded hashes:

### `ASTRO-Setup-0.1.0.exe`
- **File Size:** `368,965,251 bytes`
- **SHA-256:** `B4BC17B298528079962B827E5D50F7130A6AF25C588D174CE15ECA9F05208DA1`
- **SHA-512:** `58D336DDC7F999F93B9DD8EFD3C80BA5701082F83BA81EC75DA26A9DDE4B0AA3ED0E34983F15B51B3CA0ABDA315C3D6E94292CD533FB7E53E7143D95659E48D8`

### `ASTRO-0.1.0-portable.exe`
- **File Size:** `368,588,191 bytes`
- **SHA-256:** `9EEC822F4092BECE1C3DC28576743F4CBFC1A29977D869FF736E75A4954D252F`
- **SHA-512:** `71B9DB2913CF0BA139DB0B3A01E9B67DDC8592D9D1CFF3B122DBFEB5398746521A34B50EA5F64F462EA777BF667BA652AAB7FEB61F316F805C9A6431EF7A29A8`

---

## 3. Optional & Follow-Up Enhancements

| Item | Priority | Current Status | Recommended Action |
|------|----------|----------------|--------------------|
| **Commercial Code-Signing** | High for Public Web Distribution | `NotSigned` | Acquire EV or Standard Authenticode certificate for CI/CD. |
| **Hardware Speech Recognition** | Medium | Software State Machine Active | Document Whisper C++ installation for voice input. |
| **GPU Acceleration Preset** | Medium | CPU AVX2 Fallback Active | Provide Vulkan / ROCm GGUF offloading preset in settings. |

---

## 4. Final Sign-Off

- **Lead Engineer:** Aditya & Antigravity AI
- **Release Status:** **CONDITIONAL GO**
- **Deployment Audience:** Ready for GitHub Releases, developer distribution, and self-hosted local installations.
