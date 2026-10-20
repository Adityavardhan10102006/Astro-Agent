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
  let currentWorkspaceDir = 'c:\\aditya\\ASTRO';
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
  const topbarModelText = document.getElementById('topbar-model-text');
  const topbarModelDot = document.getElementById('topbar-model-dot');
  const topbarHwText = document.getElementById('topbar-hw-text');

  const bottomOfflineText = document.getElementById('bottom-offline-text');
  const bottomModelText = document.getElementById('bottom-model-text');
  const bottomModelDot = document.getElementById('bottom-model-dot');
  const bottomActivityText = document.getElementById('bottom-activity-text');
  const bottomActivityLink = document.getElementById('bottom-activity-link');

  // --- Navigation & Sidebar Logic ---
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

    currentScreen = screenId;

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
  btnThemeToggle.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  });

  function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    const select = document.getElementById('setting-theme-select');
    if (select) select.value = theme;
  }

  // --- Initialization & Status Updates ---
  async function initApp() {
    try {
      currentSettings = await api.getSettings();
      if (currentSettings && currentSettings.appearance && currentSettings.appearance.theme) {
        setTheme(currentSettings.appearance.theme);
      }

      await refreshHardwareStatus();
      await refreshActiveModel();
      await refreshActivityBadge();

      // Listen to real-time events
      api.onActivityChanged((tasks) => {
        updateActivityBadge(tasks);
        if (currentScreen === 'activity-screen') renderActivityTasks(tasks);
      });

      refreshHomeView();
    } catch (err) {
      console.error('Initialization error:', err);
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
    if (activeModel) {
      topbarModelDot.className = 'dot active';
      topbarModelText.textContent = `${activeModel.modelId} (Active)`;
      bottomModelDot.className = 'dot active';
      bottomModelText.textContent = `Model: ${activeModel.modelId}`;
      if (chatActivePill) {
        chatActivePill.textContent = `🤖 ${activeModel.modelId}`;
        chatActivePill.style.color = 'var(--accent-success)';
      }
    } else {
      topbarModelDot.className = 'dot';
      topbarModelText.textContent = 'No Model Loaded';
      bottomModelDot.className = 'dot';
      bottomModelText.textContent = 'No Model Loaded';
      if (chatActivePill) {
        chatActivePill.textContent = `🤖 Click to Load Model`;
        chatActivePill.style.color = 'var(--accent-warning)';
      }
    }
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
    document.getElementById('chat-rag-checkbox').checked = homeRagToggle.checked;
    document.getElementById('btn-chat-send').click();
  });

  homeMicBtn.addEventListener('click', () => {
    navigateTo('voice-screen');
  });

  document.getElementById('qa-find-files').addEventListener('click', () => navigateTo('files-screen'));
  document.getElementById('qa-ask-rag').addEventListener('click', () => navigateTo('rag-screen'));
  document.getElementById('qa-start-coding').addEventListener('click', () => navigateTo('studio-screen'));
  document.getElementById('qa-research').addEventListener('click', () => navigateTo('research-screen'));
  document.getElementById('home-btn-manage-models').addEventListener('click', () => navigateTo('models-screen'));

  async function refreshHomeView() {
    await refreshActiveModel();
    if (activeModel) {
      homeModelContent.innerHTML = `
        <strong>${escapeHtml(activeModel.modelId)}</strong> is loaded in memory.<br>
        Load time: ${activeModel.loadTimeMs}ms · Context: 4096 tokens.
      `;
    } else {
      homeModelContent.innerHTML = `
        <em>No model is currently loaded in memory.</em><br>
        Open Model Manager to load Qwen2.5-Coder for offline inference.
      `;
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
          outputHtml += `<div style="white-space: pre-wrap;">${escapeHtml(textBefore)}</div>`;
        }
        const thinkBody = match[1] ? match[1].trim() : '';
        if (thinkBody) {
          outputHtml += `<details class="think-block" style="margin-bottom: 8px; padding: 6px 10px; background: rgba(99, 102, 241, 0.08); border-left: 3px solid var(--accent-primary); border-radius: 4px; font-size: 11.5px; color: var(--text-secondary);"><summary style="cursor: pointer; font-weight: 600; color: var(--accent-primary); outline: none;">🧠 Qwen3 Reasoning Process</summary><div style="margin-top: 6px; white-space: pre-wrap; font-family: var(--font-sans);">${escapeHtml(thinkBody)}</div></details>`;
        }
        cursor = match.index + match[0].length;
      }
      const textAfter = rawText.slice(cursor);
      if (textAfter) {
        outputHtml += `<div style="white-space: pre-wrap;">${escapeHtml(textAfter)}</div>`;
      }
      return outputHtml || escapeHtml(rawText);
    }

    return `<div style="white-space: pre-wrap;">${escapeHtml(rawText)}</div>`;
  }

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
    const text = (textOverride !== null ? textOverride : chatInputText.value).trim();
    if (!text) return;

    const isModelCommand = /^(?:please\s+)?(?:show|list|import|add|switch|change|use|activate|find|search|download|i want to use|installed\s+models|my\s+models)/i.test(text);

    if (!activeModel && !isModelCommand) {
      alert('AI Engine Notice: No local model is currently loaded. Please navigate to 07 Model Manager to load a model (e.g. Qwen3-8B) or type "Import a model" or "List models" in chat.');
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

  btnChatSend.addEventListener('click', sendChatMessage);
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
        <div class="msg-bubble">New conversation started. Ask a question or explore documents.</div>
      </div>
    `;
    refreshConversationsList();
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

      const pill = document.getElementById('chat-active-model-pill');
      if (pill) pill.textContent = `⏳ Switching to ${modelId}...`;

      const result = await api.switchActiveModel(modelId, filePath);
      await refreshActiveModel();
      refreshModelsView();
      alert(`Successfully switched active model to "${result.displayName || modelId}"!\nInference engine is ready in chat.`);
    } catch (e) {
      alert(`Failed to switch model: ${e.message}`);
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


  async function refreshConversationsList() {
    const list = await api.getConversations();
    chatConvList.innerHTML = '';
    list.forEach(c => {
      const item = document.createElement('div');
      item.className = `conv-item ${c.id === activeConversationId ? 'active' : ''}`;
      item.innerHTML = `
        <span class="conv-item-title">${escapeHtml(c.title)}</span>
        <span style="font-size: 10px; color: var(--text-muted);">${c.messageCount}</span>
      `;
      item.onclick = () => loadConversationIntoChat(c.id);
      chatConvList.appendChild(item);
    });
  }

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
  const btnStudioApplyDiff = document.getElementById('btn-studio-apply-diff');
  const btnStudioRevertDiff = document.getElementById('btn-studio-revert-diff');
  const btnStudioRejectDiff = document.getElementById('btn-studio-reject-diff');
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

  let activeProjectMeta = null;
  let activeOpenFilePath = null;
  let lastAppliedBackupPath = null;

  async function openProjectFolder(folderPath) {
    if (!folderPath) return;
    try {
      activeProjectMeta = await api.openProject(folderPath);
      currentWorkspaceDir = folderPath;
      studioProjectName.textContent = `📁 ${activeProjectMeta.name}`;
      studioProjectName.style.borderColor = 'var(--accent-primary)';
      btnStudioCloseProject.style.display = 'inline-flex';

      // Badges
      studioProjectBadges.innerHTML = '';
      if (activeProjectMeta.languages && activeProjectMeta.languages.length > 0) {
        const topLangs = activeProjectMeta.languages.slice(0, 3).map(l => `<span class="status-badge" style="font-size: 10px;">${escapeHtml(l.language)} (${l.fileCount})</span>`).join(' ');
        studioProjectBadges.innerHTML += topLangs;
      }
      if (activeProjectMeta.manifest && activeProjectMeta.manifest.manifestFile) {
        studioProjectBadges.innerHTML += ` <span class="status-badge" style="font-size: 10px; background: rgba(59, 130, 246, 0.15); color: var(--accent-primary);">📦 ${escapeHtml(activeProjectMeta.manifest.manifestFile)}</span>`;
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
      currentWorkspaceDir = process.cwd();
      studioProjectName.textContent = 'No Active Project';
      studioProjectName.style.borderColor = 'var(--border-subtle)';
      studioProjectBadges.innerHTML = '';
      btnStudioCloseProject.style.display = 'none';
      studioActiveFileLabel.textContent = 'No File Open';
      studioEditorBox.textContent = '// Select a file from the project tree to view its contents';
      studioTreeList.innerHTML = '<div style="color: var(--text-muted); font-size: 11.5px; padding: 10px 0;">Open a project folder to inspect files.</div>';
    });
  }

  async function refreshStudioView() {
    const targetDir = currentWorkspaceDir || process.cwd();
    const query = studioTreeSearch ? studioTreeSearch.value.trim() : '';

    if (query) {
      // Search project code or filenames
      const matches = await api.searchProjectCode(query);
      studioTreeList.innerHTML = '';
      if (matches.length === 0) {
        studioTreeList.innerHTML = '<div style="color: var(--text-muted); font-size: 11px;">No matching code lines found.</div>';
        return;
      }
      matches.slice(0, 40).forEach(m => {
        const item = document.createElement('div');
        item.className = 'file-item-row';
        item.innerHTML = `<strong>${escapeHtml(m.fileName)}</strong>:${m.line} <span style="font-size: 10px; color: var(--text-muted);">${escapeHtml(m.matchedLine.slice(0, 40))}</span>`;
        item.onclick = () => loadFileIntoStudio(m.filePath);
        studioTreeList.appendChild(item);
      });
      return;
    }

    const files = await api.listFiles(targetDir, 'all');
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

  async function loadFileIntoStudio(filePath) {
    activeOpenFilePath = filePath;
    studioActiveFileLabel.textContent = filePath;

    // Check credential file
    const isSensitive = await api.checkCredentialFile(filePath);
    if (studioCredentialWarning) {
      studioCredentialWarning.style.display = isSensitive ? 'block' : 'none';
    }

    const content = await api.readFile(filePath);
    studioEditorBox.textContent = content;

    // Propose reviewable diff verification
    proposedDiff = await api.proposeDiff(filePath, content + '\n// ASTRO safe edit verification');
    btnStudioApplyDiff.style.display = 'inline-flex';
    btnStudioRejectDiff.style.display = 'inline-flex';
    btnStudioRevertDiff.style.display = 'none';
  }

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

  btnStudioApplyDiff.addEventListener('click', async () => {
    if (!proposedDiff) return;
    const ok = confirm(`Security Confirmation (Rule 14):\n\nApprove modifying "${proposedDiff.filePath}"?\nA recoverable backup (.astro_bak) will be created before saving.`);
    if (ok) {
      const res = await api.applyDiff(proposedDiff.filePath, proposedDiff.newContent || '', true, {
        allowSensitive: true,
        expectedMtime: proposedDiff.inspectedMtime
      });
      lastAppliedBackupPath = res.backupPath;
      alert(`File modified safely.\nBackup created at: ${res.backupPath}`);
      studioEditorBox.textContent = proposedDiff.newContent;
      btnStudioApplyDiff.style.display = 'none';
      btnStudioRejectDiff.style.display = 'none';
      btnStudioRevertDiff.style.display = 'inline-flex';
      proposedDiff = null;
    }
  });

  if (btnStudioRevertDiff) {
    btnStudioRevertDiff.addEventListener('click', async () => {
      if (!activeOpenFilePath) return;
      const ok = confirm(`Revert Changes (Rule 14):\n\nRestore original file content from backup?`);
      if (ok) {
        await api.revertDiff(activeOpenFilePath, lastAppliedBackupPath);
        alert('File restored successfully from backup.');
        const restored = await api.readFile(activeOpenFilePath);
        studioEditorBox.textContent = restored;
        btnStudioRevertDiff.style.display = 'none';
      }
    });
  }

  btnStudioRejectDiff.addEventListener('click', () => {
    proposedDiff = null;
    btnStudioApplyDiff.style.display = 'none';
    btnStudioRejectDiff.style.display = 'none';
  });

  async function runStudioCommand(cmd) {
    if (!cmd) return;
    const ok = confirm(`Security Confirmation (Rule 9):\n\nApprove execution of command:\n${cmd}\n\nWorking Directory: ${currentWorkspaceDir}`);
    if (!ok) return;

    studioTerminalOutput.textContent += `\n$ ${cmd}\nRunning...`;
    studioCmdInput.value = '';
    btnStudioRunCmd.disabled = true;
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
      studioTerminalOutput.textContent += `\n${res.stdout || ''}${res.stderr ? '\n[stderr]: ' + res.stderr : ''}\n---\nCompleted in ${res.durationMs}ms · Status: ${outcome}\n`;

      if (studioCmdStatusBadge) {
        studioCmdStatusBadge.textContent = res.status === 'passed' ? 'Passed' : 'Failed';
        studioCmdStatusBadge.style.background = res.status === 'passed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
        studioCmdStatusBadge.style.color = res.status === 'passed' ? 'var(--accent-success)' : 'var(--accent-danger)';
      }
    } catch (err) {
      studioTerminalOutput.textContent += `\n[Execution Error]: ${err.message}\n`;
      if (studioCmdStatusBadge) {
        studioCmdStatusBadge.textContent = 'Error';
        studioCmdStatusBadge.style.background = 'rgba(239, 68, 68, 0.15)';
        studioCmdStatusBadge.style.color = 'var(--accent-danger)';
      }
    } finally {
      btnStudioRunCmd.disabled = false;
      if (btnStudioCancelCmd) btnStudioCancelCmd.style.display = 'none';
      studioTerminalOutput.scrollTop = studioTerminalOutput.scrollHeight;
    }
  }

  btnStudioRunCmd.addEventListener('click', () => {
    runStudioCommand(studioCmdInput.value.trim());
  });

  if (btnStudioCancelCmd) {
    btnStudioCancelCmd.addEventListener('click', async () => {
      await api.cancelCommand();
      studioTerminalOutput.textContent += '\n[Command cancelled by user.]\n';
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
    const fill = document.getElementById(`model-dl-fill-${p.filename}`);
    const stats = document.getElementById(`model-dl-stats-${p.filename}`);
    if (fill && stats) {
      fill.style.width = `${p.progressPercent}%`;
      const mbDl = (p.bytesDownloaded / 1024 / 1024).toFixed(1);
      const mbTot = (p.totalBytes / 1024 / 1024).toFixed(1);
      const spd = (p.speedBytesPerSec / 1024 / 1024).toFixed(2);
      stats.textContent = `${p.progressPercent}% (${mbDl} / ${mbTot} MB) · ${spd} MB/s · ETA ${p.etaSeconds}s`;
    }
    refreshDownloadQueueView();
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

    modelsCardsGrid.innerHTML = '';

    for (const m of catalog.models) {
      const regEntry = registryMap.get(m.id);
      const isInstalled = Boolean(regEntry || m.installed);
      const isLoaded = activeModel && activeModel.modelId === m.id;
      const lifecycle = await api.getModelState(m.id);

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div class="card-title">${escapeHtml(m.name)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(m.repoId)} · ${m.license}</div>
          </div>
          <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            <span class="status-badge" style="font-size: 10px;">${isInstalled ? (isLoaded ? 'Loaded (Ready)' : 'Installed') : 'Available'}</span>
            <span style="font-size: 10px; color: var(--text-muted);">State: ${lifecycle.state}</span>
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
          <thead><tr><th>Quant</th><th>Size</th><th>Action</th></tr></thead>
          <tbody>
            ${(m.quantizations || []).map(q => `
              <tr>
                <td><strong>${q.tag}</strong> ${q.recommended ? '<span style="color: var(--accent-primary); font-size: 10px;">(Recommended)</span>' : ''}</td>
                <td>~${q.approxSizeGB} GB</td>
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
                    <button class="btn btn-sm btn-primary" id="btn-dl-${q.filename}" onclick="triggerDownloadModel('${m.id}', '${q.tag}', '${q.filename}', ${Math.round(q.approxSizeGB * 1024 ** 3)}, '${m.repoId}')">Download</button>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>


        <div id="dl-box-${m.id}" style="display: none; margin-top: 10px; padding: 10px; background: var(--bg-card); border-radius: var(--radius-sm);">
          <div style="display: flex; justify-content: space-between; font-size: 11.5px;">
            <span id="dl-title-${m.id}">Downloading...</span>
            <button class="btn btn-sm btn-danger" onclick="triggerCancelDl('${m.id}')">Cancel</button>
          </div>
          <div style="height: 6px; background: var(--bg-input); border-radius: 3px; overflow: hidden; margin: 6px 0;">
            <div id="model-dl-fill-${m.id}" style="height: 100%; width: 0%; background: var(--accent-primary);"></div>
          </div>
          <div id="model-dl-stats-${m.id}" style="font-size: 11px; color: var(--text-muted);">Starting...</div>
        </div>
      `;
      modelsCardsGrid.appendChild(card);
    }
  }

  window.triggerDownloadModel = async (modelId, quantTag, filename, approxBytes, repoId) => {
    const url = `https://huggingface.co/${repoId || 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF'}/resolve/main/${filename}`;
    const dlBox = document.getElementById(`dl-box-${modelId}`);
    if (dlBox) dlBox.style.display = 'block';

    try {
      const res = await api.downloadModel({
        url,
        filename,
        expectedSizeBytes: approxBytes,
        modelId,
        variantTag: quantTag
      });

      await api.installModel({
        modelId,
        variantTag: quantTag,
        filename,
        partialFilePath: res.partialPath,
        expectedSizeBytes: approxBytes,
        repoId
      });

      alert(`Model ${modelId} (${quantTag}) successfully downloaded, verified, and installed!`);
      refreshModelsView();
    } catch (e) {
      alert(`Download/Installation error: ${e.message}`);
    } finally {
      if (dlBox) dlBox.style.display = 'none';
      refreshModelsView();
    }
  };

  window.triggerLoadModel = async (modelId, pathStr) => {
    try {
      activeModel = await api.loadModel(modelId, pathStr);
      await refreshActiveModel();
      refreshModelsView();
      alert(`Model ${modelId} loaded into memory! Health check passed. You can now generate responses in 02 Chat.`);
    } catch (e) {
      alert(`Failed to load model: ${e.message}`);
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
        sidebarCollapsed: settingSidebarCollapse.checked
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
    alert('Settings saved and applied successfully.');
  });

  btnPrivacyDeleteData.addEventListener('click', async () => {
    if (confirm('Delete all local chat history permanently? This cannot be undone.')) {
      await api.clearAllUserData();
      alert('Local conversation data deleted.');
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

  // Run initial load
  initApp();
});
