const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const EventEmitter = require('events');

class DownloadManager extends EventEmitter {
  constructor(storageService, hardwareService = null) {
    super();
    this.storage = storageService;
    this.hardware = hardwareService;
    this.activeDownloads = new Map(); // filename -> state
    this.queueFilePath = path.join(this.storage.paths.downloads, 'download-queue.json');
    this.downloadQueue = []; // [{ id, filename, url, expectedSizeBytes, status, addedAt, error }]
    this.loadQueue();
  }

  loadQueue() {
    this.storage.ensureDirectories();
    if (fs.existsSync(this.queueFilePath)) {
      try {
        const raw = fs.readFileSync(this.queueFilePath, 'utf8');
        this.downloadQueue = JSON.parse(raw);
      } catch (e) {
        this.downloadQueue = [];
      }
    } else {
      this.downloadQueue = [];
      this.saveQueue();
    }
  }

  saveQueue() {
    this.storage.ensureDirectories();
    fs.writeFileSync(this.queueFilePath, JSON.stringify(this.downloadQueue, null, 2), 'utf8');
  }

  getQueue() {
    return [...this.downloadQueue];
  }

  getPartialPath(filename) {
    return path.join(this.storage.paths.downloads, `${filename}.part`);
  }

  getMetaPath(filename) {
    return path.join(this.storage.paths.downloads, `${filename}.meta.json`);
  }

  saveDownloadMeta(filename, meta) {
    try {
      fs.writeFileSync(this.getMetaPath(filename), JSON.stringify(meta, null, 2), 'utf8');
    } catch (e) {}
  }

  loadDownloadMeta(filename) {
    const metaPath = this.getMetaPath(filename);
    if (fs.existsSync(metaPath)) {
      try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  isDownloadInProgress(filename) {
    return this.activeDownloads.has(filename);
  }

  checkDiskSpaceBeforeDownload(expectedSizeBytes) {
    if (!this.hardware) return true;
    try {
      const specs = this.hardware.detectSystemSpecs();
      const requiredGB = (expectedSizeBytes / (1024 ** 3)) + 5.0; // 5GB safety margin
      if (specs.storage.freeDiskGB < requiredGB) {
        throw new Error(`Insufficient disk space: download requires ${requiredGB.toFixed(1)} GB (including 5 GB safety margin), but only ${specs.storage.freeDiskGB} GB is available on disk.`);
      }
    } catch (err) {
      if (err.message.includes('Insufficient disk space')) throw err;
    }
    return true;
  }

  validateHost(targetUrl) {
    const urlObj = new URL(targetUrl);
    const host = urlObj.hostname.toLowerCase();
    const allowedSuffixes = [
      'huggingface.co',
      'hf.co',
      'cloudfront.net',
      'amazonaws.com',
      'azureedge.net',
      'localhost',
      '127.0.0.1'
    ];

    const isAllowed = allowedSuffixes.some(s => host === s || host.endsWith('.' + s));
    if (!isAllowed) {
      throw new Error(`Security validation failed: download host '${host}' is not in trusted model distribution domains.`);
    }
    return true;
  }

  pauseDownload(filename) {
    const active = this.activeDownloads.get(filename);
    if (active) {
      active.cancelled = true;
      if (active.fileStream) {
        try { active.fileStream.destroy(); } catch (e) {}
      }
      if (active.res) {
        try { active.res.destroy(); } catch (e) {}
      }
      if (active.req) {
        try { active.req.destroy(); } catch (e) {}
      }
      this.activeDownloads.delete(filename);

      // Update queue status
      const qItem = this.downloadQueue.find(q => q.filename === filename);
      if (qItem) {
        qItem.status = 'paused';
        this.saveQueue();
      }

      this.saveDownloadMeta(filename, {
        filename,
        status: 'paused',
        bytesDownloaded: active.bytesDownloaded,
        totalBytes: active.totalBytes,
        pausedAt: new Date().toISOString()
      });

      this.emit('paused', { filename, bytesDownloaded: active.bytesDownloaded });
      return true;
    }
    return false;
  }

  cancelDownload(filename) {
    const active = this.activeDownloads.get(filename);
    if (active) {
      active.cancelled = true;
      if (active.fileStream) {
        try { active.fileStream.destroy(); } catch (e) {}
      }
      if (active.res) {
        try { active.res.destroy(); } catch (e) {}
      }
      if (active.req) {
        try { active.req.destroy(); } catch (e) {}
      }
      if (typeof active.reject === 'function') {
        active.reject(new Error('Download cancelled by user'));
      }
      this.activeDownloads.delete(filename);
    }

    // Update queue
    this.downloadQueue = this.downloadQueue.filter(q => q.filename !== filename);
    this.saveQueue();

    // Clean up partial meta
    const metaPath = this.getMetaPath(filename);
    if (fs.existsSync(metaPath)) {
      try { fs.unlinkSync(metaPath); } catch (e) {}
    }

    this.emit('cancelled', { filename });
    return true;
  }

  cleanupPartialDownload(filename) {
    this.cancelDownload(filename);
    const partPath = this.getPartialPath(filename);
    if (fs.existsSync(partPath)) {
      try { fs.unlinkSync(partPath); } catch (e) {}
    }
    return true;
  }

  resumeDownload(filename, token = null) {
    const qItem = this.downloadQueue.find(q => q.filename === filename);
    if (!qItem) throw new Error(`Download item for ${filename} not found in queue.`);
    return this.downloadFile(qItem.url, qItem.filename, qItem.expectedSizeBytes, token);
  }

  retryDownload(filename, token = null) {
    const qItem = this.downloadQueue.find(q => q.filename === filename);
    if (!qItem) throw new Error(`Download item for ${filename} not found in queue.`);
    qItem.retryCount = (qItem.retryCount || 0) + 1;
    qItem.status = 'queued';
    this.saveQueue();
    return this.downloadFile(qItem.url, qItem.filename, qItem.expectedSizeBytes, token);
  }

  downloadFile(url, filename, expectedSizeBytes = null, token = null) {
    return new Promise((resolve, reject) => {
      // 1. Prevent duplicate active downloads
      if (this.activeDownloads.has(filename)) {
        return reject(new Error(`Download is already active for ${filename}`));
      }

      // 2. Security validation
      try {
        this.validateHost(url);
      } catch (err) {
        return reject(err);
      }

      // 3. Pre-flight disk space check
      if (expectedSizeBytes) {
        try {
          this.checkDiskSpaceBeforeDownload(expectedSizeBytes);
        } catch (err) {
          return reject(err);
        }
      }

      this.storage.ensureDirectories();
      const partialPath = this.getPartialPath(filename);

      // 4. Update or add queue entry
      let qItem = this.downloadQueue.find(q => q.filename === filename);
      if (!qItem) {
        qItem = {
          id: `dl_${filename}`,
          filename,
          url,
          expectedSizeBytes,
          status: 'downloading',
          addedAt: new Date().toISOString(),
          error: null
        };
        this.downloadQueue.push(qItem);
      } else {
        qItem.status = 'downloading';
        qItem.error = null;
      }
      this.saveQueue();

      // Check existing partial size
      let existingBytes = 0;
      if (fs.existsSync(partialPath)) {
        existingBytes = fs.statSync(partialPath).size;
      }

      const state = {
        filename,
        partialPath,
        bytesDownloaded: existingBytes,
        totalBytes: expectedSizeBytes || 0,
        speedBytesPerSec: 0,
        etaSeconds: 0,
        progressPercent: 0,
        cancelled: false,
        req: null,
        res: null,
        fileStream: null,
        reject
      };

      this.activeDownloads.set(filename, state);

      const downloadAttempt = (currentUrl, redirectCount = 0) => {
        if (redirectCount > 8) {
          this.activeDownloads.delete(filename);
          qItem.status = 'failed';
          qItem.error = 'Too many HTTP redirects';
          this.saveQueue();
          return reject(new Error('Too many HTTP redirects'));
        }

        try {
          this.validateHost(currentUrl);
        } catch (err) {
          this.activeDownloads.delete(filename);
          qItem.status = 'failed';
          qItem.error = err.message;
          this.saveQueue();
          return reject(err);
        }

        const urlObj = new URL(currentUrl);
        const client = urlObj.protocol === 'https:' ? https : http;

        const headers = {
          'User-Agent': 'ASTRO-Desktop-Assistant/0.1.0'
        };

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        if (existingBytes > 0) {
          headers['Range'] = `bytes=${existingBytes}-`;
        }

        const req = client.get(currentUrl, { headers }, (res) => {
          state.req = req;
          state.res = res;

          // Follow redirects (Hugging Face resolve endpoints send 302/307 to CDN)
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            req.destroy();
            return downloadAttempt(res.headers.location, redirectCount + 1);
          }

          let fileStream;
          let isResumed = false;

          if (res.statusCode === 206) {
            isResumed = true;
            fileStream = fs.createWriteStream(partialPath, { flags: 'a' });
            const contentRange = res.headers['content-range'];
            if (contentRange) {
              const match = contentRange.match(/\/(\d+)/);
              if (match) state.totalBytes = parseInt(match[1], 10);
            }
          } else if (res.statusCode === 200) {
            existingBytes = 0;
            state.bytesDownloaded = 0;
            fileStream = fs.createWriteStream(partialPath, { flags: 'w' });
            const cl = res.headers['content-length'];
            if (cl) state.totalBytes = parseInt(cl, 10);
          } else if (res.statusCode === 416) {
            if (expectedSizeBytes && existingBytes === expectedSizeBytes) {
              this.activeDownloads.delete(filename);
              qItem.status = 'completed';
              this.saveQueue();
              return resolve({ partialPath, totalBytes: existingBytes, resumed: true });
            } else {
              if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath);
              existingBytes = 0;
              state.bytesDownloaded = 0;
              return downloadAttempt(currentUrl, redirectCount);
            }
          } else {
            this.activeDownloads.delete(filename);
            qItem.status = 'failed';
            qItem.error = `HTTP ${res.statusCode}: ${res.statusMessage}`;
            this.saveQueue();
            return reject(new Error(`Download failed with status ${res.statusCode}: ${res.statusMessage}`));
          }

          state.fileStream = fileStream;

          let lastSampleTime = Date.now();
          let lastSampleBytes = state.bytesDownloaded;

          res.on('data', (chunk) => {
            if (state.cancelled) {
              res.destroy();
              fileStream.close();
              return;
            }

            state.bytesDownloaded += chunk.length;
            const now = Date.now();
            const elapsed = (now - lastSampleTime) / 1000;

            if (elapsed >= 0.4) {
              const bytesDiff = state.bytesDownloaded - lastSampleBytes;
              state.speedBytesPerSec = Math.round(bytesDiff / elapsed);
              if (state.totalBytes > 0) {
                state.progressPercent = Math.min(100, Number(((state.bytesDownloaded / state.totalBytes) * 100).toFixed(1)));
                const remaining = state.totalBytes - state.bytesDownloaded;
                state.etaSeconds = state.speedBytesPerSec > 0 ? Math.round(remaining / state.speedBytesPerSec) : 0;
              }
              lastSampleTime = now;
              lastSampleBytes = state.bytesDownloaded;

              this.emit('progress', { ...state });
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            if (state.cancelled) {
              return reject(new Error('Download cancelled by user'));
            }
            this.activeDownloads.delete(filename);
            qItem.status = 'completed';
            this.saveQueue();
            this.emit('completed', { filename, partialPath, totalBytes: state.bytesDownloaded });
            resolve({ partialPath, totalBytes: state.bytesDownloaded, filename });
          });

          fileStream.on('error', (err) => {
            this.activeDownloads.delete(filename);
            qItem.status = 'failed';
            qItem.error = err.message;
            this.saveQueue();
            reject(err);
          });
        });

        req.on('error', (err) => {
          if (state.cancelled) {
            return reject(new Error('Download cancelled by user'));
          }
          this.activeDownloads.delete(filename);
          qItem.status = 'failed';
          qItem.error = err.message;
          this.saveQueue();
          reject(err);
        });

        state.req = req;
      };

      downloadAttempt(url);
    });
  }
}

module.exports = {
  DownloadManager
};
