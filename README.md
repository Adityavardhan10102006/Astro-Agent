# ASTRO — Offline-First Native Desktop AI Assistant

ASTRO is an offline-first, native desktop AI assistant engineered for privacy, local intelligence, and hardware efficiency on Ryzen 5 laptops. ASTRO runs Qwen coding and reasoning models locally via GGUF without sending data to external cloud services.

## Core Principles
- **Local-first**: Inference, RAG, and desktop operations work without an internet connection once models are installed.
- **Private by default**: Conversations, code, and document indices never leave your device.
- **Genuine Desktop Actions**: File search, coding studio, terminal with permission controls, and local RAG.
- **Strict Verification**: Every download is checked for integrity, size, and hash before being marked installed.

## Prerequisites
- Windows 10/11 (AMD Ryzen 5 or equivalent x86_64 CPU)
- 16 GB RAM recommended (minimum 8 GB)
- Node.js v18+ (tested on Node v24)
- At least 15 GB free disk space for GGUF model storage

## Getting Started
1. Install dependencies:
   ```cmd
   npm.cmd install
   ```
2. Start ASTRO in development mode:
   ```cmd
   npm.cmd start
   ```
3. On first run:
   - Navigate to **Model Manager**
   - Inspect hardware capacity (RAM, CPU cores, free disk space)
   - Discover and download **Qwen2.5-Coder-7B-Instruct (Q4_K_M)**
   - Test model loading and verify offline inference

## Offline Verification Procedure
1. Disconnect network or enable Airplane Mode.
2. Launch ASTRO.
3. Observe status indicator: `OFFLINE MODE`.
4. Enter a query or coding prompt in **Chat**.
5. Confirm tokens stream directly from local memory without cloud dependencies.
