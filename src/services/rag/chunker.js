const path = require('path');
const crypto = require('crypto');

class DocumentChunker {
  constructor(options = {}) {
    this.defaultChunkSizeWords = options.chunkSizeWords || 350;
    this.defaultOverlapWords = options.overlapWords || 50;
  }

  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  chunkDocument(extracted, docPath, options = {}) {
    const chunkSize = options.chunkSizeWords || this.defaultChunkSizeWords;
    const overlap = options.overlapWords || this.defaultOverlapWords;

    const docName = path.basename(docPath);
    const docId = crypto.createHash('sha256').update(docPath).digest('hex').substring(0, 16);
    const ext = path.extname(docPath).toLowerCase();

    const sections = extracted.sections || [{ heading: 'Document Root', text: extracted.text || '' }];
    const chunks = [];
    let chunkCounter = 0;
    let charOffsetAccumulator = 0;

    for (let secIdx = 0; secIdx < sections.length; secIdx++) {
      const section = sections[secIdx];
      const heading = section.heading || 'General';
      const sectionText = section.text || '';

      if (!sectionText.trim()) continue;

      // Split section by paragraphs or lines (preserving code / table boundaries)
      let units;
      if (ext === '.csv' || ext === '.tsv') {
        units = sectionText.split('\n'); // Line-by-line for tables
      } else {
        units = sectionText.split(/\n\s*\n/); // Paragraph-by-paragraph
      }

      let currentWords = [];
      let currentUnitStart = charOffsetAccumulator;

      for (const unit of units) {
        const words = unit.trim().split(/\s+/).filter(Boolean);
        if (words.length === 0) continue;

        if (currentWords.length + words.length <= chunkSize) {
          currentWords.push(...words);
        } else {
          if (currentWords.length > 0) {
            const chunkText = currentWords.join(' ');
            const chunkId = `${docId}_chunk_${chunkCounter++}`;
            chunks.push({
              id: chunkId,
              docId,
              docPath,
              docName,
              fileType: ext,
              heading,
              sectionIndex: secIdx,
              chunkIndex: chunkCounter - 1,
              charStart: currentUnitStart,
              charEnd: currentUnitStart + chunkText.length,
              text: chunkText,
              terms: this.tokenize(chunkText),
              wordCount: currentWords.length,
              timestamp: new Date().toISOString()
            });

            // Slide window by overlap
            currentWords = currentWords.slice(-overlap);
            currentUnitStart += (chunkText.length - (currentWords.join(' ').length));
          }
          currentWords.push(...words);
        }
      }

      if (currentWords.length > 0) {
        const chunkText = currentWords.join(' ');
        const chunkId = `${docId}_chunk_${chunkCounter++}`;
        chunks.push({
          id: chunkId,
          docId,
          docPath,
          docName,
          fileType: ext,
          heading,
          sectionIndex: secIdx,
          chunkIndex: chunkCounter - 1,
          charStart: currentUnitStart,
          charEnd: currentUnitStart + chunkText.length,
          text: chunkText,
          terms: this.tokenize(chunkText),
          wordCount: currentWords.length,
          timestamp: new Date().toISOString()
        });
      }

      charOffsetAccumulator += sectionText.length;
    }

    return chunks;
  }
}

module.exports = {
  DocumentChunker
};
