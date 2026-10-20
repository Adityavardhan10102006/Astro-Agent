const EventEmitter = require('events');

const MODEL_STATES = {
  NOT_INSTALLED: 'not-installed',
  QUEUED: 'queued',
  DOWNLOADING: 'downloading',
  VERIFYING: 'verifying',
  INSTALLING: 'installing',
  INSTALLED: 'installed',
  LOADING: 'loading',
  READY: 'ready',
  UNLOADING: 'unloading',
  FAILED: 'failed',
  INCOMPATIBLE: 'incompatible'
};

const ALLOWED_TRANSITIONS = {
  [MODEL_STATES.NOT_INSTALLED]: [MODEL_STATES.QUEUED, MODEL_STATES.VERIFYING, MODEL_STATES.INSTALLED, MODEL_STATES.INCOMPATIBLE, MODEL_STATES.FAILED],
  [MODEL_STATES.QUEUED]: [MODEL_STATES.DOWNLOADING, MODEL_STATES.NOT_INSTALLED, MODEL_STATES.FAILED],
  [MODEL_STATES.DOWNLOADING]: [MODEL_STATES.VERIFYING, MODEL_STATES.FAILED, MODEL_STATES.QUEUED, MODEL_STATES.NOT_INSTALLED],
  [MODEL_STATES.VERIFYING]: [MODEL_STATES.INSTALLING, MODEL_STATES.FAILED],
  [MODEL_STATES.INSTALLING]: [MODEL_STATES.INSTALLED, MODEL_STATES.FAILED],
  [MODEL_STATES.INSTALLED]: [MODEL_STATES.LOADING, MODEL_STATES.NOT_INSTALLED, MODEL_STATES.FAILED],
  [MODEL_STATES.LOADING]: [MODEL_STATES.READY, MODEL_STATES.FAILED],
  [MODEL_STATES.READY]: [MODEL_STATES.UNLOADING, MODEL_STATES.FAILED],
  [MODEL_STATES.UNLOADING]: [MODEL_STATES.INSTALLED, MODEL_STATES.FAILED],
  [MODEL_STATES.FAILED]: [MODEL_STATES.QUEUED, MODEL_STATES.NOT_INSTALLED, MODEL_STATES.LOADING],
  [MODEL_STATES.INCOMPATIBLE]: [MODEL_STATES.NOT_INSTALLED]
};

class ModelLifecycleManager extends EventEmitter {
  constructor() {
    super();
    this.modelStates = new Map(); // modelId -> { state, error, lastUpdated }
  }

  getModelState(modelId) {
    if (!this.modelStates.has(modelId)) {
      return {
        modelId,
        state: MODEL_STATES.NOT_INSTALLED,
        error: null,
        lastUpdated: Date.now()
      };
    }
    return this.modelStates.get(modelId);
  }

  transition(modelId, targetState, error = null) {
    const current = this.getModelState(modelId);
    const validNextStates = ALLOWED_TRANSITIONS[current.state] || [];

    if (!validNextStates.includes(targetState)) {
      throw new Error(`Invalid lifecycle transition for model ${modelId}: cannot transition from '${current.state}' to '${targetState}'.`);
    }

    const updated = {
      modelId,
      state: targetState,
      error: error ? (error.message || String(error)) : null,
      lastUpdated: Date.now()
    };

    this.modelStates.set(modelId, updated);
    this.emit('stateChanged', updated);
    return updated;
  }

  canTransition(modelId, targetState) {
    const current = this.getModelState(modelId);
    const validNextStates = ALLOWED_TRANSITIONS[current.state] || [];
    return validNextStates.includes(targetState);
  }

  getState(modelId) {
    return this.getModelState(modelId).state;
  }

  reset(modelId) {
    this.modelStates.set(modelId, {
      modelId,
      state: MODEL_STATES.NOT_INSTALLED,
      error: null,
      lastUpdated: Date.now()
    });
  }
}

module.exports = {
  MODEL_STATES,
  LIFECYCLE_STATES: MODEL_STATES,
  ModelLifecycleManager
};
