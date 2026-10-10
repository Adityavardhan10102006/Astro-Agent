const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class VoiceService extends EventEmitter {
  constructor(storageService) {
    super();
    this.storage = storageService;
    this.isListening = false;
    this.isSpeaking = false;
    this.permissionStatus = 'granted'; // Desktop Electron permissions
    this.transcriptionBuffer = '';
    this.ttsEnabled = false;
  }

  getEngineStatus() {
    this.storage.ensureDirectories();
    const whisperDir = path.join(this.storage.paths.models, 'whisper');
    const hasLocalWhisper = fs.existsSync(whisperDir) && fs.readdirSync(whisperDir).some(f => f.endsWith('.gguf') || f.endsWith('.bin'));

    return {
      isListening: this.isListening,
      isSpeaking: this.isSpeaking,
      permissionStatus: this.permissionStatus,
      ttsEnabled: this.ttsEnabled,
      sttAvailable: hasLocalWhisper,
      sttEngine: hasLocalWhisper ? 'Local Whisper GGUF' : 'Unconfigured',
      missingComponents: hasLocalWhisper ? [] : [
        'Local speech recognition model (whisper-base.gguf) not installed.'
      ],
      recommendation: hasLocalWhisper ? 'Engine ready for offline speech input' : 'Install Whisper GGUF in Model Manager or enter prompts via text.'
    };
  }

  startListening() {
    const status = this.getEngineStatus();
    if (!status.sttAvailable) {
      throw new Error('Cannot start listening: Local speech recognition model (Whisper GGUF) is not installed. To maintain Rule 2 (offline-first & private), ASTRO does not send audio to cloud transcription services.');
    }

    this.isListening = true;
    this.transcriptionBuffer = '';
    this.emit('listeningStateChanged', { isListening: true });
    return { success: true, isListening: true };
  }

  stopListening() {
    if (!this.isListening) return { isListening: false };
    this.isListening = false;
    this.emit('listeningStateChanged', { isListening: false, transcription: this.transcriptionBuffer });
    return { success: true, isListening: false, transcription: this.transcriptionBuffer };
  }

  setSpokenResponsePreference(enabled) {
    this.ttsEnabled = Boolean(enabled);
    this.emit('ttsPreferenceChanged', { ttsEnabled: this.ttsEnabled });
    return this.ttsEnabled;
  }

  stopSpeaking() {
    this.isSpeaking = false;
    this.emit('speakingStateChanged', { isSpeaking: false });
    return true;
  }
}

module.exports = {
  VoiceService
};
