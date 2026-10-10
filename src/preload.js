const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astroApi', {
  // System & Hardware
  getHardwareSpecs: () => ipcRenderer.invoke('system:specs'),
  checkModelCompatibility: (modelId, quantTag) => ipcRenderer.invoke('system:check-compatibility', modelId, quantTag),
  getNetworkStatus: () => ipcRenderer.invoke('system:network-status'),

  // Activity Service
  getActivityTasks: () => ipcRenderer.invoke('activity:list'),
  clearCompletedActivities: () => ipcRenderer.invoke('activity:clear-completed'),
  onActivityChanged: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('activity:changed', handler);
    return () => ipcRenderer.removeListener('activity:changed', handler);
  },

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
  loadConversation: (convId) => ipcRenderer.invoke('conversations:load', convId),
  renameConversation: (convId, newTitle) => ipcRenderer.invoke('conversations:rename', convId, newTitle),
  deleteConversation: (convId) => ipcRenderer.invoke('conversations:delete', convId),
  startNewConversation: () => ipcRenderer.invoke('conversations:new'),

  // RAG & Knowledge Collections
  queryRAG: (query) => ipcRenderer.invoke('rag:query', query),
  indexDocument: (filePath) => ipcRenderer.invoke('rag:index-doc', filePath),
  removeDocumentFromRAG: (filePath) => ipcRenderer.invoke('rag:remove-doc', filePath),
  getRAGStats: () => ipcRenderer.invoke('rag:stats'),
  listRAGCollections: () => ipcRenderer.invoke('rag:list-collections'),
  createRAGCollection: (name) => ipcRenderer.invoke('rag:create-collection', name),
  renameRAGCollection: (oldName, newName) => ipcRenderer.invoke('rag:rename-collection', oldName, newName),
  deleteRAGCollection: (name) => ipcRenderer.invoke('rag:delete-collection', name),
  switchRAGCollection: (name) => ipcRenderer.invoke('rag:switch-collection', name),

  // Research Service
  performResearch: (args) => ipcRenderer.invoke('research:query', args),
  cancelResearch: () => ipcRenderer.invoke('research:cancel'),

  // Voice Service
  getVoiceStatus: () => ipcRenderer.invoke('voice:status'),
  startListening: () => ipcRenderer.invoke('voice:start'),
  stopListening: () => ipcRenderer.invoke('voice:stop'),
  setTTSPreference: (enabled) => ipcRenderer.invoke('voice:tts-preference', enabled),
  stopSpeaking: () => ipcRenderer.invoke('voice:stop-speaking'),

  // Files & Coding
  listFiles: (dirPath, filter) => ipcRenderer.invoke('files:list', dirPath, filter),
  searchFiles: (dirPath, query, filter) => ipcRenderer.invoke('files:search', dirPath, query, filter),
  getFileDetails: (filePath) => ipcRenderer.invoke('files:details', filePath),
  readFile: (filePath) => ipcRenderer.invoke('files:read', filePath),
  writeFileWithBackup: (filePath, content, confirmed) => ipcRenderer.invoke('files:write', filePath, content, confirmed),
  proposeDiff: (filePath, newContent) => ipcRenderer.invoke('coding:diff', filePath, newContent),
  applyDiff: (filePath, newContent, confirmed) => ipcRenderer.invoke('coding:apply-diff', filePath, newContent, confirmed),
  execCommand: (command, cwd, confirmed) => ipcRenderer.invoke('coding:exec', command, cwd, confirmed),
  getExclusions: () => ipcRenderer.invoke('files:exclusions-get'),
  setExclusions: (dirs) => ipcRenderer.invoke('files:exclusions-set', dirs),

  // Platform dialogs & OS integration
  pickFolder: () => ipcRenderer.invoke('platform:pick-folder'),
  pickFile: (filters) => ipcRenderer.invoke('platform:pick-file', filters),
  openPathInOS: (targetPath) => ipcRenderer.invoke('platform:open-path', targetPath),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  clearAllUserData: () => ipcRenderer.invoke('settings:clear-data')
});
