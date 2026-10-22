# Changelog

All notable changes to the ASTRO project will be documented in this file.

> **Note on Versioning:** Application distribution packages (`ASTRO-Setup-0.1.0.exe`, `ASTRO-0.1.0-portable.exe`) use Semantic Version `0.1.0` representing the initial standalone release baseline. Section headers below track development phase milestones (e.g., Phase 15 -> 0.15.0, Phase 16 -> 0.16.0).

## [0.1.0] (Milestone 0.16.0) - Phase 16: Release Readiness and Distribution Validation
### Verified & Validated
- **Authoritative Version Audit**: Resolved versioning structure (`0.1.0` application package vs phase milestones) across `package.json`, release artifacts, UI diagnostics, and documentation.
- **Windows Packaging Integrity**: Validated NSIS installer (`ASTRO-Setup-0.1.0.exe`, 368.9 MB) and standalone portable executable (`ASTRO-0.1.0-portable.exe`, 368.5 MB) with verified native llama DLL unpacking.
- **User-Data Isolation & Retention**: Verified decoupled data directory (`%USERPROFILE%\.astro_data`) and verified NSIS `deleteAppDataOnUninstall: false` ensuring upgrades and uninstalls preserve user models, conversations, and RAG indexes.
- **Standalone Launch Verification**: Tested independent execution of `release/win-unpacked/ASTRO.exe` proving zero reliance on node/development environment at runtime.
- **Offline Network Isolation Audit**: Confirmed zero external network calls during launch, model discovery, chat inference, RAG retrieval, and settings management; verified CSP enforcement.
- **Model Distribution Policy**: Verified external distribution policy for `Qwen3-8B-Q4_K_M.gguf` (5.02 GB) and verified multi-directory auto-discovery and in-place zero-copy registration.
- **Windows Authenticode & Trust Assessment**: Assessed `NotSigned` binary status and documented SmartScreen bypass and code-signing roadmap for public release.
- **Release Regression Suite**: 100% pass rate across all 148 automated tests in 17 test suites with zero regressions.

## [0.15.0] - Phase 15: Complete UI Overhaul and Dark Professional Design System
### Added
- **Dark Professional Design System (`src/ui/theme/styles.css`)**: Implemented calm charcoal palette, subtle dividing borders, accessible text contrast, custom scrollbars, and standardized component hierarchies.
- **Grouped Sidebar Navigation (`src/ui/index.html`)**: Logically organized the 10 existing workspaces into `Workspace`, `Knowledge & Code`, and `System` groups with active vertical highlight bars.
- **Topbar Screen Indicator & Fast Switching**: Dynamically displays active workspace title and allows 1-click model switching from the header.
- **First-Run Onboarding Banner**: Clear guidance and 1-click local GGUF import trigger when no model is active.
- **Fenced Code Blocks & Copy Action**: Styled code blocks with language indicators and 1-click "Copy Code" action buttons.
- **Toast Notification Feedback**: Non-blocking toast notifications for clipboard actions, settings persistence, and data operations.
- **Prompt Suggestion Chips**: Interactive starter chips in empty chats for instant testing of models, quantization, and local RAG.
- **Keyboard Accessibility**: Modal `Escape` key closing, chat submission on `Enter` (with `Shift+Enter` for newline), and `:focus-visible` outlines.
- **Content-Security-Policy (CSP)**: Added strict meta CSP tag, eliminating Electron runtime security warnings.

## [0.13.0] - Phase 13: Bring Your Own Model (BYOM) and Chat-Based Model Management
### Added
- **Chat-Based Model Management**: Initiate model discovery, local file import, model listing, and switching directly from the chat interface using natural language (e.g., "Import a model from my computer", "Show my installed models", "Switch to my newly imported model", "Switch back to Qwen3-8B", "Find Qwen3-8B").
- **Intent Safety Guard**: Distinct action cards with explicit confirmation dialogs ensure normal conversation never accidentally switches models, starts downloads, or alters the model library.
- **Deep GGUF Inspector (`src/services/models/gguf-inspector.js`)**: Parses GGUF v2/v3 binary key-value pairs without loading multi-gigabyte models into RAM. Extracts tensor counts, architecture (`general.architecture`), quantization tags (`general.file_type`), context length, and calculates accurate memory estimates compared against system free and total RAM.
- **Supported Architecture Registry**: Recognizes and verifies compatible architectures (`qwen3`, `qwen2`, `llama`, `mistral`, `gemma`, `phi`, etc.) and flags unsupported architectures honestly.
- **Drag-and-Drop Model Import**: Dedicated drop overlay in the chat panel distinguishing `.gguf` model files from RAG documents.
- **Zero-Copy In-Place Registration**: Allows importing models from external directories or secondary drives without duplicating large files, saving disk space while respecting path confinement and external drive accessibility.
- **Duplicate Prevention**: Path normalization in `ModelRegistry.findEntryByPath` prevents registering the same underlying physical file under multiple IDs.
- **Path Repair & Deregistration**:
  - `ModelRegistry.repairModelPath`: Re-links moved or relocated model files to their existing configuration and metadata.
  - `ModelRegistry.unregisterModel`: Removes models from the ASTRO registry without deleting physical files from the user's hard drive.
  - Safe external file deletion requiring explicit secondary confirmation (`confirmExternalDelete: true`).
- **Safe Dynamic Model Switching**: `InferenceManager.switchModel` performs pre-flight existence checks, cleans up active sessions, unloads previous models, initializes target models, and rolls back to the prior model if loading fails.
- **Message-Level Model Attribution**: Preserves full conversation history across model switches while tagging each response with its generating `modelId` provenance.
- **Offline Privacy Protection**: Strictly blocks remote Hugging Face model searches and downloads when `offlineOnly: true`.
- **Phase 13 Test Suite (`tests/phase13-byom.test.js`)**: 14 comprehensive tests covering GGUF inspection, duplicate detection, zero-copy import, path repair, unregister vs delete, offline barriers, rollback on switch failure, and intent classification.
- **Total Test Suite**: Expanded to **148 passing tests, 0 failing** across 17 test files.

## [0.12.0] - Final Release Hardening and Clean-Machine Validation
### Added
- Integrated custom ASTRO desktop branding icon (`build/icon.ico`) with multi-resolution icon mipmaps (256, 128, 64, 48, 32, 16 px) embedded directly into Windows executable resources, NSIS installer, and window title bar.
- Added topbar brand emblem in `src/ui/index.html` (`src/ui/assets/icon.png`) and wired window icon in `src/main.js` (`createWindow`).
- Recompiled and verified standalone Windows installer (`release/ASTRO-Setup-0.1.0.exe`, 351.8 MB) and portable executable (`release/ASTRO-0.1.0-portable.exe`, 351.5 MB) with embedded application branding.
- Documented clean-machine manual validation procedure and verified data preservation architecture (`%USERPROFILE%\.astro_data`).
- Added SmartScreen bypass documentation for unsigned distribution builds.
- Expanded automated regression assertions in `tests/phase11-packaging.test.js` validating icon asset presence and release artifact integrity.

## [0.11.0] - Standalone Windows Installer and Packaging
### Added
- Configured Windows packaging pipeline using `electron-builder` supporting both standard NSIS Windows installer (`ASTRO-Setup-0.1.0.exe`) and single-file portable executable (`ASTRO-0.1.0-portable.exe`).
- Excluded 4.68 GB GGUF model weights, development scripts, test files, and local user data from release bundles, keeping installer size compact (~351 MB).
- Configured ASAR archive unpacking (`asarUnpack: ["**/node-llama-cpp/**", "**/@node-llama-cpp/**"]`) ensuring compiled native C++ bindings (`llama-addon.node`, `llama-common.dll`, `ggml-base.dll`) are placed on disk and executable by the OS.
- Decoupled user data storage into `%USERPROFILE%\.astro_data` ensuring user models, conversations, settings, and RAG knowledge survive installer upgrades and uninstallation (`deleteAppDataOnUninstall: false`).
- Expanded model auto-detection across packaged executable directories, portable folders, user downloads, and workspace locations.
- Packaged runtime verification test proving `release/win-unpacked/ASTRO.exe` successfully initializes native llama bindings and generates genuine responses.
- Dedicated Phase 11 test suite (`tests/phase11-packaging.test.js`) verifying artifact generation, model exclusion, native DLL extraction, and data isolation.
- Total test suite expanded to **134 passing tests, 0 failing** across 16 test files.

## [0.10.1] - Independent Runtime Verification & Reasoning Security
### Fixed
- Fixed sequence exhaustion defect in `InferenceManager` (`No sequences left at LlamaContext.getSequence`) by caching context sessions across turns for robust multi-turn conversations.
- Fixed UI XSS security vulnerability in `src/ui/app.js`: enforced strict HTML escaping (`formatMessageContent`) on both reasoning blocks and regular text, preventing execution of injected `<script>` or raw HTML tags.
- Handled unclosed `<think>` tags during streaming cancellation, ensuring reasoning blocks collapse cleanly without breaking UI layout.
- Added strict offline network isolation barrier verification confirming zero outbound sockets, DNS calls, or HTTP requests during local inference.
- Phase 10 test suite (`tests/phase10-runtime-verification.test.js`) with 6 tests verifying physical GGUF properties, path confinement, session reuse, and offline zero-network proof.

## [0.10.0] - Production Integration of Qwen3-8B Local Model
### Added
- Native production integration of `Qwen3-8B-Q4_K_M.gguf` (5,027,783,488 bytes, 399 tensors, GGUF v3).
- Architecture-aware ChatWrapper resolution in `InferenceManager` automatically pairing `ChatMLChatWrapper` with Qwen3 models (`model.defaultChatWrapper === undefined`), unlocking real streaming generation and reasoning.
- Interactive reasoning block formatting in Desktop UI: parses and wraps `<think>...</think>` tags in collapsible details blocks (`🧠 Qwen3 Reasoning Process`).
- In-place and managed local model ingestion (`ModelInstaller.importLocalModel`) verifying GGUF magic headers, format versions, and tensor counts without requiring redownloading.
- Workspace model auto-detection on startup (`models:detect-workspace-models`) and 1-click activation banner in Model Manager.
- Path safety conformance in `ModelRegistry` validating file locations against managed storage and approved project workspace roots.
- Persistent registration and catalog persistence for Qwen3-8B in `catalog.json`, `registry.json`, and `model-metadata.json`.
- Expanded integration test suite (`tests/qwen3-integration.test.js`) with 12 passing tests verifying discovery, parsing, hardware evaluation, single-model memory swapping, integrity verification, local import, and native inference.
### Added
- Rigorous independent verification audit across model management, offline enforcement, command sandboxing, and secret hygiene.
- Enforced complete offline network boundary: `HuggingFaceDiscovery.discoverModelVariants` and `src/main.js` (`models:discover`, `models:download`) reject live network requests when `privacy.offlineOnly` is enabled.
- Process tree termination on Windows via `taskkill.exe /pid <pid> /T /F` and `child.killed = true` flag propagation in `CodingService._killProcess`, ensuring zero orphaned child processes during cancellation or timeout.
- Explicit workspace root confinement in `CodingService.executeApprovedCommand` validating `cwd` against `options.workspaceRoot`.
- Deep secret redaction in `StorageService.appendLog` sanitizing API keys (`sk-proj-...`, `hf_...`, `Bearer ...`) before logging to persistent disk files.
- Dedicated Phase 9 verification test suite (`tests/phase9-verification-gate.test.js`) verifying catalog accuracy, offline boundary enforcement, process tree cleanup, workspace root confinement, and honest capability reporting.
- Total test suite expanded to **110 passing tests, 0 failing** across 12 test files.

## [0.8.0] - Phase 8: Final Integration, Security, Performance, and Release Readiness
### Added
- Complete end-to-end integration and security audit across all 8 phases of ASTRO.
- Clean application shutdown architecture (`app.on('before-quit')`) in `src/main.js` automatically cancelling background terminal processes and cleanly unloading llama inference engines to eliminate VRAM/RAM leaks.
- Real hardware diagnostic tool `scripts/check-hardware.js` wired to `npm run check-hw` detecting CPU (Ryzen 5 5500U), 12 logical cores, AVX2 support, memory, and integrated Radeon graphics status.
- Secret masking regex expansion in `SecurityService.maskSecrets` covering dashed API tokens (e.g. `sk-proj-...`, `sk-ant-...`, `hf_...`).
- Comprehensive Phase 8 regression and integration test suite (`tests/phase8-release-readiness.test.js`) verifying hardware detection, persistence across simulated restarts, model state machine constraints, RAG citation grounding, backup rollback SHA integrity, command runner workspace confinement, prompt injection defenses, shutdown resource releases, and single-model memory limits.
- Total test suite expanded to **102 passing tests, 0 failing** across 11 test files.

## [0.7.0] - Phase 7: Coding Studio, Project Intelligence, and Web Research
### Added
- Dedicated **Coding Studio** screen with native workspace folder picker, file tree browser, code search, source viewer, sensitive file protection, diff viewer, and controlled command execution.
- `ProjectIntelligenceService` (`src/services/coding/project-intelligence.js`):
  - Project language detection (`JavaScript`, `TypeScript`, `Python`, `Go`, `Rust`, `C/C++`, `HTML`, `CSS`, `JSON`, `Markdown`, `SQL`).
  - Project structure and entry point detection (`index.js`, `main.py`, `app.py`, `src/index.ts`, `Cargo.toml`, etc.).
  - Manifest parsing (`package.json`, `requirements.txt`, `Cargo.toml`) extracting dependencies, dev dependencies, scripts, and descriptions.
  - AST-style regex symbol extraction mapping functions, classes, imports, and exports with verified line numbers.
  - Project code search (`searchProjectCode`) with verified line ranges (`file:Lstart-Lend`) and surrounding context snippets.
  - Credential and sensitive file detection (`isCredentialFile`: `.env`, `*.pem`, `id_rsa`, `*.key`, `secrets.yaml`, etc.) preventing silent inclusion or accidental exposure in model contexts.
- Safe File Editing & Change Management (`CodingService`):
  - Strict workspace confinement rejecting any path traversal or out-of-boundary file paths.
  - Pre-edit inspection snapshot with modification time tracking (`inspectedMtime`).
  - External edit conflict detection: rejects write operations if a file was modified externally after inspection.
  - Automatic recoverable backup creation (`.astro_bak_<timestamp>`) before modifying files.
  - Safe rollback and change undoing (`revertFileChange`) restoring files from backups and tracking action history.
  - Unified diff generation with additions and deletions visible for user inspection prior to applying changes.
- Controlled Terminal and Command Runner (`executeApprovedCommand`):
  - Execution strictly confined within the approved project workspace working directory (`cwd`).
  - Non-read-only / destructive operations require explicit user confirmation.
  - Configurable execution timeouts (default 60s) and cancellation tracking (`cancelActiveCommands`).
  - Sensitive environment variable and credential masking in outputs (`SecurityService.maskSecrets`).
  - Accurate exit code capture and test outcome classification (`passed`, `failed`, `timeout`, `cancelled`).
- Real Web Research System (`ResearchService`):
  - Offline-first privacy safeguard: when internet access is disabled or offline, external requests are strictly blocked and queries are routed to local RAG.
  - Online research retrieves genuine sources with titles, URLs, domains, snippets, and retrieval timestamps.
  - Direct integration with local knowledge library (`saveFindingToLibrary`): users can persist cited web findings into ASTRO's local RAG collections for offline querying.
- Full IPC & Preload bridge extensions for project management, symbols, code search, diff approvals, reversions, command running, and research saving.
- Comprehensive Phase 7 test suite (`tests/phase7-coding-research.test.js`) with 15 automated test cases, expanding the project test suite to **90 passing tests**.

## [0.6.0] - Phase 6: Voice Assistant, Wake Interaction, and Safe Desktop Actions
### Added
- Genuine offline voice assistant and desktop action architecture preserving all local inference, RAG, and security boundaries.
- `VoiceService` with full lifecycle state machine (`idle`, `requesting_permission`, `listening`, `processing`, `speaking`, `interrupted`, `error`), push-to-talk default, live transcript staging, and permission state handling.
- Local Speech Synthesis (TTS) via offline OS speech engines (`SpeechSynthesisUtterance`) with voice selection, speech rate adjustment (0.5x to 2.0x), and instant interruption (`stopSpeaking`).
- Spoken text filter (`cleanTextForSpeech`) stripping code blocks, markdown headings/formatting, URLs, system instructions, and source citations so only natural language is spoken aloud while citations remain visible on screen.
- Streaming sentence segmentation (`segmentSentences`) to process and speak responses naturally in sentence boundaries without waiting for entire answer completion.
- Local keyword spotting and offline wake-word detector (`"Hey ASTRO"`, disabled by default for privacy, with visible listening indicators when active).
- Restricted safe Desktop Action System (`ActionService` & `ActionRegistry`) with 3-tier risk classification:
  - Low Risk (auto-executable): `system_status` (hardware specs & RAM), `search_library` (RAG query), `read_file_info` (file stats within allowed workspace), `manage_jobs` (cancel indexing/inference).
  - Moderate Risk (confirmation-gated): `open_app` (strictly validated against configured application allowlist), `open_path` (validated against workspace boundaries), `create_note` (safe markdown note in managed notes directory with path traversal protection).
  - High Risk (mandatory explicit confirmation dialog): `exec_command` (terminal execution in approved workspace), `delete_file` (permanent file removal).
- Pre-execution target re-validation right before action dispatch to protect against race conditions or modified targets.
- Duplicate action execution debounce prevention within 2-second windows.
- Prompt injection containment: retrieved RAG document passages are strictly neutralized, ensuring commands embedded in documents are never executed.
- Chat UI integration: Push-to-talk microphone button (`#btn-chat-mic`), live recording pulse, transcript preview & edit bar (`#chat-transcript-bar`), stop-speaking interrupt button, and interactive desktop action cards with Confirm/Cancel controls.
- Voice Settings & Activity Screen integration: Native OS voice selector, speech rate slider, Test Voice action, Test Microphone action with live real-time audio level meter, and Clear All History action.
- Comprehensive Phase 6 test suite (`tests/phase6-voice-actions.test.js`) with 15 automated test cases, expanding the project suite to 75 passing tests.

## [0.5.0] - Phase 5: Local File Intelligence and RAG
### Added
- Real, private, offline-first local file intelligence and Retrieval-Augmented Generation (RAG) system.
- User-approved File Library management (`LibraryService`) with native folder/file pickers, exclusion rules (`node_modules`, `.git`, `dist`, `build`, etc.), and persistence in `library.json`.
- Incremental indexing pipeline using modification timestamp (`mtime`) and SHA-256 hash checks to avoid redundant processing, plus automatic pruning of deleted files.
- Modular document extractor registry (`DocumentExtractorRegistry`) with magic byte sniffing (`%PDF-`, `PK\x03\x04`, PNG, JPEG):
  - `TextExtractor`: Plain text, Markdown (with heading hierarchy), source code (JS, TS, Python, Go, Rust, C/C++, HTML, SQL, etc.), JSON, CSV/TSV (pipe-formatted tables), XML, logs, and max-size protection.
  - `PdfExtractor`: Native text-based PDF parsing (`BT ... ET`, `/FlateDecode`), encrypted PDF detection, and scanned PDF detection for OCR.
  - `OfficeExtractor`: DOCX, XLSX, and PPTX extraction via pure Node.js zip decompression and XML text extraction without heavy external dependencies.
  - `OcrExtractor`: Local image and scanned PDF OCR with honest unconfigured reporting when Tesseract binary is not installed in system PATH.
- Structural document chunker (`DocumentChunker`) respecting heading boundaries and tabular rows, preserving rich metadata (`docId`, `docPath`, `docName`, `fileType`, `heading`, `chunkIndex`, `charStart`, `charEnd`, `terms`).
- Dedicated local embedding model manager (`EmbeddingManager`) with approved GGUF catalog (`nomic-embed-text-v1.5`, `bge-small-en-v1.5`), CPU fallback, memory safety, and cosine similarity calculation.
- Hybrid retrieval engine (`RetrievalService`): BM25/TF-IDF lexical search, semantic cosine similarity vector search, Reciprocal Rank Fusion (RRF), deduplication, and metadata filtering (folder, file type, selected sources).
- Grounded question-answering with prompt-injection containment (`AssistantCoordinator`): verified document context bounded as untrusted data, honest no-evidence reporting, and three chat modes (`Local files`, `General assistant`, `Selected sources`).
- Complete UI integration across Chat (mode selector, expandable source preview, Open in OS button), Files (library roots, Add Folder/File, re-indexing, removal), and Knowledge & RAG (indexing progress bar, embedding status, index storage reporting, rebuild warning).
- Safe IPC bridge (`preload.js` & `main.js`) exposing all library, embedding, and file operations with path validation and boundary checks.
- Comprehensive Phase 5 test suite (`tests/phase5-rag.test.js`) with 15 automated test cases, expanding test suite to 60 passing tests.

## [0.4.0] - Phase 4: Genuine Local Offline Inference & Execution
### Added
- Native inference integration using `node-llama-cpp` v3 with Vulkan acceleration and AVX2 CPU fallback for AMD Ryzen 5 with Radeon Graphics.
- Dynamic module loading supporting ESM and native addon bindings without blocking UI thread.
- Full streaming inference pipeline with real-time tokens-per-second, time-to-first-token (TTFT), and token count emission.
- Cancellation and interrupt support allowing generation to be halted mid-stream without crashing or leaking resources.
- Single-model memory enforcement: automatic unloading of previous model and resource cleanup before new model initialization.
- Readiness confirmation via health verification test before transitioning models to `ready`.
- `ExternalProviderInterface` enforcing privacy by keeping remote/cloud AI strictly disabled by default with mandatory explicit user confirmation.
- Chat UI integration wired to real local inference and RAG pipeline with citations, token streaming, and user prompt preservation.
- Comprehensive Phase 4 test suite (`tests/phase4-inference.test.js`) verifying local model loading, streaming, cancellation, switching, RAG context passing, and external provider safeguards.

## [0.3.0] - Phase 3: Real AI Model Manager & Hugging Face Downloader
### Added
- Official Model Catalog configured for default `Qwen2.5-Coder-7B-Instruct-GGUF` (Q4_K_M recommended) and optional `Qwen3-8B`.
- `HuggingFaceDiscovery` service querying real Hugging Face API and tree endpoints, extracting sizes and LFS SHA-256 hashes, with offline discovery caching.
- `DownloadManager` featuring persistent download queue (`download-queue.json`), HTTP 206 `Range` resumption, streaming speed and ETA metrics, pause, cancel, and safe retry.
- Pre-flight storage checks enforcing model size plus 5.0 GB safety margin before download initiation.
- `DownloadVerifier` verifying GGUF header magic (`0x46554747` / `'GGUF'`), format version, and streaming SHA-256 integrity checksums.
- `ModelRegistry` persisting installed models to `registry.json` with audit trails and directory migration capabilities.
- `ModelLifecycleManager` enforcing a state machine (`not-installed`, `queued`, `downloading`, `verifying`, `installing`, `installed`, `loading`, `ready`, `unloading`, `failed`, `incompatible`).
- Automated Phase 3 test suite (`tests/phase3-model-manager.test.js`) covering all 20 required verification scenarios.

## [0.2.0] - Phase 2: Desktop UI and Application Shell
### Added
- Complete 10-screen native workspace: Home, Chat, Files, Knowledge & RAG, Research, Coding Studio, Model Manager, Voice, Activity, Settings.
- Collapsible sidebar with active navigation indicators and bottom persistent status bar (Offline mode, active local model, background activities).
- Restrained dark theme (default) and high-contrast light theme with real-time toggle.
- `ActivityService` tracking background tasks (downloads, model loading, indexing, terminal commands, research) with cancellation and duration metrics.
- `ResearchService` combining local-first RAG retrieval with privacy-controlled Wikipedia/public knowledge queries (blocked when offline-first mode is active).
- `VoiceService` with honest missing local Whisper engine reporting, microphone state, and TTS preference toggling.
- Enhanced `RAGService` with multi-collection management (create, rename, delete, switch collections) and document removal without file deletion.
- Enhanced `FileService` with category filters (code, docs, data), file details panel, and OS shell integration (`platform:open-path`).
- Enhanced `AssistantCoordinator` with conversation loading, renaming, and deletion.
- Comprehensive Phase 2 test suite (`tests/phase2-services.test.js`) verifying all new services.

## [0.1.0] - Phase 1: Foundation & Project Structure
### Added
- Permanent project rules (`docs/PROJECT_RULES.md`) establishing offline-first, private-by-default architecture.
- Full directory structure for native desktop application, services, UI screens, tests, and scripts.
- Acceptance test checklist (`docs/ACCEPTANCE_CHECKLIST.md`) covering all 15 core verification criteria.
- Licenses and attributions documentation (`docs/LICENSES.md`).
