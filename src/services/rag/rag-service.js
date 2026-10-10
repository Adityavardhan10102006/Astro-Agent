const fs = require('fs');
const path = require('path');

class RAGService {
  constructor(storageService, options = {}) {
    this.storage = storageService;
    this.chunkSize = options.chunkSize || 400; // approximate words
    this.chunkOverlap = options.chunkOverlap || 60;
    this.indexPath = path.join(this.storage.paths.ragIndex, 'default-collection.json');
    this.collection = {
      name: 'default',
      updatedAt: null,
      documents: {}, // filePath -> { hash, mtime, chunkCount }
      chunks: []     // [{ id, docPath, docName, chunkIndex, text, terms }]
    };
    this.loadIndex();
  }

  loadIndex() {
    this.storage.ensureDirectories();
    if (fs.existsSync(this.indexPath)) {
      try {
        const data = fs.readFileSync(this.indexPath, 'utf8');
        this.collection = JSON.parse(data);
      } catch (e) {
        console.error('Failed to load RAG index, starting fresh:', e.message);
      }
    }
  }

  saveIndex() {
    this.storage.ensureDirectories();
    this.collection.updatedAt = new Date().toISOString();
    fs.writeFileSync(this.indexPath, JSON.stringify(this.collection, null, 2), 'utf8');
  }

  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  createChunks(text, docPath) {
    const docName = path.basename(docPath);
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let currentWords = [];
    let chunkIndex = 0;

    for (const para of paragraphs) {
      const words = para.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;

      if (currentWords.length + words.length <= this.chunkSize) {
        currentWords.push(...words);
      } else {
        if (currentWords.length > 0) {
          const chunkText = currentWords.join(' ');
          chunks.push({
            id: `${docName}_chunk_${chunkIndex++}`,
            docPath,
            docName,
            chunkIndex: chunkIndex - 1,
            text: chunkText,
            terms: this.tokenize(chunkText)
          });
          // Retain overlap
          currentWords = currentWords.slice(-this.chunkOverlap);
        }
        currentWords.push(...words);
      }
    }

    if (currentWords.length > 0) {
      const chunkText = currentWords.join(' ');
      chunks.push({
        id: `${docName}_chunk_${chunkIndex++}`,
        docPath,
        docName,
        chunkIndex: chunkIndex - 1,
        text: chunkText,
        terms: this.tokenize(chunkText)
      });
    }

    return chunks;
  }

  addDocument(docPath, content) {
    // Remove existing chunks for this document
    this.collection.chunks = this.collection.chunks.filter(c => c.docPath !== docPath);

    const chunks = this.createChunks(content, docPath);
    this.collection.chunks.push(...chunks);
    this.collection.documents[docPath] = {
      docName: path.basename(docPath),
      chunkCount: chunks.length,
      indexedAt: new Date().toISOString()
    };

    this.saveIndex();
    return chunks.length;
  }

  removeDocument(docPath) {
    this.collection.chunks = this.collection.chunks.filter(c => c.docPath !== docPath);
    delete this.collection.documents[docPath];
    this.saveIndex();
  }

  calculateTFIDFScore(queryTerms, chunkTerms) {
    if (queryTerms.length === 0 || chunkTerms.length === 0) return 0;
    const termMap = new Map();
    for (const term of chunkTerms) {
      termMap.set(term, (termMap.get(term) || 0) + 1);
    }

    let matchCount = 0;
    let score = 0;

    for (const qTerm of queryTerms) {
      if (termMap.has(qTerm)) {
        matchCount++;
        // TF weighting
        const tf = termMap.get(qTerm) / chunkTerms.length;
        score += tf * 10;
      }
    }

    const coverage = matchCount / queryTerms.length;
    return score * (1 + coverage * 2);
  }

  query(queryText, topK = 4) {
    const queryTerms = this.tokenize(queryText);
    if (queryTerms.length === 0 || this.collection.chunks.length === 0) {
      return {
        contextPrompt: '',
        citations: []
      };
    }

    const scored = this.collection.chunks.map(chunk => {
      const score = this.calculateTFIDFScore(queryTerms, chunk.terms);
      return {
        ...chunk,
        score
      };
    }).filter(c => c.score > 0);

    scored.sort((a, b) => b.score - a.score);
    const topChunks = scored.slice(0, topK);

    if (topChunks.length === 0) {
      return {
        contextPrompt: '',
        citations: []
      };
    }

    const citations = topChunks.map(c => ({
      docName: c.docName,
      docPath: c.docPath,
      chunkIndex: c.chunkIndex,
      score: Number(c.score.toFixed(3)),
      snippet: c.text.length > 250 ? c.text.substring(0, 250) + '...' : c.text
    }));

    const contextParts = topChunks.map((c, i) => {
      return `[DOCUMENT SOURCE ${i + 1}: ${c.docName}]\n${c.text}`;
    });

    const contextPrompt = `\nRELEVANT LOCAL KNOWLEDGE BASE CONTEXT:\n${contextParts.join('\n\n')}\n`;

    return {
      contextPrompt,
      citations
    };
  }

  getIndexStats() {
    return {
      totalDocuments: Object.keys(this.collection.documents).length,
      totalChunks: this.collection.chunks.length,
      updatedAt: this.collection.updatedAt,
      documents: this.collection.documents
    };
  }
}

module.exports = {
  RAGService
};
