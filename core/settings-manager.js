/**
 * ============================================================================
 * COTTON-TALES SETTINGS MANAGER
 * ============================================================================
 * Centralized settings access - breaks circular dependency between
 * index.js and settings-panel.js
 *
 * @author Coneja Chibi
 * @version 0.1.0-alpha
 * ============================================================================
 */

import { extension_settings } from '../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../script.js';
import { SETTINGS_KEY } from './constants.js';
import { getDefaultSettings } from './default-settings.js';

// =============================================================================
// SETTINGS ACCESS
// =============================================================================

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

/**
 * Update multiple settings at once
 * @param {Object} updates - Key-value pairs to update
 */
export function updateSettings(updates) {
    if (extension_settings[SETTINGS_KEY]) {
        Object.assign(extension_settings[SETTINGS_KEY], updates);
        saveSettingsDebounced();
    }
}

/**
 * Reset settings to defaults
 */
export function resetSettings() {
    extension_settings[SETTINGS_KEY] = getDefaultSettings();
    saveSettingsDebounced();
}

/**
 * Force save settings immediately (for operations that need sync save)
 */
export async function saveSettings() {
    saveSettingsDebounced();
}
