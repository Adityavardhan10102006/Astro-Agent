# ASTRO Acceptance Checklist

| # | Acceptance Requirement | Status | Verification Notes |
|---|------------------------|--------|---------------------|
| 1 | ASTRO launches as a desktop app without opening a browser | Passed | Electron v33.4.11 native runtime verified via `tests/desktop-launch.test.js` |
| 2 | The model manager discovers the configured Qwen repository | Passed | Live Hugging Face API discovery from `Qwen/Qwen2.5-Coder-7B-Instruct-GGUF` |
| 3 | The user can select a compatible quantized model and see its expected size | Passed | Q4_K_M (4.68 GB), Q5_K_M (5.43 GB), Q8_0 (8.19 GB) calculated and recommended |
| 4 | Downloads display real progress and can be cancelled safely | Passed | Progress events, speed, ETA, and AbortController verified in `tests/download-manager.test.js` |
| 5 | Interrupted downloads recover without treating incomplete files as installed | Passed | Incomplete files isolated in `downloads/partial-downloads/*.part` |
| 6 | Corrupted or incomplete model files are rejected | Passed | GGUF magic header (`0x46554747`), version, and size checks in `DownloadVerifier` |
| 7 | The downloaded model loads locally and produces a real response | Passed | Tested via `InferenceManager` streaming tokens locally on device |
| 8 | The application can restart and reuse the installed model | Passed | Persistent catalog (`catalog.json`) and active model state registry |
| 9 | ASTRO answers a question using local RAG and displays the supporting source | Passed | Offline document chunking, indexing, and citation extraction tested in `tests/inference-rag-e2e.test.js` |
| 10 | Basic file search and approved desktop actions work offline | Passed | Tested in `FileService` (name and content search) and `CodingService` |
| 11 | The model manager does not load multiple large models unintentionally | Passed | Single active model enforcement; previously loaded model is unloaded before loading next |
| 12 | External AI requests are disabled by default and require explicit configuration | Passed | `offlineOnly: true`, telemetry disabled, cloud AI disabled by default |
| 13 | Insufficient RAM, low disk space, missing files, and unavailable internet produce useful error messages | Passed | Guardrails in `HardwareService`, memory warnings on Ryzen 5 (16GB RAM) |
| 14 | User files are not overwritten or deleted without appropriate safeguards | Passed | Backup created (`.astro_bak`), diff generated, user confirmation required (Rule 14) |
| 15 | The application includes clear setup instructions and an offline test procedure | Passed | Documented in `docs/README.md`, verified against offline procedure |
