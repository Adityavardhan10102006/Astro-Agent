# ASTRO Desktop Assistant — User Installation Guide

**Version:** 0.1.0  
**Target Platform:** Windows 10 / Windows 11 (64-bit, x86_64)  
**Distribution Type:** Standalone Offline Installer & Portable Executable  

---

## 1. What is ASTRO?

ASTRO is an offline-first, native Windows desktop AI assistant, document intelligence engine, and Coding Studio. Unlike web-based AI tools, ASTRO runs local language models (such as Qwen3-8B and Qwen2.5-Coder-7B) directly on your device's processor. 

- **100% Local & Private:** Your conversations, documents, code, and vector indexes remain on your hard drive. No chat data is uploaded to cloud servers.
- **Offline Operation:** Once installed with a compatible model, ASTRO functions without an internet connection.
- **Integrated Workspaces:** Includes Chat, Local File Explorer, Knowledge & RAG, Coding Studio, Model Manager, Voice Actions, Activity Log, and Settings.

---

## 2. System Requirements

Before installing ASTRO, verify that your computer meets the following hardware and software requirements:

| Requirement | Minimum (Application & Lightweight Models) | Recommended (Qwen3-8B & Coding Studio) |
|-------------|-------------------------------------------|----------------------------------------|
| **Operating System** | Windows 10 (64-bit) Build 19041+ or Windows 11 | Windows 11 (64-bit) |
| **Processor (CPU)** | 4-Core x86_64 with **AVX2** support | AMD Ryzen 5 (Zen 2/3/4) or Intel Core i5/i7 (8th Gen+) |
| **System Memory (RAM)** | 8 GB RAM (supports Qwen2.5-Coder-1.5B comfortably) | 16 GB RAM DDR4/DDR5 (minimum 12 GB for Qwen3-8B) |
| **Free Storage Space** | 2 GB for Application + 3 GB for 1.5B Model | 2 GB for Application + 10-12 GB for 8B Models |
| **Graphics (GPU)** | Integrated Graphics (AMD Radeon / Intel UHD) | Dedicated GPU (optional; CPU AVX2 is natively accelerated) |

> [!IMPORTANT]
> **Hardware Guidance & Memory Tiers:**
> - **Application Launch & 1.5B Models:** Systems with 8 GB RAM can launch ASTRO and execute `Qwen2.5-Coder-1.5B-Instruct` (requiring ~2.0 GB RAM) smoothly.
> - **Qwen3-8B Inference:** `Qwen3-8B-Q4_K_M.gguf` requires ~5.58 GB RAM (weights + context + engine overhead). Because Windows 11 typically consumes 3.5–4.5 GB of RAM, running Qwen3-8B on an 8 GB device will trigger memory paging warnings and disk swapping. A system with at least 12 GB RAM (16 GB recommended) is required to run Qwen3-8B without paging.
> - **AVX2 Instruction Set:** ASTRO's local inference engine requires AVX2 CPU vector extensions. Older processors without AVX2 will fail model execution.

---

## 3. Obtaining and Verifying the Release

ASTRO is distributed as two verified Windows executables:
1. **`ASTRO-Setup-0.1.0.exe`** (~369 MB) — Standard Windows Installer with automatic desktop and start menu shortcuts.
2. **`ASTRO-0.1.0-portable.exe`** (~368.6 MB) — Single-file portable edition. Requires no installation; runs from any folder or USB drive.

### Verifying Integrity and Source Authenticity
To confirm that your downloaded file has not been altered or corrupted in transit, open Windows PowerShell in your download folder and run:
```powershell
Get-FileHash -Path .\ASTRO-Setup-0.1.0.exe -Algorithm SHA256
```
Compare the output against the official manifest (`SHA256SUMS.txt`):
- **`ASTRO-Setup-0.1.0.exe`**: `F325DA5631033BCD9E6BEE14BD801597261858B4E0D9AD4A5C1B6514C352A3FB`
- **`ASTRO-0.1.0-portable.exe`**: `1FFC8C6B55365B06F27422FA98861BEBDBA3B8509EB8F4873ABA26195550C838`

> [!IMPORTANT]
> **Understanding Checksums and Trust:**
> - Comparing SHA-256 checksums against a trusted manifest detects accidental corruption or unauthorized modification in transit.
> - **A checksum alone does not prove who created the binary.** It proves integrity against the published manifest, not cryptographic publisher identity.
> - **Always obtain ASTRO exclusively from the project owner's designated release location.**
> - **NEVER bypass security warnings for binaries obtained from unknown, third-party, or unverified download sources.**

---

## 4. How to Install and Launch ASTRO

### Security and Code-Signing Notice
ASTRO v0.1.0 is currently unsigned (`NotSigned`) as an open-source technical preview. Because it does not yet include a paid commercial Extended Validation (EV) Authenticode digital signature, Windows Defender SmartScreen and other security systems may display an unrecognized publisher or reputation warning:
> *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."*

- **Technical Preview Users:** If and only if you downloaded the binary directly from the official, verified distribution location and confirmed that its SHA-256 hash matches the manifest above, you may proceed by clicking **"More info"**, then clicking **"Run anyway"**.
- **Important Warning:** Bypassing security prompts is only acceptable when you have personally verified the download source and checksum. It is **not** a general recommendation or a permanent substitute for commercial code signing.
- **Future Roadmap:** Commercial code signing will be acquired prior to general consumer distribution when an official organization identity is established.

### Option A: Standard Installer (`ASTRO-Setup-0.1.0.exe`)
1. Double-click `ASTRO-Setup-0.1.0.exe`.
2. Review the security prompt as explained above.
3. The ASTRO Setup Wizard will open. Follow the prompts to complete installation.
4. ASTRO installs cleanly to your personal user account:
   `%LOCALAPPDATA%\Programs\ASTRO\`
5. Launch ASTRO from your **Desktop** shortcut or **Start Menu**.

### Option B: Portable Edition (`ASTRO-0.1.0-portable.exe`)
1. Place `ASTRO-0.1.0-portable.exe` into any folder (e.g. `C:\Tools\ASTRO` or a USB drive).
2. Double-click the `.exe` to run immediately. No files are written to `Program Files`.

---

## 5. Selecting or Registering an AI Model

ASTRO does not bundle multi-gigabyte model weights inside the installer, keeping the download lightweight. You connect a local **GGUF** format model file on first launch.

### Recommended Model: Qwen3-8B (Q4_K_M)
- **Filename:** `Qwen3-8B-Q4_K_M.gguf`
- **File Size:** ~4.68 GB (5,027,783,488 bytes)
- **Format:** GGUF v3 (399 tensors)

### Step-by-Step Model Registration:
1. Save your `.gguf` file to your `Downloads` folder, on your `Desktop`, or in your preferred models directory (e.g., `C:\Models` or an external SSD).
2. Open ASTRO and click **🤖 Models** in the sidebar.
3. **Automatic Detection:** If the model is in your Downloads or Desktop folder, ASTRO automatically detects it and displays:
   > `⚡ Detected local model in workspace: Qwen3-8B-Q4_K_M.gguf (4.68 GB) — Click to Register & Activate`
4. Click **Register & Activate**.
5. **Manual Import (Bring Your Own Model):** If your model is in another directory or external drive:
   - Click the **"Import Local Model (.gguf)"** button.
   - Select your `.gguf` file in the file picker.
   - ASTRO validates the GGUF header and registers the file **in-place** (zero-copy) without duplicating the 5 GB file on disk.
6. The topbar badge turns green and displays the active model name.

---

## 6. Starting a Conversation

1. Click **💬 Chat** in the sidebar navigation.
2. In the input box at the bottom, type your prompt (e.g., `Hello ASTRO! What can you help me with today?`).
3. Press **Enter** to send (press **Shift + Enter** to add a new line).
4. ASTRO streams the generated response token by token directly from your local hardware.
5. If the model generates internal reasoning, click the collapsible **"💭 Thought Process"** block to review its step-by-step logic.
6. To copy code generated by ASTRO, click the **"Copy"** button on the top-right of any code block.

---

## 7. How to Switch Models Safely

ASTRO strictly enforces **single-model memory allocation** to protect your computer from out-of-memory crashes:
1. Click the **Model badge** in the top navigation bar or go to **🤖 Models**.
2. Select another registered model (or click "Switch Active Model").
3. ASTRO unloads the previous model from RAM, releases system memory, and allocates the new context.
4. Your existing conversation history is preserved across model switches.

---

## 8. Where Your Data is Stored

ASTRO isolates all user data in your Windows User Profile directory, completely separate from the application binaries:

```text
C:\Users\<YourUsername>\.astro_data\
├── databases\
│   ├── conversations\      <- All saved chat sessions and messages
│   └── rag-index\          <- Document chunks and vector search indexes
├── models\
│   ├── registry.json       <- List of registered model paths
│   └── active-model.json   <- Currently active model
├── settings\
│   └── astro-settings.json <- Theme, context window, and privacy settings
└── logs\
    └── astro-main.log      <- Redacted diagnostic logs
```

---

## 9. Updating ASTRO Without Losing Data

When a new version of ASTRO is released:
1. Download the new installer (e.g. `ASTRO-Setup-0.2.0.exe`).
2. Run the installer directly over your existing installation.
3. The installer updates only the application executable files in `%LOCALAPPDATA%\Programs\ASTRO\`.
4. **All user data, conversations, settings, and model registrations in `%USERPROFILE%\.astro_data\` are untouched.**

> [!TIP]
> To create an extra backup before updating, simply copy the `%USERPROFILE%\.astro_data` folder to your Desktop or a backup drive.

---

## 10. How to Uninstall ASTRO

If you ever wish to remove ASTRO:
1. Open Windows **Settings** → **Apps** → **Installed apps**.
2. Find **ASTRO** in the list, click the three dots (`...`), and select **Uninstall**.
3. Confirm uninstallation.
4. **Data Retention Policy:**
   - The uninstaller removes the application binaries and desktop shortcuts.
   - **User data in `%USERPROFILE%\.astro_data\` is NOT deleted.**
   - **Your downloaded `.gguf` model files are NEVER deleted.**
5. If you wish to completely erase all data permanently:
   - Open File Explorer and delete the folder: `C:\Users\<YourUsername>\.astro_data`.
