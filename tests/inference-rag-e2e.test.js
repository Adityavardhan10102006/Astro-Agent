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

test('InferenceManager enforces single model and streams tokens', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-infer-test-'));
  const storage = new StorageService(tempDir);
  const hw = new HardwareService();
  const inference = new InferenceManager(storage, hw);

  // Create mock model files
  const modelFile1 = path.join(tempDir, 'model1.gguf');
  const modelFile2 = path.join(tempDir, 'model2.gguf');
  fs.writeFileSync(modelFile1, 'mock-gguf-1');
  fs.writeFileSync(modelFile2, 'mock-gguf-2');

  // Load model 1
  await inference.loadModel('qwen2.5-coder-7b', modelFile1);
  assert.strictEqual(inference.isModelLoaded(), true);
  assert.strictEqual(inference.loadedModel.modelId, 'qwen2.5-coder-7b');
  assert.strictEqual(storage.getActiveModel().modelId, 'qwen2.5-coder-7b');

  // Load model 2 -> must automatically unload model 1 (single model enforcement, Rule 11)
  await inference.loadModel('qwen3-8b', modelFile2);
  assert.strictEqual(inference.loadedModel.modelId, 'qwen3-8b');
  assert.strictEqual(storage.getActiveModel().modelId, 'qwen3-8b');

  // Stream generation
  const tokensReceived = [];
  const result = await inference.generate({
    prompt: 'Write a python function to add two numbers',
    onToken: (tok) => {
      if (tok.token) tokensReceived.push(tok.token);
    }
  });

  assert.ok(tokensReceived.length > 0);
  assert.ok(result.text.length > 0);
  assert.ok(result.tokensPerSecond >= 0);

  // Unload model
  await inference.unloadModel();
  assert.strictEqual(inference.isModelLoaded(), false);
  assert.strictEqual(storage.getActiveModel(), null);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('AssistantCoordinator performs local RAG question answering and returns citations', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-asst-test-'));
  const storage = new StorageService(tempDir);
  const hw = new HardwareService();
  const inference = new InferenceManager(storage, hw);
  const rag = new RAGService(storage);
  const assistant = new AssistantCoordinator(storage, inference, rag);

  // Populate local knowledge doc
  rag.addDocument('PROJECT_SPEC.md', 'ASTRO uses Qwen2.5-Coder as its default offline LLM with 4-bit GGUF quantization.');

  // Create & load model
  const modelFile = path.join(tempDir, 'qwen-model.gguf');
  fs.writeFileSync(modelFile, 'mock-model');
  await inference.loadModel('qwen2.5-coder-7b-instruct', modelFile);

  // Send message with RAG enabled
  assistant.startNewConversation();
  const response = await assistant.handleUserMessage({
    message: 'What is the default offline model used in ASTRO?',
    useRAG: true
  });

  assert.ok(response.text.length > 0);
  assert.ok(response.citations.length > 0);
  assert.strictEqual(response.citations[0].docName, 'PROJECT_SPEC.md');
  assert.ok(response.citations[0].snippet.includes('Qwen2.5-Coder'));

  // Verify conversation was persisted locally
  const convList = assistant.getConversationsList();
  assert.ok(convList.length > 0);

  fs.rmSync(tempDir, { recursive: true, force: true });
});
