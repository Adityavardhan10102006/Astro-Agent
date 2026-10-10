const fs = require('fs');
const path = require('path');
const { DEFAULT_SETTINGS } = require('../../config/default-settings');

class FileService {
  constructor(securityService, supportedExtensions = DEFAULT_SETTINGS.supportedFormats) {
    this.security = securityService;
    this.supportedExtensions = new Set(supportedExtensions.map(e => e.toLowerCase()));
  }

  isSupported(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.has(ext);
  }

  listFiles(dirPath, options = { recursive: true, maxDepth: 5, ignoreHidden: true }) {
    if (!this.security.isPathAllowed(dirPath)) {
      throw new Error(`Access denied to path: ${dirPath}`);
    }

    const results = [];
    const ignoreDirs = new Set(['node_modules', '.git', '.astro_data', 'dist', 'build', '.cache']);

    const scan = (currentDir, depth) => {
      if (depth > options.maxDepth) return;
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          if (options.ignoreHidden && entry.name.startsWith('.')) continue;

          const fullPath = path.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            if (!ignoreDirs.has(entry.name)) {
              results.push({
                type: 'directory',
                name: entry.name,
                path: fullPath
              });
              if (options.recursive) {
                scan(fullPath, depth + 1);
              }
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            const stat = fs.statSync(fullPath);
            results.push({
              type: 'file',
              name: entry.name,
              path: fullPath,
              ext,
              sizeBytes: stat.size,
              supported: this.supportedExtensions.has(ext),
              mtime: stat.mtime
            });
          }
        }
      } catch (err) {
        // Permission denied or transient folder read error
      }
    };

    scan(dirPath, 0);
    return results;
  }

  searchFiles(dirPath, query, maxResults = 50) {
    const files = this.listFiles(dirPath, { recursive: true, maxDepth: 4 });
    const qLower = query.toLowerCase();

    const matches = [];
    for (const file of files) {
      if (matches.length >= maxResults) break;
      if (file.type !== 'file') continue;

      // Check filename match
      if (file.name.toLowerCase().includes(qLower)) {
        matches.push({
          ...file,
          matchType: 'filename',
          snippet: `Filename matches query "${query}"`
        });
        continue;
      }

      // Check file content match for supported text files under 2MB
      if (file.supported && file.sizeBytes < 2 * 1024 * 1024) {
        try {
          const content = fs.readFileSync(file.path, 'utf8');
          const lowerContent = content.toLowerCase();
          const matchIdx = lowerContent.indexOf(qLower);
          if (matchIdx !== -1) {
            const start = Math.max(0, matchIdx - 40);
            const end = Math.min(content.length, matchIdx + query.length + 40);
            const snippet = (start > 0 ? '...' : '') + content.substring(start, end).replace(/\r?\n/g, ' ') + (end < content.length ? '...' : '');

            matches.push({
              ...file,
              matchType: 'content',
              snippet
            });
          }
        } catch (e) {
          // Binary or encoding error
        }
      }
    }

    return matches;
  }

  readFileContent(filePath) {
    if (!this.security.isPathAllowed(filePath)) {
      throw new Error(`Security restriction: access denied to ${filePath}`);
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size > 10 * 1024 * 1024) {
      throw new Error(`File too large (${(stat.size / 1024 / 1024).toFixed(1)}MB). Max supported size is 10MB.`);
    }

    return fs.readFileSync(filePath, 'utf8');
  }

  backupAndWriteFile(filePath, newContent) {
    if (!this.security.isPathAllowed(filePath)) {
      throw new Error(`Security restriction: access denied to ${filePath}`);
    }

    let backupPath = null;
    if (fs.existsSync(filePath)) {
      backupPath = `${filePath}.astro_bak_${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, newContent, 'utf8');
    return {
      success: true,
      backupPath,
      filePath
    };
  }
}

module.exports = {
  FileService
};
