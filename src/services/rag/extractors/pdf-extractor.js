const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

class PDFExtractor {
  constructor() {
    this.name = 'NativePDFExtractor';
    this.supportedExtensions = new Set(['.pdf']);
  }

  isSupported(filePath, ext) {
    const fileExt = (ext || path.extname(filePath)).toLowerCase();
    return this.supportedExtensions.has(fileExt);
  }

  extractTextFromStream(streamBuffer) {
    const textChunks = [];
    const content = streamBuffer.toString('latin1');

    // Extract text inside BT ... ET blocks
    const btEtRegex = /BT[\s\S]*?ET/g;
    const blocks = content.match(btEtRegex) || [];

    for (const block of blocks) {
      // 1. Match simple (text) Tj
      const tjMatches = block.matchAll(/\((.*?)\)\s*Tj/g);
      for (const m of tjMatches) {
        textChunks.push(m[1]);
      }

      // 2. Match [(array) -10 (of) (text)] TJ
      const tjArrayMatches = block.matchAll(/\[(.*?)\]\s*TJ/g);
      for (const m of tjArrayMatches) {
        const innerStrings = m[1].matchAll(/\((.*?)\)/g);
        for (const s of innerStrings) {
          textChunks.push(s[1]);
        }
      }

      // 3. Match ' and " text operators
      const quoteMatches = block.matchAll(/\((.*?)\)\s*['"]/g);
      for (const m of quoteMatches) {
        textChunks.push(m[1]);
      }
    }

    // Clean escaped characters: \( \) \\ \r \n
    return textChunks
      .map(t => t
        .replace(/\\([\\()])/g, '$1')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, ' ')
      )
      .join(' ')
      .trim();
  }

  async extract(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
      return { status: 'error', error: `File not found: ${filePath}` };
    }

    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      return { status: 'empty', text: '', error: 'Empty PDF file (0 bytes).' };
    }

    const buffer = fs.readFileSync(filePath);
    const header = buffer.toString('utf8', 0, 8);
    if (!header.startsWith('%PDF-')) {
      return {
        status: 'corrupted',
        error: `Missing %PDF- header: Expected header '%PDF-', found '${header.slice(0, 5)}'.`
      };
    }

    const pdfString = buffer.toString('latin1');

    // Check encryption
    if (pdfString.includes('/Encrypt')) {
      return {
        status: 'encrypted',
        error: 'Encrypted PDF: Password-protected or encrypted PDF cannot be indexed without decryption credentials.'
      };
    }

    // Find all stream ... endstream blocks
    const extractedParagraphs = [];
    let streamIndex = 0;
    let searchPos = 0;

    while (true) {
      const streamStart = pdfString.indexOf('stream', searchPos);
      if (streamStart === -1) break;

      // Actual data begins after 'stream\r\n' or 'stream\n'
      let dataStart = streamStart + 6;
      if (pdfString.charCodeAt(dataStart) === 0x0D && pdfString.charCodeAt(dataStart + 1) === 0x0A) {
        dataStart += 2;
      } else if (pdfString.charCodeAt(dataStart) === 0x0A) {
        dataStart += 1;
      }

      const streamEnd = pdfString.indexOf('endstream', dataStart);
      if (streamEnd === -1) break;

      // Extract dictionary preceding the stream
      const dictStart = pdfString.lastIndexOf('<<', streamStart);
      const dict = dictStart !== -1 ? pdfString.substring(dictStart, streamStart) : '';

      const rawStream = buffer.subarray(dataStart, streamEnd);
      let streamData = null;

      if (dict.includes('/FlateDecode')) {
        try {
          streamData = zlib.inflateSync(rawStream);
        } catch (e) {
          try {
            streamData = zlib.inflateRawSync(rawStream);
          } catch (e2) {}
        }
      } else {
        streamData = rawStream;
      }

      if (streamData) {
        const text = this.extractTextFromStream(streamData);
        if (text && text.length > 0) {
          extractedParagraphs.push(text);
        }
      }

      searchPos = streamEnd + 9;
      streamIndex++;
    }

    const fullText = extractedParagraphs.join('\n\n').trim();

    if (fullText.length === 0) {
      return {
        text: '',
        headings: [],
        sections: [],
        metadata: {
          fileType: '.pdf',
          sizeBytes: stat.size,
          extractor: this.name,
          isScanned: true,
          notice: 'Scanned PDF: Document contains images without embedded text layer. Local OCR is required to extract text.',
          empty: true
        }
      };
    }

    return {
      status: 'success',
      text: fullText,
      headings: [{ level: 1, title: path.basename(filePath, '.pdf') }],
      sections: [{ heading: 'PDF Text Content', text: fullText }],
      metadata: {
        fileType: '.pdf',
        sizeBytes: stat.size,
        extractor: this.name,
        streamCount: streamIndex,
        isScanned: false,
        empty: false
      }
    };
  }
}

module.exports = {
  PDFExtractor,
  PdfExtractor: PDFExtractor
};
