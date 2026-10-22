# ASTRO Desktop Assistant — Release Notes

**Release Version:** 0.1.0 (Restricted Technical Preview)  
**Release Date:** October 22, 2026  
**Build Target:** Windows 10 / Windows 11 (64-bit)  
**Package Artifacts:** `ASTRO-Setup-0.1.0.exe` (368.9 MB), `ASTRO-0.1.0-portable.exe` (368.6 MB)  

---

## Overview

ASTRO is an offline-first native desktop AI assistant, document intelligence system, and Coding Studio for Windows. Designed from the ground up for total privacy and independence from cloud servers, ASTRO executes local open-weights language models (such as Qwen3-8B and Qwen2.5-Coder-7B) on your computer's CPU and RAM.

This initial **v0.1.0 Restricted Technical Preview** establishes a production-grade foundation combining local inference, Bring Your Own Model (BYOM) management, retrieval-augmented generation (RAG), and a polished Dark Professional user interface.

---

## Key Features in Version 0.1.0

### 1. Dark Professional Desktop Interface
- **Refined Charcoal Aesthetic:** Calm charcoal background (`#0d1117` / `#161920`), accessible contrast ratios, restrained blue accents, and subtle borders.
- **Grouped Sidebar Navigation:** Ten specialized workspaces organized into `Workspace` (Home, Chat), `Knowledge & Code` (Files, RAG, Research, Coding Studio), and `System` (Models, Voice, Activity Log, Settings).
- **Interactive Thought/Reasoning Blocks:** Collapsible `<details class="think-block">` rendering for Qwen3 internal reasoning processes (`<think>...</think>`).
- **Fenced Code Blocks & Copy Action:** Syntax-styled code containers with individual 1-click copy buttons and toast feedback.
- **Interactive Prompt Suggestion Chips:** Quick starters for testing local models, quantization, and RAG search in empty chats.
- **Keyboard Accessibility:** Modal dismissal via `Escape`, message submission on `Enter` (with `Shift + Enter` for multi-line drafting), and visible focus rings.

### 2. Bring Your Own Model (BYOM) & Memory Preflight Safeguards
- **Zero-Copy Local Ingestion:** Register models located on secondary drives or custom folders in-place without copying multi-gigabyte files.
- **Model Memory Preflight Protection:** Dynamic RAM requirement calculation (weights + context length + engine overhead + OS headroom). Warns users on memory paging and prevents out-of-memory system freezes on entry-level Ryzen 5 hardware unless explicitly overridden.
- **Deep GGUF Binary Inspection:** Inspects GGUF v2/v3 magic headers, architecture, tensor counts, and calculates accurate memory estimates before loading.
- **Automatic Workspace Detection:** Scans Downloads, Desktop, and application directories on startup to offer 1-click activation banners for discovered `.gguf` files.
- **Single-Model Memory Confinement:** Enforces safe sequential unloading and loading to protect Ryzen 5 and consumer systems from multi-model VRAM overload.
- **Path Repair & Safe Deregistration:** Re-link moved files easily; unregistering a model removes metadata while strictly preserving the physical `.gguf` file on disk.

### 3. Local RAG & Document Intelligence
- **Multi-Format Extraction Registry:** Native offline extraction for Plain Text (`.txt`, `.log`), Markdown (`.md`), Code files (`.js`, `.ts`, `.py`, `.rs`, `.c`, etc.), JSON, CSV, PDF, and Office documents (`.docx`, `.xlsx`, `.pptx`).
- **Persistent Vector & Lexical Indexing:** Combines TF-IDF keyword indexing with local cosine similarity vector retrieval.
- **Transparent Citations:** Responses grounded in local files provide clickable source filenames and snippet excerpts.

### 4. Coding Studio & Safety Confined Tools
- **Project Tree & Diff Viewer:** View project hierarchies and inspect unified diffs before applying changes.
- **Automatic Rollback Backups:** Modifying project files creates timestamped `.astro_bak` recovery files.
- **Workspace Confinement:** File reads, writes, and terminal commands are strictly restricted to approved workspace directories.
- **Destructive Command Gate:** Commands like `rm`, `del`, and `format` require explicit secondary confirmation.

### 5. Privacy, Sandboxing & Offline Security Boundary
- **100% Offline by Default:** `offlineOnly: true` setting blocks outbound web requests.
- **Runtime Sandboxing & CSP:** Electron sandbox enabled (`sandbox: true`), renderer isolation, navigation locks (`will-navigate`), and strict Content Security Policy (`default-src 'self'`); no remote fonts, analytics, telemetry, or external CDNs.
- **Isolated User Storage:** All databases, settings, and conversations are preserved in `%USERPROFILE%\.astro_data\`, completely decoupled from application binaries.

---

## Verified Verification Baseline

- **Automated Test Coverage:** 158 passing tests across 18 test suites (158 passed, 0 failed, 0 skipped; 100% pass rate).
- **Physical Model Verification:** Verified with genuine `Qwen3-8B-Q4_K_M.gguf` (5,027,783,488 bytes, 399 tensors).
- **Observed Generation Speed:** ~4.40 tokens/sec during pure CPU AVX2 execution on an AMD Ryzen 5 processor.
- **Packaged Binary Launch:** Tested standalone execution of `release/win-unpacked/ASTRO.exe` and verified packaged ASAR contents.

---

## Known Limitations

1. **Unsigned Windows Executable:** This release is an open-source technical preview and does not contain a commercial Authenticode digital signature (`NotSigned`). Windows SmartScreen will display an *"Unrecognized app"* warning on download. Technical preview users who obtain the file from the official project source and independently verify the SHA-256 hash may choose to click **"More info"** → **"Run anyway"**. Users should never bypass security prompts for files from unknown or third-party sources. Commercial code signing is planned for future consumer releases.
2. **CPU Generation Speed:** Running an 8-billion parameter model on a consumer CPU produces steady interactive text (~4 tokens/sec), but is not as fast as dedicated cloud GPU clusters.
3. **External Model File Required:** To keep the installer compact (~351 MB), model weights are not bundled and must be obtained separately as a `.gguf` file.
4. **Physical Microphone Voice Input:** Voice transcription requires local speech recognition binaries to be configured on the host OS.

---

## Upgrade & Data Retention Notice

- Installing or updating ASTRO preserves all existing conversations, models, and settings located in `%USERPROFILE%\.astro_data\`.
- Uninstalling ASTRO removes application executables but deliberately preserves your user data and downloaded model files.
