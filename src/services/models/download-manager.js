const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const EventEmitter = require('events');

class DownloadManager extends EventEmitter {
  constructor(storageService) {
    super();
    this.storage = storageService;
    this.activeDownloads = new Map(); // id -> { abortController, state }
  }

  getPartialPath(filename) {
    return path.join(this.storage.paths.downloads, `${filename}.part`);
  }

  isDownloadInProgress(filename) {
    return this.activeDownloads.has(filename);
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
      this.emit('cancelled', { filename });
      return true;
    }
    return false;
  }

  downloadFile(url, filename, expectedSizeBytes = null, token = null) {
    return new Promise((resolve, reject) => {
      if (this.activeDownloads.has(filename)) {
        return reject(new Error(`Download already active for ${filename}`));
      }

      this.storage.ensureDirectories();
      const partialPath = this.getPartialPath(filename);

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
          return reject(new Error('Too many HTTP redirects'));
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
            // Partial content resumed
            isResumed = true;
            fileStream = fs.createWriteStream(partialPath, { flags: 'a' });
            const contentRange = res.headers['content-range'];
            if (contentRange) {
              const match = contentRange.match(/\/(\d+)/);
              if (match) state.totalBytes = parseInt(match[1], 10);
            }
          } else if (res.statusCode === 200) {
            // Server did not support Range, start fresh
            existingBytes = 0;
            state.bytesDownloaded = 0;
            fileStream = fs.createWriteStream(partialPath, { flags: 'w' });
            const cl = res.headers['content-length'];
            if (cl) state.totalBytes = parseInt(cl, 10);
          } else if (res.statusCode === 416) {
            // Range not satisfiable (file might already be complete)
            if (expectedSizeBytes && existingBytes === expectedSizeBytes) {
              this.activeDownloads.delete(filename);
              return resolve({ partialPath, totalBytes: existingBytes, resumed: true });
            } else {
              // Stale partial file, reset
              if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath);
              existingBytes = 0;
              state.bytesDownloaded = 0;
              return downloadAttempt(currentUrl, redirectCount);
            }
          } else {
            this.activeDownloads.delete(filename);
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

            if (elapsed >= 0.5) {
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
            this.emit('completed', { filename, partialPath, totalBytes: state.bytesDownloaded });
            resolve({ partialPath, totalBytes: state.bytesDownloaded, filename });
          });

          fileStream.on('error', (err) => {
            this.activeDownloads.delete(filename);
            reject(err);
          });
        });

        req.on('error', (err) => {
          if (state.cancelled) {
            return reject(new Error('Download cancelled by user'));
          }
          this.activeDownloads.delete(filename);
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
