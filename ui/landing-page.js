/**
 * ============================================================================
 * COTTON-TALES - LANDING PAGE TRANSFORMATION
 * ============================================================================
 * Applies the sleek colorful OS aesthetic to SillyTavern's landing page.
 * CSS handles all visual styling - JS just toggles the body class.
 *
 * @author Coneja Chibi
 * @version 0.2.0
 * ============================================================================
 */

import { EXTENSION_NAME } from '../core/constants.js';

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

let isLandingPageActive = false;

// =============================================================================
// MAIN CONTROL FUNCTIONS
// =============================================================================

/**
 * Activate the landing page transformation
 * Simply adds a body class - all styling is handled by CSS
 */
export function activateLandingPage() {
    if (isLandingPageActive) {
        console.debug(`[${EXTENSION_NAME}] Landing page already active`);
        return;
    }

    console.log(`[${EXTENSION_NAME}] Activating landing page transformation`);

    // Add body class for CSS targeting - that's it!
    $('body').addClass('ct-landing-active');

    isLandingPageActive = true;
}

/**
 * Deactivate the landing page transformation
 * Remove the body class to restore default ST appearance
 */
export function deactivateLandingPage() {
    if (!isLandingPageActive) {
        console.debug(`[${EXTENSION_NAME}] Landing page not active`);
        return;
    }

    console.log(`[${EXTENSION_NAME}] Deactivating landing page transformation`);

    // Remove body class
    $('body').removeClass('ct-landing-active');

    isLandingPageActive = false;
}

/**
 * Check if we're currently on the landing page
 * @returns {boolean} - True if on landing page
 */
export function isOnLandingPage() {
    return $('.welcomePanel').length > 0;
}

/**
 * Check if landing page transformation is active
 * @returns {boolean} - True if active
 */
export function isLandingPageTransformActive() {
    return isLandingPageActive;
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    activateLandingPage,
    deactivateLandingPage,
    isOnLandingPage,
    isLandingPageTransformActive,
};
