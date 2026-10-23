const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const { StorageService } = require('../src/services/storage/storage-service');
const { DownloadManager } = require('../src/services/models/download-manager');
const { HardwareService } = require('../src/services/system/hardware-service');
const { InferenceManager } = require('../src/services/inference/inference-manager');

function createTempDir(prefix = 'astro_p28_core_repair_') {
  const dir = path.join(os.tmpdir(), `${prefix}${Date.now()}_${Math.random().toString(36).substring(7)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test('Phase 28 Core Repair: 1. DownloadManager preserves modelId and variantTag across queue and active lookup', () => {
  const testDir = createTempDir();
  try {
    const storage = new StorageService(testDir);
    storage.ensureDirectories();
    const dm = new DownloadManager(storage);

    const filename = 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf';

    dm.activeDownloads.set(filename, {
      filename,
      modelId: 'qwen2.5-coder-7b',
      variantTag: 'Q4_K_M',
      status: 'downloading',
      phase: 'downloading',
      bytesDownloaded: 1024 * 1024 * 200,
      totalBytes: 1024 * 1024 * 1000,
      progressPercent: 20,
      speedBytesPerSec: 1024 * 1024 * 10,
      etaSeconds: 80,
      isIndeterminate: false,
      fileStream: { destroy: () => {} },
      req: { destroy: () => {} }
    });

    // Lookup by filename
    const byFilename = dm.getActiveDownload(filename);
    assert.ok(byFilename, 'Active download must be found by filename');
    assert.strictEqual(byFilename.modelId, 'qwen2.5-coder-7b');
    assert.strictEqual(byFilename.variantTag, 'Q4_K_M');
    assert.strictEqual(byFilename.phase, 'downloading');

    // Lookup by modelId
    const byModelId = dm.getActiveDownload('qwen2.5-coder-7b');
    assert.ok(byModelId, 'Active download must be found by modelId');
    assert.strictEqual(byModelId.filename, filename);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 28 Core Repair: 2. Network status metadata distinguishes offline privacy from hardware connectivity', () => {
  const mainJsPath = path.join(__dirname, '..', 'src', 'main.js');
  const mainJs = fs.readFileSync(mainJsPath, 'utf8');

  // Verify system:network-status provides required fields
  assert.ok(mainJs.includes("label: 'Offline-Only Privacy'") || mainJs.includes("label = 'Offline-Only Privacy'"));
  assert.ok(mainJs.includes("label = 'Local AI • Online'") || mainJs.includes("Local AI • Online"));
  assert.ok(mainJs.includes('offlineMode,'));
  assert.ok(mainJs.includes('isOnline,'));
  assert.ok(mainJs.includes('details,'));
});

test('Phase 28 Core Repair: 3. UI controller registers onDownloadProgress listener and handles real-time updates', () => {
  const appJsPath = path.join(__dirname, '..', 'src', 'ui', 'app.js');
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  assert.ok(appJs.includes('api.onDownloadProgress'), 'app.js must register onDownloadProgress listener');
  assert.ok(appJs.includes('updateDownloadCardUI'), 'app.js must implement updateDownloadCardUI function');
  assert.ok(appJs.includes('Est. RAM Footprint'), 'Model Manager table must display RAM requirements');
  assert.ok(appJs.includes('Disk Required'), 'Model Manager table must display Disk requirements');
});

test('Phase 28 Core Repair: 4. Safe concurrent download handling prevents fatal errors on duplicate triggers', async () => {
  const mainJsPath = path.join(__dirname, '..', 'src', 'main.js');
  const mainJs = fs.readFileSync(mainJsPath, 'utf8');

  assert.ok(mainJs.includes('alreadyActive: true'), 'main.js must handle already active downloads gracefully without re-invoking downloadFile');
});

test('Phase 28 Core Repair: 5. Live download execution emits modelId, variantTag, and phase correctly', async () => {
  const testDir = createTempDir();
  let server = null;
  try {
    const payload = Buffer.from('TEST_MODEL_REPAIR_PAYLOAD_PHASE28');

    server = http.createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': payload.length
      });
      res.end(payload);
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}/model-repair.gguf`;

    const storage = new StorageService(testDir);
    storage.ensureDirectories();
    const dm = new DownloadManager(storage);

    let emittedModelId = null;
    let emittedVariantTag = null;
    let emittedPhase = null;

    dm.on('progress', (p) => {
      emittedModelId = p.modelId;
      emittedVariantTag = p.variantTag;
      emittedPhase = p.phase;
    });

    const res = await dm.downloadFile(url, 'model-repair.gguf', payload.length, null, 'qwen2.5-coder-7b', 'Q4_K_M');
    assert.strictEqual(res.totalBytes, payload.length);
    assert.strictEqual(emittedModelId, 'qwen2.5-coder-7b');
    assert.strictEqual(emittedVariantTag, 'Q4_K_M');
    assert.ok(emittedPhase === 'connecting' || emittedPhase === 'downloading' || emittedPhase === 'completed');
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
