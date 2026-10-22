const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astroApi', {
  // System & Hardware
  getHardwareSpecs: () => ipcRenderer.invoke('system:specs'),
  checkModelCompatibility: (modelId, quantTag) => ipcRenderer.invoke('system:check-compatibility', modelId, quantTag),
  getNetworkStatus: () => ipcRenderer.invoke('system:network-status'),

  // Activity Service
  getActivityTasks: () => ipcRenderer.invoke('activity:list'),
  clearCompletedActivities: () => ipcRenderer.invoke('activity:clear-completed'),
  clearAllActivities: () => ipcRenderer.invoke('activity:clear-all'),
  onActivityChanged: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('activity:changed', handler);
    return () => ipcRenderer.removeListener('activity:changed', handler);
  },

  // Models
  getCatalog: () => ipcRenderer.invoke('models:catalog'),
  getModelRegistry: () => ipcRenderer.invoke('models:registry'),
  getModelState: (modelId) => ipcRenderer.invoke('models:state', modelId),
  getDownloadQueue: () => ipcRenderer.invoke('models:queue'),
  discoverModel: (repoId, token) => ipcRenderer.invoke('models:discover', repoId, token),
  downloadModel: (args) => ipcRenderer.invoke('models:download', args),
  pauseDownload: (filename) => ipcRenderer.invoke('models:pause-download', filename),
  cancelDownload: (filename) => ipcRenderer.invoke('models:cancel-download', filename),
  retryDownload: (filename) => ipcRenderer.invoke('models:retry-download', filename),
  installModel: (args) => ipcRenderer.invoke('models:install', args),
  importLocalModel: (args) => ipcRenderer.invoke('models:import-local', args),
  detectWorkspaceModels: () => ipcRenderer.invoke('models:detect-workspace-models'),
  inspectModelFile: (filePath) => ipcRenderer.invoke('models:inspect-file', filePath),
  checkModelPreflight: (args) => ipcRenderer.invoke('models:preflight', args),
  switchActiveModel: (modelId, filePath, options = {}) => ipcRenderer.invoke('models:switch', { modelId, filePath, ...options }),
  repairModelPath: (modelId, newPath) => ipcRenderer.invoke('models:repair-path', { modelId, newPath }),
  unregisterModel: (modelId) => ipcRenderer.invoke('models:unregister', modelId),
  searchModelCatalog: (query) => ipcRenderer.invoke('models:search-catalog', query),
  uninstallModel: (modelId) => ipcRenderer.invoke('models:uninstall', modelId),
  changeModelStorageDir: (newDir) => ipcRenderer.invoke('models:change-storage-dir', newDir),
  addCustomModelRepo: (repoId) => ipcRenderer.invoke('models:add-custom-repo', repoId),

  onDownloadProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },
  onModelLifecycleChange: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('models:lifecycle-changed', handler);
    return () => ipcRenderer.removeListener('models:lifecycle-changed', handler);
  },

  // Inference & Chat
  getActiveModel: () => ipcRenderer.invoke('inference:active-model'),
  loadModel: (modelId, filePath, options = {}) => ipcRenderer.invoke('inference:load', modelId, filePath, options),
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
  queryRAG: (query, topK, filters) => ipcRenderer.invoke('rag:query', query, topK, filters),
  indexDocument: (filePath) => ipcRenderer.invoke('rag:index-doc', filePath),
  removeDocumentFromRAG: (filePath) => ipcRenderer.invoke('rag:remove-doc', filePath),
  getRAGStats: () => ipcRenderer.invoke('rag:stats'),
  listRAGCollections: () => ipcRenderer.invoke('rag:list-collections'),
  createRAGCollection: (name) => ipcRenderer.invoke('rag:create-collection', name),
  renameRAGCollection: (oldName, newName) => ipcRenderer.invoke('rag:rename-collection', oldName, newName),
  deleteRAGCollection: (name) => ipcRenderer.invoke('rag:delete-collection', name),
  switchRAGCollection: (name) => ipcRenderer.invoke('rag:switch-collection', name),

  // File Library & Incremental Indexing (Phase 5)
  getLibraryRoots: () => ipcRenderer.invoke('rag:library:roots'),
  addLibraryFolder: (folderPath) => ipcRenderer.invoke('rag:library:add-folder', folderPath),
  addLibraryFile: (filePath) => ipcRenderer.invoke('rag:library:add-file', filePath),
  removeLibraryRoot: (rootPath) => ipcRenderer.invoke('rag:library:remove-root', rootPath),
  getLibraryFiles: () => ipcRenderer.invoke('rag:library:files'),
  indexLibrary: () => ipcRenderer.invoke('rag:library:index'),
  stopIndexing: () => ipcRenderer.invoke('rag:library:stop-indexing'),
  rebuildIndex: () => ipcRenderer.invoke('rag:library:rebuild'),
  getLibraryExclusions: () => ipcRenderer.invoke('rag:library:exclusions-get'),
  setLibraryExclusions: (exclusions) => ipcRenderer.invoke('rag:library:exclusions-set', exclusions),
  onIndexingProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('rag:indexing-progress', handler);
    return () => ipcRenderer.removeListener('rag:indexing-progress', handler);
  },

  // Embedding Model Lifecycle (Phase 5)
  getEmbeddingStatus: () => ipcRenderer.invoke('rag:embedding:status'),
  getEmbeddingCatalog: () => ipcRenderer.invoke('rag:embedding:catalog'),
  loadEmbeddingModel: (modelId, filePath) => ipcRenderer.invoke('rag:embedding:load', modelId, filePath),
  unloadEmbeddingModel: () => ipcRenderer.invoke('rag:embedding:unload'),
  getFormatRegistry: () => ipcRenderer.invoke('rag:format-registry'),

  // Research Service (Phase 7)
  performResearch: (args) => ipcRenderer.invoke('research:query', args),
  cancelResearch: () => ipcRenderer.invoke('research:cancel'),
  saveResearchFinding: (finding, collection) => ipcRenderer.invoke('research:save-finding', finding, collection),

  // Project Intelligence & Coding Studio (Phase 7)
  openProject: (projectPath) => ipcRenderer.invoke('project:open', projectPath),
  getActiveProject: () => ipcRenderer.invoke('project:get-active'),
  closeProject: () => ipcRenderer.invoke('project:close'),
  analyzeProject: (projectPath) => ipcRenderer.invoke('project:analyze', projectPath),
  searchProjectCode: (query, options) => ipcRenderer.invoke('project:search-code', query, options),
  getProjectSymbols: (filePath) => ipcRenderer.invoke('project:symbols', filePath),
  checkCredentialFile: (filePath) => ipcRenderer.invoke('project:check-credential', filePath),
  revertDiff: (filePath, backupPath) => ipcRenderer.invoke('coding:revert', filePath, backupPath),
  getChangeHistory: (filePath) => ipcRenderer.invoke('coding:history', filePath),
  cancelCommand: () => ipcRenderer.invoke('coding:cancel'),

  // Voice Service (Phase 6)
  getVoiceStatus: () => ipcRenderer.invoke('voice:status'),
  startListening: (options) => ipcRenderer.invoke('voice:start', options),
  stopListening: () => ipcRenderer.invoke('voice:stop'),
  cancelListening: () => ipcRenderer.invoke('voice:cancel'),
  setTTSPreference: (enabled) => ipcRenderer.invoke('voice:tts-preference', enabled),
  stopSpeaking: () => ipcRenderer.invoke('voice:stop-speaking'),
  cleanSpeechText: (text) => ipcRenderer.invoke('voice:clean-speech-text', text),
  segmentSentences: (text) => ipcRenderer.invoke('voice:segment-sentences', text),
  updateVoiceSettings: (settings) => ipcRenderer.invoke('voice:set-settings', settings),
  updateTranscription: (text, isFinal) => ipcRenderer.invoke('voice:update-transcription', text, isFinal),

  // Safe Desktop Actions (Phase 6)
  listSupportedActions: () => ipcRenderer.invoke('actions:list-supported'),
  getAllowedApps: () => ipcRenderer.invoke('actions:get-allowed-apps'),
  setAllowedApps: (apps) => ipcRenderer.invoke('actions:set-allowed-apps', apps),
  requestAction: (actionId, params, options) => ipcRenderer.invoke('actions:request', actionId, params, options),
  getPendingActions: () => ipcRenderer.invoke('actions:get-pending'),
  confirmAction: (requestId) => ipcRenderer.invoke('actions:confirm', requestId),
  cancelAction: (requestId, reason) => ipcRenderer.invoke('actions:cancel', requestId, reason),

  // Files & Coding
  listFiles: (dirPath, filter) => ipcRenderer.invoke('files:list', dirPath, filter),
  searchFiles: (dirPath, query, filter) => ipcRenderer.invoke('files:search', dirPath, query, filter),
  getFileDetails: (filePath) => ipcRenderer.invoke('files:details', filePath),
  readFile: (filePath) => ipcRenderer.invoke('files:read', filePath),
  writeFileWithBackup: (filePath, content, confirmed) => ipcRenderer.invoke('files:write', filePath, content, confirmed),
  proposeDiff: (filePath, newContent) => ipcRenderer.invoke('coding:diff', filePath, newContent),
  applyDiff: (filePath, newContent, confirmed, options) => ipcRenderer.invoke('coding:apply-diff', filePath, newContent, confirmed, options),
  execCommand: (command, cwd, confirmed, options) => ipcRenderer.invoke('coding:exec', command, cwd, confirmed, options),
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
