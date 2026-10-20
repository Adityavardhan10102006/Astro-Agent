const fs = require('fs');
const path = require('path');
const os = require('os');

// Architectures supported natively by llama.cpp / node-llama-cpp
const SUPPORTED_GGUF_ARCHITECTURES = new Set([
  'qwen',
  'qwen2',
  'qwen3',
  'llama',
  'llama2',
  'llama3',
  'mistral',
  'mixtral',
  'gemma',
  'gemma2',
  'phi',
  'phi2',
  'phi3',
  'starcoder',
  'starcoder2',
  'falcon',
  'command-r',
  'deepseek',
  'deepseek2',
  'baichuan',
  'internlm',
  'yi',
  'stablelm',
  'mpt',
  'bloom'
]);

class GGUFInspector {
  /**
   * Inspect a local model file and extract GGUF metadata, architecture,
   * quantization, context length, and resource requirements without loading weights.
   *
   * @param {string} filePath - Absolute path to the file
   * @param {number} maxReadBytes - Maximum bytes to read for header inspection (default 512 KB)
   * @returns {Object} Inspection result
   */
  static inspect(filePath, maxReadBytes = 512 * 1024) {
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, error: 'File path must be a non-empty string.' };
    }

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      return { valid: false, error: `File not found on disk: "${filePath}".` };
    }

    let stat;
    try {
      stat = fs.statSync(resolvedPath);
    } catch (e) {
      return { valid: false, error: `Failed to access file: ${e.message}` };
    }

    if (stat.size === 0) {
      return { valid: false, error: 'File is 0 bytes (empty).' };
    }

    if (stat.size < 24) {
      return { valid: false, error: 'File is too small to be a valid GGUF model (< 24 bytes).' };
    }

    let fd;
    try {
      fd = fs.openSync(resolvedPath, 'r');
    } catch (e) {
      return { valid: false, error: `Failed to open file: ${e.message}` };
    }

    const readSize = Math.min(stat.size, maxReadBytes);
    const buffer = Buffer.alloc(readSize);
    let bytesRead = 0;

    try {
      bytesRead = fs.readSync(fd, buffer, 0, readSize, 0);
    } catch (e) {
      fs.closeSync(fd);
      return { valid: false, error: `Failed to read file header: ${e.message}` };
    } finally {
      try { fs.closeSync(fd); } catch (e) {}
    }

    // 1. Magic bytes
    const magic = buffer.toString('utf8', 0, 4);
    if (magic !== 'GGUF') {
      return {
        valid: false,
        error: `Invalid GGUF header magic. Expected 'GGUF' (0x46554747), found '${magic}'. The file is not a GGUF model.`,
        magic
      };
    }

    // 2. Version
    const version = buffer.readUInt32LE(4);
    if (version < 1 || version > 10) {
      return {
        valid: false,
        error: `Incompatible GGUF version v${version}. Expected v2 or v3.`,
        version
      };
    }

    // 3. Tensor and KV counts
    const tensorCount = Number(buffer.readBigUInt64LE(8));
    const kvCount = Number(buffer.readBigUInt64LE(16));

    let offset = 24;
    const metadata = {};

    function readString() {
      if (offset + 8 > bytesRead) return null;
      const len = Number(buffer.readBigUInt64LE(offset));
      offset += 8;
      if (offset + len > bytesRead) return null;
      const str = buffer.toString('utf8', offset, offset + len);
      offset += len;
      return str;
    }

    function readValue(type) {
      switch (type) {
        case 0: { // UINT8
          if (offset + 1 > bytesRead) return null;
          const v = buffer.readUInt8(offset);
          offset += 1;
          return v;
        }
        case 1: { // INT8
          if (offset + 1 > bytesRead) return null;
          const v = buffer.readInt8(offset);
          offset += 1;
          return v;
        }
        case 2: { // UINT16
          if (offset + 2 > bytesRead) return null;
          const v = buffer.readUInt16LE(offset);
          offset += 2;
          return v;
        }
        case 3: { // INT16
          if (offset + 2 > bytesRead) return null;
          const v = buffer.readInt16LE(offset);
          offset += 2;
          return v;
        }
        case 4: { // UINT32
          if (offset + 4 > bytesRead) return null;
          const v = buffer.readUInt32LE(offset);
          offset += 4;
          return v;
        }
        case 5: { // INT32
          if (offset + 4 > bytesRead) return null;
          const v = buffer.readInt32LE(offset);
          offset += 4;
          return v;
        }
        case 6: { // FLOAT32
          if (offset + 4 > bytesRead) return null;
          const v = buffer.readFloatLE(offset);
          offset += 4;
          return v;
        }
        case 7: { // BOOL
          if (offset + 1 > bytesRead) return null;
          const v = buffer.readUInt8(offset) !== 0;
          offset += 1;
          return v;
        }
        case 8: { // STRING
          return readString();
        }
        case 9: { // ARRAY
          if (offset + 12 > bytesRead) return null;
          const elemType = buffer.readUInt32LE(offset);
          offset += 4;
          const count = Number(buffer.readBigUInt64LE(offset));
          offset += 8;
          const arr = [];
          for (let i = 0; i < count; i++) {
            if (offset >= bytesRead) break;
            if (arr.length >= 10) {
              return arr;
            }
            arr.push(readValue(elemType));
          }
          return arr;
        }
        case 10: { // UINT64
          if (offset + 8 > bytesRead) return null;
          const v = buffer.readBigUInt64LE(offset);
          offset += 8;
          return Number(v);
        }
        case 11: { // INT64
          if (offset + 8 > bytesRead) return null;
          const v = buffer.readBigInt64LE(offset);
          offset += 8;
          return Number(v);
        }
        case 12: { // FLOAT64
          if (offset + 8 > bytesRead) return null;
          const v = buffer.readDoubleLE(offset);
          offset += 8;
          return v;
        }
        default:
          return null;
      }
    }

    for (let i = 0; i < kvCount && offset < bytesRead; i++) {
      const key = readString();
      if (!key) break;
      if (offset + 4 > bytesRead) break;
      const valType = buffer.readUInt32LE(offset);
      offset += 4;
      const val = readValue(valType);
      if (val === null) break;
      metadata[key] = val;
    }

    const architecture = metadata['general.architecture'] || null;
    const baseArch = architecture ? architecture.toLowerCase().trim() : null;

    // Detect model name
    const rawName = metadata['general.name'] || metadata['general.basename'] || path.basename(resolvedPath, path.extname(resolvedPath));
    const displayName = GGUFInspector.formatDisplayName(rawName, baseArch);

    // Context length from architecture specific metadata
    let contextLength = 4096;
    if (baseArch) {
      if (metadata[`${baseArch}.context_length`]) {
        contextLength = metadata[`${baseArch}.context_length`];
      }
    }

    // Detect quantization tag
    const filename = path.basename(resolvedPath);
    let quantization = GGUFInspector.detectQuantization(filename, metadata);

    // Compatibility check
    const isSupportedArchitecture = baseArch ? SUPPORTED_GGUF_ARCHITECTURES.has(baseArch) : true;
    let compatibilityStatus = 'compatible';
    let compatibilityReason = 'Architecture and format are supported by node-llama-cpp.';

    if (baseArch && !isSupportedArchitecture) {
      compatibilityStatus = 'unsupported_architecture';
      compatibilityReason = `Architecture "${baseArch}" is not recognized or supported by the local node-llama-cpp runtime.`;
    }

    // Hardware resource estimation
    const sizeBytes = stat.size;
    const sizeGB = Number((sizeBytes / (1024 ** 3)).toFixed(2));
    // Estimate RAM: model file size in RAM + ~0.5 GB context overhead for 4k, ~1.5 GB for 32k
    const contextRamGB = Number((Math.min(contextLength, 32768) / 32768 * 1.0).toFixed(2));
    const estimatedRamGB = Number((sizeGB + contextRamGB + 0.3).toFixed(2));

    const totalSystemRamGB = Number((os.totalmem() / (1024 ** 3)).toFixed(1));
    const freeSystemRamGB = Number((os.freemem() / (1024 ** 3)).toFixed(1));

    let memoryWarning = null;
    if (estimatedRamGB > totalSystemRamGB) {
      memoryWarning = `Model requires ~${estimatedRamGB} GB RAM, which exceeds total system RAM (${totalSystemRamGB} GB). Loading will likely fail or cause extreme system freezing.`;
      if (compatibilityStatus === 'compatible') {
        compatibilityStatus = 'insufficient_ram';
      }
    } else if (estimatedRamGB > freeSystemRamGB) {
      memoryWarning = `Model requires ~${estimatedRamGB} GB RAM. Current free RAM is ${freeSystemRamGB} GB (${totalSystemRamGB} GB total). System may need to page memory to disk.`;
    }

    return {
      valid: true,
      format: 'GGUF',
      version,
      tensorCount,
      kvCount,
      filePath: resolvedPath,
      filename,
      fileSizeBytes: sizeBytes,
      fileSizeGB: sizeGB,
      architecture: baseArch,
      modelName: displayName,
      quantization,
      contextLength,
      estimatedRamGB,
      systemRam: {
        totalGB: totalSystemRamGB,
        freeGB: freeSystemRamGB
      },
      memoryEstimate: {
        estimatedModelRamBytes: sizeBytes,
        estimatedRamGB,
        fitsInRam: estimatedRamGB <= totalSystemRamGB
      },
      compatibility: {
        status: compatibilityStatus,
        supported: compatibilityStatus === 'compatible',
        engine: 'node-llama-cpp',
        chatTemplate: (baseArch === 'qwen3' || baseArch === 'qwen2') ? 'ChatML' : (baseArch === 'llama' ? 'Llama3' : 'Default'),
        requiresReview: compatibilityStatus !== 'compatible',
        reason: compatibilityReason,
        memoryWarning
      },
      metadataSummary: {
        architecture: baseArch,
        name: rawName,
        blockCount: baseArch ? metadata[`${baseArch}.block_count`] : null,
        headCount: baseArch ? metadata[`${baseArch}.attention.head_count`] : null,
        embeddingLength: baseArch ? metadata[`${baseArch}.embedding_length`] : null
      }
    };
  }

  static detectQuantization(filename, metadata = {}) {
    // 1. Try filename regex
    const match = filename.match(/(Q[0-9]_[A-Z0-9_]+|IQ[0-9]_[A-Z0-9_]+|BF16|F16|F32)/i);
    if (match) {
      return match[1].toUpperCase();
    }
    // 2. Check general.file_type enum if present
    const fileType = metadata['general.file_type'];
    if (fileType !== undefined) {
      const typeMap = {
        0: 'F32',
        1: 'F16',
        2: 'Q4_0',
        3: 'Q4_1',
        7: 'Q8_0',
        8: 'Q5_0',
        9: 'Q5_1',
        10: 'Q2_K',
        11: 'Q3_K_S',
        12: 'Q3_K_M',
        13: 'Q3_K_L',
        14: 'Q4_K_S',
        15: 'Q4_K_M',
        16: 'Q5_K_S',
        17: 'Q5_K_M',
        18: 'Q6_K'
      };
      if (typeMap[fileType]) return typeMap[fileType];
    }
    return 'Q4_K_M'; // Default practical quantization
  }

  static formatDisplayName(rawName, architecture) {
    if (!rawName) {
      return architecture ? `${architecture.toUpperCase()} Model` : 'Custom GGUF Model';
    }
    // Clean up underscores and dashes
    const cleaned = rawName
      .replace(/[-_]/g, ' ')
      .replace(/\.gguf$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    // Capitalize words
    return cleaned.replace(/\b\w/g, l => l.toUpperCase());
  }
}

module.exports = {
  GGUFInspector,
  SUPPORTED_GGUF_ARCHITECTURES
};
