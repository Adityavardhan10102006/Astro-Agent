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

test('DownloadManager reports progress and supports safe cancellation', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-dl-test-'));
  const storage = new StorageService(tempDir);
  const dlManager = new DownloadManager(storage);

  // Set up local test HTTP server streaming 100KB slowly
  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': 100000
    });
    let sent = 0;
    const interval = setInterval(() => {
      if (sent >= 100000) {
        clearInterval(interval);
        res.end();
        return;
      }
      res.write(Buffer.alloc(10000, 0x41));
      sent += 10000;
    }, 50);

    req.on('close', () => {
      clearInterval(interval);
    });
  });

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const testUrl = `http://127.0.0.1:${port}/test-model.gguf`;

  let progressEvents = 0;
  dlManager.on('progress', (p) => {
    progressEvents++;
    assert.strictEqual(p.filename, 'test-model.gguf');
  });

  const dlPromise = dlManager.downloadFile(testUrl, 'test-model.gguf', 100000);

  // Allow download to start and emit progress
  await new Promise(r => setTimeout(r, 120));

  assert.strictEqual(dlManager.isDownloadInProgress('test-model.gguf'), true);

  // Cancel download safely
  const cancelled = dlManager.cancelDownload('test-model.gguf');
  assert.strictEqual(cancelled, true);

  await assert.rejects(dlPromise, /cancelled/i);

  // Partial file must exist in partial-downloads directory, NOT in installed models
  const partialFile = path.join(storage.paths.downloads, 'test-model.gguf.part');
  assert.strictEqual(fs.existsSync(partialFile), true);

  const modelDir = path.join(storage.paths.models, 'test-model');
  assert.strictEqual(fs.existsSync(modelDir), false);

  server.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('ModelInstaller rejects unverified partial files and installs valid models', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-install-test-'));
  const storage = new StorageService(tempDir);
  const verifier = new DownloadVerifier();
  const installer = new ModelInstaller(storage, verifier);

  const corruptedPart = path.join(tempDir, 'corrupted.gguf.part');
  fs.writeFileSync(corruptedPart, 'Corrupted content');

  // Attempt to install corrupted file must throw
  await assert.rejects(async () => {
    await installer.installVerifiedModel({
      modelId: 'test-model',
      variantTag: 'Q4_K_M',
      filename: 'test.gguf',
      partialFilePath: corruptedPart
    });
  }, /Installation rejected/);

  // Now create valid mock GGUF file
  const validPart = path.join(tempDir, 'valid.gguf.part');
  const validBuffer = Buffer.alloc(32);
  validBuffer.write('GGUF', 0, 4, 'utf8');
  validBuffer.writeUInt32LE(3, 4);
  fs.writeFileSync(validPart, validBuffer);

  const meta = await installer.installVerifiedModel({
    modelId: 'test-model',
    variantTag: 'Q4_K_M',
    filename: 'test.gguf',
    partialFilePath: validPart,
    expectedSizeBytes: 32
  });

  assert.strictEqual(meta.modelId, 'test-model');
  assert.strictEqual(meta.verified, true);
  assert.strictEqual(installer.isModelInstalled('test-model'), true);

  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
});
