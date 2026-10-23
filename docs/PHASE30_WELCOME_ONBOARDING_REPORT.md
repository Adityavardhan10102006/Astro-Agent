# ASTRO Phase 30 — Welcome Screen, Animated Hero, and First-Time Onboarding Report

**Assessment**: **PASS**  
**Phase**: Phase 30 — Welcome Screen, Animated Hero, and First-Time Onboarding  
**Platform**: Windows (Native Desktop Electron Application, AMD Ryzen 5 AVX2 architecture)  
**Date**: October 2026  

---

## 1. Executive Summary

Phase 30 successfully designs and integrates a dedicated, ASTRO-branded **Welcome & First-Time Onboarding** experience into the native desktop application. Building upon the core workflow repairs of Phase 28 and the dual-workspace architecture (AI Chat and VS Code-style Coding Studio) established in Phase 29, the welcome experience provides immediate clarity, honest system state reporting, and seamless workspace navigation for both first-run and returning users.

The implementation adapts the animated hero concept into native HTML5, CSS3, and JavaScript, strictly conforming to ASTRO's **Rule 1 (Real desktop application)**, **Rule 2 (Offline-first architecture)**, **Rule 4 (Private by default)**, and **Rule 5 (Functionality before polish)**. Every button and link connects directly to live application services:
- **Primary action ("Start Chatting")**: Navigates immediately to the dedicated AI Chat workspace, initializes a clean conversation, and focuses the composer.
- **Secondary action ("Open Coding Studio")**: Launches the VS Code-style Coding workspace with active project intelligence and diff review.
- **Model Readiness Status Strip**: Dynamically evaluates the local model registry, download queue, and loaded memory state, rendering truthful status indicators (Active, Downloading, Installed, or Setup Required) and immediate recovery actions.
- **First-Time 3-Step Onboarding Guidance**: Educates users on the local engine, chat capabilities, and safe coding rollback safeguards with direct 1-click workspace entry.
- **Returning-User Startup Control**: Provides an in-app startup preference toggle synchronized with persistent application settings (`showWelcomeOnStartup`), enabling returning users to bypass onboarding directly into AI Chat while preserving access to Welcome via the sidebar at any time.

All 188 automated tests across the ASTRO test suite pass with 0 failures, 0 regressions, and zero external network calls.

---

## 2. Inventory of Changed Files

| File Path | Nature of Change | Purpose & Rationale |
| :--- | :--- | :--- |
| `src/config/default-settings.js` | Modified | Added default setting `appearance.showWelcomeOnStartup = true` for first-time launch flow. |
| `src/ui/index.html` | Modified | Updated navigation sidebar to display `🏠 Welcome`; redesigned `#home-screen` with the ASTRO animated hero, live `#hero-model-status-card`, startup toggle `#welcome-chk-startup`, and 3-step onboarding guide (`.welcome-onboarding-grid`); added `#setting-welcome-startup` to Settings Appearance tab. |
| `src/ui/theme/styles.css` | Modified | Added CSS rules for `.hero-model-status-card`, status dots (`.ready`, `.loading`, `.installed`, `.setup-needed`), badge states, startup toggle, `.welcome-onboarding-grid`, `@media (prefers-reduced-motion: reduce)`, and responsive breakpoints at `1024px` and `860px`. |
| `src/ui/app.js` | Modified | Mapped `'home-screen': '🏠 Welcome'` in `screenTitleMap`; updated `initApp()` to handle first-run vs returning user launch routing; wired click handlers for `#hero-btn-start-chat`, `#hero-btn-open-studio`, `#hero-btn-open-models`, `#hero-btn-setup-model`, `#hero-btn-import-model`, and onboarding card actions; enhanced `refreshHomeView()` to dynamically evaluate live model readiness; bound startup toggle to `api.saveSettings()`. |
| `tests/phase30-welcome-onboarding.test.js` | Created | Comprehensive automated regression test suite containing 6 unit and integration tests covering DOM structure, CSS design tokens, controller event bindings, startup flow persistence, model state machine transitions, and offline CSP compliance. |

---

## 3. Welcome Screen & Animated Hero Architecture

### 3.1 Restrained Dark Desktop Aesthetics & Brand Identity
- **Visual Texture**: Built with a subtle noise overlay (`.hero-noise-overlay`) and an radial gradient accent (`radial-gradient(circle at 50% -10%, rgba(59, 130, 246, 0.16) 0%, rgba(16, 185, 129, 0.05) 50%, transparent 80%)`) on `var(--bg-card)`.
- **Typographic Polish**: Wordmark `ASTRO` rendered in bold desktop typography with letter-by-letter entrance staggering (`.pull-up-word`), accompanied by a pill tag indicating `v0.1 · Offline`.
- **Top Navigation Strip**: Quick-access pill bar featuring the active offline privacy status indicator (`Offline-First • Private AI`) and quick route pills (`💬 Chat`, `🛠️ Coding`, `⚡ Models`, `⚙️ Settings`).
- **Concise Copy**: Honest, user-oriented description explaining local execution, zero telemetry, local RAG document extraction, and guarded coding workspaces.

### 3.2 Integrated Live Model Readiness Widget (`#hero-model-status-card`)
Unlike static mockups, the hero's readiness card queries live services (`api.getActiveModel()`, `api.getCatalog()`, `api.getDownloadQueue()`) and handles four distinct runtime states:
1. **State 1 — Model Active in Memory**:
   - Indicator Dot: Green pulse (`.ready`).
   - Badge: `Active & Ready` (`.hero-model-badge.ready`).
   - Title: `Model Ready: <Model Name>`.
   - Description: Displays memory residency, load time (ms), and context window size.
   - Primary Action: "Start Chatting" enters chat immediately; action button offers "🔄 Switch Active Model" opening the model switcher modal.
2. **State 2 — Model Download in Progress**:
   - Indicator Dot: Amber dot with CSS pulse animation (`.loading`).
   - Badge: `Downloading` (`.hero-model-badge.loading`).
   - Title: `Downloading <filename>...`.
   - Description: Displays transferred MB and total expected size; clarifies that users can safely explore other areas of the application while the download completes in the background.
   - Action Button: "⏱️ View in Activity" navigating to the background tasks monitor.
3. **State 3 — Model Installed on Disk (Unloaded)**:
   - Indicator Dot: Blue dot (`.installed`).
   - Badge: `Installed (Not Loaded)` (`.hero-model-badge.installed`).
   - Title: `Model Available: <Model Name>`.
   - Description: Notes that a compatible GGUF model is registered on local disk and will load automatically on demand when a prompt is submitted in Chat.
   - Action Button: "⚡ Load or Switch Model".
4. **State 4 — No Model Registered (First Run)**:
   - Indicator Dot: Warning dot (`.setup-needed`).
   - Badge: `Setup Required` (`.hero-model-badge.warning`).
   - Title: `No Local Model Registered`.
   - Description: Explains that ASTRO operates 100% offline and requires importing an existing `.gguf` file or downloading Qwen2.5-Coder in Model Manager.
   - Action Button: "⚡ Set up a Model" navigating directly to Model Manager.

### 3.3 3-Step First-Time Onboarding Guidance
Directly beneath the hero, a 3-column card grid guides users through ASTRO's capabilities:
1. **Step 1: Local Model Engine (`#onboarding-card-model`)**: Explains 4-bit quantized GGUF inference on AMD Ryzen CPUs with AVX2 acceleration. Status pill reflects installed model status; button opens Model Manager (`#btn-onboarding-models`).
2. **Step 2: AI Chat Workspace (`#onboarding-card-chat`)**: Outlines multi-turn conversations, syntax-highlighted code blocks with 1-click copy, collapsible reasoning, and local document RAG. Button initiates a chat session (`#btn-onboarding-chat`).
3. **Step 3: Coding Studio (`#onboarding-card-studio`)**: Highlights file tree exploration, line-numbered editor, line diff review with explicit user approval, and automatic `.astro_bak` rollback creation. Button launches Coding Studio (`#btn-onboarding-studio`).

---

## 4. First-Run and Returning-User Flow

### 4.1 Launch Logic
In `src/ui/app.js`, `initApp()` dynamically evaluates both persistent configuration and session history:
```javascript
// First-run & returning-user navigation flow (Phase 30)
try {
  const showWelcomePref = currentSettings?.appearance?.showWelcomeOnStartup !== false;
  const hasOnboarded = localStorage.getItem('astro_has_onboarded') === 'true';
  if (showWelcomePref && !hasOnboarded) {
    // First run -> Guide user with Welcome & Onboarding
    navigateTo('home-screen');
  } else if (showWelcomePref) {
    // User configured Welcome screen on startup
    navigateTo('home-screen');
  } else {
    // Returning user -> Direct entry to AI Chat workspace
    navigateTo('chat-screen');
  }
} catch (err) {
  navigateTo('home-screen');
}
```

### 4.2 Startup Preference Controls
- **On the Welcome Hero**: Checkbox `#welcome-chk-startup` allows users to toggle "Show Welcome on application launch" directly on the welcome screen.
- **In Settings**: Setting row `#setting-welcome-startup` in the Appearance tab allows users to configure or re-enable the welcome screen at any time.
- **Permanent Navigation**: The left sidebar nav item `🏠 Welcome` (`data-screen="home-screen"`) remains accessible across all sessions, allowing returning users to revisit overview information, check system readiness, or access quick actions whenever desired.

---

## 5. Performance, Accessibility, and Responsive Design

### 5.1 Motion & Accessibility
- **CSS Keyframes**: Entrance animations use cubic-bezier easing (`@keyframes wordPullUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;`) with staggered delays (`--delay: 0.05s` to `0.68s`).
- **Reduced-Motion Enforcement**: Under `@media (prefers-reduced-motion: reduce)`, all transforms and opacity animations are disabled (`animation: none !important; opacity: 1 !important; transform: none !important;`), ensuring immediate and comfortable rendering for users with vestibular sensitivities.
- **Keyboard Navigation & ARIA**: All buttons feature explicit `type="button"`, semantic titles, ARIA landmark roles (`role="region"`), and high-contrast `:focus-visible` outlines.

### 5.2 Desktop Window Responsiveness
- **Standard Desktop (>1024px)**: Full 3-column onboarding layout with 920px max-width centered container.
- **Medium Desktop (860px – 1024px)**: Onboarding grid adapts to a 2-column layout; hero padding adjusts gracefully.
- **Compact Desktop (<860px)**: Onboarding grid stacks vertically in a single column; hero title scales from 64px to 44px; top strip stacks vertically to eliminate horizontal clipping or unwanted scrollbars.

### 5.3 Offline Boundary Enforcement
- Zero remote scripts, zero remote stylesheets, and zero remote fonts.
- Content Security Policy (CSP) strictly prohibits external CDNs (`default-src 'self'`).
- No background network connections or model downloads are triggered simply by opening the welcome screen.

---

## 6. Verification and Test Results

### 6.1 Automated Test Execution Summary
The ASTRO automated test suite was executed via native Node.js test runner (`npm.cmd test`):

```
✔ Phase 30: 1. Welcome Screen HTML layout and animated hero DOM structure (2.32ms)
✔ Phase 30: 2. CSS Design System includes pull-up animation, readiness badges, and reduced-motion fallback (2.70ms)
✔ Phase 30: 3. Controller script binds all welcome actions and routes to real application workspaces (1.35ms)
✔ Phase 30: 4. First-run and returning user startup navigation flow (26.88ms)
✔ Phase 30: 5. Model readiness state machine handles active, downloading, installed, and setup-needed states (1.75ms)
✔ Phase 30: 6. Offline-first privacy and security integrity (Zero cloud telemetry, zero remote scripts) (1.48ms)
✔ Animated Hero: 1. Native desktop HTML contains ASTRO hero with accessible navigation and actions (2.85ms)
✔ Animated Hero: 2. Design system styles include pull-up keyframes and reduced-motion guard (0.83ms)
✔ Animated Hero: 3. Controller script binds hero navigation and actions to real application routes (1.40ms)
✔ Animated Hero: 4. Reusable React component in components/ui/prisma-hero.tsx exports required subcomponents (3.73ms)
✔ Phase 29: 1. Dual-Workspace Navigation and HTML Shell Validation (2.69ms)
✔ Phase 29: 2. Chat Workspace DOM and Interactive Controls Integrity (0.94ms)
✔ Phase 29: 3. VS Code-Style Coding Workspace DOM and Panel Layout Integrity (1.29ms)
✔ Phase 29: 4. Application Logic and Keyboard Shortcut Bindings Validation (1.19ms)
✔ Phase 29: 5. Safe Coding Interactions: Diff Generation, Backups, and Rollback Integrity (14.91ms)
✔ Phase 29: 6. Project Intelligence: File Tree, Credentials Warning, and Diagnostics (10.85ms)
✔ Phase 29: 7. Terminal Command Execution Safeguards (Rule 9 & Rule 14) (116.03ms)
...
ℹ tests 188
ℹ suites 2
ℹ pass 188
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 25587.67
```

### 6.2 Manual Functional Verification
| Test Flow / Control | Expected Behavior | Observed Result | Status |
| :--- | :--- | :--- | :--- |
| **"Start Chatting" Button** | Navigates to `chat-screen`, opens new conversation, sets focus in input composer. | Verified: Switch to AI Chat occurs immediately; composer textarea is focused. | PASS |
| **"Open Coding Studio" Button** | Navigates to `studio-screen`, preserves explorer and editor state. | Verified: Switches to Coding Studio workspace smoothly without reloading. | PASS |
| **"Model Manager" Action** | Opens `models-screen` to manage, download, or import GGUF files. | Verified: Model Manager renders correctly with verified download cards. | PASS |
| **"Set up a Model" / Switch Model** | In unloaded state opens Model Manager; in loaded state opens Switcher modal. | Verified: Dynamically switches behavior based on memory residency. | PASS |
| **"Import Local GGUF" Action** | Opens native file dialog for zero-copy in-place registration. | Verified: Calls platform file dialog with GGUF header validation. | PASS |
| **3-Step Onboarding Buttons** | Navigates to Models, Chat, and Studio respectively. | Verified: Each button triggers the corresponding workspace route. | PASS |
| **Startup Preference Toggle** | Toggling updates `currentSettings.appearance.showWelcomeOnStartup`. | Verified: Checkbox changes persist across application restarts. | PASS |
| **Reduced Motion Fallback** | Disables transforms and animations when requested by OS. | Verified: `@media (prefers-reduced-motion: reduce)` renders static layout cleanly. | PASS |
| **Window Resizing** | Layout adapts cleanly down to 860px window width without horizontal scrollbars. | Verified: Onboarding grid drops from 3 to 2 to 1 columns smoothly. | PASS |

---

## 7. Known Limitations & Honest Disclosures

1. **Large Model Memory Requirements (Rule 6)**:
   Inference with Qwen2.5-Coder-7B or Qwen3-8B requires ~5.5 GB to 6.2 GB of free system RAM. On laptops with 8 GB total RAM sharing unified VRAM with integrated graphics, closing other heavy applications is recommended prior to loading.
2. **Optional Voice Engine (Rule 12)**:
   Microphone input requires local speech recognition components (e.g. local Whisper binary). If unconfigured, the voice service honestly reports offline availability rather than simulating transcription.
3. **Strict Offline Boundary (Rule 2 & Rule 4)**:
   ASTRO blocks outbound internet requests by default. Web research and Hugging Face model downloads only occur when explicitly enabled in privacy settings.

---

## 8. Final Assessment: PASS

All deliverables for **ASTRO Phase 30 — Welcome Screen, Animated Hero, and First-Time Onboarding** have been implemented, connected to working application services, and verified with automated regression tests. The application presents a welcoming desktop entry point while preserving existing functionality and privacy protections.
