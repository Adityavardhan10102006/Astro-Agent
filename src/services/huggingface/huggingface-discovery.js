const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

class HuggingFaceDiscovery {
  constructor(storageServiceOrCacheDir = null) {
    if (typeof storageServiceOrCacheDir === 'string') {
      this.storage = null;
      this.cacheDir = storageServiceOrCacheDir;
    } else {
      this.storage = storageServiceOrCacheDir;
      this.cacheDir = storageServiceOrCacheDir ? path.join(storageServiceOrCacheDir.paths.models, 'discovery-cache') : null;
    }
    this.apiBase = 'https://huggingface.co/api/models';
    this.baseUrl = null;
    this.trustedRepos = new Set([
      'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
      'Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF',
      'Qwen/Qwen3-8B',
      'Qwen/Qwen3-8B-GGUF'
    ]);
  }

  ensureCacheDir() {
    if (this.cacheDir && !fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  getCachePath(repoId) {
    if (!this.cacheDir) return null;
    const safeName = repoId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, `${safeName}.json`);
  }

  saveCachedMetadata(repoId, data) {
    const cachePath = this.getCachePath(repoId);
    if (cachePath) {
      this.ensureCacheDir();
      fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    }
    return false;
  }

  getCachedMetadata(repoId) {
    const cachePath = this.getCachePath(repoId);
    if (cachePath && fs.existsSync(cachePath)) {
      try {
        return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  validateRepoIdentifier(repoId) {
    if (!repoId || typeof repoId !== 'string') {
      throw new Error('Invalid Hugging Face repository identifier: must be a non-empty string.');
    }

    const trimmed = repoId.trim();

    // Check for directory traversal, invalid characters, or multiple slashes
    if (trimmed.includes('..') || trimmed.startsWith('/') || trimmed.endsWith('/')) {
      throw new Error(`Invalid Hugging Face repository identifier '${repoId}': directory traversal and leading/trailing slashes are prohibited.`);
    }

    // Must be in format "username/repo" with single slash
    const repoRegex = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/;
    if (!repoRegex.test(trimmed)) {
      throw new Error(`Invalid Hugging Face repository identifier '${repoId}'. Format must be 'author/repository-name' with alphanumeric characters, dashes, and underscores only.`);
    }

    return trimmed;
  }

  validateRepoId(repoId) {
    return this.validateRepoIdentifier(repoId);
  }

  parseTreeFiles(files, repoId = 'model') {
    const ggufFiles = (files || []).filter(f => {
      const filename = f.path || f.rfilename || '';
      return filename.toLowerCase().endsWith('.gguf');
    });

    return ggufFiles.map(f => {
      const filename = f.path || f.rfilename;
      const sizeBytes = (f.lfs && f.lfs.size) ? f.lfs.size : (f.size || 0);
      const sizeGB = Number((sizeBytes / (1024 ** 3)).toFixed(2));
      const sha256 = (f.lfs && f.lfs.oid) ? f.lfs.oid : null;
      const match = filename.match(/q[0-9]_[a-z0-9_]+/i) || filename.match(/q[0-9]+[a-z0-9_]*/i);
      const quantTag = match ? match[0].toUpperCase() : 'OTHER';

      return {
        filename,
        quantTag,
        sizeBytes,
        sizeGB,
        sha256,
        downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${filename}`,
        isRecommended: quantTag === 'Q4_K_M'
      };
    });
  }

  fetchRepoInfo(repoId, token = null) {
    return new Promise((resolve, reject) => {
      const base = this.baseUrl || this.apiBase;
      const url = `${base}/${repoId}`;
      const headers = {
        'User-Agent': 'ASTRO-Desktop-Assistant/0.2.0'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const client = url.startsWith('http:') ? http : https;
      const req = client.get(url, { headers }, (res) => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          return reject(new Error(`Authentication failed or repository is gated (HTTP ${res.statusCode}). Access to model requires approval or credentials.`));
        }
        if (res.statusCode === 404) {
          return reject(new Error(`Repository ${repoId} was not found on Hugging Face (HTTP 404).`));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Hugging Face API returned status ${res.statusCode}`));
        }

        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error(`Failed to parse Hugging Face metadata: ${err.message}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Network error contacting Hugging Face: ${err.message}`));
      });
      req.setTimeout(12000, () => {
        req.destroy();
        reject(new Error('Connection timed out contacting Hugging Face API'));
      });
    });
  }

  fetchTreeFiles(repoId, token = null) {
    return new Promise((resolve, reject) => {
      const base = this.baseUrl || this.apiBase;
      const url = `${base}/${repoId}/tree/main`;
      const headers = {
        'User-Agent': 'ASTRO-Desktop-Assistant/0.2.0'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const client = url.startsWith('http:') ? http : https;
      const req = client.get(url, { headers }, (res) => {
        if (res.statusCode !== 200) {
          return resolve([]); // Graceful fallback
        }
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve([]);
          }
        });
      });

      req.on('error', () => resolve([]));
      req.setTimeout(12000, () => {
        req.destroy();
        resolve([]);
      });
    });
  }

  async discoverModelVariants(repoId, tokenOrOptions = null) {
    const validatedRepoId = this.validateRepoIdentifier(repoId);
    const cachePath = this.getCachePath(validatedRepoId);

    const token = typeof tokenOrOptions === 'string' ? tokenOrOptions : (tokenOrOptions && tokenOrOptions.token ? tokenOrOptions.token : null);
    const offlineOnly = typeof tokenOrOptions === 'object' && tokenOrOptions !== null ? Boolean(tokenOrOptions.offlineOnly) : false;

    if (offlineOnly) {
      if (cachePath && fs.existsSync(cachePath)) {
        try {
          const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
          cachedData.cached = true;
          cachedData.fromCache = true;
          return cachedData;
        } catch (e) {}
      }
      throw new Error(`Offline mode is active: Cannot discover Hugging Face repository "${validatedRepoId}" without internet access enabled.`);
    }

    try {
      // 1. Fetch live metadata from HF
      const [repoData, treeFiles] = await Promise.all([
        this.fetchRepoInfo(validatedRepoId, token),
        this.fetchTreeFiles(validatedRepoId, token)
      ]);

      const treeFileMap = new Map();
      for (const f of treeFiles) {
        if (f.path) {
          treeFileMap.set(f.path, f);
        }
      }

      const siblings = repoData.siblings || [];
      const ggufFilenames = siblings
        .map(s => s.rfilename)
        .filter(fn => fn.toLowerCase().endsWith('.gguf'));

      for (const tf of treeFiles) {
        if (tf.path && tf.path.toLowerCase().endsWith('.gguf') && !ggufFilenames.includes(tf.path)) {
          ggufFilenames.push(tf.path);
        }
      }

      const variants = ggufFilenames.map(filename => {
        const treeInfo = treeFileMap.get(filename);
        let sizeBytes = 0;
        let sha256 = null;

        if (treeInfo) {
          sizeBytes = (treeInfo.lfs && treeInfo.lfs.size) ? treeInfo.lfs.size : (treeInfo.size || 0);
          sha256 = (treeInfo.lfs && treeInfo.lfs.oid) ? treeInfo.lfs.oid : null;
        }

        const sizeGB = Number((sizeBytes / (1024 ** 3)).toFixed(2));
        const match = filename.match(/q[0-9]_[a-z0-9_]+/i) || filename.match(/q[0-9]+[a-z0-9_]*/i);
        const quantTag = match ? match[0].toUpperCase() : 'OTHER';

        return {
          filename,
          quantTag,
          sizeBytes,
          sizeGB,
          sha256,
          downloadUrl: `https://huggingface.co/${validatedRepoId}/resolve/main/${filename}`,
          isRecommended: quantTag === 'Q4_K_M'
        };
      });

      // Filter out split shards for primary variant choices unless only split shards exist
      const singleFileVariants = variants.filter(v => !v.filename.includes('-of-'));
      const activeVariants = singleFileVariants.length > 0 ? singleFileVariants : variants;

      activeVariants.sort((a, b) => {
        if (a.isRecommended) return -1;
        if (b.isRecommended) return 1;
        return a.sizeBytes - b.sizeBytes;
      });

      const discoveryResult = {
        repoId: validatedRepoId,
        author: repoData.author || validatedRepoId.split('/')[0],
        lastModified: repoData.lastModified,
        sha: repoData.sha,
        license: repoData.cardData && repoData.cardData.license ? repoData.cardData.license : 'Apache-2.0',
        totalVariants: activeVariants.length,
        variants: activeVariants,
        isTrustedDefault: this.trustedRepos.has(validatedRepoId),
        cached: false,
        cachedAt: new Date().toISOString()
      };

      // 2. Persist to cache
      if (cachePath) {
        this.ensureCacheDir();
        fs.writeFileSync(cachePath, JSON.stringify(discoveryResult, null, 2), 'utf8');
      }

      return discoveryResult;
    } catch (err) {
      // 3. Fallback to local cache if offline or network error
      if (cachePath && fs.existsSync(cachePath)) {
        try {
          const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
          cachedData.cached = true;
          cachedData.offlineNotice = `Offline: displaying locally cached discovery from ${new Date(cachedData.cachedAt).toLocaleDateString()}`;
          return cachedData;
        } catch (e) {
          // Cache read error, fall through to rethrow
        }
      }

      throw err;
    }
  }

  async searchModels(query, options = {}) {
    const offlineOnly = typeof options === 'object' && options !== null ? Boolean(options.offlineOnly) : false;
    if (offlineOnly) {
      throw new Error(`Offline mode is active: Cannot search Hugging Face models for "${query}" without internet access enabled.`);
    }

    if (!query || typeof query !== 'string') {
      return [];
    }

    const trimmed = query.trim();
    if (trimmed.includes('/')) {
      try {
        const variants = await this.discoverModelVariants(trimmed, options);
        return [{
          repoId: variants.repoId,
          name: variants.name,
          author: variants.author,
          variants: variants.variants,
          isExactMatch: true
        }];
      } catch (e) {}
    }

    const results = [];
    const lower = trimmed.toLowerCase();
    for (const trustedRepo of this.trustedRepos) {
      if (trustedRepo.toLowerCase().includes(lower)) {
        try {
          const details = await this.discoverModelVariants(trustedRepo, options);
          results.push({
            repoId: details.repoId,
            name: details.name,
            author: details.author,
            variants: details.variants,
            isTrusted: true
          });
        } catch (e) {}
      }
    }
    return results;
  }

  async findCompatibleModels(query, options = {}) {
    return this.searchModels(query, options);
  }

  async fetchRepoDetails(repoId, options = {}) {
    return this.discoverModelVariants(repoId, options);
  }
}

module.exports = {
  HuggingFaceDiscovery
};
