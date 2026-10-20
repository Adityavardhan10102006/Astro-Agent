const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class CodingService {
  constructor(securityService, fileService) {
    this.security = securityService;
    this.files = fileService;
    this.changeHistory = [];
    this.activeProcesses = new Map(); // pid -> child_process
  }

  isCredentialFile(filePath) {
    const filename = path.basename(filePath).toLowerCase();
    const ext = path.extname(filePath).toLowerCase();
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

  generateSimpleDiff(originalContent, modifiedContent) {
    const origLines = originalContent.split('\n');
    const modLines = modifiedContent.split('\n');
    const diff = [];

    let i = 0;
    let j = 0;
    let additions = 0;
    let deletions = 0;

    while (i < origLines.length || j < modLines.length) {
      if (i < origLines.length && j < modLines.length && origLines[i] === modLines[j]) {
        diff.push(`  ${origLines[i]}`);
        i++;
        j++;
      } else if (j < modLines.length && (i >= origLines.length || !origLines.includes(modLines[j]))) {
        diff.push(`+ ${modLines[j]}`);
        additions++;
        j++;
      } else if (i < origLines.length) {
        diff.push(`- ${origLines[i]}`);
        deletions++;
        i++;
      }
    }

    const diffText = diff.join('\n');
    // Maintain backwards compatibility: tests check diffText directly
    return diffText;
  }

  proposeFileChange(filePath, newContent) {
    if (!this.security.isPathAllowed(filePath)) {
      throw new Error(`Security restriction: access denied to ${filePath}`);
    }

    let originalContent = '';
    let inspectedMtime = 0;

    if (fs.existsSync(filePath)) {
      originalContent = fs.readFileSync(filePath, 'utf8');
      const stat = fs.statSync(filePath);
      inspectedMtime = stat.mtimeMs;
    }

    const diff = this.generateSimpleDiff(originalContent, newContent);
    const isSensitive = this.isCredentialFile(filePath);

    const additions = (diff.match(/^\+\s/gm) || []).length;
    const deletions = (diff.match(/^\-\s/gm) || []).length;

    return {
      filePath,
      diff,
      originalLength: originalContent.length,
      newLength: newContent.length,
      requiresApproval: true,
      additions,
      deletions,
      inspectedMtime,
      isSensitive,
      sensitiveWarning: isSensitive ? `Warning: ${path.basename(filePath)} appears to contain credentials or environment secrets. Review carefully before editing.` : null,
      proposedAt: new Date().toISOString()
    };
  }

  applyApprovedChange(filePath, newContent, userConfirmed = false, options = {}) {
    if (!userConfirmed) {
      throw new Error('User approval required before modifying files (Rule 14).');
    }

    if (!this.security.isPathAllowed(filePath)) {
      throw new Error(`Security restriction: access denied to ${filePath}`);
    }

    // Sensitive file protection
    if (this.isCredentialFile(filePath) && !options.allowSensitive) {
      throw new Error(`Warning: Editing sensitive file "${path.basename(filePath)}" requires explicit user authorization.`);
    }

    // External edit conflict detection
    if (fs.existsSync(filePath) && options.expectedMtime) {
      const currentStat = fs.statSync(filePath);
      if (currentStat.mtimeMs > options.expectedMtime) {
        throw new Error(`External conflict: File "${filePath}" was modified externally since it was inspected.`);
      }
    }

    const res = this.files.backupAndWriteFile(filePath, newContent);
    const changeEntry = {
      id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      filePath,
      backupPath: res.backupPath,
      timestamp: new Date().toISOString()
    };
    this.changeHistory.push(changeEntry);

    return {
      success: true,
      filePath,
      backupPath: res.backupPath,
      changeId: changeEntry.id
    };
  }

  revertFileChange(filePath, backupPath = null) {
    if (!this.security.isPathAllowed(filePath)) {
      throw new Error(`Security restriction: access denied to ${filePath}`);
    }

    let targetBackup = backupPath;
    if (!targetBackup) {
      // Find latest backup from change history
      const matching = this.changeHistory
        .filter(c => c.filePath === filePath && c.backupPath && fs.existsSync(c.backupPath))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (matching.length > 0) {
        targetBackup = matching[0].backupPath;
      }
    }

    if (!targetBackup || !fs.existsSync(targetBackup)) {
      throw new Error(`No recoverable backup found for "${filePath}".`);
    }

    const backupContent = fs.readFileSync(targetBackup, 'utf8');
    fs.writeFileSync(filePath, backupContent, 'utf8');

    return {
      reverted: true,
      filePath,
      restoredFrom: targetBackup,
      revertedAt: new Date().toISOString()
    };
  }

  getChangeHistory(filePath = null) {
    if (filePath) {
      return this.changeHistory.filter(c => c.filePath === filePath);
    }
    return [...this.changeHistory];
  }

  executeApprovedCommand(commandStr, cwd = process.cwd(), userConfirmed = false, options = {}) {
    return new Promise((resolve, reject) => {
      if (!userConfirmed) {
        return reject(new Error('User approval required before running terminal commands (Rule 9).'));
      }

      if (!this.security.isPathAllowed(cwd)) {
        return reject(new Error(`Security violation: Working directory "${cwd}" is outside allowed workspace boundaries.`));
      }

      if (options.workspaceRoot) {
        const resolvedCwd = path.resolve(cwd);
        const resolvedWs = path.resolve(options.workspaceRoot);
        if (resolvedCwd !== resolvedWs && !resolvedCwd.startsWith(resolvedWs + path.sep)) {
          return reject(new Error(`Security violation: Working directory "${cwd}" is outside approved workspace boundaries.`));
        }
      }

      if (this.security.isCommandDestructive(commandStr) && options.allowDestructive === false) {
        return reject(new Error(`Destructive command blocked: "${commandStr}" requires explicit destructive authorization.`));
      }

      const timeoutMs = options.timeoutMs || 60000;
      const maxBuffer = options.maxBuffer || (2 * 1024 * 1024);
      const startTime = Date.now();
      let timedOut = false;

      const child = exec(commandStr, { cwd, maxBuffer, timeout: timeoutMs }, (err, stdout, stderr) => {
        const durationMs = Date.now() - startTime;
        this.activeProcesses.delete(child.pid);

        if (err && (err.killed || err.signal === 'SIGTERM')) {
          this._killProcess(child);
        }

        // Mask credentials in output
        const cleanStdout = this.security ? this.security.maskSecrets(stdout || '') : (stdout || '');
        const cleanStderr = this.security ? this.security.maskSecrets(stderr || '') : (stderr || '');

        const exitCode = err ? (err.code || 1) : 0;
        const status = exitCode === 0 ? 'passed' : 'failed';

        resolve({
          command: commandStr,
          cwd,
          exitCode,
          stdout: cleanStdout,
          stderr: cleanStderr,
          durationMs,
          status,
          timedOut,
          cancelled: child.killed,
          error: err ? err.message : null
        });
      });

      if (child.pid) {
        this.activeProcesses.set(child.pid, child);
      }

      if (options.abortSignal) {
        options.abortSignal.addEventListener('abort', () => {
          this._killProcess(child);
        });
      }
    });
  }

  _killProcess(child) {
    if (!child || !child.pid) return;
    child.killed = true;
    if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process');
        execSync(`taskkill /pid ${child.pid} /T /F`, { windowsHide: true, stdio: 'ignore' });
      } catch (e) {
        try { child.kill('SIGKILL'); } catch (err) {}
      }
    } else {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch (e) {
        try { child.kill('SIGTERM'); } catch (err) {}
      }
    }
  }

  cancelActiveCommands() {
    let cancelledCount = 0;
    for (const [pid, child] of this.activeProcesses.entries()) {
      try {
        this._killProcess(child);
        cancelledCount++;
      } catch (e) {}
    }
    this.activeProcesses.clear();
    return { cancelledCount };
  }
}

module.exports = {
  CodingService
};
