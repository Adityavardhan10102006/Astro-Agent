const https = require('https');

class HuggingFaceDiscovery {
  constructor() {
    this.apiBase = 'https://huggingface.co/api/models';
  }

  fetchRepoInfo(repoId, token = null) {
    return new Promise((resolve, reject) => {
      const url = `${this.apiBase}/${repoId}`;
      const headers = {
        'User-Agent': 'ASTRO-Desktop-Assistant/0.1.0'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const req = https.get(url, { headers }, (res) => {
        if (res.statusCode === 401 || res.statusCode === 403) {
          return reject(new Error(`Access denied or authentication required for repository ${repoId} (HTTP ${res.statusCode}).`));
        }
        if (res.statusCode === 404) {
          return reject(new Error(`Repository ${repoId} was not found on Hugging Face.`));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Hugging Face API returned status ${res.statusCode}`));
        }

        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(new Error(`Failed to parse Hugging Face metadata: ${err.message}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Network error contacting Hugging Face: ${err.message}`));
      });
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Connection timed out contacting Hugging Face API'));
      });
    });
  }

  fetchTreeFiles(repoId, token = null) {
    return new Promise((resolve, reject) => {
      const url = `${this.apiBase}/${repoId}/tree/main`;
      const headers = {
        'User-Agent': 'ASTRO-Desktop-Assistant/0.1.0'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const req = https.get(url, { headers }, (res) => {
        if (res.statusCode !== 200) {
          return resolve([]); // Fallback
        }
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            resolve([]);
          }
        });
      });

      req.on('error', () => resolve([]));
      req.setTimeout(10000, () => {
        req.destroy();
        resolve([]);
      });
    });
  }

  async discoverModelVariants(repoId, token = null) {
    try {
      const [repoData, treeFiles] = await Promise.all([
        this.fetchRepoInfo(repoId, token),
        this.fetchTreeFiles(repoId, token)
      ]);

      const treeFileMap = new Map();
      for (const f of treeFiles) {
        if (f.path) {
          treeFileMap.set(f.path, f);
        }
      }

      const siblings = repoData.siblings || [];
      const ggufFilenames = siblings
        .map(s => s.rfilename)
        .filter(fn => fn.toLowerCase().endsWith('.gguf'));

      // If treeFiles had gguf files not in siblings, include them too
      for (const tf of treeFiles) {
        if (tf.path && tf.path.toLowerCase().endsWith('.gguf') && !ggufFilenames.includes(tf.path)) {
          ggufFilenames.push(tf.path);
        }
      }

      const variants = ggufFilenames.map(filename => {
        const treeInfo = treeFileMap.get(filename);
        let sizeBytes = 0;
        let sha256 = null;

        if (treeInfo) {
          sizeBytes = (treeInfo.lfs && treeInfo.lfs.size) ? treeInfo.lfs.size : (treeInfo.size || 0);
          sha256 = (treeInfo.lfs && treeInfo.lfs.oid) ? treeInfo.lfs.oid : null;
        }

        const sizeGB = Number((sizeBytes / (1024 ** 3)).toFixed(2));

        // Extract quant tag (e.g. Q4_K_M, Q5_K_M, Q8_0)
        const match = filename.match(/q[0-9]_[a-z0-9_]+/i) || filename.match(/q[0-9]+[a-z0-9_]*/i);
        const quantTag = match ? match[0].toUpperCase() : 'OTHER';

        return {
          filename,
          quantTag,
          sizeBytes,
          sizeGB,
          sha256,
          downloadUrl: `https://huggingface.co/${repoId}/resolve/main/${filename}`,
          isRecommended: quantTag === 'Q4_K_M'
        };
      });

      // Filter out split shards like 00001-of-00004 for clean UI unless requested
      const singleFileVariants = variants.filter(v => !v.filename.includes('-of-'));
      const activeVariants = singleFileVariants.length > 0 ? singleFileVariants : variants;

      // Sort variants so Q4_K_M is first / prioritized
      activeVariants.sort((a, b) => {
        if (a.isRecommended) return -1;
        if (b.isRecommended) return 1;
        return a.sizeBytes - b.sizeBytes;
      });

      return {
        repoId,
        author: repoData.author,
        lastModified: repoData.lastModified,
        sha: repoData.sha,
        license: repoData.cardData && repoData.cardData.license ? repoData.cardData.license : 'Apache-2.0',
        totalVariants: activeVariants.length,
        variants: activeVariants
      };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = {
  HuggingFaceDiscovery
};
