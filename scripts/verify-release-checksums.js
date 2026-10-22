#!/usr/bin/env node
/**
 * ASTRO Release Artifact Checksum Generator & Verifier
 * Phase 19: Release Integrity and Artifact Provenance
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const distReleaseDir = path.join(rootDir, 'dist-release');
const releaseDir = path.join(rootDir, 'release');
const docsDir = path.join(rootDir, 'docs');

const ARTIFACT_FILES = [
  'ASTRO-Setup-0.1.0.exe',
  'ASTRO-0.1.0-portable.exe'
];

function computeFileHash(filePath, algorithm = 'sha256') {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const hash = crypto.createHash(algorithm);
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function generateManifest() {
  console.log('====================================================');
  console.log('   ASTRO — Release Checksum Generator (Phase 19)    ');
  console.log('====================================================');

  const sha256Lines = [];
  const detailedLines = [
    '# ASTRO v0.1.0 Release Checksums Manifest',
    `# Generated on: ${new Date().toISOString()}`,
    '# Verification command: node scripts/verify-release-checksums.js --verify',
    ''
  ];

  for (const filename of ARTIFACT_FILES) {
    const distPath = path.join(distReleaseDir, filename);
    const relPath = path.join(releaseDir, filename);
    const targetPath = fs.existsSync(distPath) ? distPath : (fs.existsSync(relPath) ? relPath : null);

    if (!targetPath) {
      console.warn(`[WARN] Artifact not found in dist-release or release: ${filename}`);
      continue;
    }

    const stat = fs.statSync(targetPath);
    const sha256 = computeFileHash(targetPath, 'sha256');
    const sha512 = computeFileHash(targetPath, 'sha512');

    console.log(`[SHA-256] ${filename} (${stat.size} bytes):`);
    console.log(`          ${sha256.toUpperCase()}`);

    sha256Lines.push(`${sha256}  ${filename}`);

    detailedLines.push(`File: ${filename}`);
    detailedLines.push(`Size: ${stat.size} bytes`);
    detailedLines.push(`SHA-256: ${sha256.toUpperCase()}`);
    detailedLines.push(`SHA-512: ${sha512.toUpperCase()}`);
    detailedLines.push('');
  }

  // Include Qwen3 recommended model hash reference
  const rootModelPath = path.join(rootDir, 'Qwen3-8B-Q4_K_M.gguf');
  if (fs.existsSync(rootModelPath)) {
    const modelStat = fs.statSync(rootModelPath);
    const modelSha256 = 'd98cdcbd03e17ce47681435b5150e34c1417f50b5c0019dd560e4882c5745785';
    detailedLines.push('File: Qwen3-8B-Q4_K_M.gguf (External AI Model)');
    detailedLines.push(`Size: ${modelStat.size} bytes`);
    detailedLines.push(`SHA-256: ${modelSha256.toUpperCase()}`);
    detailedLines.push('');
  }

  // Write SHA256SUMS.txt (standard coreutils format: <hash>  <filename>)
  const sha256Content = sha256Lines.join('\n') + '\n';
  fs.writeFileSync(path.join(docsDir, 'SHA256SUMS.txt'), sha256Content, 'utf8');
  if (fs.existsSync(distReleaseDir)) {
    fs.writeFileSync(path.join(distReleaseDir, 'SHA256SUMS.txt'), sha256Content, 'utf8');
  }

  // Write detailed CHECKSUMS.txt
  const detailedContent = detailedLines.join('\n') + '\n';
  fs.writeFileSync(path.join(docsDir, 'CHECKSUMS.txt'), detailedContent, 'utf8');
  if (fs.existsSync(distReleaseDir)) {
    fs.writeFileSync(path.join(distReleaseDir, 'CHECKSUMS.txt'), detailedContent, 'utf8');
  }

  console.log('----------------------------------------------------');
  console.log(`[OK] Successfully wrote:`);
  console.log(`     - ${path.join(docsDir, 'SHA256SUMS.txt')}`);
  console.log(`     - ${path.join(docsDir, 'CHECKSUMS.txt')}`);
  if (fs.existsSync(distReleaseDir)) {
    console.log(`     - ${path.join(distReleaseDir, 'SHA256SUMS.txt')}`);
    console.log(`     - ${path.join(distReleaseDir, 'CHECKSUMS.txt')}`);
  }
  console.log('====================================================');
}

function verifyManifest() {
  console.log('====================================================');
  console.log('   ASTRO — Release Checksum Verifier (Phase 19)     ');
  console.log('====================================================');

  const manifestPath = fs.existsSync(path.join(distReleaseDir, 'SHA256SUMS.txt'))
    ? path.join(distReleaseDir, 'SHA256SUMS.txt')
    : path.join(docsDir, 'SHA256SUMS.txt');

  if (!fs.existsSync(manifestPath)) {
    console.error(`[ERROR] Checksum manifest not found at: ${manifestPath}`);
    process.exit(1);
  }

  console.log(`Reading manifest: ${manifestPath}\n`);
  const lines = fs.readFileSync(manifestPath, 'utf8').split('\n').filter(l => l.trim() && !l.startsWith('#'));
  let passedCount = 0;
  let failedCount = 0;

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const expectedHash = parts[0].toLowerCase();
    const filename = parts.slice(1).join(' ').replace(/^\*/, ''); // Strip optional binary flag

    // Search for artifact
    const distPath = path.join(distReleaseDir, filename);
    const relPath = path.join(releaseDir, filename);
    const rootPath = path.join(rootDir, filename);
    const targetPath = fs.existsSync(distPath) ? distPath : (fs.existsSync(relPath) ? relPath : (fs.existsSync(rootPath) ? rootPath : null));

    if (!targetPath) {
      console.error(`❌ [MISSING] ${filename} - File not found!`);
      failedCount++;
      continue;
    }

    const actualHash = computeFileHash(targetPath, 'sha256').toLowerCase();
    if (actualHash === expectedHash) {
      console.log(`✅ [MATCH]   ${filename}`);
      console.log(`            Expected: ${expectedHash}`);
      console.log(`            Actual:   ${actualHash}`);
      passedCount++;
    } else {
      console.error(`❌ [MISMATCH] ${filename}`);
      console.error(`            Expected: ${expectedHash}`);
      console.error(`            Actual:   ${actualHash}`);
      failedCount++;
    }
  }

  console.log('----------------------------------------------------');
  console.log(`Verification Summary: ${passedCount} passed, ${failedCount} failed`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

const arg = process.argv[2];
if (arg === '--verify' || arg === '-v') {
  verifyManifest();
} else {
  generateManifest();
}
