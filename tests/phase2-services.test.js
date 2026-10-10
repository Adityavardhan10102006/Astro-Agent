const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { StorageService } = require('../src/services/storage/storage-service');
const { ActivityService } = require('../src/services/system/activity-service');
const { ResearchService } = require('../src/services/research/research-service');
const { VoiceService } = require('../src/services/voice/voice-service');
const { RAGService } = require('../src/services/rag/rag-service');
const { FileService } = require('../src/services/files/file-service');
const { SecurityService } = require('../src/services/security/security-service');
const { AssistantCoordinator } = require('../src/services/assistant/assistant-coordinator');
const { InferenceManager } = require('../src/services/inference/inference-manager');
const { HardwareService } = require('../src/services/system/hardware-service');

test('ActivityService tracks tasks, progress updates, and completion', (t) => {
  const activity = new ActivityService();

  const task = activity.createTask({
    id: 'test_task_1',
    type: 'model-download',
    label: 'Downloading Qwen GGUF',
    cancellable: true
  });

  assert.strictEqual(task.status, 'running');
  assert.strictEqual(activity.getActiveTasks().length, 1);

  activity.updateProgress('test_task_1', 45, '45% complete');
  assert.strictEqual(activity.getAllTasks()[0].progress, 45);

  activity.completeTask('test_task_1', 'Download finished');
  assert.strictEqual(activity.getAllTasks()[0].status, 'completed');
  assert.strictEqual(activity.getActiveTasks().length, 0);

  activity.clearCompleted();
  assert.strictEqual(activity.getAllTasks().length, 0);
});

test('ResearchService respects offline-first policy and searches local RAG', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-research-test-'));
  const storage = new StorageService(tempDir);
  const rag = new RAGService(storage);

  rag.addDocument('architecture.md', 'ASTRO uses an offline-first architecture for local intelligence.');

  const research = new ResearchService(storage, rag);

  // 1. Local-only research
  const localRes = await research.performResearch({
    query: 'offline-first architecture',
    allowOnline: false
  });

  assert.ok(localRes.localSources.length > 0);
  assert.strictEqual(localRes.localSources[0].title, 'architecture.md');
  assert.strictEqual(localRes.webSources.length, 0);

  // 2. Online requested while offlineOnly is true (Default privacy rule)
  const onlineAttemptRes = await research.performResearch({
    query: 'offline-first architecture',
    allowOnline: true
  });

  assert.ok(onlineAttemptRes.notice.includes('Offline-First mode is enforced'));
  assert.strictEqual(onlineAttemptRes.webSources.length, 0);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('VoiceService honestly reports missing Whisper engine and manages preferences', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-voice-test-'));
  const storage = new StorageService(tempDir);
  const voice = new VoiceService(storage);

  const status = voice.getEngineStatus();
  assert.strictEqual(status.sttAvailable, false);
  assert.strictEqual(status.missingComponents.length, 1);
  assert.ok(status.missingComponents[0].includes('whisper'));

  // Attempting to listen without local model throws honest error
  assert.throws(() => {
    voice.startListening();
  }, /Whisper GGUF.*not installed/);

  // TTS preference toggling
  assert.strictEqual(voice.setSpokenResponsePreference(true), true);
  assert.strictEqual(voice.getEngineStatus().ttsEnabled, true);

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('RAGService supports multi-collection management and document removal', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-colls-test-'));
  const storage = new StorageService(tempDir);
  const rag = new RAGService(storage);

  // Add doc to default collection
  rag.addDocument('doc1.md', 'Sample content for default collection.');
  assert.strictEqual(rag.getIndexStats().totalDocuments, 1);

  // Create new collection
  rag.createCollection('project-x');
  assert.strictEqual(rag.getIndexStats().activeCollection, 'project-x');
  assert.strictEqual(rag.getIndexStats().totalDocuments, 0);

  rag.addDocument('project.md', 'Project X documentation notes.');
  assert.strictEqual(rag.getIndexStats().totalDocuments, 1);

  // Remove document without deleting original file
  const removed = rag.removeDocument('project.md');
  assert.strictEqual(removed, true);
  assert.strictEqual(rag.getIndexStats().totalDocuments, 0);

  // List collections
  const collections = rag.listCollections();
  assert.ok(collections.some(c => c.name === 'default'));
  assert.ok(collections.some(c => c.name === 'project-x'));

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('FileService categorizes files and provides detailed file stats', (t) => {
  const sec = new SecurityService({ allowedWorkspaceRoots: [process.cwd()] });
  const files = new FileService(sec);

  assert.strictEqual(files.getFileCategory('.js'), 'code');
  assert.strictEqual(files.getFileCategory('.md'), 'docs');
  assert.strictEqual(files.getFileCategory('.json'), 'data');

  const details = files.getFileDetails(path.join(process.cwd(), 'package.json'));
  assert.strictEqual(details.name, 'package.json');
  assert.strictEqual(details.category, 'data');
  assert.ok(details.lineCount > 0);
  assert.strictEqual(details.isText, true);
});

test('AssistantCoordinator supports conversation loading, renaming, and deletion', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-asst-manage-'));
  const storage = new StorageService(tempDir);
  const hw = new HardwareService();
  const inference = new InferenceManager(storage, hw);
  const rag = new RAGService(storage);
  const asst = new AssistantCoordinator(storage, inference, rag);

  const convId = asst.startNewConversation();
  asst.saveConversation('Initial Title');

  assert.strictEqual(asst.getConversationsList().length, 1);

  const renamed = asst.renameConversation(convId, 'Updated Title');
  assert.strictEqual(renamed, true);
  assert.strictEqual(asst.getConversationsList()[0].title, 'Updated Title');

  const loaded = asst.loadConversation(convId);
  assert.strictEqual(loaded.title, 'Updated Title');

  const deleted = asst.deleteConversation(convId);
  assert.strictEqual(deleted, true);
  assert.strictEqual(asst.getConversationsList().length, 0);

  fs.rmSync(tempDir, { recursive: true, force: true });
});
