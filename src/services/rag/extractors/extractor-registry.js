const fs = require('fs');
const path = require('path');
const { TextExtractor } = require('./text-extractor');
const { OfficeExtractor } = require('./office-extractor');
const { PDFExtractor } = require('./pdf-extractor');
const { OCRExtractor } = require('./ocr-extractor');

class DocumentExtractorRegistry {
  constructor() {
    this.extractors = [
      new TextExtractor(),
      new OfficeExtractor(),
      new PDFExtractor(),
      new OCRExtractor()
    ];
  }

  detectFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!fs.existsSync(filePath)) {
      return { ext, type: 'unknown', accessible: false };
    }

    try {
      const buffer = Buffer.alloc(16);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 16, 0);
      fs.closeSync(fd);

      // Check magic headers
      if (buffer.toString('utf8', 0, 5) === '%PDF-') {
        return { ext: '.pdf', type: 'pdf', verified: true };
      }
      if (buffer.readUInt32LE(0) === 0x04034b50) {
        if (ext === '.docx' || ext === '.xlsx' || ext === '.pptx') {
          return { ext, type: 'office', verified: true };
        }
        return { ext: '.zip', type: 'zip', verified: true };
      }
      if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
        return { ext: '.png', type: 'image', verified: true };
      }
      if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return { ext: '.jpg', type: 'image', verified: true };
      }

      return { ext, type: 'text-or-code', verified: false };
    } catch (e) {
      return { ext, type: 'unknown', accessible: false, error: e.message };
    }
  }

  getExtractorFor(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    for (const extractor of this.extractors) {
      if (extractor.isSupported(filePath, ext)) {
        return extractor;
      }
    }
    return null;
  }

  isSupported(filePath) {
    return this.getExtractorFor(filePath) !== null;
  }

  isSupported(filePath) {
    return this.getExtractorFor(filePath) !== null;
  }

  getSupportedFormats() {
    return [
      { format: 'Plain Text & Logs', extensions: ['.txt', '.log'], extractor: 'TextAndCodeExtractor', status: 'native' },
      { format: 'Markdown', extensions: ['.md', '.markdown'], extractor: 'TextAndCodeExtractor', status: 'native' },
      { format: 'Structured Data', extensions: ['.json', '.csv', '.tsv', '.xml', '.yaml', '.yml'], extractor: 'TextAndCodeExtractor', status: 'native' },
      { format: 'Source Code & Web', extensions: ['.js', '.ts', '.py', '.c', '.cpp', '.rs', '.go', '.html', '.css', '.sql'], extractor: 'TextAndCodeExtractor', status: 'native' },
      { format: 'Adobe PDF', extensions: ['.pdf'], extractor: 'NativePDFExtractor', status: 'native', limitations: 'Scanned PDFs require local OCR' },
      { format: 'Microsoft Word', extensions: ['.docx'], extractor: 'OfficeDocumentExtractor', status: 'native' },
      { format: 'Microsoft Excel', extensions: ['.xlsx'], extractor: 'OfficeDocumentExtractor', status: 'native' },
      { format: 'Microsoft PowerPoint', extensions: ['.pptx'], extractor: 'OfficeDocumentExtractor', status: 'native' },
      { format: 'Images (OCR)', extensions: ['.png', '.jpg', '.jpeg', '.webp'], extractor: 'LocalOCRExtractor', status: 'optional-ocr', limitations: 'Requires Tesseract binary' }
    ];
  }

  sniffFileType(buffer, filename) {
    if (buffer && buffer.length >= 5 && buffer.slice(0, 5).toString('utf8') === '%PDF-') return 'pdf';
    if (buffer && buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image';
    if (buffer && buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) return 'office';
    const ext = path.extname(filename).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.webp'].includes(ext)) return 'image';
    if (['.pdf'].includes(ext)) return 'pdf';
    if (['.docx', '.xlsx', '.pptx'].includes(ext)) return 'office';
    if (['.md', '.markdown'].includes(ext)) return 'markdown';
    return 'text';
  }

  getRegisteredFormats() {
    return [
      { name: 'Plain Text & Logs', category: 'text', extensions: ['.txt', '.text', '.log'] },
      { name: 'Markdown Documentation', category: 'markdown', extensions: ['.md', '.markdown'] },
      { name: 'Source Code', category: 'code', extensions: ['.js', '.ts', '.py', '.go', '.rs', '.c', '.cpp', '.java', '.cs', '.sh'] },
      { name: 'CSV & Tabular Data', category: 'csv', extensions: ['.csv', '.tsv'] },
      { name: 'JSON & Structured Data', category: 'json', extensions: ['.json', '.jsonl'] },
      { name: 'XML & HTML', category: 'markup', extensions: ['.xml', '.html', '.htm'] },
      { name: 'PDF Documents', category: 'pdf', extensions: ['.pdf'] },
      { name: 'Word Documents (DOCX)', category: 'office', extensions: ['.docx'] },
      { name: 'Spreadsheets (XLSX)', category: 'office', extensions: ['.xlsx'] },
      { name: 'Presentations (PPTX)', category: 'office', extensions: ['.pptx'] },
      { name: 'Images & OCR', category: 'image', extensions: ['.png', '.jpg', '.jpeg', '.webp'] }
    ];
  }

  async extract(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const extractor = this.getExtractorFor(filePath);
    if (!extractor) {
      const ext = path.extname(filePath);
      throw new Error(`Unsupported file format '${ext}'. No local extractor available.`);
    }

    return extractor.extract(filePath, options);
  }
}

module.exports = {
  DocumentExtractorRegistry,
  ExtractorRegistry: DocumentExtractorRegistry
};
