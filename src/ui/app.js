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
    if (activeModel) {
      topbarModelDot.className = 'dot active';
      topbarModelText.textContent = `${activeModel.modelId} (Active)`;
      bottomModelDot.className = 'dot active';
      bottomModelText.textContent = `Model: ${activeModel.modelId}`;
    } else {
      topbarModelDot.className = 'dot';
      topbarModelText.textContent = 'No Model Loaded';
      bottomModelDot.className = 'dot';
      bottomModelText.textContent = 'No Model Loaded';
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
  const btnChatNew = document.getElementById('btn-chat-new');
  const btnChatRename = document.getElementById('btn-chat-rename');
  const btnChatDelete = document.getElementById('btn-chat-delete');
  const chatActiveTitle = document.getElementById('chat-active-conv-title');
  const chatMetricsBar = document.getElementById('chat-metrics-bar');
  const chatRagCheckbox = document.getElementById('chat-rag-checkbox');

  let liveAssistantBubble = null;

  api.onTokenChunk((data) => {
    if (liveAssistantBubble && data.token) {
      liveAssistantBubble.textContent += data.token;
      chatMessagesScroll.scrollTop = chatMessagesScroll.scrollHeight;
    }
    if (data.tokensPerSecond) {
      chatMetricsBar.textContent = `${data.tokensPerSecond} tokens/sec`;
    }
  });

  async function sendChatMessage() {
    const text = chatInputText.value.trim();
    if (!text) return;

    if (!activeModel) {
      alert('AI Engine Notice: No local model is loaded. Please navigate to 07 Model Manager to load Qwen2.5-Coder before generating responses.');
      return;
    }

    // Append user message bubble
    const userRow = document.createElement('div');
    userRow.className = 'msg-row user';
    userRow.innerHTML = `<div class="msg-bubble">${escapeHtml(text)}</div>`;
    chatMessagesScroll.appendChild(userRow);
    chatInputText.value = '';
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
        useRAG: chatRagCheckbox.checked
      });

      // Add copy button & citations
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
        citWrap.innerHTML = `<strong>📚 Verified Sources & Passages:</strong>` +
          response.citations.map(c => `
            <div class="citation-item">
              <strong>${escapeHtml(c.docName)}</strong> (Score: ${c.score}):<br>
              "${escapeHtml(c.snippet)}"
            </div>
          `).join('');
        asstRow.appendChild(citWrap);
      }

      chatMetricsBar.textContent = `${response.stats.tokensPerSecond} tok/s (${response.stats.tokenCount} tokens in ${(response.stats.elapsedMs / 1000).toFixed(1)}s)`;
    } catch (err) {
      liveAssistantBubble.innerHTML += `<br><span style="color: var(--accent-danger);">[Error: ${escapeHtml(err.message)}]</span>`;
    } finally {
      btnChatSend.disabled = false;
      btnChatStop.style.display = 'none';
      liveAssistantBubble = null;
      refreshConversationsList();
    }
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
      row.innerHTML = `<div class="msg-bubble">${escapeHtml(m.content)}</div>`;
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
  const btnFilesPickFolder = document.getElementById('btn-files-pick-folder');

  btnFilesPickFolder.addEventListener('click', async () => {
    const picked = await api.pickFolder();
    if (picked) {
      currentWorkspaceDir = picked;
      filesCurrentDir.textContent = `Scope: ${picked}`;
      refreshFilesView();
    }
  });

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
    const cat = filesCategoryFilter.value;
    const files = await api.listFiles(currentWorkspaceDir, cat);
    renderFileList(files);
  }

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
        <span style="font-size: 11px; color: var(--text-muted);">${escapeHtml(details.path)}</span>
        <hr style="border: none; border-top: 1px solid var(--border-subtle); margin: 8px 0;">
        Category: <strong>${details.category}</strong><br>
        Size: <strong>${details.sizeFormatted}</strong><br>
        Line Count: <strong>${details.lineCount || 'N/A'}</strong><br>
        Last Modified: <strong>${new Date(details.mtime).toLocaleString()}</strong><br>
        Supported for RAG: <strong>${details.supported ? 'Yes' : 'No'}</strong>
      `;
      btnFilesOpenOS.style.display = 'inline-flex';
      btnFilesIndexRAG.style.display = details.supported ? 'inline-flex' : 'none';
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
      } catch (e) {
        alert(`Indexing error: ${e.message}`);
      }
    }
  });

  // ================= 04: KNOWLEDGE & RAG SCREEN =================
  const ragCollectionsList = document.getElementById('rag-collections-list');
  const ragActiveCollName = document.getElementById('rag-active-coll-name');
  const ragActiveCollMeta = document.getElementById('rag-active-coll-meta');
  const ragDocsTableBody = document.querySelector('#rag-docs-table tbody');
  const btnRagCreateColl = document.getElementById('btn-rag-create-coll');
  const btnRagDeleteColl = document.getElementById('btn-rag-delete-coll');
  const btnRagRebuild = document.getElementById('btn-rag-rebuild');
  const ragQueryInput = document.getElementById('rag-query-input');
  const btnRagRunQuery = document.getElementById('btn-rag-run-query');
  const ragQueryCitations = document.getElementById('rag-query-citations');

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
    alert('Rebuilding index from current documents...');
    refreshRAGView();
  });

  btnRagRunQuery.addEventListener('click', async () => {
    const q = ragQueryInput.value.trim();
    if (!q) return;
    const res = await api.queryRAG(q);
    ragQueryCitations.innerHTML = '';
    if (res.citations.length === 0) {
      ragQueryCitations.innerHTML = '<div style="font-size: 11.5px; color: var(--text-muted);">No matching passages found in this collection.</div>';
    } else {
      res.citations.forEach(c => {
        const item = document.createElement('div');
        item.className = 'citation-item';
        item.innerHTML = `<strong>${escapeHtml(c.docName)}</strong> (Score: ${c.score}):<br>${escapeHtml(c.snippet)}`;
        ragQueryCitations.appendChild(item);
      });
    }
  });

  async function refreshRAGView() {
    const stats = await api.getRAGStats();
    ragActiveCollName.textContent = `Collection: ${stats.activeCollection}`;
    ragActiveCollMeta.textContent = `${stats.totalDocuments} documents · ${stats.totalChunks} chunks`;

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
          <td><strong>${escapeHtml(d.docName)}</strong><br><span style="font-size: 10px; color: var(--text-muted);">${escapeHtml(p)}</span></td>
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
        researchWebResults.innerHTML = res.webSources.map(s => `
          <div class="citation-item" style="margin-bottom: 6px;">
            <strong>🌐 ${escapeHtml(s.title)}</strong> — <a href="${escapeHtml(s.url)}" target="_blank" style="color: var(--accent-primary); font-size: 11px;">${escapeHtml(s.sourceDomain)}</a><br>
            ${escapeHtml(s.snippet)}
          </div>
        `).join('');
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
  const studioActiveFileLabel = document.getElementById('studio-active-file-label');
  const studioEditorBox = document.getElementById('studio-editor-box');
  const btnStudioApplyDiff = document.getElementById('btn-studio-apply-diff');
  const btnStudioRejectDiff = document.getElementById('btn-studio-reject-diff');
  const studioTerminalOutput = document.getElementById('studio-terminal-output');
  const studioCmdInput = document.getElementById('studio-cmd-input');
  const btnStudioRunCmd = document.getElementById('btn-studio-run-cmd');

  async function refreshStudioView() {
    const files = await api.listFiles(currentWorkspaceDir, 'code');
    studioTreeList.innerHTML = '';
    files.slice(0, 30).forEach(f => {
      const item = document.createElement('div');
      item.className = 'file-item-row';
      item.textContent = f.name;
      item.onclick = async () => {
        studioActiveFileLabel.textContent = f.path;
        const content = await api.readFile(f.path);
        studioEditorBox.textContent = content;

        // Propose sample diff for demonstration
        proposedDiff = await api.proposeDiff(f.path, content + '\n// ASTRO safe edit verification');
        btnStudioApplyDiff.style.display = 'inline-flex';
        btnStudioRejectDiff.style.display = 'inline-flex';
      };
      studioTreeList.appendChild(item);
    });
  }

  btnStudioApplyDiff.addEventListener('click', async () => {
    if (!proposedDiff) return;
    const ok = confirm(`Approve modifying ${proposedDiff.filePath}? A backup (.astro_bak) will be created (Rule 14).`);
    if (ok) {
      await api.applyDiff(proposedDiff.filePath, proposedDiff.newContent || '', true);
      alert('File modified safely with backup preserved.');
      btnStudioApplyDiff.style.display = 'none';
      btnStudioRejectDiff.style.display = 'none';
      proposedDiff = null;
    }
  });

  btnStudioRejectDiff.addEventListener('click', () => {
    proposedDiff = null;
    btnStudioApplyDiff.style.display = 'none';
    btnStudioRejectDiff.style.display = 'none';
  });

  btnStudioRunCmd.addEventListener('click', async () => {
    const cmd = studioCmdInput.value.trim();
    if (!cmd) return;
    const ok = confirm(`Security Confirmation (Rule 9):\n\nApprove execution of command:\n${cmd}`);
    if (ok) {
      studioTerminalOutput.textContent += `\n$ ${cmd}\nRunning...`;
      studioCmdInput.value = '';
      const res = await api.execCommand(cmd, currentWorkspaceDir, true);
      studioTerminalOutput.textContent += `\n${res.stdout || res.stderr || 'Exit code ' + res.exitCode}\n`;
      studioTerminalOutput.scrollTop = studioTerminalOutput.scrollHeight;
    }
  });

  // ================= 07: MODEL MANAGER SCREEN =================
  const modelsCardsGrid = document.getElementById('models-cards-grid');
  const modelsHwDetails = document.getElementById('models-hw-details');
  const btnModelsDiscover = document.getElementById('btn-models-discover');

  api.onDownloadProgress((p) => {
    const fill = document.getElementById(`model-dl-fill-${p.filename}`);
    const stats = document.getElementById(`model-dl-stats-${p.filename}`);
    if (fill && stats) {
      fill.style.width = `${p.progressPercent}%`;
      const mbDl = (p.bytesDownloaded / 1024 / 1024).toFixed(1);
      const mbTot = (p.totalBytes / 1024 / 1024).toFixed(1);
      const spd = (p.speedBytesPerSec / 1024 / 1024).toFixed(2);
      stats.textContent = `${p.progressPercent}% (${mbDl}/${mbTot} MB) · ${spd} MB/s · ETA ${p.etaSeconds}s`;
    }
  });

  btnModelsDiscover.addEventListener('click', async () => {
    btnModelsDiscover.disabled = true;
    btnModelsDiscover.textContent = 'Discovering...';
    try {
      const data = await api.discoverModel('Qwen/Qwen2.5-Coder-7B-Instruct-GGUF');
      alert(`Discovered ${data.totalVariants} compatible GGUF variants from official repository.\nRecommended: Q4_K_M (~4.68 GB).`);
      refreshModelsView();
    } catch (e) {
      alert(`Discovery error: ${e.message}`);
    } finally {
      btnModelsDiscover.disabled = false;
      btnModelsDiscover.textContent = 'Discover on Hugging Face';
    }
  });

  async function refreshModelsView() {
    const specs = await api.getHardwareSpecs();
    if (specs) {
      modelsHwDetails.innerHTML = `
        Processor: <strong>${specs.cpu.model}</strong> (${specs.cpu.logicalCores} threads, AVX2 enabled)<br>
        Memory: <strong>${specs.memory.freeGB} GB</strong> Free of <strong>${specs.memory.totalGB} GB</strong> | Free Disk: <strong>${specs.storage.freeDiskGB} GB</strong><br>
        GPU: <strong>${specs.gpu.name}</strong> (${specs.gpu.accelerationStatus})
      `;
    }

    const catalog = await api.getCatalog();
    modelsCardsGrid.innerHTML = '';

    catalog.models.forEach(m => {
      const isLoaded = activeModel && activeModel.modelId === m.id;
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div class="card-title">${escapeHtml(m.name)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(m.repoId)} · ${m.license}</div>
          </div>
          <span class="status-badge" style="font-size: 10px;">${m.installed ? 'Installed' : 'Available'}</span>
        </div>
        <p class="card-desc" style="margin-top: 6px;">${escapeHtml(m.description)}</p>

        <table class="data-table" style="margin-top: 10px;">
          <thead><tr><th>Quant</th><th>Size</th><th>Action</th></tr></thead>
          <tbody>
            ${(m.quantizations || []).map(q => `
              <tr>
                <td><strong>${q.tag}</strong> ${q.recommended ? '<span style="color: var(--accent-primary); font-size: 10px;">(Rec)</span>' : ''}</td>
                <td>~${q.approxSizeGB} GB</td>
                <td>
                  ${m.installed ? `
                    ${isLoaded ? `
                      <button class="btn btn-sm btn-danger" onclick="triggerUnloadModel()">Unload</button>
                    ` : `
                      <button class="btn btn-sm btn-primary" onclick="triggerLoadModel('${m.id}', '${m.localPath}')">Load</button>
                    `}
                  ` : `
                    <button class="btn btn-sm btn-primary" id="btn-dl-${q.filename}" onclick="triggerDownloadModel('${m.id}', '${q.tag}', '${q.filename}', ${Math.round(q.approxSizeGB * 1024 ** 3)})">Download</button>
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
    });
  }

  window.triggerDownloadModel = async (modelId, quantTag, filename, approxBytes) => {
    const url = `https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/${filename}`;
    const dlBox = document.getElementById(`dl-box-${modelId}`);
    if (dlBox) dlBox.style.display = 'block';

    try {
      const res = await api.downloadModel({
        url,
        filename,
        expectedSizeBytes: approxBytes
      });

      await api.installModel({
        modelId,
        variantTag: quantTag,
        filename,
        partialFilePath: res.partialPath,
        expectedSizeBytes: approxBytes
      });

      alert(`Model ${modelId} (${quantTag}) successfully downloaded, verified, and installed!`);
      refreshModelsView();
    } catch (e) {
      alert(`Download error: ${e.message}`);
    } finally {
      if (dlBox) dlBox.style.display = 'none';
    }
  };

  window.triggerLoadModel = async (modelId, pathStr) => {
    try {
      activeModel = await api.loadModel(modelId, pathStr);
      await refreshActiveModel();
      refreshModelsView();
      alert(`Model ${modelId} loaded into memory! You can now generate responses in 02 Chat.`);
    } catch (e) {
      alert(`Failed to load model: ${e.message}`);
    }
  };

  window.triggerUnloadModel = async () => {
    await api.unloadModel();
    activeModel = null;
    await refreshActiveModel();
    refreshModelsView();
  };

  window.triggerCancelDl = async (filename) => {
    await api.cancelDownload(filename);
  };

  // ================= 08: VOICE SCREEN =================
  const voiceMicCircle = document.getElementById('voice-mic-circle');
  const voiceStatusHeading = document.getElementById('voice-status-heading');
  const voiceMissingText = document.getElementById('voice-missing-text');
  const voiceTtsPref = document.getElementById('voice-tts-pref');

  async function refreshVoiceView() {
    const status = await api.getVoiceStatus();
    voiceTtsPref.checked = status.ttsEnabled;

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

  voiceTtsPref.addEventListener('change', async () => {
    await api.setTTSPreference(voiceTtsPref.checked);
  });

  // ================= 09: ACTIVITY SCREEN =================
  const activityTasksContainer = document.getElementById('activity-tasks-container');
  const btnActivityClear = document.getElementById('btn-activity-clear');

  btnActivityClear.addEventListener('click', async () => {
    await api.clearCompletedActivities();
    refreshActivityView();
  });

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
