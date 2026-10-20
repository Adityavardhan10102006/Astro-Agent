const ACTION_RISK = {
  LOW: 'low',
  MODERATE: 'moderate',
  HIGH: 'high'
};

const ACTION_REGISTRY = {
  system_status: {
    id: 'system_status',
    name: 'Report System & Model Status',
    risk: ACTION_RISK.LOW,
    description: 'Inspects CPU, RAM, disk space, and active model state without modifying the system.',
    parameters: []
  },
  search_library: {
    id: 'search_library',
    name: 'Search Local Library',
    risk: ACTION_RISK.LOW,
    description: 'Searches user-approved indexed local documents for relevant passages.',
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Search term or query' },
      { name: 'topK', type: 'number', required: false, default: 4, description: 'Maximum passages to retrieve' }
    ]
  },
  read_file_info: {
    id: 'read_file_info',
    name: 'Read File Information',
    risk: ACTION_RISK.LOW,
    description: 'Reads metadata and statistics for a file within approved workspace boundaries.',
    parameters: [
      { name: 'filePath', type: 'string', required: true, description: 'Absolute or workspace-relative path' }
    ]
  },
  manage_jobs: {
    id: 'manage_jobs',
    name: 'Manage ASTRO Jobs',
    risk: ACTION_RISK.LOW,
    description: 'Inspects or cancels ASTRO indexing, research, or inference jobs.',
    parameters: [
      { name: 'operation', type: 'string', required: true, description: 'cancel-indexing, cancel-inference, or cancel-research' }
    ]
  },
  create_note: {
    id: 'create_note',
    name: 'Create Draft Note',
    risk: ACTION_RISK.MODERATE,
    description: 'Creates a draft Markdown note file in ASTRO-managed notes storage.',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'Title or basename of the note' },
      { name: 'content', type: 'string', required: true, description: 'Markdown or plain text content' }
    ]
  },
  open_app: {
    id: 'open_app',
    name: 'Open Application',
    risk: ACTION_RISK.MODERATE,
    description: 'Launches an application strictly from the user-configured trusted application allowlist.',
    parameters: [
      { name: 'appName', type: 'string', required: true, description: 'Name of the trusted application' }
    ]
  },
  open_path: {
    id: 'open_path',
    name: 'Open File or Folder in OS',
    risk: ACTION_RISK.MODERATE,
    description: 'Opens a user-approved file or directory in the native OS desktop shell.',
    parameters: [
      { name: 'targetPath', type: 'string', required: true, description: 'Path to open' }
    ]
  },
  exec_command: {
    id: 'exec_command',
    name: 'Execute Terminal Command',
    risk: ACTION_RISK.HIGH,
    description: 'Executes a command in an approved workspace. Always requires explicit interactive confirmation.',
    parameters: [
      { name: 'command', type: 'string', required: true, description: 'Shell command string' },
      { name: 'cwd', type: 'string', required: false, description: 'Working directory within allowed roots' }
    ]
  },
  delete_file: {
    id: 'delete_file',
    name: 'Delete File',
    risk: ACTION_RISK.HIGH,
    description: 'Deletes a file within approved workspace roots. Always requires explicit confirmation.',
    parameters: [
      { name: 'filePath', type: 'string', required: true, description: 'File path to delete' }
    ]
  }
};

module.exports = {
  ACTION_RISK,
  ACTION_REGISTRY
};
