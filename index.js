/**
 * ============================================================================
 * COTTON-TALES - VISUAL NOVEL ENGINE FOR SILLYTAVERN
 * ============================================================================
 * Entry point - lean and clean
 *
 * @author Coneja Chibi
 * @version 0.1.0-alpha
 * ============================================================================
 */

import { extension_settings, getContext } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';

// Cotton-Tales modules - Core
import { EXTENSION_NAME, SETTINGS_KEY } from './core/constants.js';
import { getDefaultSettings } from './core/default-settings.js';
import { getSettings, updateSetting } from './core/settings-manager.js';

// Cotton-Tales modules - UI
import { renderSettings, populateCharacterCarousel, registerCallbacks } from './ui/settings-panel.js';
import {
    activateLandingPage,
    deactivateLandingPage,
} from './ui/landing-page.js';
import { openSpriteManager, closeSpriteManager } from './ui/sprite-manager.js';

// Cotton-Tales modules - Expressions
import { initExpressions, setExpressionsVisible, cleanupExpressions } from './ct-expressions.js';

// =============================================================================
// SETTINGS MANAGEMENT
// =============================================================================

/**
 * Deep merge objects - handles nested objects like cardNpcs
 * @param {Object} target - Target object
 * @param {Object} source - Source object to merge from
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            // Recursively merge nested objects
            result[key] = deepMerge(target[key] || {}, source[key]);
        } else if (source[key] !== undefined) {
            // Use source value for primitives and arrays
            result[key] = source[key];
        }
    }
    return result;
}

/**
 * Initialize extension settings with defaults
 */
function initializeSettings() {
    if (!extension_settings[SETTINGS_KEY]) {
        extension_settings[SETTINGS_KEY] = getDefaultSettings();
    } else {
        // Deep merge with defaults to handle new settings while preserving nested objects
        extension_settings[SETTINGS_KEY] = deepMerge(
            getDefaultSettings(),
            extension_settings[SETTINGS_KEY]
        );
    }

    console.log(`[${EXTENSION_NAME}] Settings initialized`);
}

// Re-export settings functions for other modules
export { getSettings, updateSetting };

// =============================================================================
// VN MODE CONTROL
// =============================================================================

/**
 * Enable Visual Novel mode layout
 * Adds waifuMode class and shows character avatar behind chat
 */
function enableVNLayout() {
    $('body').addClass('waifuMode');
    console.debug(`[${EXTENSION_NAME}] VN layout enabled`);
}

/**
 * Disable Visual Novel mode layout
 */
function disableVNLayout() {
    $('body').removeClass('waifuMode');
    console.debug(`[${EXTENSION_NAME}] VN layout disabled`);
}

/**
 * Apply VN state based on current context and settings
 * Centralized logic to avoid duplication
 * @param {boolean} enabled - Whether VN mode should be enabled
 * @param {Object} options - Additional options
 * @param {boolean} [options.updateExpressions=false] - Whether to update expression visibility
 */
function applyVNState(enabled, { updateExpressions = false } = {}) {
    const context = getContext();
    const hasActiveChat = context.chatId && context.characterId !== undefined;

    if (enabled) {
        if (!hasActiveChat) {
            // On landing page - activate landing page styling
            disableVNLayout();
            setTimeout(() => activateLandingPage(), 150);
        } else {
            // In active chat - enable VN layout
            deactivateLandingPage();
            enableVNLayout();
            if (updateExpressions) {
                setExpressionsVisible(true);
            }
        }
    } else {
        // Disable everything
        if (updateExpressions) {
            setExpressionsVisible(false);
        }
        disableVNLayout();
        deactivateLandingPage();
    }
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Handle chat changes - toggle landing page and VN mode
 */
function onChatChanged() {
    const settings = getSettings();
    applyVNState(settings.enabled);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/** @type {HTMLLinkElement[]} */
const loadedStylesheets = [];

/**
 * Load CSS file from extension directory
 * @param {string} path - Path relative to Cotton-Tales folder (e.g., 'styles/landing-page.css')
 * @returns {Promise<void>} Resolves when loaded, rejects on error
 */
function loadCSS(path) {
    return new Promise((resolve, reject) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = `/scripts/extensions/third-party/Cotton-Tales/${path}`;
        link.onload = () => {
            loadedStylesheets.push(link);
            resolve();
        };
        link.onerror = () => {
            console.error(`[${EXTENSION_NAME}] Failed to load CSS: ${path}`);
            reject(new Error(`Failed to load CSS: ${path}`));
        };
        document.head.appendChild(link);
    });
}

/**
 * Main initialization function
 */
async function init() {
    console.log(`[${EXTENSION_NAME}] Initializing...`);

    // Load CSS (parallel loading with error handling)
    try {
        await Promise.all([
            loadCSS('ct-expressions.css'),
            loadCSS('ui/sprite-manager.css'),
            loadCSS('styles/landing-page.css'),
        ]);
    } catch (err) {
        console.warn(`[${EXTENSION_NAME}] Some stylesheets failed to load, extension may not display correctly`);
    }

    // Initialize settings
    initializeSettings();

    // Register callbacks for settings panel (breaks circular dependency)
    registerCallbacks({
        onVNModeToggled,
        openSpriteManager,
    });

    // Register event listeners
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.CHARACTER_PAGE_LOADED, populateCharacterCarousel);

    // Render settings UI
    renderSettings();

    // Initialize expressions system (sprites, VN mode)
    await initExpressions();

    // Check initial state and apply appropriate mode
    const settings = getSettings();
    if (settings.enabled) {
        applyVNState(true);
    }

    console.log(`[${EXTENSION_NAME}] Initialization complete`);
}

/**
 * Handle when VN mode is toggled on/off
 * Called from settings panel
 */
export function onVNModeToggled(enabled) {
    applyVNState(enabled, { updateExpressions: true });
    console.log(`[${EXTENSION_NAME}] VN mode ${enabled ? 'enabled' : 'disabled'}`);
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

/**
 * Full extension cleanup - call when extension is disabled/unloaded
 * Removes all event listeners, DOM elements, and resets state
 */
export function cleanup() {
    console.log(`[${EXTENSION_NAME}] Running full cleanup...`);

    // Remove event listeners registered in init()
    eventSource.removeListener(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.removeListener(event_types.CHARACTER_PAGE_LOADED, populateCharacterCarousel);

    // Cleanup expressions module
    cleanupExpressions();

    // Cleanup UI
    disableVNLayout();
    deactivateLandingPage();
    closeSpriteManager();

    // Remove settings UI
    $('#cotton-tales-settings').remove();

    // Remove loaded stylesheets
    loadedStylesheets.forEach(link => link.remove());
    loadedStylesheets.length = 0;

    console.log(`[${EXTENSION_NAME}] Full cleanup complete`);
}

// =============================================================================
// EXPORTS
// =============================================================================

export { EXTENSION_NAME, openSpriteManager, closeSpriteManager };
