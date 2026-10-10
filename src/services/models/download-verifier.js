const fs = require('fs');
const crypto = require('crypto');

class DownloadVerifier {
  /**
   * Verify file size
   */
  verifyFileSize(filePath, expectedSizeBytes, toleranceBytes = 0) {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File does not exist' };
    }
    const stat = fs.statSync(filePath);
    if (expectedSizeBytes && Math.abs(stat.size - expectedSizeBytes) > toleranceBytes) {
      return {
        valid: false,
        error: `Size mismatch: actual ${stat.size} bytes, expected ${expectedSizeBytes} bytes`,
        actualSize: stat.size,
        expectedSize: expectedSizeBytes
      };
    }
    return { valid: true, size: stat.size };
  }

  /**
   * Verify GGUF header magic ('GGUF' = 0x46554747 in little-endian)
   */
  verifyGGUFHeader(filePath) {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File does not exist' };
    }
    try {
      const buffer = Buffer.alloc(8);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 8, 0);
      fs.closeSync(fd);

      const magic = buffer.toString('utf8', 0, 4);
      if (magic !== 'GGUF') {
        return {
          valid: false,
          error: `Invalid GGUF header magic: expected 'GGUF', found '${magic}'`
        };
      }

      const version = buffer.readUInt32LE(4);
      if (version < 1 || version > 10) {
        return {
          valid: false,
          error: `Unrecognized GGUF format version: ${version}`
        };
      }

      return { valid: true, magic, version };
    } catch (err) {
      return { valid: false, error: `Failed to read GGUF header: ${err.message}` };
    }
  }

  /**
   * Compute streaming SHA-256 of file
   */
  computeSHA256(filePath, onProgress = null) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        return reject(new Error('File does not exist'));
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
   * Comprehensive verification
   */
  async verifyModelFile(filePath, expectedSizeBytes = null, expectedSHA256 = null) {
    // 1. File existence & size
    const sizeCheck = this.verifyFileSize(filePath, expectedSizeBytes);
    if (!sizeCheck.valid) {
      return sizeCheck;
    }

    // 2. GGUF header check (if .gguf in filename/path)
    if (filePath.toLowerCase().includes('.gguf')) {
      const headerCheck = this.verifyGGUFHeader(filePath);
      if (!headerCheck.valid) {
        return headerCheck;
      }
    }

    // 3. Hash check if provided
    if (expectedSHA256) {
      const computedHash = await this.computeSHA256(filePath);
      if (computedHash.toLowerCase() !== expectedSHA256.toLowerCase()) {
        return {
          valid: false,
          error: `SHA-256 hash mismatch: expected ${expectedSHA256}, got ${computedHash}`,
          computedHash
        };
      }
    }

    return {
      valid: true,
      size: sizeCheck.size,
      filePath
    };
  }
}

module.exports = {
  DownloadVerifier
};
