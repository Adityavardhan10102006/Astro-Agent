const https = require('https');
const EventEmitter = require('events');

class ResearchService extends EventEmitter {
  constructor(storageService, ragService) {
    super();
    this.storage = storageService;
    this.rag = ragService;
    this.activeSearchAbort = null;
  }

  isOnlineResearchAllowed() {
    const settings = this.storage.getSettings();
    return settings.privacy.allowExternalServices && !settings.privacy.offlineOnly;
  }

  cancelActiveSearch() {
    if (this.activeSearchAbort) {
      this.activeSearchAbort.abort();
      this.activeSearchAbort = null;
      this.emit('searchCancelled');
      return true;
    }
    return false;
  }

  async performResearch({ query, allowOnline = false, maxLocal = 4, maxWeb = 3 }) {
    if (!query || query.trim().length === 0) {
      throw new Error('Query string cannot be empty.');
    }

    const trimmedQuery = query.trim();
    const results = {
      query: trimmedQuery,
      timestamp: new Date().toISOString(),
      localSources: [],
      webSources: [],
      onlineAllowed: this.isOnlineResearchAllowed() && allowOnline,
      notice: null
    };

    // 1. Local-first search via RAG
    if (this.rag) {
      const ragResults = this.rag.query(trimmedQuery, maxLocal);
      results.localSources = ragResults.citations.map(c => ({
        type: 'local',
        title: c.docName,
        path: c.docPath,
        score: c.score,
        snippet: c.snippet
      }));
    }

    // 2. Check if online search was requested
    if (!allowOnline) {
      results.notice = 'Online research was not requested. Displaying local workspace results only.';
      return results;
    }

    const settings = this.storage.getSettings();
    if (settings.privacy.offlineOnly || !settings.privacy.allowExternalServices) {
      results.notice = 'Online research is blocked by privacy settings (Offline-First mode is enforced). To perform web queries, enable external services in Settings (Rule 2 & Rule 4).';
      return results;
    }

    // 3. Genuine web search query (e.g. Wikipedia API as a trusted public encyclopedia or DuckDuckGo)
    this.activeSearchAbort = new AbortController();
    try {
      const webResults = await this._queryPublicKnowledge(trimmedQuery, this.activeSearchAbort.signal, maxWeb);
      results.webSources = webResults;
    } catch (err) {
      if (err.name === 'AbortError') {
        results.notice = 'Research query was cancelled by the user.';
      } else {
        results.notice = `Internet research query failed: ${err.message}. Showing local documents only.`;
      }
    } finally {
      this.activeSearchAbort = null;
    }

    return results;
  }

  _queryPublicKnowledge(query, signal, maxResults = 3) {
    return new Promise((resolve, reject) => {
      const encoded = encodeURIComponent(query);
      const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=${maxResults}&namespace=0&format=json`;

      const req = https.get(url, {
        headers: { 'User-Agent': 'ASTRO-Desktop-Assistant/0.1.0' },
        signal
      }, (res) => {
        if (res.statusCode !== 200) {
          return resolve([]);
        }

        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            // OpenSearch format: [query, [titles], [descriptions], [urls]]
            const titles = data[1] || [];
            const descriptions = data[2] || [];
            const urls = data[3] || [];

            const formatted = titles.map((title, i) => ({
              type: 'web',
              title,
              snippet: descriptions[i] || 'No summary available.',
              url: urls[i] || '',
              sourceDomain: 'wikipedia.org',
              retrievedAt: new Date().toISOString()
            })).filter(item => item.title && item.url);

            resolve(formatted);
          } catch (e) {
            resolve([]);
          }
        });
      });

      req.on('error', (err) => {
        if (signal.aborted) {
          const abortErr = new Error('Search cancelled');
          abortErr.name = 'AbortError';
          reject(abortErr);
        } else {
          reject(err);
        }
      });
    });
  }

  saveFindingToLibrary(finding, collectionName = 'default') {
    if (!this.rag) {
      throw new Error('RAG service unavailable for saving research findings.');
    }
    const title = finding.title || 'Web Research Finding';
    const content = `# ${title}\nSource: ${finding.url || 'Web Search'}\nDomain: ${finding.sourceDomain || 'Internet'}\nDate: ${finding.retrievedAt || new Date().toISOString()}\n\n${finding.snippet || finding.content || ''}`;
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const virtualDocPath = `research://${finding.sourceDomain || 'web'}/${safeTitle}.md`;

    this.rag.addDocument(virtualDocPath, content);
    return {
      saved: true,
      virtualDocPath,
      title,
      collection: collectionName
    };
  }
}

module.exports = {
  ResearchService
};
