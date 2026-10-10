const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astroApi', {
  // System & Hardware
  getHardwareSpecs: () => ipcRenderer.invoke('system:specs'),
  checkModelCompatibility: (modelId, quantTag) => ipcRenderer.invoke('system:check-compatibility', modelId, quantTag),
  getNetworkStatus: () => ipcRenderer.invoke('system:network-status'),

  // Models
  getCatalog: () => ipcRenderer.invoke('models:catalog'),
  discoverModel: (repoId, token) => ipcRenderer.invoke('models:discover', repoId, token),
  downloadModel: (args) => ipcRenderer.invoke('models:download', args),
  cancelDownload: (filename) => ipcRenderer.invoke('models:cancel-download', filename),
  installModel: (args) => ipcRenderer.invoke('models:install', args),
  uninstallModel: (modelId) => ipcRenderer.invoke('models:uninstall', modelId),
  onDownloadProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },

  // Inference & Chat
  getActiveModel: () => ipcRenderer.invoke('inference:active-model'),
  loadModel: (modelId, filePath) => ipcRenderer.invoke('inference:load', modelId, filePath),
  unloadModel: () => ipcRenderer.invoke('inference:unload'),
  sendMessage: (args) => ipcRenderer.invoke('chat:send', args),
  stopGeneration: () => ipcRenderer.invoke('chat:stop'),
  onTokenChunk: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('chat:token', handler);
    return () => ipcRenderer.removeListener('chat:token', handler);
  },

  // Conversations
  getConversations: () => ipcRenderer.invoke('conversations:list'),
  startNewConversation: () => ipcRenderer.invoke('conversations:new'),

  // RAG & Knowledge
  queryRAG: (query) => ipcRenderer.invoke('rag:query', query),
  indexDocument: (filePath) => ipcRenderer.invoke('rag:index-doc', filePath),
  getRAGStats: () => ipcRenderer.invoke('rag:stats'),

  // Files & Coding
  listFiles: (dirPath) => ipcRenderer.invoke('files:list', dirPath),
  searchFiles: (dirPath, query) => ipcRenderer.invoke('files:search', dirPath, query),
  readFile: (filePath) => ipcRenderer.invoke('files:read', filePath),
  writeFileWithBackup: (filePath, content, confirmed) => ipcRenderer.invoke('files:write', filePath, content, confirmed),
  proposeDiff: (filePath, newContent) => ipcRenderer.invoke('coding:diff', filePath, newContent),
  applyDiff: (filePath, newContent, confirmed) => ipcRenderer.invoke('coding:apply-diff', filePath, newContent, confirmed),
  execCommand: (command, cwd, confirmed) => ipcRenderer.invoke('coding:exec', command, cwd, confirmed),

  // Platform dialogs
  pickFolder: () => ipcRenderer.invoke('platform:pick-folder'),
  pickFile: (filters) => ipcRenderer.invoke('platform:pick-file', filters),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings)
});
