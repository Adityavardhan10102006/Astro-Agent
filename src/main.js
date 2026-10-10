const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const { StorageService } = require('./services/storage/storage-service');
const { HardwareService } = require('./services/system/hardware-service');
const { HuggingFaceDiscovery } = require('./services/huggingface/huggingface-discovery');
const { DownloadManager } = require('./services/models/download-manager');
const { DownloadVerifier } = require('./services/models/download-verifier');
const { ModelInstaller } = require('./services/models/model-installer');
const { InferenceManager } = require('./services/inference/inference-manager');
const { RAGService } = require('./services/rag/rag-service');
const { SecurityService } = require('./services/security/security-service');
const { FileService } = require('./services/files/file-service');
const { CodingService } = require('./services/coding/coding-service');
const { AssistantCoordinator } = require('./services/assistant/assistant-coordinator');
const { ActivityService } = require('./services/system/activity-service');
const { ResearchService } = require('./services/research/research-service');
const { VoiceService } = require('./services/voice/voice-service');
const { APPROVED_MODELS } = require('./config/model-catalog');

let mainWindow = null;

// Initialize core services
const storageService = new StorageService();
const hardwareService = new HardwareService();
const hfDiscovery = new HuggingFaceDiscovery();
const downloadManager = new DownloadManager(storageService);
const downloadVerifier = new DownloadVerifier();
const modelInstaller = new ModelInstaller(storageService, downloadVerifier);
const inferenceManager = new InferenceManager(storageService, hardwareService);
const ragService = new RAGService(storageService);
const securityService = new SecurityService();
const fileService = new FileService(securityService);
const codingService = new CodingService(securityService, fileService);
const assistantCoordinator = new AssistantCoordinator(storageService, inferenceManager, ragService);
const activityService = new ActivityService();
const researchService = new ResearchService(storageService, ragService);
const voiceService = new VoiceService(storageService);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#0c0f17',
    title: 'ASTRO — Offline Desktop AI Assistant & Coding Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  // Forward download progress events to renderer
  downloadManager.on('progress', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download:progress', data);
    }
  });

  // Forward activity updates to renderer
  activityService.on('change', (tasks) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('activity:changed', tasks);
    }
  });
}

// App lifecycle
app.whenReady().then(() => {
  storageService.ensureDirectories();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handler Registrations

// --- System & Hardware ---
ipcMain.handle('system:specs', async () => {
  return hardwareService.detectSystemSpecs();
});

ipcMain.handle('system:check-compatibility', async (event, modelId, quantTag) => {
  const catalog = storageService.getCatalog();
  const entry = catalog.models.find(m => m.id === modelId) || APPROVED_MODELS.find(m => m.id === modelId);
  if (!entry) return null;
  return hardwareService.evaluateCompatibility(entry, quantTag);
});

ipcMain.handle('system:network-status', async () => {
  const settings = storageService.getSettings();
  return {
    offlineOnly: settings.privacy.offlineOnly,
    allowExternalServices: settings.privacy.allowExternalServices
  };
});

// --- Activity IPC ---
ipcMain.handle('activity:list', async () => {
  return activityService.getAllTasks();
});

ipcMain.handle('activity:clear-completed', async () => {
  activityService.clearCompleted();
  return true;
});

// --- Models IPC ---
ipcMain.handle('models:catalog', async () => {
  return storageService.getCatalog();
});

ipcMain.handle('models:discover', async (event, repoId, token) => {
  const task = activityService.createTask({
    type: 'model-discovery',
    label: `Discovering ${repoId || 'Qwen'}`,
    details: 'Querying Hugging Face API'
  });
  try {
    const res = await hfDiscovery.discoverModelVariants(repoId || 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF', token);
    activityService.completeTask(task.id, `Found ${res.totalVariants} variants`);
    return res;
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

ipcMain.handle('models:download', async (event, { url, filename, expectedSizeBytes, token }) => {
  const task = activityService.createTask({
    id: `dl_${filename}`,
    type: 'model-download',
    label: `Downloading ${filename}`,
    details: 'Initiating download',
    cancellable: true
  });

  const progressHandler = (p) => {
    if (p.filename === filename) {
      activityService.updateProgress(task.id, p.progressPercent, `${p.progressPercent}% · ${(p.speedBytesPerSec / (1024 ** 2)).toFixed(1)} MB/s`);
    }
  };

  downloadManager.on('progress', progressHandler);

  try {
    const res = await downloadManager.downloadFile(url, filename, expectedSizeBytes, token);
    activityService.completeTask(task.id, 'Downloaded to partial-downloads');
    return res;
  } catch (err) {
    if (err.message.includes('cancelled')) {
      activityService.cancelTask(task.id);
    } else {
      activityService.failTask(task.id, err.message);
    }
    throw err;
  } finally {
    downloadManager.removeListener('progress', progressHandler);
  }
});

ipcMain.handle('models:cancel-download', async (event, filename) => {
  const ok = downloadManager.cancelDownload(filename);
  activityService.cancelTask(`dl_${filename}`);
  return ok;
});

ipcMain.handle('models:install', async (event, args) => {
  const task = activityService.createTask({
    type: 'model-install',
    label: `Verifying & Installing ${args.modelId}`,
    details: 'Verifying GGUF integrity and registering'
  });
  try {
    const res = await modelInstaller.installVerifiedModel(args);
    activityService.completeTask(task.id, 'Verified and installed');
    return res;
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

ipcMain.handle('models:uninstall', async (event, modelId) => {
  if (inferenceManager.loadedModel && inferenceManager.loadedModel.modelId === modelId) {
    await inferenceManager.unloadModel();
  }
  return modelInstaller.uninstallModel(modelId);
});

// --- Inference IPC ---
ipcMain.handle('inference:active-model', async () => {
  return inferenceManager.getLoadedModelInfo();
});

ipcMain.handle('inference:load', async (event, modelId, filePath) => {
  const task = activityService.createTask({
    type: 'model-load',
    label: `Loading ${modelId}`,
    details: 'Allocating context in system memory'
  });
  try {
    const res = await inferenceManager.loadModel(modelId, filePath);
    activityService.completeTask(task.id, `Loaded in ${res.loadTimeMs}ms`);
    return res;
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

ipcMain.handle('inference:unload', async () => {
  const res = await inferenceManager.unloadModel();
  return res;
});

ipcMain.handle('chat:send', async (event, { message, useRAG }) => {
  const task = activityService.createTask({
    type: 'inference',
    label: 'Generating assistant response',
    details: useRAG ? 'Local RAG retrieval active' : 'Direct inference',
    cancellable: true
  });
  try {
    const res = await assistantCoordinator.handleUserMessage({
      message,
      useRAG,
      onToken: (chunk) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('chat:token', chunk);
        }
      }
    });
    activityService.completeTask(task.id, `${res.stats.tokenCount} tokens generated`);
    return res;
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

ipcMain.handle('chat:stop', async () => {
  return inferenceManager.stopGeneration();
});

// --- Conversations IPC ---
ipcMain.handle('conversations:list', async () => {
  return assistantCoordinator.getConversationsList();
});

ipcMain.handle('conversations:load', async (event, convId) => {
  return assistantCoordinator.loadConversation(convId);
});

ipcMain.handle('conversations:rename', async (event, convId, newTitle) => {
  return assistantCoordinator.renameConversation(convId, newTitle);
});

ipcMain.handle('conversations:delete', async (event, convId) => {
  return assistantCoordinator.deleteConversation(convId);
});

ipcMain.handle('conversations:new', async () => {
  return assistantCoordinator.startNewConversation();
});

// --- RAG & Knowledge IPC ---
ipcMain.handle('rag:query', async (event, query) => {
  return ragService.query(query);
});

ipcMain.handle('rag:index-doc', async (event, filePath) => {
  const task = activityService.createTask({
    type: 'rag-indexing',
    label: `Indexing ${path.basename(filePath)}`,
    details: 'Reading and chunking document'
  });
  try {
    const content = fileService.readFileContent(filePath);
    const chunkCount = ragService.addDocument(filePath, content);
    activityService.completeTask(task.id, `Generated ${chunkCount} chunks`);
    return { success: true, filePath, chunkCount };
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

ipcMain.handle('rag:remove-doc', async (event, filePath) => {
  return ragService.removeDocument(filePath);
});

ipcMain.handle('rag:stats', async () => {
  return ragService.getIndexStats();
});

ipcMain.handle('rag:list-collections', async () => {
  return ragService.listCollections();
});

ipcMain.handle('rag:create-collection', async (event, name) => {
  return ragService.createCollection(name);
});

ipcMain.handle('rag:rename-collection', async (event, oldName, newName) => {
  return ragService.renameCollection(oldName, newName);
});

ipcMain.handle('rag:delete-collection', async (event, name) => {
  return ragService.deleteCollection(name);
});

ipcMain.handle('rag:switch-collection', async (event, name) => {
  ragService.loadIndex(name);
  return ragService.getIndexStats();
});

// --- Research IPC ---
ipcMain.handle('research:query', async (event, args) => {
  const task = activityService.createTask({
    type: 'research',
    label: `Research: "${args.query.slice(0, 30)}"`,
    details: args.allowOnline ? 'Local + Web query' : 'Local-only query',
    cancellable: true
  });
  try {
    const res = await researchService.performResearch(args);
    activityService.completeTask(task.id, `Found ${res.localSources.length} local & ${res.webSources.length} web sources`);
    return res;
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

ipcMain.handle('research:cancel', async () => {
  return researchService.cancelActiveSearch();
});

// --- Voice IPC ---
ipcMain.handle('voice:status', async () => {
  return voiceService.getEngineStatus();
});

ipcMain.handle('voice:start', async () => {
  return voiceService.startListening();
});

ipcMain.handle('voice:stop', async () => {
  return voiceService.stopListening();
});

ipcMain.handle('voice:tts-preference', async (event, enabled) => {
  return voiceService.setSpokenResponsePreference(enabled);
});

ipcMain.handle('voice:stop-speaking', async () => {
  return voiceService.stopSpeaking();
});

// --- Files & Coding IPC ---
ipcMain.handle('files:list', async (event, dirPath, categoryFilter) => {
  return fileService.listFiles(dirPath || process.cwd(), { recursive: true, maxDepth: 4, categoryFilter });
});

ipcMain.handle('files:search', async (event, dirPath, query, categoryFilter) => {
  return fileService.searchFiles(dirPath || process.cwd(), query, categoryFilter);
});

ipcMain.handle('files:details', async (event, filePath) => {
  return fileService.getFileDetails(filePath);
});

ipcMain.handle('files:read', async (event, filePath) => {
  return fileService.readFileContent(filePath);
});

ipcMain.handle('files:write', async (event, filePath, content, confirmed) => {
  return fileService.backupAndWriteFile(filePath, content);
});

ipcMain.handle('files:exclusions-get', async () => {
  return fileService.getExclusions();
});

ipcMain.handle('files:exclusions-set', async (event, dirs) => {
  fileService.setExclusions(dirs);
  return fileService.getExclusions();
});

ipcMain.handle('coding:diff', async (event, filePath, newContent) => {
  return codingService.proposeFileChange(filePath, newContent);
});

ipcMain.handle('coding:apply-diff', async (event, filePath, newContent, confirmed) => {
  return codingService.applyApprovedChange(filePath, newContent, confirmed);
});

ipcMain.handle('coding:exec', async (event, command, cwd, confirmed) => {
  const task = activityService.createTask({
    type: 'code-execution',
    label: `Terminal: ${command.slice(0, 30)}`,
    details: 'Executing approved command'
  });
  try {
    const res = await codingService.executeApprovedCommand(command, cwd || process.cwd(), confirmed);
    if (res.exitCode === 0) {
      activityService.completeTask(task.id, 'Exited code 0');
    } else {
      activityService.failTask(task.id, `Exit code ${res.exitCode}`);
    }
    return res;
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

// --- Platform Dialogs & OS ---
ipcMain.handle('platform:pick-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('platform:pick-file', async (event, filters) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('platform:open-path', async (event, targetPath) => {
  return shell.openPath(targetPath);
});

// --- Settings IPC ---
ipcMain.handle('settings:get', async () => {
  return storageService.getSettings();
});

ipcMain.handle('settings:save', async (event, settings) => {
  return storageService.saveSettings(settings);
});

ipcMain.handle('settings:clear-data', async () => {
  const convDir = storageService.paths.conversations;
  if (fs.existsSync(convDir)) {
    fs.readdirSync(convDir).forEach(f => {
      try { fs.unlinkSync(path.join(convDir, f)); } catch (e) {}
    });
  }
  return true;
});
