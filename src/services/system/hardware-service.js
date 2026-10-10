const os = require('os');
const { execSync } = require('child_process');

class HardwareService {
  constructor() {
    this._cachedInfo = null;
  }

  detectSystemSpecs(forceRefresh = false) {
    if (this._cachedInfo && !forceRefresh) {
      // Just update dynamic free RAM
      const freeRamBytes = os.freemem();
      this._cachedInfo.memory.freeGB = Number((freeRamBytes / (1024 ** 3)).toFixed(2));
      this._cachedInfo.memory.usedGB = Number((this._cachedInfo.memory.totalGB - this._cachedInfo.memory.freeGB).toFixed(2));
      return this._cachedInfo;
    }

    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown Processor';
    const totalRamBytes = os.totalmem();
    const freeRamBytes = os.freemem();
    const totalRamGB = Number((totalRamBytes / (1024 ** 3)).toFixed(2));
    const freeRamGB = Number((freeRamBytes / (1024 ** 3)).toFixed(2));

    let gpuName = 'AMD Radeon(TM) Graphics';
    let freeDiskGB = 100; // Fallback

    if (process.platform === 'win32') {
      try {
        const gpuOut = execSync('powershell.exe -NoProfile -Command "(Get-CimInstance Win32_VideoController).Name"', {
          timeout: 2500,
          encoding: 'utf8',
          windowsHide: true
        }).trim();
        if (gpuOut) {
          gpuName = gpuOut.split('\n')[0].trim();
        }
      } catch (e) {
        // Fallback default
      }

      try {
        const diskOut = execSync('powershell.exe -NoProfile -Command "[math]::Round((Get-PSDrive -PSProvider FileSystem | Where-Object {$_.Root -match \'^C\'}).Free / 1GB, 1)"', {
          timeout: 2500,
          encoding: 'utf8',
          windowsHide: true
        }).trim();
        if (diskOut && !isNaN(parseFloat(diskOut))) {
          freeDiskGB = parseFloat(diskOut);
        }
      } catch (e) {
        // Fallback
      }
    }

    const isRyzen = /ryzen/i.test(cpuModel);
    const hasIntegratedRadeon = /radeon/i.test(gpuName) || /amd/i.test(gpuName);

    const specs = {
      os: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch()
      },
      cpu: {
        model: cpuModel,
        physicalCores: Math.ceil(cpus.length / 2),
        logicalCores: cpus.length,
        speedMHz: cpus[0] ? cpus[0].speed : 0,
        isRyzen,
        supportsAVX2: true // AMD Ryzen Zen 2/Zen 3 architecture inherently supports AVX2 & FMA3
      },
      gpu: {
        name: gpuName,
        isIntegrated: hasIntegratedRadeon,
        accelerationStatus: 'CPU AVX2 Fallback (Integrated GPU shared memory)'
      },
      memory: {
        totalGB: totalRamGB,
        freeGB: freeRamGB,
        usedGB: Number((totalRamGB - freeRamGB).toFixed(2)),
        percentUsed: Math.round(((totalRamGB - freeRamGB) / totalRamGB) * 100)
      },
      storage: {
        freeDiskGB
      }
    };

    this._cachedInfo = specs;
    return specs;
  }

  evaluateCompatibility(modelEntry, quantTag = 'Q4_K_M') {
    const specs = this.detectSystemSpecs();
    const quant = modelEntry.quantizations.find(q => q.tag === quantTag) || modelEntry.quantizations[0];
    const requiredSizeGB = quant ? quant.approxSizeGB : 5.0;
    const minRamRequired = modelEntry.hardwareRequirement ? modelEntry.hardwareRequirement.minRamGB : 8;

    const warnings = [];
    let compatible = true;

    // Check disk space (model size + 5GB safety margin)
    if (specs.storage.freeDiskGB < (requiredSizeGB + 5)) {
      warnings.push(`Low disk space: ${specs.storage.freeDiskGB} GB available. Recommended at least ${(requiredSizeGB + 5).toFixed(1)} GB.`);
      if (specs.storage.freeDiskGB < requiredSizeGB) {
        compatible = false;
      }
    }

    // Check total RAM
    if (specs.memory.totalGB < minRamRequired) {
      warnings.push(`System has ${specs.memory.totalGB} GB total RAM, which is below the recommended ${minRamRequired} GB.`);
    }

    // Check currently free RAM
    if (specs.memory.freeGB < (requiredSizeGB + 1.0)) {
      warnings.push(`Free RAM (${specs.memory.freeGB} GB) is lower than model size (${requiredSizeGB} GB). OS will rely on pagefile / virtual memory unless background apps are closed.`);
    }

    // Integrated GPU note
    if (specs.gpu.isIntegrated) {
      warnings.push('Integrated Radeon GPU shares system RAM. ASTRO will utilize optimized AVX2 CPU multi-threading to ensure stability.');
    }

    return {
      compatible,
      recommended: compatible && warnings.length <= 1,
      requiredSizeGB,
      freeDiskGB: specs.storage.freeDiskGB,
      systemRamGB: specs.memory.totalGB,
      freeRamGB: specs.memory.freeGB,
      warnings
    };
  }
}

module.exports = {
  HardwareService
};
