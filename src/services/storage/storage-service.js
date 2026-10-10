const fs = require('fs');
const path = require('path');
const { ASTRO_DATA_DIR, DEFAULT_SETTINGS } = require('../../config/default-settings');
const { APPROVED_MODELS } = require('../../config/model-catalog');

class StorageService {
  constructor(baseDir = ASTRO_DATA_DIR) {
    this.baseDir = baseDir;
    this.paths = {
      base: this.baseDir,
      models: path.join(this.baseDir, 'models'),
      downloads: path.join(this.baseDir, 'downloads', 'partial-downloads'),
      conversations: path.join(this.baseDir, 'databases', 'conversations'),
      ragIndex: path.join(this.baseDir, 'databases', 'rag-index'),
      extractionCache: path.join(this.baseDir, 'documents', 'extraction-cache'),
      settings: path.join(this.baseDir, 'settings'),
      logs: path.join(this.baseDir, 'logs'),
      catalogFile: path.join(this.baseDir, 'models', 'catalog.json'),
      activeModelFile: path.join(this.baseDir, 'models', 'active-model.json'),
      settingsFile: path.join(this.baseDir, 'settings', 'astro-settings.json')
    };
  }

  ensureDirectories() {
    Object.entries(this.paths).forEach(([key, dirPath]) => {
      if (key.endsWith('File')) return;
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });

    if (!fs.existsSync(this.paths.catalogFile)) {
      const initialCatalog = {
        version: '1.0',
        updatedAt: new Date().toISOString(),
        models: APPROVED_MODELS.map(m => ({
          ...m,
          installed: false,
          installedFiles: []
        }))
      };
      fs.writeFileSync(this.paths.catalogFile, JSON.stringify(initialCatalog, null, 2), 'utf8');
    }

    if (!fs.existsSync(this.paths.settingsFile)) {
      fs.writeFileSync(this.paths.settingsFile, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8');
    }
  }

  getCatalog() {
    this.ensureDirectories();
    try {
      const data = fs.readFileSync(this.paths.catalogFile, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error('Error reading catalog:', err);
      return { models: APPROVED_MODELS };
    }
  }

  saveCatalog(catalogData) {
    if (!fs.existsSync(path.dirname(this.paths.catalogFile))) {
      this.ensureDirectories();
    }
    fs.writeFileSync(this.paths.catalogFile, JSON.stringify(catalogData, null, 2), 'utf8');
  }

  getActiveModel() {
    this.ensureDirectories();
    if (!fs.existsSync(this.paths.activeModelFile)) {
      return null;
    }
    try {
      const data = fs.readFileSync(this.paths.activeModelFile, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      return null;
    }
  }

  setActiveModel(modelInfo) {
    if (!fs.existsSync(path.dirname(this.paths.activeModelFile))) {
      this.ensureDirectories();
    }
    if (!modelInfo) {
      if (fs.existsSync(this.paths.activeModelFile)) {
        fs.unlinkSync(this.paths.activeModelFile);
      }
      return null;
    }
    fs.writeFileSync(this.paths.activeModelFile, JSON.stringify(modelInfo, null, 2), 'utf8');
    return modelInfo;
  }

  getSettings() {
    this.ensureDirectories();
    try {
      const data = fs.readFileSync(this.paths.settingsFile, 'utf8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch (err) {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings) {
    if (!fs.existsSync(path.dirname(this.paths.settingsFile))) {
      this.ensureDirectories();
    }
    fs.writeFileSync(this.paths.settingsFile, JSON.stringify(settings, null, 2), 'utf8');
    return settings;
  }

  appendLog(level, message, meta = {}) {
    this.ensureDirectories();
    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(this.paths.logs, `astro-${logDate}.log`);
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      meta
    }) + '\n';
    fs.appendFileSync(logFile, line, 'utf8');
  }
}

module.exports = {
  StorageService
};
