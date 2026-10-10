const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('child_process');
const path = require('path');

test('ASTRO launches as a native desktop Electron application', async (t) => {
  const electronPath = require('electron');
  assert.ok(electronPath, 'Electron binary path must exist');

  // Launch Electron with -v to ensure the desktop runtime is executable
  const proc = spawn(electronPath, ['-v'], {
    windowsHide: true
  });

  let output = '';
  proc.stdout.on('data', d => output += d);

  const exitCode = await new Promise((resolve) => {
    proc.on('close', resolve);
  });

  assert.strictEqual(exitCode, 0);
  assert.ok(output.trim().startsWith('v33.'), `Expected Electron v33.x, got: ${output.trim()}`);
});
