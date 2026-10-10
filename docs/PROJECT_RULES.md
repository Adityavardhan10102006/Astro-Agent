# ASTRO — Permanent Project Rules

## Rule 1: Build a real desktop application
ASTRO must be a native desktop application, not a website or a web application disguised as a desktop app. Its main functions must work without opening a browser.

## Rule 2: Offline-first architecture
All essential assistant functions must work offline once the required local models and supporting resources are installed. Never make cloud AI, internet access, or an external account mandatory for normal local operation.

## Rule 3: Local AI is the default
Use Qwen2.5-Coder-7B-Instruct as the default local coding model, preferably with a practical 4-bit quantization when compatible. Support Qwen3-8B as an optional alternative. Never assume both models can run simultaneously.

## Rule 4: Private by default
Keep conversations, local files, document indexes, embeddings, and project content on the user's device. Never upload files automatically. Clearly disclose when an explicitly enabled external service will receive information.

## Rule 5: Build functionality before polish
Every visible control must perform its stated function. Do not use fake model downloads, simulated inference, placeholder search results, decorative buttons, or mock progress indicators in the completed application.

## Rule 6: Optimize for the actual laptop
Target practical operation on a Ryzen 5 laptop with integrated Radeon graphics. Detect available RAM, CPU capabilities, graphics support, free disk space, and model compatibility. Provide CPU fallback and clear hardware warnings. Never promise unsupported acceleration or instant inference.

## Rule 7: Optimize response speed
Stream generated text, reuse loaded models, avoid unnecessary model initialization, index documents incrementally, use direct tools for simple tasks, and keep retrieval and user-interface interactions responsive.

## Rule 8: Implement complete local RAG
ASTRO must support local document extraction, chunking, embeddings, persistent indexing, keyword and semantic retrieval, relevant-context selection, source citations, and incremental updates. RAG must remain usable offline.

## Rule 9: Implement genuine desktop actions
ASTRO should open applications, find files, inspect projects, edit code, execute approved commands, and report results. Use explicit permissions and confirmations for destructive or security-sensitive actions.

## Rule 10: Make model management reliable
Implement model discovery, compatible-format selection, disk-space checks, downloading, progress reporting, cancellation, resumption where supported, integrity verification, installation, loading, switching, unloading, and deletion.

## Rule 11: Respect model licenses and access requirements
Show the model source, license, size, format, quantization, and any required access approval. Never bypass access restrictions. Keep authentication credentials out of source files, logs, and ordinary settings.

## Rule 12: Support multiple file formats honestly
Build a clear file-support registry. Use suitable local document extractors, OCR, media tools, and parsers. Explain when a format requires an additional component or cannot be processed.

## Rule 13: Design for failures
Provide meaningful loading, empty, offline, insufficient-memory, low-disk-space, download-failure, corrupted-file, model-unavailable, and permission-denied states. Preserve completed work when operations fail.

## Rule 14: Protect user projects
Before editing files, preserve existing content and show changes where appropriate. Never overwrite or delete user data silently. Ask for confirmation before destructive commands, bulk changes, or operations outside approved directories.

## Rule 15: Build in verified stages
Inspect the existing project first. Create a coherent project structure, implement each subsystem, run checks, and fix failures before proceeding. Do not declare a feature complete until it has been tested.

## Rule 16: Keep the application maintainable
Separate user-interface components, application services, local model management, document processing, RAG, voice, web research, coding tools, security, and settings. Avoid giant files, duplicated logic, hardcoded machine-specific paths, and hidden configuration.

## Rule 17: Make privacy and status visible
Show whether ASTRO is offline or online, which model is active, whether a model is downloading or loading, and whether external services are enabled. Provide controls for local data, indexing, permissions, and connected models.

## Rule 18: Finish with a working deliverable
Provide setup instructions, required resource downloads, a complete file inventory, test results, known limitations, and clear instructions for starting ASTRO and using it without internet access.
