const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const { StorageService } = require('../src/services/storage/storage-service');
const { SecurityService } = require('../src/services/security/security-service');
const { FileService } = require('../src/services/files/file-service');
const { RAGService } = require('../src/services/rag/rag-service');
const { RetrievalService } = require('../src/services/rag/retrieval-service');
const { ActivityService } = require('../src/services/system/activity-service');
const { ActionService } = require('../src/services/platform/action-service');
const { VoiceService } = require('../src/services/voice/voice-service');
const { ModelRegistry } = require('../src/services/models/model-registry');
const { ModelLifecycleManager } = require('../src/services/models/model-lifecycle');
const { DownloadVerifier } = require('../src/services/models/download-verifier');
const { ModelInstaller } = require('../src/services/models/model-installer');

async function auditCoreFeatures() {
  console.log('=== Step 6 & 7 Feature & Privacy Acceptance Audit ===');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-phase31-audit-'));

  try {
    const storage = new StorageService(tempDir);
    storage.ensureDirectories();

    const security = new SecurityService({ allowedWorkspaceRoots: [tempDir] });
    const files = new FileService(security);

    // 1. Settings persistence & defaults
    console.log('1. Auditing Settings Service...');
    const defaultSettings = storage.getSettings();
    assert.strictEqual(defaultSettings.privacy.offlineOnly, true, 'offlineOnly must default to true');
    assert.strictEqual(defaultSettings.privacy.telemetryEnabled, false, 'telemetry must be disabled');
    assert.strictEqual(defaultSettings.privacy.autoUpload, false, 'autoUpload must be disabled');
    assert.strictEqual(defaultSettings.security.requireApprovalForCommands, true, 'command approval required');
    assert.strictEqual(defaultSettings.security.requireApprovalForFileEdits, true, 'file edit approval required');
    
    // Test settings mutation & reload
    const modifiedSettings = { ...defaultSettings, appearance: { ...defaultSettings.appearance, theme: 'light' } };
    storage.saveSettings(modifiedSettings);
    const reloadedSettings = storage.getSettings();
    assert.strictEqual(reloadedSettings.appearance.theme, 'light', 'Settings must persist across reloads');
    console.log('   Settings Service: PASS');

    // 2. Secret Redaction & Logging Privacy
    console.log('2. Auditing Secret Redaction in Logs...');
    const secretLine = 'User entered API key hf_abcdef1234567890abcdef and token sk-12345678901234567890';
    storage.appendLog('info', secretLine);
    const logDate = new Date().toISOString().slice(0, 10);
    const logPath = path.join(storage.paths.logs, `astro-${logDate}.log`);
    const logContent = fs.readFileSync(logPath, 'utf8');
    assert.ok(!logContent.includes('hf_abcdef1234567890abcdef'), 'HF token must be masked in log');
    assert.ok(!logContent.includes('sk-12345678901234567890'), 'API key must be masked in log');
    assert.ok(logContent.includes('[REDACTED_HF_TOKEN]'), 'Must contain [REDACTED_HF_TOKEN]');
    console.log('   Secret Redaction: PASS');

    // 3. Model Management & BYOM Import
    console.log('3. Auditing Model Registry, Verifier & Installer...');
    const registry = new ModelRegistry(storage);
    const lifecycle = new ModelLifecycleManager();
    const verifier = new DownloadVerifier();
    const installer = new ModelInstaller(storage, verifier, registry, lifecycle);

    // Verify existing root model file
    const rootModel = path.resolve('Qwen3-8B-Q4_K_M.gguf');
    if (fs.existsSync(rootModel)) {
      const header = verifier.verifyGGUFHeader(rootModel);
      assert.strictEqual(header.valid, true);
      assert.strictEqual(header.magic, 'GGUF');
      assert.strictEqual(header.version, 3);
      console.log(`   Model Verification: Valid GGUF v3 header verified (${header.tensorCount} tensors)`);
    }

    // Test importing into registry without deleting file
    const dummyModelPath = path.join(tempDir, 'sample-test-model.gguf');
    // Create valid 64-byte GGUF mock header
    const buf = Buffer.alloc(64);
    buf.write('GGUF', 0, 4, 'ascii');
    buf.writeUInt32LE(3, 4); // version 3
    buf.writeBigUInt64LE(10n, 8); // tensor count
    buf.writeBigUInt64LE(5n, 16); // metadata count
    fs.writeFileSync(dummyModelPath, buf);

    const importRes = await installer.importLocalModel({
      sourcePath: dummyModelPath,
      modelId: 'sample-test-model',
      displayName: 'Sample Test Model',
      variantTag: 'Q4_K_M',
      copyToManagedDir: false
    });
    assert.strictEqual(importRes.modelId, 'sample-test-model');
    assert.ok(fs.existsSync(dummyModelPath), 'Import must NOT delete original model file');
    assert.strictEqual(registry.getEntry('sample-test-model') !== null, true);

    // Deregister model: must not delete file
    registry.deleteModel('sample-test-model', false);
    assert.strictEqual(registry.getEntry('sample-test-model'), null);
    assert.ok(fs.existsSync(dummyModelPath), 'Deregistration must NOT delete the source file on disk');
    console.log('   Model Manager & Registration Safety: PASS');

    // 4. RAG Service: Document Extraction, Indexing, and Retrieval
    console.log('4. Auditing Local RAG & Document Retrieval...');
    const rag = new RAGService(storage);
    rag.addDocument('docs/architecture.md', 'ASTRO architecture: Built with Node.js and Electron for offline desktop performance with local GGUF models.');
    rag.addDocument('docs/privacy.md', 'Privacy guarantees: All user files and indexed embeddings remain 100% on the local computer.');

    const res1 = rag.query('Node.js and Electron offline desktop', 2);
    assert.ok(res1.citations.length > 0, 'Retrieval must return matching chunks');
    assert.strictEqual(res1.citations[0].docName, 'architecture.md');
    assert.strictEqual(res1.hasEvidence, true);
    console.log(`   RAG Retrieval: PASS (${res1.citations.length} citations returned: ${res1.citations[0].docName})`);

    // 5. Activity Service: Tracking, Status, and Cleanup
    console.log('5. Auditing Activity Service...');
    const activity = new ActivityService();
    const task = activity.createTask({
      type: 'rag-indexing',
      label: 'Indexing user document',
      details: 'Processing files'
    });
    activity.updateProgress(task.id, 50, 'Extracting text chunks');
    let activeTasks = activity.getActiveTasks();
    assert.strictEqual(activeTasks.length, 1);
    assert.strictEqual(activeTasks[0].progress, 50);

    activity.completeTask(task.id, 'Finished indexing');
    activeTasks = activity.getActiveTasks();
    assert.strictEqual(activeTasks.length, 0);
    const allTasks = activity.getAllTasks();
    assert.strictEqual(allTasks[0].status, 'completed');
    console.log('   Activity Service: PASS');

    // 6. Desktop Actions Service: Registry, Permissions, and Safeguards
    console.log('6. Auditing Desktop Action Registry & Confirmation Safeguards...');
    const actions = new ActionService({
      storageService: storage,
      securityService: security,
      hardwareService: null,
      inferenceManager: null,
      ragService: rag,
      fileService: files,
      codingService: null,
      activityService: activity
    });
    
    // Low-risk action executes directly
    const statusRes = await actions.requestAction('system_status', {});
    assert.strictEqual(statusRes.status, 'completed');
    console.log('   Low-risk action executed directly: PASS');

    // High-risk destructive action requires staging & explicit confirmation
    const deleteReq = await actions.requestAction('delete_file', { filePath: path.join(tempDir, 'test.txt') });
    assert.strictEqual(deleteReq.status, 'pending_confirmation');
    assert.strictEqual(deleteReq.requiresConfirmation, true);
    console.log('   High-risk action staged for explicit confirmation (Rule 9): PASS');

    // User cancels the staged action
    const cancelRes = await actions.confirmAction(deleteReq.requestId, false);
    assert.strictEqual(cancelRes.status, 'cancelled');
    console.log('   Action cancellation verified: PASS');

    // 7. Voice Service: Offline Status and Speech Synthesis Cleaner
    console.log('7. Auditing Voice Service...');
    const voice = new VoiceService(storage);
    const status = voice.getEngineStatus();
    assert.strictEqual(status.sttAvailable, false, 'Reports unconfigured Whisper engine honestly (Rule 5)');
    assert.strictEqual(status.sttEngine, 'Unconfigured');
    
    // Clean TTS speech text (stripping markdown, code blocks, URLs, citations)
    const messyText = '# Header Title\nHere is **important** info with [a link](https://example.com/doc) and code:\n```javascript\nconst x = 10;\n```\nAlso check citation [1] or [Doc: report.pdf].';
    const cleanSpeech = voice.cleanTextForSpeech(messyText);
    assert.ok(!cleanSpeech.includes('# Header Title'));
    assert.ok(!cleanSpeech.includes('https://example.com'));
    assert.ok(!cleanSpeech.includes('const x = 10;'));
    assert.ok(cleanSpeech.includes('[code snippet omitted]'));
    console.log(`   Cleaned speech output: "${cleanSpeech.replace(/\n/g, ' ')}"`);
    console.log('   Voice Service: PASS');

    console.log('\n=== ALL CORE FEATURES & PRIVACY AUDITS PASSED ===');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('Temporary audit workspace cleaned up.');
  }
}

auditCoreFeatures().catch(err => {
  console.error('Audit FAILED:', err);
  process.exit(1);
});
