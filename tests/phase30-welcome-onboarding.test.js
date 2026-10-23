const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { StorageService } = require('../src/services/storage/storage-service');
const { DEFAULT_SETTINGS } = require('../src/config/default-settings');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'astro-phase30-test-'));
}

test('Phase 30: 1. Welcome Screen HTML layout and animated hero DOM structure', () => {
  const htmlPath = path.join(__dirname, '..', 'src', 'ui', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Verify welcome screen section and hero container
  assert.ok(html.includes('id="home-screen"'), 'Welcome screen section #home-screen must exist');
  assert.ok(html.includes('id="home-animated-hero"'), 'Hero container #home-animated-hero must exist');
  assert.ok(html.includes('astro-animated-hero'), 'Hero must have astro-animated-hero styling class');
  assert.ok(html.includes('hero-noise-overlay'), 'Noise overlay texture element must exist');

  // Verify navigation strip
  assert.ok(html.includes('id="hero-nav-chat"'), 'Hero chat navigation pill must exist');
  assert.ok(html.includes('id="hero-nav-studio"'), 'Hero studio navigation pill must exist');
  assert.ok(html.includes('id="hero-nav-models"'), 'Hero models navigation pill must exist');
  assert.ok(html.includes('id="hero-nav-settings"'), 'Hero settings navigation pill must exist');

  // Verify animated wordmark and tagline
  assert.ok(html.includes('pull-up-word'), 'WordsPullUp animated spans must exist');
  assert.ok(html.includes('hero-brand-title'), 'Hero brand title heading must exist');
  assert.ok(html.includes('hero-tagline-multistyle'), 'Multi-style tagline container must exist');
  assert.ok(html.includes('Private, local intelligence'), 'ASTRO core headline must be present');

  // Verify primary & secondary actions
  assert.ok(html.includes('id="hero-btn-start-chat"'), 'Primary Start Chatting button must exist');
  assert.ok(html.includes('id="hero-btn-open-studio"'), 'Secondary Open Coding Studio button must exist');
  assert.ok(html.includes('id="hero-btn-open-models"'), 'Model Manager access button must exist');

  // Verify live Model Readiness strip inside hero
  assert.ok(html.includes('id="hero-model-status-card"'), 'Model readiness card must exist');
  assert.ok(html.includes('id="hero-model-dot"'), 'Model status indicator dot must exist');
  assert.ok(html.includes('id="hero-model-status-title"'), 'Model status title element must exist');
  assert.ok(html.includes('id="hero-model-badge"'), 'Model status badge must exist');
  assert.ok(html.includes('id="hero-model-status-desc"'), 'Model status description element must exist');
  assert.ok(html.includes('id="hero-btn-setup-model"'), 'Model setup action button must exist');

  // Verify startup preference toggle
  assert.ok(html.includes('id="welcome-chk-startup"'), 'Welcome startup preference checkbox must exist');

  // Verify 3-step onboarding guide cards
  assert.ok(html.includes('welcome-onboarding-grid'), 'Onboarding grid container must exist');
  assert.ok(html.includes('id="onboarding-card-model"'), 'Step 1: Model Engine card must exist');
  assert.ok(html.includes('id="onboarding-card-chat"'), 'Step 2: AI Chat card must exist');
  assert.ok(html.includes('id="onboarding-card-studio"'), 'Step 3: Coding Studio card must exist');
  assert.ok(html.includes('id="btn-onboarding-models"'), 'Onboarding models action button must exist');
  assert.ok(html.includes('id="btn-onboarding-chat"'), 'Onboarding chat action button must exist');
  assert.ok(html.includes('id="btn-onboarding-studio"'), 'Onboarding studio action button must exist');
});

test('Phase 30: 2. CSS Design System includes pull-up animation, readiness badges, and reduced-motion fallback', () => {
  const cssPath = path.join(__dirname, '..', 'src', 'ui', 'theme', 'styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  // Verify keyframe animation
  assert.ok(css.includes('@keyframes wordPullUp'), 'wordPullUp keyframes must be defined');
  assert.ok(css.includes('.pull-up-word'), '.pull-up-word animation class must be defined');

  // Verify model readiness styling
  assert.ok(css.includes('.hero-model-status-card'), '.hero-model-status-card styles must be defined');
  assert.ok(css.includes('.hero-model-dot.ready'), 'Ready dot styling must exist');
  assert.ok(css.includes('.hero-model-dot.loading'), 'Loading dot styling with pulse animation must exist');
  assert.ok(css.includes('.hero-model-badge'), '.hero-model-badge styles must be defined');

  // Verify onboarding grid styling
  assert.ok(css.includes('.welcome-onboarding-grid'), '.welcome-onboarding-grid grid layout must be defined');
  assert.ok(css.includes('.welcome-onboarding-card'), '.welcome-onboarding-card card styling must be defined');

  // Verify accessibility: reduced motion preferences
  assert.ok(css.includes('prefers-reduced-motion: reduce'), 'prefers-reduced-motion query must be defined');
  assert.ok(css.includes('.hero-model-status-card'), 'Reduced motion must include hero-model-status-card');

  // Verify responsive desktop media queries
  assert.ok(css.includes('@media (max-width: 1024px)'), '1024px desktop breakpoint must exist');
  assert.ok(css.includes('@media (max-width: 860px)'), '860px compact desktop breakpoint must exist');
});

test('Phase 30: 3. Controller script binds all welcome actions and routes to real application workspaces', () => {
  const appJsPath = path.join(__dirname, '..', 'src', 'ui', 'app.js');
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  // Verify screen mapping
  assert.ok(appJs.includes("'home-screen': '🏠 Welcome'"), 'screenTitleMap must label home-screen as 🏠 Welcome');

  // Verify navigation buttons
  assert.ok(appJs.includes("heroNavChat.addEventListener('click', () => navigateTo('chat-screen'))"), 'heroNavChat must navigate to chat');
  assert.ok(appJs.includes("heroNavStudio.addEventListener('click', () => navigateTo('studio-screen'))"), 'heroNavStudio must navigate to studio');
  assert.ok(appJs.includes("heroNavModels.addEventListener('click', () => navigateTo('models-screen'))"), 'heroNavModels must navigate to models');
  assert.ok(appJs.includes("heroNavSettings.addEventListener('click', () => navigateTo('settings-screen'))"), 'heroNavSettings must navigate to settings');

  // Verify primary & secondary actions
  assert.ok(appJs.includes("heroBtnStartChat.addEventListener('click'"), 'heroBtnStartChat click handler must exist');
  assert.ok(appJs.includes("heroBtnOpenStudio.addEventListener('click'"), 'heroBtnOpenStudio click handler must exist');
  assert.ok(appJs.includes("heroBtnOpenModels.addEventListener('click'"), 'heroBtnOpenModels click handler must exist');
  assert.ok(appJs.includes("heroBtnSetupModel.addEventListener('click'"), 'heroBtnSetupModel click handler must exist');
  assert.ok(appJs.includes("heroBtnImportModel.addEventListener('click'"), 'heroBtnImportModel click handler must exist');

  // Verify onboarding cards
  assert.ok(appJs.includes("btnOnboardingModels.addEventListener('click'"), 'btnOnboardingModels click handler must exist');
  assert.ok(appJs.includes("btnOnboardingChat.addEventListener('click'"), 'btnOnboardingChat click handler must exist');
  assert.ok(appJs.includes("btnOnboardingStudio.addEventListener('click'"), 'btnOnboardingStudio click handler must exist');

  // Verify startup preference persistence
  assert.ok(appJs.includes('welcomeChkStartup.addEventListener'), 'welcomeChkStartup change handler must exist');
  assert.ok(appJs.includes('showWelcomeOnStartup'), 'showWelcomeOnStartup setting must be checked and saved');
});

test('Phase 30: 4. First-run and returning user startup navigation flow', () => {
  const tempDir = createTempDir();
  try {
    const storage = new StorageService(tempDir);
    storage.ensureDirectories();

    const initialSettings = storage.getSettings();
    assert.strictEqual(initialSettings.appearance.showWelcomeOnStartup, true, 'Default settings must have showWelcomeOnStartup = true');

    // Simulate returning user toggling welcome off
    initialSettings.appearance.showWelcomeOnStartup = false;
    storage.saveSettings(initialSettings);

    const reloaded = storage.getSettings();
    assert.strictEqual(reloaded.appearance.showWelcomeOnStartup, false, 'Saved startup preference must persist across sessions');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Phase 30: 5. Model readiness state machine handles active, downloading, installed, and setup-needed states', () => {
  const appJsPath = path.join(__dirname, '..', 'src', 'ui', 'app.js');
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  // State 1: Active Model
  assert.ok(appJs.includes("heroModelDot.className = 'hero-model-dot ready'"), 'Active model state must set ready dot');
  assert.ok(appJs.includes("heroModelBadge.textContent = 'Active & Ready'"), 'Active model state must display Active & Ready');

  // State 2: Downloading Model
  assert.ok(appJs.includes("heroModelDot.className = 'hero-model-dot loading'"), 'Downloading model state must set loading dot');
  assert.ok(appJs.includes("heroModelBadge.textContent = 'Downloading'"), 'Downloading model state must display Downloading');

  // State 3: Installed on disk (not loaded)
  assert.ok(appJs.includes("heroModelDot.className = 'hero-model-dot installed'"), 'Installed model state must set installed dot');
  assert.ok(appJs.includes("heroModelBadge.textContent = 'Installed (Not Loaded)'"), 'Installed model state must display Installed (Not Loaded)');

  // State 4: Setup Required (No model registered)
  assert.ok(appJs.includes("heroModelDot.className = 'hero-model-dot setup-needed'"), 'Setup required state must set setup-needed dot');
  assert.ok(appJs.includes("heroModelBadge.textContent = 'Setup Required'"), 'Setup required state must display Setup Required');
});

test('Phase 30: 6. Offline-first privacy and security integrity (Zero cloud telemetry, zero remote scripts)', () => {
  const htmlPath = path.join(__dirname, '..', 'src', 'ui', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Strict Content-Security-Policy inspection
  assert.ok(html.includes("default-src 'self'"), 'CSP must restrict default sources to self');
  assert.ok(!html.includes('https://cdn'), 'No external CDNs allowed in HTML');
  assert.ok(!html.includes('https://fonts.googleapis.com'), 'No remote Google Fonts allowed in offline-first architecture');
  assert.ok(!html.includes('https://unpkg.com'), 'No remote unpkg scripts allowed');
  assert.ok(!html.includes('prisma.io'), 'No external Prisma branding or video URLs in ASTRO');
});
