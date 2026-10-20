const path = require('path');
const os = require('os');

class SecurityService {
  constructor(settings = {}) {
    this.allowedRoots = settings.allowedWorkspaceRoots || [process.cwd(), os.homedir()];
    this.destructiveCommands = [
      'rm', 'del', 'rmdir', 'format', 'mkfs', 'drop',
      'truncate', 'git reset --hard', 'git clean -f'
    ];
  }

  isPathAllowed(targetPath) {
    if (!targetPath) return false;
    const resolved = path.resolve(targetPath);
    return this.allowedRoots.some(root => {
      const resolvedRoot = path.resolve(root);
      return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep);
    });
  }

  isCommandDestructive(commandStr) {
    if (!commandStr) return false;
    const lower = commandStr.toLowerCase().trim();
    return this.destructiveCommands.some(cmd => lower.includes(cmd));
  }

  maskSecrets(text) {
    if (typeof text !== 'string') return text;
    // Mask API keys, tokens, Bearer headers, passwords
    return text
      .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]{15,}/gi, '$1[REDACTED_TOKEN]')
      .replace(/(hf_[a-zA-Z0-9_\-]{20,})/gi, '[REDACTED_HF_TOKEN]')
      .replace(/(sk-[a-zA-Z0-9_\-]{20,})/gi, '[REDACTED_API_KEY]')
      .replace(/(password\s*[:=]\s*)[^\s;]+/gi, '$1[REDACTED_PASSWORD]');
  }
}

module.exports = {
  SecurityService
};
