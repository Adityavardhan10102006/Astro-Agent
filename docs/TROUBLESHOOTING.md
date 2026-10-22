# ASTRO Desktop Assistant — Troubleshooting Guide

**Version:** 0.1.0  
**Target Platform:** Windows 10 / Windows 11  

---

> [!CAUTION]
> **Privacy Reminder:** When asking for technical support or sharing screenshots, **NEVER** share private chat messages, proprietary source code, passwords, API tokens, or unredacted log files. ASTRO logs automatically mask common token patterns, but personal file paths or document names may still be visible.

> [!IMPORTANT]
> **Data Safety:** Never delete your `%USERPROFILE%\.astro_data` folder as a first troubleshooting step. This folder contains all your saved conversations, RAG indexes, and settings. Most issues can be resolved without touching your data.

---

## 1. Common Issues and Resolutions

### Issue 1: Windows Defender SmartScreen Displays a Security Warning
- **Symptom:** When double-clicking `ASTRO-Setup-0.1.0.exe` or `ASTRO-0.1.0-portable.exe`, Windows displays a screen stating:  
  *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."*
- **Cause:** ASTRO v0.1.0 is an open-source technical preview build and is currently unsigned (`NotSigned`). Windows displays this warning by default for new executables without established cloud reputation or commercial Authenticode digital signatures.
- **Verification & Safe Handling:**
  1. **Confirm Download Source:** Ensure you downloaded the file directly from the designated official project release location.
  2. **Verify the SHA-256 Hash:** Open PowerShell and run `Get-FileHash .\ASTRO-Setup-0.1.0.exe -Algorithm SHA256`. Ensure it exactly matches `B4BC17B298528079962B827E5D50F7130A6AF25C588D174CE15ECA9F05208DA1`. (For portable: `9EEC822F4092BECE1C3DC28576743F4CBFC1A29977D869FF736E75A4954D252F`).
  3. **CAUTION:** While checksums prove file integrity against the manifest, they do not prove publisher identity. **NEVER** bypass security warnings if you obtained the binary from an untrusted or unknown third party.
  4. If the source and checksum are confirmed: In the SmartScreen window, click **"More info"**, then click **"Run anyway"**.
  5. *Note:* Commercial EV code signing is planned for future consumer releases to eliminate this step.

---

### Issue 2: ASTRO Will Not Launch or Closes Immediately
- **Likely Causes:**
  - Missing Microsoft Visual C++ Redistributable runtime.
  - Corrupted installation or antivirus false-positive quarantine.
- **Diagnostic Steps:**
  1. Open PowerShell and navigate to the ASTRO installation folder:
     ```powershell
     cd "$env:LOCALAPPDATA\Programs\ASTRO"
     .\ASTRO.exe
     ```
  2. Check for error output in the terminal.
  3. Verify that `%LOCALAPPDATA%\Programs\ASTRO\resources\app.asar` exists.
- **Recovery:**
  1. Download and install the latest [Visual C++ Redistributable for Visual Studio 2015-2022 (x64)](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist).
  2. Re-run `ASTRO-Setup-0.1.0.exe`. Your user data in `.astro_data` will be preserved.

---

### Issue 3: "No local AI model is currently loaded" in Chat
- **Symptom:** Submitting a message in the Chat workspace immediately returns:  
  *"No local AI model is currently loaded. To chat or generate code, please load a model from the Model Manager or import a local GGUF file."*
- **Cause:** You have not yet connected or activated a compatible GGUF model file.
- **Recovery:**
  1. Click **🤖 Models** in the left sidebar.
  2. If you see a green banner indicating a detected model, click **Register & Activate**.
  3. If no banner appears, click **"Import Local Model (.gguf)"** and select your downloaded `Qwen3-8B-Q4_K_M.gguf` file.
  4. Ensure the topbar model indicator turns green with your model's name before sending a chat message.

---

### Issue 4: Model Status Displays "Missing File" or Path No Longer Exists
- **Symptom:** Model card in Model Manager shows `Missing File` and loading fails with:  
  *"Model file not found at path: ..."*
- **Cause:** The `.gguf` file was moved, renamed, deleted, or stored on an external drive that is currently unplugged.
- **Recovery:**
  1. Reconnect your external drive if applicable.
  2. In the Model Manager, locate the model card and click the **"Repair Path"** button.
  3. Browse to the file's new location and select it.
  4. ASTRO will update the path in your registry without losing any settings.

---

### Issue 5: Computer Runs Out of Memory (RAM) or Performance is Very Slow
- **Symptom:** Text generation is very sluggish (< 1 token per second), or Windows reports high memory pressure.
- **Cause:** An 8-billion parameter model requires ~4.7 GB of free RAM. If background applications (like web browsers with dozens of tabs) consume available memory, Windows swaps memory pages to disk (`pagefile.sys`), causing slow performance.
- **Recovery:**
  1. Check your free memory in **⚙️ Settings** → **System Diagnostics**.
  2. Close unused high-memory background applications.
  3. In **⚙️ Settings** → **Inference**, reduce the **Context Window** from `4096` to `2048` tokens to shrink the KV-cache.
  4. Alternatively, use the ultra-lightweight **Qwen2.5-Coder-1.5B** model (~1.1 GB RAM), which runs comfortably on 8 GB systems.

---

### Issue 6: Response Generation Appears Stalled or Frozen
- **Symptom:** The chat message cursor blinks but no new tokens appear for over 30 seconds.
- **Cause:** Complex prompts or large reasoning steps can take a few seconds before the first token is emitted on pure CPU execution.
- **Recovery:**
  1. Click the **"Stop"** button in the chat input area to immediately abort generation.
  2. Check if a collapsible **"💭 Thought Process"** block appeared; click to expand it and see what the model was processing.
  3. Try re-phrasing the prompt more concisely.

---

### Issue 7: Local Document Search in RAG Returns No Relevant Results
- **Symptom:** Asking questions about your documents produces general answers without source citations.
- **Cause:**
  - The document has not been indexed yet.
  - The chat mode is set to `General Assistant` rather than `Local Files`.
  - The document format is scanned image-only PDF without OCR text.
- **Recovery:**
  1. Verify the chat mode dropdown below the chat box is set to **"Local Files"**.
  2. In **📚 Knowledge & RAG**, check that your document is listed with status `indexed` and has a non-zero chunk count.
  3. If your document is a scanned PDF (photo of paper), ensure you have text-selectable content or paste the text directly.

---

### Issue 8: Portable Build Behaves Differently from Installed Build
- **Symptom:** Portable build fails to launch or cannot find files.
- **Cause:** Portable builds unpack temporary runtime files to `%TEMP%`. If your corporate or antivirus policy blocks binaries in the temp directory, the portable executable may be blocked.
- **Recovery:**
  - Use the standard installer (`ASTRO-Setup-0.1.0.exe`), which installs to your permanent user directory (`%LOCALAPPDATA%\Programs\ASTRO`).

---

## 2. Diagnostic Logs and Support

If you encounter an unresolved defect:
1. Locate your diagnostic log file at:
   `C:\Users\<YourUsername>\.astro_data\logs\astro-main.log`
2. Open the file in Notepad.
3. Review the last 50 lines for error messages.
4. When requesting help on GitHub Issues, provide:
   - Your Windows version (e.g., Windows 11 Build 22631).
   - Your processor model and RAM (e.g., AMD Ryzen 5 5500U, 16 GB RAM).
   - The exact model name and quantization (e.g., `Qwen3-8B-Q4_K_M.gguf`).
   - The specific error message shown in the ASTRO interface.
