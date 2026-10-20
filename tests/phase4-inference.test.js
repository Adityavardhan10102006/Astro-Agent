const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { StorageService } = require('../src/services/storage/storage-service');
const { HardwareService } = require('../src/services/system/hardware-service');
const { InferenceManager } = require('../src/services/inference/inference-manager');
const { RAGService } = require('../src/services/rag/rag-service');
const { AssistantCoordinator } = require('../src/services/assistant/assistant-coordinator');
const { ModelLifecycleManager, LIFECYCLE_STATES } = require('../src/services/models/model-lifecycle');
const { ModelRegistry } = require('../src/services/models/model-registry');
const { ExternalProviderInterface } = require('../src/services/inference/external-provider');

function createMockGGUFFile(targetPath, sizeBytes = 128) {
  const buf = Buffer.alloc(Math.max(32, sizeBytes));
  buf.write('GGUF', 0, 4, 'utf8');
  buf.writeUInt32LE(3, 4); // v3
  fs.writeFileSync(targetPath, buf);
}

test('Phase 4: 1. Successful local model loading and active model reporting', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-p4-load-'));
  const storage = new StorageService(tempDir);
  const hw = new HardwareService();
  const lifecycle = new ModelLifecycleManager();
  const registry = new ModelRegistry(storage);
  const inference = new InferenceManager(storage, hw, lifecycle, registry);

  const modelPath = path.join(tempDir, 'qwen.gguf');
  createMockGGUFFile(modelPath);

  const loaded = await inference.loadModel('qwen2.5-coder-7b-instruct', modelPath);
  assert.strictEqual(inference.isModelLoaded(), true);
  assert.strictEqual(loaded.modelId, 'qwen2.5-coder-7b-instruct');
  assert.strictEqual(inference.getActiveModel(), 'qwen2.5-coder-7b-instruct');
  assert.strictEqual(lifecycle.getState('qwen2.5-coder-7b-instruct'), LIFECYCLE_STATES.READY);

  // Model info
  const info = inference.getLoadedModelInfo();
  assert.strictEqual(info.modelId, 'qwen2.5-coder-7b-instruct');
  assert.strictEqual(info.status, 'idle');
  assert.ok(info.loadTimeMs >= 0);

  await inference.unloadModel();
  assert.strictEqual(inference.isModelLoaded(), false);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Phase 4: 2. Missing and invalid model paths reject cleanly and update lifecycle to failed', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-p4-missing-'));
  const storage = new StorageService(tempDir);
  const lifecycle = new ModelLifecycleManager();
  const inference = new InferenceManager(storage, null, lifecycle);

  await assert.rejects(async () => {
    await inference.loadModel('missing-model', path.join(tempDir, 'does-not-exist.gguf'));
  }, /not found/i);

  assert.strictEqual(lifecycle.getState('missing-model'), LIFECYCLE_STATES.FAILED);
  assert.strictEqual(inference.isModelLoaded(), false);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Phase 4: 3. Real streaming behavior, token metrics, and TTFT tracking', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-p4-stream-'));
  const storage = new StorageService(tempDir);
  const inference = new InferenceManager(storage);

  const modelPath = path.join(tempDir, 'qwen.gguf');
  createMockGGUFFile(modelPath);
  await inference.loadModel('qwen2.5-coder-7b-instruct', modelPath);

  const streamedTokens = [];
  let finalDone = false;

  const result = await inference.generate({
    prompt: 'Write an offline Fibonacci function in JavaScript',
    systemPrompt: 'You are an offline coding assistant.',
    maxTokens: 50,
    temperature: 0.1,
    onToken: (tok) => {
      if (tok.done) {
        finalDone = true;
      } else if (tok.token) {
        streamedTokens.push(tok.token);
      }
    }
  });

  assert.ok(streamedTokens.length > 0, 'Must stream tokens chunk by chunk');
  assert.strictEqual(finalDone, true, 'Must signal completion');
  assert.strictEqual(result.text, streamedTokens.join(''), 'Aggregated text must equal streamed tokens');
  assert.ok(result.tokenCount > 0);
  assert.ok(result.tokensPerSecond > 0);
  assert.ok(result.elapsedMs > 0);

  await inference.unloadModel();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Phase 4: 4. Generation cancellation stops inference immediately', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-p4-cancel-'));
  const storage = new StorageService(tempDir);
  const inference = new InferenceManager(storage);

  const modelPath = path.join(tempDir, 'qwen.gguf');
  createMockGGUFFile(modelPath);
  await inference.loadModel('qwen2.5-coder-7b-instruct', modelPath);

  let tokenCountBeforeCancel = 0;

  const genPromise = inference.generate({
    prompt: 'Generate an extensive code implementation',
    onToken: (tok) => {
      if (tok.token) {
        tokenCountBeforeCancel++;
        if (tokenCountBeforeCancel === 2) {
          // Cancel generation mid-stream
          inference.stopGeneration();
        }
      }
    }
  });

  const result = await genPromise;
  assert.strictEqual(result.aborted, true, 'Result must be marked aborted');
  assert.strictEqual(inference.status, 'idle', 'Inference status must reset to idle');

  await inference.unloadModel();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Phase 4: 5. Model switching unloads previous model and frees memory', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-p4-switch-'));
  const storage = new StorageService(tempDir);
  const lifecycle = new ModelLifecycleManager();
  const inference = new InferenceManager(storage, null, lifecycle);

  const model1 = path.join(tempDir, 'model-qwen25.gguf');
  const model2 = path.join(tempDir, 'model-qwen3.gguf');
  createMockGGUFFile(model1);
  createMockGGUFFile(model2);

  // Load Model 1
  await inference.loadModel('qwen2.5-coder-7b-instruct', model1);
  assert.strictEqual(inference.getActiveModel(), 'qwen2.5-coder-7b-instruct');
  assert.strictEqual(lifecycle.getState('qwen2.5-coder-7b-instruct'), LIFECYCLE_STATES.READY);

  // Switch to Model 2
  await inference.loadModel('qwen3-8b', model2);
  assert.strictEqual(inference.getActiveModel(), 'qwen3-8b');
  assert.strictEqual(lifecycle.getState('qwen3-8b'), LIFECYCLE_STATES.READY);

  // Model 1 must be unloaded and back in installed state
  assert.strictEqual(lifecycle.getState('qwen2.5-coder-7b-instruct'), LIFECYCLE_STATES.INSTALLED);

  await inference.unloadModel();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Phase 4: 6. AssistantCoordinator connects local RAG context with citations and history', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-p4-rag-'));
  const storage = new StorageService(tempDir);
  const inference = new InferenceManager(storage);
  const rag = new RAGService(storage);
  const coordinator = new AssistantCoordinator(storage, inference, rag);

  // Index document with genuine metadata
  rag.addDocument('c:/projects/docs/architecture.md', 'ASTRO offline assistant is designed for Ryzen 5 5500U laptops with Radeon Graphics and 16GB RAM.');

  // Load model
  const modelPath = path.join(tempDir, 'qwen.gguf');
  createMockGGUFFile(modelPath);
  await inference.loadModel('qwen2.5-coder-7b-instruct', modelPath);

  coordinator.startNewConversation();
  const streamTokens = [];
  const response = await coordinator.handleUserMessage({
    message: 'What laptop specs are supported in ASTRO architecture?',
    useRAG: true,
    onToken: (tok) => {
      if (tok.token) streamTokens.push(tok.token);
    }
  });

  assert.ok(response.text.length > 0);
  assert.ok(response.citations.length > 0, 'Citations must be returned');
  assert.strictEqual(response.citations[0].docName, 'architecture.md');
  assert.ok(response.citations[0].snippet.includes('Ryzen 5'));
  assert.strictEqual(typeof response.citations[0].score, 'number');

  // Verify conversation is saved locally
  const convList = coordinator.getConversationsList();
  assert.strictEqual(convList.length, 1);
  assert.ok(convList[0].messageCount >= 2);

  await inference.unloadModel();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('Phase 4: 7. External AI providers are strictly disabled by default with mandatory authorization', async (t) => {
  const provider = new ExternalProviderInterface();

  // 1. Must be disabled by default (Rule 2 & Rule 4)
  assert.strictEqual(provider.isRemoteInferenceEnabled(), false);
  const info = provider.getActiveProviderInfo();
  assert.strictEqual(info.enabled, false);
  assert.ok(info.disclosureNotice.includes('LOCAL PRIVACY ENFORCED'));

  // 2. Reject remote inference if disabled
  await assert.rejects(async () => {
    await provider.generateRemote('Analyze this prompt');
  }, /External provider is not enabled/);

  // 3. Reject configuration without explicit user confirmation
  await assert.rejects(async () => {
    await provider.configureRemoteProvider({
      providerName: 'OpenAI',
      endpoint: 'https://api.openai.com/v1',
      apiKey: 'sk-12345',
      userConfirmed: false // User did not confirm
    });
  }, /User authorization required/);

  // 4. Enabling with user authorization updates disclosure notice
  const authorizedInfo = await provider.configureRemoteProvider({
    providerName: 'CloudProviderX',
    endpoint: 'https://api.example.com',
    apiKey: 'secret_token',
    userConfirmed: true
  });

  assert.strictEqual(authorizedInfo.enabled, true);
  assert.ok(authorizedInfo.disclosureNotice.includes('EXTERNAL PROCESSING ACTIVE'));

  // Disable remote provider
  provider.disableRemoteProvider();
  assert.strictEqual(provider.isRemoteInferenceEnabled(), false);
});
