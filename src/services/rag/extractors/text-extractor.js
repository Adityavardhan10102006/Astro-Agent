const fs = require('fs');
const path = require('path');

class TextExtractor {
  constructor(options = {}) {
    this.name = 'TextAndCodeExtractor';
    this.maxFileSizeBytes = options.maxFileSizeBytes || 20 * 1024 * 1024;
    this.supportedExtensions = new Set([
      '.txt', '.text', '.log', '.md', '.markdown',
      '.json', '.csv', '.tsv', '.xml', '.html', '.htm',
      '.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx',
      '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs',
      '.go', '.rs', '.php', '.rb', '.sh', '.bash', '.bat', '.ps1',
      '.sql', '.yaml', '.yml', '.toml', '.ini', '.env.example'
    ]);
  }

  isSupported(filePath, ext) {
    const fileExt = (ext || path.extname(filePath)).toLowerCase();
    return this.supportedExtensions.has(fileExt);
  }

  async extract(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
      return { status: 'error', error: `File not found: ${filePath}` };
    }

    const stat = fs.statSync(filePath);
    const maxLimit = options.maxFileSizeBytes || this.maxFileSizeBytes;
    if (stat.size > maxLimit) {
      return {
        status: 'error',
        error: `File size (${stat.size} bytes) exceeds maximum permitted size of ${maxLimit} bytes.`
      };
    }

    if (stat.size === 0) {
      return {
        status: 'empty',
        text: '',
        sections: [],
        headings: [],
        metadata: {
          fileType: path.extname(filePath).toLowerCase(),
          sizeBytes: 0,
          lineCount: 0,
          extractor: this.name,
          empty: true
        }
      };
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const ext = path.extname(filePath).toLowerCase();

    let normalizedText = raw;
    const headings = [];
    const sections = [];

    if (ext === '.md' || ext === '.markdown') {
      // Extract Markdown headings and sections
      const lines = raw.split('\n');
      let currentHeading = 'Document Root';
      let currentLines = [];

      for (const line of lines) {
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
          if (currentLines.length > 0) {
            sections.push({
              heading: currentHeading,
              text: currentLines.join('\n')
            });
            currentLines = [];
          }
          currentHeading = headingMatch[2].trim();
          headings.push({
            level: headingMatch[1].length,
            title: currentHeading
          });
        }
        currentLines.push(line);
      }
      if (currentLines.length > 0) {
        sections.push({
          heading: currentHeading,
          text: currentLines.join('\n')
        });
      }
    } else if (ext === '.json') {
      try {
        const parsed = JSON.parse(raw);
        normalizedText = JSON.stringify(parsed, null, 2);
      } catch (e) {
        // Leave raw if malformed JSON
      }
    } else if (ext === '.csv' || ext === '.tsv') {
      const sep = ext === '.tsv' ? '\t' : ',';
      const lines = raw.split('\n').filter(l => l.trim().length > 0);
      if (lines.length > 0) {
        headings.push({ level: 1, title: `Table Columns: ${lines[0].trim()}` });
        normalizedText = lines.map(line => line.split(sep).map(c => c.trim()).join(' | ')).join('\n');
      }
    } else if (ext === '.html' || ext === '.htm') {
      // Clean HTML tags while preserving readable content and headings
      const hMatches = raw.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi);
      for (const m of hMatches) {
        headings.push({
          level: parseInt(m[1], 10),
          title: m[2].replace(/<[^>]*>/g, '').trim()
        });
      }
      normalizedText = raw
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const format = (ext === '.md' || ext === '.markdown')
      ? 'markdown'
      : (['.js', '.mjs', '.cjs', '.ts', '.py', '.go', '.rs', '.c', '.cpp', '.java', '.cs', '.sh'].includes(ext)
        ? 'code'
        : (ext === '.csv' ? 'csv' : (ext === '.json' ? 'json' : 'text')));

    return {
      status: 'success',
      format,
      text: normalizedText,
      headings,
      sections: sections.length > 0 ? sections : [{ heading: 'Content', text: normalizedText }],
      metadata: {
        fileType: ext,
        sizeBytes: stat.size,
        lineCount: raw.split('\n').length,
        extractor: this.name,
        empty: false
      }
    };
  }
}

module.exports = {
  TextExtractor
};
