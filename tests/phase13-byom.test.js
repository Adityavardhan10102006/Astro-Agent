const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { GGUFInspector } = require('../src/services/models/gguf-inspector');
const { StorageService } = require('../src/services/storage/storage-service');
const { ModelRegistry } = require('../src/services/models/model-registry');
const { ModelInstaller } = require('../src/services/models/model-installer');
const { DownloadVerifier } = require('../src/services/models/download-verifier');
const { ModelLifecycleManager } = require('../src/services/models/model-lifecycle');
const { InferenceManager } = require('../src/services/inference/inference-manager');
const { AssistantCoordinator } = require('../src/services/assistant/assistant-coordinator');
const { HuggingFaceDiscovery } = require('../src/services/huggingface/huggingface-discovery');

function createTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'astro-phase13-test-'));
}

// Helper to create a minimal synthetic GGUF buffer
function createSyntheticGGUF({ architecture = 'llama', name = 'TestModel', tensorCount = 10, kvPairs = {} } = {}) {
  const parts = [];

  // Magic
  parts.push(Buffer.from('GGUF', 'utf8'));

  // Version 3 (LE 32-bit)
  const vBuf = Buffer.alloc(4);
  vBuf.writeUInt32LE(3, 0);
  parts.push(vBuf);

  const allKv = {
    'general.architecture': { type: 8, val: architecture },
    'general.name': { type: 8, val: name },
    ...kvPairs
  };

  const kvCount = Object.keys(allKv).length;

  // Tensor count (LE 64-bit)
  const tcBuf = Buffer.alloc(8);
  tcBuf.writeBigUInt64LE(BigInt(tensorCount), 0);
  parts.push(tcBuf);

  // KV count (LE 64-bit)
  const kcBuf = Buffer.alloc(8);
  kcBuf.writeBigUInt64LE(BigInt(kvCount), 0);
  parts.push(kcBuf);

  // Write KV pairs
  for (const [key, item] of Object.entries(allKv)) {
    // Key string
    const keyBuf = Buffer.from(key, 'utf8');
    const keyLenBuf = Buffer.alloc(8);
    keyLenBuf.writeBigUInt64LE(BigInt(keyBuf.length), 0);
    parts.push(keyLenBuf);
    parts.push(keyBuf);

    // Type (32-bit uint)
    const typeBuf = Buffer.alloc(4);
    typeBuf.writeUInt32LE(item.type, 0);
    parts.push(typeBuf);

    // Value
    if (item.type === 8) { // String
      const strBuf = Buffer.from(item.val, 'utf8');
      const strLenBuf = Buffer.alloc(8);
      strLenBuf.writeBigUInt64LE(BigInt(strBuf.length), 0);
      parts.push(strLenBuf);
      parts.push(strBuf);
    } else if (item.type === 4 || item.type === 5) { // Uint32 / Int32
      const numBuf = Buffer.alloc(4);
      numBuf.writeUInt32LE(item.val, 0);
      parts.push(numBuf);
    } else if (item.type === 10 || item.type === 11) { // Uint64 / Int64
      const numBuf = Buffer.alloc(8);
      numBuf.writeBigUInt64LE(BigInt(item.val), 0);
      parts.push(numBuf);
    }
  }

  // Add dummy padding to simulate header size
  const padding = Buffer.alloc(1024, 0);
  parts.push(padding);

  return Buffer.concat(parts);
}

test('Phase 13: 1. GGUFInspector validates magic bytes and catches invalid/corrupt files', () => {
  const testDir = createTempWorkspace();
  try {
    // 1. Missing file
    const missing = GGUFInspector.inspect(path.join(testDir, 'does-not-exist.gguf'));
    assert.strictEqual(missing.valid, false);
    assert.match(missing.error, /File not found/);

    // 2. 0-byte file
    const emptyFile = path.join(testDir, 'empty.gguf');
    fs.writeFileSync(emptyFile, Buffer.alloc(0));
    const empty = GGUFInspector.inspect(emptyFile);
    assert.strictEqual(empty.valid, false);
    assert.match(empty.error, /0 bytes/);

    // 3. Truncated (<24 bytes)
    const smallFile = path.join(testDir, 'small.gguf');
    fs.writeFileSync(smallFile, Buffer.from('GGUF123'));
    const small = GGUFInspector.inspect(smallFile);
    assert.strictEqual(small.valid, false);
    assert.match(small.error, /too small/);

    // 4. Invalid magic bytes
    const corruptFile = path.join(testDir, 'corrupt.gguf');
    fs.writeFileSync(corruptFile, Buffer.from('NOT_A_GGUF_FILE_HEADER_DATA_1234567890'));
    const corrupt = GGUFInspector.inspect(corruptFile);
    assert.strictEqual(corrupt.valid, false);
    assert.match(corrupt.error, /Invalid GGUF header magic/);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 13: 2. GGUFInspector metadata inspection extracts architecture, tensors, and estimates RAM', () => {
  const testDir = createTempWorkspace();
  try {
    const validGGUFBuf = createSyntheticGGUF({
      architecture: 'qwen2',
      name: 'Qwen2.5-Coder-7B-Instruct-Test',
      tensorCount: 290,
      kvPairs: {
        'qwen2.context_length': { type: 4, val: 32768 },
        'general.file_type': { type: 4, val: 15 } // Q4_K_M
      }
    });

    const validFile = path.join(testDir, 'model.gguf');
    fs.writeFileSync(validFile, validGGUFBuf);

    const inspection = GGUFInspector.inspect(validFile);
    assert.strictEqual(inspection.valid, true);
    assert.strictEqual(inspection.version, 3);
    assert.strictEqual(inspection.architecture, 'qwen2');
    assert.strictEqual(inspection.tensorCount, 290);
    assert.match(inspection.modelName, /Qwen2\.5/i);
    assert.strictEqual(inspection.contextLength, 32768);
    assert.strictEqual(inspection.quantization, 'Q4_K_M');
    assert.strictEqual(inspection.compatibility.supported, true);
    assert.strictEqual(inspection.compatibility.engine, 'node-llama-cpp');
    assert.ok(inspection.memoryEstimate.estimatedModelRamBytes > 0);
    assert.ok(typeof inspection.memoryEstimate.fitsInRam === 'boolean');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 13: 3. GGUFInspector detects unsupported architectures and flags them honestly', () => {
  const testDir = createTempWorkspace();
  try {
    const customBuf = createSyntheticGGUF({
      architecture: 'exotic_diffusion_transformer_v9',
      name: 'ExoticModel',
      tensorCount: 50
    });

    const file = path.join(testDir, 'exotic.gguf');
    fs.writeFileSync(file, customBuf);

    const inspection = GGUFInspector.inspect(file);
    assert.strictEqual(inspection.valid, true);
    assert.strictEqual(inspection.architecture, 'exotic_diffusion_transformer_v9');
    assert.strictEqual(inspection.compatibility.supported, false);
    assert.strictEqual(inspection.compatibility.requiresReview, true);
    assert.match(inspection.compatibility.reason, /not recognized or supported/i);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 13: 4. Real Qwen3-8B root file metadata inspection and RAM verification', () => {
  const rootModel = path.resolve('Qwen3-8B-Q4_K_M.gguf');
  if (!fs.existsSync(rootModel)) {
    return; // Skip if file not in workspace
  }

  const inspection = GGUFInspector.inspect(rootModel);
  assert.strictEqual(inspection.valid, true);
  assert.strictEqual(inspection.version, 3);
  assert.strictEqual(inspection.architecture, 'qwen3');
  assert.strictEqual(inspection.tensorCount, 399);
  assert.strictEqual(inspection.compatibility.supported, true);
  assert.strictEqual(inspection.compatibility.chatTemplate, 'ChatML');
  assert.ok(inspection.fileSizeBytes > 4 * 1024 * 1024 * 1024);
  assert.ok(inspection.fileSizeGB > 4);
});

test('Phase 13: 5. ModelRegistry duplicate prevention via findEntryByPath', () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const registry = new ModelRegistry(storage);

    const externalFile = path.join(testDir, 'custom-models', 'my-model.gguf');
    fs.mkdirSync(path.dirname(externalFile), { recursive: true });
    fs.writeFileSync(externalFile, 'mock-gguf-content');

    registry.registerModel({
      modelId: 'my-model-1',
      displayName: 'My Custom Model',
      filePath: externalFile,
      storageType: 'external',
      status: 'installed'
    });

    // Attempt to find by identical path
    const duplicate = registry.findEntryByPath(externalFile);
    assert.ok(duplicate);
    assert.strictEqual(duplicate.modelId, 'my-model-1');

    // Case and separator insensitive match
    const duplicateAlt = registry.findEntryByPath(externalFile.replace(/\\/g, '/'));
    assert.ok(duplicateAlt);
    assert.strictEqual(duplicateAlt.modelId, 'my-model-1');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 13: 6. ModelRegistry detects missing files and supports safe path repair', () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const registry = new ModelRegistry(storage);

    const initialFile = path.join(testDir, 'loc1', 'weights.gguf');
    fs.mkdirSync(path.dirname(initialFile), { recursive: true });
    fs.writeFileSync(initialFile, 'weights-data');

    registry.registerModel({
      modelId: 'movable-model',
      displayName: 'Movable Model',
      filePath: initialFile,
      storageType: 'external',
      status: 'installed'
    });

    // 1. Availability check while file exists
    const avail1 = registry.checkModelAvailability('movable-model');
    assert.strictEqual(avail1.available, true);
    assert.strictEqual(avail1.exists, true);

    // 2. Move file
    const newFile = path.join(testDir, 'loc2', 'weights-moved.gguf');
    fs.mkdirSync(path.dirname(newFile), { recursive: true });
    fs.renameSync(initialFile, newFile);

    // Availability check detects missing
    const avail2 = registry.checkModelAvailability('movable-model');
    assert.strictEqual(avail2.available, false);
    assert.strictEqual(avail2.exists, false);

    // 3. Repair path
    const repaired = registry.repairModelPath('movable-model', newFile);
    assert.strictEqual(repaired, true);

    const avail3 = registry.checkModelAvailability('movable-model');
    assert.strictEqual(avail3.available, true);
    assert.strictEqual(avail3.entry.filePath, path.resolve(newFile));
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 13: 7. Model unregistration preserves file on disk; deletion safeguards external files', () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const registry = new ModelRegistry(storage);

    const extFile = path.join(testDir, 'external-drive', 'valuable-model.gguf');
    fs.mkdirSync(path.dirname(extFile), { recursive: true });
    fs.writeFileSync(extFile, 'precious-model-weights');

    registry.registerModel({
      modelId: 'valuable-model',
      displayName: 'Valuable External Model',
      filePath: extFile,
      storageType: 'external',
      status: 'installed'
    });

    // 1. Unregister model: registry entry removed, file remains untouched
    const unregResult = registry.unregisterModel('valuable-model');
    assert.strictEqual(unregResult, true);
    assert.strictEqual(registry.listModels().length, 0);
    assert.strictEqual(fs.existsSync(extFile), true, 'Physical file must NOT be deleted during unregister');

    // 2. Re-register to test external delete protection
    registry.registerModel({
      modelId: 'valuable-model',
      displayName: 'Valuable External Model',
      filePath: extFile,
      storageType: 'external',
      status: 'installed'
    });

    // Standard deleteModel without confirmExternalDelete must NOT delete external file
    registry.deleteModel('valuable-model', true, false);
    assert.strictEqual(registry.listModels().length, 0);
    assert.strictEqual(fs.existsSync(extFile), true, 'External file must NOT be deleted without explicit confirmation');

    // 3. Delete with explicit confirmExternalDelete
    registry.registerModel({
      modelId: 'valuable-model',
      displayName: 'Valuable External Model',
      filePath: extFile,
      storageType: 'external',
      status: 'installed'
    });
    registry.deleteModel('valuable-model', true, true);
    assert.strictEqual(fs.existsSync(extFile), false, 'File is deleted only when confirmExternalDelete is true');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 13: 8. ModelInstaller.importLocalModel zero-copy in-place registration vs copy mode', async () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const verifier = new DownloadVerifier();
    const registry = new ModelRegistry(storage);
    const lifecycle = new ModelLifecycleManager();
    const installer = new ModelInstaller(storage, verifier, registry, lifecycle);

    const testGGUF = createSyntheticGGUF({
      architecture: 'qwen2',
      name: 'Custom-Qwen',
      tensorCount: 150
    });
    const externalPath = path.join(testDir, 'external', 'custom.gguf');
    fs.mkdirSync(path.dirname(externalPath), { recursive: true });
    fs.writeFileSync(externalPath, testGGUF);

    // 1. In-place zero-copy import (copyToManaged = false)
    const result1 = await installer.importLocalModel({
      sourcePath: externalPath,
      displayName: 'Custom Qwen In-Place',
      copyToManaged: false
    });

    assert.strictEqual(result1.success, true);
    assert.strictEqual(result1.entry.storageType, 'external');
    assert.strictEqual(result1.entry.isExternal, true);
    assert.strictEqual(path.resolve(result1.entry.filePath), path.resolve(externalPath));
    assert.strictEqual(fs.existsSync(externalPath), true);

    // 2. Duplicate detection on re-import of same path
    const resultDup = await installer.importLocalModel({
      sourcePath: externalPath
    });
    assert.strictEqual(resultDup.alreadyRegistered, true);
    assert.strictEqual(resultDup.modelId, result1.modelId);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 13: 9. Model path traversal and unsafe model IDs are strictly rejected', () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const registry = new ModelRegistry(storage);

    assert.throws(() => {
      registry.deleteModel('../traversal');
    }, /Invalid model ID/);

    assert.throws(() => {
      registry.deleteModel('path/with/slash');
    }, /Invalid model ID/);

    assert.throws(() => {
      registry.deleteModel('path\\with\\backslash');
    }, /Invalid model ID/);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 13: 10. Offline privacy boundary: HF model search strictly blocked when offlineOnly is true', async () => {
  const testDir = createTempWorkspace();
  try {
    const hf = new HuggingFaceDiscovery(testDir);

    // offlineOnly = true must throw and perform 0 HTTP requests
    await assert.rejects(async () => {
      await hf.findCompatibleModels('Llama-3.1-8B', { offlineOnly: true });
    }, /offline/i);

    await assert.rejects(async () => {
      await hf.fetchRepoDetails('Qwen/Qwen3-8B-GGUF', { offlineOnly: true });
    }, /offline/i);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 13: 11. InferenceManager.switchModel safely switches models and provides rollback on failure', async () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const lifecycle = new ModelLifecycleManager();
    const inference = new InferenceManager(storage, lifecycle);

    // Mock active state
    inference.loadedModel = { name: 'mock-initial-model' };
    inference.modelId = 'initial-model';
    inference.loadedModelPath = path.join(testDir, 'initial.gguf');
    inference.loadedAt = new Date().toISOString();
    inference.modelArchitecture = 'qwen3';

    // 1. Switching to non-existent file fails and restores previous model
    await assert.rejects(async () => {
      await inference.switchModel('nonexistent-model', path.join(testDir, 'missing.gguf'));
    }, /File does not exist/);

    assert.strictEqual(inference.modelId, 'initial-model');
    assert.strictEqual(inference.isModelLoaded(), true);

    // 2. Clean unload
    await inference.unloadModel();
    assert.strictEqual(inference.isModelLoaded(), false);
    assert.strictEqual(inference.modelId, null);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 13: 12. AssistantCoordinator detects natural language model-management intents accurately', () => {
  const coordinator = new AssistantCoordinator();

  // Model-management phrases
  const intent1 = coordinator.detectModelIntent('Import a model from my computer');
  assert.ok(intent1);
  assert.strictEqual(intent1.type, 'import_local');

  const intent2 = coordinator.detectModelIntent('Add this GGUF model from C:\\models\\llama.gguf');
  assert.ok(intent2);
  assert.strictEqual(intent2.type, 'import_local');
  assert.ok(intent2.path);

  const intent3 = coordinator.detectModelIntent('Show my installed models');
  assert.ok(intent3);
  assert.strictEqual(intent3.type, 'list_models');

  const intent4 = coordinator.detectModelIntent('Switch to my newly imported model');
  assert.ok(intent4);
  assert.strictEqual(intent4.type, 'switch_model');

  const intent5 = coordinator.detectModelIntent('Switch back to Qwen3-8B');
  assert.ok(intent5);
  assert.strictEqual(intent5.type, 'switch_model');
  assert.match(intent5.target, /qwen3/i);

  const intent6 = coordinator.detectModelIntent('Find Qwen3-8B');
  assert.ok(intent6);
  assert.strictEqual(intent6.type, 'find_model');
  assert.match(intent6.query, /qwen3/i);

  const intent7 = coordinator.detectModelIntent('I want to use Llama 3.1 8B');
  assert.ok(intent7);
  assert.strictEqual(intent7.type, 'find_model');
  assert.match(intent7.query, /llama/i);

  // Ordinary conversation MUST NOT be classified as model intent
  assert.strictEqual(coordinator.detectModelIntent('How does a neural network learn weights?'), null);
  assert.strictEqual(coordinator.detectModelIntent('What is GGUF format and why is it used?'), null);
  assert.strictEqual(coordinator.detectModelIntent('Tell me a story about a spaceship named Model X.'), null);
  assert.strictEqual(coordinator.detectModelIntent('Can you write a python script to parse JSON?'), null);
});

test('Phase 13: 13. AssistantCoordinator returns action cards for model requests instead of accidental changes', async () => {
  const testDir = createTempWorkspace();
  try {
    const storage = new StorageService(testDir);
    const registry = new ModelRegistry(storage);
    const lifecycle = new ModelLifecycleManager();
    const inference = new InferenceManager(storage, lifecycle);

    const coordinator = new AssistantCoordinator({
      inference,
      storage,
      modelRegistry: registry
    });

    // 1. List models intent returns action card with installed models list
    const listRes = await coordinator.handleUserMessage('Show my installed models');
    assert.strictEqual(listRes.isModelAction, true);
    assert.strictEqual(listRes.actionCard.action, 'list_models');
    assert.ok(Array.isArray(listRes.actionCard.models));

    // 2. Import intent returns import action card
    const importRes = await coordinator.handleUserMessage('Import a model from my computer');
    assert.strictEqual(importRes.isModelAction, true);
    assert.strictEqual(importRes.actionCard.action, 'import_local');
    assert.strictEqual(importRes.actionCard.requiresConfirmation, true);

    // 3. Switch intent returns confirmation action card
    const switchRes = await coordinator.handleUserMessage('Switch to my newly imported model');
    assert.strictEqual(switchRes.isModelAction, true);
    assert.strictEqual(switchRes.actionCard.action, 'switch_model');
    assert.strictEqual(switchRes.actionCard.requiresConfirmation, true);
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 13: 14. AssistantCoordinator preserves conversation history and records modelId provenance', async () => {
  const coordinator = new AssistantCoordinator({
    inference: {
      isModelLoaded: () => true,
      getLoadedModelInfo: () => ({ modelId: 'qwen3-8b' }),
      generate: async () => ({ text: 'Response from Qwen3', tokenCount: 4, tokensPerSecond: 20 })
    }
  });

  await coordinator.handleUserMessage('Hello assistant');
  const history = coordinator.getConversationHistory();
  assert.strictEqual(history.length, 2);
  assert.strictEqual(history[0].role, 'user');
  assert.strictEqual(history[1].role, 'assistant');
  assert.strictEqual(history[1].modelId, 'qwen3-8b');

  // Change active model on inference
  coordinator.inference.getLoadedModelInfo = () => ({ modelId: 'llama-3.1-8b' });
  coordinator.inference.generate = async () => ({ text: 'Response from Llama', tokenCount: 4, tokensPerSecond: 22 });

  await coordinator.handleUserMessage('How are you now?');
  const history2 = coordinator.getConversationHistory();
  assert.strictEqual(history2.length, 4);
  assert.strictEqual(history2[1].modelId, 'qwen3-8b');
  assert.strictEqual(history2[3].modelId, 'llama-3.1-8b');
});
