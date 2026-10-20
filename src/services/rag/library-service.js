const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const { DocumentExtractorRegistry } = require('./extractors/extractor-registry');

class LibraryService extends EventEmitter {
  constructor(storageService, securityService, extractorRegistry) {
    super();
    this.storage = storageService;
    this.security = securityService;
    this.extractors = extractorRegistry || new DocumentExtractorRegistry();
    const ragIndexPath = (this.storage && this.storage.paths && this.storage.paths.ragIndex) 
      ? this.storage.paths.ragIndex 
      : (typeof storageService === 'string' ? storageService : process.cwd());
    this.libraryFile = path.join(ragIndexPath, 'library.json');
    this.cancelRequested = false;
    this.isIndexing = false;

    this.state = {
      version: '1.0',
      updatedAt: null,
      roots: [], // user-selected folder and file paths
      exclusions: ['node_modules', '.git', '.astro_data', 'dist', 'build', '.cache', 'target', '.vs', '.idea'],
      files: {} // canonicalPath -> { docPath, docName, fileType, sizeBytes, mtime, contentHash, status, chunkCount, lastIndexedAt, error }
    };

    this.loadLibrary();
  }

  isPathApproved(candidatePath) {
    const resolved = path.resolve(candidatePath);
    for (const root of this.state.roots) {
      if (resolved === root || resolved.startsWith(root + path.sep)) {
        return true;
      }
    }
    return false;
  }

  isPathExcluded(candidatePath) {
    return this.isExcluded(candidatePath);
  }

  loadLibrary() {
    if (this.storage && typeof this.storage.ensureDirectories === 'function') {
      this.storage.ensureDirectories();
    }
    const dir = path.dirname(this.libraryFile);
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
    }
    if (fs.existsSync(this.libraryFile)) {
      try {
        const raw = fs.readFileSync(this.libraryFile, 'utf8');
        this.state = JSON.parse(raw);
        if (!this.state.exclusions) {
          this.state.exclusions = ['node_modules', '.git', '.astro_data', 'dist', 'build', '.cache'];
        }
      } catch (e) {
        console.error('Error loading library, starting fresh:', e.message);
      }
    } else {
      this.saveLibrary();
    }
  }

  saveLibrary() {
    this.storage.ensureDirectories();
    this.state.updatedAt = new Date().toISOString();
    fs.writeFileSync(this.libraryFile, JSON.stringify(this.state, null, 2), 'utf8');
  }

  getRoots() {
    return [...this.state.roots];
  }

  addRoot(rootPath) {
    if (!fs.existsSync(rootPath)) {
      throw new Error(`Path does not exist: ${rootPath}`);
    }
    const resolved = path.resolve(rootPath);
    if (!this.state.roots.includes(resolved)) {
      this.state.roots.push(resolved);
      this.saveLibrary();
    }
    return this.getRoots();
  }

  removeRoot(rootPath) {
    const resolved = path.resolve(rootPath);
    this.state.roots = this.state.roots.filter(r => r !== resolved);

    // Remove files under this root
    for (const [filePath, fileMeta] of Object.entries(this.state.files)) {
      if (filePath.startsWith(resolved)) {
        delete this.state.files[filePath];
      }
    }

    this.saveLibrary();
    return this.getRoots();
  }

  getExclusions() {
    return [...this.state.exclusions];
  }

  setExclusions(exclusions) {
    this.state.exclusions = Array.from(new Set(exclusions));
    this.saveLibrary();
    return this.getExclusions();
  }

  computeFileHash(filePath) {
    try {
      const buffer = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(buffer).digest('hex');
    } catch (e) {
      return null;
    }
  }

  isExcluded(itemPath) {
    const normalized = itemPath.toLowerCase();
    for (const exc of this.state.exclusions) {
      if (normalized.includes(path.sep + exc.toLowerCase() + path.sep) ||
          normalized.endsWith(path.sep + exc.toLowerCase()) ||
          path.basename(normalized) === exc.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  scanEligibleFiles() {
    const eligible = [];

    for (const root of this.state.roots) {
      if (!fs.existsSync(root)) continue;
      const stat = fs.statSync(root);

      if (stat.isFile()) {
        if (!this.isExcluded(root) && this.extractors.isSupported(root)) {
          eligible.push(path.resolve(root));
        }
      } else if (stat.isDirectory()) {
        const scanDir = (currentDir, depth = 0) => {
          if (depth > 6 || this.isExcluded(currentDir)) return;
          try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.name.startsWith('.')) continue; // ignore hidden
              const fullPath = path.join(currentDir, entry.name);

              if (entry.isDirectory()) {
                if (!this.isExcluded(fullPath)) {
                  scanDir(fullPath, depth + 1);
                }
              } else if (entry.isFile()) {
                if (!this.isExcluded(fullPath) && this.extractors.isSupported(fullPath)) {
                  eligible.push(path.resolve(fullPath));
                }
              }
            }
          } catch (e) {
            // Permission or access error
          }
        };
        scanDir(root);
      }
    }

    return Array.from(new Set(eligible));
  }

  getLibraryFiles() {
    return Object.values(this.state.files);
  }

  getFileRecord(filePath) {
    return this.state.files[path.resolve(filePath)] || null;
  }

  recordFileStatus(filePath, status, details = {}) {
    const resolved = path.resolve(filePath);
    const existing = this.state.files[resolved] || {};

    this.state.files[resolved] = {
      ...existing,
      docPath: resolved,
      docName: path.basename(resolved),
      fileType: path.extname(resolved).toLowerCase(),
      status, // 'indexed' | 'failed' | 'unsupported' | 'excluded'
      sizeBytes: details.sizeBytes || existing.sizeBytes || 0,
      mtime: details.mtime || existing.mtime || null,
      contentHash: details.contentHash || existing.contentHash || null,
      chunkCount: details.chunkCount !== undefined ? details.chunkCount : (existing.chunkCount || 0),
      lastIndexedAt: new Date().toISOString(),
      error: details.error || null
    };

    this.saveLibrary();
    return this.state.files[resolved];
  }

  removeFileRecord(filePath) {
    const resolved = path.resolve(filePath);
    if (this.state.files[resolved]) {
      delete this.state.files[resolved];
      this.saveLibrary();
      return true;
    }
    return false;
  }

  cancelIndexing() {
    if (this.isIndexing) {
      this.cancelRequested = true;
      this.emit('cancelled');
      return true;
    }
    return false;
  }
}

module.exports = {
  LibraryService
};
