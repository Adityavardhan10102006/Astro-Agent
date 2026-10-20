const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class OCRExtractor {
  constructor() {
    this.name = 'LocalOCRExtractor';
    this.supportedExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.bmp']);
    this.ocrChecked = false;
    this.ocrAvailable = false;
    this.ocrBinary = 'tesseract';
  }

  isSupported(filePath, ext) {
    const fileExt = (ext || path.extname(filePath)).toLowerCase();
    return this.supportedExtensions.has(fileExt);
  }

  checkOCRAvailability() {
    if (this.ocrChecked) return this.ocrAvailable;
    try {
      execSync('tesseract --version', { stdio: 'ignore', timeout: 2000 });
      this.ocrAvailable = true;
    } catch (e) {
      this.ocrAvailable = false;
    }
    this.ocrChecked = true;
    return this.ocrAvailable;
  }

  async extract(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      throw new Error('Empty image file (0 bytes).');
    }

    const hasOCR = this.checkOCRAvailability();
    const ext = path.extname(filePath).toLowerCase();

    if (!hasOCR) {
      return {
        status: 'unconfigured',
        text: '',
        error: 'Tesseract OCR engine is not installed or configured: Optical Character Recognition requires local Tesseract binary in PATH.',
        headings: [],
        sections: [],
        metadata: {
          fileType: ext,
          sizeBytes: stat.size,
          extractor: this.name,
          ocrAvailable: false,
          empty: true
        }
      };
    }

    try {
      const output = execSync(`tesseract "${filePath}" stdout --oem 1 -l eng`, {
        encoding: 'utf8',
        timeout: 15000,
        maxBuffer: 5 * 1024 * 1024
      });

      const cleaned = output.trim();
      return {
        status: 'success',
        text: cleaned,
        headings: [{ level: 1, title: `Image OCR: ${path.basename(filePath)}` }],
        sections: [{ heading: 'Extracted OCR Text', text: cleaned }],
        metadata: {
          fileType: ext,
          sizeBytes: stat.size,
          extractor: this.name,
          ocrAvailable: true,
          empty: cleaned.length === 0
        }
      };
    } catch (err) {
      return {
        status: 'error',
        error: `OCR processing failed: ${err.message}`
      };
    }
  }
}

module.exports = {
  OCRExtractor,
  OcrExtractor: OCRExtractor
};
