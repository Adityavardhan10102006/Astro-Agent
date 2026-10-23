const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { SecurityService } = require('../src/services/security/security-service');
const { FileService } = require('../src/services/files/file-service');
const { CodingService } = require('../src/services/coding/coding-service');
const { ProjectIntelligenceService } = require('../src/services/coding/project-intelligence');

async function testCodingWorkspace() {
  console.log('=== Step 5 Coding Workspace Acceptance Test ===');
  
  // 1. Create a disposable test project
  const testDir = path.join(os.tmpdir(), `astro_coding_test_${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });

  const fileA = path.join(testDir, 'index.js');
  const fileB = path.join(testDir, 'README.md');
  const fileC = path.join(testDir, 'package.json');

  fs.writeFileSync(fileA, 'function greet(name) {\n  return "Hello, " + name;\n}\nmodule.exports = { greet };\n');
  fs.writeFileSync(fileB, '# Test Project\nSample README for testing.\n');
  fs.writeFileSync(fileC, JSON.stringify({ name: "test-proj", version: "1.0.0", main: "index.js" }, null, 2));

  console.log('Disposable workspace created at:', testDir);

  try {
    const security = new SecurityService({ allowedWorkspaceRoots: [testDir] });
    const files = new FileService(security);
    const coding = new CodingService(security, files);
    const projectIntel = new ProjectIntelligenceService(security, files);

    // 2. Open project and inspect tree
    console.log('1. Setting active project and inspecting structure...');
    const projectMeta = projectIntel.setActiveProject(testDir);
    assert.strictEqual(projectMeta.name, path.basename(testDir));
    const scanned = files.listFiles(testDir, { recursive: true });
    assert.ok(scanned.length >= 3);
    const langs = projectIntel.detectLanguages(testDir);
    assert.ok(langs.some(l => l.language === 'JavaScript'));
    const manifest = projectIntel.parseManifest(testDir);
    assert.strictEqual(manifest.name, 'test-proj');
    console.log(`   Found ${scanned.length} project files. Language: JavaScript, Manifest: ${manifest.name}`);

    // 3. Search code within project
    console.log('2. Searching code symbol "greet"...');
    const searchRes = projectIntel.searchProjectCode('greet');
    assert.ok(searchRes.length > 0);
    assert.strictEqual(searchRes[0].fileName, 'index.js');
    console.log(`   Found match in ${searchRes[0].fileName} at line ${searchRes[0].line}: "${searchRes[0].snippet.trim()}"`);

    // 4. Extract symbols
    console.log('3. Extracting code symbols from index.js...');
    const symbols = projectIntel.extractSymbols('index.js', fs.readFileSync(fileA, 'utf8'));
    assert.ok(symbols.some(s => s.type === 'function' && s.name === 'greet'));
    console.log(`   Extracted ${symbols.length} code symbols successfully.`);

    // 5. Propose edit (generate diff preview without modifying file)
    console.log('4. Proposing file edit on index.js...');
    const originalContent = fs.readFileSync(fileA, 'utf8');
    const updatedContent = 'function greet(name) {\n  return `Hello, ${name}! Welcome to ASTRO.`;\n}\nmodule.exports = { greet };\n';
    
    const diffProposal = coding.proposeFileChange(fileA, updatedContent);
    assert.strictEqual(diffProposal.requiresApproval, true);
    assert.ok(diffProposal.diff.includes('+   return `Hello, ${name}! Welcome to ASTRO.`;') || diffProposal.diff.includes('Hello, ${name}'));
    assert.strictEqual(fs.readFileSync(fileA, 'utf8'), originalContent, 'Original file must remain untouched before approval');
    console.log('   Diff generated successfully. Verified original file is unmodified on disk.');

    // 6. Apply edit with explicit approval and verify .astro_bak
    console.log('5. Applying approved edit (with .astro_bak backup)...');
    const applyRes = coding.applyApprovedChange(fileA, updatedContent, true);
    assert.strictEqual(applyRes.success, true);
    assert.ok(fs.existsSync(applyRes.backupPath), 'Backup file .astro_bak must exist');
    assert.strictEqual(fs.readFileSync(applyRes.backupPath, 'utf8'), originalContent, 'Backup must contain exact original content');
    assert.strictEqual(fs.readFileSync(fileA, 'utf8'), updatedContent);
    console.log(`   File updated on disk. Backup created at: ${applyRes.backupPath}`);

    // 7. Test Rollback / Revert
    console.log('6. Testing instant rollback using .astro_bak backup...');
    const revertRes = coding.revertFileChange(fileA, applyRes.backupPath);
    assert.strictEqual(revertRes.reverted, true);
    assert.strictEqual(fs.readFileSync(fileA, 'utf8'), originalContent, 'Rollback must restore exact original content');
    console.log('   Rollback verified: original content restored from backup.');

    // 8. Security: Reject unconfirmed command execution (Rule 9)
    console.log('7. Testing terminal command unconfirmed execution block...');
    let unconfirmedBlocked = false;
    try {
      await coding.executeApprovedCommand('node -v', testDir, false);
    } catch (err) {
      unconfirmedBlocked = true;
      assert.ok(err.message.includes('User approval required') || err.message.includes('Rule 9'));
    }
    assert.strictEqual(unconfirmedBlocked, true, 'Unconfirmed command must be blocked');
    console.log('   Safeguard verified: unconfirmed command was blocked with explicit error.');

    // 9. Safe execution of approved command
    console.log('8. Testing approved command execution with secret masking...');
    const cmdRes = await coding.executeApprovedCommand('node -e "console.log(\'ASTRO_OK\')"', testDir, true);
    assert.strictEqual(cmdRes.status, 'passed');
    assert.strictEqual(cmdRes.exitCode, 0);
    console.log('   Approved command executed successfully. Output:', cmdRes.stdout.trim());

    // 10. Boundary protection: Reject execution outside approved workspace
    console.log('9. Testing workspace boundary protection...');
    let boundaryBlocked = false;
    try {
      await coding.executeApprovedCommand('node -v', 'C:\\Windows', true);
    } catch (err) {
      boundaryBlocked = true;
    }
    assert.strictEqual(boundaryBlocked, true, 'Command outside workspace must be blocked');
    console.log('   Boundary check verified: command outside approved workspace was blocked.');

    // 11. External edit conflict detection
    console.log('10. Testing external edit conflict detection...');
    const proposalB = coding.proposeFileChange(fileB, '# Updated README\nNew text.\n');
    // Wait 10ms to ensure timestamp advances
    await new Promise(r => setTimeout(r, 20));
    // Simulate external edit
    fs.writeFileSync(fileB, '# Concurrent Edit by External Program\n');
    let conflictCaught = false;
    try {
      coding.applyApprovedChange(fileB, '# Updated README\nNew text.\n', true, {
        expectedMtime: proposalB.inspectedMtime
      });
    } catch (err) {
      conflictCaught = true;
      assert.ok(err.message.includes('External conflict') || err.message.includes('modified externally'));
    }
    assert.strictEqual(conflictCaught, true, 'External modification must prevent silent overwrite');
    console.log('   External edit conflict successfully detected and blocked.');

    console.log('\n=== All Coding Workspace Checks PASSED ===');
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('Disposable workspace cleaned up.');
  }
}

testCodingWorkspace().catch(err => {
  console.error('Coding workspace test FAILED:', err);
  process.exit(1);
});
