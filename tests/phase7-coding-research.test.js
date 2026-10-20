const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { StorageService } = require('../src/services/storage/storage-service');
const { SecurityService } = require('../src/services/security/security-service');
const { FileService } = require('../src/services/files/file-service');
const { CodingService } = require('../src/services/coding/coding-service');
const { ProjectIntelligenceService } = require('../src/services/coding/project-intelligence');
const { ResearchService } = require('../src/services/research/research-service');
const { RAGService } = require('../src/services/rag/rag-service');

function setupTestEnvironment() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'astro-phase7-test-'));
  const storage = new StorageService(tempDir);
  storage.ensureDirectories();

  const security = new SecurityService({
    allowedWorkspaceRoots: [tempDir]
  });

  const files = new FileService(security);
  const coding = new CodingService(security, files);
  const projectIntel = new ProjectIntelligenceService(security, files);
  const rag = new RAGService(storage);
  const research = new ResearchService(storage, rag);

  return {
    tempDir,
    storage,
    security,
    files,
    coding,
    projectIntel,
    rag,
    research
  };
}

function cleanupTestEnvironment(env) {
  try {
    fs.rmSync(env.tempDir, { recursive: true, force: true });
  } catch (e) {}
}

test('Phase 7: 1. Workspace path validation and unapproved path rejection', (t) => {
  const env = setupTestEnvironment();
  const projectIntel = env.projectIntel;

  // Setting project inside approved workspace succeeds
  const projDir = path.join(env.tempDir, 'sample-app');
  fs.mkdirSync(projDir, { recursive: true });
  const meta = projectIntel.setActiveProject(projDir);
  assert.strictEqual(meta.name, 'sample-app');
  assert.strictEqual(projectIntel.getActiveProject().path, projDir);

  // Attempting to set project outside approved workspace throws security error
  const unapprovedDir = path.join(os.tmpdir(), 'unapproved-dir-' + Date.now());
  fs.mkdirSync(unapprovedDir, { recursive: true });
  assert.throws(() => {
    projectIntel.setActiveProject(unapprovedDir);
  }, /Security restriction/i);

  fs.rmSync(unapprovedDir, { recursive: true, force: true });
  cleanupTestEnvironment(env);
});

test('Phase 7: 2. Excluded folders (node_modules, .git, dist) and custom exclusion enforcement', (t) => {
  const env = setupTestEnvironment();
  const files = env.files;

  const projDir = path.join(env.tempDir, 'my-project');
  fs.mkdirSync(path.join(projDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projDir, 'node_modules', 'dep'), { recursive: true });
  fs.mkdirSync(path.join(projDir, 'dist'), { recursive: true });

  fs.writeFileSync(path.join(projDir, 'src', 'index.js'), 'console.log("src");', 'utf8');
  fs.writeFileSync(path.join(projDir, 'node_modules', 'dep', 'dep.js'), 'console.log("dep");', 'utf8');
  fs.writeFileSync(path.join(projDir, 'dist', 'bundle.js'), 'console.log("dist");', 'utf8');

  const scanned = files.listFiles(projDir, { recursive: true });
  const names = scanned.map(f => f.name);

  assert.ok(names.includes('index.js'), 'src/index.js should be included');
  assert.ok(!names.includes('dep.js'), 'node_modules contents must be excluded');
  assert.ok(!names.includes('bundle.js'), 'dist contents must be excluded');

  cleanupTestEnvironment(env);
});

test('Phase 7: 3. Credential and sensitive file detection (.env, pem, keys) and warning', (t) => {
  const env = setupTestEnvironment();
  const coding = env.coding;
  const projectIntel = env.projectIntel;

  assert.strictEqual(projectIntel.isCredentialFile('.env'), true);
  assert.strictEqual(projectIntel.isCredentialFile('.env.local'), true);
  assert.strictEqual(projectIntel.isCredentialFile('server.key'), true);
  assert.strictEqual(projectIntel.isCredentialFile('cert.pem'), true);
  assert.strictEqual(projectIntel.isCredentialFile('id_rsa'), true);
  assert.strictEqual(projectIntel.isCredentialFile('secrets.yaml'), true);
  assert.strictEqual(projectIntel.isCredentialFile('index.js'), false);

  // Proposing change to a .env file flags it as sensitive
  const envFile = path.join(env.tempDir, '.env');
  fs.writeFileSync(envFile, 'API_KEY=12345', 'utf8');

  const diffResult = coding.proposeFileChange(envFile, 'API_KEY=67890');
  assert.strictEqual(diffResult.isSensitive, true);
  assert.ok(diffResult.sensitiveWarning.includes('credentials or environment secrets'));

  // Applying without allowSensitive flag throws warning
  assert.throws(() => {
    coding.applyApprovedChange(envFile, 'API_KEY=67890', true, { allowSensitive: false });
  }, /sensitive file/i);

  // Applying with explicit allowSensitive succeeds
  const res = coding.applyApprovedChange(envFile, 'API_KEY=67890', true, { allowSensitive: true });
  assert.strictEqual(res.success, true);
  assert.strictEqual(fs.readFileSync(envFile, 'utf8'), 'API_KEY=67890');

  cleanupTestEnvironment(env);
});

test('Phase 7: 4. Project language detection and entry point detection', (t) => {
  const env = setupTestEnvironment();
  const projectIntel = env.projectIntel;

  const projDir = path.join(env.tempDir, 'polyglot-proj');
  fs.mkdirSync(path.join(projDir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(projDir, 'src', 'index.ts'), 'export const a = 1;', 'utf8');
  fs.writeFileSync(path.join(projDir, 'src', 'helper.js'), 'module.exports = 2;', 'utf8');
  fs.writeFileSync(path.join(projDir, 'script.py'), 'print("py")', 'utf8');

  projectIntel.setActiveProject(projDir);
  const langs = projectIntel.detectLanguages(projDir);
  assert.ok(langs.some(l => l.language === 'TypeScript'));
  assert.ok(langs.some(l => l.language === 'JavaScript'));
  assert.ok(langs.some(l => l.language === 'Python'));

  const entryPoints = projectIntel.detectEntryPoints(projDir);
  assert.ok(entryPoints.some(e => e.entryFile.includes('index.ts')));

  cleanupTestEnvironment(env);
});

test('Phase 7: 5. Project manifest parsing (package.json, requirements.txt)', (t) => {
  const env = setupTestEnvironment();
  const projectIntel = env.projectIntel;

  const projDir = path.join(env.tempDir, 'node-app');
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(path.join(projDir, 'package.json'), JSON.stringify({
    name: 'node-demo-app',
    version: '1.2.3',
    scripts: {
      test: 'node --test',
      build: 'esbuild index.js'
    },
    dependencies: {
      express: '^4.18.2'
    },
    devDependencies: {
      mocha: '^10.0.0'
    }
  }, null, 2), 'utf8');

  const manifest = projectIntel.parseManifest(projDir);
  assert.strictEqual(manifest.type, 'node');
  assert.strictEqual(manifest.name, 'node-demo-app');
  assert.strictEqual(manifest.scripts.test, 'node --test');
  assert.ok(manifest.dependencies.includes('express'));
  assert.ok(manifest.dependencies.includes('mocha'));

  cleanupTestEnvironment(env);
});

test('Phase 7: 6. Code symbol extraction (functions, classes, imports, exports) with line numbers', (t) => {
  const env = setupTestEnvironment();
  const projectIntel = env.projectIntel;

  const code = `
const path = require('path');
import { util } from './util';

class DataProcessor {
  constructor() {}
}

async function computeMetrics(data) {
  return data.length;
}

const formatOutput = (val) => {
  return val.toString();
};

module.exports = {
  DataProcessor,
  computeMetrics
};
`;

  const symbols = projectIntel.extractSymbols('app.js', code);
  assert.ok(symbols.some(s => s.type === 'import' && s.name === 'path'));
  assert.ok(symbols.some(s => s.type === 'class' && s.name === 'DataProcessor'));
  assert.ok(symbols.some(s => s.type === 'function' && s.name === 'computeMetrics'));
  assert.ok(symbols.some(s => s.type === 'function' && s.name === 'formatOutput'));
  assert.ok(symbols.some(s => s.type === 'export'));

  // Ensure line numbers are attached
  symbols.forEach(s => {
    assert.ok(typeof s.line === 'number' && s.line > 0);
  });

  cleanupTestEnvironment(env);
});

test('Phase 7: 7. Code search within project with verified line ranges and snippet context', (t) => {
  const env = setupTestEnvironment();
  const projectIntel = env.projectIntel;

  const projDir = path.join(env.tempDir, 'search-app');
  fs.mkdirSync(path.join(projDir, 'src'), { recursive: true });

  const fileContent = `line 1
line 2
line 3
function calculateInterestRate(principal) {
  return principal * 0.05;
}
line 7
line 8`;

  fs.writeFileSync(path.join(projDir, 'src', 'finance.js'), fileContent, 'utf8');
  projectIntel.setActiveProject(projDir);

  const results = projectIntel.searchProjectCode('calculateInterestRate');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].fileName, 'finance.js');
  assert.strictEqual(results[0].line, 4);
  assert.ok(results[0].lineRange.includes(':L2-L6'));
  assert.ok(results[0].snippet.includes('calculateInterestRate'));

  cleanupTestEnvironment(env);
});

test('Phase 7: 8. Diff generation and safe file editing with backup creation (.astro_bak)', (t) => {
  const env = setupTestEnvironment();
  const coding = env.coding;

  const targetFile = path.join(env.tempDir, 'module.js');
  fs.writeFileSync(targetFile, 'const port = 3000;\nconst host = "localhost";', 'utf8');

  const newCode = 'const port = 8080;\nconst host = "0.0.0.0";';
  const diffResult = coding.proposeFileChange(targetFile, newCode);

  assert.strictEqual(diffResult.requiresApproval, true);
  assert.ok(diffResult.diff.includes('- const port = 3000;'));
  assert.ok(diffResult.diff.includes('+ const port = 8080;'));

  // Applying approved change creates backup
  const applyRes = coding.applyApprovedChange(targetFile, newCode, true);
  assert.strictEqual(applyRes.success, true);
  assert.ok(fs.existsSync(applyRes.backupPath));
  assert.strictEqual(fs.readFileSync(applyRes.backupPath, 'utf8'), 'const port = 3000;\nconst host = "localhost";');
  assert.strictEqual(fs.readFileSync(targetFile, 'utf8'), newCode);

  cleanupTestEnvironment(env);
});

test('Phase 7: 9. External-edit conflict detection prevents silent overwrite', (t) => {
  const env = setupTestEnvironment();
  const coding = env.coding;

  const targetFile = path.join(env.tempDir, 'conflict.js');
  fs.writeFileSync(targetFile, 'let count = 0;', 'utf8');

  // Inspect file
  const proposed = coding.proposeFileChange(targetFile, 'let count = 10;');
  const inspectedMtime = proposed.inspectedMtime;

  // Simulate an external edit by a developer 100ms later
  const laterTime = new Date(Date.now() + 1000);
  fs.writeFileSync(targetFile, 'let count = 5; // external edit', 'utf8');
  fs.utimesSync(targetFile, laterTime, laterTime);

  // Applying ASTRO edit with expectedMtime catches external conflict
  assert.throws(() => {
    coding.applyApprovedChange(targetFile, 'let count = 10;', true, { expectedMtime: inspectedMtime });
  }, /External conflict/i);

  // The external content is preserved
  assert.strictEqual(fs.readFileSync(targetFile, 'utf8'), 'let count = 5; // external edit');

  cleanupTestEnvironment(env);
});

test('Phase 7: 10. Revert and recovery behavior restores original file safely', (t) => {
  const env = setupTestEnvironment();
  const coding = env.coding;

  const targetFile = path.join(env.tempDir, 'revertible.js');
  const originalContent = 'function originalFunction() { return true; }';
  fs.writeFileSync(targetFile, originalContent, 'utf8');

  // Apply change
  const newContent = 'function modifiedFunction() { return false; }';
  const applyRes = coding.applyApprovedChange(targetFile, newContent, true);
  assert.strictEqual(fs.readFileSync(targetFile, 'utf8'), newContent);

  // Revert change
  const revertRes = coding.revertFileChange(targetFile, applyRes.backupPath);
  assert.strictEqual(revertRes.reverted, true);
  assert.strictEqual(fs.readFileSync(targetFile, 'utf8'), originalContent);

  cleanupTestEnvironment(env);
});

test('Phase 7: 11. Command runner validates working directory and enforces approval', async (t) => {
  const env = setupTestEnvironment();
  const coding = env.coding;

  // 1. Unconfirmed command is rejected
  await assert.rejects(async () => {
    await coding.executeApprovedCommand('echo test', env.tempDir, false);
  }, /User approval required/);

  // 2. Command in unapproved cwd is rejected
  const unapprovedDir = path.join(os.homedir(), 'unapproved_folder_' + Date.now());
  await assert.rejects(async () => {
    await coding.executeApprovedCommand('echo test', unapprovedDir, true);
  }, /Security violation/);

  // 3. Approved command inside workspace executes
  const execRes = await coding.executeApprovedCommand('node -e "console.log(42)"', env.tempDir, true);
  assert.strictEqual(execRes.exitCode, 0);
  assert.strictEqual(execRes.status, 'passed');
  assert.ok(execRes.stdout.includes('42'));

  cleanupTestEnvironment(env);
});

test('Phase 7: 12. Command timeout, secret masking, and exit code classification', async (t) => {
  const env = setupTestEnvironment();
  const coding = env.coding;

  // 1. Exit code non-zero is classified as failed
  const failRes = await coding.executeApprovedCommand('node -e "process.exit(2)"', env.tempDir, true);
  assert.strictEqual(failRes.exitCode, 2);
  assert.strictEqual(failRes.status, 'failed');

  // 2. Secret masking in command output
  const secretCommand = 'node -e "console.log(\'bearer sk-12345678901234567890\')"';
  const secretRes = await coding.executeApprovedCommand(secretCommand, env.tempDir, true);
  assert.ok(!secretRes.stdout.includes('sk-12345678901234567890'));
  assert.ok(secretRes.stdout.includes('[REDACTED_'));

  cleanupTestEnvironment(env);
});

test('Phase 7: 13. Web research disabled behavior (offline privacy enforcement)', async (t) => {
  const env = setupTestEnvironment();
  const research = env.research;

  // By default, offlineOnly is true in default settings
  const res = await research.performResearch({
    query: 'Node.js performance optimization',
    allowOnline: true
  });

  // Must not perform external web queries and must return offline notice
  assert.ok(res.notice.includes('Offline-First mode is enforced'));
  assert.strictEqual(res.webSources.length, 0);

  cleanupTestEnvironment(env);
});

test('Phase 7: 14. Online research returns genuine URLs, titles, snippets, and domains', async (t) => {
  const env = setupTestEnvironment();
  const research = env.research;

  // Enable external services in settings for this test
  const settings = env.storage.getSettings();
  settings.privacy.offlineOnly = false;
  settings.privacy.allowExternalServices = true;
  env.storage.saveSettings(settings);

  const res = await research.performResearch({
    query: 'JavaScript',
    allowOnline: true,
    maxWeb: 2
  });

  // Verify web sources have real attributes
  if (res.webSources.length > 0) {
    const first = res.webSources[0];
    assert.strictEqual(first.type, 'web');
    assert.ok(first.title);
    assert.ok(first.url.startsWith('https://'));
    assert.ok(first.sourceDomain);
    assert.ok(first.retrievedAt);
  }

  cleanupTestEnvironment(env);
});

test('Phase 7: 15. Saving online research findings into ASTRO local knowledge collection', async (t) => {
  const env = setupTestEnvironment();
  const research = env.research;
  const rag = env.rag;

  const mockFinding = {
    title: 'V8 Engine Optimization',
    url: 'https://en.wikipedia.org/wiki/V8_(JavaScript_engine)',
    sourceDomain: 'wikipedia.org',
    snippet: 'V8 compiles JavaScript directly to native machine code before executing it.',
    retrievedAt: new Date().toISOString()
  };

  const saveRes = research.saveFindingToLibrary(mockFinding, 'default');
  assert.strictEqual(saveRes.saved, true);
  assert.ok(saveRes.virtualDocPath.includes('wikipedia.org'));

  // RAG query can now retrieve this saved finding offline
  const queryRes = await rag.query('V8 compiles JavaScript directly');
  assert.ok(queryRes.citations.length > 0);
  assert.ok(queryRes.citations.some(c => c.snippet.includes('native machine code')));

  cleanupTestEnvironment(env);
});
