const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { StorageService } = require('../src/services/storage/storage-service');
const { HardwareService } = require('../src/services/system/hardware-service');
const { DownloadVerifier } = require('../src/services/models/download-verifier');
const { RAGService } = require('../src/services/rag/rag-service');
const { SecurityService } = require('../src/services/security/security-service');
const { CodingService } = require('../src/services/coding/coding-service');
const { FileService } = require('../src/services/files/file-service');
const { APPROVED_MODELS } = require('../src/config/model-catalog');

test('StorageService initializes directories and default catalog', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-test-storage-'));
  const storage = new StorageService(tempDir);
  storage.ensureDirectories();

  assert.strictEqual(fs.existsSync(storage.paths.models), true);
  assert.strictEqual(fs.existsSync(storage.paths.downloads), true);
  assert.strictEqual(fs.existsSync(storage.paths.conversations), true);
  assert.strictEqual(fs.existsSync(storage.paths.ragIndex), true);

  const catalog = storage.getCatalog();
  assert.ok(catalog.models.length >= 2);
  const qwen = catalog.models.find(m => m.id === 'qwen2.5-coder-7b-instruct');
  assert.ok(qwen);
  assert.strictEqual(qwen.repoId, 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF');

  // Clean up
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('HardwareService detects system specs and evaluates compatibility', (t) => {
  const hw = new HardwareService();
  const specs = hw.detectSystemSpecs();

  assert.ok(specs.cpu.logicalCores > 0);
  assert.ok(specs.memory.totalGB > 0);
  assert.ok(typeof specs.gpu.isIntegrated === 'boolean');

  const defaultModel = APPROVED_MODELS[0];
  const compat = hw.evaluateCompatibility(defaultModel, 'Q4_K_M');
  assert.ok(compat);
  assert.ok(typeof compat.compatible === 'boolean');
  assert.strictEqual(compat.requiredSizeGB, 4.68);
});

test('DownloadVerifier validates GGUF magic header and catches corrupted files', (t) => {
  const verifier = new DownloadVerifier();
  const tempFile = path.join(os.tmpdir(), `test-mock-${Date.now()}.gguf`);

  // Write valid GGUF header (magic 'GGUF' + uint32 version 3)
  const validHeader = Buffer.alloc(16);
  validHeader.write('GGUF', 0, 4, 'utf8');
  validHeader.writeUInt32LE(3, 4);
  fs.writeFileSync(tempFile, validHeader);

  const validRes = verifier.verifyGGUFHeader(tempFile);
  assert.strictEqual(validRes.valid, true);
  assert.strictEqual(validRes.magic, 'GGUF');
  assert.strictEqual(validRes.version, 3);

  // Write corrupted file (HTML error page content)
  fs.writeFileSync(tempFile, '<html><body>404 Not Found</body></html>');
  const invalidRes = verifier.verifyGGUFHeader(tempFile);
  assert.strictEqual(invalidRes.valid, false);
  assert.ok(invalidRes.error.includes('Invalid GGUF header magic'));

  fs.unlinkSync(tempFile);
});

test('RAGService extracts chunks, retrieves relevant offline documents and citations', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-test-rag-'));
  const storage = new StorageService(tempDir);
  const rag = new RAGService(storage);

  const sampleDoc1 = `
ASTRO is an offline-first native desktop AI assistant.
It runs Qwen2.5-Coder models directly on your AMD Ryzen laptop.
All files, vector indexes, and chat histories remain strictly local.
`;
  const sampleDoc2 = `
Python programming guide:
Use virtual environments and requirements.txt for managing dependencies.
Pip can install wheels directly from local directories.
`;

  rag.addDocument('docs/astro-overview.md', sampleDoc1);
  rag.addDocument('docs/python-guide.md', sampleDoc2);

  const queryResult = rag.query('How does ASTRO handle offline models on Ryzen?', 2);
  assert.ok(queryResult.citations.length > 0);
  assert.strictEqual(queryResult.citations[0].docName, 'astro-overview.md');
  assert.ok(queryResult.citations[0].snippet.includes('offline-first'));
  assert.ok(queryResult.contextPrompt.includes('ASTRO is an offline-first'));

  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('SecurityService enforces workspace boundaries and secret masking', (t) => {
  const sec = new SecurityService({ allowedWorkspaceRoots: ['C:\\aditya\\ASTRO'] });

  assert.strictEqual(sec.isPathAllowed('C:\\aditya\\ASTRO\\src\\index.js'), true);
  assert.strictEqual(sec.isPathAllowed('C:\\Windows\\System32\\cmd.exe'), false);

  assert.strictEqual(sec.isCommandDestructive('rm -rf /'), true);
  assert.strictEqual(sec.isCommandDestructive('del /f /q *'), true);
  assert.strictEqual(sec.isCommandDestructive('git status'), false);

  const masked = sec.maskSecrets('Authorization: Bearer hf_1234567890abcdefghijklmnop');
  assert.ok(!masked.includes('hf_1234567890abcdefghijklmnop'));
  assert.ok(masked.includes('[REDACTED_'));
});

test('CodingService generates unified diffs and guards against unconfirmed file edits', (t) => {
  const sec = new SecurityService({ allowedWorkspaceRoots: [os.tmpdir()] });
  const fileService = new FileService(sec);
  const coding = new CodingService(sec, fileService);

  const original = 'const a = 1;\nconst b = 2;';
  const modified = 'const a = 1;\nconst b = 3;\nconst c = 4;';

  const diffResult = coding.proposeFileChange(path.join(os.tmpdir(), 'sample.js'), modified);
  assert.strictEqual(diffResult.requiresApproval, true);
  assert.ok(diffResult.diff.includes('+ const b = 3;'));

  // Without confirmation, applyApprovedChange throws
  assert.throws(() => {
    coding.applyApprovedChange(path.join(os.tmpdir(), 'sample.js'), modified, false);
  }, /User approval required/);
});
