#!/usr/bin/env node
const { HardwareService } = require('../src/services/system/hardware-service');

function runCheck() {
  const hw = new HardwareService();
  const specs = hw.detectSystemSpecs(true);

  console.log('====================================================');
  console.log('   ASTRO — Hardware & Environment Diagnostic Tool   ');
  console.log('====================================================');
  console.log(`OS:              ${specs.os.platform} (${specs.os.release}) ${specs.os.arch}`);
  console.log(`Processor (CPU): ${specs.cpu.model} (${specs.cpu.logicalCores} logical cores)`);
  console.log(`System Memory:   ${specs.memory.totalGB} GB Total | ${specs.memory.freeGB} GB Available (${specs.memory.percentUsed}% in use)`);
  console.log(`Graphics (GPU):  ${specs.gpu.name} (Integrated: ${specs.gpu.isIntegrated})`);
  console.log(`Acceleration:    ${specs.gpu.accelerationStatus}`);
  console.log(`Storage:         ${specs.storage.freeDiskGB} GB Available on primary drive`);
  console.log('----------------------------------------------------');
  console.log(`Target Hardware: ${specs.cpu.isRyzen ? 'AMD Ryzen Detected' : 'Alternative CPU'}`);
  console.log(`AVX2 Support:    ${specs.cpu.supportsAVX2 ? 'Verified' : 'Unsupported'}`);
  console.log('====================================================');
  console.log('Diagnostic Complete. System ready for offline inference.');
}

runCheck();
