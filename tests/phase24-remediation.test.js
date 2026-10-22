const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { InferenceManager } = require('../src/services/inference/inference-manager');
const { APPROVED_MODELS } = require('../src/config/model-catalog');

function createTempWorkspace() {
  const dir = path.join(os.tmpdir(), `astro_p24_test_${Date.now()}_${Math.random().toString(36).substring(7)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test('Phase 24: 1. Memory Preflight Logic computes conservative requirements', () => {
  const tempDir = createTempWorkspace();
  const dummyGgufPath = path.join(tempDir, 'dummy-test-model.gguf');
  fs.writeFileSync(dummyGgufPath, Buffer.alloc(2 * 1024 * 1024)); // 2MB

  const mockStorage = {
    getActiveModel: () => null,
    setActiveModel: () => {},
    getSettings: () => ({})
  };
  const mockHardware = {
    detectSystemSpecs: () => ({ memory: { totalGB: 16.0, freeGB: 10.0 } })
  };
  const inference = new InferenceManager(mockStorage, mockHardware);

  const preflight = inference.preflightModelCheck({
    modelId: 'test-model',
    filePath: dummyGgufPath,
    contextWindow: 4096,
    simulatedMemory: { memory: { totalGB: 16.0, freeGB: 10.0 } }
  });

  assert.strictEqual(preflight.safe, true);
  assert.strictEqual(preflight.severity, 'safe');
  assert.strictEqual(preflight.contextRamGB, 0.5);
  assert.strictEqual(preflight.runtimeOverheadGB, 0.4);
  assert.ok(preflight.estimatedTotalRamGB > 0.8 && preflight.estimatedTotalRamGB < 1.0);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Phase 24: 2. Context window scaling increases estimated RAM requirement', () => {
  const tempDir = createTempWorkspace();
  const dummyGgufPath = path.join(tempDir, 'dummy-test-model.gguf');
  fs.writeFileSync(dummyGgufPath, Buffer.alloc(2 * 1024 * 1024));

  const inference = new InferenceManager({}, {});

  const preflight4k = inference.preflightModelCheck({
    modelId: 'test-model',
    filePath: dummyGgufPath,
    contextWindow: 4096,
    simulatedMemory: { memory: { totalGB: 16.0, freeGB: 10.0 } }
  });

  const preflight8k = inference.preflightModelCheck({
    modelId: 'test-model',
    filePath: dummyGgufPath,
    contextWindow: 8192,
    simulatedMemory: { memory: { totalGB: 16.0, freeGB: 10.0 } }
  });

  assert.strictEqual(preflight8k.contextRamGB, 1.0);
  assert.ok(preflight8k.estimatedTotalRamGB > preflight4k.estimatedTotalRamGB);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Phase 24: 3. Detects warning_paging when model RAM exceeds free RAM', () => {
  const tempDir = createTempWorkspace();
  const dummyGgufPath = path.join(tempDir, 'dummy-test-model.gguf');
  fs.writeFileSync(dummyGgufPath, Buffer.alloc(2 * 1024 * 1024));

  const inference = new InferenceManager({}, {});

  const preflight = inference.preflightModelCheck({
    modelId: 'test-model',
    filePath: dummyGgufPath,
    contextWindow: 4096,
    simulatedMemory: { memory: { totalGB: 16.0, freeGB: 0.5 } } // Only 0.5 GB free
  });

  assert.strictEqual(preflight.safe, false);
  assert.strictEqual(preflight.severity, 'warning_paging');
  assert.ok(preflight.message.includes('Memory Paging Warning'));
  assert.ok(preflight.recommendedAction.length > 0);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Phase 24: 4. Detects critical_insufficient when model RAM exceeds system capacity', () => {
  const tempDir = createTempWorkspace();
  const dummyGgufPath = path.join(tempDir, 'dummy-test-model.gguf');
  fs.writeFileSync(dummyGgufPath, Buffer.alloc(2 * 1024 * 1024));

  const inference = new InferenceManager({}, {});

  const preflight = inference.preflightModelCheck({
    modelId: 'test-model',
    filePath: dummyGgufPath,
    contextWindow: 4096,
    simulatedMemory: { memory: { totalGB: 1.0, freeGB: 0.2 } } // 1 GB total system
  });

  assert.strictEqual(preflight.safe, false);
  assert.strictEqual(preflight.severity, 'critical_insufficient');
  assert.ok(preflight.message.includes('Insufficient physical RAM'));
  assert.ok(preflight.safeAlternatives.length > 0);
  assert.strictEqual(preflight.canOverride, true);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Phase 24: 5. loadModel blocks loading under critical_insufficient without override', async () => {
  const tempDir = createTempWorkspace();
  const dummyGgufPath = path.join(tempDir, 'dummy-test-model.gguf');
  fs.writeFileSync(dummyGgufPath, Buffer.alloc(2 * 1024 * 1024));

  const inference = new InferenceManager({}, {});

  let threw = false;
  try {
    await inference.loadModel('test-model', dummyGgufPath, {
      contextWindow: 4096,
      simulatedMemory: { memory: { totalGB: 1.0, freeGB: 0.2 } },
      overrideMemorySafety: false
    });
  } catch (err) {
    threw = true;
    assert.ok(err.message.includes('[Memory Preflight Block]'));
  }
  assert.strictEqual(threw, true, 'Should have blocked loading due to insufficient memory');

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Phase 24: 6. loadModel permits explicit overrideMemorySafety', async () => {
  const tempDir = createTempWorkspace();
  const dummyGgufPath = path.join(tempDir, 'dummy-test-model.gguf');
  fs.writeFileSync(dummyGgufPath, Buffer.alloc(2 * 1024 * 1024));

  const inference = new InferenceManager({ setActiveModel: () => {} }, {});

  try {
    await inference.loadModel('test-model', dummyGgufPath, {
      contextWindow: 4096,
      simulatedMemory: { memory: { totalGB: 1.0, freeGB: 0.2 } },
      overrideMemorySafety: true,
      allowMockFallback: true
    });
  } catch (err) {
    assert.ok(!err.message.includes('[Memory Preflight Block]'), 'Must not fail with preflight block when overridden');
  }

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Phase 24: 7. Electron security configuration in main.js', () => {
  const mainPath = path.join(__dirname, '../src/main.js');
  const mainContent = fs.readFileSync(mainPath, 'utf8');

  assert.ok(mainContent.includes('sandbox: true'), 'Sandbox must be enabled');
  assert.ok(mainContent.includes('contextIsolation: true'), 'Context isolation must be enabled');
  assert.ok(mainContent.includes('nodeIntegration: false'), 'Node integration must be disabled');
  assert.ok(mainContent.includes("webContents.on('will-navigate'"), 'will-navigate handler must be registered');
  assert.ok(mainContent.includes('setWindowOpenHandler'), 'setWindowOpenHandler must be registered');
  assert.ok(mainContent.includes("webContents.on('will-attach-webview'"), 'will-attach-webview handler must be registered');
  assert.ok(mainContent.includes('setPermissionRequestHandler'), 'setPermissionRequestHandler must be registered');
});

test('Phase 24: 8. CSP in index.html and Preload bridge exposure', () => {
  const indexPath = path.join(__dirname, '../src/ui/index.html');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  assert.ok(indexContent.includes('http-equiv="Content-Security-Policy"'), 'CSP meta tag required');
  assert.ok(indexContent.includes("default-src 'self'"), 'CSP default-src self required');

  const preloadPath = path.join(__dirname, '../src/preload.js');
  const preloadContent = fs.readFileSync(preloadPath, 'utf8');
  assert.ok(preloadContent.includes('checkModelPreflight:'), 'checkModelPreflight exposed');
  assert.ok(preloadContent.includes("'models:preflight'"), 'models:preflight IPC invoked');
});

test('Phase 24: 9. Model Catalog hardware requirements', () => {
  const qwen3 = APPROVED_MODELS.find(m => m.id === 'qwen3-8b');
  assert.ok(qwen3, 'Qwen3-8B catalog entry must exist');
  assert.ok(qwen3.hardwareRequirement.minRamGB >= 12, 'Qwen3-8B must specify minRamGB >= 12');

  const defaultModel = APPROVED_MODELS.find(m => m.isDefault);
  assert.ok(defaultModel, 'Default model must exist');
  assert.strictEqual(defaultModel.id, 'qwen2.5-coder-7b-instruct');
  assert.strictEqual(defaultModel.hardwareRequirement.minRamGB, 8);
  assert.ok(defaultModel.hardwareRequirement.cpuTarget.includes('Ryzen 5'));
});
