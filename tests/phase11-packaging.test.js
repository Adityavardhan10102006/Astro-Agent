/**
 * ASTRO Phase 11: Standalone Windows Packaging Test Suite
 * Tests electron-builder configuration, release artifact verification,
 * exclusion of large GGUF files, and native binary archive unpacking.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Phase 11: Standalone Windows Installer & Packaging Validation', () => {
  const rootDir = path.resolve(__dirname, '..');
  const pkgPath = path.join(rootDir, 'package.json');
  const releaseDir = path.join(rootDir, 'release');

  it('1. Package Configuration: Build metadata, targets, and user data protection', () => {
    assert.strictEqual(fs.existsSync(pkgPath), true);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    assert.ok(pkg.build, 'package.json must contain build configuration');
    assert.strictEqual(pkg.build.appId, 'com.astro.desktop');
    assert.strictEqual(pkg.build.productName, 'ASTRO');
    assert.strictEqual(pkg.build.directories.output, 'release');

    // Win targets
    assert.ok(pkg.build.win.target.includes('nsis'), 'Target must include NSIS');
    assert.ok(pkg.build.win.target.includes('portable'), 'Target must include portable');

    // Crucial rule: Do not delete user data on uninstall
    assert.strictEqual(pkg.build.nsis.deleteAppDataOnUninstall, false, 'Uninstalling must preserve user models and database');

    // Native dependencies unpacked from ASAR
    assert.ok(pkg.build.asarUnpack.includes('**/node-llama-cpp/**'), 'node-llama-cpp must be unpacked');
    assert.ok(pkg.build.asarUnpack.includes('**/@node-llama-cpp/**'), '@node-llama-cpp must be unpacked');

    // Model weight exclusion
    assert.ok(pkg.build.files.includes('!Qwen3-8B-Q4_K_M.gguf'), 'Root Qwen3 model must be excluded from build');
    assert.ok(pkg.build.files.includes('!*.gguf'), 'All GGUF models must be excluded from installer');

    // Branding icon validation
    assert.strictEqual(fs.existsSync(path.join(rootDir, 'build', 'icon.ico')), true, 'build/icon.ico must exist');
    assert.strictEqual(fs.existsSync(path.join(rootDir, 'build', 'icon.png')), true, 'build/icon.png must exist');
    assert.strictEqual(fs.existsSync(path.join(rootDir, 'src', 'ui', 'assets', 'icon.png')), true, 'UI icon.png must exist');
  });

  it('2. Release Artifacts: Verified presence, non-zero size, and model exclusion', () => {
    assert.strictEqual(fs.existsSync(releaseDir), true, 'Release directory must exist');

    const nsisInstaller = path.join(releaseDir, 'ASTRO-Setup-0.1.0.exe');
    const portableExe = path.join(releaseDir, 'ASTRO-0.1.0-portable.exe');
    const unpackedExe = path.join(releaseDir, 'win-unpacked', 'ASTRO.exe');

    assert.strictEqual(fs.existsSync(nsisInstaller), true, 'NSIS Installer must be generated');
    assert.strictEqual(fs.existsSync(portableExe), true, 'Portable executable must be generated');
    assert.strictEqual(fs.existsSync(unpackedExe), true, 'Unpacked ASTRO.exe must exist');

    const nsisSizeMB = fs.statSync(nsisInstaller).size / (1024 * 1024);
    const portableSizeMB = fs.statSync(portableExe).size / (1024 * 1024);

    // Both installer and portable should be around 300-400 MB (Electron runtime + native binaries)
    assert.ok(nsisSizeMB > 100 && nsisSizeMB < 600, `NSIS installer size expected between 100-600MB, got ${nsisSizeMB.toFixed(1)}MB`);
    assert.ok(portableSizeMB > 100 && portableSizeMB < 600, `Portable size expected between 100-600MB, got ${portableSizeMB.toFixed(1)}MB`);

    // Verify 4.7 GB model was NOT packed into the installer
    assert.ok(nsisSizeMB < 1000, 'Installer size must be less than 1GB (model weights excluded)');
  });

  it('3. Unpacked Native Runtime: Real dlls present in app.asar.unpacked', () => {
    const unpackedDir = path.join(releaseDir, 'win-unpacked', 'resources', 'app.asar.unpacked');
    assert.strictEqual(fs.existsSync(unpackedDir), true, 'app.asar.unpacked must exist');

    const winX64Bins = path.join(unpackedDir, 'node_modules', '@node-llama-cpp', 'win-x64', 'bins', 'win-x64');
    assert.strictEqual(fs.existsSync(winX64Bins), true, 'win-x64 native binaries folder must exist');

    const files = fs.readdirSync(winX64Bins);
    assert.ok(files.includes('llama-addon.node'), 'llama-addon.node must be present');
    assert.ok(files.includes('llama-common.dll'), 'llama-common.dll must be present');
    assert.ok(files.includes('ggml-base.dll'), 'ggml-base.dll must be present');
  });

  it('4. User Data Isolation: Data path decoupled from installation directory', () => {
    const { ASTRO_DATA_DIR } = require('../src/config/default-settings.js');
    const { StorageService } = require('../src/services/storage/storage-service.js');
    const storage = new StorageService();

    assert.strictEqual(typeof ASTRO_DATA_DIR, 'string');
    assert.ok(storage.paths.models.startsWith(ASTRO_DATA_DIR));
    assert.ok(storage.paths.conversations.startsWith(ASTRO_DATA_DIR));
    assert.ok(storage.paths.ragIndex.startsWith(ASTRO_DATA_DIR));

    // Must be in user profile, completely outside Program Files or release directory
    assert.ok(!storage.paths.base.includes('win-unpacked'), 'User data must not be inside release/win-unpacked');
    assert.ok(!storage.paths.base.includes('Program Files'), 'User data must not be in Program Files');
  });
});
