/**
 * ============================================================================
 * COTTON-TALES DEFAULT SETTINGS
 * ============================================================================
 * Default configuration for the extension.
 * These are merged with user settings on load.
 *
 * @author Coneja Chibi
 * @version 0.1.0-alpha
 * ============================================================================
 */

import {
    LAYOUT_MODE,
    DEFAULT_LAYOUT_MODE,
    DEFAULT_CHOICE_COUNT,
    DEFAULT_SHOW_CUSTOM_INPUT,
    DEFAULT_FALLBACK_EXPRESSION,
    DEFAULT_TRANSITION_DURATION,
    DEFAULT_DIALOGUE_OPACITY,
    DEFAULT_TYPEWRITER_SPEED,
    TRANSITION_TYPE,
    DIALOGUE_POSITION,
} from './constants.js';

/**
 * Default settings structure for Cotton-Tales
 * @type {Object}
 */
export const defaultSettings = {
    // ==========================================================================
    // MASTER CONTROLS
    // ==========================================================================

    /** Whether VN mode is enabled */
    enabled: false,

    // ==========================================================================
    // DISPLAY SETTINGS
    // ==========================================================================

    /** Layout mode: 'adv' (dialogue at bottom) or 'nvl' (text fills screen) */
    layoutMode: DEFAULT_LAYOUT_MODE,

    /** Dialogue box position */
    dialoguePosition: DIALOGUE_POSITION.BOTTOM,

    /** Dialogue box opacity (0-100) */
    dialogueOpacity: DEFAULT_DIALOGUE_OPACITY,

    /** Enable typewriter effect for text */
    typewriterEnabled: true,

    /** Typewriter speed (ms per character) */
    typewriterSpeed: DEFAULT_TYPEWRITER_SPEED,

    // ==========================================================================
    // CHOICE SETTINGS
    // ==========================================================================

    /** Number of choices to request from AI (2-4) */
    choiceCount: DEFAULT_CHOICE_COUNT,

    /** Always show "Type your own..." option */
    showCustomInput: DEFAULT_SHOW_CUSTOM_INPUT,

    /** Choice button style: 'rounded', 'square', 'pill' */
    choiceButtonStyle: 'rounded',

    /** Choice panel animation: 'fade', 'slide', 'none' */
    choiceAnimation: 'fade',

    // ==========================================================================
    // SPRITE SETTINGS
    // ==========================================================================

    /** Enable expression triggers from schema */
    expressionsEnabled: true,

    /** Enable sprite effects (hearts, sparkles, etc.) */
    effectsEnabled: true,

    /** Sprite transition type */
    spriteTransition: TRANSITION_TYPE.FADE,

    /** Sprite transition duration (ms) */
    spriteTransitionDuration: DEFAULT_TRANSITION_DURATION,

    /** Fallback expression when none specified */
    fallbackExpression: DEFAULT_FALLBACK_EXPRESSION,

    // ==========================================================================
    // BACKGROUND SETTINGS
    // ==========================================================================

    /** Enable automatic background switching from schema */
    autoBackgroundEnabled: true,

    /** Background transition type */
    backgroundTransition: TRANSITION_TYPE.FADE,

    /** Background transition duration (ms) */
    backgroundTransitionDuration: 500,

    // ==========================================================================
    // SCHEMA / PARSING SETTINGS
    // ==========================================================================

    /** How to handle non-JSON responses */
    fallbackBehavior: 'smart_parse', // 'strict', 'graceful', 'smart_parse'

    /** Custom system prompt addition for VN schema (advanced users) */
    customSchemaPrompt: '',

    // ==========================================================================
    // AUDIO SETTINGS (PHASE 6)
    // ==========================================================================

    /** Enable audio triggers */
    audioEnabled: false,

    /** Master volume (0-100) */
    masterVolume: 80,

    /** Music volume (0-100) */
    musicVolume: 70,

    /** SFX volume (0-100) */
    sfxVolume: 80,
};

/**
 * Returns a deep copy of default settings
 * @returns {Object} Fresh copy of default settings
 */
export function getDefaultSettings() {
    return JSON.parse(JSON.stringify(defaultSettings));
}
