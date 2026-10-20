const fs = require('fs');
const path = require('path');

class ModelInstaller {
  constructor(storageService, downloadVerifier, modelRegistry = null, lifecycleManager = null) {
    this.storage = storageService;
    this.verifier = downloadVerifier;
    this.registry = modelRegistry;
    this.lifecycle = lifecycleManager;
  }

  getModelDir(modelId) {
    return path.join(this.storage.paths.models, modelId);
  }

  isModelInstalled(modelId) {
    if (this.registry) {
      const entry = this.registry.getEntry(modelId);
      if (entry && fs.existsSync(entry.filePath)) {
        return true;
      }
    }

    const dir = this.getModelDir(modelId);
    const metaFile = path.join(dir, 'model-metadata.json');
    if (!fs.existsSync(metaFile)) return false;

    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      if (meta.filePath && fs.existsSync(meta.filePath)) {
        return true;
      }
    } catch (e) {
      return false;
    }
    return false;
  }

  getInstalledModelMetadata(modelId) {
    if (this.registry) {
      const entry = this.registry.getEntry(modelId);
      if (entry) return entry;
    }

    const dir = this.getModelDir(modelId);
    const metaFile = path.join(dir, 'model-metadata.json');
    if (fs.existsSync(metaFile)) {
      try {
        return JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  getInstalledModelPath(modelId) {
    const meta = this.getInstalledModelMetadata(modelId);
    return meta ? meta.filePath : null;
  }

  async installVerifiedModel({
    modelId,
    displayName,
    variantTag,
    filename,
    partialFilePath,
    expectedSizeBytes = null,
    expectedSHA256 = null,
    repoId = null,
    revision = null,
    license = 'Apache-2.0',
    compatibility = {}
  }) {
    // 1. Lifecycle transition to verifying
    if (this.lifecycle) {
      try {
        this.lifecycle.transition(modelId, 'verifying');
      } catch (e) {}
    }

    // 2. Comprehensive verification before touching installed directory
    const verification = await this.verifier.verifyModelFile(
      partialFilePath,
      expectedSizeBytes,
      expectedSHA256
    );

    if (!verification.valid) {
      if (this.lifecycle) {
        try {
          this.lifecycle.transition(modelId, 'failed', verification.error);
        } catch (e) {}
      }
      throw new Error(`Installation rejected: verification failed. ${verification.error}`);
    }

    // 3. Lifecycle transition to installing
    if (this.lifecycle) {
      try {
        this.lifecycle.transition(modelId, 'installing');
      } catch (e) {}
    }

    // 4. Prepare target directory
    const targetDir = this.getModelDir(modelId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetFilePath = path.join(targetDir, filename);

    // 5. Move from partial downloads to installed location
    fs.copyFileSync(partialFilePath, targetFilePath);
    try {
      fs.unlinkSync(partialFilePath);
    } catch (e) {
      // Non-fatal
    }

    // 6. Register model in ModelRegistry
    let registryEntry = null;
    if (this.registry) {
      registryEntry = this.registry.registerModel({
        modelId,
        displayName: displayName || modelId,
        repoId,
        revision,
        format: 'GGUF',
        quantization: variantTag,
        filePath: targetFilePath,
        expectedSizeBytes,
        actualSizeBytes: verification.size,
        license,
        verificationAudit: {
          checksPerformed: verification.checksPerformed,
          unavailableChecks: verification.unavailableChecks,
          computedHash: verification.computedHash,
          verifiedAt: verification.verifiedAt
        },
        compatibility
      });
    }

    // 7. Write model-metadata.json
    const metadata = {
      modelId,
      displayName: displayName || modelId,
      variantTag,
      filename,
      filePath: targetFilePath,
      sizeBytes: verification.size,
      sizeGB: Number((verification.size / (1024 ** 3)).toFixed(2)),
      repoId,
      revision,
      license,
      installedAt: new Date().toISOString(),
      verified: true,
      verificationAudit: {
        checksPerformed: verification.checksPerformed,
        unavailableChecks: verification.unavailableChecks,
        computedHash: verification.computedHash
      }
    };

    fs.writeFileSync(
      path.join(targetDir, 'model-metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );

    // 8. Update catalog
    const catalog = this.storage.getCatalog();
    const modelEntry = catalog.models.find(m => m.id === modelId);
    if (modelEntry) {
      modelEntry.installed = true;
      modelEntry.activeQuant = variantTag;
      modelEntry.localPath = targetFilePath;
      modelEntry.installedAt = metadata.installedAt;
      this.storage.saveCatalog(catalog);
    }

    // 9. Lifecycle transition to installed
    if (this.lifecycle) {
      try {
        this.lifecycle.transition(modelId, 'installed');
      } catch (e) {}
    }

    return registryEntry || metadata;
  }

  async importLocalModel({
    sourcePath,
    modelId = null,
    displayName = null,
    variantTag = null,
    copyToManagedDir = false,
    license = 'Custom / Open Weights',
    repoId = null,
    allowExternal = true
  }) {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new Error(`Local model file not found at: ${sourcePath}`);
    }

    const resolvedSource = path.resolve(sourcePath);

    // Check for duplicate registration of the same underlying file (Rule 14 & Phase 13 Section 3)
    if (this.registry) {
      const existing = this.registry.findEntryByPath(resolvedSource);
      if (existing) {
        return {
          alreadyRegistered: true,
          modelId: existing.modelId,
          displayName: existing.displayName,
          filePath: existing.filePath,
          entry: existing,
          notice: `File is already registered as "${existing.displayName}" (${existing.modelId}).`
        };
      }
    }

    // Inspect GGUF header and metadata deeply
    const { GGUFInspector } = require('./gguf-inspector');
    const inspection = GGUFInspector.inspect(resolvedSource);

    if (!inspection.valid) {
      if (this.lifecycle && modelId) {
        try {
          this.lifecycle.transition(modelId, 'failed', inspection.error);
        } catch (e) {}
      }
      throw new Error(`Model verification failed: ${inspection.error}`);
    }

    const stat = fs.statSync(resolvedSource);
    if (stat.size === 0) {
      throw new Error('Local model file is 0 bytes.');
    }

    // Determine clean model ID
    const detectedFilename = path.basename(resolvedSource);
    let resolvedId = modelId;
    if (!resolvedId) {
      resolvedId = detectedFilename
        .toLowerCase()
        .replace(/\.gguf$/i, '')
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      if (!resolvedId) resolvedId = `byom-${Date.now()}`;
    }

    const resolvedDisplayName = displayName || inspection.modelName || resolvedId;
    const resolvedVariant = variantTag || inspection.quantization || 'Q4_K_M';

    if (this.lifecycle) {
      try { this.lifecycle.transition(resolvedId, 'installing'); } catch (e) {}
    }

    const targetDir = this.getModelDir(resolvedId);
    let finalFilePath = resolvedSource;

    if (copyToManagedDir) {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const managedPath = path.join(targetDir, detectedFilename);
      if (path.resolve(managedPath) !== resolvedSource) {
        fs.copyFileSync(resolvedSource, managedPath);
        finalFilePath = managedPath;
      }
    }

    // Register in ModelRegistry
    let registryEntry = null;
    if (this.registry) {
      registryEntry = this.registry.registerModel({
        modelId: resolvedId,
        displayName: resolvedDisplayName,
        repoId: repoId || `local/${resolvedId}`,
        format: 'GGUF',
        architecture: inspection.architecture,
        quantization: resolvedVariant,
        filePath: finalFilePath,
        expectedSizeBytes: stat.size,
        actualSizeBytes: stat.size,
        license,
        allowExternal,
        compatibility: inspection.compatibility,
        verificationAudit: {
          checksPerformed: ['gguf_magic_header_and_version', 'file_existence_and_size', 'gguf_metadata_inspection'],
          unavailableChecks: ['sha256_checksum (local direct import)'],
          headerMagic: inspection.format,
          ggufVersion: inspection.version,
          tensorCount: inspection.tensorCount,
          architecture: inspection.architecture,
          verifiedAt: new Date().toISOString()
        }
      });
    }

    // Write model-metadata.json
    const metadata = {
      modelId: resolvedId,
      displayName: resolvedDisplayName,
      variantTag: resolvedVariant,
      filename: detectedFilename,
      filePath: finalFilePath,
      sizeBytes: stat.size,
      sizeGB: Number((stat.size / (1024 ** 3)).toFixed(2)),
      estimatedRamGB: inspection.estimatedRamGB,
      architecture: inspection.architecture,
      repoId: repoId || `local/${resolvedId}`,
      license,
      installedAt: new Date().toISOString(),
      verified: true,
      source: 'local-import',
      storageType: registryEntry?.storageType || (copyToManagedDir ? 'managed' : 'external'),
      verificationAudit: {
        checksPerformed: ['gguf_magic_header_and_version', 'file_existence_and_size', 'gguf_metadata_inspection'],
        tensorCount: inspection.tensorCount,
        architecture: inspection.architecture
      }
    };

    if (fs.existsSync(targetDir)) {
      try {
        fs.writeFileSync(
          path.join(targetDir, 'model-metadata.json'),
          JSON.stringify(metadata, null, 2),
          'utf8'
        );
      } catch (e) {}
    }

    // Update catalog
    const catalog = this.storage.getCatalog();
    let modelEntry = catalog.models.find(m => m.id === resolvedId);
    if (!modelEntry) {
      modelEntry = {
        id: resolvedId,
        name: resolvedDisplayName,
        format: 'GGUF',
        architecture: inspection.architecture,
        license,
        description: `Locally imported GGUF model (${inspection.architecture || 'custom'}, ${metadata.sizeGB} GB).`,
        quantizations: [{ tag: resolvedVariant, filename: detectedFilename, approxSizeGB: metadata.sizeGB, recommended: true }]
      };
      catalog.models.push(modelEntry);
    }
    modelEntry.installed = true;
    modelEntry.activeQuant = resolvedVariant;
    modelEntry.localPath = finalFilePath;
    modelEntry.installedAt = metadata.installedAt;
    this.storage.saveCatalog(catalog);

    if (this.lifecycle) {
      try {
        this.lifecycle.transition(resolvedId, 'installed');
      } catch (e) {}
    }

    const resultObj = registryEntry || metadata;
    return {
      success: true,
      ...resultObj,
      entry: registryEntry || metadata,
      modelId: resolvedId
    };
  }

  uninstallModel(modelId) {
    if (this.registry) {
      this.registry.deleteModel(modelId);
    }

    const targetDir = this.getModelDir(modelId);
    if (fs.existsSync(targetDir)) {
      const active = this.storage.getActiveModel();
      if (active && active.modelId === modelId) {
        this.storage.setActiveModel(null);
      }
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    const catalog = this.storage.getCatalog();
    const modelEntry = catalog.models.find(m => m.id === modelId);
    if (modelEntry) {
      modelEntry.installed = false;
      delete modelEntry.activeQuant;
      delete modelEntry.localPath;
      delete modelEntry.installedAt;
      this.storage.saveCatalog(catalog);
    }

    if (this.lifecycle) {
      this.lifecycle.reset(modelId);
    }

    return true;
  }

  unregisterModel(modelId) {
    if (this.registry) {
      this.registry.unregisterModel(modelId);
    }

    const catalog = this.storage.getCatalog();
    const modelEntry = catalog.models.find(m => m.id === modelId);
    if (modelEntry) {
      modelEntry.installed = false;
      delete modelEntry.activeQuant;
      delete modelEntry.localPath;
      delete modelEntry.installedAt;
      this.storage.saveCatalog(catalog);
    }

    if (this.lifecycle) {
      this.lifecycle.reset(modelId);
    }

    return true;
  }
}


module.exports = {
  ModelInstaller
};
