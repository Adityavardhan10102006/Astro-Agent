const fs = require('fs');
const path = require('path');

class AssistantCoordinator {
  constructor(storageService, inferenceManager, ragService) {
    this.storage = storageService;
    this.inference = inferenceManager;
    this.rag = ragService;
    this.currentConversationId = null;
    this.history = [];
  }

  startNewConversation() {
    this.currentConversationId = `conv_${Date.now()}`;
    this.history = [];
    return this.currentConversationId;
  }

  getConversationsList() {
    const convDir = this.storage.paths.conversations;
    if (!fs.existsSync(convDir)) return [];
    try {
      const files = fs.readdirSync(convDir).filter(f => f.endsWith('.json'));
      return files.map(file => {
        try {
          const content = JSON.parse(fs.readFileSync(path.join(convDir, file), 'utf8'));
          return {
            id: content.id,
            title: content.title || 'Untitled Conversation',
            updatedAt: content.updatedAt,
            messageCount: (content.messages || []).length
          };
        } catch (e) {
          return null;
        }
      }).filter(Boolean).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch (e) {
      return [];
    }
  }

  saveConversation(title = 'Conversation') {
    if (!this.currentConversationId) {
      this.currentConversationId = `conv_${Date.now()}`;
    }
    const convFile = path.join(this.storage.paths.conversations, `${this.currentConversationId}.json`);
    const data = {
      id: this.currentConversationId,
      title,
      updatedAt: new Date().toISOString(),
      messages: this.history
    };
    fs.writeFileSync(convFile, JSON.stringify(data, null, 2), 'utf8');
  }

  async handleUserMessage({ message, useRAG = true, onToken = null }) {
    if (!this.inference.isModelLoaded()) {
      throw new Error('No local model is currently loaded. Go to Model Manager to load Qwen.');
    }

    // 1. RAG retrieval if enabled
    let ragContext = '';
    let citations = [];
    if (useRAG) {
      const ragResult = this.rag.query(message, 3);
      ragContext = ragResult.contextPrompt;
      citations = ragResult.citations;
    }

    // 2. Build full prompt
    let systemPrompt = "You are ASTRO, an offline-first native desktop AI assistant and coding expert running locally on the user's laptop. Provide concise, accurate code and answers.";
    if (ragContext) {
      systemPrompt += `\nUse the following local verified documents as primary reference:\n${ragContext}`;
    }

    // Record user message
    this.history.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    });

    // 3. Inference call
    const result = await this.inference.generate({
      prompt: message,
      systemPrompt,
      onToken
    });

    // Record assistant response
    this.history.push({
      role: 'assistant',
      content: result.text,
      citations,
      stats: {
        tokenCount: result.tokenCount,
        tokensPerSecond: result.tokensPerSecond,
        elapsedMs: result.elapsedMs
      },
      timestamp: new Date().toISOString()
    });

    // Auto-save conversation
    const titleSnippet = message.slice(0, 30).trim() + (message.length > 30 ? '...' : '');
    this.saveConversation(titleSnippet);

    return {
      text: result.text,
      citations,
      stats: {
        tokenCount: result.tokenCount,
        tokensPerSecond: result.tokensPerSecond,
        elapsedMs: result.elapsedMs
      }
    };
  }
}

module.exports = {
  AssistantCoordinator
};
