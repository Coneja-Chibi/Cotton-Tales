/**
 * ============================================================================
 * COTTON-TALES - VISUAL NOVEL ENGINE FOR SILLYTAVERN
 * ============================================================================
 * Entry point - lean and clean
 * All logic is in separate modules - see project guidelines
 *
 * @author Coneja Chibi
 * @version 0.1.0-alpha
 * ============================================================================
 */

import { extension_settings, getContext } from '../../../extensions.js';
import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';

// Cotton-Tales modules - Core
import { EXTENSION_NAME, MODULE_NAME, SETTINGS_KEY } from './core/constants.js';
import { defaultSettings, getDefaultSettings } from './core/default-settings.js';

// Cotton-Tales modules - UI (will be created)
// import { renderSettings } from './ui/settings-panel.js';

// Cotton-Tales modules - Engine (will be created)
// import { VNEngine } from './engine/vn-engine.js';

// =============================================================================
// SETTINGS MANAGEMENT
// =============================================================================

/**
 * Initialize extension settings with defaults
 */
function initializeSettings() {
    if (!extension_settings[SETTINGS_KEY]) {
        extension_settings[SETTINGS_KEY] = getDefaultSettings();
    } else {
        // Merge with defaults to handle new settings in updates
        extension_settings[SETTINGS_KEY] = {
            ...getDefaultSettings(),
            ...extension_settings[SETTINGS_KEY],
        };
    }

    console.log(`[${EXTENSION_NAME}] Settings initialized`);
}

/**
 * Get current extension settings
 * @returns {Object} Current settings
 */
export function getSettings() {
    return extension_settings[SETTINGS_KEY] || getDefaultSettings();
}

/**
 * Update a setting value
 * @param {string} key - Setting key
 * @param {any} value - New value
 */
export function updateSetting(key, value) {
    if (extension_settings[SETTINGS_KEY]) {
        extension_settings[SETTINGS_KEY][key] = value;
        saveSettingsDebounced();
    }
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Handle new messages from AI
 * This is where we'll parse VN schema and trigger the engine
 * @param {number} messageId - The message ID
 */
async function onMessageReceived(messageId) {
    const settings = getSettings();
    if (!settings.enabled) return;

    const context = getContext();
    const message = context.chat[messageId];

    if (!message || message.is_user) return;

    console.log(`[${EXTENSION_NAME}] Processing message ${messageId}`);

    // TODO: Parse message through schema parser
    // TODO: Trigger VN engine with parsed data
}

/**
 * Handle chat changes
 */
async function onChatChanged() {
    const settings = getSettings();
    if (!settings.enabled) return;

    console.log(`[${EXTENSION_NAME}] Chat changed, reinitializing...`);

    // TODO: Reset VN state
    // TODO: Load any saved VN state for this chat
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Main initialization function
 * Called when the extension loads
 */
async function init() {
    console.log(`[${EXTENSION_NAME}] Initializing...`);

    // Initialize settings
    initializeSettings();

    // Register event listeners
    eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);

    // TODO: Render settings UI
    // TODO: Initialize VN engine
    // TODO: Initialize diagnostics

    console.log(`[${EXTENSION_NAME}] Initialization complete`);
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// =============================================================================
// EXPORTS
// =============================================================================

// Export for other modules and debugging
export {
    EXTENSION_NAME,
    MODULE_NAME,
};
