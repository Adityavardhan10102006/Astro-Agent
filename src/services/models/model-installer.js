const fs = require('fs');
const path = require('path');

class ModelInstaller {
  constructor(storageService, downloadVerifier) {
    this.storage = storageService;
    this.verifier = downloadVerifier;
  }

  getModelDir(modelId) {
    return path.join(this.storage.paths.models, modelId);
  }

  isModelInstalled(modelId) {
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

  async installVerifiedModel({
    modelId,
    variantTag,
    filename,
    partialFilePath,
    expectedSizeBytes = null,
    expectedSHA256 = null,
    repoId = null,
    license = 'Apache-2.0'
  }) {
    // 1. Verify before touching installation directory
    const verification = await this.verifier.verifyModelFile(
      partialFilePath,
      expectedSizeBytes,
      expectedSHA256
    );

    if (!verification.valid) {
      throw new Error(`Installation rejected: verification failed. ${verification.error}`);
    }

    // 2. Prepare target directory
    const targetDir = this.getModelDir(modelId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetFilePath = path.join(targetDir, filename);

    // 3. Move from partial downloads to installed location
    // Use copy + unlink to be safe across partitions if needed
    fs.copyFileSync(partialFilePath, targetFilePath);
    try {
      fs.unlinkSync(partialFilePath);
    } catch (e) {
      // Partial cleanup failure is non-fatal
    }

    // 4. Write model-metadata.json
    const metadata = {
      modelId,
      variantTag,
      filename,
      filePath: targetFilePath,
      sizeBytes: verification.size,
      sizeGB: Number((verification.size / (1024 ** 3)).toFixed(2)),
      repoId,
      license,
      installedAt: new Date().toISOString(),
      verified: true
    };

    fs.writeFileSync(
      path.join(targetDir, 'model-metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );

    // 5. Update catalog
    const catalog = this.storage.getCatalog();
    const modelEntry = catalog.models.find(m => m.id === modelId);
    if (modelEntry) {
      modelEntry.installed = true;
      modelEntry.activeQuant = variantTag;
      modelEntry.localPath = targetFilePath;
      modelEntry.installedAt = metadata.installedAt;
      this.storage.saveCatalog(catalog);
    }

    return metadata;
  }

  uninstallModel(modelId) {
    const targetDir = this.getModelDir(modelId);
    if (fs.existsSync(targetDir)) {
      // If this model is currently the active model, deactivate it
      const active = this.storage.getActiveModel();
      if (active && active.modelId === modelId) {
        this.storage.setActiveModel(null);
      }

      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    // Update catalog
    const catalog = this.storage.getCatalog();
    const modelEntry = catalog.models.find(m => m.id === modelId);
    if (modelEntry) {
      modelEntry.installed = false;
      delete modelEntry.activeQuant;
      delete modelEntry.localPath;
      delete modelEntry.installedAt;
      this.storage.saveCatalog(catalog);
    }

    return true;
  }
}

module.exports = {
  ModelInstaller
};
