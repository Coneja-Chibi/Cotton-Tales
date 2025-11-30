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
    EXPRESSION_API,
    PROMPT_TYPE,
    DEFAULT_LLM_PROMPT,
    VECTHARE_TRIGGER,
    DEFAULT_CLASSIFIER_MODEL,
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
    // EXPRESSION CLASSIFICATION SETTINGS
    // ==========================================================================

    /** Which API to use for expression classification */
    expressionApi: EXPRESSION_API.local,

    /** Which classifier model to use (for local API) */
    classifierModel: DEFAULT_CLASSIFIER_MODEL,

    /** Use quantized model (smaller, faster) vs full precision (slightly more accurate) */
    useQuantizedModel: true,

    /** Custom HuggingFace repo override (if user mirrors models) */
    customClassifierRepo: '',

    /** LLM prompt type (raw or full context) */
    expressionPromptType: PROMPT_TYPE.raw,

    /** Custom LLM prompt for classification */
    expressionLlmPrompt: DEFAULT_LLM_PROMPT,

    /** Only show expressions that have sprites available */
    filterAvailableExpressions: false,

    /** Translate text to English before classification */
    translateBeforeClassify: false,

    /** Show thinking expression while LLM is generating (requires per-character thinking expression set) */
    showThinkingExpression: true,

    /** Connection profile ID for LLM classification (empty = use current API) */
    expressionConnectionProfile: '',

    // ==========================================================================
    // VECTHARE INTEGRATION SETTINGS
    // ==========================================================================

    /** When to trigger VectHare classification */
    vecthareTrigger: VECTHARE_TRIGGER.after_response,

    /** Use VectHare's embedding provider instead of its own */
    vecthareUseProvider: true,

    /** Cache emotion embeddings for faster classification */
    vecthareCacheEmotions: true,

    /**
     * Summary vectors - multiple phrases that resolve to the same emotion
     * Structure: { emotionName: ['phrase1', 'phrase2', ...] }
     */
    summaryVectors: {},

    /**
     * Keyword boosters - keywords that boost specific emotion scores
     * Structure: { keyword: { emotion: 'emotionName', boost: 1.5 } }
     */
    keywordBoosts: {},

    // ==========================================================================
    // CUSTOM EMOTIONS (VectHare Semantic Enhancement)
    // ==========================================================================

    /** Global custom emotion definitions */
    customEmotions: {},

    /** Per-character custom emotion definitions and mappings */
    characterEmotions: {},

    /** Similarity score threshold for custom emotions to match */
    customEmotionScoreThreshold: 0.5,

    // ==========================================================================
    // EXPRESSION PROFILES & MAPPINGS
    // ==========================================================================

    /** Custom expression mappings for LLM/WebLLM modes */
    customExpressionMappings: [],

    /** Per-character expression profiles */
    characterExpressionProfiles: {},

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

    // ==========================================================================
    // PER-CARD NPC/SPRITE DATA
    // ==========================================================================

    /**
     * Per-card NPC storage
     * Structure: { [cardId]: [{ name, avatar, folderName, outfits, triggers, outfitTriggers }] }
     */
    cardNpcs: {},
};

/**
 * Returns a deep copy of default settings
 * @returns {Object} Fresh copy of default settings
 */
export function getDefaultSettings() {
    return JSON.parse(JSON.stringify(defaultSettings));
}
