# ASTRO System Architecture

## Overview
ASTRO is an offline-first, native desktop AI assistant engineered for privacy, direct hardware optimization, and genuine local execution on AMD Ryzen 5 systems (with integrated Radeon graphics).

```mermaid
graph TD
    subgraph UI ["Desktop UI Layer (Electron + Vanilla CSS)"]
        Nav[Sidebar Navigation]
        ChatScreen[01 Home & Chat]
        ModelScreen[02 Model Manager]
        FilesScreen[03 Files & RAG Knowledge]
        StudioScreen[04 Coding Studio]
        SettingsScreen[05 Settings & Diagnostics]
    end

    subgraph CoreServices ["Application Service Layer (Node.js)"]
        AssistantService[Assistant Coordinator]
        ModelManager[Model & Download Manager]
        InferenceEngine[Local Inference Manager (llama.cpp / GGUF)]
        RAGService[Local RAG & Embeddings]
        FileService[File Search & Extraction]
        CodingService[Safe Coding & Diff Runner]
        SecurityService[Permissions & Guardrails]
        HardwareService[Hardware & Memory Detector]
        StorageService[Local Data & DB Manager]
    end

    subgraph DataStore ["ASTRO_DATA (Isolated App Data Directory)"]
        ModelsDir[models/ - Verified GGUFs]
        DownloadsDir[downloads/partial-downloads]
        DatabasesDir[databases/ - History & Vector Index]
        DocsDir[documents/extraction-cache]
        LogsDir[logs/ & settings/]
    end

    UI --> CoreServices
    CoreServices --> DataStore
    InferenceEngine --> ModelsDir
```

## Data Isolation & Storage Layout
In accordance with Rule 4 (Private by Default) and Rule 10, all large models and persistent indexes are stored in the user's OS application data directory (`ASTRO_DATA`):

```
ASTRO_DATA/
├── models/
│   ├── catalog.json
│   ├── active-model.json
│   └── qwen2.5-coder-7b/
│       ├── model.gguf
│       └── model-metadata.json
├── downloads/
│   └── partial-downloads/
├── databases/
│   ├── conversations/
│   └── rag-index/
├── documents/
│   └── extraction-cache/
├── settings/
└── logs/
```

## Subsystem Design
1. **Model Discovery & Download Subsystem**:
   - Fetches repository metadata directly from Hugging Face official APIs (`https://huggingface.co/api/models/...`).
   - Resolves individual GGUF quantized files, byte sizes, and commit hashes.
   - Streaming download with HTTP range headers (`bytes=...`) for resume support, calculating progress, speed, ETA, and cancellation via `AbortController`.
   - Post-download verification: file size check and SHA-256 hash validation before copying from partial downloads to verified `models/` directory.

2. **Inference Subsystem**:
   - Executes GGUF models locally with AVX2 CPU optimization for AMD Ryzen 5 5500U.
   - Enforces a single loaded model rule to preserve system RAM (laptop has 16GB RAM, ~4GB headroom).
   - Real-time token streaming with cancel/stop generation control.

3. **Local RAG Subsystem**:
   - Reads files offline (.txt, .md, .py, .js, .json, .csv, .pdf).
   - Local chunking with overlap.
   - Local keyword + vector retrieval without remote API calls.
   - Provides verified source citations (file path + matching snippet).

4. **Coding Studio & Desktop Actions**:
   - File browser, diff review, safe project inspections.
   - Command runner with explicit user approval dialogues for destructive changes.
