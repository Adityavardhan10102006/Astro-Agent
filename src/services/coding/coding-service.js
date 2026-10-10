const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class CodingService {
  constructor(securityService, fileService) {
    this.security = securityService;
    this.files = fileService;
  }

  generateSimpleDiff(originalContent, modifiedContent) {
    const origLines = originalContent.split('\n');
    const modLines = modifiedContent.split('\n');
    const diff = [];

    let i = 0;
    let j = 0;
    while (i < origLines.length || j < modLines.length) {
      if (i < origLines.length && j < modLines.length && origLines[i] === modLines[j]) {
        diff.push(`  ${origLines[i]}`);
        i++;
        j++;
      } else if (j < modLines.length && (i >= origLines.length || !origLines.includes(modLines[j]))) {
        diff.push(`+ ${modLines[j]}`);
        j++;
      } else if (i < origLines.length) {
        diff.push(`- ${origLines[i]}`);
        i++;
      }
    }

    return diff.join('\n');
  }

  proposeFileChange(filePath, newContent) {
    if (!this.security.isPathAllowed(filePath)) {
      throw new Error(`Security restriction: access denied to ${filePath}`);
    }

    let originalContent = '';
    if (fs.existsSync(filePath)) {
      originalContent = fs.readFileSync(filePath, 'utf8');
    }

    const diff = this.generateSimpleDiff(originalContent, newContent);

    return {
      filePath,
      diff,
      originalLength: originalContent.length,
      newLength: newContent.length,
      requiresApproval: true
    };
  }

  applyApprovedChange(filePath, newContent, userConfirmed = false) {
    if (!userConfirmed) {
      throw new Error('User approval required before modifying files (Rule 14).');
    }
    return this.files.backupAndWriteFile(filePath, newContent);
  }

  executeApprovedCommand(commandStr, cwd = process.cwd(), userConfirmed = false) {
    return new Promise((resolve, reject) => {
      if (!userConfirmed) {
        return reject(new Error('User approval required before running terminal commands (Rule 9).'));
      }

      if (this.security.isCommandDestructive(commandStr)) {
        // Double verification for destructive commands
        if (!userConfirmed) {
          return reject(new Error(`Command contains potentially destructive operations: ${commandStr}`));
        }
      }

      exec(commandStr, { cwd, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        resolve({
          command: commandStr,
          exitCode: err ? (err.code || 1) : 0,
          stdout: stdout || '',
          stderr: stderr || '',
          error: err ? err.message : null
        });
      });
    });
  }
}

module.exports = {
  CodingService
};
