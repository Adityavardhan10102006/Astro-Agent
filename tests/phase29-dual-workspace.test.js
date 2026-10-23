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

function createTempDir(prefix = 'astro_p29_test_') {
  const dir = path.join(os.tmpdir(), `${prefix}${Date.now()}_${Math.random().toString(36).substring(7)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

test('Phase 29: 1. Dual-Workspace Navigation and HTML Shell Validation', () => {
  const indexPath = path.join(__dirname, '..', 'src', 'ui', 'index.html');
  assert.ok(fs.existsSync(indexPath), 'src/ui/index.html must exist');
  const html = fs.readFileSync(indexPath, 'utf-8');

  // Verify topbar dual-workspace switchers
  assert.ok(html.includes('id="btn-ws-chat"'), 'Must have btn-ws-chat workspace switcher');
  assert.ok(html.includes('id="btn-ws-studio"'), 'Must have btn-ws-studio workspace switcher');
  assert.ok(html.includes('data-screen="chat-screen"'), 'Must bind to chat-screen');
  assert.ok(html.includes('data-screen="studio-screen"'), 'Must bind to studio-screen');

  // Verify app sidebar includes both workspaces
  assert.ok(html.includes('data-screen="chat-screen"'), 'Sidebar must include chat-screen');
  assert.ok(html.includes('data-screen="studio-screen"'), 'Sidebar must include studio-screen');

  // Verify screen sections exist
  assert.ok(html.includes('id="chat-screen"'), 'Chat screen section must exist');
  assert.ok(html.includes('id="studio-screen"'), 'Studio screen section must exist');
});

test('Phase 29: 2. Chat Workspace DOM and Interactive Controls Integrity', () => {
  const indexPath = path.join(__dirname, '..', 'src', 'ui', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf-8');

  // 1. History sidebar
  assert.ok(html.includes('class="chat-history-sidebar"'), 'Must include chat-history-sidebar');
  assert.ok(html.includes('id="btn-chat-new"'), 'Must include new chat button');
  assert.ok(html.includes('id="chat-conv-search"'), 'Must include conversation search input');
  assert.ok(html.includes('id="chat-conv-list"'), 'Must include conversation list container');

  // 2. Chat Header
  assert.ok(html.includes('id="chat-active-conv-title"'), 'Must include active conversation title');
  assert.ok(html.includes('id="chat-active-model-pill"'), 'Must include active model pill');
  assert.ok(html.includes('id="btn-chat-rename"'), 'Must include conversation rename button');
  assert.ok(html.includes('id="btn-chat-delete"'), 'Must include conversation delete button');

  // 3. Model warning & recovery banner
  assert.ok(html.includes('id="chat-model-warning-banner"'), 'Must include model warning banner');
  assert.ok(html.includes('id="btn-chat-quick-load"'), 'Must include quick model load button');

  // 4. Message Area & Composer
  assert.ok(html.includes('id="chat-messages-scroll"'), 'Must include chat scroll container');
  assert.ok(html.includes('class="chat-compose-area"'), 'Must include chat compose container');
  assert.ok(html.includes('id="chat-input-text"'), 'Must include chat input textarea');
  assert.ok(html.includes('id="btn-chat-send"'), 'Must include send button');
  assert.ok(html.includes('id="btn-chat-stop"'), 'Must include stop generation button');
  assert.ok(html.includes('id="btn-chat-model-action"'), 'Must include model switcher action button');
  assert.ok(html.includes('id="chat-mode-select"'), 'Must include grounding mode select');
});

test('Phase 29: 3. VS Code-Style Coding Workspace DOM and Panel Layout Integrity', () => {
  const indexPath = path.join(__dirname, '..', 'src', 'ui', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf-8');

  // 1. Activity rail
  assert.ok(html.includes('class="studio-rail"'), 'Must include studio activity rail');
  assert.ok(html.includes('id="rail-btn-files"'), 'Must include explorer rail button');
  assert.ok(html.includes('id="rail-btn-search"'), 'Must include code search rail button');
  assert.ok(html.includes('id="rail-btn-git"'), 'Must include diff & git rail button');
  assert.ok(html.includes('id="rail-btn-ai"'), 'Must include AI assistant rail button');
  assert.ok(html.includes('id="rail-btn-term"'), 'Must include terminal rail button');

  // 2. Primary sidebar (File explorer)
  assert.ok(html.includes('id="studio-primary-sidebar"'), 'Must include studio primary sidebar');
  assert.ok(html.includes('id="studio-project-name"'), 'Must include project name pill');
  assert.ok(html.includes('id="btn-studio-open-project"'), 'Must include open project button');
  assert.ok(html.includes('id="studio-tree-search"'), 'Must include project search input');
  assert.ok(html.includes('id="studio-tree-list"'), 'Must include file tree list');
  assert.ok(html.includes('id="btn-collapse-sidebar"'), 'Must include sidebar collapse button');

  // 3. File tabs and editor
  assert.ok(html.includes('id="studio-file-tabs"'), 'Must include file tabs bar');
  assert.ok(html.includes('id="studio-editor-wrapper"'), 'Must include editor wrapper');
  assert.ok(html.includes('id="studio-line-numbers"'), 'Must include editor line numbers gutter');
  assert.ok(html.includes('id="studio-editor-box"'), 'Must include code editor textarea');
  assert.ok(html.includes('id="studio-diff-container"'), 'Must include diff container');

  // 4. Editor action bar
  assert.ok(html.includes('id="studio-editor-stats"'), 'Must include editor line/byte stats');
  assert.ok(html.includes('id="btn-mode-editor"'), 'Must include editor mode button');
  assert.ok(html.includes('id="btn-mode-diff"'), 'Must include diff preview button');
  assert.ok(html.includes('id="btn-studio-save-file"'), 'Must include save file button');
  assert.ok(html.includes('id="btn-studio-apply-diff"'), 'Must include apply diff button');
  assert.ok(html.includes('id="btn-studio-reject-diff"'), 'Must include reject diff button');
  assert.ok(html.includes('id="btn-studio-revert-diff"'), 'Must include revert backup button');

  // 5. Bottom drawer (Terminal & Problems)
  assert.ok(html.includes('id="studio-bottom-panel"'), 'Must include bottom drawer panel');
  assert.ok(html.includes('id="tab-drawer-terminal"'), 'Must include terminal drawer tab');
  assert.ok(html.includes('id="tab-drawer-checks"'), 'Must include checks drawer tab');
  assert.ok(html.includes('id="tab-drawer-history"'), 'Must include change history drawer tab');
  assert.ok(html.includes('id="studio-terminal-output"'), 'Must include terminal output area');
  assert.ok(html.includes('id="studio-cmd-input"'), 'Must include terminal command input');
  assert.ok(html.includes('id="btn-studio-run-cmd"'), 'Must include run command button');
  assert.ok(html.includes('id="btn-toggle-bottom-drawer"'), 'Must include toggle bottom drawer button');

  // 6. Right AI dock
  assert.ok(html.includes('id="studio-ai-dock"'), 'Must include AI dock panel');
  assert.ok(html.includes('id="studio-ai-model-pill"'), 'Must include AI model pill');
  assert.ok(html.includes('id="btn-close-ai-dock"'), 'Must include close AI dock button');
  assert.ok(html.includes('id="btn-ai-explain"'), 'Must include explain quick prompt');
  assert.ok(html.includes('id="btn-ai-refactor"'), 'Must include refactor quick prompt');
  assert.ok(html.includes('id="btn-ai-tests"'), 'Must include test quick prompt');
  assert.ok(html.includes('id="btn-ai-bugs"'), 'Must include bug finder quick prompt');
  assert.ok(html.includes('id="studio-ai-messages"'), 'Must include AI messages container');
  assert.ok(html.includes('id="studio-ai-input"'), 'Must include AI compose input');
  assert.ok(html.includes('id="btn-studio-ai-send"'), 'Must include ask AI button');
});

test('Phase 29: 4. Application Logic and Keyboard Shortcut Bindings Validation', () => {
  const appJsPath = path.join(__dirname, '..', 'src', 'ui', 'app.js');
  assert.ok(fs.existsSync(appJsPath), 'src/ui/app.js must exist');
  const code = fs.readFileSync(appJsPath, 'utf-8');

  // Check keyboard shortcuts
  assert.ok(code.includes("e.key === '1'"), 'Must handle Ctrl+1 for Chat');
  assert.ok(code.includes("e.key === '2'"), 'Must handle Ctrl+2 for Studio');
  assert.ok(code.includes("e.key === 'n' || e.key === 'N'"), 'Must handle Ctrl+N for New Chat');

  // Check activity rail handling
  assert.ok(code.includes('railBtnFiles.addEventListener'), 'Must bind railBtnFiles');
  assert.ok(code.includes('railBtnSearch.addEventListener'), 'Must bind railBtnSearch');
  assert.ok(code.includes('railBtnGit.addEventListener'), 'Must bind railBtnGit');
  assert.ok(code.includes('railBtnAi.addEventListener'), 'Must bind railBtnAi');
  assert.ok(code.includes('railBtnTerm.addEventListener'), 'Must bind railBtnTerm');

  // Check line numbers and scroll synchronization
  assert.ok(code.includes('studio-line-numbers'), 'Must reference studio-line-numbers');
  assert.ok(code.includes('lineGutter.scrollTop = studioEditorBox.scrollTop'), 'Must sync editor scroll to line numbers');

  // Check diff header and actions
  assert.ok(code.includes('diff-header-banner'), 'Must generate diff-header-banner');
  assert.ok(code.includes('diff-banner-apply'), 'Must bind diff-banner-apply');
  assert.ok(code.includes('diff-banner-reject'), 'Must bind diff-banner-reject');
});

test('Phase 29: 5. Safe Coding Interactions: Diff Generation, Backups, and Rollback Integrity', async () => {
  const testDir = createTempDir('astro_p29_coding_');
  try {
    const security = new SecurityService({ allowedWorkspaceRoots: [testDir] });
    const files = new FileService(security);
    const codingService = new CodingService(security, files);

    const targetFile = path.join(testDir, 'module.js');
    const originalContent = 'function hello() {\n  return "world";\n}\n';
    fs.writeFileSync(targetFile, originalContent, 'utf-8');

    // 1. Propose diff
    const modifiedContent = 'function hello() {\n  return "ASTRO Desktop AI";\n}\n';
    const diff = codingService.proposeFileChange(targetFile, modifiedContent);
    assert.strictEqual(diff.requiresApproval, true);
    assert.ok(diff.diff.includes('return "ASTRO Desktop AI";'));
    assert.ok(diff.diff.includes('return "world";'));

    // 2. Apply diff with backup creation
    const applyRes = codingService.applyApprovedChange(targetFile, modifiedContent, true);
    assert.strictEqual(applyRes.success, true);
    assert.ok(fs.existsSync(applyRes.backupPath), 'Recoverable .astro_bak backup file must be created');

    const updatedContent = fs.readFileSync(targetFile, 'utf-8');
    assert.strictEqual(updatedContent, modifiedContent);

    // 3. Rollback from backup
    const rollbackRes = codingService.revertFileChange(targetFile, applyRes.backupPath);
    assert.strictEqual(rollbackRes.reverted, true);

    const revertedContent = fs.readFileSync(targetFile, 'utf-8');
    assert.strictEqual(revertedContent, originalContent, 'File content must match original copy after revert');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 29: 6. Project Intelligence: File Tree, Credentials Warning, and Diagnostics', async () => {
  const testDir = createTempDir('astro_p29_project_');
  try {
    const security = new SecurityService({ allowedWorkspaceRoots: [testDir] });
    const files = new FileService(security);
    const pi = new ProjectIntelligenceService(security, files);

    // Create realistic project files
    fs.writeFileSync(path.join(testDir, 'index.js'), 'const a = 1;\nconsole.log(a);\n');
    fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ name: 'sample-project', version: '1.0.0' }));
    fs.writeFileSync(path.join(testDir, '.env'), 'API_KEY=secret_token_1234\n');

    // Set active project and test analysis
    const metadata = pi.setActiveProject(testDir);
    assert.strictEqual(metadata.name, path.basename(testDir));
    assert.ok(metadata.languages.some(l => l.language === 'JavaScript'));
    assert.ok(metadata.manifest.manifestFile === 'package.json');

    // Test credentials detection
    assert.strictEqual(pi.isCredentialFile(path.join(testDir, '.env')), true);
    assert.strictEqual(pi.isCredentialFile(path.join(testDir, 'index.js')), false);

    // Test code search
    const matches = pi.searchProjectCode('console.log', { maxResults: 10 });
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].line, 2);
    assert.strictEqual(matches[0].matchedLine, 'console.log(a);');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

test('Phase 29: 7. Terminal Command Execution Safeguards (Rule 9 & Rule 14)', async () => {
  const testDir = createTempDir('astro_p29_term_');
  try {
    const security = new SecurityService({ allowedWorkspaceRoots: [testDir] });
    const files = new FileService(security);
    const codingService = new CodingService(security, files);

    // Execution without confirmation MUST fail
    await assert.rejects(
      async () => {
        await codingService.executeApprovedCommand('echo "test"', testDir, false);
      },
      /User approval required/i,
      'Unconfirmed command execution must be rejected'
    );

    // Execution outside workspace root MUST fail
    const forbiddenDir = path.join(os.tmpdir(), 'outside_workspace_dir');
    await assert.rejects(
      async () => {
        await codingService.executeApprovedCommand('echo "test"', forbiddenDir, true);
      },
      /outside/i,
      'Command execution outside approved workspace must be blocked'
    );

    // Approved command execution inside workspace succeeds
    const execRes = await codingService.executeApprovedCommand('node -e "console.log(40+2)"', testDir, true);
    assert.strictEqual(execRes.exitCode, 0);
    assert.ok(execRes.stdout.includes('42'));
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
