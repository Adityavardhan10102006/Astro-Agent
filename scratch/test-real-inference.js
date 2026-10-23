const path = require('path');
const fs = require('fs');
const { StorageService } = require('../src/services/storage/storage-service');
const { HardwareService } = require('../src/services/system/hardware-service');
const { ModelLifecycleManager } = require('../src/services/models/model-lifecycle');
const { ModelRegistry } = require('../src/services/models/model-registry');
const { InferenceManager } = require('../src/services/inference/inference-manager');

async function testRealInference() {
  console.log('=== Step 4 Real Local Model Inference Test ===');
  const rootModelPath = path.resolve('Qwen3-8B-Q4_K_M.gguf');
  if (!fs.existsSync(rootModelPath)) {
    console.error('Model not found at:', rootModelPath);
    process.exit(1);
  }

  const storage = new StorageService(path.resolve('.astro_data'));
  const hw = new HardwareService();
  const lifecycle = new ModelLifecycleManager();
  const registry = new ModelRegistry(storage);
  const inference = new InferenceManager(storage, hw, lifecycle, registry);

  console.log('1. Checking Preflight on:', rootModelPath);
  const preflight = inference.preflightModelCheck({
    modelId: 'qwen3-8b',
    filePath: rootModelPath,
    contextWindow: 2048
  });
  console.log('Preflight severity:', preflight.severity);
  console.log('Preflight message:', preflight.message);

  console.log('\n2. Attempting to load model into RAM...');
  const t0 = Date.now();
  try {
    await inference.loadModel('qwen3-8b', rootModelPath, {
      contextWindow: 2048,
      threads: 6
    });
    const loadDuration = Date.now() - t0;
    console.log(`Model successfully loaded in ${loadDuration} ms!`);
    console.log('Loaded Model Info:', inference.getLoadedModelInfo());

    console.log('\n3. Testing generation with prompt: "Hello ASTRO! What is 2 + 2?"');
    const genT0 = Date.now();
    let firstTokenTime = null;
    let tokens = [];

    const result = await inference.generate({
      prompt: 'Hello ASTRO! What is 2 + 2? Answer in one short sentence.',
      maxTokens: 50,
      temperature: 0.2,
      onToken: (t) => {
        if (!firstTokenTime) firstTokenTime = Date.now();
        if (!t.done) {
          process.stdout.write(t.token);
          tokens.push(t.token);
        }
      }
    });

    const genDuration = Date.now() - genT0;
    const timeToFirstToken = firstTokenTime ? firstTokenTime - genT0 : null;
    console.log('\n--- Generation Complete ---');
    console.log('Response text:', result.text);
    console.log('Token count:', result.tokenCount);
    console.log(`Time to first token: ${timeToFirstToken} ms`);
    console.log(`Total generation duration: ${genDuration} ms`);
    if (result.tokenCount > 0 && genDuration > 0) {
      console.log(`Speed: ${((result.tokenCount / (genDuration / 1000))).toFixed(2)} tokens/sec`);
    }

    console.log('\n4. Unloading model...');
    await inference.unloadModel();
    console.log('Model unloaded cleanly. isModelLoaded =', inference.isModelLoaded());
  } catch (err) {
    console.error('Inference error:', err);
  }
}

testRealInference();
