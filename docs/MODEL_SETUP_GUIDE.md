# ASTRO — Local Model Setup and Requirements Guide

**Version:** 0.1.0  
**Target Architecture:** GGUF (v2 / v3)  
**Supported Quantizations:** Q4_K_M, Q5_K_M, Q8_0, Q4_0, Q4_1  

---

## 1. What is a GGUF Model File?

**GGUF** (GPT-Generated Unified Format) is the modern standard file format used for local AI models run with `llama.cpp` and `node-llama-cpp`. 

- A `.gguf` file contains all neural network weights, tokenizers, architecture definitions, and quantization tables packed into a single self-contained binary file.
- GGUF files allow computers without expensive datacenter GPUs to run high-performance AI models directly on standard consumer CPUs and system RAM through **quantization**.

---

## 2. Tested & Recommended Models

ASTRO is pre-configured to verify and run the following open-weights models:

### 1. Qwen3-8B (Recommended General & Reasoning Model)
- **Model Family:** Alibaba Cloud Qwen Team
- **Filename:** `Qwen3-8B-Q4_K_M.gguf`
- **File Size:** ~4.68 GB (5,027,783,488 bytes)
- **Context Length:** Up to 32,768 tokens (ASTRO default: 4,096 tokens)
- **Architecture:** Dense transformer with native ChatML dialogue formatting and `<think>...</think>` internal reasoning tags.
- **SHA-256 Checksum:** `d98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785`

### 2. Qwen2.5-Coder-7B-Instruct (Premier Local Coding Model)
- **Model Family:** Alibaba Cloud Qwen Team
- **Filename:** `qwen2.5-coder-7b-instruct-q4_k_m.gguf`
- **File Size:** ~4.68 GB
- **Context Length:** Up to 32,768 tokens (ASTRO default: 4,096 tokens)
- **Specialization:** Python, JavaScript, TypeScript, Rust, C++, SQL code generation, diff repair, and architectural explanation.

### 3. Qwen2.5-Coder-1.5B-Instruct (Lightweight / Low-RAM Model)
- **Filename:** `qwen2.5-coder-1.5b-instruct-q4_k_m.gguf`
- **File Size:** ~1.12 GB
- **Recommended For:** Systems with 8 GB or less RAM, or when maximum response speed is prioritized.

---

## 3. How to Connect a Model to ASTRO

### Option A: Automatic Workspace Detection
1. Download or copy your `.gguf` file into one of ASTRO's monitored search locations:
   - Your Windows `Downloads` folder (`C:\Users\<Username>\Downloads`)
   - Your `Desktop` (`C:\Users\<Username>\Desktop`)
   - The ASTRO application root folder
   - The ASTRO models folder (`C:\Users\<Username>\.astro_data\models`)
2. Launch ASTRO and navigate to **🤖 Models**.
3. A notification banner will appear:
   > `⚡ Detected local model in workspace: Qwen3-8B-Q4_K_M.gguf — Click to Register & Activate`
4. Click **Register & Activate**.

### Option B: Bring Your Own Model (BYOM) Import
If your model is stored on a secondary hard drive, an external SSD, or a custom folder:
1. Open ASTRO and click **🤖 Models**.
2. Click the **"Import Local Model (.gguf)"** button.
3. Use the Windows file picker to locate and select your `.gguf` file.
4. ASTRO validates the file header and registers the file **in-place**.
5. **Zero-Copy Architecture:** ASTRO references the file from its existing location without copying the 5 GB file, saving your disk space.

---

## 4. Handling Moved or Missing Model Files

If you rename, move, or disconnect the drive containing your model file:
1. ASTRO detects that the file is inaccessible and marks its status as `Missing File` in the Model Manager.
2. The model card displays a **"Repair Path"** button.
3. Click **"Repair Path"** and browse to the new location of the file.
4. ASTRO re-links the model registration without losing conversation history or settings.

---

## 5. Unregistering vs. Deleting Models

ASTRO strictly separates **library metadata** from **physical files on your hard drive**:
- **Unregistering a Model:** Clicking **"Unregister"** in the Model Manager removes the model from ASTRO's list. **The actual `.gguf` file on your disk is NOT deleted.**
- **Physical File Deletion:** If you wish to delete the 5 GB file from your disk to free storage space, ASTRO requires an explicit secondary confirmation (`"Confirm Permanent File Deletion"`).

---

## 6. Understanding RAM and System Requirements

Local AI inference stores billions of neural network parameters in system memory. Memory usage depends on several factors:

1. **Model Parameter Count:** A 8-billion parameter model requires more RAM than a 1.5-billion parameter model.
2. **Quantization Level:**
   - **`Q4_K_M` (4-bit):** ~4.7 GB RAM. Recommended sweet spot balancing language comprehension and memory efficiency.
   - **`Q5_K_M` (5-bit):** ~5.5 GB RAM. Marginally higher accuracy, but requires more free RAM.
   - **`Q8_0` (8-bit):** ~8.5 GB RAM. High precision; requires at least 16 GB total system RAM.
3. **Context Window Size:**
   - ASTRO defaults to a **4,096-token** context window.
   - Expanding the context window to 16k or 32k tokens increases the memory required for the KV-cache. You can adjust the context window in **⚙️ Settings** → **Inference**.

> [!WARNING]
> If your system has only 3.5 GB of free RAM when loading a 4.7 GB model, Windows will leverage the virtual memory paging file (`pagefile.sys`). While ASTRO will continue to function, inference speed may decrease while data is swapped between RAM and disk.

---

## 7. Performance & Generation Speed Expectations

Unlike cloud APIs that run on clusters of enterprise GPUs, ASTRO runs locally on your PC's hardware.

### Empirical Benchmark (AMD Ryzen 5 Reference Test):
- **Hardware:** AMD Ryzen 5 (6 Cores / 12 Threads) with AVX2 instruction support.
- **Model:** `Qwen3-8B-Q4_K_M.gguf` (4.68 GB).
- **Observed Speed:** **~4.0 to 4.5 tokens per second** during pure CPU execution.
- **Observed Speed (1.5B Model):** **~18 to 25 tokens per second**.

> [!NOTE]
> Performance differs significantly between computers based on CPU clock speed, RAM bandwidth (dual-channel DDR4/DDR5 vs single-channel), and thermal throttling. These benchmark numbers are real measurements provided as examples, not guarantees.

---

## 8. Safety & Untrusted Model Files

- Only download GGUF models from reputable sources (such as the official Alibaba Cloud Qwen repositories on Hugging Face).
- ASTRO verifies the binary magic bytes (`GGUF`) and inspects tensor metadata before loading to prevent buffer overruns or malformed file crashes.
- Never execute arbitrary `.bat`, `.exe`, or `.py` scripts claiming to be models. Genuine models are always `.gguf` files.
