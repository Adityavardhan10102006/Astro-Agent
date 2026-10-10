# Changelog

All notable changes to the ASTRO project will be documented in this file.

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
