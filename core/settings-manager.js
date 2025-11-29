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
import { SETTINGS_KEY, EXPRESSION_API, LAYOUT_MODE, TRANSITION_TYPE, DIALOGUE_POSITION, VECTHARE_TRIGGER } from './constants.js';
import { getDefaultSettings } from './default-settings.js';

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validation rules for settings
 * Each key maps to a validator function that returns true if valid
 */
const VALIDATORS = {
    enabled: (v) => typeof v === 'boolean',
    layoutMode: (v) => Object.values(LAYOUT_MODE).includes(v),
    dialoguePosition: (v) => Object.values(DIALOGUE_POSITION).includes(v),
    dialogueOpacity: (v) => typeof v === 'number' && v >= 0 && v <= 100,
    typewriterEnabled: (v) => typeof v === 'boolean',
    typewriterSpeed: (v) => typeof v === 'number' && v >= 0 && v <= 500,
    choiceCount: (v) => typeof v === 'number' && v >= 2 && v <= 4,
    showCustomInput: (v) => typeof v === 'boolean',
    choiceButtonStyle: (v) => ['rounded', 'square', 'pill'].includes(v),
    choiceAnimation: (v) => ['fade', 'slide', 'none'].includes(v),
    spriteEnabled: (v) => typeof v === 'boolean',
    spritePosition: (v) => ['left', 'center', 'right'].includes(v),
    spriteTransition: (v) => Object.values(TRANSITION_TYPE).includes(v),
    spriteTransitionDuration: (v) => typeof v === 'number' && v >= 0 && v <= 2000,
    expressionApi: (v) => Object.values(EXPRESSION_API).includes(v),
    vecthareEnabled: (v) => typeof v === 'boolean',
    vecthareTrigger: (v) => Object.values(VECTHARE_TRIGGER).includes(v),
    fallbackExpression: (v) => typeof v === 'string' && v.length > 0,
    expressionsEnabled: (v) => typeof v === 'boolean',
    backgroundTransition: (v) => Object.values(TRANSITION_TYPE).includes(v),
    backgroundTransitionDuration: (v) => typeof v === 'number' && v >= 0 && v <= 2000,
    customExpressionMappings: (v) => Array.isArray(v),
    characterExpressionProfiles: (v) => typeof v === 'object' && v !== null,
};

/**
 * Validate a setting value
 * @param {string} key - Setting key
 * @param {any} value - Value to validate
 * @returns {boolean} True if valid
 */
function isValidSetting(key, value) {
    const validator = VALIDATORS[key];
    if (!validator) {
        // No validator = allow any value (for extensibility)
        return true;
    }
    return validator(value);
}

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
 * Update a setting value with validation
 * @param {string} key - Setting key
 * @param {any} value - New value
 * @returns {boolean} True if setting was updated
 */
export function updateSetting(key, value) {
    if (!extension_settings[SETTINGS_KEY]) {
        console.warn(`[Cotton-Tales] Settings not initialized`);
        return false;
    }

    if (!isValidSetting(key, value)) {
        console.warn(`[Cotton-Tales] Invalid value for setting "${key}":`, value);
        return false;
    }

    extension_settings[SETTINGS_KEY][key] = value;
    saveSettingsDebounced();
    return true;
}

/**
 * Update multiple settings at once with validation
 * @param {Object} updates - Key-value pairs to update
 * @returns {boolean} True if all settings were updated
 */
export function updateSettings(updates) {
    if (!extension_settings[SETTINGS_KEY]) {
        console.warn(`[Cotton-Tales] Settings not initialized`);
        return false;
    }

    // Validate all updates first
    for (const [key, value] of Object.entries(updates)) {
        if (!isValidSetting(key, value)) {
            console.warn(`[Cotton-Tales] Invalid value for setting "${key}":`, value);
            return false;
        }
    }

    Object.assign(extension_settings[SETTINGS_KEY], updates);
    saveSettingsDebounced();
    return true;
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
