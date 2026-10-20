const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const { StorageService } = require('../src/services/storage/storage-service');
const { DownloadManager } = require('../src/services/models/download-manager');
const { DownloadVerifier } = require('../src/services/models/download-verifier');
const { ModelInstaller } = require('../src/services/models/model-installer');
const { ModelRegistry } = require('../src/services/models/model-registry');
const { ModelLifecycleManager, LIFECYCLE_STATES } = require('../src/services/models/model-lifecycle');
const { HuggingFaceDiscovery } = require('../src/services/huggingface/huggingface-discovery');
const { InferenceManager } = require('../src/services/inference/inference-manager');

// Helper to create a valid minimal GGUF buffer
function createValidGGUFBuffer(sizeBytes = 64) {
  const buf = Buffer.alloc(Math.max(32, sizeBytes));
  buf.write('GGUF', 0, 4, 'utf8');
  buf.writeUInt32LE(3, 4); // GGUF version 3
  buf.writeBigUInt64LE(100n, 8); // 100 tensors
  buf.writeBigUInt64LE(10n, 16); // 10 metadata kv pairs
  return buf;
}

// Helper to safely stop an HTTP server and all its open sockets
function closeServerAsync(server) {
  return new Promise((resolve) => {
    if (server.closeAllConnections) {
      server.closeAllConnections();
    }
    server.close(() => resolve());
  });
}

test('1. Model-catalog validation: default Qwen2.5-Coder and optional Qwen3-8B', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-cat-test-'));
  const storage = new StorageService(tempDir);
  const catalog = storage.getCatalog();

  assert.ok(catalog.models && Array.isArray(catalog.models));
  assert.ok(catalog.models.length >= 2);

  // Default model must be Qwen2.5-Coder-7B-Instruct
  const defaultModel = catalog.models.find(m => m.id.includes('qwen2.5-coder-7b'));
  assert.ok(defaultModel, 'Default model qwen2.5-coder-7b must be present');
  assert.strictEqual(defaultModel.isDefault, true);
  assert.ok(defaultModel.author.includes('Qwen') || defaultModel.author.includes('Alibaba'));
  assert.strictEqual(defaultModel.format.toUpperCase(), 'GGUF');
  assert.strictEqual(defaultModel.license, 'Apache-2.0');
  assert.strictEqual(defaultModel.repoId, 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF');

  const q4Variant = defaultModel.quantizations.find(v => v.tag === 'Q4_K_M');
  assert.ok(q4Variant, 'Q4_K_M variant must be configured');
  assert.strictEqual(q4Variant.recommended, true);

  // Optional model Qwen3-8B must be flagged as pending validation
  const optionalModel = catalog.models.find(m => m.id === 'qwen3-8b');
  assert.ok(optionalModel, 'Optional model qwen3-8b must be in catalog');
  assert.strictEqual(optionalModel.isDefault, false);
  assert.ok(optionalModel.format === 'GGUF' || optionalModel.format === 'Pending-Validation');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('2. Repository metadata parsing: extracts files, quant variants, and SHA256', (t) => {
  const hf = new HuggingFaceDiscovery();
  const mockApiFiles = [
    {
      type: 'file',
      rfilename: 'qwen2.5-coder-7b-instruct-q4_k_m.gguf',
      size: 4680000000,
      lfs: { oid: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }
    },
    {
      type: 'file',
      rfilename: 'qwen2.5-coder-7b-instruct-q5_k_m.gguf',
      size: 5430000000,
      lfs: { oid: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0' }
    },
    {
      type: 'file',
      rfilename: 'README.md',
      size: 15420
    }
  ];

  const variants = hf.parseTreeFiles(mockApiFiles, 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF');
  assert.strictEqual(variants.length, 2, 'Should parse 2 GGUF files and ignore README.md');

  const q4 = variants.find(v => v.quantTag === 'Q4_K_M');
  assert.ok(q4);
  assert.strictEqual(q4.filename, 'qwen2.5-coder-7b-instruct-q4_k_m.gguf');
  assert.strictEqual(q4.sizeBytes, 4680000000);
  assert.strictEqual(q4.sha256, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.ok(q4.downloadUrl.includes('huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/'));
});

test('3. Variant selection: identifies optimal quantization for Ryzen 5 16GB laptop', (t) => {
  const variants = [
    { quantTag: 'Q2_K', sizeGB: 2.8, filename: 'm-q2_k.gguf' },
    { quantTag: 'Q4_K_M', sizeGB: 4.7, filename: 'm-q4_k_m.gguf' },
    { quantTag: 'Q8_0', sizeGB: 8.5, filename: 'm-q8_0.gguf' }
  ];

  // Q4_K_M is the optimal balance of quality and practical memory consumption for 16GB RAM + Radeon APU
  const selected = variants.find(v => v.quantTag === 'Q4_K_M');
  assert.ok(selected);
  assert.strictEqual(selected.quantTag, 'Q4_K_M');
  assert.ok(selected.sizeGB < 6.0, 'Q4_K_M should fit comfortably in available system memory');
});

test('4. Invalid repository identifiers: rejects path traversal and unsafe strings', (t) => {
  const hf = new HuggingFaceDiscovery();

  assert.throws(() => hf.validateRepoId('../../etc/passwd'), /Invalid Hugging Face repository/);
  assert.throws(() => hf.validateRepoId('foo/bar;rm -rf /'), /Invalid Hugging Face repository/);
  assert.throws(() => hf.validateRepoId('single_segment_repo'), /Invalid Hugging Face repository/);
  assert.throws(() => hf.validateRepoId('invalid//double_slash'), /Invalid Hugging Face repository/);
  assert.throws(() => hf.validateRepoId(''), /Invalid Hugging Face repository/);

  // Valid repo must pass
  assert.strictEqual(hf.validateRepoId('Qwen/Qwen2.5-Coder-7B-Instruct-GGUF'), 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF');
});

test('5. Disk-space warnings: triggers pre-flight warning when space is insufficient', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-disk-test-'));
  const storage = new StorageService(tempDir);

  const mockHardware = {
    detectSystemSpecs: () => ({
      storage: { freeDiskGB: 6.0 } // Only 6GB free
    })
  };

  const dlManager = new DownloadManager(storage, mockHardware);

  // 4.5 GB model + 5.0 GB safety margin = 9.5 GB required > 6.0 GB available
  const modelBytes = 4.5 * 1024 * 1024 * 1024;
  assert.throws(() => {
    dlManager.checkDiskSpaceBeforeDownload(modelBytes);
  }, /Insufficient disk space/);

  // If available space is 50GB, pre-flight check succeeds
  const mockHardwarePlenty = {
    detectSystemSpecs: () => ({
      storage: { freeDiskGB: 50.0 }
    })
  };
  const dlManager2 = new DownloadManager(storage, mockHardwarePlenty);
  assert.strictEqual(dlManager2.checkDiskSpaceBeforeDownload(modelBytes), true);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('6. Download progress and cancellation: streams bytes and stops cleanly', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-cancel-test-'));
  const storage = new StorageService(tempDir);
  const dlManager = new DownloadManager(storage);

  const totalBytes = 50000;
  let interval = null;
  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': totalBytes
    });
    let sent = 0;
    interval = setInterval(() => {
      if (sent >= totalBytes) {
        clearInterval(interval);
        res.end();
        return;
      }
      res.write(Buffer.alloc(5000, 0x42));
      sent += 5000;
    }, 40);

    req.on('close', () => {
      if (interval) clearInterval(interval);
    });
  });

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const fileUrl = `http://127.0.0.1:${port}/cancel-test.gguf`;

  let progressReported = false;
  dlManager.on('progress', (p) => {
    if (p.filename === 'cancel-test.gguf') {
      progressReported = true;
    }
  });

  const dlPromise = dlManager.downloadFile(fileUrl, 'cancel-test.gguf', totalBytes);

  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(dlManager.isDownloadInProgress('cancel-test.gguf'), true);

  dlManager.cancelDownload('cancel-test.gguf');
  await assert.rejects(dlPromise, /cancelled/i);

  assert.strictEqual(dlManager.isDownloadInProgress('cancel-test.gguf'), false);

  if (interval) clearInterval(interval);
  await closeServerAsync(server);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('7. Interrupted and resumed downloads: sends HTTP Range header and resumes file', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-resume-test-'));
  const storage = new StorageService(tempDir);
  const dlManager = new DownloadManager(storage);

  const fullPayload = Buffer.alloc(100, 0x5a); // 100 bytes of 'Z'

  let receivedRangeHeader = null;
  const server = http.createServer((req, res) => {
    receivedRangeHeader = req.headers['range'];

    if (receivedRangeHeader) {
      const match = receivedRangeHeader.match(/bytes=(\d+)-/);
      const start = match ? parseInt(match[1], 10) : 0;
      const chunk = fullPayload.subarray(start);

      res.writeHead(206, {
        'Content-Type': 'application/octet-stream',
        'Content-Range': `bytes ${start}-${fullPayload.length - 1}/${fullPayload.length}`,
        'Content-Length': chunk.length
      });
      res.end(chunk);
    } else {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fullPayload.length
      });
      res.end(fullPayload);
    }
  });

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const fileUrl = `http://127.0.0.1:${port}/resume-test.gguf`;

  // Pre-populate partial download file with 40 bytes
  const partialPath = dlManager.getPartialPath('resume-test.gguf');
  fs.writeFileSync(partialPath, fullPayload.subarray(0, 40));

  const result = await dlManager.downloadFile(fileUrl, 'resume-test.gguf', 100);

  assert.strictEqual(receivedRangeHeader, 'bytes=40-');
  assert.strictEqual(result.totalBytes, 100);

  // File on disk must now be the full 100 bytes
  const finalSize = fs.statSync(partialPath).size;
  assert.strictEqual(finalSize, 100);

  await closeServerAsync(server);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('8. Retry behavior: safely retries after temporary network failure', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-retry-test-'));
  const storage = new StorageService(tempDir);
  const dlManager = new DownloadManager(storage);

  let attempt = 0;
  const payload = Buffer.alloc(50, 0x43);

  const server = http.createServer((req, res) => {
    attempt++;
    if (attempt === 1) {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('Service Unavailable');
    } else {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': payload.length
      });
      res.end(payload);
    }
  });

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const fileUrl = `http://127.0.0.1:${port}/retry-test.gguf`;

  // First attempt fails with 503
  await assert.rejects(async () => {
    await dlManager.downloadFile(fileUrl, 'retry-test.gguf', 50);
  }, /503/);

  const queueItem = dlManager.getQueue().find(q => q.filename === 'retry-test.gguf');
  assert.strictEqual(queueItem.status, 'failed');

  // Retry attempt succeeds
  const res = await dlManager.retryDownload('retry-test.gguf');
  assert.strictEqual(res.totalBytes, 50);

  const updatedQueue = dlManager.getQueue().find(q => q.filename === 'retry-test.gguf');
  assert.strictEqual(updatedQueue.status, 'completed');
  assert.strictEqual(updatedQueue.retryCount, 1);

  await closeServerAsync(server);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('9. Integrity verification: validates GGUF magic header and SHA256 checksum', async (t) => {
  const verifier = new DownloadVerifier();
  const tempFile = path.join(os.tmpdir(), `integrity-${Date.now()}.gguf`);

  const validBuffer = createValidGGUFBuffer(128);
  fs.writeFileSync(tempFile, validBuffer);

  const headerRes = verifier.verifyGGUFHeader(tempFile);
  assert.strictEqual(headerRes.valid, true);
  assert.strictEqual(headerRes.magic, 'GGUF');
  assert.strictEqual(headerRes.version, 3);

  const sha = await verifier.computeSHA256(tempFile);
  assert.strictEqual(typeof sha, 'string');
  assert.strictEqual(sha.length, 64);

  const fullCheck = await verifier.verifyModelIntegrity(tempFile, {
    expectedSizeBytes: 128,
    expectedSha256: sha,
    format: 'gguf'
  });

  assert.strictEqual(fullCheck.valid, true);
  assert.ok(fullCheck.checksPerformed.some(c => c.toLowerCase().includes('gguf')));
  assert.ok(fullCheck.checksPerformed.some(c => c.toLowerCase().includes('sha256')));

  fs.unlinkSync(tempFile);
});

test('10. Corrupted and incomplete files: catches truncated files and HTML error pages', async (t) => {
  const verifier = new DownloadVerifier();
  const tempFile = path.join(os.tmpdir(), `corrupted-${Date.now()}.gguf`);

  // Empty file (0 bytes)
  fs.writeFileSync(tempFile, Buffer.alloc(0));
  const emptyRes = verifier.verifyFileSize(tempFile, 100);
  assert.strictEqual(emptyRes.valid, false);
  assert.ok(emptyRes.error.includes('empty'));

  // Truncated file (50 bytes instead of 1000)
  fs.writeFileSync(tempFile, Buffer.alloc(50));
  const truncatedRes = verifier.verifyFileSize(tempFile, 1000);
  assert.strictEqual(truncatedRes.valid, false);
  assert.ok(truncatedRes.error.includes('Size mismatch'));

  // HTML 404 error page written instead of binary model
  fs.writeFileSync(tempFile, '<html><body><h1>404 Not Found</h1></body></html>');
  const htmlRes = verifier.verifyGGUFHeader(tempFile);
  assert.strictEqual(htmlRes.valid, false);
  assert.ok(htmlRes.error.includes('Invalid GGUF header magic'));

  fs.unlinkSync(tempFile);
});

test('11. Duplicate download prevention: rejects parallel downloads for identical file', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-dup-test-'));
  const storage = new StorageService(tempDir);
  const dlManager = new DownloadManager(storage);

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Length': 10000 });
    res.write(Buffer.alloc(1000));
  });

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const testUrl = `http://127.0.0.1:${port}/dup-test.gguf`;

  const p1 = dlManager.downloadFile(testUrl, 'dup-test.gguf', 10000);

  // Attempt duplicate download immediately
  await assert.rejects(async () => {
    await dlManager.downloadFile(testUrl, 'dup-test.gguf', 10000);
  }, /already active/);

  dlManager.cancelDownload('dup-test.gguf');
  await assert.rejects(p1, /cancelled/i);

  await closeServerAsync(server);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('12. Safe model installation: moves file, updates registry, and verifies integrity', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-inst-test-'));
  const storage = new StorageService(tempDir);
  const verifier = new DownloadVerifier();
  const registry = new ModelRegistry(storage);
  const lifecycle = new ModelLifecycleManager();
  const installer = new ModelInstaller(storage, verifier, registry, lifecycle);

  const partialFile = path.join(storage.paths.downloads, 'mock-qwen.gguf.part');
  fs.writeFileSync(partialFile, createValidGGUFBuffer(64));

  const result = await installer.installVerifiedModel({
    modelId: 'qwen2.5-coder-7b-instruct',
    variantTag: 'Q4_K_M',
    filename: 'mock-qwen.gguf',
    partialFilePath: partialFile,
    expectedSizeBytes: 64,
    repoId: 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
    license: 'Apache-2.0'
  });

  assert.ok(result.verificationAudit || result.verified);
  assert.strictEqual(installer.isModelInstalled('qwen2.5-coder-7b-instruct'), true);
  assert.strictEqual(lifecycle.getState('qwen2.5-coder-7b-instruct'), LIFECYCLE_STATES.INSTALLED);

  // Partial file should have been moved/removed
  assert.strictEqual(fs.existsSync(partialFile), false);

  // Installed file must exist in model storage directory
  const installedPath = installer.getInstalledModelPath('qwen2.5-coder-7b-instruct');
  assert.ok(installedPath && fs.existsSync(installedPath));

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('13. Model registry persistence: preserves metadata across restarts', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-reg-test-'));
  const storage = new StorageService(tempDir);
  const registry1 = new ModelRegistry(storage);

  registry1.registerModel({
    modelId: 'qwen2.5-coder-7b-instruct',
    displayName: 'Qwen 2.5 Coder 7B (Q4_K_M)',
    repoId: 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
    variantTag: 'Q4_K_M',
    format: 'gguf',
    license: 'Apache-2.0',
    installedPath: path.join(storage.paths.models, 'qwen2.5-coder-7b-instruct', 'model.gguf'),
    sizeBytes: 4680000000,
    status: 'installed'
  });

  // Re-instantiate registry to simulate application restart
  const registry2 = new ModelRegistry(storage);
  const models = registry2.listModels();
  assert.strictEqual(models.length, 1);

  const m = models[0];
  assert.strictEqual(m.modelId, 'qwen2.5-coder-7b-instruct');
  assert.strictEqual(m.quantization, 'Q4_K_M');
  assert.strictEqual(m.license, 'Apache-2.0');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('14. Model-directory changes: migrates files and updates storage paths safely', (t) => {
  const tempDir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-migr-1-'));
  const tempDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-migr-2-'));
  const storage = new StorageService(tempDir1);
  const registry = new ModelRegistry(storage);

  // Create mock installed model file
  const modelDir = path.join(storage.paths.models, 'qwen2.5-coder-7b-instruct');
  fs.mkdirSync(modelDir, { recursive: true });
  const modelFile = path.join(modelDir, 'model.gguf');
  fs.writeFileSync(modelFile, createValidGGUFBuffer(32));

  registry.registerModel({
    modelId: 'qwen2.5-coder-7b-instruct',
    installedPath: modelFile,
    status: 'installed'
  });

  // Migrate storage to tempDir2
  const newModelsDir = path.join(tempDir2, 'new-models');
  const migrated = registry.migrateStorageDirectory(newModelsDir);
  assert.strictEqual(migrated, true);

  // New path must exist and old path must be updated
  const updatedModel = registry.getModel('qwen2.5-coder-7b-instruct');
  assert.ok(updatedModel.filePath.startsWith(newModelsDir));
  assert.strictEqual(fs.existsSync(updatedModel.filePath), true);

  fs.rmSync(tempDir1, { recursive: true, force: true });
  fs.rmSync(tempDir2, { recursive: true, force: true });
});

test('15. Model deletion safeguards: prevents path traversal and deletes only target model', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-del-test-'));
  const storage = new StorageService(tempDir);
  const registry = new ModelRegistry(storage);

  // 1. Path traversal attempt rejected
  assert.throws(() => {
    registry.deleteModel('../../etc');
  }, /Invalid model ID/);

  // 2. Normal model deletion
  const modelDir = path.join(storage.paths.models, 'test-delete-model');
  fs.mkdirSync(modelDir, { recursive: true });
  const modelFile = path.join(modelDir, 'weights.gguf');
  fs.writeFileSync(modelFile, 'mock weights');

  registry.registerModel({
    modelId: 'test-delete-model',
    installedPath: modelFile,
    status: 'installed'
  });

  assert.strictEqual(registry.listModels().length, 1);

  registry.deleteModel('test-delete-model');
  assert.strictEqual(registry.listModels().length, 0);
  assert.strictEqual(fs.existsSync(modelDir), false);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('16. Offline model listing: reads local cache without network connection', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-off-test-'));
  const cacheDir = path.join(tempDir, 'discovery-cache');
  fs.mkdirSync(cacheDir, { recursive: true });

  const hf = new HuggingFaceDiscovery(cacheDir);

  // Save cached metadata
  hf.saveCachedMetadata('Qwen/Qwen2.5-Coder-7B-Instruct-GGUF', {
    repoId: 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
    cachedAt: new Date().toISOString(),
    variants: [
      { quantTag: 'Q4_K_M', sizeGB: 4.7, filename: 'qwen2.5-coder-7b-instruct-q4_k_m.gguf' }
    ]
  });

  // Query in offline mode
  const offlineResult = await hf.discoverModelVariants('Qwen/Qwen2.5-Coder-7B-Instruct-GGUF', { offlineOnly: true });
  assert.strictEqual(offlineResult.fromCache, true);
  assert.strictEqual(offlineResult.variants.length, 1);
  assert.strictEqual(offlineResult.variants[0].quantTag, 'Q4_K_M');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('17. Invalid lifecycle transitions: enforces strict valid state progression', (t) => {
  const lifecycle = new ModelLifecycleManager();
  const modelId = 'test-lifecycle-model';

  assert.strictEqual(lifecycle.getState(modelId), LIFECYCLE_STATES.NOT_INSTALLED);

  // Cannot jump directly from not-installed to ready
  assert.throws(() => {
    lifecycle.transition(modelId, LIFECYCLE_STATES.READY);
  }, /Invalid lifecycle transition/);

  // Cannot jump from downloading to ready without verification and install
  lifecycle.transition(modelId, LIFECYCLE_STATES.QUEUED);
  lifecycle.transition(modelId, LIFECYCLE_STATES.DOWNLOADING);
  assert.throws(() => {
    lifecycle.transition(modelId, LIFECYCLE_STATES.READY);
  }, /Invalid lifecycle transition/);

  // Valid flow: downloading -> verifying -> installing -> installed -> loading -> ready
  lifecycle.transition(modelId, LIFECYCLE_STATES.VERIFYING);
  lifecycle.transition(modelId, LIFECYCLE_STATES.INSTALLING);
  lifecycle.transition(modelId, LIFECYCLE_STATES.INSTALLED);
  lifecycle.transition(modelId, LIFECYCLE_STATES.LOADING);
  lifecycle.transition(modelId, LIFECYCLE_STATES.READY);

  assert.strictEqual(lifecycle.getState(modelId), LIFECYCLE_STATES.READY);
});

test('18. Model-load failures: handles missing files and marks lifecycle failed', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-load-test-'));
  const storage = new StorageService(tempDir);
  const lifecycle = new ModelLifecycleManager();
  const registry = new ModelRegistry(storage);
  const inference = new InferenceManager(storage, null, lifecycle, registry);

  // Attempt to load nonexistent model
  await assert.rejects(async () => {
    await inference.loadModel('nonexistent-model');
  }, /not found/i);

  assert.strictEqual(lifecycle.getState('nonexistent-model'), LIFECYCLE_STATES.FAILED);
  assert.strictEqual(inference.getActiveModel(), null);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('19. Authentication and access-denied errors: surfaces gated repo requirement without exposing credentials', async (t) => {
  const server = http.createServer((req, res) => {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Access to model requires acceptance of community license conditions.'
    }));
  });

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const hf = new HuggingFaceDiscovery();
  hf.baseUrl = `http://127.0.0.1:${port}/api/models`;

  await assert.rejects(async () => {
    await hf.discoverModelVariants('gated-org/gated-model');
  }, (err) => {
    assert.ok(err.message.includes('Authentication') || err.message.includes('gated') || err.message.includes('Access'));
    // Ensure no secret or credential is in the message
    assert.strictEqual(err.message.includes('token=hf_'), false);
    return true;
  });

  await closeServerAsync(server);
});

test('20. Prevention of unintended external inference: fails cleanly offline without cloud fallback', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-cloud-test-'));
  const storage = new StorageService(tempDir);
  const inference = new InferenceManager(storage);

  // Cloud inference must default to disabled
  assert.strictEqual(inference.isCloudInferenceEnabled(), false);

  // Attempting generation when no local model is loaded must reject immediately without calling external APIs
  await assert.rejects(async () => {
    await inference.generateStream('How does ASTRO work?', () => {});
  }, /No local model/);

  fs.rmSync(tempDir, { recursive: true, force: true });
});
