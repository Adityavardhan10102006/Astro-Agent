const { EmbeddingManager } = require('../models/embedding-manager');

class RetrievalService {
  constructor(options = {}) {
    this.relevanceThreshold = options.relevanceThreshold || 0.05;
    this.semanticThreshold = options.semanticThreshold || 0.35;
  }

  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
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
        const tf = termMap.get(qTerm) / chunkTerms.length;
        score += tf * 10;
      }
    }

    const coverage = matchCount / queryTerms.length;
    return score * (1 + coverage * 2);
  }

  searchChunksSync({
    query,
    chunks = [],
    filters = {},
    topK = 4
  }) {
    if (!query || !query.trim() || chunks.length === 0) {
      return {
        results: [],
        totalMatches: 0,
        hasEvidence: false,
        retrievalMode: 'none'
      };
    }

    const queryTerms = this.tokenize(query);

    let eligibleChunks = chunks;
    if (filters.folder) {
      eligibleChunks = eligibleChunks.filter(c => c.docPath.startsWith(filters.folder));
    }
    if (filters.fileType) {
      const ft = filters.fileType.toLowerCase().replace(/^\./, '');
      eligibleChunks = eligibleChunks.filter(c => {
        const cft = (c.fileType || '').toLowerCase().replace(/^\./, '');
        return cft === ft ||
          (ft === 'javascript' && (cft === 'js' || cft === 'mjs')) ||
          (ft === 'typescript' && (cft === 'ts' || cft === 'tsx')) ||
          (ft === 'python' && cft === 'py') ||
          (ft === 'markdown' && (cft === 'md' || cft === 'markdown'));
      });
    }
    if (filters.selectedSources && filters.selectedSources.length > 0) {
      const allowedSet = new Set(filters.selectedSources.map(s => s.toLowerCase()));
      eligibleChunks = eligibleChunks.filter(c => allowedSet.has(c.docPath.toLowerCase()) || allowedSet.has(c.docName.toLowerCase()));
    }

    if (eligibleChunks.length === 0) {
      return {
        results: [],
        totalMatches: 0,
        hasEvidence: false,
        retrievalMode: 'filtered-empty'
      };
    }

    const lexicalScored = [];
    for (const chunk of eligibleChunks) {
      const score = this.calculateTFIDFScore(queryTerms, chunk.terms || []);
      if (score >= this.relevanceThreshold) {
        lexicalScored.push({ chunk, score });
      }
    }
    lexicalScored.sort((a, b) => b.score - a.score);

    const seenDocs = new Map();
    const deduplicated = [];

    for (const item of lexicalScored) {
      const docPath = item.chunk.docPath;
      const count = seenDocs.get(docPath) || 0;
      if (count < 2) {
        seenDocs.set(docPath, count + 1);
        deduplicated.push({
          chunkId: item.chunk.id,
          docPath: item.chunk.docPath,
          docName: item.chunk.docName,
          heading: item.chunk.heading,
          snippet: item.chunk.text,
          score: Math.round(item.score * 100) / 100,
          matchType: 'lexical',
          fileType: item.chunk.fileType
        });
      }
      if (deduplicated.length >= topK) break;
    }

    return {
      results: deduplicated,
      totalMatches: lexicalScored.length,
      hasEvidence: deduplicated.length > 0,
      retrievalMode: 'lexical'
    };
  }

  async searchChunks({
    query,
    chunks = [],
    embeddingManager = null,
    filters = {},
    topK = 4
  }) {
    if (!query || !query.trim() || chunks.length === 0) {
      return {
        results: [],
        totalMatches: 0,
        hasEvidence: false,
        retrievalMode: 'none'
      };
    }

    const queryTerms = this.tokenize(query);

    // 1. Apply metadata filters
    let eligibleChunks = chunks;
    if (filters.folder) {
      eligibleChunks = eligibleChunks.filter(c => c.docPath.startsWith(filters.folder));
    }
    if (filters.fileType) {
      const ft = filters.fileType.toLowerCase().replace(/^\./, '');
      eligibleChunks = eligibleChunks.filter(c => {
        const cft = (c.fileType || '').toLowerCase().replace(/^\./, '');
        return cft === ft ||
          (ft === 'javascript' && (cft === 'js' || cft === 'mjs')) ||
          (ft === 'typescript' && (cft === 'ts' || cft === 'tsx')) ||
          (ft === 'python' && cft === 'py') ||
          (ft === 'markdown' && (cft === 'md' || cft === 'markdown'));
      });
    }
    if (filters.selectedSources && filters.selectedSources.length > 0) {
      const allowedSet = new Set(filters.selectedSources.map(s => s.toLowerCase()));
      eligibleChunks = eligibleChunks.filter(c => allowedSet.has(c.docPath.toLowerCase()) || allowedSet.has(c.docName.toLowerCase()));
    }

    if (eligibleChunks.length === 0) {
      return {
        results: [],
        totalMatches: 0,
        hasEvidence: false,
        retrievalMode: 'filtered-empty'
      };
    }

    // If no embedding model loaded, run synchronous lexical search directly
    if (!embeddingManager || !embeddingManager.isEmbeddingModelLoaded()) {
      return this.searchChunksSync({ query, chunks: eligibleChunks, filters, topK });
    }

    // 2. Lexical scoring (BM25 / TF-IDF)
    const lexicalScored = [];
    for (const chunk of eligibleChunks) {
      const score = this.calculateTFIDFScore(queryTerms, chunk.terms || []);
      if (score >= this.relevanceThreshold) {
        lexicalScored.push({ chunk, score });
      }
    }
    lexicalScored.sort((a, b) => b.score - a.score);

    // 3. Semantic scoring if embedding model is ready
    let semanticScored = [];
    let queryEmbedding = null;
    let isSemanticActive = false;

    if (embeddingManager && embeddingManager.isEmbeddingModelLoaded()) {
      try {
        queryEmbedding = await embeddingManager.generateEmbedding(query);
        if (queryEmbedding) {
          isSemanticActive = true;
          for (const chunk of eligibleChunks) {
            if (chunk.embedding) {
              const sim = EmbeddingManager.calculateCosineSimilarity(queryEmbedding, chunk.embedding);
              if (sim >= this.semanticThreshold) {
                semanticScored.push({ chunk, score: sim });
              }
            }
          }
          semanticScored.sort((a, b) => b.score - a.score);
        }
      } catch (e) {
        // Semantic scoring error, fallback to lexical
      }
    }

    // 4. Hybrid Reciprocal Rank Fusion (RRF)
    const rrfMap = new Map();
    const RRF_K = 60;

    lexicalScored.forEach((item, rank) => {
      const chunkId = item.chunk.id;
      const rrfScore = 1.0 / (RRF_K + rank + 1);
      rrfMap.set(chunkId, {
        chunk: item.chunk,
        rrfScore,
        lexicalScore: item.score,
        semanticScore: 0,
        matchType: 'lexical'
      });
    });

    semanticScored.forEach((item, rank) => {
      const chunkId = item.chunk.id;
      const rrfScore = 1.0 / (RRF_K + rank + 1);
      if (rrfMap.has(chunkId)) {
        const existing = rrfMap.get(chunkId);
        existing.rrfScore += rrfScore;
        existing.semanticScore = item.score;
        existing.matchType = 'hybrid';
      } else {
        rrfMap.set(chunkId, {
          chunk: item.chunk,
          rrfScore,
          lexicalScore: 0,
          semanticScore: item.score,
          matchType: 'semantic'
        });
      }
    });

    const ranked = Array.from(rrfMap.values());
    ranked.sort((a, b) => b.rrfScore - a.rrfScore);

    // 5. Deduplication of adjacent chunks from same document
    const seenDocs = new Map();
    const deduplicated = [];

    for (const item of ranked) {
      const docPath = item.chunk.docPath;
      const count = seenDocs.get(docPath) || 0;
      if (count < 2) { // Max 2 chunks per doc to maximize diversity
        seenDocs.set(docPath, count + 1);
        deduplicated.push(item);
      }
      if (deduplicated.length >= topK) break;
    }

    const finalResults = deduplicated.map(d => ({
      chunkId: d.chunk.id,
      docId: d.chunk.docId,
      docPath: d.chunk.docPath,
      docName: d.chunk.docName,
      fileType: d.chunk.fileType,
      heading: d.chunk.heading || 'Section',
      snippet: d.chunk.text,
      score: Number(d.rrfScore.toFixed(4)),
      matchType: d.matchType
    }));

    return {
      results: finalResults,
      totalMatches: finalResults.length,
      hasEvidence: finalResults.length > 0,
      retrievalMode: isSemanticActive ? 'hybrid-rrf' : 'lexical-tfidf'
    };
  }
}

module.exports = {
  RetrievalService
};
