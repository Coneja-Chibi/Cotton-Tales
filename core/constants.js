/**
 * ============================================================================
 * COTTON-TALES CONSTANTS
 * ============================================================================
 * Centralized configuration values used across the extension.
 * Change these values here instead of hunting through the codebase.
 *
 * @author Coneja Chibi
 * @version 0.1.0-alpha
 * ============================================================================
 */

// =============================================================================
// EXTENSION IDENTITY
// =============================================================================

/** Extension name for logging and UI */
export const EXTENSION_NAME = 'Cotton-Tales';

/** Module name for ST extension system */
export const MODULE_NAME = 'cotton-tales';

// =============================================================================
// VN LAYOUT MODES
// =============================================================================

/** @enum {string} Layout style for VN presentation */
export const LAYOUT_MODE = {
    ADV: 'adv',     // Adventure style - dialogue box at bottom, sprites above
    NVL: 'nvl',     // Novel style - text fills screen like a book
};

/** Default layout mode */
export const DEFAULT_LAYOUT_MODE = LAYOUT_MODE.ADV;

// =============================================================================
// CHOICE SYSTEM
// =============================================================================

/** Minimum choices to display per turn */
export const MIN_CHOICES = 2;

/** Maximum choices to display per turn */
export const MAX_CHOICES = 4;

/** Default number of choices */
export const DEFAULT_CHOICE_COUNT = 3;

/** Whether to always show custom input option */
export const DEFAULT_SHOW_CUSTOM_INPUT = true;

// =============================================================================
// EXPRESSION / SPRITE DEFAULTS
// =============================================================================

/** Default fallback expression when none specified */
export const DEFAULT_FALLBACK_EXPRESSION = 'neutral';

/** Default expressions the AI can use */
export const DEFAULT_EXPRESSIONS = [
    'admiration',
    'amusement',
    'anger',
    'annoyance',
    'approval',
    'caring',
    'confusion',
    'curiosity',
    'desire',
    'disappointment',
    'disapproval',
    'disgust',
    'embarrassment',
    'excitement',
    'fear',
    'gratitude',
    'grief',
    'joy',
    'love',
    'nervousness',
    'optimism',
    'pride',
    'realization',
    'relief',
    'remorse',
    'sadness',
    'surprise',
    'neutral',
];

// =============================================================================
// EFFECTS
// =============================================================================

/** @enum {string} Available sprite effects */
export const SPRITE_EFFECTS = {
    NONE: 'none',
    HEARTS: 'hearts',
    SPARKLE: 'sparkle',
    SWEAT_DROP: 'sweat_drop',
    ANGER_VEIN: 'anger_vein',
    BLUSH: 'blush',
    TEARS: 'tears',
    SHOCK: 'shock',
};

// =============================================================================
// TRANSITIONS
// =============================================================================

/** @enum {string} Transition types for sprites and backgrounds */
export const TRANSITION_TYPE = {
    NONE: 'none',
    FADE: 'fade',
    DISSOLVE: 'dissolve',
    SLIDE_LEFT: 'slide_left',
    SLIDE_RIGHT: 'slide_right',
};

/** Default transition duration in milliseconds */
export const DEFAULT_TRANSITION_DURATION = 300;

/** Sprite transition duration */
export const SPRITE_TRANSITION_DURATION = 200;

/** Background transition duration */
export const BACKGROUND_TRANSITION_DURATION = 500;

// =============================================================================
// DIALOGUE BOX
// =============================================================================

/** @enum {string} Dialogue box positions */
export const DIALOGUE_POSITION = {
    BOTTOM: 'bottom',
    TOP: 'top',
};

/** Default dialogue box opacity (0-100) */
export const DEFAULT_DIALOGUE_OPACITY = 85;

/** Typewriter effect speed (ms per character) */
export const DEFAULT_TYPEWRITER_SPEED = 30;

// =============================================================================
// RESPONSE SCHEMA
// =============================================================================

/** JSON schema fields we expect from AI responses */
export const SCHEMA_FIELDS = {
    NARRATIVE: 'narrative',
    SPEAKER: 'speaker',
    EXPRESSION: 'expression',
    SCENE: 'scene',
    CHOICES: 'choices',
    AUDIO: 'audio',
};

// =============================================================================
// UI CLASSES
// =============================================================================

/** CSS class prefix for all Cotton-Tales elements */
export const CSS_PREFIX = 'ct';

/** Z-index values for layering */
export const Z_INDEX = {
    BACKGROUND: 1,
    SPRITES: 10,
    EFFECTS: 20,
    DIALOGUE_BOX: 100,
    CHOICES: 110,
    OVERLAY: 200,
    MODAL: 300,
};

// =============================================================================
// SETTINGS KEYS
// =============================================================================

/** Settings storage key in extension_settings */
export const SETTINGS_KEY = 'cottonTales';
