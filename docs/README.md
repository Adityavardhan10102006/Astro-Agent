# ASTRO — Offline-First Native Desktop AI Assistant & Coding Studio

ASTRO is an offline-first, native desktop AI assistant engineered for privacy, local intelligence, and hardware efficiency on Windows laptops (specifically optimized for AMD Ryzen 5 with integrated Radeon graphics). ASTRO runs Qwen coding and reasoning models locally via GGUF containers without sending prompts, documents, or data to external cloud services.

---

## 1. Core Principles & Architecture
- **Offline-First**: Local inference, document RAG, and coding actions execute completely on-device without internet access.
- **Private by Default**: Prompts, files, chat history, indexes, and logs never leave your workstation.
- **Genuine Desktop Actions**: File management, Coding Studio, diff viewer, automatic `.astro_bak` file backups, guarded terminal runner, and local RAG.
- **Safe Native AI**: Runs with compiled C++ bindings (`node-llama-cpp`) using CPU AVX2 multi-threading.
- **Zero-Copy Model Registration**: Ingests and runs existing `.gguf` models directly without duplicating multi-gigabyte files.
- **Decoupled User Storage**: User data, databases, settings, and downloaded models are stored in `%USERPROFILE%\.astro_data`, ensuring data survives application upgrades and uninstallation.

---

## 2. Windows Packaging & Installer

ASTRO provides a fully configured Windows distribution pipeline using `electron-builder`.

### Generated Release Artifacts
All production build artifacts are generated into the [`release/`](file:///c:/aditya/ASTRO/release) directory:
- **NSIS Installer**: `release/ASTRO-Setup-0.1.0.exe` (~351 MB)
  - Full Windows installation wizard.
  - Installs to `%LOCALAPPDATA%\Programs\ASTRO` (per-user, no admin permissions required).
  - Creates Desktop and Start Menu shortcuts.
  - Safe uninstaller: preserves user models, databases, and settings in `%USERPROFILE%\.astro_data`.
- **Portable Executable**: `release/ASTRO-0.1.0-portable.exe` (~351 MB)
  - Single-file standalone executable.
  - Run anywhere without installation.
- **Unpacked Application Directory**: `release/win-unpacked/` (~942 MB)
  - Contains `ASTRO.exe` and unpacked native C++ libraries under `resources/app.asar.unpacked/`.

### Build Commands
To compile release artifacts on Windows:
```cmd
# Build both NSIS Installer and Portable Executable
npm.cmd run build

# Build NSIS Installer only
npm.cmd run build:installer

# Build Portable Executable only
npm.cmd run build:portable

# Build unpacked directory for testing
npm.cmd run build:dir
```

---

## 3. How to Install & Launch

### Option A: Using the Windows Installer
1. Double-click `ASTRO-Setup-0.1.0.exe` in the `release/` directory.
2. Follow the setup wizard to choose the installation folder (defaults to `%LOCALAPPDATA%\Programs\ASTRO`).
3. Click **Finish** to launch ASTRO.
4. *Note on Windows SmartScreen*: Because the executable is built locally without a purchased commercial code-signing certificate, Windows SmartScreen may show an "Unknown Publisher" warning. Click **More info** -> **Run anyway**.

### Option B: Using the Portable Build
1. Copy `ASTRO-0.1.0-portable.exe` to any folder or external drive.
2. Double-click to launch ASTRO directly without installation.

### Option C: Developer Mode
```cmd
npm.cmd install
npm.cmd start
```

---

## 4. Locating or Importing Qwen3-8B

The installer packages only the application runtime and native execution libraries (~351 MB compressed); the 4.68 GB model weights are intentionally kept external to prevent massive installer downloads.

ASTRO automatically detects and imports `Qwen3-8B-Q4_K_M.gguf` from any of the following standard locations:
1. `%USERPROFILE%\.astro_data\models\Qwen3-8B-Q4_K_M.gguf`
2. `%USERPROFILE%\Downloads\Qwen3-8B-Q4_K_M.gguf`
3. Current working directory or portable executable directory
4. The project root: `c:\aditya\ASTRO\Qwen3-8B-Q4_K_M.gguf`

---

## 5. Bring Your Own Model (BYOM) & Chat-Based Model Management

ASTRO allows you to import any compatible GGUF language model from your laptop or search and switch models directly from chat or Model Manager.

### Option A: From Natural Language Chat
Type model management commands naturally in the chat input bar:
- `"Import a model from my computer"` — opens the native file selector and inspects model metadata.
- `"Show my installed models"` — displays all registered models with their format, quantization, and active status.
- `"Switch to my newly imported model"` — presents an explicit confirmation card to switch active models safely.
- `"Switch back to Qwen3-8B"` — restores the default Qwen3 model.
- `"Find Qwen3-8B"` or `"I want to use Llama 3.1 8B"` — searches the catalog or discovers compatible models on Hugging Face (when online discovery is permitted).

> [!NOTE]
> Ordinary conversation will **never** accidentally trigger model downloads or switches. All model operations present structured action cards requiring your explicit confirmation.

### Option B: Drag-and-Drop Model Import
Drag any `.gguf` file from Windows Explorer directly into the chat area. A dedicated blue drop zone will appear. Once dropped, the **Deep GGUF Inspector** opens automatically.

### Option C: Manual Import via Model Manager
1. Navigate to **07 Model Manager**.
2. Click **Import Local Model** (`#btn-import-model-file`).
3. Select any `.gguf` model file on your drive.
4. ASTRO performs deep metadata inspection:
   - Validates GGUF v2/v3 magic bytes and version.
   - Extracts architecture (`qwen3`, `qwen2`, `llama`, `mistral`, `gemma`, `phi`, etc.) and tensor count.
   - Evaluates compatibility against the local `node-llama-cpp` runtime.
   - Calculates RAM requirements against system free and total RAM.
5. Choose **Zero-Copy In-Place** (registers the existing file without duplicating multi-gigabyte files) or **Managed Copy**.
6. Click **Confirm & Register Model**.

### Safe Model Switching & Library Management
- **Safe Switching**: Click **Switch Active Model** in chat or Model Manager. ASTRO unloads the prior model safely, initializes the target model, and automatically rolls back if loading fails.
- **Deregistration vs Deletion**: Clicking **Deregister** removes a model from the ASTRO library while leaving the physical file untouched on disk. Deleting an external model file requires secondary confirmation.
- **Repair Moved Files**: If a model file is moved to a new folder or external drive, click **Repair Path** to reconnect the registration.

---

## 6. Storage Architecture & Updating Without Data Loss

All persistent state is stored outside the application installation directory:

| Component | Path | Description |
| :--- | :--- | :--- |
| **Root User Data** | `%USERPROFILE%\.astro_data\` | Master storage root |
| **Model Registry** | `%USERPROFILE%\.astro_data\models\` | Installed model catalog, registry.json |
| **Conversations** | `%USERPROFILE%\.astro_data\databases\conversations\` | Chat history JSON records |
| **RAG Knowledge** | `%USERPROFILE%\.astro_data\databases\rag-index\` | Extracted document embeddings & chunks |
| **Settings** | `%USERPROFILE%\.astro_data\settings\` | Theme, privacy, and inference preferences |
| **Logs** | `%USERPROFILE%\.astro_data\logs\` | Secret-redacted audit logs |

**Updating ASTRO**:
Running a newer `ASTRO-Setup-X.Y.Z.exe` installer or replacing the portable executable updates the application binary while leaving `%USERPROFILE%\.astro_data\` completely intact.

---

## 7. Known Hardware & Runtime Considerations
- **Hardware Target**: Optimized for AMD Ryzen 5 laptops (6 physical cores, 12 threads) with integrated AMD Radeon graphics.
- **Inference Mode**: Uses CPU AVX2 multi-threading (configured for 6 worker threads). This ensures high stability on laptops with integrated GPUs sharing system RAM.
- **Memory Requirement**: 14 GB system RAM recommended (model occupies ~4.2 GB RAM during execution).
- **Speech Recognition**: Voice input uses the native OS Web Speech API / typed text fallback. Whisper GGUF weights can optionally be loaded for 100% offline speech recognition.
- **Code Signing**: The installer is built without an expensive commercial EV certificate. Safe installation only requires clicking "Run anyway" on the Windows SmartScreen dialog.

---

## 8. Verification & Automated Tests
ASTRO maintains a comprehensive test suite covering all subsystems:
```cmd
# Run all 17 test suites (148 automated tests)
npm.cmd test
```
Every release is verified for zero-network traffic, physical GGUF integrity, sequence reuse, backup rollback integrity, Bring Your Own Model validation, and native C++ binary execution.
