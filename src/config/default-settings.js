const path = require('path');
const os = require('os');

const ASTRO_DATA_DIR = process.env.ASTRO_DATA_PATH || path.join(os.homedir(), '.astro_data');

const DEFAULT_SETTINGS = {
  storage: {
    baseDir: ASTRO_DATA_DIR,
    modelsDir: path.join(ASTRO_DATA_DIR, 'models'),
    downloadsDir: path.join(ASTRO_DATA_DIR, 'downloads', 'partial-downloads'),
    conversationsDir: path.join(ASTRO_DATA_DIR, 'databases', 'conversations'),
    ragIndexDir: path.join(ASTRO_DATA_DIR, 'databases', 'rag-index'),
    extractionCacheDir: path.join(ASTRO_DATA_DIR, 'documents', 'extraction-cache'),
    settingsDir: path.join(ASTRO_DATA_DIR, 'settings'),
    logsDir: path.join(ASTRO_DATA_DIR, 'logs')
  },
  appearance: {
    theme: 'dark', // 'dark' | 'light'
    fontSize: 'md', // 'sm' | 'md' | 'lg'
    sidebarCollapsed: false
  },
  privacy: {
    offlineOnly: true,
    allowExternalServices: false,
    telemetryEnabled: false,
    autoUpload: false
  },
  inference: {
    defaultModelId: 'qwen2.5-coder-7b-instruct',
    recommendedQuant: 'Q4_K_M',
    cpuThreads: Math.max(1, Math.min(os.cpus().length - 2, 6)), // Optimal for 6-core Ryzen 5
    contextWindow: 4096,
    maxOutputTokens: 2048,
    temperature: 0.2,
    topP: 0.95,
    repeatPenalty: 1.1,
    gpuLayers: 0 // CPU AVX2 default for integrated Radeon
  },
  rag: {
    chunkSize: 400,
    chunkOverlap: 60,
    maxRetrievedChunks: 4,
    similarityThreshold: 0.65,
    activeCollection: 'default'
  },
  voice: {
    micEnabled: false,
    ttsEnabled: false,
    speechRate: 1.0,
    preferredVoice: 'default'
  },
  security: {
    requireApprovalForCommands: true,
    requireApprovalForFileEdits: true,
    allowedWorkspaceRoots: [process.cwd(), os.homedir()],
    excludedFolders: ['node_modules', '.git', '.astro_data', 'dist', 'build', '.cache']
  },
  supportedFormats: [
    '.md', '.txt', '.js', '.ts', '.jsx', '.tsx',
    '.py', '.json', '.html', '.css', '.csv', '.yaml',
    '.yml', '.sql', '.sh', '.bat', '.ps1'
  ]
};

module.exports = {
  ASTRO_DATA_DIR,
  DEFAULT_SETTINGS
};
