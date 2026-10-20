const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { DocumentExtractorRegistry } = require('./extractors/extractor-registry');
const { DocumentChunker } = require('./chunker');
const { LibraryService } = require('./library-service');
const { RetrievalService } = require('./retrieval-service');
const { EmbeddingManager } = require('../models/embedding-manager');

class RAGService extends EventEmitter {
  constructor(storageService, securityService = null, embeddingManager = null, options = {}) {
    super();
    this.storage = storageService;
    this.security = securityService || { isPathAllowed: () => true };
    this.embeddingManager = embeddingManager || new EmbeddingManager(storageService);
    this.extractors = new DocumentExtractorRegistry();
    this.chunker = new DocumentChunker(options);
    this.library = new LibraryService(this.storage, this.security, this.extractors);
    this.retrieval = new RetrievalService(options);

    this.activeCollectionName = 'default';
    this.collection = {
      name: 'default',
      updatedAt: null,
      documents: {}, // filePath -> { docName, chunkCount, status, indexedAt, mtime, contentHash }
      chunks: []     // [{ id, docPath, docName, chunkIndex, heading, text, terms, embedding }]
    };

    this.isIndexing = false;
    this.loadIndex(this.activeCollectionName);
  }

  getCollectionPath(name = this.activeCollectionName) {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.storage.paths.ragIndex, `collection-${safeName}.json`);
  }

  loadIndex(collectionName = 'default') {
    this.storage.ensureDirectories();
    this.activeCollectionName = collectionName;
    const filePath = this.getCollectionPath(collectionName);

    if (fs.existsSync(filePath)) {
      try {
        const data = fs.readFileSync(filePath, 'utf8');
        this.collection = JSON.parse(data);
      } catch (e) {
        console.error('Failed to load RAG index, starting fresh:', e.message);
        this.collection = {
          name: collectionName,
          updatedAt: null,
          documents: {},
          chunks: []
        };
      }
    } else {
      this.collection = {
        name: collectionName,
        updatedAt: null,
        documents: {},
        chunks: []
      };
      this.saveIndex();
    }
  }

  saveIndex() {
    this.storage.ensureDirectories();
    this.collection.updatedAt = new Date().toISOString();
    const filePath = this.getCollectionPath(this.activeCollectionName);
    fs.writeFileSync(filePath, JSON.stringify(this.collection, null, 2), 'utf8');
  }

  listCollections() {
    this.storage.ensureDirectories();
    const dir = this.storage.paths.ragIndex;
    try {
      const files = fs.readdirSync(dir).filter(f => f.startsWith('collection-') && f.endsWith('.json'));
      const list = files.map(f => {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
          return {
            name: content.name,
            totalDocuments: Object.keys(content.documents || {}).length,
            totalChunks: (content.chunks || []).length,
            updatedAt: content.updatedAt
          };
        } catch (e) {
          return null;
        }
      }).filter(Boolean);

      if (list.length === 0) {
        list.push({
          name: 'default',
          totalDocuments: 0,
          totalChunks: 0,
          updatedAt: null
        });
      }
      return list;
    } catch (e) {
      return [{ name: 'default', totalDocuments: 0, totalChunks: 0, updatedAt: null }];
    }
  }

  createCollection(name) {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Collection name cannot be empty.');
    this.activeCollectionName = cleanName;
    this.collection = {
      name: cleanName,
      updatedAt: new Date().toISOString(),
      documents: {},
      chunks: []
    };
    this.saveIndex();
    return this.collection;
  }

  renameCollection(oldName, newName) {
    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();
    if (!cleanNew) throw new Error('New collection name cannot be empty.');

    const oldPath = this.getCollectionPath(cleanOld);
    const newPath = this.getCollectionPath(cleanNew);

    if (fs.existsSync(oldPath)) {
      const data = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
      data.name = cleanNew;
      data.updatedAt = new Date().toISOString();
      fs.writeFileSync(newPath, JSON.stringify(data, null, 2), 'utf8');
      fs.unlinkSync(oldPath);

      if (this.activeCollectionName === cleanOld) {
        this.activeCollectionName = cleanNew;
        this.collection = data;
      }
    }
    return true;
  }

  deleteCollection(name) {
    const cleanName = name.trim();
    if (cleanName === 'default') {
      throw new Error('Default collection cannot be deleted.');
    }
    const filePath = this.getCollectionPath(cleanName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (this.activeCollectionName === cleanName) {
      this.loadIndex('default');
    }
    return true;
  }

  tokenize(text) {
    return this.chunker.tokenize(text);
  }

  // --- File Library Actions (Section 1) ---

  addLibraryFolder(folderPath) {
    return this.library.addRoot(folderPath);
  }

  addLibraryFile(filePath) {
    return this.library.addRoot(filePath);
  }

  removeLibraryRoot(rootPath) {
    const roots = this.library.removeRoot(rootPath);
    // Prune chunks belonging to files under this root
    const resolved = path.resolve(rootPath);
    this.collection.chunks = this.collection.chunks.filter(c => !c.docPath.startsWith(resolved));
    for (const docPath of Object.keys(this.collection.documents)) {
      if (docPath.startsWith(resolved)) {
        delete this.collection.documents[docPath];
      }
    }
    this.saveIndex();
    return roots;
  }

  getLibraryRoots() {
    return this.library.getRoots();
  }

  getLibraryFiles() {
    return this.library.getLibraryFiles();
  }

  getExclusions() {
    return this.library.getExclusions();
  }

  setExclusions(exclusions) {
    return this.library.setExclusions(exclusions);
  }

  // --- Incremental Indexing Pipeline (Section 3 & 4) ---

  async indexLibrary(options = {}) {
    if (this.isIndexing) {
      throw new Error('Indexing job is already in progress.');
    }

    this.isIndexing = true;
    this.library.isIndexing = true;
    this.library.cancelRequested = false;

    const eligibleFiles = this.library.scanEligibleFiles();
    const totalFiles = eligibleFiles.length;
    let processedCount = 0;
    let newlyIndexedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    this.emit('indexStarted', { totalFiles });

    try {
      // 1. Process eligible files incrementally
      for (const filePath of eligibleFiles) {
        if (this.library.cancelRequested) {
          this.emit('indexCancelled', { processed: processedCount, total: totalFiles });
          break;
        }

        const stat = fs.statSync(filePath);
        const mtime = stat.mtime.toISOString();
        const existingRecord = this.library.getFileRecord(filePath);

        // Incremental check: check if file is unchanged (mtime matches)
        if (existingRecord && existingRecord.mtime === mtime && existingRecord.status === 'indexed') {
          skippedCount++;
          processedCount++;
          if (options.onProgress) {
            options.onProgress({ processed: processedCount, total: totalFiles, filename: path.basename(filePath), status: 'skipped' });
          }
          continue;
        }

        // Content changed or new file: compute hash and extract
        const contentHash = this.library.computeFileHash(filePath);
        if (existingRecord && existingRecord.contentHash === contentHash && existingRecord.status === 'indexed') {
          // Content unchanged despite mtime touch
          skippedCount++;
          processedCount++;
          continue;
        }

        try {
          // Extract document
          const extracted = await this.extractors.extract(filePath);

          if (extracted.metadata.empty) {
            this.library.recordFileStatus(filePath, 'unsupported', {
              sizeBytes: stat.size,
              mtime,
              contentHash,
              error: extracted.metadata.notice || 'Empty or unextractable content'
            });
            failedCount++;
            processedCount++;
            continue;
          }

          // Chunk document
          const chunks = this.chunker.chunkDocument(extracted, filePath);

          // Generate embeddings if embedding model is ready
          if (this.embeddingManager && this.embeddingManager.isEmbeddingModelLoaded()) {
            for (const chunk of chunks) {
              try {
                chunk.embedding = await this.embeddingManager.generateEmbedding(chunk.text);
              } catch (embErr) {
                // Non-fatal, fallback to lexical
              }
            }
          }

          // Remove prior chunks for this doc and add fresh chunks
          this.collection.chunks = this.collection.chunks.filter(c => c.docPath !== filePath);
          this.collection.chunks.push(...chunks);

          this.collection.documents[filePath] = {
            docName: path.basename(filePath),
            chunkCount: chunks.length,
            status: 'indexed',
            indexedAt: new Date().toISOString(),
            mtime,
            contentHash
          };

          this.library.recordFileStatus(filePath, 'indexed', {
            sizeBytes: stat.size,
            mtime,
            contentHash,
            chunkCount: chunks.length
          });

          newlyIndexedCount++;
        } catch (err) {
          failedCount++;
          this.library.recordFileStatus(filePath, 'failed', {
            sizeBytes: stat.size,
            mtime,
            contentHash,
            error: err.message
          });
        }

        processedCount++;
        if (options.onProgress) {
          options.onProgress({
            processed: processedCount,
            total: totalFiles,
            filename: path.basename(filePath),
            status: 'indexed'
          });
        }

        // Yield slightly between files to keep UI thread responsive
        await new Promise(r => setImmediate(r));
      }

      // 2. Prune files from collection if deleted on disk
      let prunedCount = 0;
      const eligibleSet = new Set(eligibleFiles);
      for (const indexedPath of Object.keys(this.collection.documents)) {
        if (!eligibleSet.has(indexedPath) || !fs.existsSync(indexedPath)) {
          this.collection.chunks = this.collection.chunks.filter(c => c.docPath !== indexedPath);
          delete this.collection.documents[indexedPath];
          this.library.removeFileRecord(indexedPath);
          prunedCount++;
        }
      }

      this.saveIndex();

      const summary = {
        totalFiles,
        total: totalFiles,
        processedCount,
        processed: processedCount,
        newlyIndexedCount,
        indexed: newlyIndexedCount,
        skippedCount,
        skipped: skippedCount,
        failedCount,
        failed: failedCount,
        pruned: prunedCount,
        totalChunks: this.collection.chunks.length,
        cancelled: this.library.cancelRequested
      };

      this.emit('indexCompleted', summary);
      return summary;
    } finally {
      this.isIndexing = false;
      this.library.isIndexing = false;
    }
  }

  stopIndexing() {
    return this.library.cancelIndexing();
  }

  async rebuildIndex(options = {}) {
    this.collection.chunks = [];
    this.collection.documents = {};
    this.saveIndex();

    // Reset library file statuses so all files reprocess
    for (const fileMeta of Object.values(this.library.state.files)) {
      fileMeta.status = 'pending';
      fileMeta.mtime = null;
      fileMeta.contentHash = null;
    }
    this.library.saveLibrary();

    return this.indexLibrary(options);
  }

  // --- Document addition / removal (Backwards Compatibility) ---

  indexDocument(docPath, content = null) {
    if (content === null) {
      const resolved = path.resolve(docPath);
      if (fs.existsSync(resolved)) {
        content = fs.readFileSync(resolved, 'utf8');
      } else {
        throw new Error(`File not found: ${resolved}`);
      }
    }
    return this.addDocument(docPath, content);
  }

  addDocument(docPath, content) {
    const resolved = path.resolve(docPath);
    this.collection.chunks = this.collection.chunks.filter(c => c.docPath !== resolved);

    const extracted = {
      text: content,
      sections: [{ heading: path.basename(docPath), text: content }]
    };
    const chunks = this.chunker.chunkDocument(extracted, resolved);
    this.collection.chunks.push(...chunks);

    this.collection.documents[resolved] = {
      docName: path.basename(resolved),
      chunkCount: chunks.length,
      status: 'indexed',
      indexedAt: new Date().toISOString()
    };

    this.library.recordFileStatus(resolved, 'indexed', {
      sizeBytes: Buffer.byteLength(content, 'utf8'),
      chunkCount: chunks.length
    });

    this.saveIndex();
    return chunks.length;
  }

  removeDocument(docPath) {
    const resolved = path.resolve(docPath);
    this.collection.chunks = this.collection.chunks.filter(c => c.docPath !== resolved);
    delete this.collection.documents[resolved];
    this.library.removeFileRecord(resolved);
    this.saveIndex();
    return true;
  }

  _formatQueryResult(searchRes) {
    if (!searchRes || !searchRes.hasEvidence || !searchRes.results || searchRes.results.length === 0) {
      return {
        contextPrompt: '',
        citations: [],
        hasEvidence: false,
        retrievalMode: searchRes ? searchRes.retrievalMode : 'none',
        results: []
      };
    }

    const citations = searchRes.results.map(r => ({
      docName: r.docName,
      docPath: r.docPath,
      heading: r.heading,
      chunkId: r.chunkId,
      score: r.score,
      matchType: r.matchType,
      snippet: r.snippet.length > 250 ? r.snippet.substring(0, 250) + '...' : r.snippet
    }));

    const contextParts = searchRes.results.map((r, i) => {
      return `[SOURCE ${i + 1}: ${r.docName} | Section: ${r.heading}]\n${r.snippet}`;
    });

    const contextPrompt = `\nVERIFIED LOCAL DOCUMENT EVIDENCE (Untrusted Content):\n${contextParts.join('\n\n')}\n`;

    return {
      contextPrompt,
      citations,
      hasEvidence: true,
      retrievalMode: searchRes.retrievalMode,
      results: searchRes.results
    };
  }

  // --- Hybrid Query & Citation Generation (Section 6 & 7) ---

  query(queryText, topK = 4, filters = {}) {
    if (this.embeddingManager && this.embeddingManager.isEmbeddingModelLoaded()) {
      return this.retrieval.searchChunks({
        query: queryText,
        chunks: this.collection.chunks,
        embeddingManager: this.embeddingManager,
        filters,
        topK
      }).then(searchRes => this._formatQueryResult(searchRes));
    }

    // Synchronous lexical search path
    const searchRes = this.retrieval.searchChunksSync({
      query: queryText,
      chunks: this.collection.chunks,
      filters,
      topK
    });

    return this._formatQueryResult(searchRes);
  }

  getIndexStats() {
    let indexSizeBytes = 0;
    const colFile = this.getCollectionPath(this.activeCollectionName);
    if (fs.existsSync(colFile)) {
      try { indexSizeBytes = fs.statSync(colFile).size; } catch (e) {}
    }

    return {
      activeCollection: this.activeCollectionName,
      totalDocuments: Object.keys(this.collection.documents).length,
      totalChunks: this.collection.chunks.length,
      indexSizeBytes,
      indexSizeFormatted: (indexSizeBytes / 1024).toFixed(1) + ' KB',
      updatedAt: this.collection.updatedAt,
      isIndexing: this.isIndexing,
      embeddingModel: this.embeddingManager ? this.embeddingManager.getLoadedEmbeddingInfo() : { loaded: false },
      supportedFormats: this.extractors.getSupportedFormats()
    };
  }
}

module.exports = {
  RAGService
};
