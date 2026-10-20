const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class VoiceService extends EventEmitter {
  constructor(storageService) {
    super();
    this.storage = storageService;

    // States: 'idle' | 'requesting_permission' | 'listening' | 'processing' | 'speaking' | 'interrupted' | 'error'
    this.state = 'idle';
    this.isListening = false;
    this.isSpeaking = false;
    this.permissionStatus = 'granted'; // Desktop OS permission status
    this.transcriptionBuffer = '';
    this.ttsEnabled = false;

    // Voice preferences
    this.speechRate = 1.0;
    this.preferredVoice = 'default';
    this.wakeWordEnabled = false; // Rule: wake-word disabled by default
    this.wakeWord = 'hey astro';
    this.pushToTalk = true;
    this.autoSpeakResponses = false;

    // Speech Queue
    this.speechQueue = [];
    this.currentUtterance = null;
    this.isInterrupted = false;
  }

  getEngineStatus() {
    this.storage.ensureDirectories();
    const whisperDir = path.join(this.storage.paths.models, 'whisper');
    const hasLocalWhisper = fs.existsSync(whisperDir) && fs.readdirSync(whisperDir).some(f => f.endsWith('.gguf') || f.endsWith('.bin'));

    return {
      state: this.state,
      isListening: this.isListening,
      isSpeaking: this.isSpeaking,
      permissionStatus: this.permissionStatus,
      ttsEnabled: this.ttsEnabled,
      sttAvailable: hasLocalWhisper,
      sttEngine: hasLocalWhisper ? 'Local Whisper GGUF' : 'Unconfigured',
      missingComponents: hasLocalWhisper ? [] : [
        'Local speech recognition model (whisper-base.gguf) not installed.'
      ],
      recommendation: hasLocalWhisper 
        ? 'Engine ready for offline speech input' 
        : 'Install Whisper GGUF in Model Manager or enter prompts via text.',
      wakeWordEnabled: this.wakeWordEnabled,
      speechRate: this.speechRate,
      preferredVoice: this.preferredVoice,
      pushToTalk: this.pushToTalk,
      autoSpeakResponses: this.autoSpeakResponses
    };
  }

  setPermissionStatus(status) {
    this.permissionStatus = status;
    if (status === 'denied') {
      this.state = 'error';
      this.isListening = false;
    }
    this.emit('permissionChanged', { permissionStatus: this.permissionStatus });
    return this.permissionStatus;
  }

  startListening(options = {}) {
    if (this.permissionStatus === 'denied') {
      this.state = 'error';
      throw new Error('Microphone permission denied by operating system. Enable microphone access in desktop settings.');
    }

    const status = this.getEngineStatus();
    if (!status.sttAvailable && !options.allowBrowserStt) {
      this.state = 'error';
      throw new Error('Cannot start listening: Local speech recognition model (Whisper GGUF) is not installed. To maintain Rule 2 (offline-first & private), ASTRO does not send audio to cloud transcription services.');
    }

    this.state = 'listening';
    this.isListening = true;
    this.isInterrupted = false;
    this.transcriptionBuffer = '';
    this.emit('listeningStateChanged', { isListening: true, state: this.state });
    return { success: true, isListening: true, state: this.state };
  }

  stopListening() {
    if (!this.isListening) {
      return { isListening: false, state: this.state };
    }
    this.isListening = false;
    this.state = this.transcriptionBuffer ? 'processing' : 'idle';
    const finalTranscript = this.transcriptionBuffer.trim();
    this.emit('listeningStateChanged', {
      isListening: false,
      state: this.state,
      transcription: finalTranscript
    });
    return {
      success: true,
      isListening: false,
      state: this.state,
      transcription: finalTranscript
    };
  }

  cancelListening() {
    this.isListening = false;
    this.state = 'idle';
    this.transcriptionBuffer = '';
    this.emit('listeningCancelled');
    this.emit('listeningStateChanged', { isListening: false, state: 'idle', transcription: '' });
    return { success: true, cancelled: true };
  }

  updateTranscription(partialText, isFinal = false) {
    this.transcriptionBuffer = partialText;
    this.emit('transcriptionUpdated', {
      transcription: this.transcriptionBuffer,
      isFinal
    });
    if (isFinal) {
      this.state = 'processing';
    }
    return this.transcriptionBuffer;
  }

  editTranscription(editedText) {
    this.transcriptionBuffer = editedText;
    this.emit('transcriptionUpdated', {
      transcription: this.transcriptionBuffer,
      isFinal: false,
      isEdited: true
    });
    return this.transcriptionBuffer;
  }

  setSpokenResponsePreference(enabled) {
    this.ttsEnabled = Boolean(enabled);
    this.emit('ttsPreferenceChanged', { ttsEnabled: this.ttsEnabled });
    return this.ttsEnabled;
  }

  setSpeechRate(rate) {
    const parsed = parseFloat(rate);
    if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) {
      this.speechRate = parsed;
      this.emit('voiceSettingsChanged', { speechRate: this.speechRate });
    }
    return this.speechRate;
  }

  setPreferredVoice(voiceName) {
    this.preferredVoice = voiceName || 'default';
    this.emit('voiceSettingsChanged', { preferredVoice: this.preferredVoice });
    return this.preferredVoice;
  }

  setWakeWordEnabled(enabled) {
    this.wakeWordEnabled = Boolean(enabled);
    this.emit('voiceSettingsChanged', { wakeWordEnabled: this.wakeWordEnabled });
    return this.wakeWordEnabled;
  }

  processAudioKeyword(spokenPhrase) {
    if (!this.wakeWordEnabled) return false;
    if (!spokenPhrase || typeof spokenPhrase !== 'string') return false;
    const clean = spokenPhrase.toLowerCase().trim();
    if (clean.includes(this.wakeWord.toLowerCase()) || clean.includes('hey astro') || clean === 'astro') {
      this.emit('wakeWordDetected', { phrase: spokenPhrase });
      return true;
    }
    return false;
  }

  /**
   * Filter text before reading aloud:
   * Strips code blocks, markdown headings, URLs, and source citations so only
   * clean natural spoken text is read out.
   */
  cleanTextForSpeech(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';

    return rawText
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, ' [code snippet omitted] ')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove markdown headings
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold and italics
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove URLs
      .replace(/https?:\/\/\S+/gi, '')
      // Remove citations like [1], [Doc: file.txt], [file.md:1-10]
      .replace(/\[\d+\]/g, '')
      .replace(/\[(?:doc|file|source)[^\]]*\]/gi, '')
      // Remove prompt boundaries or notes
      .replace(/\[NOTE:.*?\]/gi, '')
      // Remove bullet asterisks / dashes
      .replace(/^[\*\-\+]\s+/gm, '')
      // Clean duplicate whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Break text into natural spoken sentence chunks for streaming TTS
   */
  segmentSentences(text) {
    const clean = this.cleanTextForSpeech(text);
    if (!clean) return [];

    // Split on sentence boundaries: . ! ? followed by space or newline
    const rawSentences = clean.split(/(?<=[.!?])\s+/);
    return rawSentences
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Start or queue speaking response
   */
  speakText(text) {
    if (!this.ttsEnabled) {
      return { spoken: false, reason: 'TTS disabled' };
    }

    const sentences = this.segmentSentences(text);
    if (sentences.length === 0) {
      return { spoken: false, reason: 'Empty text after cleaning' };
    }

    this.stopSpeaking(); // Interrupt any previous speech
    this.isSpeaking = true;
    this.isInterrupted = false;
    this.state = 'speaking';
    this.speechQueue = [...sentences];

    this.emit('speakingStateChanged', {
      isSpeaking: true,
      state: 'speaking',
      sentencesCount: sentences.length,
      firstSentence: sentences[0]
    });

    return {
      spoken: true,
      sentencesCount: sentences.length,
      sentences
    };
  }

  stopSpeaking() {
    const wasSpeaking = this.isSpeaking;
    this.isSpeaking = false;
    this.speechQueue = [];
    this.currentUtterance = null;
    this.isInterrupted = wasSpeaking;
    this.state = wasSpeaking ? 'interrupted' : 'idle';

    this.emit('speakingStateChanged', {
      isSpeaking: false,
      interrupted: wasSpeaking,
      state: this.state
    });

    return true;
  }

  interrupt() {
    return this.stopSpeaking();
  }
}

module.exports = {
  VoiceService
};
