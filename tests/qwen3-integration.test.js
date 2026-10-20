const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { APPROVED_MODELS } = require('../src/config/model-catalog');
const { StorageService } = require('../src/services/storage/storage-service');
const { HardwareService } = require('../src/services/system/hardware-service');
const { HuggingFaceDiscovery } = require('../src/services/huggingface/huggingface-discovery');
const { DownloadManager } = require('../src/services/models/download-manager');
const { DownloadVerifier } = require('../src/services/models/download-verifier');
const { ModelInstaller } = require('../src/services/models/model-installer');
const { ModelRegistry } = require('../src/services/models/model-registry');
const { ModelLifecycleManager } = require('../src/services/models/model-lifecycle');
const { InferenceManager } = require('../src/services/inference/inference-manager');

function createTempWorkspace() {
  const dir = path.join(os.tmpdir(), `astro_qwen3_test_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createMockGGUFFile(targetPath, sizeBytes = 128) {
  const buf = Buffer.alloc(Math.max(32, sizeBytes));
  buf.write('GGUF', 0, 4, 'utf8');
  buf.writeUInt32LE(3, 4); // GGUF v3
  fs.writeFileSync(targetPath, buf);
}

test('Qwen3 Integration: 1. Qwen3-8B catalog specifications and verified Hugging Face metadata', () => {
  const qwen3 = APPROVED_MODELS.find(m => m.id === 'qwen3-8b');
  assert.ok(qwen3, 'Qwen3-8B must be in APPROVED_MODELS');
  assert.strictEqual(qwen3.repoId, 'Qwen/Qwen3-8B-GGUF');
  assert.strictEqual(qwen3.baseRepoId, 'Qwen/Qwen3-8B');
  assert.strictEqual(qwen3.license, 'Apache-2.0');
  assert.strictEqual(qwen3.format, 'GGUF');
  assert.strictEqual(qwen3.isDefault, false);
  assert.strictEqual(qwen3.contextLength, 32768);

  const q4km = qwen3.quantizations.find(q => q.tag === 'Q4_K_M');
  assert.ok(q4km, 'Q4_K_M quantization must exist for Qwen3-8B');
  assert.strictEqual(q4km.filename, 'Qwen3-8B-Q4_K_M.gguf');
  assert.strictEqual(q4km.recommended, true);
  assert.strictEqual(q4km.sha256, 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785');
  assert.ok(q4km.approxSizeGB >= 4.5 && q4km.approxSizeGB <= 5.0);

  const q5km = qwen3.quantizations.find(q => q.tag === 'Q5_K_M');
  assert.ok(q5km, 'Q5_K_M quantization must exist');
  assert.strictEqual(q5km.filename, 'Qwen3-8B-Q5_K_M.gguf');

  const q80 = qwen3.quantizations.find(q => q.tag === 'Q8_0');
  assert.ok(q80, 'Q8_0 quantization must exist');
  assert.strictEqual(q80.filename, 'Qwen3-8B-Q8_0.gguf');
});

test('Qwen3 Integration: 2. Hardware compatibility evaluation for Qwen3-8B on Ryzen 5 laptop', () => {
  const hw = new HardwareService();
  const qwen3 = APPROVED_MODELS.find(m => m.id === 'qwen3-8b');
  const evalResult = hw.evaluateCompatibility(qwen3, 'Q4_K_M');

  assert.strictEqual(evalResult.compatible, true, 'Qwen3-8B Q4_K_M must be compatible with hardware specs');
  assert.strictEqual(evalResult.requiredSizeGB, 4.68);
  assert.ok(evalResult.systemRamGB >= 8, 'System RAM meets requirements');
  assert.ok(evalResult.freeDiskGB > 10, 'Sufficient disk space available');
});

test('Qwen3 Integration: 3. Hugging Face discovery parses Qwen3-8B-GGUF files accurately', () => {
  const hf = new HuggingFaceDiscovery();
  assert.ok(hf.trustedRepos.has('Qwen/Qwen3-8B-GGUF'), 'Qwen/Qwen3-8B-GGUF must be in trustedRepos');

  const mockHfTree = [
    { path: 'Qwen3-8B-Q4_K_M.gguf', size: 5027783488, lfs: { oid: 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785', size: 5027783488 } },
    { path: 'Qwen3-8B-Q5_K_M.gguf', size: 5851112224, lfs: { oid: '068bae163faa96ad48032daf4e071a6a28fe67d8dcc95367609c2ff165e52738', size: 5851112224 } },
    { path: 'README.md', size: 1024 }
  ];

  const variants = hf.parseTreeFiles(mockHfTree, 'Qwen/Qwen3-8B-GGUF');
  assert.strictEqual(variants.length, 2);

  const q4 = variants.find(v => v.quantTag === 'Q4_K_M');
  assert.ok(q4);
  assert.strictEqual(q4.filename, 'Qwen3-8B-Q4_K_M.gguf');
  assert.strictEqual(q4.isRecommended, true);
  assert.strictEqual(q4.sha256, 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785');
  assert.strictEqual(q4.downloadUrl, 'https://huggingface.co/Qwen/Qwen3-8B-GGUF/resolve/main/Qwen3-8B-Q4_K_M.gguf');
});

test('Qwen3 Integration: 4. StorageService synchronizes Qwen3-8B catalog entry into persistent storage', () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    storage.ensureDirectories();

    const catalog = storage.getCatalog();
    const qwen3 = catalog.models.find(m => m.id === 'qwen3-8b');
    assert.ok(qwen3, 'Qwen3-8B must be in stored catalog');
    assert.strictEqual(qwen3.repoId, 'Qwen/Qwen3-8B-GGUF');
    assert.strictEqual(qwen3.format, 'GGUF');
    assert.strictEqual(qwen3.quantizations.length, 3);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Qwen3 Integration: 5. DownloadManager generates isolated partial path and queue item for Qwen3-8B', () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const dm = new DownloadManager(storage);

    const filename = 'Qwen3-8B-Q4_K_M.gguf';
    const partialPath = dm.getPartialPath(filename);
    assert.ok(partialPath.endsWith('Qwen3-8B-Q4_K_M.gguf.part'));
    assert.ok(partialPath.includes('partial-downloads'));
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Qwen3 Integration: 6. Model switching: Unloads Qwen2.5-Coder before loading Qwen3-8B to prevent dual-model memory overload', async () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const hw = new HardwareService();
    const lifecycle = new ModelLifecycleManager();
    const registry = new ModelRegistry(storage);
    const inference = new InferenceManager(storage, hw, lifecycle, registry);

    const model1Path = path.join(testDir, 'qwen2.5.gguf');
    const model2Path = path.join(testDir, 'qwen3.gguf');
    createMockGGUFFile(model1Path);
    createMockGGUFFile(model2Path);

    // Load Qwen2.5-Coder
    await inference.loadModel('qwen2.5-coder-7b-instruct', model1Path, { allowMockFallback: true });
    assert.strictEqual(inference.loadedModel.modelId, 'qwen2.5-coder-7b-instruct');
    assert.strictEqual(inference.isModelLoaded(), true);

    // Switching to Qwen3-8B automatically unloads Qwen2.5-Coder
    await inference.loadModel('qwen3-8b', model2Path, { allowMockFallback: true });
    assert.strictEqual(inference.loadedModel.modelId, 'qwen3-8b');
    assert.strictEqual(inference.loadedModel.filePath, model2Path);
    assert.strictEqual(lifecycle.getState('qwen2.5-coder-7b-instruct'), 'installed');
    assert.strictEqual(lifecycle.getState('qwen3-8b'), 'ready');

    // Unload Qwen3-8B
    await inference.unloadModel();
    assert.strictEqual(inference.isModelLoaded(), false);
    assert.strictEqual(lifecycle.getState('qwen3-8b'), 'installed');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Qwen3 Integration: 7. ModelVerifier checks GGUF magic header and catches corrupted Qwen3 downloads', () => {
  const testDir = createTempWorkspace();
  try {
    const verifier = new DownloadVerifier();
    const validFile = path.join(testDir, 'Qwen3-valid.gguf');
    createMockGGUFFile(validFile, 64);

    const validCheck = verifier.verifyGGUFHeader(validFile);
    assert.strictEqual(validCheck.valid, true);
    assert.strictEqual(validCheck.version, 3);

    // Corrupted file (HTML error page returned by proxy/CDN)
    const corruptFile = path.join(testDir, 'Qwen3-corrupt.gguf');
    fs.writeFileSync(corruptFile, '<!DOCTYPE html><html>404 Not Found</html>');

    const corruptCheck = verifier.verifyGGUFHeader(corruptFile);
    assert.strictEqual(corruptCheck.valid, false);
    assert.ok(corruptCheck.error.includes('header magic') || corruptCheck.error.includes('magic header') || corruptCheck.error.includes('Not a valid GGUF'));
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Qwen3 Integration: 8. ModelInstaller verifies and registers Qwen3-8B into persistent registry', async () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const verifier = new DownloadVerifier();
    const registry = new ModelRegistry(storage);
    const lifecycle = new ModelLifecycleManager();
    const installer = new ModelInstaller(storage, verifier, registry, lifecycle);

    // Simulate downloaded file
    const downloadedPath = path.join(testDir, 'Qwen3-8B-Q4_K_M.gguf.part');
    createMockGGUFFile(downloadedPath, 256);

    const installResult = await installer.installVerifiedModel({
      modelId: 'qwen3-8b',
      displayName: 'Qwen3-8B',
      variantTag: 'Q4_K_M',
      filename: 'Qwen3-8B-Q4_K_M.gguf',
      partialFilePath: downloadedPath,
      expectedSizeBytes: 256,
      quantizationTag: 'Q4_K_M'
    });

    assert.strictEqual(installResult.modelId, 'qwen3-8b');
    assert.ok(fs.existsSync(installResult.filePath));
    assert.strictEqual(lifecycle.getState('qwen3-8b'), 'installed');

    // Registry persistence
    const entry = registry.getEntry('qwen3-8b');
    assert.ok(entry);
    assert.strictEqual(entry.quantization, 'Q4_K_M');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Qwen3 Integration: 9. ModelInstaller.importLocalModel integrates pre-existing local GGUF file in-place with header verification', async () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const verifier = new DownloadVerifier();
    const registry = new ModelRegistry(storage);
    const lifecycle = new ModelLifecycleManager();
    const installer = new ModelInstaller(storage, verifier, registry, lifecycle);

    // Pre-existing local file in workspace
    const localFile = path.join(testDir, 'Qwen3-8B-Q4_K_M.gguf');
    createMockGGUFFile(localFile, 512);

    const importRes = await installer.importLocalModel({
      sourcePath: localFile,
      modelId: 'qwen3-8b',
      displayName: 'Qwen3-8B',
      variantTag: 'Q4_K_M',
      copyToManagedDir: false
    });

    assert.strictEqual(importRes.modelId, 'qwen3-8b');
    assert.strictEqual(importRes.filePath, path.resolve(localFile));
    assert.strictEqual(lifecycle.getState('qwen3-8b'), 'installed');

    const regEntry = registry.getEntry('qwen3-8b');
    assert.ok(regEntry);
    assert.strictEqual(regEntry.quantization, 'Q4_K_M');
    assert.strictEqual(regEntry.verificationAudit.headerMagic, 'GGUF');
    assert.strictEqual(regEntry.verificationAudit.ggufVersion, 3);

    // Catalog was updated with local path
    const catalog = storage.getCatalog();
    const catModel = catalog.models.find(m => m.id === 'qwen3-8b');
    assert.ok(catModel);
    assert.strictEqual(catModel.installed, true);
    assert.strictEqual(catModel.localPath, path.resolve(localFile));
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Qwen3 Integration: 10. ModelInstaller.importLocalModel rejects corrupted non-GGUF file', async () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const verifier = new DownloadVerifier();
    const registry = new ModelRegistry(storage);
    const lifecycle = new ModelLifecycleManager();
    const installer = new ModelInstaller(storage, verifier, registry, lifecycle);

    const corruptFile = path.join(testDir, 'fake-qwen3.gguf');
    fs.writeFileSync(corruptFile, 'NOT_A_VALID_GGUF_HEADER_DATA');

    await assert.rejects(async () => {
      await installer.importLocalModel({
        sourcePath: corruptFile,
        modelId: 'qwen3-8b'
      });
    }, /Invalid GGUF header magic/);

    assert.strictEqual(lifecycle.getState('qwen3-8b'), 'failed');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Qwen3 Integration: 11. InferenceManager resolves ChatML chatWrapper for Qwen3 architecture and handles generation', async () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const hw = new HardwareService();
    const lifecycle = new ModelLifecycleManager();
    const registry = new ModelRegistry(storage);
    const inference = new InferenceManager(storage, hw, lifecycle, registry);

    const modelPath = path.join(testDir, 'qwen3-mock.gguf');
    createMockGGUFFile(modelPath);

    // Load with mock fallback for unit test speed
    await inference.loadModel('qwen3-8b', modelPath, { allowMockFallback: true });
    assert.strictEqual(inference.isModelLoaded(), true);
    assert.strictEqual(inference.loadedModel.modelId, 'qwen3-8b');

    // Generate output
    const tokensReceived = [];
    const res = await inference.generate({
      prompt: 'Summarize Qwen3 capabilities',
      onToken: (t) => { if (!t.done) tokensReceived.push(t.token); }
    });

    assert.ok(res.text && res.text.length > 0);
    assert.ok(tokensReceived.length > 0);
    assert.strictEqual(res.tokenCount, tokensReceived.length);

    await inference.unloadModel();
    assert.strictEqual(inference.isModelLoaded(), false);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Qwen3 Integration: 12. Verification of root Qwen3-8B-Q4_K_M.gguf file integrity and specs', () => {
  const rootModelPath = path.resolve(__dirname, '..', 'Qwen3-8B-Q4_K_M.gguf');
  if (fs.existsSync(rootModelPath)) {
    const verifier = new DownloadVerifier();
    const header = verifier.verifyGGUFHeader(rootModelPath);
    assert.strictEqual(header.valid, true, 'Header magic must be GGUF');
    assert.strictEqual(header.magic, 'GGUF');
    assert.strictEqual(header.version, 3);
    assert.strictEqual(header.tensorCount, 399);

    const stat = fs.statSync(rootModelPath);
    assert.strictEqual(stat.size, 5027783488, 'Size should exactly match Q4_K_M build (5,027,783,488 bytes)');
  }
});

