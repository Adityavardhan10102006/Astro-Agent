const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const { StorageService } = require('../src/services/storage/storage-service');
const { DownloadManager } = require('../src/services/models/download-manager');
const { DownloadVerifier } = require('../src/services/models/download-verifier');
const { InferenceManager } = require('../src/services/inference/inference-manager');
const { CodingService } = require('../src/services/coding/coding-service');
const { FileService } = require('../src/services/files/file-service');
const { SecurityService } = require('../src/services/security/security-service');
const { HardwareService } = require('../src/services/system/hardware-service');

function createTempDir(prefix = 'astro_p28_test_') {
  const dir = path.join(os.tmpdir(), `${prefix}${Date.now()}_${Math.random().toString(36).substring(7)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test('Phase 28: 1. Authoritative download states and real-time enriched queue metrics', () => {
  const testDir = createTempDir();
  try {
    const storage = new StorageService(testDir);
    storage.ensureDirectories();
    const dm = new DownloadManager(storage);

    // Initial queue should be empty
    assert.deepStrictEqual(dm.getQueue(), []);

    const filename = 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf';

    // Add persistent item to queue
    dm.downloadQueue.push({
      filename,
      url: 'https://huggingface.co/mock/qwen.gguf',
      status: 'downloading',
      modelId: 'qwen2.5-coder-7b',
      variantTag: 'Q4_K_M'
    });
    dm.saveQueue();

    // Attach active stream download state
    dm.activeDownloads.set(filename, {
      filename,
      status: 'downloading',
      modelId: 'qwen2.5-coder-7b',
      variantTag: 'Q4_K_M',
      bytesDownloaded: 1024 * 1024 * 500, // 500 MB
      totalBytes: 1024 * 1024 * 1000,      // 1000 MB
      progressPercent: 50,
      speedBytesPerSec: 1024 * 1024 * 25,  // 25 MB/s
      etaSeconds: 20,
      isIndeterminate: false,
      startTime: Date.now() - 10000,
      fileStream: { destroy: () => {} },
      req: { destroy: () => {} }
    });

    // Verify enriched queue
    const queue = dm.getQueue();
    assert.strictEqual(queue.length, 1);
    assert.strictEqual(queue[0].filename, filename);
    assert.strictEqual(queue[0].status, 'downloading');
    assert.strictEqual(queue[0].progressPercent, 50);
    assert.strictEqual(queue[0].speedBytesPerSec, 1024 * 1024 * 25);
    assert.strictEqual(queue[0].etaSeconds, 20);
    assert.strictEqual(queue[0].isIndeterminate, false);

    // Verify active lookup
    const active = dm.getActiveDownload(filename);
    assert.ok(active, 'Active download must be retrievable by filename');
    assert.strictEqual(active.modelId, 'qwen2.5-coder-7b');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 28: 2. Indeterminate download progress handling when Content-Length is unavailable', async () => {
  const testDir = createTempDir();
  let server = null;
  try {
    const chunk1 = Buffer.from('STREAM_CHUNK_1_');
    const chunk2 = Buffer.from('STREAM_CHUNK_2_');

    // Spin up HTTP server without Content-Length (Chunked Transfer)
    server = http.createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream'
        // No Content-Length header!
      });
      res.write(chunk1);
      setTimeout(() => {
        res.end(chunk2);
      }, 50);
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/indeterminate.gguf`;

    const storage = new StorageService(testDir);
    storage.ensureDirectories();
    const dm = new DownloadManager(storage);

    let receivedIndeterminateProgress = false;
    dm.on('progress', (p) => {
      if (p.isIndeterminate) {
        receivedIndeterminateProgress = true;
        assert.strictEqual(p.totalBytes, 0, 'Total bytes must be 0 when unknown');
      }
    });

    const res = await dm.downloadFile(url, 'indeterminate.gguf', 0, 'custom-model', 'custom');
    assert.ok(fs.existsSync(res.partialPath));
    assert.strictEqual(receivedIndeterminateProgress, true, 'Indeterminate progress must be emitted');
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 28: 3. Prevention of duplicate download jobs and active download lookup', async () => {
  const testDir = createTempDir();
  try {
    const storage = new StorageService(testDir);
    storage.ensureDirectories();
    const dm = new DownloadManager(storage);

    const filename = 'test-concurrent-dl.gguf';
    dm.activeDownloads.set(filename, {
      filename,
      status: 'downloading',
      fileStream: { destroy: () => {} },
      req: { destroy: () => {} }
    });

    // Attempting to start the same download must reject with explicit error
    await assert.rejects(
      async () => {
        await dm.downloadFile('https://fake-url.example/test.gguf', filename, 1000);
      },
      /Download is already active/
    );
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 28: 4. Safe cancellation of active downloads without corrupting model state', async () => {
  const testDir = createTempDir();
  try {
    const storage = new StorageService(testDir);
    storage.ensureDirectories();
    const dm = new DownloadManager(storage);

    const filename = 'cancellable-model.gguf';
    let streamClosed = false;
    let reqDestroyed = false;

    dm.downloadQueue.push({
      filename,
      url: 'https://huggingface.co/mock/model.gguf',
      status: 'downloading'
    });
    dm.saveQueue();

    dm.activeDownloads.set(filename, {
      filename,
      status: 'downloading',
      fileStream: {
        destroy: () => { streamClosed = true; }
      },
      req: {
        destroy: () => { reqDestroyed = true; }
      }
    });

    // Cancel download
    const cancelled = await dm.cancelDownload(filename);
    assert.strictEqual(cancelled, true);
    assert.strictEqual(streamClosed, true, 'File stream must be destroyed cleanly');
    assert.strictEqual(reqDestroyed, true, 'Network request must be aborted');

    // Item must remain in queue marked as cancelled
    const queue = dm.getQueue();
    const item = queue.find(q => q.filename === filename);
    assert.ok(item);
    assert.strictEqual(item.status, 'cancelled');

    // Must not be in active map
    assert.strictEqual(dm.getActiveDownload(filename), null);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 28: 5. Preflight suitability checks calculate RAM, context overhead, and disk space margin', () => {
  const testDir = createTempDir();
  try {
    const storage = new StorageService(testDir);
    storage.ensureDirectories();
    const hw = new HardwareService();

    const inferenceMgr = new InferenceManager(storage, hw);

    // Check suitability before download
    const preflight = inferenceMgr.preflightModelCheck({
      modelId: 'qwen2.5-coder-7b',
      expectedSizeBytes: Math.round(4.68 * (1024 ** 3)),
      fileSizeGB: 4.68
    });

    assert.ok(preflight.severity, 'Severity must be categorized');
    assert.ok(preflight.estimatedTotalRamGB > 4.68, 'Estimated RAM must account for context and runtime overhead (> model file size)');
    assert.ok(preflight.requiredDiskGB >= 9.68, 'Required disk must include the 5 GB safety margin (4.68 + 5 = 9.68 GB)');
    assert.ok(typeof preflight.freeDiskGB === 'number', 'Free disk must be reported');
    assert.ok(preflight.recommendedAction, 'Actionable guidance must be provided');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 28: 6. File size verification tolerance for approximate model downloads', () => {
  const testDir = createTempDir();
  try {
    const verifier = new DownloadVerifier();
    const filePath = path.join(testDir, 'test-size.bin');
    // Write a 1000 byte file
    fs.writeFileSync(filePath, Buffer.alloc(1000, 0x01));

    // Exact verification without approximate flag: must match exactly
    const exactMatch = verifier.verifyFileSize(filePath, 1000, { isApproximate: false });
    assert.strictEqual(exactMatch.valid, true);

    const exactMismatch = verifier.verifyFileSize(filePath, 1050, { isApproximate: false });
    assert.strictEqual(exactMismatch.valid, false);

    // Approximate verification: 1000 bytes with expected 1050 (approx 5% diff, within 15% tolerance)
    const approxValid = verifier.verifyFileSize(filePath, 1050, { isApproximate: true, tolerancePercent: 15 });
    assert.strictEqual(approxValid.valid, true);

    // Approximate verification beyond 15% tolerance (e.g. expected 1500, diff is 500 = 33%)
    const approxInvalid = verifier.verifyFileSize(filePath, 1500, { isApproximate: true, tolerancePercent: 15 });
    assert.strictEqual(approxInvalid.valid, false);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 28: 7. Coding Studio file protection: backups, diff application, and exact rollback', async () => {
  const testDir = createTempDir();
  try {
    const storage = new StorageService(testDir);
    storage.ensureDirectories();
    const sec = new SecurityService(testDir);
    const files = new FileService(sec);
    const codingService = new CodingService(sec, files);

    const testFile = path.join(testDir, 'sample-script.js');
    const initialContent = 'function calculate() {\n  return 42;\n}\n';
    fs.writeFileSync(testFile, initialContent, 'utf8');

    // 1. Propose change / diff
    const modifiedContent = 'function calculate() {\n  // Optimized\n  return 42 * 2;\n}\n';
    const proposal = codingService.proposeFileChange(testFile, modifiedContent);
    assert.ok(proposal.diff.includes('// Optimized'));
    assert.ok(proposal.diff.includes('return 42 * 2;'));

    // 2. Apply diff with user confirmation
    const applyRes = codingService.applyApprovedChange(testFile, modifiedContent, true, { allowSensitive: true });
    assert.strictEqual(applyRes.success, true);
    assert.ok(applyRes.backupPath, 'Backup file path must be returned');
    assert.ok(fs.existsSync(applyRes.backupPath), 'Physical backup file must exist');

    // Verify file updated
    assert.strictEqual(fs.readFileSync(testFile, 'utf8'), modifiedContent);

    // 3. Revert diff
    const revertRes = codingService.revertFileChange(testFile, applyRes.backupPath);
    assert.strictEqual(revertRes.reverted, true);
    assert.strictEqual(fs.readFileSync(testFile, 'utf8'), initialContent, 'Original file content must be restored exactly');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 28: 8. Download manager real HTTP download lifecycle to completion with progress events', async () => {
  const testDir = createTempDir();
  let server = null;
  try {
    const payload = Buffer.from('GGUF_TEST_FILE_CONTENT_PHASE28_RELIABLE_DOWNLOAD');

    // Spin up local lightweight HTTP server
    server = http.createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': payload.length
      });
      res.end(payload);
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/model.gguf`;

    const storage = new StorageService(testDir);
    storage.ensureDirectories();
    const dm = new DownloadManager(storage);

    let progressFired = false;
    dm.on('progress', (p) => {
      progressFired = true;
      assert.strictEqual(p.filename, 'download-test.gguf');
    });

    const res = await dm.downloadFile(url, 'download-test.gguf', payload.length, 'test-model', 'Q4');
    assert.strictEqual(res.totalBytes, payload.length);
    assert.ok(fs.existsSync(res.partialPath));
    assert.strictEqual(progressFired, true);

    const savedContent = fs.readFileSync(res.partialPath);
    assert.strictEqual(savedContent.toString(), payload.toString());
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
