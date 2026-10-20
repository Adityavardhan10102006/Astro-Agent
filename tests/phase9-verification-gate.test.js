const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { APPROVED_MODELS } = require('../src/config/model-catalog');
const { HuggingFaceDiscovery } = require('../src/services/huggingface/huggingface-discovery');
const { StorageService } = require('../src/services/storage/storage-service');
const { SecurityService } = require('../src/services/security/security-service');
const { FileService } = require('../src/services/files/file-service');
const { CodingService } = require('../src/services/coding/coding-service');
const { DownloadManager } = require('../src/services/models/download-manager');
const { VoiceService } = require('../src/services/voice/voice-service');

function createTempWorkspace() {
  const dir = path.join(os.tmpdir(), `astro_p9_test_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test('Phase 9: 1. Hugging Face catalog configuration matches exact Qwen2.5-Coder specifications', () => {
  const defaultModel = APPROVED_MODELS.find(m => m.isDefault);
  assert.ok(defaultModel, 'Default model must be configured');
  assert.strictEqual(defaultModel.id, 'qwen2.5-coder-7b-instruct');
  assert.strictEqual(defaultModel.repoId, 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF');
  assert.strictEqual(defaultModel.format, 'GGUF');
  assert.strictEqual(defaultModel.license, 'Apache-2.0');

  const q4km = defaultModel.quantizations.find(q => q.tag === 'Q4_K_M');
  assert.ok(q4km, 'Q4_K_M quantization must be present');
  assert.strictEqual(q4km.filename, 'qwen2.5-coder-7b-instruct-q4_k_m.gguf');
  assert.strictEqual(q4km.recommended, true);
  assert.ok(q4km.approxSizeGB > 4.0 && q4km.approxSizeGB < 5.0, 'Model size should be ~4.68 GB');
});

test('Phase 9: 2. Offline network boundary blocks HuggingFace discovery when offlineOnly is true', async () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const discovery = new HuggingFaceDiscovery(storage);

    // With offlineOnly: true and no local cache, discovery must throw and make zero network calls
    await assert.rejects(async () => {
      await discovery.discoverModelVariants('Qwen/Qwen2.5-Coder-7B-Instruct-GGUF', { offlineOnly: true });
    }, /Offline mode is active/i);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 9: 3. Partial downloads use .part extension in downloads directory and cannot be mistaken for installed models', () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const dm = new DownloadManager(storage);

    const filename = 'qwen2.5-coder-7b-instruct-q4_k_m.gguf';
    const partialPath = dm.getPartialPath(filename);
    const metaPath = dm.getMetaPath(filename);

    assert.ok(partialPath.endsWith('.part'), 'Partial download must have .part extension');
    assert.ok(partialPath.includes('partial-downloads'), 'Must be stored in partial-downloads directory');
    assert.strictEqual(partialPath.startsWith(storage.paths.models), false, 'Must not be in installed models directory');
    assert.ok(metaPath.endsWith('.meta.json'), 'Metadata must have .meta.json extension');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 9: 4. Process tree cancellation and termination in CodingService', async () => {
  const testDir = createTempWorkspace();
  try {
    const sec = new SecurityService({ allowedWorkspaceRoots: [testDir] });
    const fsService = new FileService(sec);
    const coding = new CodingService(sec, fsService);

    // Launch a short-lived sleep command and cancel it
    const abortController = new AbortController();
    const commandPromise = coding.executeApprovedCommand('node -e "setTimeout(() => console.log(\'done\'), 10000)"', testDir, true, {
      abortSignal: abortController.signal
    });

    // Abort after 50ms
    setTimeout(() => {
      abortController.abort();
    }, 50);

    const res = await commandPromise;
    assert.strictEqual(res.cancelled, true, 'Command must be marked as cancelled');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 9: 5. Workspace root confinement rejects working directory outside approved workspace', async () => {
  const workspaceA = createTempWorkspace();
  const workspaceB = createTempWorkspace();
  try {
    const sec = new SecurityService({ allowedWorkspaceRoots: [workspaceA, workspaceB] });
    const fsService = new FileService(sec);
    const coding = new CodingService(sec, fsService);

    // workspaceB is allowed by security, but caller specifies workspaceA as workspaceRoot
    await assert.rejects(async () => {
      await coding.executeApprovedCommand('node -e "console.log(1)"', workspaceB, true, {
        workspaceRoot: workspaceA
      });
    }, /outside approved workspace/i);
  } finally {
    fs.rmSync(workspaceA, { recursive: true, force: true });
    fs.rmSync(workspaceB, { recursive: true, force: true });
  }
});

test('Phase 9: 6. Secret redaction in StorageService.appendLog masks credentials before writing to disk', () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    storage.ensureDirectories();

    const secretApiKey = 'sk-proj-9876543210fedcba9876543210';
    const secretBearer = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';
    const secretHf = 'hf_1234567890abcdef1234567890';

    storage.appendLog('info', `Connected using key ${secretApiKey} and ${secretBearer}`, {
      token: secretHf,
      safe: 'ok'
    });

    const logFiles = fs.readdirSync(storage.paths.logs);
    assert.ok(logFiles.length > 0, 'Log file must be created');

    const logContent = fs.readFileSync(path.join(storage.paths.logs, logFiles[0]), 'utf8');
    assert.strictEqual(logContent.includes(secretApiKey), false, 'Raw sk- API key must not exist in log');
    assert.strictEqual(logContent.includes(secretHf), false, 'Raw hf_ token must not exist in log');
    assert.ok(logContent.includes('[REDACTED_API_KEY]'), 'Redacted API key marker must be present');
    assert.ok(logContent.includes('[REDACTED_HF_TOKEN]'), 'Redacted HF token marker must be present');
    assert.ok(logContent.includes('[REDACTED_TOKEN]'), 'Redacted Bearer token marker must be present');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 9: 7. Voice service honestly reports unconfigured Whisper speech recognition engine', async () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const voice = new VoiceService(storage);

    // Whisper engine is not configured in local environment
    const status = voice.getEngineStatus();
    assert.strictEqual(status.sttAvailable, false, 'Whisper binary should be recognized as absent');
    assert.strictEqual(voice.isListening, false);

    // Calling startListening should cleanly reject or throw honest error
    await assert.rejects(async () => {
      await voice.startListening();
    }, /Whisper.*not installed/i);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 9: 8. Speech synthesis (TTS) cleanly strips markdown, code blocks, URLs, and source citations', () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const voice = new VoiceService(storage);

    const rawResponse = `Here is the solution to your question:
\`\`\`javascript
function add(a, b) { return a + b; }
\`\`\`
For documentation, see https://developer.mozilla.org/en-US/.
[SOURCE 1: finance.js | Section: calculateInterestRate] Principal is verified.`;

    const cleanSpeech = voice.cleanTextForSpeech(rawResponse);
    assert.strictEqual(cleanSpeech.includes('function add'), false, 'Code blocks must be stripped from spoken text');
    assert.strictEqual(cleanSpeech.includes('https://'), false, 'URLs must be stripped from spoken text');
    assert.strictEqual(cleanSpeech.includes('[SOURCE 1:'), false, 'Citation brackets must be stripped from spoken text');
    assert.ok(cleanSpeech.includes('Here is the solution to your question'), 'Natural language must be preserved');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 9: 9. Real model loading error reporting: Corrupted large model files throw native error and reject silent mock fallback', async () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const { InferenceManager } = require('../src/services/inference/inference-manager');
    const { ModelLifecycleManager } = require('../src/services/models/model-lifecycle');
    const lifecycle = new ModelLifecycleManager();
    const inference = new InferenceManager(storage, null, lifecycle);

    // Create a 2MB corrupted pseudo-GGUF file
    const corruptFile = path.join(testDir, 'corrupted-model.gguf');
    const buf = Buffer.alloc(2 * 1024 * 1024);
    buf.write('GGUF', 0, 4, 'utf8');
    fs.writeFileSync(corruptFile, buf);

    // Loading should throw native error rather than falling back to builtin-runner
    await assert.rejects(async () => {
      await inference.loadModel('corrupted-model', corruptFile);
    }, /Failed to load model.*with node-llama-cpp/i);

    assert.strictEqual(inference.isModelLoaded(), false);
    assert.strictEqual(lifecycle.getState('corrupted-model'), 'failed');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 9: 10. Failed local inference strictly prevents silent cloud fallback (Rule 2 & Rule 4)', async () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const { ExternalProviderInterface } = require('../src/services/inference/external-provider');
    const ext = new ExternalProviderInterface(storage);

    // External provider is disabled by default
    assert.strictEqual(ext.isRemoteInferenceEnabled(), false);

    // Calling external provider without explicit user confirmation must throw
    await assert.rejects(async () => {
      await ext.generateRemote('Hello');
    }, /External provider is not enabled/i);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
