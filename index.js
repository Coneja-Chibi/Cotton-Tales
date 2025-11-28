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
import { renderSettings, populateCharacterCarousel } from './ui/settings-panel.js';
import {
    activateLandingPage,
    deactivateLandingPage,
} from './ui/landing-page.js';
import { openSpriteManager, closeSpriteManager } from './ui/sprite-manager.js';

// Cotton-Tales modules - Expressions
import { initExpressions, setExpressionsVisible } from './ct-expressions.js';

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

// =============================================================================
// EVENT HANDLERS
// =============================================================================

/**
 * Handle chat changes - toggle landing page and VN mode
 */
function onChatChanged() {
    const settings = getSettings();
    const context = getContext();

    // Check if we're on landing page or in active chat
    const hasActiveChat = context.chatId && context.characterId !== undefined;

    if (!hasActiveChat) {
        // On landing page - disable VN layout
        disableVNLayout();

        if (settings.enabled) {
            setTimeout(() => {
                activateLandingPage();
            }, 150);
        } else {
            deactivateLandingPage();
        }
    } else {
        // In active chat - deactivate landing page styling
        deactivateLandingPage();

        // Enable VN layout if Cotton-Tales is enabled
        if (settings.enabled) {
            enableVNLayout();
        } else {
            disableVNLayout();
        }
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Load additional CSS file
 */
function loadCSS(filename) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = `/scripts/extensions/third-party/Cotton-Tales/${filename}`;
    document.head.appendChild(link);
}

/**
 * Load CSS from ui subfolder
 */
function loadUiCSS(filename) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = `/scripts/extensions/third-party/Cotton-Tales/ui/${filename}`;
    document.head.appendChild(link);
}

/**
 * Main initialization function
 */
async function init() {
    console.log(`[${EXTENSION_NAME}] Initializing...`);

    // Load CSS
    loadCSS('ct-expressions.css');
    loadUiCSS('sprite-manager.css');

    // Initialize settings
    initializeSettings();

    // Register event listeners
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.CHARACTER_PAGE_LOADED, populateCharacterCarousel);

    // Render settings UI
    renderSettings();

    // Initialize expressions system (sprites, VN mode)
    await initExpressions();

    // Check initial state and apply appropriate mode
    const settings = getSettings();
    const context = getContext();
    const hasActiveChat = context.chatId && context.characterId !== undefined;

    if (settings.enabled) {
        if (!hasActiveChat) {
            // On landing page
            setTimeout(() => {
                activateLandingPage();
            }, 150);
        } else {
            // In active chat - enable VN layout
            enableVNLayout();
        }
    }

    console.log(`[${EXTENSION_NAME}] Initialization complete`);
}

/**
 * Handle when VN mode is toggled on/off
 * Called from settings panel
 */
export function onVNModeToggled(enabled) {
    const context = getContext();
    const hasActiveChat = context.chatId && context.characterId !== undefined;

    if (enabled) {
        if (!hasActiveChat) {
            // On landing page - activate landing page styling
            setTimeout(() => {
                activateLandingPage();
            }, 150);
        } else {
            // In active chat - enable VN layout immediately
            enableVNLayout();
            setExpressionsVisible(true);
        }
        console.log(`[${EXTENSION_NAME}] VN mode enabled`);
    } else {
        // Immediately hide expressions and disable layout
        setExpressionsVisible(false);
        disableVNLayout();
        deactivateLandingPage();
        console.log(`[${EXTENSION_NAME}] VN mode disabled`);
    }
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

export { EXTENSION_NAME, openSpriteManager, closeSpriteManager };
