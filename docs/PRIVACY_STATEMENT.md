# ASTRO Desktop Assistant — Privacy & Security Statement

**Version:** 0.1.0  
**Effective Date:** October 21, 2026  
**Core Design Philosophy:** Offline-First, Local-Only, User-Confined  

---

## 1. Core Privacy Commitments

ASTRO is engineered from the ground up to respect user sovereignty and personal data privacy:

1. **Local-Only Model Execution:** ASTRO executes all language and coding models locally on your physical machine. Your chat messages, prompts, queries, and code snippets are processed in your CPU/RAM and are **never** transmitted to cloud AI services or external servers.
2. **Offline-First by Default:** The default privacy configuration enforces `offlineOnly: true`. ASTRO does not require internet connectivity for its core functionality.
3. **Zero Telemetry or Phone-Home:** ASTRO contains no tracking pixels, analytics beacons, user telemetry collectors, advertising libraries, or automatic update pingers.
4. **Isolated Data Storage:** Conversations, document vector indexes, model catalog registrations, and application settings remain exclusively on your device inside your Windows User Profile directory (`%USERPROFILE%\.astro_data\`).
5. **No Automatic File Uploads:** ASTRO never scans, indexes, or processes files on your computer unless you explicitly add them to your knowledge library or open them in Coding Studio.

---

## 2. Local vs. Optional External Features

| Feature | Operational Boundary | Network Access | Data Destination |
|---------|----------------------|----------------|------------------|
| **Local AI Chat** | Local CPU / RAM | None (100% Offline) | Local device only |
| **Document Indexing & RAG** | Local Document Extractors | None (100% Offline) | `%USERPROFILE%\.astro_data\databases\rag-index\` |
| **Coding Studio & Diffs** | Local Workspace Directory | None (100% Offline) | Local files only |
| **Model Management (BYOM)** | Local File System | None (100% Offline) | `%USERPROFILE%\.astro_data\models\registry.json` |
| **Web Research (Optional)** | External Wikipedia API | Authorized query only | Fetches public encyclopedic excerpts. **Strictly disabled when `offlineOnly: true`.** |
| **Hugging Face Search (Optional)** | Remote Hugging Face API | Model metadata search | Fetches public model descriptions. **Strictly disabled when `offlineOnly: true`.** |

---

## 3. Storage and Data Management

All data created during your use of ASTRO is stored in an unencrypted, human-inspectable JSON directory structure located at:
`C:\Users\<YourUsername>\.astro_data\`

- **Conversations:** Saved in `databases/conversations/<id>.json`. You can inspect, rename, export, or delete any conversation directly from the interface or file system.
- **RAG Indexes:** Saved in `databases/rag-index/collection-default.json`. Contains text chunks, keyword terms, and vector weights computed from your documents.
- **Logs:** Saved in `logs/astro-main.log`.

---

## 4. Secret Redaction in Logs and Activity Records

ASTRO includes active secret redaction filters in `SecurityService.maskSecrets` and `StorageService.appendLog`:
- **Hugging Face Tokens:** `hf_[a-zA-Z0-9_\-]{20,}` is automatically masked as `[REDACTED_HF_TOKEN]`.
- **API Keys:** `sk-[a-zA-Z0-9_\-]{20,}` is automatically masked as `[REDACTED_API_KEY]`.
- **Bearer Tokens:** Authorization headers are masked as `[REDACTED_TOKEN]`.
- **Passwords:** Key-value pairs matching `password = ...` are masked as `[REDACTED_PASSWORD]`.

---

## 5. Third-Party Models & Document Considerations

When downloading external models or importing documents:
1. **Third-Party Model Files:** Only acquire `.gguf` files from trusted, established open-source repositories. While GGUF is a structured data format rather than an executable script, loading corrupted files could crash the local inference engine.
2. **Prompt Injection Containment:** If you index untrusted external documents (such as downloaded HTML or text files), those documents could contain adversarial instructions (prompt injections). ASTRO wraps retrieved document excerpts in strict Markdown quotation boundaries, instructing the model to treat retrieved content as reference data rather than executable instructions.

---

## 6. Operating System Boundary Clarification

ASTRO enforces privacy within the boundaries of the application itself. However, ASTRO cannot control:
- Operating system-level telemetry collected by Windows.
- Keystroke loggers, screen capture utilities, or third-party monitoring software installed on your device.
- Backups made by cloud storage software (such as OneDrive) if you choose to store your model files or workspace inside a synchronized folder. We recommend keeping `.astro_data` on a local, non-synchronized drive.
