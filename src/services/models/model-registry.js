const fs = require('fs');
const path = require('path');

class ModelRegistry {
  constructor(storageService) {
    this.storage = storageService;
    this.registryFilePath = path.join(this.storage.paths.models, 'registry.json');
    this.entries = new Map(); // modelId -> ModelEntry
    this.loadRegistry();
  }

  loadRegistry() {
    this.storage.ensureDirectories();
    if (fs.existsSync(this.registryFilePath)) {
      try {
        const raw = fs.readFileSync(this.registryFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        this.entries = new Map(Object.entries(parsed));
      } catch (e) {
        console.error('Failed to parse model registry, starting fresh:', e.message);
        this.entries = new Map();
      }
    } else {
      this.entries = new Map();
      this.saveRegistry();
    }
  }

  saveRegistry() {
    this.storage.ensureDirectories();
    const obj = Object.fromEntries(this.entries.entries());
    fs.writeFileSync(this.registryFilePath, JSON.stringify(obj, null, 2), 'utf8');
  }

  getEntry(modelId) {
    return this.entries.get(modelId) || null;
  }

  getAllEntries() {
    return Array.from(this.entries.values());
  }

  getModel(modelId) {
    return this.getEntry(modelId);
  }

  listModels() {
    return this.getAllEntries();
  }

  findEntryByPath(filePath) {
    if (!filePath) return null;
    const normalized = path.resolve(filePath);
    for (const entry of this.entries.values()) {
      if (entry.filePath && path.resolve(entry.filePath) === normalized) {
        return entry;
      }
    }
    return null;
  }

  checkModelAvailability(modelId) {
    const entry = this.getEntry(modelId);
    if (!entry) return { registered: false, available: false, exists: false, entry: null };

    const fileExists = fs.existsSync(entry.filePath);
    let sizeBytes = 0;
    if (fileExists) {
      try {
        sizeBytes = fs.statSync(entry.filePath).size;
      } catch (e) {}
    }

    return {
      registered: true,
      available: fileExists,
      exists: fileExists,
      missing: !fileExists,
      filePath: entry.filePath,
      sizeBytes,
      storageType: entry.storageType || 'managed',
      entry
    };
  }

  repairModelPath(modelId, newPath) {
    if (!modelId || !newPath) {
      throw new Error('Both modelId and newPath are required to repair model registration.');
    }
    const entry = this.getEntry(modelId);
    if (!entry) {
      throw new Error(`Model "${modelId}" is not registered.`);
    }

    const resolved = path.resolve(newPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Repair failed: replacement file not found at "${resolved}".`);
    }

    const stat = fs.statSync(resolved);
    if (stat.size === 0) {
      throw new Error('Repair failed: replacement file is 0 bytes.');
    }

    const modelsBaseDir = path.resolve(this.storage.paths.models);
    const isManaged = resolved.startsWith(modelsBaseDir);

    entry.filePath = resolved;
    entry.installedPath = resolved;
    entry.fileName = path.basename(resolved);
    entry.actualSizeBytes = stat.size;
    entry.storageType = isManaged ? 'managed' : 'external';
    entry.repairedAt = new Date().toISOString();

    this.saveRegistry();
    return true;
  }

  unregisterModel(modelId) {
    if (!modelId || typeof modelId !== 'string' || modelId.includes('..') || modelId.includes('/') || modelId.includes('\\')) {
      throw new Error(`Invalid model ID '${modelId}': directory traversal is prohibited`);
    }

    const entry = this.entries.get(modelId);
    if (!entry) return false;

    // Remove from registry map WITHOUT deleting the underlying file
    this.entries.delete(modelId);
    this.saveRegistry();
    return true;
  }

  registerModel(args) {
    const {
      modelId,
      displayName,
      repoId,
      revision = null,
      format = 'GGUF',
      quantization,
      variantTag,
      filePath,
      installedPath,
      expectedSizeBytes,
      actualSizeBytes,
      license,
      verificationAudit,
      compatibility = {},
      architecture = null,
      status = 'installed',
      allowExternal = false
    } = args;

    const targetPath = filePath || installedPath;
    if (!targetPath) {
      throw new Error('Model path must be specified for registration.');
    }

    // Path safety validation (Rule 14 & Phase 3 Section 7 & Phase 13 Section 3)
    if (!modelId || typeof modelId !== 'string' || modelId.includes('..') || modelId.includes('/') || modelId.includes('\\')) {
      throw new Error(`Invalid model ID '${modelId}': directory traversal is prohibited`);
    }

    const normalizedFilePath = path.resolve(targetPath);
    const modelsBaseDir = path.resolve(this.storage.paths.models);
    const isInsideManaged = normalizedFilePath.startsWith(modelsBaseDir);

    // Ensure the file is inside the managed models directory, allowed workspace, or user confirmed external import
    const settings = this.storage?.getSettings ? this.storage.getSettings() : null;
    const allowedRoots = [
      modelsBaseDir,
      path.resolve(process.cwd()),
      path.resolve(path.dirname(process.execPath)),
      path.resolve(require('os').homedir()),
      'c:\\aditya\\ASTRO',
      ...(settings?.security?.allowedWorkspaceRoots || []).map(r => path.resolve(r))
    ];
    const isSafe = allowedRoots.some(root => normalizedFilePath.startsWith(root));
    if (!isSafe && !allowExternal) {
      throw new Error(`Unsafe model path: ${filePath} is outside managed model directory`);
    }

    const storageType = isInsideManaged ? 'managed' : 'external';

    const entry = {
      modelId,
      displayName: displayName || modelId,
      repoId,
      revision,
      format,
      architecture,
      quantization: quantization || variantTag,
      variantTag: variantTag || quantization,
      filePath: normalizedFilePath,
      installedPath: normalizedFilePath,
      fileName: path.basename(normalizedFilePath),
      storageType,
      isExternal: !isInsideManaged,
      expectedSizeBytes,
      actualSizeBytes,
      license: license || 'Apache-2.0',
      verificationAudit,
      compatibility,
      installedAt: new Date().toISOString(),
      lastLoadedAt: null,
      lastLoadStatus: null
    };

    this.entries.set(modelId, entry);
    this.saveRegistry();
    return entry;
  }

  recordLoadResult(modelId, success, loadTimeMs = 0, error = null) {
    const entry = this.entries.get(modelId);
    if (entry) {
      entry.lastLoadedAt = new Date().toISOString();
      entry.lastLoadStatus = {
        success,
        loadTimeMs,
        error: error ? (error.message || String(error)) : null
      };
      this.saveRegistry();
    }
  }

  deleteModel(modelId, deletePhysicalFile = true, confirmExternalDelete = false) {
    if (!modelId || typeof modelId !== 'string' || modelId.includes('..') || modelId.includes('/') || modelId.includes('\\')) {
      throw new Error(`Invalid model ID '${modelId}': directory traversal is prohibited`);
    }

    const entry = this.entries.get(modelId);
    if (!entry) return false;

    // Safe deletion: only delete file if requested AND safe
    const normalizedFilePath = path.resolve(entry.filePath);
    const modelsBaseDir = path.resolve(this.storage.paths.models);
    const isInsideManaged = normalizedFilePath.startsWith(modelsBaseDir);

    if (deletePhysicalFile) {
      if (isInsideManaged) {
        if (fs.existsSync(normalizedFilePath)) {
          try {
            fs.unlinkSync(normalizedFilePath);
          } catch (e) {
            console.error(`Error deleting model file ${normalizedFilePath}:`, e.message);
          }
        }

        // Check if parent model dir is empty and clean it up
        const parentDir = path.dirname(normalizedFilePath);
        if (parentDir !== modelsBaseDir && fs.existsSync(parentDir)) {
          try {
            const files = fs.readdirSync(parentDir);
            if (files.length === 0 || (files.length === 1 && files[0] === 'model-metadata.json')) {
              fs.rmSync(parentDir, { recursive: true, force: true });
            }
          } catch (e) {}
        }
      } else if (confirmExternalDelete) {
        // Only delete external file if explicit confirmation specifically for external deletion was provided
        if (fs.existsSync(normalizedFilePath)) {
          try {
            fs.unlinkSync(normalizedFilePath);
          } catch (e) {
            console.error(`Error deleting external model file ${normalizedFilePath}:`, e.message);
          }
        }
      }
    }

    this.entries.delete(modelId);
    this.saveRegistry();
    return true;
  }

  unregisterModel(modelId) {
    // Phase 13 Section 8: Unregister from library without deleting any physical files on disk
    return this.deleteModel(modelId, false, false);
  }

  migrateStorageLocation(newModelsDir) {
    if (!fs.existsSync(newModelsDir)) {
      fs.mkdirSync(newModelsDir, { recursive: true });
    }

    const oldDir = this.storage.paths.models;
    for (const [id, entry] of this.entries.entries()) {
      const oldFile = entry.filePath;
      if (fs.existsSync(oldFile)) {
        const newFile = path.join(newModelsDir, id, path.basename(oldFile));
        const newParent = path.dirname(newFile);
        if (!fs.existsSync(newParent)) fs.mkdirSync(newParent, { recursive: true });

        fs.copyFileSync(oldFile, newFile);
        fs.unlinkSync(oldFile);
        entry.filePath = newFile;
      }
    }

    this.storage.paths.models = newModelsDir;
    this.registryFilePath = path.join(newModelsDir, 'registry.json');
    this.saveRegistry();
    return true;
  }

  migrateStorageDirectory(newModelsDir) {
    return this.migrateStorageLocation(newModelsDir);
  }
}

module.exports = {
  ModelRegistry
};
