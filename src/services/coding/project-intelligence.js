const fs = require('fs');
const path = require('path');

class ProjectIntelligenceService {
  constructor(securityService, fileService) {
    this.security = securityService;
    this.files = fileService;
    this.activeProjectPath = null;
    this.projectMetadata = null;
  }

  setActiveProject(projectPath) {
    if (!projectPath) {
      this.activeProjectPath = null;
      this.projectMetadata = null;
      return null;
    }

    const resolved = path.resolve(projectPath);
    if (!this.security.isPathAllowed(resolved)) {
      throw new Error(`Security restriction: access denied to project path "${resolved}".`);
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new Error(`Invalid project directory: "${resolved}" does not exist or is not a directory.`);
    }

    this.activeProjectPath = resolved;
    this.projectMetadata = this.analyzeProject(resolved);
    return this.projectMetadata;
  }

  getActiveProject() {
    return this.activeProjectPath ? {
      path: this.activeProjectPath,
      name: path.basename(this.activeProjectPath),
      metadata: this.projectMetadata
    } : null;
  }

  isCredentialFile(filePath) {
    const filename = path.basename(filePath).toLowerCase();
    const ext = path.extname(filePath).toLowerCase();

    // Sensitive files pattern
    const sensitiveNames = [
      '.env', '.env.local', '.env.production', '.env.development',
      'id_rsa', 'id_ed25519', 'credentials.json', 'secrets.json',
      'secrets.yaml', 'secrets.yml', 'serviceaccount.json'
    ];
    const sensitiveExts = ['.pem', '.key', '.p12', '.pfx', '.keystore'];

    return sensitiveNames.includes(filename) || 
           filename.startsWith('.env.') || 
           sensitiveExts.includes(ext) ||
           filename.includes('secret') ||
           filename.includes('token');
  }

  detectLanguages(projectPath) {
    const targetDir = projectPath || this.activeProjectPath;
    if (!targetDir) return [];

    const files = this.files.listFiles(targetDir, { recursive: true, maxDepth: 4, categoryFilter: 'code' });
    const counts = {};

    const extToLang = {
      '.js': 'JavaScript',
      '.jsx': 'JavaScript (React)',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript (React)',
      '.py': 'Python',
      '.rs': 'Rust',
      '.go': 'Go',
      '.c': 'C',
      '.cpp': 'C++',
      '.h': 'C/C++ Header',
      '.java': 'Java',
      '.html': 'HTML',
      '.css': 'CSS',
      '.sql': 'SQL',
      '.sh': 'Shell',
      '.ps1': 'PowerShell'
    };

    files.forEach(f => {
      const lang = extToLang[f.ext];
      if (lang) {
        counts[lang] = (counts[lang] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([lang, fileCount]) => ({ language: lang, fileCount }))
      .sort((a, b) => b.fileCount - a.fileCount);
  }

  detectEntryPoints(projectPath) {
    const targetDir = projectPath || this.activeProjectPath;
    if (!targetDir) return [];

    const candidateFiles = [
      'index.js', 'src/index.js', 'main.js', 'src/main.js', 'app.js', 'src/app.js',
      'index.ts', 'src/index.ts', 'main.ts', 'src/main.ts',
      'main.py', 'app.py', 'src/main.py',
      'main.rs', 'src/main.rs', 'lib.rs', 'src/lib.rs',
      'main.go', 'cmd/main.go',
      'index.html'
    ];

    const detected = [];
    candidateFiles.forEach(rel => {
      const full = path.join(targetDir, rel);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        detected.push({
          entryFile: rel,
          fullPath: full
        });
      }
    });

    return detected;
  }

  parseManifest(projectPath) {
    const targetDir = projectPath || this.activeProjectPath;
    if (!targetDir) return null;

    const manifest = {
      type: 'generic',
      manifestFile: null,
      name: path.basename(targetDir),
      scripts: {},
      dependencies: []
    };

    // Node.js package.json
    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        manifest.type = 'node';
        manifest.manifestFile = 'package.json';
        manifest.name = pkg.name || manifest.name;
        manifest.version = pkg.version || '0.0.0';
        manifest.scripts = pkg.scripts || {};
        manifest.dependencies = [
          ...Object.keys(pkg.dependencies || {}),
          ...Object.keys(pkg.devDependencies || {})
        ];
        return manifest;
      } catch (e) {}
    }

    // Python pyproject.toml or requirements.txt
    const reqPath = path.join(targetDir, 'requirements.txt');
    if (fs.existsSync(reqPath)) {
      try {
        const lines = fs.readFileSync(reqPath, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
        manifest.type = 'python';
        manifest.manifestFile = 'requirements.txt';
        manifest.dependencies = lines.map(l => l.trim());
        manifest.scripts = { test: 'pytest' };
        return manifest;
      } catch (e) {}
    }

    // Rust Cargo.toml
    const cargoPath = path.join(targetDir, 'Cargo.toml');
    if (fs.existsSync(cargoPath)) {
      manifest.type = 'rust';
      manifest.manifestFile = 'Cargo.toml';
      manifest.scripts = { test: 'cargo test', build: 'cargo build' };
      return manifest;
    }

    return manifest;
  }

  analyzeProject(projectPath) {
    const targetDir = projectPath || this.activeProjectPath;
    if (!targetDir) return null;

    return {
      name: path.basename(targetDir),
      path: targetDir,
      languages: this.detectLanguages(targetDir),
      entryPoints: this.detectEntryPoints(targetDir),
      manifest: this.parseManifest(targetDir),
      analyzedAt: new Date().toISOString()
    };
  }

  extractSymbols(filePath, content = null) {
    let source = content;
    if (source === null) {
      if (!fs.existsSync(filePath)) return [];
      source = fs.readFileSync(filePath, 'utf8');
    }

    const ext = path.extname(filePath).toLowerCase();
    const lines = source.split('\n');
    const symbols = [];

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();

      // JS/TS/Python function definitions
      const fnMatch = trimmed.match(/(?:async\s+)?function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|def\s+([a-zA-Z0-9_]+)\s*\(/);
      if (fnMatch) {
        const name = fnMatch[1] || fnMatch[2] || fnMatch[3];
        if (name) {
          symbols.push({
            type: 'function',
            name,
            line: lineNum,
            lineText: trimmed
          });
        }
      }

      // Class definitions
      const classMatch = trimmed.match(/class\s+([a-zA-Z0-9_$]+)/);
      if (classMatch) {
        symbols.push({
          type: 'class',
          name: classMatch[1],
          line: lineNum,
          lineText: trimmed
        });
      }

      // Imports / Requires
      const importMatch = trimmed.match(/(?:import\s+.*?from\s+['"](.*?)['"]|const\s+.*?=\s*require\(['"](.*?)['"]\)|from\s+(.*?)\s+import|import\s+([a-zA-Z0-9_]+))/);
      if (importMatch) {
        const moduleName = importMatch[1] || importMatch[2] || importMatch[3] || importMatch[4];
        if (moduleName) {
          symbols.push({
            type: 'import',
            name: moduleName,
            line: lineNum,
            lineText: trimmed
          });
        }
      }

      // Exports
      const exportMatch = trimmed.match(/module\.exports\s*=\s*\{?([a-zA-Z0-9_$,\s]+)\}?|export\s+(?:default\s+)?(?:const|let|var|function|class)?\s*([a-zA-Z0-9_$]+)/);
      if (exportMatch) {
        const exportName = exportMatch[1] || exportMatch[2];
        if (exportName) {
          symbols.push({
            type: 'export',
            name: exportName.trim(),
            line: lineNum,
            lineText: trimmed
          });
        }
      }
    });

    return symbols;
  }

  searchProjectCode(query, { maxResults = 20 } = {}) {
    if (!this.activeProjectPath) {
      throw new Error('No active project loaded in Coding Studio.');
    }

    const files = this.files.listFiles(this.activeProjectPath, { recursive: true, maxDepth: 5, categoryFilter: 'code' });
    const qLower = query.toLowerCase();
    const results = [];

    for (const file of files) {
      if (results.length >= maxResults) break;
      if (file.type !== 'file' || !file.supported || file.sizeBytes > 2 * 1024 * 1024) continue;

      try {
        const content = fs.readFileSync(file.path, 'utf8');
        const lines = content.split('\n');

        lines.forEach((lineText, idx) => {
          if (results.length >= maxResults) return;
          if (lineText.toLowerCase().includes(qLower)) {
            const lineNum = idx + 1;
            const startLine = Math.max(1, lineNum - 2);
            const endLine = Math.min(lines.length, lineNum + 2);
            const snippet = lines.slice(startLine - 1, endLine).join('\n');

            results.push({
              filePath: file.path,
              relPath: path.relative(this.activeProjectPath, file.path),
              fileName: file.name,
              line: lineNum,
              startLine,
              endLine,
              lineRange: `${path.basename(file.path)}:L${startLine}-L${endLine}`,
              matchedLine: lineText.trim(),
              snippet
            });
          }
        });
      } catch (e) {}
    }

    return results;
  }
}

module.exports = {
  ProjectIntelligenceService
};
