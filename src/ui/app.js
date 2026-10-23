// ASTRO Desktop Application Controller - Phase 2
document.addEventListener('DOMContentLoaded', async () => {
  const api = window.astroApi;
  if (!api) {
    console.error('ASTRO API bridge is not available');
    return;
  }

  // --- State ---
  let currentScreen = 'home-screen';
  let activeModel = null;
  let currentWorkspaceDir = '';
  let currentSettings = null;
  let activeConversationId = null;
  let activeSelectedFile = null;
  let proposedDiff = null;

  // --- Core UI Elements ---
  const sidebar = document.getElementById('app-sidebar');
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const navItems = document.querySelectorAll('.nav-item');
  const screens = document.querySelectorAll('.screen');

  // Topbar & Bottombar Badges
  const topbarOfflineBadge = document.getElementById('topbar-offline-badge');
  const topbarOfflineText = document.getElementById('topbar-offline-text');
  const topbarModelBadge = document.getElementById('topbar-model-badge');
  const topbarModelText = document.getElementById('topbar-model-text');
  const topbarModelDot = document.getElementById('topbar-model-dot');
  const topbarHwText = document.getElementById('topbar-hw-text');
  const topbarScreenTitle = document.getElementById('topbar-screen-title');

  const bottomOfflineText = document.getElementById('bottom-offline-text');
  const bottomModelText = document.getElementById('bottom-model-text');
  const bottomModelDot = document.getElementById('bottom-model-dot');
  const bottomActivityText = document.getElementById('bottom-activity-text');
  const bottomActivityLink = document.getElementById('bottom-activity-link');

  // Dual-Workspace Switcher Buttons (Phase 28)
  const btnWsChat = document.getElementById('btn-ws-chat');
  const btnWsStudio = document.getElementById('btn-ws-studio');

  // Network Boundary & Privacy Modal (Phase 28)
  const modalNetworkStatus = document.getElementById('modal-network-status');
  const modalNetStatusPill = document.getElementById('modal-net-status-pill');
  const modalNetStatusDesc = document.getElementById('modal-net-status-desc');
  const btnModalOpenSettings = document.getElementById('btn-modal-open-settings');
  const btnModalNetClose = document.getElementById('btn-modal-net-close');

  // --- Toast Notification Utility ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-message ${type}`;
    const icon = type === 'success' ? '✓' : type === 'warning' ? '⚠️' : type === 'danger' ? '✕' : 'ℹ️';
    toast.innerHTML = `<span style="font-weight: 700; font-size: 11px;">${icon}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      setTimeout(() => toast.remove(), 260);
    }, 3000);
  }
  window.showToast = showToast;

  // --- Copy Code Block Utility ---
  window.copyCodeBlock = (btn) => {
    const wrapper = btn.closest('.code-block-wrapper');
    if (wrapper) {
      const codeEl = wrapper.querySelector('code');
      if (codeEl) {
        navigator.clipboard.writeText(codeEl.innerText || codeEl.textContent);
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied';
        btn.style.color = 'var(--accent-success)';
        showToast('Code copied to clipboard', 'success');
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.color = '';
        }, 2000);
      }
    }
  };

  // --- Navigation & Sidebar Logic ---
  const screenTitleMap = {
    'home-screen': '🏠 Welcome',
    'chat-screen': '💬 Chat',
    'files-screen': '📁 Files',
    'rag-screen': '📚 Knowledge & RAG',
    'research-screen': '🔍 Research',
    'studio-screen': '🛠️ Coding Studio',
    'models-screen': '⚡ Model Manager',
    'voice-screen': '🎙️ Voice',
    'activity-screen': '⏱️ Activity',
    'settings-screen': '⚙️ Settings'
  };

  function navigateTo(screenId) {
    navItems.forEach(n => {
      if (n.getAttribute('data-screen') === screenId) {
        n.classList.add('active');
      } else {
        n.classList.remove('active');
      }
    });

    screens.forEach(s => {
      if (s.id === screenId) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });

    // Update Topbar Dual-Workspace Switcher
    if (btnWsChat) btnWsChat.classList.toggle('active', screenId === 'chat-screen');
    if (btnWsStudio) btnWsStudio.classList.toggle('active', screenId === 'studio-screen');

    currentScreen = screenId;

    if (topbarScreenTitle && screenTitleMap[screenId]) {
      topbarScreenTitle.textContent = screenTitleMap[screenId];
    }

    // Screen specific refresh
    if (screenId === 'home-screen') refreshHomeView();
    if (screenId === 'chat-screen') refreshChatView();
    if (screenId === 'files-screen') refreshFilesView();
    if (screenId === 'rag-screen') refreshRAGView();
    if (screenId === 'studio-screen') refreshStudioView();
    if (screenId === 'models-screen') refreshModelsView();
    if (screenId === 'voice-screen') refreshVoiceView();
    if (screenId === 'activity-screen') refreshActivityView();
    if (screenId === 'settings-screen') refreshSettingsView();
  }
  window.navigateTo = navigateTo;

  // Dual-Workspace Switcher Click Bindings
  if (btnWsChat) {
    btnWsChat.addEventListener('click', () => navigateTo('chat-screen'));
  }
  if (btnWsStudio) {
    btnWsStudio.addEventListener('click', () => navigateTo('studio-screen'));
  }

  // Keyboard Shortcuts (Ctrl+1: Chat, Ctrl+2: Studio, Ctrl+N: New Chat)
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === '1') {
      e.preventDefault();
      navigateTo('chat-screen');
    } else if (e.ctrlKey && e.key === '2') {
      e.preventDefault();
      navigateTo('studio-screen');
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N') && currentScreen === 'chat-screen') {
      e.preventDefault();
      const newBtn = document.getElementById('btn-chat-new');
      if (newBtn) newBtn.click();
    }
  });

  // Network & Privacy Status Modal Controller (Phase 28)
  async function openNetworkStatusModal() {
    if (!modalNetworkStatus) return;
    modalNetworkStatus.style.display = 'flex';
    try {
      const net = await api.getNetworkStatus();
      if (modalNetStatusPill) {
        modalNetStatusPill.textContent = net.label;
        modalNetStatusPill.style.background = net.offlineMode
          ? 'var(--accent-warning-subtle)'
          : (net.isOnline ? 'var(--accent-success-subtle)' : 'rgba(239, 68, 68, 0.15)');
        modalNetStatusPill.style.color = net.offlineMode
          ? 'var(--accent-warning)'
          : (net.isOnline ? 'var(--accent-success)' : 'var(--accent-danger)');
      }
      if (modalNetStatusDesc) {
        modalNetStatusDesc.textContent = net.details;
      }
    } catch (err) {
      if (modalNetStatusDesc) modalNetStatusDesc.textContent = 'Could not inspect network state: ' + err.message;
    }
  }

  if (topbarOfflineBadge) {
    topbarOfflineBadge.addEventListener('click', openNetworkStatusModal);
  }
  if (btnModalNetClose) {
    btnModalNetClose.addEventListener('click', () => {
      if (modalNetworkStatus) modalNetworkStatus.style.display = 'none';
    });
  }
  if (btnModalOpenSettings) {
    btnModalOpenSettings.addEventListener('click', () => {
      if (modalNetworkStatus) modalNetworkStatus.style.display = 'none';
      navigateTo('settings-screen');
    });
  }

  async function refreshNetworkStatus() {
    try {
      const net = await api.getNetworkStatus();
      if (!net) return;
      const dot = document.getElementById('topbar-offline-dot');
      if (topbarOfflineText) {
        topbarOfflineText.textContent = net.label;
      }
      if (dot) {
        if (net.offlineMode) {
          dot.className = 'dot offline';
        } else if (net.activeDownloads > 0) {
          dot.className = 'dot active';
        } else if (net.isOnline) {
          dot.className = 'dot active';
        } else {
          dot.className = 'dot';
        }
      }
      if (topbarOfflineBadge) {
        topbarOfflineBadge.title = `${net.label}: ${net.details}`;
      }
      if (bottomOfflineText) {
        bottomOfflineText.textContent = `Privacy: ${net.offlineMode ? 'Offline-Only' : 'Permitted'} · ${net.isOnline ? 'Connected' : 'No Network'}`;
      }
    } catch (e) {
      console.warn('Network status error:', e);
    }
  }

  if (topbarModelBadge) {
    topbarModelBadge.addEventListener('click', openModelSwitcherModal);
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-screen');
      navigateTo(target);
    });
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateTo(item.getAttribute('data-screen'));
      }
    });
  });

  btnToggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // --- Theme Toggle ---
  btnThemeToggle.addEventListener('click', async () => {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (currentSettings) {
      if (!currentSettings.appearance) currentSettings.appearance = {};
      currentSettings.appearance.theme = newTheme;
      try {
        await api.saveSettings(currentSettings);
      } catch (e) {}
    }
  });

  function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    const select = document.getElementById('setting-theme-select');
    if (select) select.value = theme;
  }

  // --- Initialization & Status Updates (Resilient Phase 28) ---
  async function initApp() {
    try {
      currentSettings = await api.getSettings();
      if (currentSettings && currentSettings.appearance && currentSettings.appearance.theme) {
        setTheme(currentSettings.appearance.theme);
      }
    } catch (err) {
      console.warn('Settings load fallback:', err);
    }

    try {
      await refreshHardwareStatus();
    } catch (err) {
      console.warn('Hardware specs load fallback:', err);
    }

    try {
      await refreshNetworkStatus();
    } catch (err) {
      console.warn('Network status load fallback:', err);
    }

    try {
      await refreshActiveModel();
    } catch (err) {
      console.warn('Active model load fallback:', err);
    }

    try {
      await refreshActivityBadge();
    } catch (err) {
      console.warn('Activity badge load fallback:', err);
    }

    try {
      // Listen to real-time activity events
      api.onActivityChanged((tasks) => {
        updateActivityBadge(tasks);
        if (currentScreen === 'activity-screen') renderActivityTasks(tasks);
      });
    } catch (err) {
      console.warn('Activity listener fallback:', err);
    }

    try {
      // Listen to real-time download progress events (Core Workflow Repair)
      if (api.onDownloadProgress) {
        api.onDownloadProgress((p) => {
          updateDownloadCardUI(p);
          refreshNetworkStatus();
        });
      }
    } catch (err) {
      console.warn('Download progress listener fallback:', err);
    }

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
  }

  // --- Real-time Download UI Card Controller ---
  function updateDownloadCardUI(p) {
    if (!p) return;
    const targetId = p.modelId || (p.filename && p.filename.toLowerCase().includes('qwen3') ? 'qwen3-8b' : 'qwen2.5-coder-7b');
    const dlBox = document.getElementById(`dl-box-${targetId}`);
    const dlTitle = document.getElementById(`dl-title-${targetId}`);
    const dlFill = document.getElementById(`model-dl-fill-${targetId}`);
    const dlStats = document.getElementById(`model-dl-stats-${targetId}`);
    const dlBtn = document.getElementById(`btn-dl-${p.filename}`);

    if (dlBtn) {
      if (p.status === 'completed') {
        dlBtn.disabled = false;
        dlBtn.textContent = 'Installed';
      } else {
        dlBtn.disabled = true;
        dlBtn.textContent = `⏳ ${p.progressPercent || 0}%`;
      }
    }

    if (dlBox) {
      if (p.status === 'completed') {
        setTimeout(() => {
          if (dlBox) dlBox.style.display = 'none';
          if (currentScreen === 'models-screen') refreshModelsView();
        }, 1500);
      } else if (p.status === 'failed' || p.status === 'cancelled') {
        setTimeout(() => {
          if (dlBox) dlBox.style.display = 'none';
          if (currentScreen === 'models-screen') refreshModelsView();
        }, 2000);
      } else {
        dlBox.style.display = 'block';
      }
    }

    if (dlTitle) {
      if (p.status === 'connecting' || p.phase === 'connecting') {
        dlTitle.textContent = `Connecting to ${p.filename}...`;
      } else if (p.status === 'verifying' || p.phase === 'verifying') {
        dlTitle.textContent = `Verifying GGUF header & file integrity...`;
      } else if (p.status === 'completed' || p.phase === 'completed') {
        dlTitle.textContent = `Download complete! Ready to install.`;
      } else if (p.status === 'cancelled') {
        dlTitle.textContent = `Download cancelled: ${p.filename}`;
      } else if (p.status === 'failed') {
        dlTitle.textContent = `Download failed: ${p.error || p.filename}`;
      } else {
        dlTitle.textContent = `Downloading ${p.filename}`;
      }
    }

    if (dlFill) {
      if (p.isIndeterminate) {
        dlFill.classList.add('indeterminate-bar');
        dlFill.style.width = '100%';
      } else {
        dlFill.classList.remove('indeterminate-bar');
        dlFill.style.width = `${Math.min(100, Math.max(0, p.progressPercent || 0))}%`;
      }
    }

    if (dlStats) {
      const spd = ((p.speedBytesPerSec || 0) / (1024 ** 2)).toFixed(1);
      const downloadedMB = ((p.bytesDownloaded || 0) / (1024 ** 2)).toFixed(1);
      if (p.isIndeterminate) {
        dlStats.textContent = `${downloadedMB} MB downloaded · ${spd} MB/s (Determining total size...)`;
      } else if (p.totalBytes > 0) {
        const totalMB = (p.totalBytes / (1024 ** 2)).toFixed(1);
        const eta = p.etaSeconds ? ` · ETA ${p.etaSeconds}s` : '';
        dlStats.textContent = `${p.progressPercent || 0}% (${downloadedMB} / ${totalMB} MB) · ${spd} MB/s${eta}`;
      } else {
        dlStats.textContent = `${downloadedMB} MB · ${spd} MB/s`;
      }
    }
  }

  async function refreshHardwareStatus() {
    const specs = await api.getHardwareSpecs();
    if (specs) {
      const cpuShort = specs.cpu.isRyzen ? 'AMD Ryzen 5' : specs.cpu.model.split(' ')[0];
      topbarHwText.textContent = `${cpuShort} · ${specs.memory.freeGB}GB Free`;
    }
  }

  async function refreshActiveModel() {
    activeModel = await api.getActiveModel();
    const chatActivePill = document.getElementById('chat-active-model-pill');
    const homeNoModelBanner = document.getElementById('home-no-model-banner');
    const chatWarningBanner = document.getElementById('chat-model-warning-banner');
    const studioAiPill = document.getElementById('studio-ai-model-pill');

    if (activeModel) {
      if (homeNoModelBanner) homeNoModelBanner.style.display = 'none';
      if (chatWarningBanner) chatWarningBanner.style.display = 'none';
      topbarModelDot.className = 'dot active';
      topbarModelText.textContent = `${activeModel.modelId} (Active)`;
      bottomModelDot.className = 'dot active';
      bottomModelText.textContent = `Model: ${activeModel.modelId}`;
      if (chatActivePill) {
        chatActivePill.textContent = `🤖 ${activeModel.modelId}`;
        chatActivePill.style.color = 'var(--accent-success)';
      }
      if (studioAiPill) {
        studioAiPill.textContent = activeModel.modelId;
        studioAiPill.style.background = 'var(--accent-success-subtle)';
        studioAiPill.style.color = 'var(--accent-success)';
      }
    } else {
      if (homeNoModelBanner) homeNoModelBanner.style.display = 'flex';
      if (chatWarningBanner) chatWarningBanner.style.display = 'flex';
      topbarModelDot.className = 'dot';
      topbarModelText.textContent = 'No Model Loaded';
      bottomModelDot.className = 'dot';
      bottomModelText.textContent = 'No Model Loaded';
      if (chatActivePill) {
        chatActivePill.textContent = `🤖 Click to Load Model`;
        chatActivePill.style.color = 'var(--accent-warning)';
      }
      if (studioAiPill) {
        studioAiPill.textContent = 'No Local Model';
        studioAiPill.style.background = 'var(--accent-warning-subtle)';
        studioAiPill.style.color = 'var(--accent-warning)';
      }
    }
  }

  const btnChatQuickLoad = document.getElementById('btn-chat-quick-load');
  if (btnChatQuickLoad) {
    btnChatQuickLoad.addEventListener('click', openModelSwitcherModal);
  }


  async function refreshActivityBadge() {
    const tasks = await api.getActivityTasks();
    updateActivityBadge(tasks);
  }

  function updateActivityBadge(tasks) {
    const active = tasks.filter(t => t.status === 'running');
    bottomActivityText.textContent = `${active.length} active task${active.length === 1 ? '' : 's'}`;
  }

  bottomActivityLink.addEventListener('click', () => {
    navigateTo('activity-screen');
  });

  // ================= 01: HOME SCREEN =================
  const homePromptInput = document.getElementById('home-prompt-input');
  const homePromptSend = document.getElementById('home-prompt-send');
  const homeMicBtn = document.getElementById('home-mic-btn');
  const homeRagToggle = document.getElementById('home-rag-toggle');
  const homeModelContent = document.getElementById('home-model-card-content');
  const homeSystemContent = document.getElementById('home-system-card-content');
  const homeRecentConv = document.getElementById('home-recent-conversations');
  const homeRecentColl = document.getElementById('home-recent-collections');

  homePromptSend.addEventListener('click', () => {
    const text = homePromptInput.value.trim();
    if (!text) return;
    homePromptInput.value = '';
    navigateTo('chat-screen');
    const chatInput = document.getElementById('chat-input-text');
    chatInput.value = text;
    const chatRagCheck = document.getElementById('chat-rag-checkbox');
    if (chatRagCheck) chatRagCheck.checked = homeRagToggle.checked;
    const chatModeSelect = document.getElementById('chat-mode-select');
    if (chatModeSelect) chatModeSelect.value = homeRagToggle.checked ? 'local-files' : 'general-assistant';
    document.getElementById('btn-chat-send').click();
  });

  if (homePromptInput) {
    homePromptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        homePromptSend.click();
      }
    });
  }

  homeMicBtn.addEventListener('click', () => {
    navigateTo('voice-screen');
  });

  // --- ASTRO Animated Hero Action & Navigation Bindings (Phase 30) ---
  const heroNavChat = document.getElementById('hero-nav-chat');
  if (heroNavChat) heroNavChat.addEventListener('click', () => navigateTo('chat-screen'));

  const heroNavStudio = document.getElementById('hero-nav-studio');
  if (heroNavStudio) heroNavStudio.addEventListener('click', () => navigateTo('studio-screen'));

  const heroNavModels = document.getElementById('hero-nav-models');
  if (heroNavModels) heroNavModels.addEventListener('click', () => navigateTo('models-screen'));

  const heroNavSettings = document.getElementById('hero-nav-settings');
  if (heroNavSettings) heroNavSettings.addEventListener('click', () => navigateTo('settings-screen'));

  const heroBtnStartChat = document.getElementById('hero-btn-start-chat');
  if (heroBtnStartChat) {
    heroBtnStartChat.addEventListener('click', async () => {
      localStorage.setItem('astro_has_onboarded', 'true');
      navigateTo('chat-screen');
      try {
        const btnNew = document.getElementById('btn-chat-new');
        if (btnNew) btnNew.click();
      } catch (e) {}
      const chatInput = document.getElementById('chat-input-text');
      if (chatInput) setTimeout(() => chatInput.focus(), 80);
    });
  }

  const heroBtnOpenStudio = document.getElementById('hero-btn-open-studio');
  if (heroBtnOpenStudio) {
    heroBtnOpenStudio.addEventListener('click', () => {
      localStorage.setItem('astro_has_onboarded', 'true');
      navigateTo('studio-screen');
    });
  }

  const heroBtnOpenModels = document.getElementById('hero-btn-open-models');
  if (heroBtnOpenModels) {
    heroBtnOpenModels.addEventListener('click', () => navigateTo('models-screen'));
  }

  const heroBtnSetupModel = document.getElementById('hero-btn-setup-model');
  if (heroBtnSetupModel) {
    heroBtnSetupModel.addEventListener('click', () => {
      if (activeModel) {
        openModelSwitcherModal();
      } else {
        navigateTo('models-screen');
      }
    });
  }

  const heroBtnImportModel = document.getElementById('hero-btn-import-model');
  if (heroBtnImportModel) {
    heroBtnImportModel.addEventListener('click', () => window.triggerImportModelPicker());
  }

  // Startup preference checkbox on welcome screen
  const welcomeChkStartup = document.getElementById('welcome-chk-startup');
  if (welcomeChkStartup) {
    welcomeChkStartup.addEventListener('change', async () => {
      if (!currentSettings) currentSettings = await api.getSettings();
      if (!currentSettings.appearance) currentSettings.appearance = {};
      currentSettings.appearance.showWelcomeOnStartup = welcomeChkStartup.checked;
      await api.saveSettings(currentSettings);
      const settingWelcomeStartup = document.getElementById('setting-welcome-startup');
      if (settingWelcomeStartup) settingWelcomeStartup.checked = welcomeChkStartup.checked;
    });
  }

  // 3-Step Onboarding Guidance Cards
  const btnOnboardingModels = document.getElementById('btn-onboarding-models');
  if (btnOnboardingModels) {
    btnOnboardingModels.addEventListener('click', () => navigateTo('models-screen'));
  }

  const btnOnboardingChat = document.getElementById('btn-onboarding-chat');
  if (btnOnboardingChat) {
    btnOnboardingChat.addEventListener('click', () => {
      localStorage.setItem('astro_has_onboarded', 'true');
      navigateTo('chat-screen');
      const chatInput = document.getElementById('chat-input-text');
      if (chatInput) setTimeout(() => chatInput.focus(), 80);
    });
  }

  const btnOnboardingStudio = document.getElementById('btn-onboarding-studio');
  if (btnOnboardingStudio) {
    btnOnboardingStudio.addEventListener('click', () => {
      localStorage.setItem('astro_has_onboarded', 'true');
      navigateTo('studio-screen');
    });
  }

  document.getElementById('qa-find-files').addEventListener('click', () => navigateTo('files-screen'));
  document.getElementById('qa-ask-rag').addEventListener('click', () => navigateTo('rag-screen'));
  document.getElementById('qa-start-coding').addEventListener('click', () => navigateTo('studio-screen'));
  document.getElementById('qa-research').addEventListener('click', () => navigateTo('research-screen'));
  const btnHomeManageModels = document.getElementById('home-btn-manage-models');
  if (btnHomeManageModels) {
    btnHomeManageModels.addEventListener('click', () => navigateTo('models-screen'));
  }

  const homeBtnImportGguf = document.getElementById('home-btn-import-gguf');
  if (homeBtnImportGguf) {
    homeBtnImportGguf.addEventListener('click', () => window.triggerImportModelPicker());
  }

  const homeBtnSwitchModel = document.getElementById('home-btn-switch-model');
  if (homeBtnSwitchModel) {
    homeBtnSwitchModel.addEventListener('click', openModelSwitcherModal);
  }

  async function refreshHomeView() {
    await refreshActiveModel();

    // Elements for Hero Model Readiness
    const heroModelDot = document.getElementById('hero-model-dot');
    const heroModelBadge = document.getElementById('hero-model-badge');
    const heroModelStatusTitle = document.getElementById('hero-model-status-title');
    const heroModelStatusDesc = document.getElementById('hero-model-status-desc');
    const heroBtnSetup = document.getElementById('hero-btn-setup-model');
    const onboardingModelDot = document.getElementById('onboarding-model-dot');
    const onboardingModelText = document.getElementById('onboarding-model-text');
    const welcomeChk = document.getElementById('welcome-chk-startup');

    // Sync startup preference checkbox
    if (welcomeChk && currentSettings && currentSettings.appearance) {
      welcomeChk.checked = currentSettings.appearance.showWelcomeOnStartup !== false;
    }

    let catalog = null;
    let queue = [];
    try {
      catalog = await api.getCatalog();
    } catch (e) {}
    try {
      queue = await api.getDownloadQueue();
    } catch (e) {}

    const activeDownloads = (queue || []).filter(q => q.status === 'downloading' || q.status === 'connecting' || q.status === 'verifying');
    const installedModels = (catalog && catalog.models) ? catalog.models.filter(m => m.installed || m.localPath) : [];

    if (activeModel) {
      // State 1: Active Model in Memory
      if (heroModelDot) heroModelDot.className = 'hero-model-dot ready';
      if (heroModelBadge) {
        heroModelBadge.className = 'hero-model-badge ready';
        heroModelBadge.textContent = 'Active & Ready';
      }
      if (heroModelStatusTitle) {
        heroModelStatusTitle.textContent = `Model Ready: ${activeModel.displayName || activeModel.modelId}`;
      }
      if (heroModelStatusDesc) {
        heroModelStatusDesc.innerHTML = `Loaded in memory (${activeModel.loadTimeMs || 0}ms). 4096-token context window ready for offline chat and code assistance.`;
      }
      if (heroBtnSetup) {
        heroBtnSetup.textContent = '🔄 Switch Active Model';
        heroBtnSetup.onclick = openModelSwitcherModal;
      }
      if (onboardingModelDot) onboardingModelDot.className = 'dot active';
      if (onboardingModelText) onboardingModelText.textContent = `Active: ${activeModel.modelId}`;

      if (homeModelContent) {
        homeModelContent.innerHTML = `
          <strong>${escapeHtml(activeModel.modelId)}</strong> is loaded in memory.<br>
          Load time: ${activeModel.loadTimeMs || 0}ms · Context: 4096 tokens.
        `;
      }
    } else if (activeDownloads.length > 0) {
      // State 2: Model Downloading / Verifying
      const activeDl = activeDownloads[0];
      if (heroModelDot) heroModelDot.className = 'hero-model-dot loading';
      if (heroModelBadge) {
        heroModelBadge.className = 'hero-model-badge loading';
        heroModelBadge.textContent = 'Downloading';
      }
      if (heroModelStatusTitle) {
        heroModelStatusTitle.textContent = `Downloading ${activeDl.filename}...`;
      }
      if (heroModelStatusDesc) {
        const dlMB = ((activeDl.bytesDownloaded || 0) / (1024 ** 2)).toFixed(1);
        const totMB = activeDl.totalBytes ? ` of ${(activeDl.totalBytes / (1024 ** 2)).toFixed(1)} MB` : '';
        heroModelStatusDesc.textContent = `Download in progress (${dlMB}${totMB}). You can explore other areas while download finishes.`;
      }
      if (heroBtnSetup) {
        heroBtnSetup.textContent = '⏱️ View in Activity';
        heroBtnSetup.onclick = () => navigateTo('activity-screen');
      }
      if (onboardingModelDot) onboardingModelDot.className = 'dot active';
      if (onboardingModelText) onboardingModelText.textContent = `Downloading (${activeDl.filename})`;

      if (homeModelContent) {
        homeModelContent.innerHTML = `
          <em>Downloading ${escapeHtml(activeDl.filename)}...</em><br>
          View real-time progress in Activity or Model Manager.
        `;
      }
    } else if (installedModels.length > 0) {
      // State 3: Model Installed on Disk but Not Loaded in Memory
      const firstInstalled = installedModels[0];
      if (heroModelDot) heroModelDot.className = 'hero-model-dot installed';
      if (heroModelBadge) {
        heroModelBadge.className = 'hero-model-badge installed';
        heroModelBadge.textContent = 'Installed (Not Loaded)';
      }
      if (heroModelStatusTitle) {
        heroModelStatusTitle.textContent = `Model Available: ${firstInstalled.displayName || firstInstalled.id}`;
      }
      if (heroModelStatusDesc) {
        heroModelStatusDesc.textContent = `A compatible GGUF model is registered on disk. Click "Start Chatting" to load on demand, or manage models in Model Manager.`;
      }
      if (heroBtnSetup) {
        heroBtnSetup.textContent = '⚡ Load or Switch Model';
        heroBtnSetup.onclick = openModelSwitcherModal;
      }
      if (onboardingModelDot) onboardingModelDot.className = 'dot active';
      if (onboardingModelText) onboardingModelText.textContent = `Installed: ${firstInstalled.id}`;

      if (homeModelContent) {
        homeModelContent.innerHTML = `
          <em>Model registered: ${escapeHtml(firstInstalled.id)}.</em><br>
          Ready to load on demand or via Model Switcher.
        `;
      }
    } else {
      // State 4: No Model Registered (First Run)
      if (heroModelDot) heroModelDot.className = 'hero-model-dot setup-needed';
      if (heroModelBadge) {
        heroModelBadge.className = 'hero-model-badge warning';
        heroModelBadge.textContent = 'Setup Required';
      }
      if (heroModelStatusTitle) {
        heroModelStatusTitle.textContent = 'No Local Model Registered';
      }
      if (heroModelStatusDesc) {
        heroModelStatusDesc.textContent = 'ASTRO operates 100% offline. Import an existing .gguf file from your disk or download Qwen2.5-Coder in Model Manager.';
      }
      if (heroBtnSetup) {
        heroBtnSetup.textContent = '⚡ Set up a Model';
        heroBtnSetup.onclick = () => navigateTo('models-screen');
      }
      if (onboardingModelDot) onboardingModelDot.className = 'dot warning';
      if (onboardingModelText) onboardingModelText.textContent = 'Setup Required';

      if (homeModelContent) {
        homeModelContent.innerHTML = `
          <em>No model registered yet.</em><br>
          Open Model Manager to download Qwen2.5-Coder or import local GGUF.
        `;
      }
    }

    const specs = await api.getHardwareSpecs();
    if (specs) {
      homeSystemContent.innerHTML = `
        <strong>${specs.cpu.model}</strong> (${specs.cpu.logicalCores} threads, AVX2 ready)<br>
        RAM: ${specs.memory.freeGB} GB Free of ${specs.memory.totalGB} GB | Disk: ${specs.storage.freeDiskGB} GB Free
      `;
    }

    const convs = await api.getConversations();
    if (convs.length > 0) {
      homeRecentConv.innerHTML = convs.slice(0, 3).map(c => `
        <div style="padding: 3px 0; cursor: pointer; color: var(--text-primary);" onclick="openConversationFromHome('${c.id}')">
          💬 ${escapeHtml(c.title)} <span style="font-size: 11px; color: var(--text-muted);">(${c.messageCount} msgs)</span>
        </div>
      `).join('');
    } else {
      homeRecentConv.innerHTML = 'No recent conversations.';
    }

    const collections = await api.listRAGCollections();
    if (collections.length > 0) {
      homeRecentColl.innerHTML = collections.map(col => `
        <div style="padding: 3px 0;">
          📚 <strong>${escapeHtml(col.name)}</strong>: ${col.totalDocuments} docs (${col.totalChunks} chunks)
        </div>
      `).join('');
    }
  }

  window.openConversationFromHome = async (id) => {
    navigateTo('chat-screen');
    await loadConversationIntoChat(id);
  };

  // ================= 02: CHAT SCREEN =================
  const chatConvList = document.getElementById('chat-conv-list');
  const chatMessagesScroll = document.getElementById('chat-messages-scroll');
  const chatInputText = document.getElementById('chat-input-text');
  const btnChatSend = document.getElementById('btn-chat-send');
  const btnChatStop = document.getElementById('btn-chat-stop');
  const btnChatMic = document.getElementById('btn-chat-mic');
  const chatVoiceBadge = document.getElementById('chat-voice-badge');
  const btnChatStopSpeaking = document.getElementById('btn-chat-stop-speaking');
  const chatTranscriptBar = document.getElementById('chat-transcript-bar');
  const chatTranscriptInput = document.getElementById('chat-transcript-input');
  const btnTranscriptAccept = document.getElementById('btn-transcript-accept');
  const btnTranscriptCancel = document.getElementById('btn-transcript-cancel');
  const btnChatNew = document.getElementById('btn-chat-new');
  const btnChatRename = document.getElementById('btn-chat-rename');
  const btnChatDelete = document.getElementById('btn-chat-delete');
  const chatActiveTitle = document.getElementById('chat-active-conv-title');
  const chatMetricsBar = document.getElementById('chat-metrics-bar');
  const chatModeSelect = document.getElementById('chat-mode-select');
  const chatSourcesChip = document.getElementById('chat-sources-chip');

  let selectedSourcesList = [];
  let liveAssistantBubble = null;

  // Action card renderer (Desktop actions & Model management actions)
  function renderActionCard(actionData) {
    if (!actionData) return document.createElement('div');

    if (actionData.type === 'model_management') {
      const card = document.createElement('div');
      card.className = 'chat-model-action-card';

      if (actionData.subtype === 'confirm_switch') {
        card.innerHTML = `
          <div class="model-action-header">🔄 Model Switch Requested</div>
          <div class="model-action-body">
            Switch active inference engine to <strong>${escapeHtml(actionData.displayName)}</strong>?<br>
            Current active model will be safely unloaded from memory.
          </div>
          <div class="model-action-buttons">
            <button class="btn btn-sm btn-primary" onclick="window.confirmModelSwitch('${escapeHtml(actionData.modelId)}', '${escapeHtml((actionData.filePath || '').replace(/\\/g, '\\\\'))}')">Confirm Switch</button>
            <button class="btn btn-sm" onclick="this.closest('.chat-model-action-card').remove()">Cancel</button>
          </div>
        `;
      } else if (actionData.subtype === 'import_local') {
        card.innerHTML = `
          <div class="model-action-header">📥 Import Model</div>
          <div class="model-action-body">
            Select a local GGUF model file from your computer or drag and drop it into this chat area.
          </div>
          <div class="model-action-buttons">
            <button class="btn btn-sm btn-primary" onclick="window.triggerImportModelPicker()">Select Model File (.gguf)...</button>
          </div>
        `;
      } else if (actionData.subtype === 'list_models') {
        const models = actionData.models || [];
        card.innerHTML = `
          <div class="model-action-header">🤖 Registered Models</div>
          <div class="model-action-body" style="display: flex; flex-direction: column; gap: 6px;">
            ${models.map(m => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; background: var(--bg-panel); border-radius: 4px;">
                <span><strong>${escapeHtml(m.displayName)}</strong> (${m.quantization || 'Q4_K_M'}${m.sizeGB ? ', ' + m.sizeGB + ' GB' : ''})</span>
                ${m.isLoaded ? '<span class="status-badge" style="background: var(--accent-success); color: #fff; font-size: 10px;">Active</span>' : `<button class="btn btn-sm btn-primary" style="font-size: 10px; padding: 2px 6px;" onclick="window.confirmModelSwitch('${escapeHtml(m.modelId)}', '${escapeHtml((m.filePath || '').replace(/\\/g, '\\\\'))}')">Switch</button>`}
              </div>
            `).join('')}
          </div>
        `;
      } else if (actionData.subtype === 'offline_notice') {
        card.innerHTML = `
          <div class="model-action-header">🔒 Offline-First Privacy Active</div>
          <div class="model-action-body">
            Outbound model search is blocked by default in privacy settings. You can import a local model file directly.
          </div>
          <div class="model-action-buttons">
            <button class="btn btn-sm btn-primary" onclick="window.triggerImportModelPicker()">📥 Import Local File</button>
            <button class="btn btn-sm" onclick="navigateTo('settings-screen')">⚙️ Settings</button>
          </div>
        `;
      } else if (actionData.subtype === 'model_not_found') {
        card.innerHTML = `
          <div class="model-action-header">❓ Model Not Found Locally</div>
          <div class="model-action-body">
            Model matching <strong>"${escapeHtml(actionData.targetName || '')}"</strong> is not registered.
          </div>
          <div class="model-action-buttons">
            <button class="btn btn-sm btn-primary" onclick="window.triggerImportModelPicker()">📥 Import GGUF File</button>
            <button class="btn btn-sm" onclick="navigateTo('models-screen')">Open Model Manager</button>
          </div>
        `;
      } else {
        card.innerHTML = `
          <div class="model-action-header">🤖 Model Action</div>
          <div class="model-action-buttons">
            <button class="btn btn-sm btn-primary" onclick="window.triggerImportModelPicker()">Import Local GGUF</button>
            <button class="btn btn-sm" onclick="navigateTo('models-screen')">Model Manager</button>
          </div>
        `;
      }

      return card;
    }

    const card = document.createElement('div');
    card.className = 'action-card';
    card.innerHTML = `
      <div class="action-header">
        <span class="action-title">⚡ ${escapeHtml(actionData.actionName || actionData.actionId)}</span>
        <span class="risk-badge ${actionData.risk}">${escapeHtml(actionData.risk || 'low')}</span>
      </div>
      <div class="action-intent">${escapeHtml(actionData.intent || '')}</div>
      ${actionData.params && Object.keys(actionData.params).length > 0 ? `
        <div class="action-params-preview">${escapeHtml(JSON.stringify(actionData.params, null, 2))}</div>
      ` : ''}
      ${actionData.status === 'pending_confirmation' ? `
        <div class="action-buttons" id="action-btn-row-${actionData.requestId}">
          <button class="btn btn-sm btn-primary" onclick="window.confirmDesktopAction('${actionData.requestId}')">✓ Confirm Action</button>
          <button class="btn btn-sm" onclick="window.cancelDesktopAction('${actionData.requestId}')">✕ Cancel</button>
        </div>
      ` : `
        <div style="font-size: 11px; color: var(--accent-success); margin-top: 4px;">
          ✓ Executed successfully
        </div>
      `}
    `;
    return card;
  }


  function renderMarkdown(text) {
    if (!text) return '';
    let escaped = escapeHtml(text);

    // Fenced code blocks with language badge and Copy Code button
    escaped = escaped.replace(/```(\w+)?\r?\n([\s\S]*?)```/g, (match, lang, code) => {
      const langLabel = lang ? lang.trim() : 'code';
      return `<div class="code-block-wrapper"><div class="code-block-header"><span>${langLabel}</span><button class="code-copy-btn" onclick="window.copyCodeBlock(this)">Copy Code</button></div><pre><code>${code.trim()}</code></pre></div>`;
    });

    // Inline code
    escaped = escaped.replace(/`([^`\n]+)`/g, '<code style="background: var(--bg-input); padding: 1px 5px; border-radius: 4px; font-family: var(--font-mono); font-size: 11.5px; border: 1px solid var(--border-subtle);">$1</code>');

    // Bold text
    escaped = escaped.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

    return escaped;
  }

  // Safe message formatting: parses <think> blocks into collapsible sections and escapes all raw text
  function formatMessageContent(rawText) {
    if (!rawText || typeof rawText !== 'string' || rawText.trim() === '') {
      return '<span style="color: var(--text-muted); font-style: italic;">[Empty response received from local model]</span>';
    }

    if (rawText.includes('<think>')) {
      let outputHtml = '';
      let cursor = 0;
      const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/g;
      let match;
      while ((match = thinkRegex.exec(rawText)) !== null) {
        const textBefore = rawText.slice(cursor, match.index);
        if (textBefore) {
          outputHtml += `<div style="white-space: pre-wrap;">${renderMarkdown(textBefore)}</div>`;
        }
        const thinkBody = match[1] ? match[1].trim() : '';
        if (thinkBody) {
          outputHtml += `<details class="think-block" style="margin-bottom: 8px; padding: 6px 10px; background: rgba(99, 102, 241, 0.08); border-left: 3px solid var(--accent-primary); border-radius: 4px; font-size: 11.5px; color: var(--text-secondary);"><summary style="cursor: pointer; font-weight: 600; color: var(--accent-primary); outline: none;">🧠 Qwen3 Reasoning Process</summary><div style="margin-top: 6px; white-space: pre-wrap; font-family: var(--font-sans);">${escapeHtml(thinkBody)}</div></details>`;
        }
        cursor = match.index + match[0].length;
      }
      const textAfter = rawText.slice(cursor);
      if (textAfter) {
        outputHtml += `<div style="white-space: pre-wrap;">${renderMarkdown(textAfter)}</div>`;
      }
      return outputHtml || escapeHtml(rawText);
    }

    return `<div style="white-space: pre-wrap;">${renderMarkdown(rawText)}</div>`;
  }
  window.formatMessageContent = formatMessageContent;

  window.confirmDesktopAction = async (requestId) => {
    try {
      const res = await api.confirmAction(requestId);
      const btnRow = document.getElementById(`action-btn-row-${requestId}`);
      if (btnRow) {
        btnRow.innerHTML = `<span style="font-size: 11px; color: var(--accent-success);">✓ Approved & Executed</span>`;
      }
      refreshActivityView();
    } catch (err) {
      alert('Action Execution Error: ' + err.message);
    }
  };

  window.cancelDesktopAction = async (requestId) => {
    try {
      await api.cancelAction(requestId, 'User cancelled');
      const btnRow = document.getElementById(`action-btn-row-${requestId}`);
      if (btnRow) {
        btnRow.innerHTML = `<span style="font-size: 11px; color: var(--text-muted);">✕ Cancelled</span>`;
      }
      refreshActivityView();
    } catch (err) {}
  };

  // Speech synthesis playback
  function speakResponseAloud(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    const rateSlider = document.getElementById('voice-rate-slider');
    const voiceSelect = document.getElementById('voice-select-engine');
    const rate = rateSlider ? parseFloat(rateSlider.value) : 1.0;
    utter.rate = isNaN(rate) ? 1.0 : rate;

    if (voiceSelect && voiceSelect.value !== 'default') {
      const voices = window.speechSynthesis.getVoices();
      const chosen = voices.find(v => v.name === voiceSelect.value);
      if (chosen) utter.voice = chosen;
    }

    utter.onstart = () => {
      if (btnChatStopSpeaking) btnChatStopSpeaking.style.display = 'inline-flex';
      if (chatVoiceBadge) {
        chatVoiceBadge.textContent = 'Speaking';
        chatVoiceBadge.style.display = 'inline-block';
      }
    };

    utter.onend = () => {
      if (btnChatStopSpeaking) btnChatStopSpeaking.style.display = 'none';
      if (chatVoiceBadge) {
        chatVoiceBadge.textContent = 'Mic Idle';
        chatVoiceBadge.style.display = 'none';
      }
    };

    utter.onerror = () => {
      if (btnChatStopSpeaking) btnChatStopSpeaking.style.display = 'none';
      if (chatVoiceBadge) chatVoiceBadge.style.display = 'none';
    };

    window.speechSynthesis.speak(utter);
  }

  function stopSpeakingAloud() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    api.stopSpeaking();
    if (btnChatStopSpeaking) btnChatStopSpeaking.style.display = 'none';
    if (chatVoiceBadge) {
      chatVoiceBadge.textContent = 'Interrupted';
      setTimeout(() => { if (chatVoiceBadge.textContent === 'Interrupted') chatVoiceBadge.style.display = 'none'; }, 2000);
    }
  }

  if (btnChatStopSpeaking) {
    btnChatStopSpeaking.addEventListener('click', stopSpeakingAloud);
  }

  if (chatModeSelect) {
    chatModeSelect.addEventListener('change', () => {
      const mode = chatModeSelect.value;
      if (mode === 'selected-sources') {
        if (selectedSourcesList.length === 0 && activeSelectedFile) {
          selectedSourcesList = [activeSelectedFile];
        }
        chatSourcesChip.style.display = 'inline-block';
        chatSourcesChip.textContent = `${selectedSourcesList.length} source(s) selected`;
      } else {
        chatSourcesChip.style.display = 'none';
      }
    });
  }

  api.onTokenChunk((data) => {
    if (liveAssistantBubble && data.token) {
      liveAssistantBubble.textContent += data.token;
      chatMessagesScroll.scrollTop = chatMessagesScroll.scrollHeight;
    }
    if (data.tokensPerSecond) {
      chatMetricsBar.textContent = `${data.tokensPerSecond} tokens/sec`;
    }
  });

  async function sendChatMessage(textOverride = null, isVoice = false) {
    const text = (typeof textOverride === 'string' ? textOverride : (chatInputText ? chatInputText.value : '')).trim();
    if (!text) return;

    const isModelCommand = /^(?:please\s+)?(?:show|list|import|add|switch|change|use|activate|find|search|download|i want to use|installed\s+models|my\s+models)/i.test(text);

    if (!activeModel && !isModelCommand) {
      // Append user message bubble first
      const userRow = document.createElement('div');
      userRow.className = 'msg-row user';
      userRow.innerHTML = `<div class="msg-bubble">${isVoice ? '🎙️ ' : ''}${escapeHtml(text)}</div>`;
      chatMessagesScroll.appendChild(userRow);
      if (textOverride === null) {
        chatInputText.value = '';
      }

      // Append assistant guidance bubble with actionable chips
      const asstRow = document.createElement('div');
      asstRow.className = 'msg-row assistant';
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      bubble.innerHTML = `<strong>⚠️ No Local Model Loaded</strong><br><br>ASTRO operates 100% offline and requires a local model in memory to generate responses.<br><br>
        To get started:
        <ul style="margin: 6px 0 10px 18px; padding: 0;">
          <li>Load a model in <strong>Model Manager</strong></li>
          <li>Or import an existing <code>.gguf</code> model from your drive</li>
        </ul>
        <div class="prompt-suggestion-chips" style="margin-top: 8px;">
          <span class="prompt-chip" data-prompt="List models">⚡ List Models</span>
          <span class="prompt-chip" data-prompt="Import a local model">📥 Import Local GGUF</span>
        </div>
        <div style="margin-top: 10px;">
          <button class="btn btn-sm btn-primary" onclick="window.openModelSwitcherModal()">⚡ Choose &amp; Load Model</button>
        </div>`;
      asstRow.appendChild(bubble);
      chatMessagesScroll.appendChild(asstRow);
      chatMessagesScroll.scrollTop = chatMessagesScroll.scrollHeight;
      return;
    }

    const currentMode = chatModeSelect ? chatModeSelect.value : 'local-files';

    // Append user message bubble
    const userRow = document.createElement('div');
    userRow.className = 'msg-row user';
    userRow.innerHTML = `<div class="msg-bubble">${isVoice ? '🎙️ ' : ''}${escapeHtml(text)}</div>`;
    chatMessagesScroll.appendChild(userRow);
    if (textOverride === null) {
      chatInputText.value = '';
    }
    chatMessagesScroll.scrollTop = chatMessagesScroll.scrollHeight;

    // Append assistant container
    const asstRow = document.createElement('div');
    asstRow.className = 'msg-row assistant';
    liveAssistantBubble = document.createElement('div');
    liveAssistantBubble.className = 'msg-bubble';
    liveAssistantBubble.textContent = '';
    asstRow.appendChild(liveAssistantBubble);
    chatMessagesScroll.appendChild(asstRow);

    btnChatSend.disabled = true;
    btnChatStop.style.display = 'inline-flex';
    chatMetricsBar.textContent = 'Generating locally...';

    try {
      const response = await api.sendMessage({
        message: text,
        mode: currentMode,
        selectedSources: selectedSourcesList,
        useRAG: currentMode !== 'general-assistant',
        isVoice: Boolean(isVoice)
      });

      // Show model attribution tag if provided
      if (response.modelId && response.modelId !== 'system') {
        const badge = document.createElement('div');
        badge.className = 'model-attribution-tag';
        badge.textContent = `🤖 ${response.modelId}`;
        asstRow.insertBefore(badge, liveAssistantBubble);
      }

      // Populate response text and format Qwen3 <think> reasoning blocks safely
      const responseText = response.text || (liveAssistantBubble ? liveAssistantBubble.textContent : '');
      liveAssistantBubble.innerHTML = formatMessageContent(responseText);

      // Render desktop action if action was requested or triggered
      if (response.action) {
        asstRow.appendChild(renderActionCard(response.action));
      }


      // Add copy button
      const actionRow = document.createElement('div');
      actionRow.style.cssText = 'display: flex; gap: 8px; margin-top: 4px;';
      const btnCopy = document.createElement('button');
      btnCopy.className = 'btn btn-sm';
      btnCopy.textContent = '📋 Copy';
      btnCopy.onclick = () => {
        navigator.clipboard.writeText(response.text);
        btnCopy.textContent = '✓ Copied';
        setTimeout(() => btnCopy.textContent = '📋 Copy', 1500);
      };
      actionRow.appendChild(btnCopy);
      asstRow.appendChild(actionRow);

      if (response.citations && response.citations.length > 0) {
        const citWrap = document.createElement('div');
        citWrap.className = 'msg-citations-wrap';
        citWrap.innerHTML = `<div style="font-weight: 600; margin-bottom: 6px;">📚 Verified Sources (${response.citations.length}):</div>` +
          response.citations.map(c => `
            <div class="citation-item" style="border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px; margin-bottom: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <strong>📄 ${escapeHtml(c.docName)}</strong>
                <button class="btn btn-sm" style="font-size: 10px; padding: 2px 6px;" onclick="window.astroApi.openPathInOS('${escapeHtml(c.docPath.replace(/\\/g, '\\\\'))}')">Open in OS ↗</button>
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">
                Section: <strong>${escapeHtml(c.heading || 'Document')}</strong> · Match: <span class="status-badge" style="font-size: 10px; padding: 1px 4px;">${c.matchType || 'hybrid'}</span> · Score: ${c.score}
              </div>
              <blockquote style="margin: 0; padding-left: 8px; border-left: 2px solid var(--accent-primary); font-size: 11.5px; color: var(--text-secondary); white-space: pre-wrap;">${escapeHtml(c.snippet)}</blockquote>
            </div>
          `).join('');
        asstRow.appendChild(citWrap);
      } else if (!response.hasEvidence && currentMode !== 'general-assistant' && response.mode !== 'desktop-action') {
        const noEvNotice = document.createElement('div');
        noEvNotice.className = 'msg-citations-wrap';
        noEvNotice.style.cssText = 'color: var(--text-muted); font-size: 11.5px; font-style: italic;';
        noEvNotice.textContent = 'ℹ️ No matching passages found in the indexed documents. The response is grounded in general offline model knowledge.';
        asstRow.appendChild(noEvNotice);
      }

      // Check spoken response preference and trigger speech aloud
      const vStatus = await api.getVoiceStatus();
      if ((vStatus.ttsEnabled || isVoice) && response.spokenText) {
        speakResponseAloud(response.spokenText);
      }

      chatMetricsBar.textContent = `${response.stats.tokensPerSecond || 0} tok/s (${response.stats.tokenCount || 0} tokens in ${((response.stats.elapsedMs || 0) / 1000).toFixed(1)}s)`;
    } catch (err) {
      liveAssistantBubble.innerHTML += `<br><span style="color: var(--accent-danger);">[Error: ${escapeHtml(err.message)}]</span>`;
    } finally {
      btnChatSend.disabled = false;
      btnChatStop.style.display = 'none';
      liveAssistantBubble = null;
      refreshConversationsList();
    }
  }

  // Speech Recognition & Microphone Controller
  let isListeningNow = false;
  let speechRecInstance = null;

  if (window.SpeechRecognition || window.webkitSpeechRecognition) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    speechRecInstance = new SR();
    speechRecInstance.continuous = false;
    speechRecInstance.interimResults = true;

    speechRecInstance.onstart = () => {
      isListeningNow = true;
      if (btnChatMic) btnChatMic.classList.add('btn-danger');
      if (chatVoiceBadge) {
        chatVoiceBadge.textContent = 'Listening...';
        chatVoiceBadge.style.display = 'inline-block';
      }
      if (chatTranscriptBar) {
        chatTranscriptBar.style.display = 'flex';
        chatTranscriptInput.value = '';
      }
    };

    speechRecInstance.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        interim += event.results[i][0].transcript;
      }
      if (chatTranscriptInput) {
        chatTranscriptInput.value = interim;
      }
    };

    speechRecInstance.onend = () => {
      isListeningNow = false;
      if (btnChatMic) btnChatMic.classList.remove('btn-danger');
      if (chatVoiceBadge) chatVoiceBadge.textContent = 'Mic Idle';
    };

    speechRecInstance.onerror = (e) => {
      isListeningNow = false;
      if (btnChatMic) btnChatMic.classList.remove('btn-danger');
      if (chatVoiceBadge) chatVoiceBadge.textContent = 'Error';
    };
  }

  if (btnChatMic) {
    btnChatMic.addEventListener('click', async () => {
      stopSpeakingAloud();
      const status = await api.getVoiceStatus();

      if (speechRecInstance) {
        if (isListeningNow) {
          speechRecInstance.stop();
        } else {
          try {
            speechRecInstance.start();
          } catch (err) {
            speechRecInstance.stop();
          }
        }
      } else if (status.sttAvailable) {
        if (status.isListening) {
          const res = await api.stopListening();
          if (res.transcription && chatTranscriptInput) {
            chatTranscriptBar.style.display = 'flex';
            chatTranscriptInput.value = res.transcription;
          }
        } else {
          await api.startListening();
          btnChatMic.classList.add('btn-danger');
        }
      } else {
        alert('Voice Assistant: Local Whisper speech recognition engine is not yet installed.\n\nPer Rule 2 (offline-first & private), ASTRO does not send audio to cloud servers. You can type prompts directly or test microphone input in the Voice tab.');
      }
    });
  }

  if (btnTranscriptAccept) {
    btnTranscriptAccept.addEventListener('click', () => {
      const transcript = chatTranscriptInput.value.trim();
      if (transcript) {
        chatTranscriptBar.style.display = 'none';
        sendChatMessage(transcript, true);
      }
    });
  }

  if (btnTranscriptCancel) {
    btnTranscriptCancel.addEventListener('click', () => {
      if (chatTranscriptBar) chatTranscriptBar.style.display = 'none';
      if (chatTranscriptInput) chatTranscriptInput.value = '';
      api.cancelListening();
    });
  }

  btnChatSend.addEventListener('click', () => sendChatMessage());
  chatInputText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  btnChatStop.addEventListener('click', async () => {
    await api.stopGeneration();
    btnChatStop.style.display = 'none';
    chatMetricsBar.textContent = 'Generation stopped by user.';
  });

  btnChatNew.addEventListener('click', async () => {
    activeConversationId = await api.startNewConversation();
    chatActiveTitle.textContent = 'New Conversation';
    chatMessagesScroll.innerHTML = `
      <div class="msg-row assistant">
        <div class="msg-bubble">
          <strong>New conversation started.</strong><br>
          Ask a question, query local documents, or manage models.
          <div class="prompt-suggestion-chips">
            <span class="prompt-chip" data-prompt="What models are currently registered?">⚡ Check Models</span>
            <span class="prompt-chip" data-prompt="Explain neural network quantization (Q4_K_M vs Q8_0)">🧠 Explain Quantization</span>
            <span class="prompt-chip" data-prompt="Search local documents for project architecture">📚 Search Knowledge</span>
          </div>
        </div>
      </div>
    `;
    refreshConversationsList();
  });

  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.prompt-chip');
    if (chip) {
      const promptText = chip.getAttribute('data-prompt');
      if (promptText && chatInputText) {
        chatInputText.value = promptText;
        chatInputText.focus();
      }
    }
  });

  btnChatRename.addEventListener('click', async () => {
    if (!activeConversationId) return;
    const newName = prompt('Enter new conversation title:', chatActiveTitle.textContent);
    if (newName && newName.trim()) {
      await api.renameConversation(activeConversationId, newName.trim());
      chatActiveTitle.textContent = newName.trim();
      refreshConversationsList();
    }
  });

  btnChatDelete.addEventListener('click', async () => {
    if (!activeConversationId) return;
    if (confirm('Delete this conversation permanently?')) {
      await api.deleteConversation(activeConversationId);
      btnChatNew.click();
    }
  });

  // ================= BYOM & Model Management Controller (Phase 13) =================
  let pendingInspectPath = null;
  let pendingInspectData = null;

  async function openModelInspectModal(filePath) {
    window.openModelInspectModal = openModelInspectModal;
    const modal = document.getElementById('modal-model-inspect');
    const loading = document.getElementById('inspect-loading');
    const details = document.getElementById('inspect-details');
    const btnConfirm = document.getElementById('btn-inspect-confirm');
    const memWarning = document.getElementById('inspect-memory-warning');
    const dupWarning = document.getElementById('inspect-duplicate-warning');

    if (!modal) return;
    pendingInspectPath = filePath;
    modal.style.display = 'flex';
    loading.style.display = 'block';
    details.style.display = 'none';
    btnConfirm.disabled = true;
    memWarning.style.display = 'none';
    dupWarning.style.display = 'none';

    try {
      const data = await api.inspectModelFile(filePath);
      pendingInspectData = data;
      loading.style.display = 'none';
      details.style.display = 'block';

      if (!data.valid) {
        alert(`Model file validation failed:\n${data.error}`);
        modal.style.display = 'none';
        return;
      }

      document.getElementById('inspect-filename').textContent = data.filename;
      document.getElementById('inspect-format').textContent = `${data.format} v${data.version}`;
      document.getElementById('inspect-architecture').textContent = data.architecture || 'Unknown';
      document.getElementById('inspect-quant').textContent = data.quantization || 'Q4_K_M';
      document.getElementById('inspect-size').textContent = `${data.fileSizeGB} GB (${data.tensorCount} tensors)`;
      document.getElementById('inspect-ram').textContent = `~${data.estimatedRamGB} GB (Free: ${data.systemRam.freeGB} GB)`;
      document.getElementById('inspect-display-name').value = data.modelName;

      if (data.compatibility && data.compatibility.memoryWarning) {
        memWarning.style.display = 'block';
        memWarning.textContent = `⚠️ Memory Note: ${data.compatibility.memoryWarning}`;
      }

      if (data.alreadyRegistered) {
        dupWarning.style.display = 'block';
        dupWarning.textContent = `ℹ️ This file is already registered as "${data.existingEntry.displayName}". Confirming will update its registration settings.`;
      }

      btnConfirm.disabled = false;
    } catch (err) {
      alert(`Error reading model file: ${err.message}`);
      modal.style.display = 'none';
    }
  }

  const btnInspectConfirm = document.getElementById('btn-inspect-confirm');
  const btnInspectCancel = document.getElementById('btn-inspect-cancel');

  if (btnInspectConfirm) {
    btnInspectConfirm.addEventListener('click', async () => {
      if (!pendingInspectPath || !pendingInspectData) return;
      btnInspectConfirm.disabled = true;
      btnInspectConfirm.textContent = 'Registering...';

      const copyToManaged = document.getElementById('inspect-mode-copy').checked;
      const displayName = document.getElementById('inspect-display-name').value.trim() || undefined;

      try {
        const registered = await api.importLocalModel({
          sourcePath: pendingInspectPath,
          displayName,
          copyToManagedDir: copyToManaged,
          allowExternal: true
        });

        document.getElementById('modal-model-inspect').style.display = 'none';
        alert(`Model "${registered.displayName || displayName}" registered successfully in ASTRO!\n\nStorage: ${registered.storageType === 'external' ? 'External file' : 'Managed storage'}`);

        if (confirm(`Do you want to switch to "${registered.displayName || displayName}" and load it into RAM now?`)) {
          await window.confirmModelSwitch(registered.modelId, registered.filePath);
        }
        refreshModelsView();
        refreshActiveModel();
      } catch (e) {
        alert(`Failed to register model: ${e.message}`);
      } finally {
        btnInspectConfirm.disabled = false;
        btnInspectConfirm.textContent = 'Confirm & Register';
      }
    });
  }

  if (btnInspectCancel) {
    btnInspectCancel.addEventListener('click', () => {
      document.getElementById('modal-model-inspect').style.display = 'none';
    });
  }

  async function openModelSwitcherModal() {
    window.openModelSwitcherModal = openModelSwitcherModal;
    const modal = document.getElementById('modal-model-switcher');
    const list = document.getElementById('modal-models-list');
    if (!modal || !list) return;

    modal.style.display = 'flex';
    list.innerHTML = '<div style="font-size: 11.5px; color: var(--text-muted); padding: 8px;">Loading registered models...</div>';

    const registry = await api.getModelRegistry();
    const active = await api.getActiveModel();

    if (!registry || registry.length === 0) {
      list.innerHTML = '<div style="font-size: 11.5px; color: var(--text-muted); padding: 8px;">No models registered yet. Click "Import Local GGUF" to add a model.</div>';
      return;
    }

    list.innerHTML = registry.map(entry => {
      const isLoaded = active && active.modelId === entry.modelId;
      const sizeGB = entry.actualSizeBytes ? (entry.actualSizeBytes / (1024 ** 3)).toFixed(2) : '?';
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: var(--bg-panel); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div>
            <div style="font-weight: 600; font-size: 12.5px; color: var(--text-primary);">${escapeHtml(entry.displayName || entry.modelId)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">
              ${escapeHtml(entry.quantization || 'Q4_K_M')} · ${sizeGB} GB · ${entry.storageType === 'external' ? 'External' : 'Managed'}
            </div>
            <div style="font-size: 10px; font-family: var(--font-mono); color: var(--text-muted); word-break: break-all;">
              ${escapeHtml(entry.filePath)}
            </div>
          </div>
          <div>
            ${isLoaded ? `
              <span class="status-badge" style="background: var(--accent-success); color: #fff; font-size: 10px;">● In Memory</span>
            ` : `
              <button class="btn btn-sm btn-primary" onclick="window.confirmModelSwitch('${escapeHtml(entry.modelId)}', '${escapeHtml(entry.filePath.replace(/\\/g, '\\\\'))}')">Switch</button>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  const btnSwitcherClose = document.getElementById('btn-switcher-close');
  if (btnSwitcherClose) {
    btnSwitcherClose.addEventListener('click', () => {
      document.getElementById('modal-model-switcher').style.display = 'none';
    });
  }

  const btnModalImportTrigger = document.getElementById('btn-modal-import-trigger');
  if (btnModalImportTrigger) {
    btnModalImportTrigger.addEventListener('click', () => {
      document.getElementById('modal-model-switcher').style.display = 'none';
      window.triggerImportModelPicker();
    });
  }

  const btnModalOpenMgr = document.getElementById('btn-modal-open-mgr');
  if (btnModalOpenMgr) {
    btnModalOpenMgr.addEventListener('click', () => {
      document.getElementById('modal-model-switcher').style.display = 'none';
      navigateTo('models-screen');
    });
  }

  const btnChatModelAction = document.getElementById('btn-chat-model-action');
  if (btnChatModelAction) {
    btnChatModelAction.addEventListener('click', openModelSwitcherModal);
  }

  const chatActiveModelPill = document.getElementById('chat-active-model-pill');
  if (chatActiveModelPill) {
    chatActiveModelPill.addEventListener('click', openModelSwitcherModal);
  }

  window.triggerImportModelPicker = async () => {
    const picked = await api.pickFile([
      { name: 'GGUF Models (*.gguf)', extensions: ['gguf'] },
      { name: 'All Files', extensions: ['*'] }
    ]);
    if (picked) {
      openModelInspectModal(picked);
    }
  };

  window.confirmModelSwitch = async (modelId, filePath) => {
    try {
      const modal = document.getElementById('modal-model-switcher');
      if (modal) modal.style.display = 'none';

      const options = {};
      if (api.checkModelPreflight && filePath) {
        try {
          const preflight = await api.checkModelPreflight({ modelId, filePath });
          if (preflight && preflight.severity === 'critical_insufficient') {
            const altText = (preflight.safeAlternatives || []).map(a => `  • ${a.label}`).join('\n');
            const confirmed = confirm(
              `[CRITICAL MEMORY RISK]\n\n` +
              `${preflight.message}\n\n` +
              `Recommended Action: ${preflight.recommendedAction}\n\n` +
              (altText ? `Safe Alternatives:\n${altText}\n\n` : '') +
              `Do you want to override this safeguard and attempt to load anyway?`
            );
            if (!confirmed) {
              await refreshActiveModel();
              return;
            }
            options.overrideMemorySafety = true;
          } else if (preflight && preflight.severity === 'warning_paging') {
            const confirmed = confirm(
              `[MEMORY PAGING WARNING]\n\n` +
              `${preflight.message}\n\n` +
              `Recommended Action: ${preflight.recommendedAction}\n\n` +
              `Do you want to proceed?`
            );
            if (!confirmed) {
              await refreshActiveModel();
              return;
            }
          }
        } catch (err) {
          console.warn('Preflight check error:', err);
        }
      }

      const pill = document.getElementById('chat-active-model-pill');
      if (pill) {
        pill.textContent = `⏳ Switching to ${modelId}...`;
        pill.style.color = 'var(--accent-warning)';
      }
      if (topbarModelText) topbarModelText.textContent = `⏳ Switching to ${modelId}...`;
      if (topbarModelDot) topbarModelDot.className = 'dot';
      showToast(`Unloading current model and loading ${modelId} into RAM...`, 'info');

      const result = await api.switchActiveModel(modelId, filePath, options);
      await refreshActiveModel();
      refreshModelsView();
      showToast(`Successfully switched active model to "${result.displayName || modelId}"! Ready in AI Chat.`, 'success');
    } catch (e) {
      showToast(`Failed to switch model: ${e.message}`, 'danger');
      await refreshActiveModel();
    }
  };

  window.triggerRepairModelPath = async (modelId) => {
    const picked = await api.pickFile([
      { name: 'GGUF Models (*.gguf)', extensions: ['gguf'] },
      { name: 'All Files', extensions: ['*'] }
    ]);
    if (picked) {
      try {
        await api.repairModelPath(modelId, picked);
        alert(`Model path updated successfully to:\n${picked}`);
        refreshModelsView();
      } catch (e) {
        alert(`Failed to repair path: ${e.message}`);
      }
    }
  };

  window.triggerUnregisterModel = async (modelId) => {
    const ok = confirm(`Remove "${modelId}" from ASTRO's model library?\n\nNote: The underlying model file will NOT be deleted from your disk.`);
    if (ok) {
      try {
        await api.unregisterModel(modelId);
        alert(`Model "${modelId}" unregistered from ASTRO library.`);
        refreshModelsView();
        refreshActiveModel();
      } catch (e) {
        alert(`Failed to unregister model: ${e.message}`);
      }
    }
  };

  // Drag and drop handler for .gguf model files onto Chat
  const chatScreenEl = document.getElementById('chat-screen');
  const chatDropZoneEl = document.getElementById('chat-drop-zone');

  if (chatScreenEl && chatDropZoneEl) {
    let dragCount = 0;

    chatScreenEl.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCount++;
      chatDropZoneEl.style.display = 'flex';
    });

    chatScreenEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    chatScreenEl.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCount--;
      if (dragCount <= 0) {
        dragCount = 0;
        chatDropZoneEl.style.display = 'none';
      }
    });

    chatScreenEl.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCount = 0;
      chatDropZoneEl.style.display = 'none';

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const filePath = file.path;
        if (!filePath) return;

        if (filePath.toLowerCase().endsWith('.gguf') || filePath.toLowerCase().endsWith('.bin')) {
          openModelInspectModal(filePath);
        } else {
          if (confirm(`"${file.name}" is a document file, not a GGUF model.\n\nWould you like to index it into your local knowledge library?`)) {
            await api.addLibraryFile(filePath);
            await api.indexDocument(filePath);
            alert(`Document "${file.name}" indexed into local knowledge library!`);
          }
        }
      }
    });
  }


  const chatConvSearch = document.getElementById('chat-conv-search');
  if (chatConvSearch) {
    chatConvSearch.addEventListener('input', () => {
      refreshConversationsList();
    });
  }

  async function refreshConversationsList() {
    const list = await api.getConversations();
    const query = chatConvSearch ? chatConvSearch.value.trim().toLowerCase() : '';
    const filtered = query
      ? list.filter(c => (c.title && c.title.toLowerCase().includes(query)) || (c.lastSnippet && c.lastSnippet.toLowerCase().includes(query)))
      : list;

    chatConvList.innerHTML = '';
    if (filtered.length === 0) {
      if (query) {
        chatConvList.innerHTML = `
          <div class="chat-conv-empty-state">
            <p style="margin: 0;">No chats match "<strong>${escapeHtml(query)}</strong>"</p>
            <button class="btn btn-sm btn-ghost" id="btn-clear-chat-search" style="font-size: 11px;">Clear search</button>
          </div>
        `;
        const btnClear = document.getElementById('btn-clear-chat-search');
        if (btnClear && chatConvSearch) {
          btnClear.addEventListener('click', () => {
            chatConvSearch.value = '';
            refreshConversationsList();
          });
        }
      } else {
        chatConvList.innerHTML = `
          <div class="chat-conv-empty-state">
            <span style="font-size: 20px;">💬</span>
            <p style="margin: 0;">No conversations yet.</p>
            <button class="btn btn-sm btn-primary" id="btn-chat-empty-new" style="margin-top: 4px; font-size: 11px;">+ Start New Chat</button>
          </div>
        `;
        const btnEmptyNew = document.getElementById('btn-chat-empty-new');
        if (btnEmptyNew && btnChatNew) {
          btnEmptyNew.addEventListener('click', () => btnChatNew.click());
        }
      }
      return;
    }

    filtered.forEach(c => {
      const item = document.createElement('div');
      item.className = `conv-item ${c.id === activeConversationId ? 'active' : ''}`;
      item.innerHTML = `
        <span class="conv-item-icon">💬</span>
        <span class="conv-item-title" title="${escapeHtml(c.title)}">${escapeHtml(c.title)}</span>
        <span class="conv-item-badge">${c.messageCount || 0}</span>
        <div class="conv-item-actions">
          <button class="conv-action-btn" title="Rename" onclick="event.stopPropagation(); window.triggerRenameConversation('${c.id}', '${escapeHtml(c.title)}')">✏️</button>
          <button class="conv-action-btn delete" title="Delete" onclick="event.stopPropagation(); window.triggerDeleteConversation('${c.id}')">🗑️</button>
        </div>
      `;
      item.onclick = () => loadConversationIntoChat(c.id);
      chatConvList.appendChild(item);
    });
  }

  window.triggerRenameConversation = async (convId, currentTitle) => {
    const newName = prompt('Enter new conversation title:', currentTitle);
    if (newName && newName.trim()) {
      await api.renameConversation(convId, newName.trim());
      if (convId === activeConversationId && chatActiveTitle) {
        chatActiveTitle.textContent = newName.trim();
      }
      refreshConversationsList();
    }
  };

  window.triggerDeleteConversation = async (convId) => {
    if (confirm('Delete this conversation permanently?')) {
      await api.deleteConversation(convId);
      if (convId === activeConversationId) {
        btnChatNew.click();
      } else {
        refreshConversationsList();
      }
    }
  };

  async function loadConversationIntoChat(convId) {
    activeConversationId = convId;
    const data = await api.loadConversation(convId);
    if (!data) return;

    chatActiveTitle.textContent = data.title;
    chatMessagesScroll.innerHTML = '';

    (data.messages || []).forEach(m => {
      const row = document.createElement('div');
      row.className = `msg-row ${m.role}`;
      if (m.role === 'assistant') {
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.innerHTML = formatMessageContent(m.content);
        row.appendChild(bubble);
      } else {
        row.innerHTML = `<div class="msg-bubble">${m.isVoice ? '🎙️ ' : ''}${escapeHtml(m.content)}</div>`;
      }
      if (m.action) {
        row.appendChild(renderActionCard(m.action));
      }
      if (m.citations && m.citations.length > 0) {
        const cit = document.createElement('div');
        cit.className = 'msg-citations-wrap';
        cit.innerHTML = `<strong>📚 Sources:</strong>` +
          m.citations.map(c => `<div class="citation-item"><strong>${escapeHtml(c.docName)}</strong>: "${escapeHtml(c.snippet)}"</div>`).join('');
        row.appendChild(cit);
      }
      chatMessagesScroll.appendChild(row);
    });

    chatMessagesScroll.scrollTop = chatMessagesScroll.scrollHeight;
    refreshConversationsList();
  }

  function refreshChatView() {
    refreshConversationsList();
    refreshActiveModel();
  }

  // ================= 03: FILES SCREEN =================
  const filesCurrentDir = document.getElementById('files-current-dir');
  const filesCategoryFilter = document.getElementById('files-category-filter');
  const filesSearchQuery = document.getElementById('files-search-query');
  const btnFilesSearch = document.getElementById('btn-files-search');
  const filesResultsList = document.getElementById('files-results-list');
  const fileDetailsContent = document.getElementById('file-details-content');
  const btnFilesOpenOS = document.getElementById('btn-files-open-os');
  const btnFilesIndexRAG = document.getElementById('btn-files-index-rag');
  const btnFilesRemoveLibrary = document.getElementById('btn-files-remove-library');
  const btnFilesPickFolder = document.getElementById('btn-files-pick-folder');
  const btnFilesAddFile = document.getElementById('btn-files-add-file');
  const btnFilesIndexAll = document.getElementById('btn-files-index-all');
  const filesLibraryRoots = document.getElementById('files-library-roots');

  if (btnFilesPickFolder) {
    btnFilesPickFolder.addEventListener('click', async () => {
      const picked = await api.pickFolder();
      if (picked) {
        await api.addLibraryFolder(picked);
        currentWorkspaceDir = picked;
        refreshFilesView();
      }
    });
  }

  if (btnFilesAddFile) {
    btnFilesAddFile.addEventListener('click', async () => {
      const picked = await api.pickFile();
      if (picked) {
        await api.addLibraryFile(picked);
        refreshFilesView();
      }
    });
  }

  if (btnFilesIndexAll) {
    btnFilesIndexAll.addEventListener('click', async () => {
      const card = document.getElementById('rag-indexing-progress-card');
      if (card) card.style.display = 'block';
      try {
        const summary = await api.indexLibrary();
        alert(`Indexing complete: ${summary.indexed} indexed, ${summary.skipped} skipped, ${summary.failed} failed.`);
      } catch (e) {
        alert(`Indexing error: ${e.message}`);
      } finally {
        refreshFilesView();
        refreshRAGView();
      }
    });
  }

  btnFilesSearch.addEventListener('click', async () => {
    const q = filesSearchQuery.value.trim();
    const cat = filesCategoryFilter.value;
    if (!q) {
      refreshFilesView();
      return;
    }
    const results = await api.searchFiles(currentWorkspaceDir, q, cat);
    renderFileList(results);
  });

  filesCategoryFilter.addEventListener('change', () => {
    refreshFilesView();
  });

  async function refreshFilesView() {
    filesCurrentDir.textContent = `Scope: ${currentWorkspaceDir}`;
    
    // Refresh library roots
    if (filesLibraryRoots) {
      const roots = await api.getLibraryRoots();
      filesLibraryRoots.innerHTML = '';
      if (!roots || roots.length === 0) {
        filesLibraryRoots.innerHTML = '<span style="color: var(--text-muted);">No library folders added. Click "+ Add Folder" to index.</span>';
      } else {
        roots.forEach(r => {
          const row = document.createElement('div');
          row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 2px 0;';
          row.innerHTML = `
            <span style="font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 170px;" title="${escapeHtml(r)}">📁 ${escapeHtml(r)}</span>
            <button class="btn btn-sm btn-danger" style="font-size: 9px; padding: 1px 4px;" onclick="removeLibraryRoot('${escapeHtml(r.replace(/\\/g, '\\\\'))}')">✕</button>
          `;
          filesLibraryRoots.appendChild(row);
        });
      }
    }

    const cat = filesCategoryFilter.value;
    const files = await api.listFiles(currentWorkspaceDir, cat);
    renderFileList(files);
  }

  window.removeLibraryRoot = async (rootPath) => {
    if (confirm(`Remove root "${rootPath}" from ASTRO file library? (Original files will NOT be deleted)`)) {
      await api.removeLibraryRoot(rootPath);
      refreshFilesView();
      refreshRAGView();
    }
  };

  function renderFileList(items) {
    filesResultsList.innerHTML = '';
    if (items.length === 0) {
      filesResultsList.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); padding: 8px;">No matching files found.</div>';
      return;
    }

    items.slice(0, 50).forEach(f => {
      const row = document.createElement('div');
      row.className = 'file-item-row';
      const icon = f.type === 'directory' ? '📁' : (f.category === 'code' ? '⚙️' : '📄');
      row.innerHTML = `
        <span>${icon} ${escapeHtml(f.name)}</span>
        <span style="font-size: 11px; color: var(--text-muted);">${f.sizeBytes ? (f.sizeBytes / 1024).toFixed(1) + ' KB' : ''}</span>
      `;
      row.onclick = () => inspectFileDetails(f.path);
      filesResultsList.appendChild(row);
    });
  }

  async function inspectFileDetails(filePath) {
    activeSelectedFile = filePath;
    try {
      const details = await api.getFileDetails(filePath);
      fileDetailsContent.innerHTML = `
        <strong>${escapeHtml(details.name)}</strong><br>
        <span style="font-size: 11px; color: var(--text-muted); word-break: break-all;">${escapeHtml(details.path)}</span>
        <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 8px 0;">
        Category: <strong>${details.category}</strong><br>
        Size: <strong>${details.sizeFormatted}</strong><br>
        Line Count: <strong>${details.lineCount || 'N/A'}</strong><br>
        Last Modified: <strong>${new Date(details.mtime).toLocaleString()}</strong><br>
        Supported for RAG: <strong>${details.supported ? 'Yes' : 'No'}</strong>
      `;
      btnFilesOpenOS.style.display = 'inline-flex';
      btnFilesIndexRAG.style.display = details.supported ? 'inline-flex' : 'none';
      if (btnFilesRemoveLibrary) btnFilesRemoveLibrary.style.display = 'inline-flex';
    } catch (e) {
      fileDetailsContent.textContent = `Error inspecting file: ${e.message}`;
    }
  }

  btnFilesOpenOS.addEventListener('click', async () => {
    if (activeSelectedFile) {
      await api.openPathInOS(activeSelectedFile);
    }
  });

  btnFilesIndexRAG.addEventListener('click', async () => {
    if (activeSelectedFile) {
      try {
        const res = await api.indexDocument(activeSelectedFile);
        alert(`Indexed ${res.filePath} (${res.chunkCount} chunks generated).`);
        refreshRAGView();
      } catch (e) {
        alert(`Indexing error: ${e.message}`);
      }
    }
  });

  if (btnFilesRemoveLibrary) {
    btnFilesRemoveLibrary.addEventListener('click', async () => {
      if (activeSelectedFile) {
        await api.removeDocumentFromRAG(activeSelectedFile);
        alert(`Removed ${activeSelectedFile} from RAG index.`);
        refreshFilesView();
        refreshRAGView();
      }
    });
  }

  // ================= 04: KNOWLEDGE & RAG SCREEN =================
  const ragCollectionsList = document.getElementById('rag-collections-list');
  const ragActiveCollName = document.getElementById('rag-active-coll-name');
  const ragActiveCollMeta = document.getElementById('rag-active-coll-meta');
  const ragDocsTableBody = document.querySelector('#rag-docs-table tbody');
  const btnRagCreateColl = document.getElementById('btn-rag-create-coll');
  const btnRagDeleteColl = document.getElementById('btn-rag-delete-coll');
  const btnRagRebuild = document.getElementById('btn-rag-rebuild');
  const btnRagCancelIndex = document.getElementById('btn-rag-cancel-index');
  const ragQueryInput = document.getElementById('rag-query-input');
  const btnRagRunQuery = document.getElementById('btn-rag-run-query');
  const ragQueryCitations = document.getElementById('rag-query-citations');
  const ragEmbeddingStatusLabel = document.getElementById('rag-embedding-status-label');
  const ragStorageSizeLabel = document.getElementById('rag-storage-size-label');

  // Listen to indexing progress events
  api.onIndexingProgress((p) => {
    const card = document.getElementById('rag-indexing-progress-card');
    const bar = document.getElementById('rag-progress-bar');
    const detail = document.getElementById('rag-progress-detail');
    if (card && bar && detail) {
      card.style.display = 'block';
      const pct = p.total > 0 ? Math.round((p.processed / p.total) * 100) : 0;
      bar.style.width = `${pct}%`;
      detail.textContent = `${p.processed} of ${p.total} files (${pct}%) · ${p.filename} [${p.status}]`;
      if (p.processed >= p.total) {
        setTimeout(() => { card.style.display = 'none'; }, 2000);
        refreshRAGView();
      }
    }
  });

  if (btnRagCancelIndex) {
    btnRagCancelIndex.addEventListener('click', async () => {
      await api.stopIndexing();
      const card = document.getElementById('rag-indexing-progress-card');
      if (card) card.style.display = 'none';
    });
  }

  btnRagCreateColl.addEventListener('click', async () => {
    const name = prompt('Enter new collection name:');
    if (name && name.trim()) {
      await api.createRAGCollection(name.trim());
      refreshRAGView();
    }
  });

  btnRagDeleteColl.addEventListener('click', async () => {
    const stats = await api.getRAGStats();
    if (stats.activeCollection === 'default') {
      alert('The default collection cannot be deleted.');
      return;
    }
    if (confirm(`Delete collection "${stats.activeCollection}"? Original files will not be deleted.`)) {
      await api.deleteRAGCollection(stats.activeCollection);
      refreshRAGView();
    }
  });

  btnRagRebuild.addEventListener('click', async () => {
    if (confirm('Rebuilding will clear the index and re-extract all files in your approved library. Proceed?')) {
      const card = document.getElementById('rag-indexing-progress-card');
      if (card) card.style.display = 'block';
      try {
        const summary = await api.rebuildIndex();
        alert(`Index rebuild completed: ${summary.indexed} indexed, ${summary.failed} failed.`);
      } catch (e) {
        alert(`Rebuild error: ${e.message}`);
      } finally {
        refreshRAGView();
      }
    }
  });

  btnRagRunQuery.addEventListener('click', async () => {
    const q = ragQueryInput.value.trim();
    if (!q) return;
    const res = await api.queryRAG(q);
    ragQueryCitations.innerHTML = '';
    if (!res || !res.citations || res.citations.length === 0) {
      ragQueryCitations.innerHTML = '<div style="font-size: 11.5px; color: var(--text-muted);">No matching passages found in this collection.</div>';
    } else {
      res.citations.forEach(c => {
        const item = document.createElement('div');
        item.className = 'citation-item';
        item.style.cssText = 'border: 1px solid var(--border-subtle); border-radius: 4px; padding: 6px; margin-bottom: 4px;';
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong>📄 ${escapeHtml(c.docName)}</strong>
            <button class="btn btn-sm" style="font-size: 9px; padding: 1px 4px;" onclick="window.astroApi.openPathInOS('${escapeHtml(c.docPath.replace(/\\/g, '\\\\'))}')">Open ↗</button>
          </div>
          <div style="font-size: 11px; color: var(--text-muted);">Score: ${c.score} · Match: ${c.matchType}</div>
          <blockquote style="margin: 4px 0 0 0; padding-left: 6px; border-left: 2px solid var(--accent-primary); font-size: 11px;">${escapeHtml(c.snippet)}</blockquote>
        `;
        ragQueryCitations.appendChild(item);
      });
    }
  });

  async function refreshRAGView() {
    const stats = await api.getRAGStats();
    ragActiveCollName.textContent = `Collection: ${stats.activeCollection}`;
    ragActiveCollMeta.textContent = `${stats.totalDocuments} documents · ${stats.totalChunks} chunks`;

    if (ragStorageSizeLabel) {
      const sizeKB = stats.indexSizeBytes ? (stats.indexSizeBytes / 1024).toFixed(1) : '0';
      ragStorageSizeLabel.textContent = `${sizeKB} KB`;
    }

    // Refresh Embedding Model Status
    if (ragEmbeddingStatusLabel) {
      try {
        const emb = await api.getEmbeddingStatus();
        if (emb && emb.loaded) {
          ragEmbeddingStatusLabel.innerHTML = `<span style="color: var(--accent-success);">● Ready:</span> <strong>${escapeHtml(emb.modelId)}</strong> (${emb.dimensions} dims, ${emb.device})`;
        } else {
          ragEmbeddingStatusLabel.innerHTML = `<span style="color: var(--accent-warning);">○ BM25 Lexical Active:</span> Local embedding model not loaded.`;
        }
      } catch (e) {
        ragEmbeddingStatusLabel.textContent = 'Embedding status unavailable.';
      }
    }

    const colls = await api.listRAGCollections();
    ragCollectionsList.innerHTML = '';
    colls.forEach(col => {
      const item = document.createElement('div');
      item.className = `file-item-row ${col.name === stats.activeCollection ? 'active' : ''}`;
      item.innerHTML = `
        <span>📚 ${escapeHtml(col.name)}</span>
        <span style="font-size: 11px; color: var(--text-muted);">${col.totalDocuments} docs</span>
      `;
      item.onclick = async () => {
        await api.switchRAGCollection(col.name);
        refreshRAGView();
      };
      ragCollectionsList.appendChild(item);
    });

    // Populate docs table
    ragDocsTableBody.innerHTML = '';
    const docs = stats.documents || {};
    const docPaths = Object.keys(docs);
    if (docPaths.length === 0) {
      ragDocsTableBody.innerHTML = '<tr><td colspan="4" style="color: var(--text-muted); text-align: center;">No documents indexed in this collection.</td></tr>';
    } else {
      docPaths.forEach(p => {
        const d = docs[p];
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${escapeHtml(d.docName)}</strong><br><span style="font-size: 10px; color: var(--text-muted); word-break: break-all;">${escapeHtml(p)}</span></td>
          <td>${d.chunkCount}</td>
          <td>${new Date(d.indexedAt).toLocaleDateString()}</td>
          <td><button class="btn btn-sm btn-danger" onclick="removeDocFromCollection('${escapeHtml(p.replace(/\\/g, '\\\\'))}')">Remove</button></td>
        `;
        ragDocsTableBody.appendChild(tr);
      });
    }
  }

  window.removeDocFromCollection = async (filePath) => {
    if (confirm(`Remove "${filePath}" from knowledge collection? (Original file will NOT be deleted)`)) {
      await api.removeDocumentFromRAG(filePath);
      refreshRAGView();
    }
  };

  // ================= 05: RESEARCH SCREEN =================
  const researchQueryInput = document.getElementById('research-query-input');
  const btnResearchStart = document.getElementById('btn-research-start');
  const btnResearchCancel = document.getElementById('btn-research-cancel');
  const researchOnlineToggle = document.getElementById('research-online-toggle');
  const researchStatusLabel = document.getElementById('research-status-label');
  const researchNoticeBox = document.getElementById('research-notice-box');
  const researchLocalResults = document.getElementById('research-local-results');
  const researchWebResults = document.getElementById('research-web-results');

  btnResearchStart.addEventListener('click', async () => {
    const q = researchQueryInput.value.trim();
    if (!q) return;

    btnResearchStart.disabled = true;
    btnResearchCancel.style.display = 'inline-flex';
    researchStatusLabel.textContent = 'Searching...';
    researchNoticeBox.style.display = 'none';

    try {
      const res = await api.performResearch({
        query: q,
        allowOnline: researchOnlineToggle.checked
      });

      if (res.notice) {
        researchNoticeBox.textContent = res.notice;
        researchNoticeBox.style.display = 'block';
      }

      // Local sources
      if (res.localSources.length === 0) {
        researchLocalResults.innerHTML = '<em>No matching local documents found.</em>';
      } else {
        researchLocalResults.innerHTML = res.localSources.map(s => `
          <div class="citation-item" style="margin-bottom: 6px;">
            <strong>📁 ${escapeHtml(s.title)}</strong> (Score: ${s.score})<br>
            ${escapeHtml(s.snippet)}
          </div>
        `).join('');
      }

      // Web sources
      if (res.webSources.length === 0) {
        researchWebResults.innerHTML = res.onlineAllowed
          ? '<em>No public online sources found for this query.</em>'
          : '<em>Internet research is disabled by privacy policy (Rule 2 & Rule 4).</em>';
      } else {
        researchWebResults.innerHTML = '';
        res.webSources.forEach((s, idx) => {
          const item = document.createElement('div');
          item.className = 'citation-item';
          item.style.cssText = 'margin-bottom: 8px; border: 1px solid var(--border-subtle); padding: 8px; border-radius: 4px;';
          item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <strong>🌐 ${escapeHtml(s.title)}</strong>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-sm btn-primary" id="btn-save-finding-${idx}" style="font-size: 10px; padding: 2px 6px;">📥 Save to Library</button>
                <a href="${escapeHtml(s.url)}" target="_blank" class="btn btn-sm" style="font-size: 10px; padding: 2px 6px; text-decoration: none; color: var(--accent-primary);">Open ↗</a>
              </div>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Domain: ${escapeHtml(s.sourceDomain)} · Retrieved: ${new Date(s.retrievedAt || Date.now()).toLocaleTimeString()}</div>
            <div style="font-size: 11.5px; color: var(--text-secondary);">${escapeHtml(s.snippet)}</div>
          `;
          researchWebResults.appendChild(item);

          const btnSave = item.querySelector(`#btn-save-finding-${idx}`);
          if (btnSave) {
            btnSave.onclick = async () => {
              try {
                await api.saveResearchFinding(s);
                btnSave.textContent = '✓ Saved to Library';
                btnSave.disabled = true;
              } catch (err) {
                alert('Save Error: ' + err.message);
              }
            };
          }
        });
      }

      researchStatusLabel.textContent = `Completed (${res.localSources.length} local, ${res.webSources.length} web)`;
    } catch (e) {
      researchNoticeBox.textContent = `Research Error: ${e.message}`;
      researchNoticeBox.style.display = 'block';
      researchStatusLabel.textContent = 'Error';
    } finally {
      btnResearchStart.disabled = false;
      btnResearchCancel.style.display = 'none';
    }
  });

  btnResearchCancel.addEventListener('click', async () => {
    await api.cancelResearch();
    researchStatusLabel.textContent = 'Cancelled';
    btnResearchCancel.style.display = 'none';
    btnResearchStart.disabled = false;
  });

  // ================= 06: CODING STUDIO SCREEN =================
  const studioTreeList = document.getElementById('studio-tree-list');
  const studioTreeSearch = document.getElementById('studio-tree-search');
  const btnStudioRefreshTree = document.getElementById('btn-studio-refresh-tree');
  const studioActiveFileLabel = document.getElementById('studio-active-file-label');
  const studioCredentialWarning = document.getElementById('studio-credential-warning');
  const studioEditorBox = document.getElementById('studio-editor-box');
  const studioDiffContainer = document.getElementById('studio-diff-container');
  const studioEditorStats = document.getElementById('studio-editor-stats');
  const studioFileTabs = document.getElementById('studio-file-tabs');
  const btnModeEditor = document.getElementById('btn-mode-editor');
  const btnModeDiff = document.getElementById('btn-mode-diff');
  const btnStudioSaveFile = document.getElementById('btn-studio-save-file');
  const btnStudioApplyDiff = document.getElementById('btn-studio-apply-diff');
  const btnStudioRevertDiff = document.getElementById('btn-studio-revert-diff');
  const btnStudioRejectDiff = document.getElementById('btn-studio-reject-diff');
  const studioBottomPanel = document.getElementById('studio-bottom-panel');
  const btnToggleBottomDrawer = document.getElementById('btn-toggle-bottom-drawer');
  const tabDrawerTerminal = document.getElementById('tab-drawer-terminal');
  const tabDrawerChecks = document.getElementById('tab-drawer-checks');
  const tabDrawerHistory = document.getElementById('tab-drawer-history');
  const paneTerminal = document.getElementById('pane-terminal');
  const paneChecks = document.getElementById('pane-checks');
  const paneHistory = document.getElementById('pane-history');
  const studioChecksContent = document.getElementById('studio-checks-content');
  const studioHistoryContent = document.getElementById('studio-history-content');
  const studioTerminalOutput = document.getElementById('studio-terminal-output');
  const studioCmdInput = document.getElementById('studio-cmd-input');
  const btnStudioRunCmd = document.getElementById('btn-studio-run-cmd');
  const btnStudioCancelCmd = document.getElementById('btn-studio-cancel-cmd');
  const studioCmdStatusBadge = document.getElementById('studio-cmd-status-badge');
  const btnStudioOpenProject = document.getElementById('btn-studio-open-project');
  const btnStudioCloseProject = document.getElementById('btn-studio-close-project');
  const studioProjectName = document.getElementById('studio-project-name');
  const studioProjectBadges = document.getElementById('studio-project-badges');
  const btnQuickTest = document.getElementById('btn-quick-test');
  const btnQuickLint = document.getElementById('btn-quick-lint');
  const btnQuickGit = document.getElementById('btn-quick-git');
  const btnClearTerminal = document.getElementById('btn-clear-terminal');

  // AI Dock Elements
  const studioAiDock = document.getElementById('studio-ai-dock');
  const studioAiModelPill = document.getElementById('studio-ai-model-pill');
  const btnAiExplain = document.getElementById('btn-ai-explain');
  const btnAiRefactor = document.getElementById('btn-ai-refactor');
  const btnAiTests = document.getElementById('btn-ai-tests');
  const btnAiBugs = document.getElementById('btn-ai-bugs');
  const studioAiMessages = document.getElementById('studio-ai-messages');
  const studioAiInput = document.getElementById('studio-ai-input');
  const btnStudioAiSend = document.getElementById('btn-studio-ai-send');

  // Activity Rail Elements
  const railBtnFiles = document.getElementById('rail-btn-files');
  const railBtnSearch = document.getElementById('rail-btn-search');
  const railBtnGit = document.getElementById('rail-btn-git');
  const railBtnAi = document.getElementById('rail-btn-ai');
  const railBtnTerm = document.getElementById('rail-btn-term');
  const studioPrimarySidebar = document.getElementById('studio-primary-sidebar');
  const btnCollapseSidebar = document.getElementById('btn-collapse-sidebar');
  const btnCloseAiDock = document.getElementById('btn-close-ai-dock');
  const studioLineNumbers = document.getElementById('studio-line-numbers');

  // Studio State
  let activeProjectMeta = null;
  let activeOpenFilePath = null;
  let lastAppliedBackupPath = null;
  let openStudioTabs = []; // Array of { path, name, content, originalContent, isDirty }
  let activeStudioTabIndex = -1;
  let studioCurrentMode = 'editor'; // 'editor' | 'diff'
  let studioSessionHistory = []; // Array of { timestamp, filePath, backupPath }

  function getFileIcon(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    switch (ext) {
      case 'js':
      case 'mjs':
      case 'cjs':
      case 'ts':
        return '🟨';
      case 'json':
        return '📦';
      case 'html':
        return '🌐';
      case 'css':
        return '🎨';
      case 'md':
      case 'txt':
        return '📝';
      case 'py':
        return '🐍';
      default:
        return '📄';
    }
  }

  function renderStudioTabs() {
    if (!studioFileTabs) return;
    if (openStudioTabs.length === 0) {
      studioFileTabs.innerHTML = `
        <div class="tab-item active" id="tab-default">
          <span class="tab-icon">📄</span>
          <span class="tab-name" id="studio-active-file-label">No File Open</span>
        </div>
      `;
      if (studioActiveFileLabel) studioActiveFileLabel.textContent = 'No File Open';
      if (studioEditorBox) {
        studioEditorBox.value = '';
        studioEditorBox.placeholder = '// Select a file from the project tree to view its contents';
      }
      if (studioEditorStats) studioEditorStats.textContent = 'UTF-8 · 0 lines';
      if (studioCredentialWarning) studioCredentialWarning.style.display = 'none';
      if (btnStudioSaveFile) btnStudioSaveFile.disabled = true;
      activeOpenFilePath = null;
      return;
    }

    if (btnStudioSaveFile) btnStudioSaveFile.disabled = false;
    studioFileTabs.innerHTML = '';

    openStudioTabs.forEach((tab, idx) => {
      const tabEl = document.createElement('div');
      tabEl.className = `tab-item ${idx === activeStudioTabIndex ? 'active' : ''}`;
      tabEl.innerHTML = `
        <span class="tab-icon">${getFileIcon(tab.name)}</span>
        <span class="tab-name" title="${escapeHtml(tab.path)}">${escapeHtml(tab.name)}</span>
        <span class="tab-unsaved" style="display: ${tab.isDirty ? 'inline-block' : 'none'};">●</span>
        <button class="tab-close" title="Close">×</button>
      `;

      tabEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-close')) {
          e.stopPropagation();
          closeStudioTab(idx);
        } else {
          selectStudioTab(idx);
        }
      });

      studioFileTabs.appendChild(tabEl);
    });
  }

  async function selectStudioTab(index) {
    if (index < 0 || index >= openStudioTabs.length) return;
    activeStudioTabIndex = index;
    const tab = openStudioTabs[index];
    activeOpenFilePath = tab.path;

    if (studioActiveFileLabel) studioActiveFileLabel.textContent = tab.path;
    if (studioEditorBox) studioEditorBox.value = tab.content;
    updateEditorStats();

    // Check credentials warning
    try {
      const isSensitive = await api.checkCredentialFile(tab.path);
      if (studioCredentialWarning) {
        studioCredentialWarning.style.display = isSensitive ? 'block' : 'none';
      }
    } catch (e) {
      if (studioCredentialWarning) studioCredentialWarning.style.display = 'none';
    }

    renderStudioTabs();

    if (studioCurrentMode === 'diff') {
      renderDiffView(tab.originalContent, tab.content);
    }
  }

  function closeStudioTab(index) {
    const tab = openStudioTabs[index];
    if (tab && tab.isDirty) {
      const ok = confirm(`Discard unsaved changes to "${tab.name}"?`);
      if (!ok) return;
    }

    openStudioTabs.splice(index, 1);
    if (activeStudioTabIndex >= openStudioTabs.length) {
      activeStudioTabIndex = openStudioTabs.length - 1;
    }
    if (activeStudioTabIndex >= 0) {
      selectStudioTab(activeStudioTabIndex);
    } else {
      renderStudioTabs();
    }
  }

  function updateEditorStats() {
    if (!studioEditorBox || !studioEditorStats) return;
    const lines = (studioEditorBox.value || '').split('\n').length;
    const bytes = new Blob([studioEditorBox.value || '']).size;
    const kb = (bytes / 1024).toFixed(1);
    studioEditorStats.textContent = `UTF-8 · ${lines} lines (${kb} KB)`;

    const lineGutter = document.getElementById('studio-line-numbers');
    if (lineGutter) {
      const maxLines = Math.max(lines, 1);
      let gutterText = '';
      for (let i = 1; i <= maxLines; i++) {
        gutterText += i + '\n';
      }
      lineGutter.textContent = gutterText;
    }
  }

  // Handle live editing in editor
  if (studioEditorBox) {
    studioEditorBox.addEventListener('input', () => {
      if (activeStudioTabIndex >= 0 && activeStudioTabIndex < openStudioTabs.length) {
        const tab = openStudioTabs[activeStudioTabIndex];
        tab.content = studioEditorBox.value;
        const wasDirty = tab.isDirty;
        tab.isDirty = tab.content !== tab.originalContent;
        if (wasDirty !== tab.isDirty) {
          renderStudioTabs();
        }
      }
      updateEditorStats();
    });

    studioEditorBox.addEventListener('scroll', () => {
      const lineGutter = document.getElementById('studio-line-numbers');
      if (lineGutter) {
        lineGutter.scrollTop = studioEditorBox.scrollTop;
      }
    });

    studioEditorBox.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveActiveStudioFile();
      }
    });
  }

  async function saveActiveStudioFile() {
    if (activeStudioTabIndex < 0 || activeStudioTabIndex >= openStudioTabs.length) return;
    const tab = openStudioTabs[activeStudioTabIndex];
    try {
      const res = await api.writeFileWithBackup(tab.path, tab.content, true);
      tab.originalContent = tab.content;
      tab.isDirty = false;
      renderStudioTabs();

      if (res && res.backupPath) {
        lastAppliedBackupPath = res.backupPath;
        studioSessionHistory.unshift({
          timestamp: new Date().toLocaleTimeString(),
          filePath: tab.path,
          backupPath: res.backupPath
        });
        updateChangeHistoryPane();
      }

      showToast(`Saved "${tab.name}" safely with backup.`, 'success');
    } catch (err) {
      alert(`Save Error: ${err.message}`);
    }
  }

  if (btnStudioSaveFile) {
    btnStudioSaveFile.addEventListener('click', saveActiveStudioFile);
  }

  // Segmented Mode Switcher (Editor vs Diff Preview)
  function setStudioMode(mode) {
    studioCurrentMode = mode;
    if (btnModeEditor) btnModeEditor.classList.toggle('active', mode === 'editor');
    if (btnModeDiff) btnModeDiff.classList.toggle('active', mode === 'diff');

    if (mode === 'editor') {
      if (studioEditorBox) studioEditorBox.style.display = 'block';
      const wrapper = document.getElementById('studio-editor-wrapper');
      if (wrapper) wrapper.style.display = 'flex';
      if (studioDiffContainer) studioDiffContainer.style.display = 'none';
      if (btnStudioApplyDiff) btnStudioApplyDiff.style.display = 'none';
      if (btnStudioRejectDiff) btnStudioRejectDiff.style.display = 'none';
    } else {
      if (studioEditorBox) studioEditorBox.style.display = 'none';
      const wrapper = document.getElementById('studio-editor-wrapper');
      if (wrapper) wrapper.style.display = 'none';
      if (studioDiffContainer) studioDiffContainer.style.display = 'block';

      if (activeStudioTabIndex >= 0 && activeStudioTabIndex < openStudioTabs.length) {
        const tab = openStudioTabs[activeStudioTabIndex];
        renderDiffView(tab.originalContent, tab.content);
        if (tab.isDirty) {
          if (btnStudioApplyDiff) btnStudioApplyDiff.style.display = 'inline-flex';
          if (btnStudioRejectDiff) btnStudioRejectDiff.style.display = 'inline-flex';
        }
      }
    }
  }

  if (btnModeEditor) btnModeEditor.addEventListener('click', () => setStudioMode('editor'));
  if (btnModeDiff) btnModeDiff.addEventListener('click', () => setStudioMode('diff'));

  function renderDiffView(originalText, modifiedText) {
    if (!studioDiffContainer) return;
    const origLines = (originalText || '').split('\n');
    const modLines = (modifiedText || '').split('\n');

    let addCount = 0;
    let delCount = 0;
    const maxLines = Math.max(origLines.length, modLines.length);
    for (let i = 0; i < maxLines; i++) {
      if (origLines[i] !== modLines[i]) {
        if (origLines[i] !== undefined) delCount++;
        if (modLines[i] !== undefined) addCount++;
      }
    }

    const currentTab = (activeStudioTabIndex >= 0 && activeStudioTabIndex < openStudioTabs.length)
      ? openStudioTabs[activeStudioTabIndex]
      : null;
    const fileName = currentTab ? currentTab.name : 'Active File';

    let diffHtml = `
      <div class="diff-header-banner">
        <div class="diff-header-info">
          <span class="diff-header-title">⚖️ Diff: <strong>${escapeHtml(fileName)}</strong></span>
          ${originalText === modifiedText
            ? '<span class="status-badge" style="background: rgba(100, 116, 139, 0.2); color: var(--text-muted); font-size: 11px;">Unmodified</span>'
            : `<span class="status-badge" style="background: rgba(16, 185, 129, 0.15); color: var(--accent-success); font-size: 11px;">+${addCount} lines</span>
               <span class="status-badge" style="background: rgba(239, 68, 68, 0.15); color: var(--accent-danger); font-size: 11px;">-${delCount} lines</span>`}
        </div>
        ${originalText !== modifiedText ? `
          <div class="diff-header-actions">
            <button class="btn btn-sm btn-danger" id="diff-banner-reject">✕ Reject Changes</button>
            <button class="btn btn-sm btn-primary" id="diff-banner-apply">✓ Approve &amp; Apply (Rule 14)</button>
          </div>
        ` : ''}
      </div>
      <div style="font-family: var(--font-mono); font-size: 11.5px; line-height: 1.5; padding: 4px 0;">
    `;

    if (originalText === modifiedText) {
      diffHtml += '<div style="color: var(--text-muted); padding: 16px; text-align: center;">No diff detected. File is unmodified.</div>';
    } else {
      for (let i = 0; i < maxLines; i++) {
        const orig = origLines[i];
        const mod = modLines[i];

        if (orig === mod) {
          diffHtml += `<div class="diff-line diff-ctx"><span class="diff-num">${i + 1}</span><span class="diff-sign"> </span><span>${escapeHtml(orig || '')}</span></div>`;
        } else {
          if (orig !== undefined) {
            diffHtml += `<div class="diff-line diff-del"><span class="diff-num">${i + 1}</span><span class="diff-sign">-</span><span>${escapeHtml(orig)}</span></div>`;
          }
          if (mod !== undefined) {
            diffHtml += `<div class="diff-line diff-add"><span class="diff-num">${i + 1}</span><span class="diff-sign">+</span><span>${escapeHtml(mod)}</span></div>`;
          }
        }
      }
    }
    diffHtml += '</div>';
    studioDiffContainer.innerHTML = diffHtml;

    const bReject = document.getElementById('diff-banner-reject');
    if (bReject && btnStudioRejectDiff) {
      bReject.addEventListener('click', () => btnStudioRejectDiff.click());
    }
    const bApply = document.getElementById('diff-banner-apply');
    if (bApply && btnStudioApplyDiff) {
      bApply.addEventListener('click', () => btnStudioApplyDiff.click());
    }
  }

  // Diff Apply & Reject Handlers
  if (btnStudioApplyDiff) {
    btnStudioApplyDiff.addEventListener('click', async () => {
      if (activeStudioTabIndex < 0 || activeStudioTabIndex >= openStudioTabs.length) return;
      const tab = openStudioTabs[activeStudioTabIndex];
      const ok = confirm(`Security Confirmation (Rule 14):\n\nApprove changes to "${tab.name}"?\nA safe recoverable backup will be created before applying.`);
      if (!ok) return;

      try {
        const res = await api.applyDiff(tab.path, tab.content, true, { allowSensitive: true });
        lastAppliedBackupPath = res.backupPath;
        tab.originalContent = tab.content;
        tab.isDirty = false;
        renderStudioTabs();
        setStudioMode('editor');
        if (btnStudioRevertDiff) btnStudioRevertDiff.style.display = 'inline-flex';

        studioSessionHistory.unshift({
          timestamp: new Date().toLocaleTimeString(),
          filePath: tab.path,
          backupPath: res.backupPath
        });
        updateChangeHistoryPane();
        showToast('Diff applied safely with backup.', 'success');
      } catch (err) {
        alert('Apply Diff Error: ' + err.message);
      }
    });
  }

  if (btnStudioRejectDiff) {
    btnStudioRejectDiff.addEventListener('click', () => {
      if (activeStudioTabIndex < 0 || activeStudioTabIndex >= openStudioTabs.length) return;
      const tab = openStudioTabs[activeStudioTabIndex];
      tab.content = tab.originalContent;
      tab.isDirty = false;
      if (studioEditorBox) studioEditorBox.value = tab.content;
      renderStudioTabs();
      setStudioMode('editor');
      showToast('Changes discarded.', 'info');
    });
  }

  if (btnStudioRevertDiff) {
    btnStudioRevertDiff.addEventListener('click', async () => {
      if (!activeOpenFilePath || !lastAppliedBackupPath) return;
      const ok = confirm(`Revert Changes (Rule 14):\n\nRestore original file content from backup?\n${lastAppliedBackupPath}`);
      if (!ok) return;

      try {
        await api.revertDiff(activeOpenFilePath, lastAppliedBackupPath);
        const restored = await api.readFile(activeOpenFilePath);
        if (activeStudioTabIndex >= 0 && activeStudioTabIndex < openStudioTabs.length) {
          const tab = openStudioTabs[activeStudioTabIndex];
          tab.content = restored;
          tab.originalContent = restored;
          tab.isDirty = false;
        }
        if (studioEditorBox) studioEditorBox.value = restored;
        renderStudioTabs();
        btnStudioRevertDiff.style.display = 'none';
        showToast('File restored successfully from backup.', 'success');
      } catch (err) {
        alert('Revert Error: ' + err.message);
      }
    });
  }

  // Bottom Drawer Pane Switcher
  function switchDrawerPane(paneName) {
    if (tabDrawerTerminal) tabDrawerTerminal.classList.toggle('active', paneName === 'terminal');
    if (tabDrawerChecks) tabDrawerChecks.classList.toggle('active', paneName === 'checks');
    if (tabDrawerHistory) tabDrawerHistory.classList.toggle('active', paneName === 'history');

    if (paneTerminal) paneTerminal.style.display = paneName === 'terminal' ? 'block' : 'none';
    if (paneChecks) paneChecks.style.display = paneName === 'checks' ? 'block' : 'none';
    if (paneHistory) paneHistory.style.display = paneName === 'history' ? 'block' : 'none';

    if (studioBottomPanel && studioBottomPanel.classList.contains('collapsed')) {
      studioBottomPanel.classList.remove('collapsed');
      if (btnToggleBottomDrawer) btnToggleBottomDrawer.textContent = '▼';
    }
  }

  if (tabDrawerTerminal) tabDrawerTerminal.addEventListener('click', () => switchDrawerPane('terminal'));
  if (tabDrawerChecks) tabDrawerChecks.addEventListener('click', () => {
    switchDrawerPane('checks');
    refreshChecksPane();
  });
  if (tabDrawerHistory) tabDrawerHistory.addEventListener('click', () => {
    switchDrawerPane('history');
    updateChangeHistoryPane();
  });

  if (btnToggleBottomDrawer) {
    btnToggleBottomDrawer.addEventListener('click', () => {
      if (!studioBottomPanel) return;
      const isCollapsed = studioBottomPanel.classList.toggle('collapsed');
      btnToggleBottomDrawer.textContent = isCollapsed ? '▲' : '▼';
    });
  }

  async function refreshChecksPane() {
    if (!studioChecksContent) return;
    if (!currentWorkspaceDir) {
      studioChecksContent.textContent = 'No project open. Open a project to inspect files.';
      return;
    }
    studioChecksContent.innerHTML = '<div style="color: var(--text-muted);">Running project diagnostics...</div>';
    try {
      const summary = await api.analyzeProject(currentWorkspaceDir);
      studioChecksContent.innerHTML = `
        <div style="line-height: 1.6;">
          <strong>Project:</strong> ${escapeHtml(summary.name)} (${summary.totalFiles} files)<br>
          <strong>Primary Languages:</strong> ${(summary.languages || []).map(l => `${l.language} (${l.fileCount})`).join(', ') || 'N/A'}<br>
          <strong>Security:</strong> All modifications protected with automated backups (.astro_bak).<br>
          <strong>Offline Boundary:</strong> Protected under Rule 2 &amp; 4.
        </div>
      `;
    } catch (e) {
      studioChecksContent.textContent = 'Diagnostics error: ' + e.message;
    }
  }

  function updateChangeHistoryPane() {
    if (!studioHistoryContent) return;
    if (studioSessionHistory.length === 0) {
      studioHistoryContent.textContent = 'No file edits or backups created in this session.';
      return;
    }
    studioHistoryContent.innerHTML = studioSessionHistory.map(h => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--border-subtle);">
        <div>
          <strong>${escapeHtml(h.filePath.split(/[\\/]/).pop())}</strong>
          <span style="font-size: 10px; color: var(--text-muted); margin-left: 6px;">${h.timestamp}</span>
          <div style="font-size: 10px; font-family: var(--font-mono); color: var(--text-muted);">${escapeHtml(h.backupPath)}</div>
        </div>
        <button class="btn btn-sm" style="font-size: 10px; padding: 2px 6px;" onclick="window.triggerRevertSpecific('${escapeHtml(h.filePath.replace(/\\/g, '\\\\'))}', '${escapeHtml(h.backupPath.replace(/\\/g, '\\\\'))}')">↩ Restore</button>
      </div>
    `).join('');
  }

  window.triggerRevertSpecific = async (filePath, backupPath) => {
    if (confirm(`Restore "${filePath}" from "${backupPath}"?`)) {
      await api.revertDiff(filePath, backupPath);
      showToast('File restored.', 'success');
      if (activeOpenFilePath === filePath) {
        loadFileIntoStudio(filePath);
      }
    }
  };

  if (btnClearTerminal) {
    btnClearTerminal.addEventListener('click', () => {
      if (studioTerminalOutput) studioTerminalOutput.textContent = 'ASTRO Terminal ready.';
    });
  }

  // Activity Rail Bindings
  function setRailActive(activeBtnId) {
    [railBtnFiles, railBtnSearch, railBtnGit, railBtnAi, railBtnTerm].forEach(b => {
      if (b) b.classList.toggle('active', b.id === activeBtnId);
    });
  }

  if (railBtnFiles) {
    railBtnFiles.addEventListener('click', () => {
      if (studioPrimarySidebar) {
        const isCollapsed = studioPrimarySidebar.classList.contains('collapsed');
        if (isCollapsed) {
          studioPrimarySidebar.classList.remove('collapsed');
          setRailActive('rail-btn-files');
        } else if (railBtnFiles.classList.contains('active')) {
          studioPrimarySidebar.classList.add('collapsed');
          railBtnFiles.classList.remove('active');
        } else {
          setRailActive('rail-btn-files');
        }
      }
    });
  }

  if (btnCollapseSidebar) {
    btnCollapseSidebar.addEventListener('click', () => {
      if (studioPrimarySidebar) studioPrimarySidebar.classList.add('collapsed');
      if (railBtnFiles) railBtnFiles.classList.remove('active');
    });
  }

  if (railBtnSearch) {
    railBtnSearch.addEventListener('click', () => {
      if (studioPrimarySidebar) studioPrimarySidebar.classList.remove('collapsed');
      setRailActive('rail-btn-search');
      if (studioTreeSearch) {
        studioTreeSearch.placeholder = 'Search code in project...';
        studioTreeSearch.focus();
      }
    });
  }

  if (railBtnGit) {
    railBtnGit.addEventListener('click', () => {
      setRailActive('rail-btn-git');
      setStudioMode('diff');
    });
  }

  if (railBtnAi) {
    railBtnAi.addEventListener('click', () => {
      if (studioAiDock) {
        const isCollapsed = studioAiDock.classList.toggle('collapsed');
        railBtnAi.classList.toggle('active', !isCollapsed);
        if (!isCollapsed && studioAiInput) {
          studioAiInput.focus();
        }
      }
    });
  }

  if (btnCloseAiDock) {
    btnCloseAiDock.addEventListener('click', () => {
      if (studioAiDock) studioAiDock.classList.add('collapsed');
      if (railBtnAi) railBtnAi.classList.remove('active');
    });
  }

  if (railBtnTerm) {
    railBtnTerm.addEventListener('click', () => {
      if (studioBottomPanel) {
        const isCollapsed = studioBottomPanel.classList.toggle('collapsed');
        railBtnTerm.classList.toggle('active', !isCollapsed);
        if (!isCollapsed) {
          switchDrawerPane('terminal');
          if (btnToggleBottomDrawer) btnToggleBottomDrawer.textContent = '▼';
          if (studioCmdInput) studioCmdInput.focus();
        } else {
          if (btnToggleBottomDrawer) btnToggleBottomDrawer.textContent = '▲';
        }
      }
    });
  }

  // AI Assistant Dock Actions
  async function askStudioAi(promptText) {
    if (!promptText) return;
    if (studioAiMessages) {
      const userMsg = document.createElement('div');
      userMsg.className = 'ai-msg user';
      userMsg.textContent = promptText;
      studioAiMessages.appendChild(userMsg);
      studioAiMessages.scrollTop = studioAiMessages.scrollHeight;
    }

    if (studioAiInput) studioAiInput.value = '';

    const asstMsg = document.createElement('div');
    asstMsg.className = 'ai-msg assistant';
    asstMsg.innerHTML = '<span style="color: var(--text-muted);">Thinking...</span>';
    if (studioAiMessages) {
      studioAiMessages.appendChild(asstMsg);
      studioAiMessages.scrollTop = studioAiMessages.scrollHeight;
    }

    const currentCode = (activeStudioTabIndex >= 0 && activeStudioTabIndex < openStudioTabs.length)
      ? openStudioTabs[activeStudioTabIndex].content
      : '';
    const currentName = (activeStudioTabIndex >= 0 && activeStudioTabIndex < openStudioTabs.length)
      ? openStudioTabs[activeStudioTabIndex].name
      : 'untitled';

    const fullPrompt = currentCode
      ? `File: ${currentName}\n\`\`\`\n${currentCode.slice(0, 3000)}\n\`\`\`\n\nTask: ${promptText}`
      : promptText;

    try {
      const res = await api.sendMessage({
        message: fullPrompt,
        mode: 'general-assistant',
        useRAG: false
      });
      asstMsg.innerHTML = formatMessageContent(res.text);

      // If response includes code blocks, offer review diff
      if (res.text && res.text.includes('```') && activeStudioTabIndex >= 0) {
        const codeMatch = res.text.match(/```(?:\w+)?\n([\s\S]*?)```/);
        if (codeMatch && codeMatch[1]) {
          const proposedCode = codeMatch[1].trim();
          const reviewBtn = document.createElement('button');
          reviewBtn.className = 'btn btn-sm btn-primary';
          reviewBtn.style.cssText = 'margin-top: 8px; font-size: 11px;';
          reviewBtn.textContent = '⚖️ Review Proposed Diff';
          reviewBtn.onclick = () => {
            const tab = openStudioTabs[activeStudioTabIndex];
            tab.content = proposedCode;
            tab.isDirty = true;
            if (studioEditorBox) studioEditorBox.value = proposedCode;
            renderStudioTabs();
            setStudioMode('diff');
          };
          asstMsg.appendChild(reviewBtn);
        }
      }
    } catch (err) {
      asstMsg.innerHTML = `<span style="color: var(--accent-danger);">AI Error: ${escapeHtml(err.message)}</span>`;
    } finally {
      if (studioAiMessages) studioAiMessages.scrollTop = studioAiMessages.scrollHeight;
    }
  }

  if (btnAiExplain) {
    btnAiExplain.addEventListener('click', () => askStudioAi('Explain how this code works and its key patterns.'));
  }
  if (btnAiRefactor) {
    btnAiRefactor.addEventListener('click', () => askStudioAi('Refactor this code for readability, performance, and best practices.'));
  }
  if (btnAiTests) {
    btnAiTests.addEventListener('click', () => askStudioAi('Generate unit tests for this code.'));
  }
  if (btnAiBugs) {
    btnAiBugs.addEventListener('click', () => askStudioAi('Audit this code for edge cases, performance bottlenecks, or potential bugs.'));
  }

  if (btnStudioAiSend) {
    btnStudioAiSend.addEventListener('click', () => {
      const q = studioAiInput ? studioAiInput.value.trim() : '';
      if (q) askStudioAi(q);
    });
  }

  if (studioAiInput) {
    studioAiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const q = studioAiInput.value.trim();
        if (q) askStudioAi(q);
      }
    });
  }

  async function openProjectFolder(folderPath) {
    if (!folderPath) return;
    try {
      activeProjectMeta = await api.openProject(folderPath);
      currentWorkspaceDir = folderPath;
      if (studioProjectName) {
        studioProjectName.textContent = `📁 ${activeProjectMeta.name}`;
        studioProjectName.style.borderColor = 'var(--accent-primary)';
      }
      if (btnStudioCloseProject) btnStudioCloseProject.style.display = 'inline-flex';

      // Badges
      if (studioProjectBadges) {
        studioProjectBadges.innerHTML = '';
        if (activeProjectMeta.languages && activeProjectMeta.languages.length > 0) {
          const topLangs = activeProjectMeta.languages.slice(0, 3).map(l => `<span class="status-badge" style="font-size: 10px;">${escapeHtml(l.language)} (${l.fileCount})</span>`).join(' ');
          studioProjectBadges.innerHTML += topLangs;
        }
        if (activeProjectMeta.manifest && activeProjectMeta.manifest.manifestFile) {
          studioProjectBadges.innerHTML += ` <span class="status-badge" style="font-size: 10px; background: rgba(59, 130, 246, 0.15); color: var(--accent-primary);">📦 ${escapeHtml(activeProjectMeta.manifest.manifestFile)}</span>`;
        }
      }

      await refreshStudioView();
    } catch (err) {
      alert('Open Project Error: ' + err.message);
    }
  }

  if (btnStudioOpenProject) {
    btnStudioOpenProject.addEventListener('click', async () => {
      const picked = await api.pickFolder();
      if (picked) {
        await openProjectFolder(picked);
      }
    });
  }

  if (btnStudioCloseProject) {
    btnStudioCloseProject.addEventListener('click', async () => {
      await api.closeProject();
      activeProjectMeta = null;
      currentWorkspaceDir = '';
      if (studioProjectName) {
        studioProjectName.textContent = 'No Active Project';
        studioProjectName.style.borderColor = 'var(--border-subtle)';
      }
      if (studioProjectBadges) studioProjectBadges.innerHTML = '';
      btnStudioCloseProject.style.display = 'none';
      openStudioTabs = [];
      activeStudioTabIndex = -1;
      renderStudioTabs();
      if (studioTreeList) studioTreeList.innerHTML = '<div style="color: var(--text-muted); font-size: 11.5px; padding: 10px 0;">Open a project folder to inspect files.</div>';
    });
  }

  async function refreshStudioView() {
    renderStudioTabs();
    updateEditorStats();

    if (!currentWorkspaceDir && api.getActiveProject) {
      try {
        const active = await api.getActiveProject();
        if (active && active.projectPath) {
          currentWorkspaceDir = active.projectPath;
          activeProjectMeta = active;
          if (studioProjectName) {
            studioProjectName.textContent = `📁 ${active.name || active.projectPath.split(/[\\/]/).pop()}`;
            studioProjectName.style.borderColor = 'var(--accent-primary)';
          }
          if (btnStudioCloseProject) btnStudioCloseProject.style.display = 'inline-flex';
          if (studioProjectBadges && active.languages) {
            studioProjectBadges.innerHTML = active.languages.slice(0, 3).map(l => `<span class="status-badge" style="font-size: 10px;">${escapeHtml(l.language)} (${l.fileCount})</span>`).join(' ');
          }
        }
      } catch (e) {}
    }

    const targetDir = currentWorkspaceDir;
    if (!targetDir) {
      if (studioTreeList) {
        studioTreeList.innerHTML = `
          <div class="tree-empty-notice">
            <div style="font-size: 26px; margin-bottom: 8px;">📁</div>
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">No Project Open</div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4;">Open a workspace folder to inspect files, edit code, and run tests safely.</div>
            <button class="btn btn-sm btn-primary" id="btn-tree-open-folder" style="font-size: 11px;">Open Folder 📁</button>
          </div>
        `;
        const b = document.getElementById('btn-tree-open-folder');
        if (b && btnStudioOpenProject) b.addEventListener('click', () => btnStudioOpenProject.click());
      }
      return;
    }
    const query = studioTreeSearch ? studioTreeSearch.value.trim() : '';

    if (query) {
      const matches = await api.searchProjectCode(query);
      if (studioTreeList) {
        studioTreeList.innerHTML = '';
        if (matches.length === 0) {
          studioTreeList.innerHTML = '<div style="color: var(--text-muted); font-size: 11px; padding: 8px;">No matching code lines found.</div>';
          return;
        }
        matches.slice(0, 40).forEach(m => {
          const item = document.createElement('div');
          item.className = 'file-item-row';
          item.innerHTML = `<strong>${escapeHtml(m.fileName)}</strong>:${m.line} <span style="font-size: 10px; color: var(--text-muted);">${escapeHtml(m.matchedLine.slice(0, 40))}</span>`;
          item.onclick = () => loadFileIntoStudio(m.filePath);
          studioTreeList.appendChild(item);
        });
      }
      return;
    }

    const files = await api.listFiles(targetDir, 'all');
    if (studioTreeList) {
      studioTreeList.innerHTML = '';
      files.slice(0, 50).forEach(f => {
        const item = document.createElement('div');
        item.className = 'file-item-row';
        const isCode = f.category === 'code';
        item.innerHTML = `<span>${f.type === 'directory' ? '📁' : (isCode ? '📄' : '📝')} ${escapeHtml(f.name)}</span>`;
        if (f.type === 'file') {
          item.onclick = () => loadFileIntoStudio(f.path);
        }
        studioTreeList.appendChild(item);
      });
    }
  }

  async function loadFileIntoStudio(filePath) {
    if (!filePath) return;
    const existingIndex = openStudioTabs.findIndex(t => t.path === filePath);
    if (existingIndex >= 0) {
      selectStudioTab(existingIndex);
      return;
    }

    try {
      const content = await api.readFile(filePath);
      const name = filePath.split(/[\\/]/).pop();
      openStudioTabs.push({
        path: filePath,
        name,
        content,
        originalContent: content,
        isDirty: false
      });
      selectStudioTab(openStudioTabs.length - 1);
    } catch (err) {
      alert(`Could not open file: ${err.message}`);
    }
  }
  window.loadFileIntoStudio = loadFileIntoStudio;

  if (studioTreeSearch) {
    studioTreeSearch.addEventListener('input', () => {
      refreshStudioView();
    });
  }

  if (btnStudioRefreshTree) {
    btnStudioRefreshTree.addEventListener('click', () => {
      refreshStudioView();
    });
  }

  async function runStudioCommand(cmd) {
    if (!cmd) return;
    const ok = confirm(`Security Confirmation (Rule 9):\n\nApprove execution of command:\n${cmd}\n\nWorking Directory: ${currentWorkspaceDir || 'Default App Directory'}`);
    if (!ok) return;

    if (studioTerminalOutput) studioTerminalOutput.textContent += `\n$ ${cmd}\nRunning...`;
    if (studioCmdInput) studioCmdInput.value = '';
    if (btnStudioRunCmd) btnStudioRunCmd.disabled = true;
    if (btnStudioCancelCmd) btnStudioCancelCmd.style.display = 'inline-flex';
    if (studioCmdStatusBadge) {
      studioCmdStatusBadge.style.display = 'inline-block';
      studioCmdStatusBadge.textContent = 'Running...';
      studioCmdStatusBadge.style.background = 'rgba(59, 130, 246, 0.15)';
      studioCmdStatusBadge.style.color = 'var(--accent-primary)';
    }

    try {
      const res = await api.execCommand(cmd, currentWorkspaceDir, true);
      const outcome = res.status === 'passed' ? 'PASSED (Exit 0)' : `FAILED (Exit ${res.exitCode})`;
      if (studioTerminalOutput) {
        studioTerminalOutput.textContent += `\n${res.stdout || ''}${res.stderr ? '\n[stderr]: ' + res.stderr : ''}\n---\nCompleted in ${res.durationMs}ms · Status: ${outcome}\n`;
      }

      if (studioCmdStatusBadge) {
        studioCmdStatusBadge.textContent = res.status === 'passed' ? 'Passed' : 'Failed';
        studioCmdStatusBadge.style.background = res.status === 'passed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        studioCmdStatusBadge.style.color = res.status === 'passed' ? 'var(--accent-success)' : 'var(--accent-danger)';
      }
    } catch (err) {
      if (studioTerminalOutput) studioTerminalOutput.textContent += `\n[Execution Error]: ${err.message}\n`;
      if (studioCmdStatusBadge) {
        studioCmdStatusBadge.textContent = 'Error';
        studioCmdStatusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
        studioCmdStatusBadge.style.color = 'var(--accent-danger)';
      }
    } finally {
      if (btnStudioRunCmd) btnStudioRunCmd.disabled = false;
      if (btnStudioCancelCmd) btnStudioCancelCmd.style.display = 'none';
      if (studioTerminalOutput) studioTerminalOutput.scrollTop = studioTerminalOutput.scrollHeight;
    }
  }

  if (btnStudioRunCmd) {
    btnStudioRunCmd.addEventListener('click', () => {
      if (studioCmdInput) runStudioCommand(studioCmdInput.value.trim());
    });
  }

  if (studioCmdInput) {
    studioCmdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        runStudioCommand(studioCmdInput.value.trim());
      }
    });
  }

  if (btnStudioCancelCmd) {
    btnStudioCancelCmd.addEventListener('click', async () => {
      await api.cancelCommand();
      if (studioTerminalOutput) studioTerminalOutput.textContent += '\n[Command cancelled by user.]\n';
    });
  }

  if (btnQuickTest) {
    btnQuickTest.addEventListener('click', () => runStudioCommand('npm test'));
  }
  if (btnQuickLint) {
    btnQuickLint.addEventListener('click', () => runStudioCommand('npm run lint'));
  }
  if (btnQuickGit) {
    btnQuickGit.addEventListener('click', () => runStudioCommand('git status'));
  }

  // ================= 07: MODEL MANAGER SCREEN =================
  const modelsCardsGrid = document.getElementById('models-cards-grid');
  const modelsHwDetails = document.getElementById('models-hw-details');
  const modelsStoragePath = document.getElementById('models-storage-path');
  const modelsStorageFree = document.getElementById('models-storage-free');
  const btnModelsChangeStorage = document.getElementById('btn-models-change-storage');
  const modelsCustomRepoInput = document.getElementById('models-custom-repo-input');
  const btnModelsAddRepo = document.getElementById('btn-models-add-repo');
  const modelsQueuePanel = document.getElementById('models-queue-panel');
  const modelsQueueList = document.getElementById('models-queue-list');
  const btnModelsDiscover = document.getElementById('btn-models-discover');

  const btnModelsImportLocal = document.getElementById('btn-models-import-local');
  const modelsDetectedBanner = document.getElementById('models-detected-banner');
  const detectedBannerTitle = document.getElementById('detected-banner-title');
  const detectedBannerDesc = document.getElementById('detected-banner-desc');
  const detectedBannerActions = document.getElementById('detected-banner-actions');

  // Real-time lifecycle event listener
  api.onModelLifecycleChange(() => {
    refreshModelsView();
  });

  api.onDownloadProgress((p) => {
    const fill = document.getElementById(`model-dl-fill-${p.filename}`) || document.getElementById(`model-dl-fill-${p.modelId}`);
    const stats = document.getElementById(`model-dl-stats-${p.filename}`) || document.getElementById(`model-dl-stats-${p.modelId}`);
    const dlBox = document.getElementById(`dl-box-${p.modelId}`);
    if (dlBox) dlBox.style.display = 'block';

    if (fill && stats) {
      if (!p.totalBytes || p.totalBytes <= 0) {
        fill.classList.add('indeterminate-bar');
        fill.style.width = '100%';
        const mbDl = (p.bytesDownloaded / 1024 / 1024).toFixed(1);
        const spd = (p.speedBytesPerSec / 1024 / 1024).toFixed(2);
        stats.textContent = `Determining file size... (${mbDl} MB downloaded) · ${spd} MB/s`;
      } else {
        fill.classList.remove('indeterminate-bar');
        fill.style.width = `${p.progressPercent}%`;
        const mbDl = (p.bytesDownloaded / 1024 / 1024).toFixed(1);
        const mbTot = (p.totalBytes / 1024 / 1024).toFixed(1);
        const spd = (p.speedBytesPerSec / 1024 / 1024).toFixed(2);
        stats.textContent = `${p.progressPercent}% (${mbDl} / ${mbTot} MB) · ${spd} MB/s · ETA ${p.etaSeconds}s`;
      }
    }
    refreshDownloadQueueView();
    refreshNetworkStatus();
  });

  if (btnModelsImportLocal) {
    btnModelsImportLocal.addEventListener('click', async () => {
      const picked = await api.pickFile([
        { name: 'GGUF Models (*.gguf)', extensions: ['gguf'] },
        { name: 'All Files', extensions: ['*'] }
      ]);
      if (picked) {
        openModelInspectModal(picked);
      }
    });
  }


  btnModelsChangeStorage.addEventListener('click', async () => {
    const picked = await api.pickFolder();
    if (picked) {
      const ok = confirm(`Migrate model storage directory to:\n${picked}\n\nExisting installed models will be relocated safely.`);
      if (ok) {
        await api.changeModelStorageDir(picked);
        alert('Model storage directory updated.');
        refreshModelsView();
      }
    }
  });

  btnModelsAddRepo.addEventListener('click', async () => {
    const repo = modelsCustomRepoInput.value.trim();
    if (!repo) return;

    btnModelsAddRepo.disabled = true;
    btnModelsAddRepo.textContent = 'Validating...';

    try {
      const discovered = await api.addCustomModelRepo(repo);
      alert(`Successfully added ${repo} to catalog! Found ${discovered.totalVariants} GGUF variants.`);
      modelsCustomRepoInput.value = '';
      refreshModelsView();
    } catch (e) {
      alert(`Repository discovery error: ${e.message}`);
    } finally {
      btnModelsAddRepo.disabled = false;
      btnModelsAddRepo.textContent = 'Discover & Add to Catalog';
    }
  });

  btnModelsDiscover.addEventListener('click', async () => {
    btnModelsDiscover.disabled = true;
    btnModelsDiscover.textContent = 'Refreshing...';
    try {
      const data = await api.discoverModel('Qwen/Qwen2.5-Coder-7B-Instruct-GGUF');
      alert(`Discovered ${data.totalVariants} compatible GGUF variants from official repository.\nCommit: ${data.sha ? data.sha.slice(0, 8) : 'main'}\nRecommended: Q4_K_M (~4.68 GB).`);
      refreshModelsView();
    } catch (e) {
      alert(`Discovery error: ${e.message}`);
    } finally {
      btnModelsDiscover.disabled = false;
      btnModelsDiscover.textContent = 'Refresh Qwen Repository';
    }
  });

  async function refreshDownloadQueueView() {
    const queue = await api.getDownloadQueue();
    if (queue.length === 0) {
      modelsQueuePanel.style.display = 'none';
      return;
    }

    modelsQueuePanel.style.display = 'block';
    modelsQueueList.innerHTML = queue.map(q => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--bg-card); border-radius: var(--radius-sm); font-size: 12px;">
        <div>
          <strong>${escapeHtml(q.filename)}</strong>
          <span style="font-size: 11px; color: var(--text-muted); margin-left: 8px;">Status: ${q.status}</span>
        </div>
        <div style="display: flex; gap: 6px;">
          ${q.status === 'downloading' ? `
            <button class="btn btn-sm" onclick="triggerPauseDl('${escapeHtml(q.filename)}')">Pause</button>
            <button class="btn btn-sm btn-danger" onclick="triggerCancelDl('${escapeHtml(q.filename)}')">Cancel</button>
          ` : (q.status === 'paused' || q.status === 'failed') ? `
            <button class="btn btn-sm btn-primary" onclick="triggerRetryDl('${escapeHtml(q.filename)}')">Resume</button>
            <button class="btn btn-sm btn-danger" onclick="triggerCancelDl('${escapeHtml(q.filename)}')">Remove</button>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  async function refreshModelsView() {
    const specs = await api.getHardwareSpecs();
    if (specs) {
      modelsHwDetails.innerHTML = `
        Processor: <strong>${specs.cpu.model}</strong> (${specs.cpu.logicalCores} threads, AVX2 enabled)<br>
        Memory: <strong>${specs.memory.freeGB} GB</strong> Free of <strong>${specs.memory.totalGB} GB</strong> | Free Disk: <strong>${specs.storage.freeDiskGB} GB</strong><br>
        GPU: <strong>${specs.gpu.name}</strong> (${specs.gpu.accelerationStatus})
      `;
      modelsStorageFree.textContent = `Available Disk: ${specs.storage.freeDiskGB} GB Free`;
    }

    const settings = await api.getSettings();
    if (settings && settings.storage && settings.storage.modelsDir) {
      modelsStoragePath.textContent = settings.storage.modelsDir;
    }

    await refreshDownloadQueueView();

    // Check for detected workspace models (e.g. Qwen3-8B-Q4_K_M.gguf)
    if (modelsDetectedBanner) {
      try {
        const detected = await api.detectWorkspaceModels();
        const unreg = detected.filter(d => d.validHeader && !d.isRegistered);
        const registeredQwen3 = detected.find(d => d.validHeader && d.isQwen3 && d.isRegistered);

        if (unreg.length > 0) {
          modelsDetectedBanner.style.display = 'block';
          const target = unreg[0];
          detectedBannerTitle.innerHTML = `✨ Detected Local Model: <strong>${escapeHtml(target.filename)}</strong> (${target.sizeGB} GB, ${target.tensorCount} tensors)`;
          detectedBannerDesc.textContent = `Found in workspace. Integrate and activate offline without downloading.`;
          detectedBannerActions.innerHTML = `
            <button class="btn btn-sm btn-primary" onclick="triggerImportDetected('${escapeHtml(target.filePath.replace(/\\/g, '\\\\'))}', '${target.matchedModelId}')">⚡ Integrate & Activate</button>
          `;
        } else if (registeredQwen3) {
          modelsDetectedBanner.style.display = 'block';
          const isLoaded = activeModel && activeModel.modelId === 'qwen3-8b';
          detectedBannerTitle.innerHTML = `🚀 Registered Workspace Model: <strong>Qwen3-8B (Q4_K_M)</strong> (${registeredQwen3.sizeGB} GB)`;
          detectedBannerDesc.textContent = isLoaded
            ? 'Loaded in RAM via node-llama-cpp (ChatML reasoning active).'
            : 'Integrity verified and registered in ASTRO. Click below to load into memory.';
          detectedBannerActions.innerHTML = isLoaded
            ? `<span class="status-badge" style="background: var(--accent-success); color: #fff;">● In Memory (Ready)</span>
               <button class="btn btn-sm btn-danger" onclick="triggerUnloadModel()">Unload</button>`
            : `<button class="btn btn-sm btn-primary" onclick="triggerLoadModel('qwen3-8b', '${escapeHtml(registeredQwen3.filePath.replace(/\\/g, '\\\\'))}')">⚡ Load Qwen3-8B</button>`;
        } else {
          modelsDetectedBanner.style.display = 'none';
        }
      } catch (e) {
        modelsDetectedBanner.style.display = 'none';
      }
    }

    const catalog = await api.getCatalog();
    const registry = await api.getModelRegistry();
    const registryMap = new Map((registry || []).map(r => [r.modelId, r]));
    const queue = await api.getDownloadQueue();
    const activeDlMap = new Map();
    queue.forEach(q => {
      if (q.status === 'downloading' || q.status === 'connecting' || q.status === 'verifying') {
        activeDlMap.set(q.filename, q);
        if (q.modelId) activeDlMap.set(q.modelId, q);
      }
    });

    modelsCardsGrid.innerHTML = '';

    for (const m of catalog.models) {
      const regEntry = registryMap.get(m.id);
      const isInstalled = Boolean(regEntry || m.installed);
      const isLoaded = activeModel && activeModel.modelId === m.id;
      const lifecycle = await api.getModelState(m.id);
      const activeDl = activeDlMap.get(m.id) || (m.quantizations || []).map(q => activeDlMap.get(q.filename)).find(Boolean);

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div class="card-title">${escapeHtml(m.name)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(m.repoId)} · ${m.license}</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            <span class="status-badge" style="font-size: 10px;">${isInstalled ? (isLoaded ? 'Loaded (Ready)' : 'Installed') : (activeDl ? 'Downloading' : 'Available')}</span>
            <span style="font-size: 10px; color: var(--text-muted);">State: ${activeDl ? activeDl.status : lifecycle.state}</span>
          </div>
        </div>
        <p class="card-desc" style="margin-top: 6px;">${escapeHtml(m.description)}</p>

        ${regEntry ? `
          <div style="margin-top: 8px; padding: 8px; background: var(--bg-card); border-radius: var(--radius-sm); font-size: 11px; color: var(--text-secondary); line-height: 1.4;">
            Active Variant: <strong>${regEntry.quantization}</strong> (${(regEntry.actualSizeBytes / (1024 ** 3)).toFixed(2)} GB)<br>
            Architecture: <strong>${escapeHtml(regEntry.architecture || 'GGUF')}</strong> · Storage: <span class="status-badge" style="font-size: 10px;">${regEntry.storageType === 'external' ? 'External' : 'Managed'}</span><br>
            Installed Path: <span style="font-family: var(--font-mono); font-size: 10px; word-break: break-all;">${escapeHtml(regEntry.filePath)}</span>
            <div style="display: flex; gap: 6px; margin-top: 6px;">
              <button class="btn btn-sm" style="font-size: 10px; padding: 2px 6px;" onclick="window.triggerRepairModelPath('${m.id}')">🔄 Repair Path</button>
              <button class="btn btn-sm" style="font-size: 10px; padding: 2px 6px;" onclick="window.triggerUnregisterModel('${m.id}')" title="Deregister model without deleting the physical file">Deregister</button>
            </div>
          </div>
        ` : ''}

        <table class="data-table" style="margin-top: 10px;">
          <thead>
            <tr>
              <th>Quantization</th>
              <th>Disk Required</th>
              <th>Est. RAM Footprint</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${(m.quantizations || []).map(q => {
              const isItemDownloading = activeDlMap.has(q.filename);
              const estRamGB = (q.approxSizeGB + 0.9).toFixed(1);
              return `
                <tr>
                  <td><strong>${q.tag}</strong> ${q.recommended ? '<span style="color: var(--accent-primary); font-size: 10px;">(Recommended)</span>' : ''}</td>
                  <td>~${q.approxSizeGB} GB <span style="font-size: 10px; color: var(--text-muted);">(+5GB margin)</span></td>
                  <td>~${estRamGB} GB <span style="font-size: 10px; color: var(--text-muted);">(Weights + KV)</span></td>
                  <td>
                    ${isInstalled ? `
                      ${isLoaded ? `
                        <button class="btn btn-sm btn-danger" onclick="triggerUnloadModel()">Unload</button>
                      ` : `
                        <div style="display: flex; gap: 4px;">
                          <button class="btn btn-sm btn-primary" onclick="window.confirmModelSwitch('${m.id}', '${regEntry ? regEntry.filePath.replace(/\\/g, '\\\\') : (m.localPath || '').replace(/\\/g, '\\\\')}')">Switch & Load</button>
                          <button class="btn btn-sm btn-danger" onclick="triggerDeleteModel('${m.id}')" title="Delete Model File">Delete File</button>
                        </div>
                      `}
                    ` : `
                      <button class="btn btn-sm btn-primary" id="btn-dl-${q.filename}" ${isItemDownloading ? 'disabled' : ''} onclick="triggerDownloadModel('${m.id}', '${q.tag}', '${q.filename}', ${Math.round(q.approxSizeGB * 1024 ** 3)}, '${m.repoId}')">
                        ${isItemDownloading ? `⏳ In Progress (${activeDl ? (activeDl.progressPercent || 0) : 0}%)` : 'Download'}
                      </button>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div id="dl-box-${m.id}" style="display: ${activeDl ? 'block' : 'none'}; margin-top: 10px; padding: 10px; background: var(--bg-card); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="display: flex; justify-content: space-between; font-size: 11.5px;">
            <span id="dl-title-${m.id}">
              ${activeDl ? (activeDl.status === 'connecting' ? 'Connecting to repository...' : (activeDl.status === 'verifying' ? 'Verifying file integrity...' : (activeDl.status === 'completed' ? 'Download complete!' : `Downloading ${activeDl.filename} (${activeDl.progressPercent || 0}%)`))) : 'Downloading...'}
            </span>
            <button class="btn btn-sm btn-danger" onclick="triggerCancelDl('${activeDl ? activeDl.filename : m.id}')">Cancel</button>
          </div>
          <div style="height: 6px; background: var(--bg-input); border-radius: 3px; overflow: hidden; margin: 6px 0;">
            <div id="model-dl-fill-${m.id}" class="${(activeDl && (!activeDl.totalBytes || activeDl.totalBytes <= 0)) ? 'indeterminate-bar' : ''}" style="height: 100%; width: ${activeDl ? (activeDl.progressPercent || 0) : 0}%; background: var(--accent-primary);"></div>
          </div>
          <div id="model-dl-stats-${m.id}" style="font-size: 11px; color: var(--text-muted);">
            ${activeDl ? `${activeDl.progressPercent || 0}% · ${(activeDl.bytesDownloaded ? (activeDl.bytesDownloaded / 1024 / 1024).toFixed(1) : '0')} MB / ${(activeDl.totalBytes ? (activeDl.totalBytes / 1024 / 1024).toFixed(1) : '?')} MB` : 'Starting...'}
          </div>
        </div>
      `;
      modelsCardsGrid.appendChild(card);
    }
  }

  window.triggerDownloadModel = async (modelId, quantTag, filename, approxBytes, repoId) => {
    // Preflight hardware check (Memory & Disk Suitability - Phase 28)
    if (api.checkModelPreflight) {
      try {
        const preflight = await api.checkModelPreflight({
          modelId,
          expectedSizeBytes: approxBytes,
          fileSizeGB: approxBytes / (1024 ** 3)
        });
        if (preflight && preflight.severity === 'critical_insufficient') {
          const ok = confirm(
            `[HARDWARE SAFEGUARD WARNING]\n\n` +
            `${preflight.message}\n` +
            `Estimated RAM: ~${preflight.estimatedTotalRamGB || preflight.estimatedRamGB} GB (Free: ${preflight.freeRamGB} GB)\n` +
            `Required Disk: ${preflight.requiredDiskGB} GB (Free: ${preflight.freeDiskGB} GB)\n\n` +
            `Recommended Action: ${preflight.recommendedAction}\n\n` +
            `Do you want to proceed with downloading anyway?`
          );
          if (!ok) return;
        } else if (preflight && preflight.severity === 'warning_disk') {
          alert(`[INSUFFICIENT DISK SPACE]\n\n${preflight.message}\nRequired: ${preflight.requiredDiskGB} GB | Available: ${preflight.freeDiskGB} GB.\n\nPlease free up disk space before downloading.`);
          return;
        }
      } catch (err) {
        console.warn('Download preflight check warning:', err);
      }
    }

    const url = `https://huggingface.co/${repoId || 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF'}/resolve/main/${filename}`;
    const dlBox = document.getElementById(`dl-box-${modelId}`);
    const dlTitle = document.getElementById(`dl-title-${modelId}`);
    const dlFill = document.getElementById(`model-dl-fill-${modelId}`);
    const dlStats = document.getElementById(`model-dl-stats-${modelId}`);
    const dlBtn = document.getElementById(`btn-dl-${filename}`);

    if (dlBox) dlBox.style.display = 'block';
    if (dlTitle) dlTitle.textContent = `Connecting to ${filename}...`;
    if (dlFill) {
      dlFill.classList.add('indeterminate-bar');
      dlFill.style.width = '100%';
    }
    if (dlStats) dlStats.textContent = 'Contacting model repository...';
    if (dlBtn) {
      dlBtn.disabled = true;
      dlBtn.textContent = '⏳ In Progress';
    }

    try {
      const res = await api.downloadModel({
        url,
        filename,
        expectedSizeBytes: approxBytes,
        modelId,
        variantTag: quantTag
      });

      if (res && res.alreadyActive) {
        showToast(`Download is already running for ${filename}. Showing live progress.`, 'info');
        return;
      }

      if (dlTitle) dlTitle.textContent = 'Verifying file integrity...';
      if (dlStats) dlStats.textContent = 'Checking magic GGUF header and file size...';

      const verifiedBytes = (res && res.totalBytes && res.totalBytes > 0) ? res.totalBytes : approxBytes;

      if (dlTitle) dlTitle.textContent = `Registering ${modelId} (${quantTag})...`;
      if (dlStats) dlStats.textContent = 'Finalizing model catalog and persistent registry...';

      await api.installModel({
        modelId,
        variantTag: quantTag,
        filename,
        partialFilePath: res.partialPath,
        expectedSizeBytes: verifiedBytes,
        repoId
      });

      showToast(`Model ${modelId} (${quantTag}) successfully downloaded, verified, and installed!`, 'success');
      refreshModelsView();
      refreshNetworkStatus();
    } catch (e) {
      if (e.message && e.message.includes('cancelled')) {
        showToast(`Download cancelled: ${filename}`, 'warning');
      } else {
        alert(`Download/Installation error: ${e.message}`);
      }
    } finally {
      if (dlBox) dlBox.style.display = 'none';
      refreshModelsView();
      refreshNetworkStatus();
    }
  };

  window.triggerLoadModel = async (modelId, pathStr) => {
    try {
      const options = {};
      if (api.checkModelPreflight && pathStr) {
        try {
          const preflight = await api.checkModelPreflight({ modelId, filePath: pathStr });
          if (preflight && preflight.severity === 'critical_insufficient') {
            const altText = (preflight.safeAlternatives || []).map(a => `  • ${a.label}`).join('\n');
            const confirmed = confirm(
              `[CRITICAL MEMORY RISK]\n\n` +
              `${preflight.message}\n\n` +
              `Recommended Action: ${preflight.recommendedAction}\n\n` +
              (altText ? `Safe Alternatives:\n${altText}\n\n` : '') +
              `Do you want to override this safeguard and attempt to load anyway?`
            );
            if (!confirmed) return;
            options.overrideMemorySafety = true;
          } else if (preflight && preflight.severity === 'warning_paging') {
            const confirmed = confirm(
              `[MEMORY PAGING WARNING]\n\n` +
              `${preflight.message}\n\n` +
              `Recommended Action: ${preflight.recommendedAction}\n\n` +
              `Do you want to proceed?`
            );
            if (!confirmed) return;
          }
        } catch (err) {
          console.warn('Preflight check error:', err);
        }
      }

      // Visual loading state
      const topbarModelText = document.getElementById('topbar-model-text');
      const topbarModelDot = document.getElementById('topbar-model-dot');
      const chatActivePill = document.getElementById('chat-active-model-pill');

      if (topbarModelText) topbarModelText.textContent = `⏳ Loading ${modelId}...`;
      if (topbarModelDot) topbarModelDot.className = 'dot';
      if (chatActivePill) {
        chatActivePill.textContent = `⏳ Loading ${modelId}...`;
        chatActivePill.style.color = 'var(--accent-warning)';
      }
      showToast(`Allocating memory and initializing ${modelId} in RAM...`, 'info');

      activeModel = await api.loadModel(modelId, pathStr, options);
      await refreshActiveModel();
      refreshModelsView();
      showToast(`Model ${modelId} loaded into memory! Ready for local inference in AI Chat.`, 'success');
    } catch (e) {
      showToast(`Failed to load model: ${e.message}`, 'danger');
      await refreshActiveModel();
      refreshModelsView();
    }
  };

  window.triggerUnloadModel = async () => {
    await api.unloadModel();
    activeModel = null;
    await refreshActiveModel();
    refreshModelsView();
  };

  window.triggerDeleteModel = async (modelId) => {
    const ok = confirm(`Delete model "${modelId}" permanently from local storage? Downloaded model files will be removed.`);
    if (ok) {
      await api.uninstallModel(modelId);
      alert(`Model ${modelId} deleted.`);
      refreshModelsView();
    }
  };

  window.triggerPauseDl = async (filename) => {
    await api.pauseDownload(filename);
    refreshModelsView();
  };

  window.triggerCancelDl = async (filename) => {
    await api.cancelDownload(filename);
    refreshModelsView();
  };

  window.triggerRetryDl = async (filename) => {
    await api.retryDownload(filename);
    refreshModelsView();
  };

  window.triggerImportDetected = async (filePath, modelId) => {
    try {
      await api.importLocalModel({
        sourcePath: filePath,
        modelId: modelId || 'qwen3-8b',
        displayName: 'Qwen3-8B',
        variantTag: 'Q4_K_M',
        copyToManagedDir: false
      });
      alert('Qwen3-8B successfully integrated and registered in ASTRO!');
      refreshModelsView();
    } catch (e) {
      alert('Import failed: ' + e.message);
    }
  };

  // ================= 08: VOICE SCREEN =================
  const voiceMicCircle = document.getElementById('voice-mic-circle');
  const voiceStatusHeading = document.getElementById('voice-status-heading');
  const voiceMissingText = document.getElementById('voice-missing-text');
  const voiceTtsPref = document.getElementById('voice-tts-pref');
  const voiceSelectEngine = document.getElementById('voice-select-engine');
  const voiceRateSlider = document.getElementById('voice-rate-slider');
  const voiceRateVal = document.getElementById('voice-rate-val');
  const btnVoiceTestTts = document.getElementById('btn-voice-test-tts');
  const btnVoiceTestMic = document.getElementById('btn-voice-test-mic');
  const voiceAudioLevel = document.getElementById('voice-audio-level');
  const voiceWakePref = document.getElementById('voice-wake-pref');
  const voiceAllowedAppsList = document.getElementById('voice-allowed-apps-list');

  let audioTestStream = null;
  let audioContextInstance = null;

  function populateVoiceList() {
    if (!window.speechSynthesis || !voiceSelectEngine) return;
    const voices = window.speechSynthesis.getVoices();
    voiceSelectEngine.innerHTML = '<option value="default">Default OS Voice</option>';
    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      voiceSelectEngine.appendChild(opt);
    });
  }

  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = populateVoiceList;
    populateVoiceList();
  }

  async function refreshVoiceView() {
    const status = await api.getVoiceStatus();
    if (voiceTtsPref) voiceTtsPref.checked = status.ttsEnabled;
    if (voiceWakePref) voiceWakePref.checked = Boolean(status.wakeWordEnabled);
    if (voiceRateSlider && status.speechRate) {
      voiceRateSlider.value = status.speechRate;
      if (voiceRateVal) voiceRateVal.textContent = status.speechRate + 'x';
    }

    if (!status.sttAvailable) {
      voiceStatusHeading.textContent = 'Voice Recognition Offline';
      voiceMissingText.innerHTML = `
        ${status.missingComponents.join('<br>')}<br>
        <em>${status.recommendation}</em>
      `;
      voiceMicCircle.classList.remove('listening');
    } else {
      voiceStatusHeading.textContent = status.isListening ? 'Listening...' : 'Microphone Ready';
      voiceMissingText.innerHTML = '● Local speech recognition engine is configured and ready.';
    }

    // Populate allowed applications
    if (voiceAllowedAppsList) {
      const apps = await api.getAllowedApps();
      voiceAllowedAppsList.innerHTML = apps.map(app => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--bg-panel); border: 1px solid var(--border-subtle); border-radius: 4px;">
          <div>
            <strong>${escapeHtml(app.name)}</strong> <span style="color: var(--text-muted); font-size: 11px;">(${escapeHtml(app.executable)})</span>
            <div style="color: var(--text-secondary); font-size: 11px;">${escapeHtml(app.description)}</div>
          </div>
          <span class="status-badge" style="background: rgba(16, 185, 129, 0.15); color: var(--accent-success); font-size: 10px;">Allowed</span>
        </div>
      `).join('');
    }
  }

  voiceMicCircle.addEventListener('click', async () => {
    try {
      const status = await api.getVoiceStatus();
      if (!status.sttAvailable) {
        alert(status.recommendation);
        return;
      }
      if (status.isListening) {
        await api.stopListening();
      } else {
        await api.startListening();
      }
      refreshVoiceView();
    } catch (e) {
      alert(e.message);
    }
  });

  if (voiceTtsPref) {
    voiceTtsPref.addEventListener('change', async () => {
      await api.setTTSPreference(voiceTtsPref.checked);
    });
  }

  if (voiceRateSlider) {
    voiceRateSlider.addEventListener('input', async () => {
      if (voiceRateVal) voiceRateVal.textContent = voiceRateSlider.value + 'x';
      await api.updateVoiceSettings({ speechRate: parseFloat(voiceRateSlider.value) });
    });
  }

  if (voiceWakePref) {
    voiceWakePref.addEventListener('change', async () => {
      await api.updateVoiceSettings({ wakeWordEnabled: voiceWakePref.checked });
    });
  }

  if (btnVoiceTestTts) {
    btnVoiceTestTts.addEventListener('click', () => {
      speakResponseAloud('Hello! I am ASTRO, your private offline assistant running locally on your laptop.');
    });
  }

  if (btnVoiceTestMic) {
    btnVoiceTestMic.addEventListener('click', async () => {
      if (audioTestStream) {
        audioTestStream.getTracks().forEach(t => t.stop());
        audioTestStream = null;
        if (voiceAudioLevel) voiceAudioLevel.style.width = '0%';
        btnVoiceTestMic.textContent = 'Test Mic';
        return;
      }

      try {
        audioTestStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        btnVoiceTestMic.textContent = 'Stop Test';

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextInstance = new AudioContext();
        const source = audioContextInstance.createMediaStreamSource(audioTestStream);
        const analyser = audioContextInstance.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (!audioTestStream) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const pct = Math.min(100, Math.round((avg / 128) * 100));
          if (voiceAudioLevel) voiceAudioLevel.style.width = `${pct}%`;
          requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch (err) {
        alert('Microphone Access Notice: ' + err.message);
      }
    });
  }

  // ================= 09: ACTIVITY SCREEN =================
  const activityTasksContainer = document.getElementById('activity-tasks-container');
  const btnActivityClear = document.getElementById('btn-activity-clear');
  const btnActivityClearAll = document.getElementById('btn-activity-clear-all');

  btnActivityClear.addEventListener('click', async () => {
    await api.clearCompletedActivities();
    refreshActivityView();
  });

  if (btnActivityClearAll) {
    btnActivityClearAll.addEventListener('click', async () => {
      if (confirm('Clear all task and desktop action history?')) {
        await api.clearAllActivities();
        refreshActivityView();
      }
    });
  }

  async function refreshActivityView() {
    const tasks = await api.getActivityTasks();
    renderActivityTasks(tasks);
  }

  function renderActivityTasks(tasks) {
    activityTasksContainer.innerHTML = '';
    if (tasks.length === 0) {
      activityTasksContainer.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); padding: 16px; text-align: center;">No background activities recorded.</div>';
      return;
    }

    tasks.forEach(t => {
      const item = document.createElement('div');
      item.className = 'activity-item';
      const statusColor = t.status === 'completed' ? 'var(--accent-success)' : (t.status === 'failed' ? 'var(--accent-danger)' : 'var(--accent-primary)');
      const elapsedSec = t.endTime ? ((t.endTime - t.startTime) / 1000).toFixed(1) + 's' : ((Date.now() - t.startTime) / 1000).toFixed(1) + 's';

      item.innerHTML = `
        <div>
          <strong>${escapeHtml(t.label)}</strong>
          <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(t.details || '')} · Elapsed: ${elapsedSec}</div>
        </div>
        <div style="text-align: right;">
          <span style="color: ${statusColor}; font-weight: 600; text-transform: capitalize;">● ${t.status}</span>
          ${t.progress ? `<div style="font-size: 11px; color: var(--text-muted);">${t.progress}%</div>` : ''}
        </div>
      `;
      activityTasksContainer.appendChild(item);
    });
  }

  // ================= 10: SETTINGS SCREEN =================
  const settingsTabs = document.querySelectorAll('.settings-tab');
  const settingsPanes = document.querySelectorAll('.settings-pane');
  const btnSettingsSave = document.getElementById('btn-settings-save');
  const settingThemeSelect = document.getElementById('setting-theme-select');
  const settingSidebarCollapse = document.getElementById('setting-sidebar-collapse');
  const settingWelcomeStartup = document.getElementById('setting-welcome-startup');
  const settingPrivacyOffline = document.getElementById('setting-privacy-offline');
  const settingPrivacyExternal = document.getElementById('setting-privacy-external');
  const btnPrivacyDeleteData = document.getElementById('btn-privacy-delete-data');
  const settingDefaultModel = document.getElementById('setting-default-model');
  const settingCpuThreads = document.getElementById('setting-cpu-threads');
  const settingContextWindow = document.getElementById('setting-context-window');
  const settingPermCmd = document.getElementById('setting-perm-cmd');
  const settingPermWrite = document.getElementById('setting-perm-write');
  const settingsDiagOutput = document.getElementById('settings-diag-output');

  settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      settingsTabs.forEach(t => t.classList.remove('active'));
      settingsPanes.forEach(p => p.style.display = 'none');

      tab.classList.add('active');
      const targetPane = document.getElementById(tab.getAttribute('data-tab'));
      if (targetPane) targetPane.style.display = 'block';
    });
  });

  async function refreshSettingsView() {
    currentSettings = await api.getSettings();
    if (!currentSettings) return;

    settingThemeSelect.value = currentSettings.appearance.theme || 'dark';
    settingSidebarCollapse.checked = currentSettings.appearance.sidebarCollapsed || false;
    if (settingWelcomeStartup) {
      settingWelcomeStartup.checked = currentSettings.appearance.showWelcomeOnStartup !== false;
    }
    settingPrivacyOffline.checked = currentSettings.privacy.offlineOnly;
    settingPrivacyExternal.checked = currentSettings.privacy.allowExternalServices;
    settingDefaultModel.value = currentSettings.inference.defaultModelId;
    settingCpuThreads.value = currentSettings.inference.cpuThreads;
    settingContextWindow.value = currentSettings.inference.contextWindow;
    settingPermCmd.checked = currentSettings.security.requireApprovalForCommands;
    settingPermWrite.checked = currentSettings.security.requireApprovalForFileEdits;

    const specs = await api.getHardwareSpecs();
    settingsDiagOutput.textContent = `
ASTRO Desktop Assistant v0.1.0 Diagnostics
------------------------------------------
Operating System : ${specs.os.platform} (${specs.os.arch})
Processor Model  : ${specs.cpu.model} (${specs.cpu.logicalCores} threads)
AVX2 Instruction : Supported & Enabled (Native AMD Ryzen Zen architecture)
Total System RAM : ${specs.memory.totalGB} GB
Free System RAM  : ${specs.memory.freeGB} GB (${specs.memory.percentUsed}% in use)
Graphics Device  : ${specs.gpu.name} (${specs.gpu.accelerationStatus})
Storage Space    : ${specs.storage.freeDiskGB} GB Free on primary volume
Privacy State    : ${currentSettings.privacy.offlineOnly ? 'OFFLINE-FIRST ENFORCED' : 'Hybrid Enabled'}
External Access  : ${currentSettings.privacy.allowExternalServices ? 'Authorized' : 'Disabled'}
Active Model     : ${activeModel ? activeModel.modelId : 'None Loaded'}
    `.trim();
  }

  btnSettingsSave.addEventListener('click', async () => {
    const updated = {
      ...currentSettings,
      appearance: {
        theme: settingThemeSelect.value,
        sidebarCollapsed: settingSidebarCollapse.checked,
        showWelcomeOnStartup: settingWelcomeStartup ? settingWelcomeStartup.checked : true
      },
      privacy: {
        offlineOnly: settingPrivacyOffline.checked,
        allowExternalServices: settingPrivacyExternal.checked,
        telemetryEnabled: false,
        autoUpload: false
      },
      inference: {
        ...currentSettings.inference,
        defaultModelId: settingDefaultModel.value.trim(),
        cpuThreads: parseInt(settingCpuThreads.value, 10),
        contextWindow: parseInt(settingContextWindow.value, 10)
      },
      security: {
        ...currentSettings.security,
        requireApprovalForCommands: settingPermCmd.checked,
        requireApprovalForFileEdits: settingPermWrite.checked
      }
    };

    await api.saveSettings(updated);
    setTheme(updated.appearance.theme);
    if (updated.appearance.sidebarCollapsed) {
      sidebar.classList.add('collapsed');
    } else {
      sidebar.classList.remove('collapsed');
    }
    showToast('Settings saved and applied successfully.', 'success');
  });

  // Global keyboard accessibility: Escape closes open modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const inspectModal = document.getElementById('modal-model-inspect');
      const switcherModal = document.getElementById('modal-model-switcher');
      if (inspectModal && inspectModal.style.display === 'flex') {
        inspectModal.style.display = 'none';
      }
      if (switcherModal && switcherModal.style.display === 'flex') {
        switcherModal.style.display = 'none';
      }
    }
  });

  btnPrivacyDeleteData.addEventListener('click', async () => {
    if (confirm('Delete all local chat history permanently? This cannot be undone.')) {
      await api.clearAllUserData();
      showToast('Local conversation data deleted.', 'warning');
      refreshChatView();
    }
  });

  // Utility
  function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }

  window.openModelInspectModal = openModelInspectModal;
  window.openModelSwitcherModal = openModelSwitcherModal;
  window.navigateTo = navigateTo;
  window.formatMessageContent = formatMessageContent;

  // Run initial load
  initApp();
});
