const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

class OfficeExtractor {
  constructor() {
    this.name = 'OfficeDocumentExtractor';
    this.supportedExtensions = new Set(['.docx', '.xlsx', '.pptx']);
  }

  isSupported(filePath, ext) {
    const fileExt = (ext || path.extname(filePath)).toLowerCase();
    return this.supportedExtensions.has(fileExt);
  }

  /**
   * Parse a ZIP buffer and extract text contents of named internal XML files
   */
  readZipEntries(buffer) {
    const entries = new Map();
    let offset = 0;

    while (offset < buffer.length - 4) {
      const signature = buffer.readUInt32LE(offset);
      if (signature !== 0x04034b50) { // 'PK\x03\x04'
        break;
      }

      const compressionMethod = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompressedSize = buffer.readUInt32LE(offset + 22);
      const filenameLength = buffer.readUInt16LE(offset + 26);
      const extraFieldLength = buffer.readUInt16LE(offset + 28);

      const filename = buffer.toString('utf8', offset + 30, offset + 30 + filenameLength);
      const dataStart = offset + 30 + filenameLength + extraFieldLength;
      const dataEnd = dataStart + compressedSize;

      if (dataEnd <= buffer.length) {
        const compressedData = buffer.subarray(dataStart, dataEnd);
        try {
          let decompressed;
          if (compressionMethod === 0) {
            decompressed = compressedData;
          } else if (compressionMethod === 8) {
            decompressed = zlib.inflateRawSync(compressedData);
          }
          if (decompressed) {
            entries.set(filename, decompressed.toString('utf8'));
          }
        } catch (e) {
          // Failed to decompress individual entry
        }
      }

      offset = dataEnd;
      // Skip data descriptor if bit 3 is set
      while (offset < buffer.length - 4 && buffer.readUInt32LE(offset) !== 0x04034b50 && buffer.readUInt32LE(offset) !== 0x02014b50) {
        offset++;
      }
    }

    return entries;
  }

  extractTextFromXML(xmlStr) {
    // Extract text inside XML tags while stripping XML elements
    return xmlStr
      .replace(/<w:p[^>]*>/gi, '\n')
      .replace(/<a:p[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n+/g, '\n\n')
      .trim();
  }

  async extract(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      throw new Error('Empty file (0 bytes).');
    }

    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) {
      return {
        status: 'corrupted',
        error: 'Invalid Office OpenXML file: Missing PK ZIP header.'
      };
    }

    const ext = path.extname(filePath).toLowerCase();
    const entries = this.readZipEntries(buffer);

    let extractedText = '';
    const headings = [];
    const sections = [];

    if (ext === '.docx') {
      const docXml = entries.get('word/document.xml');
      if (!docXml) {
        throw new Error('Invalid DOCX: missing word/document.xml');
      }
      extractedText = this.extractTextFromXML(docXml);
      headings.push({ level: 1, title: path.basename(filePath, ext) });
      sections.push({ heading: 'Document Body', text: extractedText });

    } else if (ext === '.xlsx') {
      // Collect shared strings
      const sharedStringsXml = entries.get('xl/sharedStrings.xml');
      const strings = [];
      if (sharedStringsXml) {
        const matches = sharedStringsXml.matchAll(/<t[^>]*>(.*?)<\/t>/gi);
        for (const m of matches) {
          strings.push(m[1].trim());
        }
      }
      extractedText = strings.join(' | ');
      headings.push({ level: 1, title: `Workbook: ${path.basename(filePath)}` });
      sections.push({ heading: 'Sheet Data', text: extractedText });

    } else if (ext === '.pptx') {
      const slideEntries = Array.from(entries.keys())
        .filter(k => k.startsWith('ppt/slides/slide') && k.endsWith('.xml'))
        .sort();

      const slideTexts = [];
      slideEntries.forEach((slideKey, idx) => {
        const slideXml = entries.get(slideKey);
        const slideText = this.extractTextFromXML(slideXml);
        if (slideText) {
          const slideHeading = `Slide ${idx + 1}`;
          headings.push({ level: 2, title: slideHeading });
          sections.push({ heading: slideHeading, text: slideText });
          slideTexts.push(`[${slideHeading}]\n${slideText}`);
        }
      });
      extractedText = slideTexts.join('\n\n');
    }

    return {
      status: 'success',
      text: extractedText,
      headings,
      sections: sections.length > 0 ? sections : [{ heading: 'Content', text: extractedText }],
      metadata: {
        fileType: ext,
        sizeBytes: stat.size,
        extractor: this.name,
        entriesFound: entries.size,
        empty: extractedText.trim().length === 0
      }
    };
  }
}

module.exports = {
  OfficeExtractor
};
