const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { shell } = require('electron') || {};
const { ACTION_RISK, ACTION_REGISTRY } = require('./action-registry');

class ActionService {
  constructor({
    storageService,
    securityService,
    hardwareService,
    inferenceManager,
    ragService,
    fileService,
    codingService,
    activityService
  }) {
    this.storage = storageService;
    this.security = securityService;
    this.hardware = hardwareService;
    this.inference = inferenceManager;
    this.rag = ragService;
    this.files = fileService;
    this.coding = codingService;
    this.activity = activityService;

    this.pendingActions = new Map();
    this.recentExecutions = new Map(); // actionKey -> timestamp (duplicate protection)
    this.debounceWindowMs = 2000;

    this.notesDir = path.join(this.storage.paths.base, 'notes');
    this.ensureNotesDir();

    // Default allowed applications
    this.allowedApps = [
      { id: 'notepad', name: 'Notepad', executable: 'notepad.exe', description: 'Windows Notepad' },
      { id: 'calculator', name: 'Calculator', executable: 'calc.exe', description: 'Windows Calculator' },
      { id: 'explorer', name: 'Explorer', executable: 'explorer.exe', description: 'File Explorer' },
      { id: 'terminal', name: 'Terminal', executable: 'cmd.exe', description: 'Command Prompt' },
      { id: 'vscode', name: 'VS Code', executable: 'code.cmd', description: 'Visual Studio Code' }
    ];
  }

  ensureNotesDir() {
    if (!fs.existsSync(this.notesDir)) {
      try {
        fs.mkdirSync(this.notesDir, { recursive: true });
      } catch (e) {
        // Ignored if permissions restrict
      }
    }
  }

  getAllowedApps() {
    return [...this.allowedApps];
  }

  setAllowedApps(apps) {
    if (Array.isArray(apps)) {
      this.allowedApps = apps;
    }
    return this.getAllowedApps();
  }

  listSupportedActions() {
    return Object.values(ACTION_REGISTRY);
  }

  getActionDefinition(actionId) {
    return ACTION_REGISTRY[actionId] || null;
  }

  // Duplicate prevention check
  isDuplicateExecution(actionId, params) {
    const key = `${actionId}:${JSON.stringify(params || {})}`;
    const now = Date.now();
    const lastTime = this.recentExecutions.get(key);
    if (lastTime && (now - lastTime) < this.debounceWindowMs) {
      return true;
    }
    return false;
  }

  recordExecutionTime(actionId, params) {
    const key = `${actionId}:${JSON.stringify(params || {})}`;
    this.recentExecutions.set(key, Date.now());
  }

  /**
   * Request an action. Depending on risk, it either executes immediately or stages for confirmation.
   */
  async requestAction(actionId, params = {}, { origin = 'user', bypassDuplicateCheck = false } = {}) {
    const actionDef = this.getActionDefinition(actionId);
    if (!actionDef) {
      throw new Error(`Unsupported action: "${actionId}". Check supported actions in ASTRO Action Registry.`);
    }

    if (!bypassDuplicateCheck && this.isDuplicateExecution(actionId, params)) {
      throw new Error(`Duplicate action prevented: "${actionDef.name}" was executed within the last ${this.debounceWindowMs / 1000}s.`);
    }

    const requestId = `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const intentDescription = this.describeActionIntent(actionDef, params);

    // Immediate allowlist validation for open_app
    if (actionDef.id === 'open_app') {
      const allowed = this.findAllowedApp(params.appName);
      if (!allowed) {
        throw new Error(`Application "${params.appName}" is not in the trusted allowlist. Only configured apps (${this.allowedApps.map(a => a.name).join(', ')}) can be launched.`);
      }
    }

    // Classification: Low risk vs Moderate/High risk
    if (actionDef.risk === ACTION_RISK.LOW) {
      // Low risk actions can execute immediately
      return this.executeDirectly(requestId, actionDef, params, intentDescription);
    }

    // Moderate and High risk actions require explicit staging & confirmation
    const pendingRequest = {
      id: requestId,
      actionId,
      actionDef,
      params,
      origin,
      intent: intentDescription,
      risk: actionDef.risk,
      createdAt: Date.now(),
      status: 'pending_confirmation'
    };

    this.pendingActions.set(requestId, pendingRequest);

    if (this.activity) {
      this.activity.createTask({
        id: requestId,
        type: 'desktop-action',
        label: `${actionDef.name} (${actionDef.risk.toUpperCase()})`,
        details: `Pending confirmation: ${intentDescription}`,
        cancellable: true
      });
    }

    return {
      status: 'pending_confirmation',
      requestId,
      actionId,
      actionName: actionDef.name,
      risk: actionDef.risk,
      intent: intentDescription,
      params,
      requiresConfirmation: true
    };
  }

  describeActionIntent(actionDef, params) {
    switch (actionDef.id) {
      case 'system_status':
        return 'Check system specifications, resource usage, and local model state.';
      case 'search_library':
        return `Search local library for "${params.query || ''}".`;
      case 'read_file_info':
        return `Inspect file metadata for ${params.filePath || ''}.`;
      case 'manage_jobs':
        return `Manage ASTRO background jobs: ${params.operation || 'status'}.`;
      case 'create_note':
        return `Create note "${params.title || 'Untitled'}" in ASTRO notes directory.`;
      case 'open_app':
        return `Launch trusted application: ${params.appName || ''}.`;
      case 'open_path':
        return `Open target path in desktop shell: ${params.targetPath || ''}.`;
      case 'exec_command':
        return `Run terminal command: ${params.command || ''}.`;
      case 'delete_file':
        return `Permanently delete file: ${params.filePath || ''}.`;
      default:
        return `Execute action ${actionDef.name}.`;
    }
  }

  async executeDirectly(requestId, actionDef, params, intentDescription) {
    if (this.activity) {
      this.activity.createTask({
        id: requestId,
        type: 'desktop-action',
        label: actionDef.name,
        details: intentDescription,
        cancellable: false
      });
    }

    try {
      const result = await this.dispatchAction(actionDef.id, params);
      this.recordExecutionTime(actionDef.id, params);
      if (this.activity) {
        this.activity.completeTask(requestId, 'Completed successfully');
      }
      return {
        status: 'completed',
        requestId,
        actionId: actionDef.id,
        actionName: actionDef.name,
        risk: actionDef.risk,
        intent: intentDescription,
        result
      };
    } catch (err) {
      this.recordExecutionTime(actionDef.id, params);
      if (this.activity) {
        this.activity.failTask(requestId, err.message);
      }
      throw err;
    }
  }

  /**
   * Confirm and execute a pending moderate or high-risk action.
   */
  async confirmAction(requestId, userConfirmed = true) {
    if (!userConfirmed) {
      return this.cancelAction(requestId, 'User denied approval.');
    }

    const pending = this.pendingActions.get(requestId);
    if (!pending) {
      throw new Error(`Action request "${requestId}" not found or already processed.`);
    }

    const { actionDef, params, intent } = pending;

    // RULE: Validate target again immediately before execution
    this.preExecutionValidation(actionDef.id, params);

    try {
      const result = await this.dispatchAction(actionDef.id, params, true);
      this.recordExecutionTime(actionDef.id, params);
      this.pendingActions.delete(requestId);

      if (this.activity) {
        this.activity.completeTask(requestId, 'Approved and executed');
      }

      return {
        status: 'completed',
        requestId,
        actionId: actionDef.id,
        actionName: actionDef.name,
        risk: actionDef.risk,
        intent,
        result
      };
    } catch (err) {
      this.pendingActions.delete(requestId);
      if (this.activity) {
        this.activity.failTask(requestId, err.message);
      }
      throw err;
    }
  }

  cancelAction(requestId, reason = 'Cancelled by user') {
    const pending = this.pendingActions.get(requestId);
    if (!pending) {
      return { status: 'cancelled', requestId, message: 'Request was not pending.' };
    }

    this.pendingActions.delete(requestId);
    if (this.activity) {
      this.activity.cancelTask(requestId);
    }

    return {
      status: 'cancelled',
      requestId,
      actionId: pending.actionId,
      reason
    };
  }

  getPendingActions() {
    return Array.from(this.pendingActions.values());
  }

  preExecutionValidation(actionId, params) {
    if (actionId === 'open_path' || actionId === 'read_file_info') {
      const p = params.targetPath || params.filePath;
      if (!p || !this.security.isPathAllowed(p)) {
        throw new Error(`Security violation: Access to path "${p}" is outside approved workspace boundaries.`);
      }
    } else if (actionId === 'delete_file') {
      const p = params.filePath;
      if (!p || !this.security.isPathAllowed(p)) {
        throw new Error(`Security violation: Cannot delete path outside approved workspace.`);
      }
      if (!fs.existsSync(p)) {
        throw new Error(`Target file no longer exists: ${p}`);
      }
    } else if (actionId === 'open_app') {
      const allowed = this.findAllowedApp(params.appName);
      if (!allowed) {
        throw new Error(`Application "${params.appName}" is not in the trusted allowlist.`);
      }
    }
  }

  findAllowedApp(appName) {
    if (!appName) return null;
    const clean = appName.toLowerCase().trim().replace('.exe', '');
    return this.allowedApps.find(a => 
      a.id.toLowerCase() === clean || 
      a.name.toLowerCase() === clean ||
      a.executable.toLowerCase().includes(clean)
    );
  }

  async dispatchAction(actionId, params, confirmed = false) {
    switch (actionId) {
      case 'system_status': {
        let specs = {};
        if (this.hardware) {
          if (typeof this.hardware.detectSystemSpecs === 'function') {
            specs = this.hardware.detectSystemSpecs();
          } else if (typeof this.hardware.getSystemSpecs === 'function') {
            specs = await this.hardware.getSystemSpecs();
          }
        }
        const activeModel = this.inference ? this.inference.getActiveModel() : null;
        return {
          cpu: (specs.cpu && specs.cpu.model) || specs.cpu || 'AMD Ryzen 5',
          ramTotalGB: (specs.memory && specs.memory.totalGB) || (specs.ram && (specs.ram.totalBytes / (1024 ** 3)).toFixed(1)) || '16.0',
          ramFreeGB: (specs.memory && specs.memory.freeGB) || (specs.ram && (specs.ram.freeBytes / (1024 ** 3)).toFixed(1)) || '8.0',
          diskFreeGB: (specs.disk && specs.disk.freeGB) || '100',
          gpu: (specs.gpu && specs.gpu.model) || specs.gpu || 'Integrated Radeon Graphics',
          activeModel: activeModel ? activeModel.modelId : 'None loaded',
          offlineOnly: true
        };
      }

      case 'search_library': {
        if (!this.rag) throw new Error('RAG service unavailable');
        const query = params.query;
        if (!query) throw new Error('Query parameter is required for search_library');
        const topK = params.topK || 4;
        const res = await this.rag.query(query, topK);
        return {
          query,
          matchCount: (res.citations || []).length,
          hasEvidence: res.hasEvidence,
          citations: res.citations || [],
          snippets: (res.chunks || []).map(c => ({
            file: c.metadata ? c.metadata.docName : 'Document',
            text: (c.text || '').slice(0, 150) + '...'
          }))
        };
      }

      case 'read_file_info': {
        const filePath = params.filePath;
        if (!filePath) throw new Error('filePath is required for read_file_info');
        if (!this.security.isPathAllowed(filePath)) {
          throw new Error(`Security restriction: access denied to path "${filePath}".`);
        }
        if (!fs.existsSync(filePath)) {
          throw new Error(`File does not exist: "${filePath}"`);
        }
        if (this.files) {
          return this.files.getFileDetails(filePath);
        }
        const stat = fs.statSync(filePath);
        return {
          path: filePath,
          sizeBytes: stat.size,
          mtime: stat.mtime.toISOString(),
          isDirectory: stat.isDirectory()
        };
      }

      case 'manage_jobs': {
        const op = params.operation;
        if (op === 'cancel-indexing') {
          if (this.rag && this.rag.cancelIndexing) {
            return { cancelled: this.rag.cancelIndexing(), operation: op };
          }
        } else if (op === 'cancel-inference') {
          if (this.inference && this.inference.cancelGeneration) {
            return { cancelled: this.inference.cancelGeneration(), operation: op };
          }
        }
        return { status: 'acknowledged', operation: op };
      }

      case 'create_note': {
        this.ensureNotesDir();
        const baseName = path.basename((params.title || 'note').trim().replace(/\\/g, '/'));
        // Prevent path traversal and special characters
        const safeTitle = baseName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'note';
        const filename = `${safeTitle.replace(/\s+/g, '_')}_${Date.now()}.md`;
        const notePath = path.join(this.notesDir, filename);

        // Verify it stays within notes dir
        const resolved = path.resolve(notePath);
        if (!resolved.startsWith(path.resolve(this.notesDir))) {
          throw new Error('Path traversal detected in note creation.');
        }

        const content = params.content || '';
        fs.writeFileSync(notePath, content, 'utf8');
        const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

        return {
          created: true,
          filePath: notePath,
          filename,
          wordCount,
          sizeBytes: Buffer.byteLength(content, 'utf8')
        };
      }

      case 'open_app': {
        const appInfo = this.findAllowedApp(params.appName);
        if (!appInfo) {
          throw new Error(`Application "${params.appName}" is not in the trusted allowlist. Only configured apps (${this.allowedApps.map(a => a.name).join(', ')}) can be launched.`);
        }

        // Spawn detached process
        try {
          const child = spawn(appInfo.executable, [], {
            detached: true,
            stdio: 'ignore',
            shell: process.platform === 'win32'
          });
          child.unref();
          return {
            launched: true,
            app: appInfo.name,
            executable: appInfo.executable
          };
        } catch (e) {
          throw new Error(`Failed to launch application "${appInfo.name}": ${e.message}`);
        }
      }

      case 'open_path': {
        const targetPath = params.targetPath;
        if (!targetPath) throw new Error('targetPath is required for open_path');
        if (!this.security.isPathAllowed(targetPath)) {
          throw new Error(`Security restriction: access denied to path "${targetPath}".`);
        }
        if (!fs.existsSync(targetPath)) {
          throw new Error(`Path does not exist: "${targetPath}"`);
        }

        if (shell && shell.openPath) {
          const err = await shell.openPath(targetPath);
          if (err) throw new Error(`Shell open error: ${err}`);
        }
        return {
          opened: true,
          path: targetPath
        };
      }

      case 'exec_command': {
        if (!confirmed) {
          throw new Error('Explicit confirmation is required to execute terminal commands (Rule 9).');
        }
        if (!this.coding) {
          throw new Error('Coding service unavailable for command execution.');
        }
        return this.coding.executeApprovedCommand(params.command, params.cwd || process.cwd(), confirmed);
      }

      case 'delete_file': {
        if (!confirmed) {
          throw new Error('Explicit confirmation is required to delete files (Rule 14).');
        }
        const filePath = params.filePath;
        if (!this.security.isPathAllowed(filePath)) {
          throw new Error(`Security restriction: access denied to path "${filePath}".`);
        }
        if (!fs.existsSync(filePath)) {
          throw new Error(`File does not exist: "${filePath}"`);
        }
        fs.unlinkSync(filePath);
        return {
          deleted: true,
          filePath
        };
      }

      default:
        throw new Error(`No dispatcher for action "${actionId}".`);
    }
  }

  /**
   * Neutralize prompt injection: strip any untrusted document context before
   * attempting to extract action intents.
   */
  stripUntrustedContext(text) {
    if (!text || typeof text !== 'string') return '';
    // Strip RAG document boundaries
    let cleaned = text.replace(/--- BEGIN LOCAL DOCUMENT CONTEXT[\s\S]*?--- END LOCAL DOCUMENT CONTEXT ---/gi, '');
    // Strip system notices
    cleaned = cleaned.replace(/\[NOTE: No relevant local documents[\s\S]*?\]/gi, '');
    return cleaned.trim();
  }

  /**
   * Detects structured action intents in user input or assistant output.
   */
  parseActionIntent(text) {
    const sanitizedText = this.stripUntrustedContext(text);
    if (!sanitizedText) return null;

    // 1. Structured action format: astro:action:{"action": "create_note", "params": {...}}
    const structuredMatch = sanitizedText.match(/astro:action:(\{[\s\S]*?\})/i);
    if (structuredMatch) {
      try {
        const parsed = JSON.parse(structuredMatch[1]);
        if (parsed.action && this.getActionDefinition(parsed.action)) {
          return {
            actionId: parsed.action,
            params: parsed.params || {}
          };
        }
      } catch (e) {
        // Fall through to heuristic detection
      }
    }

    // 2. Direct natural language pattern matching for standard desktop tasks
    const lower = sanitizedText.toLowerCase().trim();

    // System status
    if (/^(what is the|show|check|report)?\s*(system|pc|laptop|hardware)\s*(status|specs|health)?$/i.test(lower) ||
        lower === 'system status' || lower === 'check specs' || lower === 'check status') {
      return { actionId: 'system_status', params: {} };
    }

    // Open application
    const openAppMatch = lower.match(/^(?:open|launch|start)\s+(?:the\s+)?(notepad|calculator|calc|explorer|terminal|cmd|vs\s*code|code)\b/i);
    if (openAppMatch) {
      const appKey = openAppMatch[1].trim();
      return { actionId: 'open_app', params: { appName: appKey } };
    }

    // Create note
    const createNoteMatch = lower.match(/^(?:create|make|write)\s+(?:a\s+)?note\s+(?:called|named|titled\s+)?([a-z0-9_\-\s]+?)(?:\s+(?:with content|saying|about)\s+([\s\S]+))?$/i);
    if (createNoteMatch) {
      const title = createNoteMatch[1].trim();
      const content = createNoteMatch[2] ? createNoteMatch[2].trim() : `# ${title}\n\nDraft note created by ASTRO.`;
      return { actionId: 'create_note', params: { title, content } };
    }

    // Cancel job
    if (/^(cancel|stop)\s+(indexing|index\s+job)$/i.test(lower)) {
      return { actionId: 'manage_jobs', params: { operation: 'cancel-indexing' } };
    }
    if (/^(cancel|stop)\s+(inference|generation)$/i.test(lower)) {
      return { actionId: 'manage_jobs', params: { operation: 'cancel-inference' } };
    }

    return null;
  }
}

module.exports = {
  ActionService
};
