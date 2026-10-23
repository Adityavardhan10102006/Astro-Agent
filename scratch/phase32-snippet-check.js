/**
 * Phase 32 — RAG snippet depth check
 * Verifies the full snippet content (not just the first 120 chars)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { StorageService } = require('../src/services/storage/storage-service');
const { RAGService } = require('../src/services/rag/rag-service');
const { EmbeddingManager } = require('../src/services/models/embedding-manager');

const TEST_DIR = path.join(os.tmpdir(), 'astro-p32-snippet-' + Date.now());

async function run() {
  fs.mkdirSync(TEST_DIR, { recursive: true });
  const storage = new StorageService(TEST_DIR);
  storage.ensureDirectories();
  const rag = new RAGService(storage, null, new EmbeddingManager(storage));

  const docPath = path.join(TEST_DIR, 'test.md');
  const content = `# ASTRO RAG Test Document

## Section: Project Funding
The ASTRO project received initial funding of exactly $42,000 from the
Epsilon Foundation in March 2026.

## Section: Team Members
The core development team consists of three engineers:
- Dr. Aria Chen (lead architect)
- Marcus Thompson (inference optimization)
- Priya Sharma (RAG pipeline and retrieval)

## Section: Hardware Requirements
The minimum hardware specification is an AMD Ryzen 5 5500U processor
with 16 GB of DDR4 RAM and at least 20 GB of free NVMe storage.
`;

  fs.writeFileSync(docPath, content, 'utf8');
  const chunks = rag.addDocument(docPath, content);
  console.log('Chunks created:', chunks);

  // Check what the chunker actually produced
  const col = rag.collection;
  console.log('Total chunks in collection:', col.chunks.length);
  col.chunks.forEach((c, i) => {
    console.log(`\nChunk ${i}:`);
    console.log('  heading:', c.heading);
    console.log('  wordCount:', c.wordCount);
    console.log('  text length:', c.text.length);
    console.log('  text preview (first 200):', c.text.slice(0, 200));
    console.log('  contains "aria":', c.text.toLowerCase().includes('aria'));
    console.log('  contains "ryzen":', c.text.toLowerCase().includes('ryzen'));
  });

  const teamResult = await rag.query('Who is on the team?', 4);
  console.log('\nTeam query result:');
  if (teamResult.citations && teamResult.citations.length > 0) {
    const snippet = teamResult.citations[0].snippet;
    console.log('  Full snippet length:', snippet.length);
    console.log('  Contains "aria":', snippet.toLowerCase().includes('aria'));
    console.log('  Contains "ryzen":', snippet.toLowerCase().includes('ryzen'));
  }

  try { fs.rmSync(TEST_DIR, { recursive: true, force: true }); } catch (e) {}
}

run().catch(err => { console.error(err); process.exit(1); });
