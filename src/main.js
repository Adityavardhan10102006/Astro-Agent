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
const { ProjectIntelligenceService } = require('./services/coding/project-intelligence');
const { AssistantCoordinator } = require('./services/assistant/assistant-coordinator');
const { ActivityService } = require('./services/system/activity-service');
const { ResearchService } = require('./services/research/research-service');
const { VoiceService } = require('./services/voice/voice-service');
const { ModelRegistry } = require('./services/models/model-registry');
const { ModelLifecycleManager } = require('./services/models/model-lifecycle');
const { ActionService } = require('./services/platform/action-service');
const { APPROVED_MODELS } = require('./config/model-catalog');

let mainWindow = null;

// Initialize core services
const storageService = new StorageService();
const hardwareService = new HardwareService();
const modelRegistry = new ModelRegistry(storageService);
const modelLifecycle = new ModelLifecycleManager();
const hfDiscovery = new HuggingFaceDiscovery(storageService);
const downloadManager = new DownloadManager(storageService, hardwareService);
const downloadVerifier = new DownloadVerifier();
const modelInstaller = new ModelInstaller(storageService, downloadVerifier, modelRegistry, modelLifecycle);
const inferenceManager = new InferenceManager(storageService, hardwareService, modelLifecycle, modelRegistry);
const ragService = new RAGService(storageService);
const securityService = new SecurityService();
const fileService = new FileService(securityService);
const codingService = new CodingService(securityService, fileService);
const projectIntelligence = new ProjectIntelligenceService(securityService, fileService);
const activityService = new ActivityService();
const voiceService = new VoiceService(storageService);
const actionService = new ActionService({
  storageService,
  securityService,
  hardwareService,
  inferenceManager,
  ragService,
  fileService,
  codingService,
  activityService
});
const assistantCoordinator = new AssistantCoordinator(
  storageService,
  inferenceManager,
  ragService,
  actionService,
  voiceService,
  modelRegistry,
  hfDiscovery
);

const researchService = new ResearchService(storageService, ragService);

function createWindow() {
  const iconPath = path.join(__dirname, 'ui', 'assets', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 680,
    backgroundColor: '#0c0f17',
    title: 'ASTRO — Offline Desktop AI Assistant & Coding Studio',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
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

  // Forward model lifecycle state changes
  modelLifecycle.on('stateChanged', (data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('models:lifecycle-changed', data);
    }
  });
}

// App lifecycle
app.whenReady().then(async () => {
  storageService.ensureDirectories();

  // Auto-detect and register pre-placed models in workspace, managed dir, or portable dir (e.g. Qwen3-8B-Q4_K_M.gguf)
  if (!modelRegistry.getEntry('qwen3-8b')) {
    const candidateLocations = [
      path.join(storageService.paths.models, 'Qwen3-8B-Q4_K_M.gguf'),
      path.join(process.cwd(), 'Qwen3-8B-Q4_K_M.gguf'),
      path.join(path.dirname(process.execPath), 'Qwen3-8B-Q4_K_M.gguf'),
      'c:\\aditya\\ASTRO\\Qwen3-8B-Q4_K_M.gguf',
      path.join(require('os').homedir(), 'Downloads', 'Qwen3-8B-Q4_K_M.gguf')
    ];

    for (const candPath of candidateLocations) {
      if (candPath && fs.existsSync(candPath)) {
        try {
          await modelInstaller.importLocalModel({
            sourcePath: candPath,
            modelId: 'qwen3-8b',
            displayName: 'Qwen3-8B',
            variantTag: 'Q4_K_M',
            copyToManagedDir: false
          });
          console.log(`ASTRO: Auto-registered model Qwen3-8B-Q4_K_M.gguf from "${candPath}" successfully.`);
          break;
        } catch (e) {
          console.warn('ASTRO: Workspace model auto-registration note:', e.message);
        }
      }
    }
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  try {
    codingService.cancelActiveCommands();
    await inferenceManager.unloadModel();
  } catch (e) {
    // Graceful cleanup
  }
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

ipcMain.handle('activity:clear-all', async () => {
  activityService.tasks.clear();
  activityService.emit('change', []);
  return true;
});

// --- Models IPC ---
ipcMain.handle('models:catalog', async () => {
  return storageService.getCatalog();
});

ipcMain.handle('models:registry', async () => {
  return modelRegistry.getAllEntries();
});

ipcMain.handle('models:state', async (event, modelId) => {
  return modelLifecycle.getModelState(modelId);
});

ipcMain.handle('models:queue', async () => {
  return downloadManager.getQueue();
});

ipcMain.handle('models:discover', async (event, repoId, token) => {
  const settings = storageService.getSettings();
  const task = activityService.createTask({
    type: 'model-discovery',
    label: `Discovering ${repoId || 'Qwen'}`,
    details: 'Querying Hugging Face API'
  });
  try {
    const res = await hfDiscovery.discoverModelVariants(repoId || 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF', {
      token,
      offlineOnly: settings.privacy.offlineOnly
    });
    activityService.completeTask(task.id, `Found ${res.totalVariants} variants`);
    return res;
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

ipcMain.handle('models:download', async (event, { url, filename, expectedSizeBytes, token, modelId, variantTag }) => {
  const settings = storageService.getSettings();
  if (settings.privacy.offlineOnly && !settings.privacy.allowExternalServices) {
    throw new Error('Offline mode is active: Internet downloads are disabled in privacy settings.');
  }

  if (modelId && modelLifecycle) {
    try { modelLifecycle.transition(modelId, 'queued'); } catch (e) {}
  }

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
    if (modelId && modelLifecycle) {
      try { modelLifecycle.transition(modelId, 'downloading'); } catch (e) {}
    }
    const res = await downloadManager.downloadFile(url, filename, expectedSizeBytes, token);
    activityService.completeTask(task.id, 'Downloaded to partial-downloads');
    return res;
  } catch (err) {
    if (err.message.includes('cancelled')) {
      activityService.cancelTask(task.id);
      if (modelId && modelLifecycle) {
        try { modelLifecycle.transition(modelId, 'not-installed'); } catch (e) {}
      }
    } else {
      activityService.failTask(task.id, err.message);
      if (modelId && modelLifecycle) {
        try { modelLifecycle.transition(modelId, 'failed', err.message); } catch (e) {}
      }
    }
    throw err;
  } finally {
    downloadManager.removeListener('progress', progressHandler);
  }
});

ipcMain.handle('models:pause-download', async (event, filename) => {
  return downloadManager.pauseDownload(filename);
});

ipcMain.handle('models:cancel-download', async (event, filename) => {
  const ok = downloadManager.cancelDownload(filename);
  activityService.cancelTask(`dl_${filename}`);
  return ok;
});

ipcMain.handle('models:retry-download', async (event, filename) => {
  const queue = downloadManager.getQueue();
  const item = queue.find(q => q.filename === filename);
  if (!item) throw new Error(`Download item for ${filename} not found in queue.`);
  return downloadManager.downloadFile(item.url, item.filename, item.expectedSizeBytes);
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

ipcMain.handle('models:import-local', async (event, args) => {
  const filename = path.basename(args.sourcePath || '');
  const task = activityService.createTask({
    type: 'model-install',
    label: `Importing Local Model: ${filename}`,
    details: 'Verifying GGUF magic header & registering'
  });
  try {
    const res = await modelInstaller.importLocalModel(args);
    activityService.completeTask(task.id, 'Verified and registered in ASTRO');
    return res;
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

ipcMain.handle('models:detect-workspace-models', async () => {
  const results = [];
  const searchDirs = [
    process.cwd(),
    path.dirname(process.execPath),
    storageService.paths.base,
    storageService.paths.models,
    path.join(require('os').homedir(), 'Downloads'),
    'c:\\aditya\\ASTRO'
  ];
  const seenPaths = new Set();

  for (const dir of searchDirs) {
    if (!dir || !fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.toLowerCase().endsWith('.gguf')) {
          const fullPath = path.resolve(path.join(dir, file));
          if (seenPaths.has(fullPath)) continue;
          seenPaths.add(fullPath);

          const stat = fs.statSync(fullPath);
          const header = downloadVerifier.verifyGGUFHeader(fullPath);
          const isQwen3 = file.toLowerCase().includes('qwen3');
          const isQwen25 = file.toLowerCase().includes('qwen2.5');
          const qwen3Entry = modelRegistry.getEntry('qwen3-8b');
          const isRegistered = Boolean(qwen3Entry && path.resolve(qwen3Entry.filePath) === fullPath);

          results.push({
            filename: file,
            filePath: fullPath,
            sizeBytes: stat.size,
            sizeGB: Number((stat.size / (1024 ** 3)).toFixed(2)),
            validHeader: header.valid,
            version: header.version,
            tensorCount: header.tensorCount,
            matchedModelId: isQwen3 ? 'qwen3-8b' : (isQwen25 ? 'qwen2.5-coder-7b-instruct' : 'custom-gguf'),
            matchedQuant: 'Q4_K_M',
            isRegistered
          });
        }
      }
    } catch (e) {}
  }
  return results;
});

ipcMain.handle('models:uninstall', async (event, modelId) => {
  if (inferenceManager.loadedModel && inferenceManager.loadedModel.modelId === modelId) {
    await inferenceManager.unloadModel();
  }
  return modelInstaller.uninstallModel(modelId);
});

ipcMain.handle('models:change-storage-dir', async (event, newDir) => {
  return modelRegistry.migrateStorageLocation(newDir);
});

ipcMain.handle('models:add-custom-repo', async (event, repoId) => {
  const validatedId = hfDiscovery.validateRepoIdentifier(repoId);
  const discovered = await hfDiscovery.discoverModelVariants(validatedId);
  
  // Add to catalog
  const catalog = storageService.getCatalog();
  const existing = catalog.models.find(m => m.id === validatedId || m.repoId === validatedId);
  if (!existing) {
    const customEntry = {
      id: validatedId.replace(/\//g, '-').toLowerCase(),
      name: validatedId,
      author: discovered.author,
      repoId: validatedId,
      license: discovered.license,
      description: `Custom model repository added by user (${discovered.totalVariants} GGUF variants found).`,
      format: 'GGUF',
      contextLength: 32768,
      isDefault: false,
      hardwareRequirement: {
        minRamGB: 8,
        recommendedRamGB: 16,
        minFreeDiskGB: 8,
        cpuTarget: 'x86_64 AVX2'
      },
      quantizations: discovered.variants.map(v => ({
        tag: v.quantTag,
        filename: v.filename,
        recommended: v.isRecommended,
        approxSizeGB: v.sizeGB,
        description: `${v.quantTag} quantization (~${v.sizeGB} GB)`
      }))
    };
    catalog.models.push(customEntry);
    storageService.saveCatalog(catalog);
  }
  return discovered;
});

ipcMain.handle('models:inspect-file', async (event, filePath) => {
  const { GGUFInspector } = require('./services/models/gguf-inspector');
  const inspection = GGUFInspector.inspect(filePath);
  const existing = modelRegistry.findEntryByPath(filePath);

  activityService.createTask({
    type: 'model-inspect',
    label: `Inspecting Model File`,
    details: `${path.basename(filePath)} (${inspection.architecture || 'unknown'}, ${inspection.fileSizeGB || 0} GB)`
  });

  return {
    ...inspection,
    alreadyRegistered: Boolean(existing),
    existingEntry: existing
  };
});

ipcMain.handle('models:switch', async (event, { modelId, filePath }) => {
  const task = activityService.createTask({
    type: 'model-switch',
    label: `Switching to ${modelId}`,
    details: 'Unloading current model and allocating new model context'
  });
  try {
    const res = await inferenceManager.switchModel(modelId, filePath);
    activityService.completeTask(task.id, `Switched to ${modelId}`);
    return res;
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

ipcMain.handle('models:repair-path', async (event, { modelId, newPath }) => {
  const task = activityService.createTask({
    type: 'model-repair',
    label: `Repairing path for ${modelId}`,
    details: `Relocating to ${path.basename(newPath)}`
  });
  try {
    const updated = modelRegistry.repairModelPath(modelId, newPath);
    // Also update catalog entry
    const catalog = storageService.getCatalog();
    const entry = catalog.models.find(m => m.id === modelId);
    if (entry) {
      entry.localPath = updated.filePath;
      storageService.saveCatalog(catalog);
    }
    activityService.completeTask(task.id, 'Path repaired and verified');
    return updated;
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

ipcMain.handle('models:unregister', async (event, modelId) => {
  const task = activityService.createTask({
    type: 'model-unregister',
    label: `Unregistering ${modelId}`,
    details: 'Removing registration from library (preserving underlying file)'
  });
  try {
    if (inferenceManager.loadedModel && inferenceManager.loadedModel.modelId === modelId) {
      await inferenceManager.unloadModel();
    }
    const res = modelInstaller.unregisterModel(modelId);
    activityService.completeTask(task.id, 'Model unregistered');
    return res;
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

ipcMain.handle('models:search-catalog', async (event, query) => {
  if (!query || typeof query !== 'string') return [];
  const q = query.toLowerCase().trim();
  const catalog = storageService.getCatalog();
  const registryEntries = modelRegistry.getAllEntries();

  const results = [];
  // 1. Registered models
  for (const reg of registryEntries) {
    if (reg.modelId.toLowerCase().includes(q) || reg.displayName.toLowerCase().includes(q)) {
      results.push({
        source: 'registered',
        modelId: reg.modelId,
        displayName: reg.displayName,
        quantization: reg.quantization,
        sizeGB: reg.actualSizeBytes ? Number((reg.actualSizeBytes / (1024 ** 3)).toFixed(2)) : null,
        filePath: reg.filePath,
        storageType: reg.storageType,
        isInstalled: true
      });
    }
  }

  // 2. Catalog models
  for (const cat of catalog.models) {
    if (results.some(r => r.modelId === cat.id)) continue;
    if (cat.id.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q) || (cat.repoId && cat.repoId.toLowerCase().includes(q))) {
      results.push({
        source: 'catalog',
        modelId: cat.id,
        displayName: cat.name,
        repoId: cat.repoId,
        license: cat.license,
        isInstalled: Boolean(cat.installed),
        quantizations: cat.quantizations
      });
    }
  }

  return results;
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

ipcMain.handle('chat:send', async (event, { message, mode = 'local-files', selectedSources = [], useRAG = true }) => {
  const task = activityService.createTask({
    type: 'inference',
    label: 'Generating assistant response',
    details: mode === 'general-assistant' ? 'Direct assistant inference' : (mode === 'selected-sources' ? `Grounded in ${selectedSources.length} selected sources` : 'Grounded in local file library'),
    cancellable: true
  });
  try {
    const res = await assistantCoordinator.handleUserMessage({
      message,
      mode,
      selectedSources,
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
ipcMain.handle('rag:query', async (event, query, topK, filters) => {
  return ragService.query(query, topK, filters);
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

// --- File Library & Incremental Indexing IPC (Phase 5) ---
ipcMain.handle('rag:library:roots', async () => {
  return ragService.getLibraryRoots();
});

ipcMain.handle('rag:library:add-folder', async (event, folderPath) => {
  return ragService.addLibraryFolder(folderPath);
});

ipcMain.handle('rag:library:add-file', async (event, filePath) => {
  return ragService.addLibraryFile(filePath);
});

ipcMain.handle('rag:library:remove-root', async (event, rootPath) => {
  return ragService.removeLibraryRoot(rootPath);
});

ipcMain.handle('rag:library:files', async () => {
  return ragService.getLibraryFiles();
});

ipcMain.handle('rag:library:exclusions-get', async () => {
  return ragService.getExclusions();
});

ipcMain.handle('rag:library:exclusions-set', async (event, exclusions) => {
  return ragService.setExclusions(exclusions);
});

ipcMain.handle('rag:library:index', async () => {
  const task = activityService.createTask({
    type: 'library-indexing',
    label: 'Incremental File Library Indexing',
    details: 'Scanning and indexing modified files',
    cancellable: true
  });

  try {
    const summary = await ragService.indexLibrary({
      onProgress: (p) => {
        const percent = p.total > 0 ? Math.round((p.processed / p.total) * 100) : 0;
        activityService.updateProgress(task.id, percent, `${p.processed}/${p.total} · ${p.filename}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('rag:indexing-progress', p);
        }
      }
    });
    activityService.completeTask(task.id, `Indexed: ${summary.indexed}, Skipped: ${summary.skipped}, Failed: ${summary.failed}`);
    return summary;
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

ipcMain.handle('rag:library:stop-indexing', async () => {
  ragService.stopIndexing();
  return true;
});

ipcMain.handle('rag:library:rebuild', async () => {
  const task = activityService.createTask({
    type: 'library-rebuild',
    label: 'Rebuilding File Index',
    details: 'Clearing and re-extracting all files',
    cancellable: true
  });

  try {
    const summary = await ragService.rebuildIndex({
      onProgress: (p) => {
        const percent = p.total > 0 ? Math.round((p.processed / p.total) * 100) : 0;
        activityService.updateProgress(task.id, percent, `${p.processed}/${p.total} · ${p.filename}`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('rag:indexing-progress', p);
        }
      }
    });
    activityService.completeTask(task.id, `Rebuilt: ${summary.indexed} indexed, ${summary.failed} failed`);
    return summary;
  } catch (err) {
    activityService.failTask(task.id, err.message);
    throw err;
  }
});

// --- Embedding Model Lifecycle IPC (Phase 5) ---
ipcMain.handle('rag:embedding:status', async () => {
  return ragService.embeddingManager.getStatus();
});

ipcMain.handle('rag:embedding:catalog', async () => {
  return ragService.embeddingManager.getCatalog();
});

ipcMain.handle('rag:embedding:load', async (event, modelId, filePath) => {
  return ragService.embeddingManager.loadEmbeddingModel(modelId, filePath);
});

ipcMain.handle('rag:embedding:unload', async () => {
  return ragService.embeddingManager.unloadEmbeddingModel();
});

ipcMain.handle('rag:format-registry', async () => {
  return ragService.extractorRegistry.getRegisteredFormats();
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

ipcMain.handle('research:save-finding', async (event, finding, collection) => {
  return researchService.saveFindingToLibrary(finding, collection);
});

// --- Voice IPC (Phase 6) ---
ipcMain.handle('voice:status', async () => {
  return voiceService.getEngineStatus();
});

ipcMain.handle('voice:start', async (event, options) => {
  return voiceService.startListening(options);
});

ipcMain.handle('voice:stop', async () => {
  return voiceService.stopListening();
});

ipcMain.handle('voice:cancel', async () => {
  return voiceService.cancelListening();
});

ipcMain.handle('voice:tts-preference', async (event, enabled) => {
  return voiceService.setSpokenResponsePreference(enabled);
});

ipcMain.handle('voice:stop-speaking', async () => {
  return voiceService.stopSpeaking();
});

ipcMain.handle('voice:clean-speech-text', async (event, text) => {
  return voiceService.cleanTextForSpeech(text);
});

ipcMain.handle('voice:segment-sentences', async (event, text) => {
  return voiceService.segmentSentences(text);
});

ipcMain.handle('voice:set-settings', async (event, settings) => {
  if (settings) {
    if (settings.speechRate !== undefined) voiceService.setSpeechRate(settings.speechRate);
    if (settings.preferredVoice !== undefined) voiceService.setPreferredVoice(settings.preferredVoice);
    if (settings.wakeWordEnabled !== undefined) voiceService.setWakeWordEnabled(settings.wakeWordEnabled);
  }
  return voiceService.getEngineStatus();
});

ipcMain.handle('voice:update-transcription', async (event, text, isFinal) => {
  return voiceService.updateTranscription(text, isFinal);
});

// --- Safe Desktop Actions IPC (Phase 6) ---
ipcMain.handle('actions:list-supported', async () => {
  return actionService.listSupportedActions();
});

ipcMain.handle('actions:get-allowed-apps', async () => {
  return actionService.getAllowedApps();
});

ipcMain.handle('actions:set-allowed-apps', async (event, apps) => {
  return actionService.setAllowedApps(apps);
});

ipcMain.handle('actions:request', async (event, actionId, params, options) => {
  return actionService.requestAction(actionId, params, options);
});

ipcMain.handle('actions:get-pending', async () => {
  return actionService.getPendingActions();
});

ipcMain.handle('actions:confirm', async (event, requestId) => {
  return actionService.confirmAction(requestId, true);
});

ipcMain.handle('actions:cancel', async (event, requestId, reason) => {
  return actionService.cancelAction(requestId, reason);
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

ipcMain.handle('coding:apply-diff', async (event, filePath, newContent, confirmed, options) => {
  return codingService.applyApprovedChange(filePath, newContent, confirmed, options);
});

ipcMain.handle('coding:revert', async (event, filePath, backupPath) => {
  return codingService.revertFileChange(filePath, backupPath);
});

ipcMain.handle('coding:history', async (event, filePath) => {
  return codingService.getChangeHistory(filePath);
});

ipcMain.handle('coding:cancel', async () => {
  return codingService.cancelActiveCommands();
});

// --- Project Intelligence IPC (Phase 7) ---
ipcMain.handle('project:open', async (event, projectPath) => {
  return projectIntelligence.setActiveProject(projectPath);
});

ipcMain.handle('project:get-active', async () => {
  return projectIntelligence.getActiveProject();
});

ipcMain.handle('project:close', async () => {
  return projectIntelligence.setActiveProject(null);
});

ipcMain.handle('project:analyze', async (event, projectPath) => {
  return projectIntelligence.analyzeProject(projectPath);
});

ipcMain.handle('project:search-code', async (event, query, options) => {
  return projectIntelligence.searchProjectCode(query, options);
});

ipcMain.handle('project:symbols', async (event, filePath) => {
  return projectIntelligence.extractSymbols(filePath);
});

ipcMain.handle('project:check-credential', async (event, filePath) => {
  return projectIntelligence.isCredentialFile(filePath);
});

ipcMain.handle('coding:exec', async (event, command, cwd, confirmed, options) => {
  const task = activityService.createTask({
    type: 'code-execution',
    label: `Terminal: ${command.slice(0, 30)}`,
    details: 'Executing approved command'
  });
  try {
    const res = await codingService.executeApprovedCommand(command, cwd || process.cwd(), confirmed, options);
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
