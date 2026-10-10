// ASTRO Desktop Application Logic
document.addEventListener('DOMContentLoaded', async () => {
  const api = window.astroApi;
  if (!api) {
    console.error('astroApi bridge is unavailable');
    return;
  }

  // --- State ---
  let currentScreen = 'chat-screen';
  let activeModel = null;
  let currentDownload = null;
  let proposedDiffData = null;

  // --- UI Elements ---
  const navItems = document.querySelectorAll('.nav-item');
  const screens = document.querySelectorAll('.screen');
  const modelDot = document.getElementById('model-dot');
  const modelStatusText = document.getElementById('model-status-text');
  const hardwareText = document.getElementById('hardware-text');
  const hwCompatNotes = document.getElementById('hw-compat-notes');

  // --- Screen Navigation ---
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetScreen = item.getAttribute('data-screen');
      navItems.forEach(n => n.classList.remove('active'));
      screens.forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(targetScreen).classList.add('active');
      currentScreen = targetScreen;

      if (targetScreen === 'models-screen') refreshModelsView();
      if (targetScreen === 'files-screen') refreshFilesView();
      if (targetScreen === 'studio-screen') refreshStudioView();
      if (targetScreen === 'settings-screen') refreshSettingsView();
    });
  });

  // --- Initial Hardware & Status Load ---
  async function loadInitialStatus() {
    try {
      const specs = await api.getHardwareSpecs();
      if (specs) {
        hardwareText.textContent = `${specs.cpu.isRyzen ? 'AMD Ryzen' : specs.cpu.model.split(' ')[0]} · ${specs.memory.freeGB}GB / ${specs.memory.totalGB}GB Free RAM`;
        hwCompatNotes.innerHTML = `
          Detected <strong>${specs.cpu.model}</strong> (${specs.cpu.logicalCores} logical threads, AVX2 enabled).<br>
          Total RAM: <strong>${specs.memory.totalGB} GB</strong> | Free: <strong>${specs.memory.freeGB} GB</strong> | Free Disk: <strong>${specs.storage.freeDiskGB} GB</strong>.<br>
          Integrated GPU: <strong>${specs.gpu.name}</strong> (${specs.gpu.accelerationStatus}).
        `;
      }

      activeModel = await api.getActiveModel();
      updateModelStatusUI();
      loadConversations();
    } catch (err) {
      console.error('Error loading initial status:', err);
    }
  }

  function updateModelStatusUI() {
    if (activeModel) {
      modelDot.className = 'status-dot active';
      modelStatusText.textContent = `${activeModel.modelId} (Active)`;
    } else {
      modelDot.className = 'status-dot idle';
      modelStatusText.textContent = 'No Model Loaded';
    }
  }

  // --- 01: Chat Screen Logic ---
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const chatInput = document.getElementById('chat-input');
  const btnSend = document.getElementById('btn-send');
  const btnStopGen = document.getElementById('btn-stop-gen');
  const ragCheckbox = document.getElementById('rag-checkbox');
  const streamingMetrics = document.getElementById('streaming-metrics');
  const btnNewChat = document.getElementById('btn-new-chat');
  const conversationsList = document.getElementById('conversations-list');

  let currentAssistantBubble = null;

  api.onTokenChunk((data) => {
    if (currentAssistantBubble && data.token) {
      currentAssistantBubble.textContent += data.token;
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
    if (data.tokensPerSecond) {
      streamingMetrics.textContent = `${data.tokensPerSecond} tokens/sec (${data.tokenCount} tokens)`;
    }
  });

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    if (!activeModel) {
      alert('No model loaded. Please go to 02 Model Manager and load Qwen.');
      return;
    }

    // Append User Message
    const userMsg = document.createElement('div');
    userMsg.className = 'message user';
    userMsg.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
    chatMessagesContainer.appendChild(userMsg);
    chatInput.value = '';
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    // Prepare Assistant Bubble
    const assistantMsg = document.createElement('div');
    assistantMsg.className = 'message assistant';
    currentAssistantBubble = document.createElement('div');
    currentAssistantBubble.className = 'message-bubble';
    currentAssistantBubble.textContent = '';
    assistantMsg.appendChild(currentAssistantBubble);
    chatMessagesContainer.appendChild(assistantMsg);

    btnSend.disabled = true;
    btnStopGen.style.display = 'inline-flex';
    streamingMetrics.textContent = 'Generating...';

    try {
      const response = await api.sendMessage({
        message: text,
        useRAG: ragCheckbox.checked
      });

      if (response.citations && response.citations.length > 0) {
        const citationsWrap = document.createElement('div');
        citationsWrap.className = 'message-citations';
        citationsWrap.innerHTML = `
          <div class="citation-header">📚 Verified Local Source Citations</div>
          ${response.citations.map(c => `
            <div class="citation-chip">
              <strong>${escapeHtml(c.docName)}</strong> (Score: ${c.score}): "${escapeHtml(c.snippet)}"
            </div>
          `).join('')}
        `;
        assistantMsg.appendChild(citationsWrap);
      }

      streamingMetrics.textContent = `${response.stats.tokensPerSecond} tok/s · ${response.stats.tokenCount} tokens in ${(response.stats.elapsedMs / 1000).toFixed(1)}s`;
    } catch (err) {
      currentAssistantBubble.innerHTML += `<br><span style="color: var(--accent-rose)">[Error: ${escapeHtml(err.message)}]</span>`;
    } finally {
      btnSend.disabled = false;
      btnStopGen.style.display = 'none';
      currentAssistantBubble = null;
      loadConversations();
    }
  }

  btnSend.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  btnStopGen.addEventListener('click', async () => {
    await api.stopGeneration();
    btnStopGen.style.display = 'none';
  });

  btnNewChat.addEventListener('click', async () => {
    await api.startNewConversation();
    chatMessagesContainer.innerHTML = `
      <div class="message assistant">
        <div class="message-bubble">New conversation started. Ready for offline assistance.</div>
      </div>
    `;
    loadConversations();
  });

  async function loadConversations() {
    const list = await api.getConversations();
    conversationsList.innerHTML = '';
    list.forEach(c => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.textContent = c.title;
      conversationsList.appendChild(item);
    });
  }

  // --- 02: Model Manager Screen Logic ---
  const modelsGrid = document.getElementById('models-grid');
  const btnRefreshHF = document.getElementById('btn-refresh-hf');

  // Real-time download progress listener
  api.onDownloadProgress((data) => {
    const fill = document.getElementById(`dl-fill-${data.filename}`);
    const stats = document.getElementById(`dl-stats-${data.filename}`);
    if (fill && stats) {
      fill.style.width = `${data.progressPercent}%`;
      const mbDownloaded = (data.bytesDownloaded / (1024 ** 2)).toFixed(1);
      const mbTotal = (data.totalBytes / (1024 ** 2)).toFixed(1);
      const speedMB = (data.speedBytesPerSec / (1024 ** 2)).toFixed(2);
      stats.textContent = `${data.progressPercent}% (${mbDownloaded} / ${mbTotal} MB) · ${speedMB} MB/s · ETA: ${data.etaSeconds}s`;
    }
  });

  async function refreshModelsView() {
    modelsGrid.innerHTML = 'Loading model catalog...';
    const catalog = await api.getCatalog();
    modelsGrid.innerHTML = '';

    for (const model of catalog.models) {
      const card = document.createElement('div');
      card.className = 'card';

      const isInstalled = model.installed;
      const isLoaded = activeModel && activeModel.modelId === model.id;

      card.innerHTML = `
        <div class="card-header">
          <div>
            <div class="card-title">${escapeHtml(model.name)}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(model.repoId)} · ${model.license}</div>
          </div>
          <span class="card-badge ${isInstalled ? '' : 'pending'}">${isInstalled ? 'Installed' : 'Available'}</span>
        </div>
        <p class="card-desc">${escapeHtml(model.description)}</p>

        <table class="quant-table">
          <thead>
            <tr>
              <th>Quantization</th>
              <th>Est. Size</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${(model.quantizations || []).map(q => `
              <tr>
                <td><strong>${q.tag}</strong> ${q.recommended ? '<span style="color: var(--accent-cyan); font-size: 0.7rem;">(Recommended)</span>' : ''}</td>
                <td>~${q.approxSizeGB} GB</td>
                <td><span id="quant-status-${q.filename}">Ready</span></td>
                <td>
                  ${isInstalled ? `
                    ${isLoaded ? `
                      <button class="btn btn-sm btn-danger" onclick="unloadActiveModel()">Unload</button>
                    ` : `
                      <button class="btn btn-sm btn-primary" onclick="loadModelById('${model.id}', '${model.localPath}')">Load</button>
                    `}
                  ` : `
                    <button class="btn btn-sm btn-primary" id="btn-dl-${q.filename}" onclick="startDownload('${model.id}', '${q.tag}', '${q.filename}', ${Math.round(q.approxSizeGB * 1024 ** 3)})">Download</button>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div id="dl-container-${model.id}" style="display: none;" class="download-progress-wrap">
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
            <strong id="dl-title-${model.id}">Downloading...</strong>
            <button class="btn btn-danger btn-sm" id="btn-cancel-${model.id}">Cancel</button>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" id="dl-fill-${model.id}"></div>
          </div>
          <div class="progress-stats" id="dl-stats-${model.id}">Starting download...</div>
        </div>
      `;

      modelsGrid.appendChild(card);
    }
  }

  window.startDownload = async (modelId, quantTag, filename, approxBytes) => {
    const url = `https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/${filename}`;
    const btn = document.getElementById(`btn-dl-${filename}`);
    if (btn) btn.disabled = true;

    try {
      alert(`Starting download for ${filename}. Progress will stream in real time.`);
      const res = await api.downloadModel({
        url,
        filename,
        expectedSizeBytes: approxBytes
      });

      // Verify and install
      await api.installModel({
        modelId,
        variantTag: quantTag,
        filename,
        partialFilePath: res.partialPath,
        expectedSizeBytes: approxBytes
      });

      alert(`Download and verification complete! ${modelId} is now installed.`);
      refreshModelsView();
    } catch (err) {
      alert(`Download error: ${err.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  window.loadModelById = async (modelId, filePath) => {
    try {
      activeModel = await api.loadModel(modelId, filePath);
      updateModelStatusUI();
      refreshModelsView();
      alert(`Model ${modelId} loaded into memory! You can now chat in 01 Home.`);
    } catch (err) {
      alert(`Failed to load model: ${err.message}`);
    }
  };

  window.unloadActiveModel = async () => {
    await api.unloadModel();
    activeModel = null;
    updateModelStatusUI();
    refreshModelsView();
  };

  btnRefreshHF.addEventListener('click', async () => {
    btnRefreshHF.disabled = true;
    btnRefreshHF.textContent = 'Discovering...';
    try {
      const data = await api.discoverModel('Qwen/Qwen2.5-Coder-7B-Instruct-GGUF');
      alert(`Discovered ${data.totalVariants} GGUF variants from ${data.repoId}. Recommended: Q4_K_M.`);
    } catch (e) {
      alert(`Discovery error: ${e.message}`);
    } finally {
      btnRefreshHF.disabled = false;
      btnRefreshHF.textContent = 'Discover on Hugging Face';
    }
  });

  // --- 03: Files & RAG Screen Logic ---
  const workspaceFileList = document.getElementById('workspace-file-list');
  const ragStatsBox = document.getElementById('rag-stats-box');
  const ragTestInput = document.getElementById('rag-test-input');
  const btnRagTest = document.getElementById('btn-rag-test');
  const ragTestResults = document.getElementById('rag-test-results');
  const btnPickWorkspace = document.getElementById('btn-pick-workspace');
  const btnIndexAll = document.getElementById('btn-index-all');

  let currentWorkspaceDir = 'c:\\aditya\\ASTRO';

  async function refreshFilesView() {
    try {
      const files = await api.listFiles(currentWorkspaceDir);
      workspaceFileList.innerHTML = '';
      files.slice(0, 30).forEach(f => {
        const item = document.createElement('div');
        item.className = 'file-list-item';
        item.innerHTML = `
          <span>${f.type === 'directory' ? '📁' : '📄'} ${escapeHtml(f.name)}</span>
          ${f.supported ? `<button class="btn btn-sm btn-primary" onclick="indexDoc('${escapeHtml(f.path.replace(/\\/g, '\\\\'))}')">Index RAG</button>` : ''}
        `;
        workspaceFileList.appendChild(item);
      });

      const stats = await api.getRAGStats();
      ragStatsBox.innerHTML = `
        Indexed Documents: <strong>${stats.totalDocuments}</strong><br>
        Total Chunks: <strong>${stats.totalChunks}</strong><br>
        Last Updated: <strong>${stats.updatedAt || 'Never'}</strong>
      `;
    } catch (e) {
      console.error('Error in refreshFilesView:', e);
    }
  }

  window.indexDoc = async (pathStr) => {
    try {
      const res = await api.indexDocument(pathStr);
      alert(`Indexed ${res.filePath} (${res.chunkCount} chunks generated).`);
      refreshFilesView();
    } catch (e) {
      alert(`Indexing error: ${e.message}`);
    }
  };

  btnPickWorkspace.addEventListener('click', async () => {
    const chosen = await api.pickFolder();
    if (chosen) {
      currentWorkspaceDir = chosen;
      refreshFilesView();
    }
  });

  btnIndexAll.addEventListener('click', async () => {
    alert('Indexing workspace documents into local offline RAG...');
    const files = await api.listFiles(currentWorkspaceDir);
    let count = 0;
    for (const f of files) {
      if (f.type === 'file' && f.supported) {
        await api.indexDocument(f.path);
        count++;
      }
    }
    alert(`Successfully indexed ${count} workspace files!`);
    refreshFilesView();
  });

  btnRagTest.addEventListener('click', async () => {
    const q = ragTestInput.value.trim();
    if (!q) return;
    const res = await api.queryRAG(q);
    ragTestResults.innerHTML = '';
    if (res.citations.length === 0) {
      ragTestResults.innerHTML = '<em>No matching chunks found in local knowledge base.</em>';
    } else {
      res.citations.forEach(c => {
        const d = document.createElement('div');
        d.className = 'citation-chip';
        d.style.marginBottom = '6px';
        d.innerHTML = `<strong>${escapeHtml(c.docName)}</strong> (Score: ${c.score})<br>${escapeHtml(c.snippet)}`;
        ragTestResults.appendChild(d);
      });
    }
  });

  // --- 04: Coding Studio Screen Logic ---
  const studioFileTree = document.getElementById('studio-file-tree');
  const studioDiffViewer = document.getElementById('studio-diff-viewer');
  const btnApplyDiff = document.getElementById('btn-apply-diff');
  const btnRejectDiff = document.getElementById('btn-reject-diff');
  const studioTerminalBox = document.getElementById('studio-terminal-box');
  const terminalInput = document.getElementById('terminal-input');
  const btnRunCmd = document.getElementById('btn-run-cmd');

  async function refreshStudioView() {
    const files = await api.listFiles(currentWorkspaceDir);
    studioFileTree.innerHTML = '';
    files.filter(f => f.type === 'file').slice(0, 25).forEach(f => {
      const item = document.createElement('div');
      item.className = 'file-list-item';
      item.style.cursor = 'pointer';
      item.textContent = f.name;
      item.addEventListener('click', async () => {
        const content = await api.readFile(f.path);
        // Propose sample modification test
        proposedDiffData = await api.proposeDiff(f.path, content + '\n// ASTRO safe verified modification');
        renderDiff(proposedDiffData.diff);
      });
      studioFileTree.appendChild(item);
    });
  }

  function renderDiff(diffText) {
    studioDiffViewer.innerHTML = '';
    diffText.split('\n').forEach(line => {
      const lineDiv = document.createElement('div');
      if (line.startsWith('+')) {
        lineDiv.className = 'diff-add';
      } else if (line.startsWith('-')) {
        lineDiv.className = 'diff-del';
      }
      lineDiv.textContent = line;
      studioDiffViewer.appendChild(lineDiv);
    });
  }

  btnApplyDiff.addEventListener('click', async () => {
    if (!proposedDiffData) {
      alert('No diff selected.');
      return;
    }
    const confirmed = confirm(`Are you sure you want to apply changes to ${proposedDiffData.filePath}? A backup (.astro_bak) will be created automatically.`);
    if (confirmed) {
      try {
        await api.applyDiff(proposedDiffData.filePath, proposedDiffData.newContent || '', true);
        alert('Changes safely applied and backup created!');
      } catch (e) {
        alert(e.message);
      }
    }
  });

  btnRejectDiff.addEventListener('click', () => {
    proposedDiffData = null;
    studioDiffViewer.textContent = '// Diff rejected.';
  });

  btnRunCmd.addEventListener('click', async () => {
    const cmd = terminalInput.value.trim();
    if (!cmd) return;
    const confirmed = confirm(`Approve command execution (Rule 9):\n\n${cmd}`);
    if (confirmed) {
      studioTerminalBox.textContent += `\n$ ${cmd}\nExecuting...`;
      const res = await api.execCommand(cmd, currentWorkspaceDir, true);
      studioTerminalBox.textContent += `\n${res.stdout || res.stderr || 'Done (Exit Code ' + res.exitCode + ')'}\n`;
      terminalInput.value = '';
    }
  });

  // --- 05: Settings Screen Logic ---
  const settingsHwReport = document.getElementById('settings-hw-report');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  async function refreshSettingsView() {
    const specs = await api.getHardwareSpecs();
    settingsHwReport.innerHTML = `
      Operating System : ${specs.os.platform} (${specs.os.arch})
      Processor        : ${specs.cpu.model} (${specs.cpu.logicalCores} threads)
      AVX2 Support     : ${specs.cpu.supportsAVX2 ? 'Enabled (Native)' : 'Disabled'}
      System RAM       : ${specs.memory.totalGB} GB Total / ${specs.memory.freeGB} GB Free (${specs.memory.percentUsed}% Used)
      Graphics Device  : ${specs.gpu.name}
      Storage Space    : ${specs.storage.freeDiskGB} GB Free on primary drive
      Offline Mode     : Enforced (Telemetry disabled)
    `;
  }

  btnSaveSettings.addEventListener('click', async () => {
    const updated = {
      privacy: {
        offlineOnly: document.getElementById('setting-offline-only').checked,
        allowExternalServices: false,
        telemetryEnabled: false
      },
      security: {
        requireApprovalForCommands: document.getElementById('setting-confirm-cmd').checked,
        requireApprovalForFileEdits: document.getElementById('setting-confirm-write').checked
      }
    };
    await api.saveSettings(updated);
    alert('Settings saved successfully.');
  });

  function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m]));
  }

  // Run initialization
  loadInitialStatus();
});
