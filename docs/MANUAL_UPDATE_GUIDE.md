# ASTRO Desktop Assistant — Safe Manual Update Guide

**Version:** 0.1.0  
**Target Environment:** Windows 10 / Windows 11 (64-bit)  
**Data Directory:** `%USERPROFILE%\.astro_data`  

---

## Overview

ASTRO adheres to an **offline-first, private-by-default architecture** (Rules 2 & 4). The application does not silently download updates or poll remote servers in the background. Upgrades are performed manually under the user's explicit control.

This Standard Operating Procedure (SOP) defines the verified 9-step procedure to update ASTRO while guaranteeing that all your saved conversations, RAG vector indexes, settings, and registered model weights are preserved.

---

## 9-Step Safe Manual Update Procedure

### Step 1: Confirm Your Currently Installed Version
1. Open ASTRO and click **⚙️ Settings** in the left sidebar.
2. Select the **General** tab and scroll to **System Diagnostics**.
3. Confirm the installed version line:
   ```text
   ASTRO Desktop Assistant v0.1.0 Diagnostics
   ```

### Step 2: Download the New Release Artifact
1. Visit the official ASTRO GitHub Releases repository:  
   `https://github.com/Adityavardhan10102006/Astro-Agent/releases`
2. Download the new installer: `ASTRO-Setup-<version>.exe` (or `ASTRO-<version>-portable.exe`).
3. Download the matching `SHA256SUMS.txt` manifest file.

### Step 3: Verify Artifact Integrity (Checksum Check)
Before executing any downloaded file, verify its cryptographic hash to ensure it was not corrupted or modified in transit:
- **Using Windows PowerShell:**
  ```powershell
  Get-FileHash -Path .\ASTRO-Setup-*.exe -Algorithm SHA256
  ```
- **Using Windows Command Prompt:**
  ```cmd
  certutil -hashfile ASTRO-Setup-0.1.0.exe SHA256
  ```
Confirm that the calculated 64-character hash matches the hash published in `SHA256SUMS.txt`.

> [!WARNING]
> If the checksum does not match, **do not run the executable**. Re-download the file and verify again.

### Step 4: Close Running ASTRO Instances
1. Close ASTRO by clicking the window close button (`✕`).
2. Verify in Windows Task Manager (`Ctrl + Shift + Esc`) that no `ASTRO.exe` processes remain active. This ensures native llama C++ DLLs are unlocked.

### Step 5: Create a Pre-Update Safety Backup
Create a snapshot copy of your personal data directory:
```powershell
$backupPath = "$env:USERPROFILE\.astro_data_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item -Path "$env:USERPROFILE\.astro_data" -Destination $backupPath -Recurse
Write-Host "Backup created at: $backupPath" -ForegroundColor Green
```
This backup preserves all chat histories, vector indexes, and model registries.

### Step 6: Install the New Version
- **If using the Standard Installer (`ASTRO-Setup-*.exe`):**
  1. Double-click the new installer.
  2. If Windows SmartScreen displays a warning, click **"More info"** → **"Run anyway"**.
  3. Proceed through the wizard. The installer replaces application binaries in `%LOCALAPPDATA%\Programs\ASTRO\`.
  4. **Data Safety Guarantee:** ASTRO's packaging configuration enforces `deleteAppDataOnUninstall: false`. The installer will **never** overwrite or reset your `%USERPROFILE%\.astro_data` folder.
- **If using the Portable Edition (`ASTRO-*-portable.exe`):**
  1. Replace the older portable `.exe` with the new version.
  2. The portable version automatically connects to `%USERPROFILE%\.astro_data`.

### Step 7: Verify Data Retention
Launch the updated ASTRO application and confirm:
1. **Model Persistence:** The topbar shows your previously active model (e.g., `Qwen3-8B`).
2. **Chat History:** Past conversations are listed in the Chat sidebar.
3. **Knowledge Collections:** Indexed documents are present in **📚 Knowledge & RAG**.
4. **Settings:** Custom context windows and appearance settings are preserved.

### Step 8: Perform a Verification Test Chat
1. Navigate to **💬 Chat**.
2. Submit a test message: `Hello ASTRO! Verify system status after update.`
3. Confirm that tokens stream successfully from your local model.

### Step 9: Recovery / Rollback Procedure (If Update Fails)
If the new release exhibits an issue:
1. Close ASTRO.
2. Uninstall the new version via Windows **Settings** → **Installed apps** → **ASTRO** → **Uninstall**.
3. Re-run your prior known-working installer (e.g. `ASTRO-Setup-0.1.0.exe`).
4. If settings were altered, restore from your Step 5 backup:
   ```powershell
   Remove-Item -Path "$env:USERPROFILE\.astro_data" -Recurse -Force
   Copy-Item -Path $backupPath -Destination "$env:USERPROFILE\.astro_data" -Recurse
   ```
5. Launch ASTRO to resume normal operation.
