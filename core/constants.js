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

/** Extension version (keep in sync with manifest.json) */
export const VERSION = '0.1.0-alpha';

/** Module name for ST extension system */
export const MODULE_NAME = 'cotton-tales';

// =============================================================================
// VN LAYOUT MODES
// =============================================================================

/** @enum {string} Layout style for VN presentation */
export const LAYOUT_MODE = {
    /** Adventure style - Full screen background, sprites overlaid, dialogue box at bottom (Ren'Py classic) */
    ADV: 'adv',
    /** Portrait style - Character/Persona portraits in ornate side panels, speech bubbles in main area (RPG style) */
    PRT: 'prt',
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

// =============================================================================
// TIMING CONSTANTS
// =============================================================================

/** Default delay for UI initialization in ms */
export const UI_INIT_DELAY = 150;

/** Default fetch timeout in ms */
export const FETCH_TIMEOUT = 30000;

/** Default animation duration in ms */
export const ANIMATION_DURATION = 300;

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
// EXPRESSION CLASSIFICATION API
// =============================================================================

/**
 * Available APIs for expression classification
 * @enum {number}
 */
export const EXPRESSION_API = {
    /** Local BERT classifier (transformers.js) */
    local: 0,
    /** SillyTavern Extras server */
    extras: 1,
    /** LLM-based classification (uses current chat API) */
    llm: 2,
    /** WebLLM browser-based classification */
    webllm: 3,
    /** VectHare semantic classification (bonus - if installed) */
    vecthare: 4,
    /** No classification - use fallback only */
    none: 99,
};

/**
 * LLM prompt types for expression classification
 * @enum {string}
 */
export const PROMPT_TYPE = {
    /** Raw prompt - just the text and instruction */
    raw: 'raw',
    /** Full prompt - uses chat context */
    full: 'full',
};

/** Default LLM prompt for expression classification */
export const DEFAULT_LLM_PROMPT = 'Classify the emotion of the last message. Output just one word. Choose only one: {{labels}}';

// =============================================================================
// CLASSIFIER MODELS
// =============================================================================

/**
 * Available emotion classifier models
 * Users can mirror these to their own HuggingFace for reliability
 */
export const CLASSIFIER_MODELS = {
    /** RoBERTa GoEmotions - high quality 28 labels */
    roberta_go_emotions: {
        id: 'roberta_go_emotions',
        name: 'RoBERTa GoEmotions',
        repo: 'Chi-Bi/roberta-go-emotions-onnx',
        labels: 28,
        labelList: ['admiration', 'amusement', 'anger', 'annoyance', 'approval', 'caring', 'confusion', 'curiosity', 'desire', 'disappointment', 'disapproval', 'disgust', 'embarrassment', 'excitement', 'fear', 'gratitude', 'grief', 'joy', 'love', 'nervousness', 'optimism', 'pride', 'realization', 'relief', 'remorse', 'sadness', 'surprise', 'neutral'],
        f1: 0.54,
        description: 'High quality RoBERTa model. 28 GoEmotions labels with good accuracy.',
    },
    /** MicahB DistilRoBERTa - trained on dialogue (7 labels) */
    distilroberta_dialogue: {
        id: 'distilroberta_dialogue',
        name: 'DistilRoBERTa Dialogue',
        repo: 'Chi-Bi/emotion-text-classifier-onnx',
        labels: 7,
        labelList: ['anger', 'disgust', 'fear', 'joy', 'neutral', 'sadness', 'surprise'],
        f1: 0.815,
        description: 'Trained on dialogue/conversation. 7 Ekman emotions. Great for RP chat.',
    },
    /** boltuix BERT - 13 labels with RP-specific emotions */
    bert_emotion_rp: {
        id: 'bert_emotion_rp',
        name: 'BERT Emotion (RP)',
        repo: 'Chi-Bi/bert-emotion-onnx',
        labels: 13,
        labelList: ['anger', 'disgust', 'fear', 'guilt', 'joy', 'love', 'sadness', 'shame', 'surprise', 'desire', 'sarcasm', 'neutral', 'embarrassment'],
        f1: 0.93,
        description: '13 labels including sarcasm, shame, guilt, desire. Perfect for roleplay.',
    },
    /** bhadresh-savani DistilBERT - 6 labels, highest accuracy */
    distilbert_high_accuracy: {
        id: 'distilbert_high_accuracy',
        name: 'DistilBERT (Highest Accuracy)',
        repo: 'Chi-Bi/distilbert-emotion-onnx',
        labels: 6,
        labelList: ['sadness', 'joy', 'love', 'anger', 'fear', 'surprise'],
        f1: 0.938,
        description: '6 basic emotions with highest accuracy (F1: 0.938). Simple but reliable.',
    },
    /** tae898 EmoBERTa - dialogue emotion recognition */
    emoberta_dialogue: {
        id: 'emoberta_dialogue',
        name: 'EmoBERTa Large',
        repo: 'Chi-Bi/emoberta-large-onnx',
        labels: 7,
        labelList: ['neutral', 'joy', 'surprise', 'anger', 'sadness', 'disgust', 'fear'],
        f1: 0.656,
        description: 'Large RoBERTa model trained on dialogue emotion recognition.',
    },
};

/** Default classifier model */
export const DEFAULT_CLASSIFIER_MODEL = 'roberta_go_emotions';

/** Special fallback options */
export const FALLBACK_OPTIONS = {
    /** No fallback - leave blank */
    NONE: '#none',
    /** Emoji-based fallback */
    EMOJI: '#emoji',
};

/**
 * When to trigger VectHare classification
 * @enum {string}
 */
export const VECTHARE_TRIGGER = {
    /** Classify after AI response is complete */
    after_response: 'after_response',
    /** Classify before user message is sent (on previous AI message) */
    before_send: 'before_send',
};

/**
 * Emotion descriptions for semantic matching
 * Maps emotion labels to descriptive text for better embedding similarity
 */
export const EMOTION_DESCRIPTIONS = {
    admiration: 'feeling admiration, respect, awe, impressed, looking up to someone',
    amusement: 'feeling amused, entertained, finding something funny, laughing',
    anger: 'feeling angry, mad, furious, enraged, irritated',
    annoyance: 'feeling annoyed, bothered, irritated, frustrated',
    approval: 'feeling approval, agreement, acceptance, nodding along',
    caring: 'feeling caring, nurturing, protective, wanting to help',
    confusion: 'feeling confused, puzzled, bewildered, not understanding',
    curiosity: 'feeling curious, interested, wanting to know more, intrigued',
    desire: 'feeling desire, longing, wanting, craving',
    disappointment: 'feeling disappointed, let down, unsatisfied',
    disapproval: 'feeling disapproval, disagreement, rejection, shaking head',
    disgust: 'feeling disgusted, repulsed, revolted, grossed out',
    embarrassment: 'feeling embarrassed, ashamed, self-conscious, blushing',
    excitement: 'feeling excited, thrilled, eager, pumped up',
    fear: 'feeling afraid, scared, frightened, terrified',
    gratitude: 'feeling grateful, thankful, appreciative',
    grief: 'feeling grief, mourning, deep sadness, loss',
    joy: 'feeling joyful, happy, delighted, elated',
    love: 'feeling love, affection, adoration, deep caring',
    nervousness: 'feeling nervous, anxious, worried, on edge',
    optimism: 'feeling optimistic, hopeful, positive about the future',
    pride: 'feeling proud, accomplished, satisfied with achievement',
    realization: 'having a realization, understanding something, epiphany',
    relief: 'feeling relieved, weight lifted, tension released',
    remorse: 'feeling remorse, regret, sorry for something done',
    sadness: 'feeling sad, unhappy, down, melancholy',
    surprise: 'feeling surprised, shocked, astonished, unexpected',
    neutral: 'feeling neutral, calm, balanced, no strong emotion',
};

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

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Fetch with timeout - wraps fetch with AbortController timeout
 * @param {string} url - URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {number} timeout - Timeout in ms (default: FETCH_TIMEOUT)
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}
