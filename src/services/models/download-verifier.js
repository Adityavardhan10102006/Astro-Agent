const fs = require('fs');
const crypto = require('crypto');

class DownloadVerifier {
  /**
   * Verify file size against expected metadata
   */
  verifyFileSize(filePath, expectedSizeBytes, toleranceBytes = 0) {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File does not exist on disk' };
    }
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      return { valid: false, error: 'File is empty (0 bytes). Download was interrupted.' };
    }
    if (expectedSizeBytes && Math.abs(stat.size - expectedSizeBytes) > toleranceBytes) {
      return {
        valid: false,
        error: `Size mismatch: actual size is ${stat.size} bytes, expected ${expectedSizeBytes} bytes (${Math.abs(stat.size - expectedSizeBytes)} byte discrepancy).`,
        actualSize: stat.size,
        expectedSize: expectedSizeBytes
      };
    }
    return { valid: true, size: stat.size };
  }

  /**
   * Verify GGUF header magic ('GGUF' = 0x46554747 in little-endian) and format version
   */
  verifyGGUFHeader(filePath) {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File does not exist on disk' };
    }
    try {
      const buffer = Buffer.alloc(16);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 16, 0);
      fs.closeSync(fd);

      const magic = buffer.toString('utf8', 0, 4);
      if (magic !== 'GGUF') {
        return {
          valid: false,
          error: `Corrupted model file: Invalid GGUF header magic. Expected 'GGUF' (0x46554747), found '${magic}'. The downloaded file may be an HTML error page or an incomplete shard.`
        };
      }

      const version = buffer.readUInt32LE(4);
      if (version < 1 || version > 10) {
        return {
          valid: false,
          error: `Unrecognized or incompatible GGUF format version: v${version}. Expected v2 or v3.`
        };
      }

      const tensorCount = buffer.readBigUInt64LE(8);

      return {
        valid: true,
        magic,
        version,
        tensorCount: Number(tensorCount)
      };
    } catch (err) {
      return { valid: false, error: `Failed to read GGUF header structure: ${err.message}` };
    }
  }

  /**
   * Deeply inspect GGUF model metadata (architecture, quantization, RAM requirements)
   */
  inspectGGUFMetadata(filePath) {
    const { GGUFInspector } = require('./gguf-inspector');
    return GGUFInspector.inspect(filePath);
  }


  /**
   * Compute streaming SHA-256 hash of file
   */
  computeSHA256(filePath, onProgress = null) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        return reject(new Error('File does not exist on disk'));
      }

      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      const totalBytes = fs.statSync(filePath).size;
      let readBytes = 0;

      stream.on('data', (chunk) => {
        hash.update(chunk);
        readBytes += chunk.length;
        if (onProgress && totalBytes > 0) {
          onProgress(Math.round((readBytes / totalBytes) * 100));
        }
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Comprehensive integrity verification with explicit audit report
   */
  async verifyModelFile(filePath, expectedSizeBytes = null, expectedSHA256 = null) {
    const checksPerformed = [];
    const unavailableChecks = [];

    // 1. File existence & size
    const sizeCheck = this.verifyFileSize(filePath, expectedSizeBytes);
    checksPerformed.push('file_existence_and_size');
    if (!sizeCheck.valid) {
      return {
        valid: false,
        error: sizeCheck.error,
        checksPerformed,
        unavailableChecks
      };
    }

    // 2. GGUF header magic check
    if (filePath.toLowerCase().includes('.gguf')) {
      const headerCheck = this.verifyGGUFHeader(filePath);
      checksPerformed.push('gguf_magic_header_and_version');
      if (!headerCheck.valid) {
        return {
          valid: false,
          error: headerCheck.error,
          checksPerformed,
          unavailableChecks
        };
      }
    } else {
      unavailableChecks.push('gguf_magic_header (non-GGUF extension)');
    }

    // 3. SHA-256 verification if provided by source
    let computedHash = null;
    if (expectedSHA256) {
      computedHash = await this.computeSHA256(filePath);
      checksPerformed.push('sha256_checksum');
      if (computedHash.toLowerCase() !== expectedSHA256.toLowerCase()) {
        return {
          valid: false,
          error: `SHA-256 integrity failure: expected ${expectedSHA256}, calculated ${computedHash}. File is corrupted or tampered.`,
          computedHash,
          expectedSHA256,
          checksPerformed,
          unavailableChecks
        };
      }
    } else {
      unavailableChecks.push('sha256_checksum (upstream repository did not publish hash for this file)');
    }

    return {
      valid: true,
      size: sizeCheck.size,
      filePath,
      checksPerformed,
      unavailableChecks,
      computedHash,
      verifiedAt: new Date().toISOString()
    };
  }

  async verifyModelIntegrity(filePath, metadata = {}) {
    const size = metadata.expectedSizeBytes || metadata.sizeBytes || null;
    const sha = metadata.expectedSha256 || metadata.expectedSHA256 || metadata.sha256 || null;
    return this.verifyModelFile(filePath, size, sha);
  }
}

module.exports = {
  DownloadVerifier
};
