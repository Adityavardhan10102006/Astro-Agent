/**
 * ASTRO — External AI Provider Interface (Rule 2, Rule 4, Phase 4 Part E)
 * 
 * Complies with strict offline-first policy:
 * - External AI providers are DISABLED by default.
 * - Switching to a remote provider requires explicit configuration and user authorization.
 * - ASTRO never silently falls back from local inference to a cloud model.
 * - Clearly discloses when external processing is enabled and which provider receives requests.
 */

class ExternalProviderInterface {
  constructor(storageService = null) {
    this.storage = storageService;
    this.enabled = false;
    this.activeProvider = null;
    this.config = {};
  }

  isRemoteInferenceEnabled() {
    return this.enabled;
  }

  getActiveProviderInfo() {
    return {
      enabled: this.enabled,
      providerName: this.activeProvider || 'None (Local AI Only)',
      isLocalDefault: !this.enabled,
      disclosureNotice: this.enabled
        ? `EXTERNAL PROCESSING ACTIVE: Prompts and context are sent to ${this.activeProvider}. Local-only privacy is bypassed for these requests.`
        : 'LOCAL PRIVACY ENFORCED: 100% offline local inference on device. No data is sent to external servers.'
    };
  }

  /**
   * Explicitly enable an external provider with mandatory user authorization.
   * Silently enabling or auto-fallback is strictly prohibited.
   */
  async configureRemoteProvider({ providerName, endpoint, apiKey, userConfirmed }) {
    if (!userConfirmed) {
      throw new Error(
        'User authorization required: Remote inference transmits prompts outside your laptop. You must explicitly confirm authorization.'
      );
    }

    if (!providerName || !endpoint) {
      throw new Error('Provider name and endpoint URL are required.');
    }

    this.activeProvider = providerName;
    this.config = {
      endpoint,
      apiKey: apiKey ? '***masked***' : null
    };
    this.enabled = true;

    return this.getActiveProviderInfo();
  }

  disableRemoteProvider() {
    this.enabled = false;
    this.activeProvider = null;
    this.config = {};
    return this.getActiveProviderInfo();
  }

  /**
   * Send inference request to remote provider only if explicitly enabled.
   */
  async generateRemote(prompt, options = {}) {
    if (!this.enabled) {
      throw new Error(
        'External provider is not enabled. ASTRO operates in offline-first mode using local models.'
      );
    }

    throw new Error(
      `Remote provider '${this.activeProvider}' integration is configured but not connected. ASTRO local inference is recommended.`
    );
  }
}

module.exports = {
  ExternalProviderInterface
};
