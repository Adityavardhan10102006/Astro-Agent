const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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
const { APPROVED_MODELS } = require('./config/model-catalog');

let mainWindow = null;

// Initialize services
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
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
  // Check offline-first settings
  const settings = storageService.getSettings();
  return {
    offlineOnly: settings.privacy.offlineOnly,
    onlineDetected: false // Default to offline-first
  };
});

// Models IPC
ipcMain.handle('models:catalog', async () => {
  return storageService.getCatalog();
});

ipcMain.handle('models:discover', async (event, repoId, token) => {
  return hfDiscovery.discoverModelVariants(repoId || 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF', token);
});

ipcMain.handle('models:download', async (event, { url, filename, expectedSizeBytes, token }) => {
  return downloadManager.downloadFile(url, filename, expectedSizeBytes, token);
});

ipcMain.handle('models:cancel-download', async (event, filename) => {
  return downloadManager.cancelDownload(filename);
});

ipcMain.handle('models:install', async (event, args) => {
  return modelInstaller.installVerifiedModel(args);
});

ipcMain.handle('models:uninstall', async (event, modelId) => {
  if (inferenceManager.loadedModel && inferenceManager.loadedModel.modelId === modelId) {
    await inferenceManager.unloadModel();
  }
  return modelInstaller.uninstallModel(modelId);
});

// Inference IPC
ipcMain.handle('inference:active-model', async () => {
  return inferenceManager.getLoadedModelInfo();
});

ipcMain.handle('inference:load', async (event, modelId, filePath) => {
  return inferenceManager.loadModel(modelId, filePath);
});

ipcMain.handle('inference:unload', async () => {
  return inferenceManager.unloadModel();
});

ipcMain.handle('chat:send', async (event, { message, useRAG }) => {
  return assistantCoordinator.handleUserMessage({
    message,
    useRAG,
    onToken: (chunk) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chat:token', chunk);
      }
    }
  });
});

ipcMain.handle('chat:stop', async () => {
  return inferenceManager.stopGeneration();
});

// Conversations IPC
ipcMain.handle('conversations:list', async () => {
  return assistantCoordinator.getConversationsList();
});

ipcMain.handle('conversations:new', async () => {
  return assistantCoordinator.startNewConversation();
});

// RAG IPC
ipcMain.handle('rag:query', async (event, query) => {
  return ragService.query(query);
});

ipcMain.handle('rag:index-doc', async (event, filePath) => {
  const content = fileService.readFileContent(filePath);
  const chunkCount = ragService.addDocument(filePath, content);
  return { success: true, filePath, chunkCount };
});

ipcMain.handle('rag:stats', async () => {
  return ragService.getIndexStats();
});

// Files & Coding IPC
ipcMain.handle('files:list', async (event, dirPath) => {
  return fileService.listFiles(dirPath || process.cwd());
});

ipcMain.handle('files:search', async (event, dirPath, query) => {
  return fileService.searchFiles(dirPath || process.cwd(), query);
});

ipcMain.handle('files:read', async (event, filePath) => {
  return fileService.readFileContent(filePath);
});

ipcMain.handle('files:write', async (event, filePath, content, confirmed) => {
  return fileService.backupAndWriteFile(filePath, content);
});

ipcMain.handle('coding:diff', async (event, filePath, newContent) => {
  return codingService.proposeFileChange(filePath, newContent);
});

ipcMain.handle('coding:apply-diff', async (event, filePath, newContent, confirmed) => {
  return codingService.applyApprovedChange(filePath, newContent, confirmed);
});

ipcMain.handle('coding:exec', async (event, command, cwd, confirmed) => {
  return codingService.executeApprovedCommand(command, cwd || process.cwd(), confirmed);
});

// Platform Dialogs
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

// Settings IPC
ipcMain.handle('settings:get', async () => {
  return storageService.getSettings();
});

ipcMain.handle('settings:save', async (event, settings) => {
  return storageService.saveSettings(settings);
});
